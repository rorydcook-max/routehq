/**
 * Font pairings for the website (Rory, 7 Nov 2026): a display face for headings and a text face, both from Google
 * Fonts. A page loads only its own pair (display=swap, so text shows at once in the fallback). Scripts a face lacks
 * (Thai, Chinese, ...) fall back per character to the system font, so every language still reads.
 * Safe to import from the browser.
 */

type Face = { family: string; spec: string; fallback: "serif" | "sans-serif" };
export type FontPairing = {
  id: string;
  name: string;
  display: Face;
  body: Face;
  /** Weight headings are set in (some display faces have only one). */
  displayWeight: number;
};

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: "fraunces-figtree",
    name: "Fraunces & Figtree",
    display: { family: "Fraunces", spec: "opsz,wght@9..144,400..700", fallback: "serif" },
    body: { family: "Figtree", spec: "wght@400..700", fallback: "sans-serif" },
    displayWeight: 560
  },
  {
    id: "dmserif-dmsans",
    name: "DM Serif & DM Sans",
    display: { family: "DM Serif Display", spec: "", fallback: "serif" },
    body: { family: "DM Sans", spec: "wght@400..700", fallback: "sans-serif" },
    displayWeight: 400
  },
  {
    id: "cormorant-manrope",
    name: "Cormorant & Manrope",
    display: { family: "Cormorant Garamond", spec: "wght@500;600;700", fallback: "serif" },
    body: { family: "Manrope", spec: "wght@400..700", fallback: "sans-serif" },
    displayWeight: 600
  },
  {
    id: "lora-nunito",
    name: "Lora & Nunito Sans",
    display: { family: "Lora", spec: "wght@500..700", fallback: "serif" },
    body: { family: "Nunito Sans", spec: "wght@400..700", fallback: "sans-serif" },
    displayWeight: 600
  },
  {
    id: "anton-barlow",
    name: "Anton & Barlow",
    display: { family: "Anton", spec: "", fallback: "sans-serif" },
    body: { family: "Barlow", spec: "wght@400;500;600;700", fallback: "sans-serif" },
    displayWeight: 400
  },
  {
    id: "bebas-worksans",
    name: "Bebas Neue & Work Sans",
    display: { family: "Bebas Neue", spec: "", fallback: "sans-serif" },
    body: { family: "Work Sans", spec: "wght@400..700", fallback: "sans-serif" },
    displayWeight: 400
  },
  {
    id: "unbounded-onest",
    name: "Unbounded & Onest",
    display: { family: "Unbounded", spec: "wght@500..800", fallback: "sans-serif" },
    body: { family: "Onest", spec: "wght@400..700", fallback: "sans-serif" },
    displayWeight: 650
  },
  {
    id: "sora-manrope",
    name: "Sora & Manrope",
    display: { family: "Sora", spec: "wght@400..700", fallback: "sans-serif" },
    body: { family: "Manrope", spec: "wght@400..700", fallback: "sans-serif" },
    displayWeight: 600
  },
  {
    id: "syne-intertight",
    name: "Syne & Inter Tight",
    display: { family: "Syne", spec: "wght@500..800", fallback: "sans-serif" },
    body: { family: "Inter Tight", spec: "wght@400..700", fallback: "sans-serif" },
    displayWeight: 700
  },
  {
    id: "grotesk-plex",
    name: "Space Grotesk & IBM Plex Sans",
    display: { family: "Space Grotesk", spec: "wght@400..700", fallback: "sans-serif" },
    body: { family: "IBM Plex Sans", spec: "wght@400;500;600;700", fallback: "sans-serif" },
    displayWeight: 600
  }
];

export const FONT_IDS = FONT_PAIRINGS.map((pairing) => pairing.id);

export function fontPairing(id: string | null | undefined, fallbackId: string): FontPairing {
  return FONT_PAIRINGS.find((pairing) => pairing.id === id) || FONT_PAIRINGS.find((pairing) => pairing.id === fallbackId) || FONT_PAIRINGS[0];
}

const familyParam = (face: Face) => `family=${face.family.replace(/ /g, "+")}${face.spec ? `:${face.spec}` : ""}`;

/** The stylesheet for a pairing (both faces in one request). */
export function fontHref(pairing: FontPairing) {
  return `https://fonts.googleapis.com/css2?${familyParam(pairing.display)}&${familyParam(pairing.body)}&display=swap`;
}

/** A tiny stylesheet with just the letters of the pairing's name, for the picker's previews. */
export function fontPreviewHref(pairing: FontPairing) {
  const text = encodeURIComponent(Array.from(new Set(`${pairing.name}Aa0123456789`)).join(""));
  return `https://fonts.googleapis.com/css2?${familyParam(pairing.display)}&${familyParam(pairing.body)}&text=${text}&display=swap`;
}

export function fontStack(face: Face) {
  return `"${face.family}", ${face.fallback === "serif" ? "Georgia, 'Times New Roman'," : "system-ui, -apple-system, 'Segoe UI',"} 'Noto Sans Thai', ${face.fallback}`;
}
