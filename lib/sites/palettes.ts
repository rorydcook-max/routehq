import { brandPalette, isBrandColour, ROUTEHQ_BRAND } from "@/lib/brand";
import type { TemplateDef } from "@/lib/sites/templates";
import type { FontPairing } from "@/lib/sites/fonts";
import { fontStack } from "@/lib/sites/fonts";
import { SPACING } from "@/lib/sites/templates";

/**
 * Website colours (Rory, 7 Nov 2026). Every palette starts from the business's brand colour (Settings › Your brand),
 * so a site always looks like theirs; the owner can pick one of the generated variations or set their own accent.
 * Text colours are checked against their backgrounds so words stay readable whatever colour comes in.
 * Safe to import from the browser.
 */

export type Palette = {
  id: string;
  dark: boolean;
  bg: string;
  /** Cards and panels. */
  surface: string;
  /** Every other section's background, a step off the page. */
  raised: string;
  ink: string;
  soft: string;
  muted: string;
  line: string;
  accent: string;
  /** Words on the accent. */
  accentInk: string;
  /** A pale (or, on dark pages, deep) tint of the accent. */
  accentSoft: string;
};

export const PALETTE_IDS = ["brand", "mist", "stone", "night", "deep", "contrast"] as const;

type Rgb = [number, number, number];
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function toRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}
function toHex([r, g, b]: Rgb) {
  return `#${[r, g, b].map((part) => Math.round(clamp(part, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
}
function toHsl([r, g, b]: Rgb): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h * 60, s, l];
}
function hsl(h: number, s: number, l: number) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s);
  const lig = clamp(l);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}
function luminance(hex: string) {
  const channel = (part: number) => {
    const c = part / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Lightens a colour until it reads on a dark background. */
function brightenFor(colour: string, background: string, ratio = 4.5) {
  let [h, s, l] = toHsl(toRgb(colour));
  let out = colour;
  for (let guard = 0; guard < 20 && contrast(out, background) < ratio; guard += 1) {
    l = clamp(l + 0.04);
    s = clamp(s * 0.98);
    out = hsl(h, s, l);
  }
  return out;
}
const inkOn = (colour: string, dark: string) => (contrast(colour, "#ffffff") >= 4.5 ? "#ffffff" : contrast(colour, dark) >= 4.5 ? dark : "#ffffff");

function light(id: string, accentHex: string, bgH: number, bgS: number, bgL: number): Palette {
  const accent = brandPalette(accentHex).primary;
  const [h, s] = toHsl(toRgb(accent));
  const ink = hsl(h, Math.min(s, 0.35), 0.11);
  return {
    id,
    dark: false,
    bg: hsl(bgH, bgS, bgL),
    surface: "#ffffff",
    raised: hsl(bgH, Math.min(1, bgS + 0.05), bgL - 0.03),
    ink,
    soft: hsl(h, Math.min(s, 0.18), 0.3),
    muted: hsl(h, Math.min(s, 0.12), 0.43),
    line: hsl(bgH, Math.min(bgS, 0.2), Math.max(0.8, bgL - 0.1)),
    accent,
    accentInk: inkOn(accent, ink),
    accentSoft: hsl(h, Math.min(s, 0.6), 0.93)
  };
}

function dark(id: string, accentHex: string, bgH: number, bgS: number, bgL: number): Palette {
  const bg = hsl(bgH, bgS, bgL);
  const accent = brightenFor(accentHex, bg, 4.2);
  const ink = hsl(bgH, 0.12, 0.95);
  return {
    id,
    dark: true,
    bg,
    surface: hsl(bgH, bgS, bgL + 0.05),
    raised: hsl(bgH, bgS, bgL + 0.025),
    ink,
    soft: hsl(bgH, 0.1, 0.8),
    muted: hsl(bgH, 0.08, 0.64),
    line: hsl(bgH, bgS, bgL + 0.12),
    accent,
    accentInk: contrast(accent, "#0b0d10") >= 4.5 ? hsl(bgH, bgS, 0.08) : "#ffffff",
    accentSoft: hsl(toHsl(toRgb(accent))[0], 0.35, bgL + 0.08)
  };
}

/** The palettes on offer for a brand colour, in picker order. */
export function generatePalettes(brandColour: string | null | undefined): Palette[] {
  const brand = isBrandColour(brandColour) ? brandColour : ROUTEHQ_BRAND;
  const [h, s] = toHsl(toRgb(brand));
  const complement = hsl(h + 165, clamp(Math.max(s, 0.55)), 0.48);
  return [
    light("brand", brand, h, 0.12, 0.975),
    light("mist", brand, h, 0.32, 0.955),
    light("stone", brand, 32, 0.1, 0.945),
    dark("night", brand, h, 0.28, 0.07),
    dark("deep", hsl(h + 180, 0.75, 0.62), h, clamp(s * 0.8, 0.25, 0.6), 0.16),
    light("contrast", complement, h, 0.18, 0.965)
  ];
}

/** The palette a site is drawn in: the owner's choice, the template's own ("auto"), or their custom accent. */
export function sitePalette(input: { palette: string; customAccent: string | null; customDark: boolean }, template: TemplateDef, brandColour: string | null | undefined): Palette {
  if (input.palette === "custom" && input.customAccent) {
    const [h] = toHsl(toRgb(input.customAccent));
    return input.customDark ? dark("custom", input.customAccent, h, 0.25, 0.08) : light("custom", input.customAccent, h, 0.14, 0.972);
  }
  if (input.palette === "auto" && template.tone) {
    // Phase 2 templates bring their own page colours; the accent is still the brand colour.
    const brand = isBrandColour(brandColour) ? brandColour : ROUTEHQ_BRAND;
    const tone = template.tone;
    const hue = tone.hue ?? toHsl(toRgb(brand))[0];
    return tone.dark ? dark("auto", brand, hue, tone.sat, tone.light) : light("auto", brand, hue, tone.sat, tone.light);
  }
  const all = generatePalettes(brandColour);
  const wanted = input.palette === "auto" ? (template.mode === "dark" ? "night" : template.id === "coast" ? "mist" : "brand") : input.palette;
  return all.find((palette) => palette.id === wanted) || all[0];
}

/** The page's CSS variables: colours, fonts, radii and spacing. */
export function siteVars(palette: Palette, template: TemplateDef, font: FontPairing): Record<string, string> {
  const pad = SPACING[template.spacing];
  return {
    "--s-bg": palette.bg,
    "--s-surface": palette.surface,
    "--s-raised": palette.raised,
    "--s-ink": palette.ink,
    "--s-soft": palette.soft,
    "--s-muted": palette.muted,
    "--s-line": palette.line,
    "--s-accent": palette.accent,
    "--s-accent-ink": palette.accentInk,
    "--s-accent-soft": palette.accentSoft,
    "--s-display": fontStack(font.display),
    "--s-body": fontStack(font.body),
    "--s-display-weight": String(font.displayWeight),
    "--s-track": template.heading.tracking,
    "--s-leading": String(template.heading.leading),
    "--s-r-card": `${template.radius.card}px`,
    "--s-r-image": `${template.radius.image}px`,
    "--s-r-button": `${template.radius.button}px`,
    "--s-pad": `${pad.phone}px`,
    "--s-pad-lg": `${pad.desktop}px`
  };
}

/**
 * The booking part (the shared Catalog) is always drawn on a light panel, whatever the page's colours: these are the
 * app variables it reads, set on that panel only.
 */
export function bookingPanelVars(palette: Palette): Record<string, string> {
  const brand = brandPalette(palette.accent);
  const [h, s] = toHsl(toRgb(brand.primary));
  return {
    "--primary": brand.primary,
    "--primary-hover": brand.hover,
    "--primary-light": brand.light,
    "--foreground": hsl(h, Math.min(s, 0.3), 0.12),
    "--foreground-secondary": hsl(h, Math.min(s, 0.16), 0.3),
    "--muted": hsl(h, Math.min(s, 0.1), 0.42),
    "--border": hsl(h, Math.min(s, 0.18), 0.88),
    "--panel": "#ffffff",
    "--panel-secondary": hsl(h, Math.min(s, 0.2), 0.965),
    "--panel-tertiary": hsl(h, Math.min(s, 0.2), 0.93),
    "--focus-ring": brand.ring,
    "--focus-ring-strong": brand.ringStrong,
    colorScheme: "light"
  };
}
