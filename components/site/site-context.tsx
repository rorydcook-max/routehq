"use client";

import { createContext, useContext, useEffect, useState, type ClipboardEvent, type CSSProperties, type ElementType, type KeyboardEvent, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { LONG_SLOTS, SLOT_MAX, type SiteConfig, type TextSlot } from "@/lib/sites/config";
import { siteTime } from "@/lib/sites/format";
import type { ResolvedImage } from "@/lib/sites/images";
import type { Palette } from "@/lib/sites/palettes";
import type { TemplateDef } from "@/lib/sites/templates";
import type { SiteData } from "@/lib/sites/types";
import s from "./site.module.css";

export type Say = (key: string, values?: Record<string, string | number>) => string;

export type SiteContextValue = {
  config: SiteConfig;
  template: TemplateDef;
  palette: Palette;
  data: SiteData;
  /** The editor's preview: text can be clicked and edited. */
  edit: boolean;
  t: Say;
  /** The text for a slot: the owner's words, or the default worked out from the business. */
  text: (slot: TextSlot) => string;
  setText: (slot: TextSlot, value: string) => void;
  images: { hero: ResolvedImage; about: ResolvedImage };
  noun: "car" | "scooter" | "motorbike" | "vehicle";
  money: (value: number) => string;
  /** A fleet card's Book: opens that vehicle in the booking section. */
  pickVehicle: (vehicleId: string) => void;
  picked: { id: string; n: number } | null;
  /** The hero's search bar: opens the booking section on those dates (and kind of vehicle). */
  searchDates: (start: string, end: string, kind: string) => void;
  search: { start: string; end: string; kind: string; n: number } | null;
};

export const SiteContext = createContext<SiteContextValue | null>(null);

export function useSite() {
  const value = useContext(SiteContext);
  if (!value) throw new Error("useSite outside SitePage");
  return value;
}

/**
 * Opening times in the reader's own style (sites-global): the page's language first ("en" writes 5:30 PM), then, once
 * in the browser, the reader's own region for that language (en-GB, en-AU: 17:30) so the server and first paint agree.
 */
export function useSiteTime() {
  const pageLocale = useLocale();
  const [locale, setLocale] = useState(pageLocale);
  useEffect(() => {
    const base = pageLocale.split("-")[0];
    const own = (navigator.languages || [navigator.language]).find((tag) => tag && tag.split("-")[0] === base);
    setLocale(own || pageLocale);
  }, [pageLocale]);
  return (hhmm: string) => siteTime(hhmm, locale);
}

/**
 * Big display text (the hero headline, the cover's masthead) with a long word in it, e.g. a long business name: the
 * size is brought down until the longest word fits the page's width, so it wraps between words, never inside one.
 * Applied to an inner span so `1em` is the size the template set for that heading at that screen width.
 */
export function fitLongestWord(value: string): CSSProperties | undefined {
  const longest = Math.max(0, ...String(value || "").split(/\s+/).map((word) => Array.from(word).length));
  if (longest < 9) return undefined;
  return { fontSize: `min(1em, calc((min(100vw, 1200px) - 72px) / ${(longest * 0.62).toFixed(2)}))` };
}

/**
 * A piece of the site's text. In the editor's preview it can be clicked and typed into; leaving it saves it to the
 * draft (emptying it puts the default back). Elsewhere it is plain text.
 */
export function Txt({ slot, as, id, className = "", children }: { slot: TextSlot; as?: ElementType; id?: string; className?: string; children?: ReactNode }) {
  const { edit, text, setText, t } = useSite();
  const Tag = (as || "span") as ElementType;
  const value = text(slot);
  const fit = as === "h1" ? fitLongestWord(value) : undefined;
  const shown = fit ? <span style={fit}>{value}</span> : value;
  if (!edit) {
    return (
      <Tag className={className} id={id}>
        {shown}
        {children}
      </Tag>
    );
  }
  const long = LONG_SLOTS.includes(slot);
  return (
    <Tag
      aria-label={t("edit_text")}
      aria-multiline={long || undefined}
      className={`${className} ${s.editable}`}
      contentEditable
      data-slot={slot}
      id={id}
      key={value}
      onBlur={(event: { currentTarget: HTMLElement }) => {
        const next = event.currentTarget.innerText.replace(/ /g, " ").trim().slice(0, SLOT_MAX[slot]);
        if (next !== value) setText(slot, next);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.key === "Escape" || (event.key === "Enter" && !long)) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onPaste={(event: ClipboardEvent<HTMLElement>) => {
        // Plain text only: no styles or links pasted in from elsewhere.
        event.preventDefault();
        const pasted = event.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, long ? pasted : pasted.replace(/\s+/g, " "));
      }}
      role="textbox"
      spellCheck
      suppressContentEditableWarning
      tabIndex={0}
    >
      {shown}
    </Tag>
  );
}
