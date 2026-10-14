/**
 * An operator's brand colour, turned into the handful of CSS variables the whole
 * app is drawn with. One colour in; RouteHQ works out the hover, the tint and
 * the focus ring so everything stays readable.
 */

export const ROUTEHQ_BRAND = "#0e5e6f";
/** RouteHQ's colours before Lagoon: a business that has one saved simply has RouteHQ's own. */
const EARLIER_ROUTEHQ = ["#24456b"];

export function isBrandColour(value: unknown): value is string {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}

function rgb(hex: string) {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)] as const;
}

function hex([r, g, b]: readonly [number, number, number] | number[]) {
  return `#${[r, g, b].map((part) => Math.max(0, Math.min(255, Math.round(part))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(colour: readonly [number, number, number], towards: readonly [number, number, number], amount: number) {
  return [colour[0] + (towards[0] - colour[0]) * amount, colour[1] + (towards[1] - colour[1]) * amount, colour[2] + (towards[2] - colour[2]) * amount] as const;
}

/** Relative luminance, 0 (black) to 1 (white). */
function luminance([r, g, b]: readonly [number, number, number]) {
  const channel = (part: number) => {
    const c = part / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export type BrandPalette = { primary: string; hover: string; light: string; ring: string; ringStrong: string };

/**
 * A colour too pale for white text (a yellow, a pastel) is deepened until a
 * white label reads on it; the original still shows as the tint.
 */
export function brandPalette(colour: string): BrandPalette {
  const base = isBrandColour(colour) ? colour : ROUTEHQ_BRAND;
  let primary = rgb(base);
  const black = [0, 0, 0] as const;
  const white = [255, 255, 255] as const;
  let guard = 0;
  while (luminance(primary) > 0.25 && guard < 12) {
    primary = mix(primary, black, 0.12);
    guard += 1;
  }
  const hover = mix(primary, black, 0.2);
  const light = mix(rgb(base), white, 0.88);
  const [r, g, b] = primary;
  return {
    primary: hex(primary),
    hover: hex(hover),
    light: hex(light),
    ring: `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.16)`,
    ringStrong: `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.28)`
  };
}

/** The CSS that re-colours a page. Empty when the colour is RouteHQ's own. */
export function brandCss(colour: string | null | undefined) {
  if (!isBrandColour(colour) || colour.toLowerCase() === ROUTEHQ_BRAND || EARLIER_ROUTEHQ.includes(colour.toLowerCase())) return "";
  return brandCssAlways(colour);
}

/** The same CSS for any colour, RouteHQ's own included (the settings preview needs that). */
export function brandCssAlways(colour: string) {
  const palette = brandPalette(colour);
  return `:root{--primary:${palette.primary};--primary-hover:${palette.hover};--primary-light:${palette.light};--primary-blue:${palette.primary};--primary-blue-hover:${palette.hover};--primary-blue-light:${palette.light};--primary-strong:${palette.hover};--gradient-brand:${palette.primary};--gradient-teal:${palette.primary};--info:${palette.primary};--info-light:${palette.light};--sidebar-active:${palette.primary};--sidebar-text-active:${palette.primary};--kind-move:${palette.primary};--kind-move-bg:${palette.light};--focus-ring:${palette.ring};--focus-ring-strong:${palette.ringStrong};--band:${palette.primary};--band-action:#ffffff;--band-logo-accent:#ffffff;--band-action-ink:${palette.primary};--analytics-panel:${palette.primary};--analytics-card:${palette.hover};}`;
}
