"use client";

import { useEffect, useState } from "react";
import { brandCssAlways, brandPalette, isBrandColour, ROUTEHQ_BRAND } from "@/lib/brand";

/** Colours most rental brands land on; one tap each, with "pick your own" for anything else. */
const PRESETS = ["#0e5e6f", "#1f7a5c", "#1d4ed8", "#1e3a5f", "#6d28d9", "#be185d", "#b91c1c", "#c2410c"];

/**
 * The brand colour picker. Picking a colour re-colours the page straight away
 * (a preview), so the owner sees what customers will see before they save.
 */
export function BrandColourField({
  initial,
  label,
  customLabel,
  hint,
  previewLabel,
  form
}: {
  initial: string;
  label: string;
  customLabel: string;
  hint: string;
  /** The name of the small sample row under the swatches, so it doesn't read as stray buttons. */
  previewLabel?: string;
  /** The id of the form the colour is saved with, when the field sits outside it. */
  form?: string;
}) {
  const [colour, setColour] = useState(isBrandColour(initial) ? initial.toLowerCase() : ROUTEHQ_BRAND);
  const palette = brandPalette(colour);

  useEffect(() => {
    if (colour === (isBrandColour(initial) ? initial.toLowerCase() : ROUTEHQ_BRAND)) {
      document.getElementById("brand-preview")?.remove();
      return;
    }
    let tag = document.getElementById("brand-preview") as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement("style");
      tag.id = "brand-preview";
      document.head.appendChild(tag);
    }
    tag.textContent = brandCssAlways(colour);
  }, [colour, initial]);

  useEffect(() => () => document.getElementById("brand-preview")?.remove(), []);

  return (
    <div>
      <span className="block font-semibold text-[var(--foreground-secondary)]">{label}</span>
      <input form={form} name="contract_accent_colour" type="hidden" value={colour} />
      <span className="mt-0.5 block text-sm text-[var(--muted)]">{hint}</span>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => {
          const on = preset === colour;
          return (
            <button
              aria-label={preset}
              aria-pressed={on}
              className={`pressable grid h-11 w-11 place-items-center rounded-full border-2 ${on ? "border-[var(--foreground)]" : "border-transparent"}`}
              key={preset}
              onClick={() => setColour(preset)}
              type="button"
            >
              <span className="h-8 w-8 rounded-full" style={{ background: preset }} />
            </button>
          );
        })}
        <label className={`pressable flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border-2 px-3 text-sm font-bold text-[var(--foreground)] ${PRESETS.includes(colour) ? "border-[var(--border)]" : "border-[var(--foreground)]"}`}>
          {PRESETS.includes(colour) ? <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-dashed border-[var(--border-strong)] text-base leading-none text-[var(--muted)]">+</span> : <span className="h-6 w-6 rounded-full" style={{ background: colour }} />}
          {customLabel}
          <input className="sr-only" onChange={(event) => isBrandColour(event.target.value) && setColour(event.target.value.toLowerCase())} type="color" value={colour} />
        </label>
      </div>
      {/* A labelled sample of how buttons and tints come out in this colour. */}
      <div className="mt-3 flex items-center gap-2" aria-hidden="true">
        {previewLabel ? <span className="me-1 text-sm font-semibold text-[var(--muted)]">{previewLabel}</span> : null}
        <span className="rounded-full px-3 py-1.5 text-sm font-bold text-white" style={{ background: palette.primary }}>Aa</span>
        <span className="rounded-full px-3 py-1.5 text-sm font-bold text-white" style={{ background: palette.hover }}>Aa</span>
        <span className="rounded-full px-3 py-1.5 text-sm font-bold" style={{ background: palette.light, color: palette.primary }}>Aa</span>
      </div>
    </div>
  );
}
