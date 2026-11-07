import { brandPalette, isBrandColour, ROUTEHQ_BRAND } from "@/lib/brand";
import type { TemplateDef } from "@/lib/sites/templates";
import type { FontPairing } from "@/lib/sites/fonts";
import { fontStack } from "@/lib/sites/fonts";
import { SPACING } from "@/lib/sites/templates";

/**
 * Website colours (palettes, Rory 7 Nov 2026). A website has its own palette, separate from the app's brand colour:
 * seven named colours (what each is for on the page), chosen from a curated set, generated from the business's brand
 * colour ("own", From your brand), the template's own ("auto"), or set one by one ("custom"). Whatever comes in, the
 * words are checked against what they sit on (WCAG AA): text and links on the page, words on buttons, the dark
 * sections. Dark templates (Moto, Noir, Trail, Neon) keep a dark page: a light palette draws them on its dark colour.
 *
 * Sites published before palettes keep their exact look: "auto" and the earlier generated ids (brand, mist, stone,
 * night, deep, contrast) and the earlier one-colour custom are still drawn the old way. Safe to import from the browser.
 */

/** The colours an owner picks, by what they do on the page. */
export type PaletteColors = {
  /** Buttons and links. */
  primary: string;
  /** Stars, the fleet strip, soft tints. */
  secondary: string;
  background: string;
  /** Cards and panels. */
  surface: string;
  text: string;
  muted: string;
  /** The footer, and a dark template's page when the palette is light. */
  dark: string;
};
export const COLOR_ROLES = ["primary", "secondary", "background", "surface", "text", "muted", "dark"] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

/** What the page is drawn with (the CSS variables in siteVars), worked out from a palette. */
export type Palette = {
  id: string;
  dark: boolean;
  bg: string;
  surface: string;
  /** Every other section's background, a step off the page. */
  raised: string;
  ink: string;
  soft: string;
  muted: string;
  line: string;
  /** Buttons. */
  accent: string;
  /** Words on the accent. */
  accentInk: string;
  /** The accent as text and icons (links, prices): readable on the page. */
  accentText: string;
  /** A pale (or, on dark pages, deep) tint. */
  accentSoft: string;
  second: string;
  secondInk: string;
  /** The secondary as stars and small marks: visible on the page (3:1). */
  secondText: string;
  /** The footer. */
  deep: string;
  deepInk: string;
  deepSoft: string;
};

const pal = (primary: string, secondary: string, background: string, surface: string, text: string, muted: string, dark: string): PaletteColors => ({
  primary,
  secondary,
  background,
  surface,
  text,
  muted,
  dark
});

