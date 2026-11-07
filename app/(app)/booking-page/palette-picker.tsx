"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Pencil } from "lucide-react";
import { brandColors, COLOR_ROLES, CURATED_PALETTES, LEGACY_PALETTE_IDS, paletteColors, sitePalette, type ColorRole, type PaletteColors } from "@/lib/sites/palettes";
import { templateDef } from "@/lib/sites/templates";
import type { SiteDraft } from "./use-site-draft";

type Say = (key: string, values?: Record<string, string | number>) => string;

/** The five dots on a palette's chip; the chip itself is the page colour. */
const DOTS: ColorRole[] = ["primary", "secondary", "surface", "text", "dark"];

/**
 * The website's palette (Look, Rory 7 Nov 2026): a chip per palette (its page colour with five dots), From your brand
 * first, then the template's own, the curated ones and Custom. Picking one changes the draft, so the preview redraws
 * at once and Publish makes it live. Custom opens a picker and a hex field for each colour, starting from the palette
 * on show.
 */
export function PalettePicker({ site, brandColour }: { site: SiteDraft; brandColour: string }) {
  const say = useTranslations("siteEditor") as unknown as Say;
  const { draft, update } = site;
  const template = templateDef(draft.template);
  const shown = sitePalette(draft, template, brandColour);
  const customColors = draft.colors || paletteColors(shown);

  const choices: Array<{ id: string; colors: PaletteColors }> = [
    { id: "own", colors: brandColors(brandColour) },
    { id: "auto", colors: paletteColors(sitePalette({ ...draft, palette: "auto" }, template, brandColour)) },
    // A palette from before this picker stays on offer while the site uses it.
    ...(LEGACY_PALETTE_IDS.includes(draft.palette) ? [{ id: draft.palette, colors: paletteColors(shown) }] : []),
    ...CURATED_PALETTES
  ];

  const setColor = (role: ColorRole, value: string) => update((current) => ({ ...current, palette: "custom", colors: { ...(current.colors || customColors), [role]: value }, customAccent: null }));

  return (
    <fieldset>
      <legend className="font-semibold text-[var(--foreground)]">{say("palette")}</legend>
      <div className="-mx-1.5 mt-1 max-h-[19.5rem] overflow-y-auto overscroll-contain px-1.5 pb-1.5 pt-2.5">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-x-2.5 gap-y-3" role="radiogroup" aria-label={say("palette")}>
          {choices.map(({ id, colors }) => (
            <Chip colors={colors} key={id} label={say(`pal_${id}`)} on={draft.palette === id} onPick={() => update({ palette: id })} />
          ))}
          <Chip
            colors={draft.colors}
            custom
            label={say("pal_custom")}
            on={draft.palette === "custom"}
            onPick={() => update((current) => ({ ...current, palette: "custom", colors: current.colors || customColors }))}
          />
        </div>
      </div>
      {draft.palette === "custom" ? (
        <div className="mt-2 grid gap-1.5 rounded-2xl bg-[var(--panel-secondary)] p-2">
          {COLOR_ROLES.map((role) => (
            <ColorRow key={role} label={say(`role_${role}`)} onChange={(value) => setColor(role, value)} value={customColors[role]} />
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}

function Chip({ colors, label, on, onPick, custom = false }: { colors: PaletteColors | null; label: string; on: boolean; onPick: () => void; custom?: boolean }) {
  const ground = colors?.background || "#ffffff";
  return (
    <button aria-checked={on} aria-label={label} className="group flex min-w-0 flex-col items-stretch gap-1.5 rounded-xl text-start outline-offset-4" onClick={onPick} role="radio" title={label} type="button">
      <span
        className={`relative flex h-11 items-center justify-center rounded-xl transition-shadow motion-reduce:transition-none ${on ? "ring-[2.5px] ring-[var(--primary)] ring-offset-2 ring-offset-[var(--panel)]" : "ring-1 ring-[var(--border)] group-hover:ring-[var(--foreground-secondary)]"}`}
        style={{ background: colors ? ground : "conic-gradient(from 200deg, #e85d04, #ffba08, #00806a, #3c6e91, #6a4c93, #bf4069, #e85d04)" }}
      >
        {colors ? (
          <span className="flex -space-x-1.5">
            {DOTS.map((role) => (
              <span
                className="h-5 w-5 rounded-full"
                key={role}
                style={{ background: colors[role], boxShadow: `0 0 0 2px ${ground}, inset 0 0 0 1px rgba(0,0,0,0.12)` }}
              />
            ))}
          </span>
        ) : null}
        {custom && !on ? (
          <span className="absolute bottom-1 end-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--panel)] text-[var(--foreground)] shadow-[var(--shadow-card)]">
            <Pencil size={11} strokeWidth={2.6} />
          </span>
        ) : null}
        {on ? (
          <span className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-[0_0_0_2px_var(--panel)]">
            <Check size={12} strokeWidth={3.2} />
          </span>
        ) : null}
      </span>
      <span className={`line-clamp-2 px-0.5 text-[12px] font-semibold leading-tight ${on ? "text-[var(--foreground)]" : "text-[var(--foreground-secondary)]"}`}>{label}</span>
    </button>
  );
}

/** One custom colour: a picker and its hex code (applied once it is a whole #rrggbb). */
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [typed, setTyped] = useState(value);
  useEffect(() => setTyped(value), [value]);
  return (
    <div className="flex min-h-12 items-center gap-3 rounded-xl bg-[var(--panel)] py-1.5 pe-1.5 ps-1.5">
      {/* The swatch is the colour itself; the browser's colour picker sits invisibly on top of it. */}
      <span className="relative h-9 w-9 shrink-0 rounded-lg shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)] focus-within:ring-2 focus-within:ring-[var(--primary)] focus-within:ring-offset-2" style={{ background: value }}>
        <input
          aria-label={label}
          className="absolute inset-0 !h-full !min-h-0 !w-full cursor-pointer !border-0 !p-0 opacity-0"
          onChange={(event) => onChange(event.target.value.toLowerCase())}
          type="color"
          value={value}
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--foreground)]">{label}</span>
      <input
        aria-label={`${label} (hex)`}
        autoCapitalize="off"
        autoComplete="off"
        className="!min-h-9 w-[6.5rem] shrink-0 !px-2 text-center font-mono !text-[14px] uppercase"
        maxLength={7}
        onBlur={() => setTyped(value)}
        onChange={(event) => {
          const next = event.target.value.trim();
          setTyped(next);
          const hex = (next.startsWith("#") ? next : `#${next}`).toLowerCase();
          if (/^#[0-9a-f]{6}$/.test(hex)) onChange(hex);
        }}
        spellCheck={false}
        value={typed}
      />
    </div>
  );
}
