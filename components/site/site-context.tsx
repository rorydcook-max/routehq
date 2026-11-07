"use client";

import { createContext, useContext, type ClipboardEvent, type ElementType, type KeyboardEvent, type ReactNode } from "react";
import { LONG_SLOTS, SLOT_MAX, type SiteConfig, type TextSlot } from "@/lib/sites/config";
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
};

export const SiteContext = createContext<SiteContextValue | null>(null);

export function useSite() {
  const value = useContext(SiteContext);
  if (!value) throw new Error("useSite outside SitePage");
  return value;
}

/**
 * A piece of the site's text. In the editor's preview it can be clicked and typed into; leaving it saves it to the
 * draft (emptying it puts the default back). Elsewhere it is plain text.
 */
export function Txt({ slot, as, id, className = "", children }: { slot: TextSlot; as?: ElementType; id?: string; className?: string; children?: ReactNode }) {
  const { edit, text, setText, t } = useSite();
  const Tag = (as || "span") as ElementType;
  const value = text(slot);
  if (!edit) {
    return (
      <Tag className={className} id={id}>
        {value}
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
      {value}
    </Tag>
  );
}