/** The curated palettes, in picker order (light first, then dark). Names: siteEditor.pal_<id>. */
export const CURATED_PALETTES: Array<{ id: string; colors: PaletteColors }> = [
  { id: "coastal", colors: pal("#0e6e8c", "#f2a65a", "#f4f8f9", "#ffffff", "#0f2a33", "#52707a", "#0c3442") },
  { id: "sandsea", colors: pal("#1f6f78", "#e3b778", "#f7f1e6", "#fffaf2", "#2b2620", "#6f6354", "#1d3b40") },
  { id: "tropical", colors: pal("#00806a", "#ff7a59", "#f1faf6", "#ffffff", "#0d2b25", "#4d6c64", "#063d33") },
  { id: "terracotta", colors: pal("#b04f26", "#6b8f71", "#f8efe6", "#fffaf5", "#3a2318", "#7a6356", "#3a2318") },
  { id: "olive", colors: pal("#5b6b2f", "#c9a227", "#f4f2e9", "#fffef8", "#262a1a", "#676b57", "#2d331c") },
  { id: "desert", colors: pal("#b9521a", "#e9b949", "#fbf3e4", "#fffbf3", "#3b2412", "#7f644b", "#4a2a14") },
  { id: "citrus", colors: pal("#e85d04", "#ffba08", "#fffbef", "#ffffff", "#2a1e05", "#75653f", "#3d2a03") },
  { id: "sakura", colors: pal("#bf4069", "#7a9e7e", "#fdf4f6", "#ffffff", "#3a1f2a", "#80606b", "#3a1f2a") },
  { id: "lavender", colors: pal("#6a4c93", "#f4a6a6", "#f6f3fa", "#ffffff", "#2a2140", "#6a6182", "#2a2140") },
  { id: "vintage", colors: pal("#8c3b2f", "#2f5d62", "#f5ecd9", "#fbf6ea", "#2e2620", "#73665a", "#2e2620") },
  { id: "alpine", colors: pal("#2f6d4f", "#d1495b", "#f3f6f4", "#ffffff", "#17261e", "#596c62", "#18302a") },
  { id: "forest", colors: pal("#2d6a4f", "#b08968", "#f1f4ef", "#ffffff", "#1b2b22", "#58685d", "#1b3a2b") },
  { id: "nordic", colors: pal("#3c6e91", "#9cc5d9", "#f2f6f9", "#ffffff", "#1b2a36", "#5c6e7d", "#22323f") },
  { id: "graphite", colors: pal("#b5e61d", "#3a4047", "#edeeeb", "#ffffff", "#1f2326", "#5a6065", "#23272b") },
  { id: "bold", colors: pal("#d7263d", "#1b1b1e", "#fff8f6", "#ffffff", "#1b1b1e", "#695c5d", "#1b1b1e") },
  { id: "mono", colors: pal("#111111", "#8a8a8a", "#fafafa", "#ffffff", "#111111", "#5c5c5c", "#111111") },
  { id: "midnight", colors: pal("#7aa2ff", "#f5c26b", "#0e1424", "#172036", "#eef2fb", "#9aa6c2", "#080c17") },
  { id: "ocean", colors: pal("#3fc1c9", "#f6d365", "#0a2238", "#10304d", "#e8f3fb", "#94b3c9", "#061626") },
  { id: "neon", colors: pal("#ff3ea5", "#22e1ff", "#120a24", "#1d1236", "#f6f0ff", "#b3a5d6", "#0a0517") },
  { id: "espresso", colors: pal("#d9a066", "#8fae8b", "#21170f", "#2d2017", "#f4ebe1", "#bba999", "#150e09") }
];
const CURATED = new Map(CURATED_PALETTES.map((palette) => [palette.id, palette.colors]));

/** The palettes before this picker: still drawn the old way for sites that use them, shown in the picker only then. */
export const LEGACY_PALETTE_IDS = ["brand", "mist", "stone", "night", "deep", "contrast"];

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
/** `amount` of b mixed into a. */
function mixHex(a: string, b: string, amount: number) {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return toHex([ar + (br - ar) * amount, ag + (bg - ag) * amount, ab + (bb - ab) * amount]);
}
const isDarkColour = (hex: string) => luminance(hex) < 0.18;

/** Moves a colour's lightness away from its backgrounds until it reaches `ratio` against every one of them. */
function readable(colour: string, backgrounds: string[], ratio: number) {
  const passes = (value: string) => backgrounds.every((background) => contrast(value, background) >= ratio);
  if (passes(colour)) return colour;
  const onDark = backgrounds.reduce((sum, background) => sum + luminance(background), 0) / backgrounds.length < 0.18;
  const [h, s, l] = toHsl(toRgb(colour));
  for (let step = 1; step <= 25; step += 1) {
    const out = hsl(h, s, onDark ? l + step * 0.04 : l - step * 0.04);
    if (passes(out)) return out;
  }
  return onDark ? "#ffffff" : "#000000";
}

/** Words on a filled colour: white, else the palette's darkest colour, else black (one of them always reaches AA). */
function wordsOn(fill: string, darkInk: string) {
  if (contrast(fill, "#ffffff") >= 4.5) return "#ffffff";
  if (contrast(fill, darkInk) >= 4.5) return darkInk;
  return contrast(fill, "#000000") >= contrast(fill, "#ffffff") ? "#000000" : "#ffffff";
}

/** The page's colours from a palette's seven. */
function fromColors(id: string, colors: PaletteColors): Palette {
  const bg = colors.background;
  const dark = isDarkColour(bg);
  const surface = colors.surface;
  const ink = readable(colors.text, [bg, surface], 4.5);
  const raised = dark ? mixHex(bg, "#ffffff", 0.04) : mixHex(bg, ink, 0.035);
  const grounds = [bg, surface, raised];
  const muted = readable(colors.muted, grounds, 4.5);
  const darkest = [ink, colors.dark, "#141414"].sort((a, b) => luminance(a) - luminance(b))[0];
  // On a dark page a deep primary would sink into it: lifted until the buttons stand out.
  const accent = dark ? readable(colors.primary, [bg], 3) : colors.primary;
  const deep = colors.dark;
  const deepInk = readable(isDarkColour(deep) ? (luminance(bg) > 0.7 ? bg : luminance(ink) > 0.7 ? ink : "#ffffff") : isDarkColour(ink) ? ink : "#141414", [deep], 4.5);
  return {
    id,
    dark,
    bg,
    surface,
    raised,
    ink,
    soft: readable(mixHex(ink, muted, 0.5), grounds, 4.5),
    muted,
    line: mixHex(bg, ink, dark ? 0.2 : 0.14),
    accent,
    accentInk: wordsOn(accent, darkest),
    accentText: readable(colors.primary, grounds, 4.5),
    // Light pages take a pale tint of the secondary; on dark ones a warm secondary turns muddy, so the accent's.
    accentSoft: dark ? mixHex(bg, accent, 0.2) : mixHex(bg, colors.secondary, 0.16),
    second: colors.secondary,
    secondInk: wordsOn(colors.secondary, darkest),
    secondText: readable(colors.secondary, grounds, 3),
    deep,
    deepInk,
    deepSoft: readable(mixHex(deepInk, deep, 0.3), [deep], 4.5)
  };
}

/** A dark template with a light palette: the page goes onto the palette's dark colour, its background becomes the text. */
function onDarkPage(colors: PaletteColors): PaletteColors {
  if (isDarkColour(colors.background)) return colors;
  let bg = colors.dark;
  for (let guard = 0; guard < 8 && luminance(bg) > 0.025; guard += 1) bg = mixHex(bg, "#000000", 0.3);
  const text = luminance(colors.background) > 0.75 ? colors.background : "#f4f4f1";
  return { ...colors, background: bg, surface: mixHex(bg, "#ffffff", 0.07), text, muted: mixHex(text, bg, 0.3), dark: mixHex(bg, "#000000", 0.45) };
}

/** "From your brand": the brand colour for buttons, a harmonious secondary, a neutral page tinted toward the brand. */
export function brandColors(brandColour: string | null | undefined): PaletteColors {
  const brand = isBrandColour(brandColour) ? brandColour : ROUTEHQ_BRAND;
  const primary = brandPalette(brand).primary;
  const [h, s] = toHsl(toRgb(primary));
  return {
    primary,
    secondary: hsl(h + 150, clamp(Math.max(s * 0.85, 0.45), 0, 0.72), 0.6),
    background: hsl(h, Math.min(s, 0.14), 0.975),
    surface: "#ffffff",
    text: hsl(h, Math.min(s, 0.35), 0.11),
    muted: hsl(h, Math.min(s, 0.12), 0.42),
    dark: hsl(h, Math.min(s, 0.45), 0.13)
  };
}

/** A drawn palette's seven colours: where Custom starts from. */
export function paletteColors(palette: Palette): PaletteColors {
  const dark = palette.deep === palette.bg ? (palette.dark ? mixHex(palette.bg, "#000000", 0.45) : mixHex(palette.ink, palette.bg, 0.06)) : palette.deep;
  return { primary: palette.accent, secondary: palette.second, background: palette.bg, surface: palette.surface, text: palette.ink, muted: palette.muted, dark };
}

// ---- Before palettes (kept so published sites draw exactly as they did) ----

type LegacyPalette = Omit<Palette, "accentText" | "second" | "secondInk" | "secondText" | "deep" | "deepInk" | "deepSoft">;

/** Lightens a colour until it reads on a dark background. */
function brightenFor(colour: string, background: string, ratio = 4.5) {
  const [h, s0, l0] = toHsl(toRgb(colour));
  let [s, l] = [s0, l0];
  let out = colour;
  for (let guard = 0; guard < 20 && contrast(out, background) < ratio; guard += 1) {
    l = clamp(l + 0.04);
    s = clamp(s * 0.98);
    out = hsl(h, s, l);
  }
  return out;
}
const inkOn = (colour: string, dark: string) => (contrast(colour, "#ffffff") >= 4.5 ? "#ffffff" : contrast(colour, dark) >= 4.5 ? dark : "#ffffff");

function legacyLight(id: string, accentHex: string, bgH: number, bgS: number, bgL: number): LegacyPalette {
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

function legacyDark(id: string, accentHex: string, bgH: number, bgS: number, bgL: number): LegacyPalette {
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

/** The old palette in today's shape: one accent for everything, the footer on the page, so nothing moves. */
function fromLegacy(palette: LegacyPalette): Palette {
  return { ...palette, accentText: palette.accent, second: palette.accent, secondInk: palette.accentInk, secondText: palette.accent, deep: palette.bg, deepInk: palette.ink, deepSoft: palette.muted };
}

function legacyPalettes(brandColour: string | null | undefined): LegacyPalette[] {
  const brand = isBrandColour(brandColour) ? brandColour : ROUTEHQ_BRAND;
  const [h, s] = toHsl(toRgb(brand));
  const complement = hsl(h + 165, clamp(Math.max(s, 0.55)), 0.48);
  return [
    legacyLight("brand", brand, h, 0.12, 0.975),
    legacyLight("mist", brand, h, 0.32, 0.955),
    legacyLight("stone", brand, 32, 0.1, 0.945),
    legacyDark("night", brand, h, 0.28, 0.07),
    legacyDark("deep", hsl(h + 180, 0.75, 0.62), h, clamp(s * 0.8, 0.25, 0.6), 0.16),
    legacyLight("contrast", complement, h, 0.18, 0.965)
  ];
}

/** The template's own colours ("auto") or an earlier generated palette, as they were drawn before palettes. */
function legacySitePalette(id: string, template: TemplateDef, brandColour: string | null | undefined): Palette {
  if (id === "auto" && template.tone) {
    const brand = isBrandColour(brandColour) ? brandColour : ROUTEHQ_BRAND;
    const tone = template.tone;
    const hue = tone.hue ?? toHsl(toRgb(brand))[0];
    return fromLegacy(tone.dark ? legacyDark("auto", brand, hue, tone.sat, tone.light) : legacyLight("auto", brand, hue, tone.sat, tone.light));
  }
  const all = legacyPalettes(brandColour);
  const wanted = id === "auto" ? (template.mode === "dark" ? "night" : template.id === "coast" ? "mist" : "brand") : id;
  return fromLegacy({ ...(all.find((palette) => palette.id === wanted) || all[0]), id });
}

// ---- What the page and the editor use ----

export type PaletteInput = { palette: string; colors: PaletteColors | null; customAccent: string | null; customDark: boolean };

/** A palette's own seven colours (not yet fitted to a template), or null for "auto" and the earlier ones. */
export function chosenColors(input: PaletteInput, brandColour: string | null | undefined): PaletteColors | null {
  if (input.palette === "custom") return input.colors;
  if (input.palette === "own") return brandColors(brandColour);
  return CURATED.get(input.palette) || null;
}

/** The palette a site is drawn in. */
export function sitePalette(input: PaletteInput, template: TemplateDef, brandColour: string | null | undefined): Palette {
  const colors = chosenColors(input, brandColour);
  if (colors) return fromColors(input.palette, template.mode === "dark" ? onDarkPage(colors) : colors);
  if (input.palette === "custom" && input.customAccent) {
    // The one-colour custom from before palettes.
    const [h] = toHsl(toRgb(input.customAccent));
    return fromLegacy(input.customDark ? legacyDark("custom", input.customAccent, h, 0.25, 0.08) : legacyLight("custom", input.customAccent, h, 0.14, 0.972));
  }
  return legacySitePalette(LEGACY_PALETTE_IDS.includes(input.palette) ? input.palette : "auto", template, brandColour);
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
    "--s-accent-text": palette.accentText,
    "--s-accent-soft": palette.accentSoft,
    "--s-second": palette.second,
    "--s-second-ink": palette.secondInk,
    "--s-second-text": palette.secondText,
    "--s-deep": palette.deep,
    "--s-deep-ink": palette.deepInk,
    "--s-deep-soft": palette.deepSoft,
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
