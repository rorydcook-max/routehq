import type { ArtId } from "@/lib/sites/images";

/**
 * Website templates (Rory, 7 Nov 2026). A template is data: which layout each section uses, its default palette
 * mode, font pairing, corner radii, spacing and image treatment. The section components (components/site/sections)
 * read these, so a new template is a new entry here plus, at most, a new layout variant for a section or two.
 * Phase 2 (sites2) took the range from 3 to 24. Safe to import from the browser.
 *
 * Coast, Moto and Summit leave every phase 2 field unset, so sites published with them draw exactly as before.
 */

export const TEMPLATE_IDS = [
  "coast",
  "moto",
  "summit",
  "lagoon",
  "riviera",
  "reef",
  "swell",
  "pier",
  "villa",
  "metro",
  "runway",
  "noir",
  "trail",
  "dolce",
  "haven",
  "nomad",
  "volt",
  "roam",
  "washi",
  "fjord",
  "folio",
  "block",
  "amber",
  "neon"
] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type HeroLayout = "postcard" | "poster" | "split" | "fullbleed" | "bigtype" | "collage" | "frame" | "cover" | "search";
export type AboutLayout = "editorial" | "stacked" | "panel" | "steps" | "stats" | "quote";
export type FleetLayout = "rail" | "tiles" | "grid" | "list" | "spotlight" | "masonry";
export type ReviewsLayout = "quote" | "stack" | "cards";
export type ContactLayout = "split" | "bold" | "cards" | "mapfirst" | "minimal";
export type BookingLayout = "open" | "ticket" | "panel";

/** The gallery's filters. */
export type TemplateTag = "car" | "two-wheel" | "premium" | "island";
export const TEMPLATE_TAGS: TemplateTag[] = ["car", "two-wheel", "premium", "island"];

export type TemplateDef = {
  id: TemplateId;
  /** Light or dark page by default (a palette can change it). */
  mode: "light" | "dark";
  font: string;
  layout: { hero: HeroLayout; about: AboutLayout; booking: BookingLayout; fleet: FleetLayout; reviews: ReviewsLayout; contact: ContactLayout };
  /** Corner radii in px: cards, images, buttons. */
  radius: { card: number; image: number; button: number };
  /** Vertical space around sections. */
  spacing: "airy" | "regular" | "tight";
  /** Headings: letter spacing and line height. */
  heading: { tracking: string; leading: number };
  /** How photos are framed: arch (rounded top) and frame (a print border) are phase 2. */
  image: "soft" | "slant" | "crisp" | "arch" | "frame";
  /** The built-in art behind the hero when there is no photo. */
  art: ArtId;
  /** Fleet names running across the page (one moving strip; still when reduced motion is on). */
  ticker: boolean;
  /** The kinds of business it was designed for, for the gallery's order. */
  suits: Array<"car" | "two-wheel" | "mixed">;
  /** Which gallery filters it shows under. */
  tags: TemplateTag[];
  /**
   * The page colours "Auto" gives (the accent is always the brand colour): background hue (null = the brand's),
   * saturation and lightness. Unset keeps phase 1's rule (Night when dark, Mist for Coast, else Brand).
   */
  tone?: { dark: boolean; hue: number | null; sat: number; light: number };
  /** The top bar: name on the left (default), or centered with the menu either side. */
  header?: "bar" | "center";
  /** Card outlines: none (default), a hairline, or heavy ink borders with a hard shadow. */
  edge?: "hairline" | "heavy";
  /** Headings in capitals. */
  caps?: boolean;
  /** On phones, a bar with WhatsApp and Book stays at the bottom (when there is a WhatsApp number). */
  chatBar?: boolean;
};

const BASE = { ticker: false } as const;

export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  coast: {
    id: "coast",
    mode: "light",
    font: "fraunces-figtree",
    layout: { hero: "postcard", about: "editorial", booking: "open", fleet: "rail", reviews: "quote", contact: "split" },
    radius: { card: 22, image: 30, button: 999 },
    spacing: "airy",
    heading: { tracking: "-0.02em", leading: 1.04 },
    image: "soft",
    art: "tide",
    ticker: false,
    suits: ["mixed", "car", "two-wheel"],
    tags: ["island", "car", "two-wheel"]
  },
  moto: {
    id: "moto",
    mode: "dark",
    font: "anton-barlow",
    layout: { hero: "poster", about: "stacked", booking: "ticket", fleet: "tiles", reviews: "stack", contact: "bold" },
    radius: { card: 14, image: 16, button: 12 },
    spacing: "tight",
    heading: { tracking: "0", leading: 0.92 },
    image: "slant",
    art: "road",
    ticker: true,
    suits: ["two-wheel", "mixed"],
    tags: ["two-wheel"],
    chatBar: true
  },
  summit: {
    id: "summit",
    mode: "light",
    font: "sora-manrope",
    layout: { hero: "split", about: "panel", booking: "panel", fleet: "grid", reviews: "cards", contact: "cards" },
    radius: { card: 16, image: 20, button: 12 },
    spacing: "regular",
    heading: { tracking: "-0.035em", leading: 1.05 },
    image: "crisp",
    art: "contour",
    ticker: false,
    suits: ["car", "mixed"],
    tags: ["car"]
  },

  // Bali and Thai-island tropical: leafy page, arched photos, a collage hero.
  lagoon: {
    ...BASE,
    id: "lagoon",
    mode: "light",
    font: "youngserif-karla",
    layout: { hero: "collage", about: "quote", booking: "open", fleet: "masonry", reviews: "quote", contact: "mapfirst" },
    radius: { card: 24, image: 28, button: 999 },
    spacing: "airy",
    heading: { tracking: "-0.015em", leading: 1.06 },
    image: "arch",
    art: "palms",
    suits: ["mixed", "car", "two-wheel"],
    tags: ["island", "car", "two-wheel"],
    tone: { dark: false, hue: 95, sat: 0.22, light: 0.955 }
  },
  // Mediterranean island: whitewash and sea blue, a full-width photo, centered name.
  riviera: {
    ...BASE,
    id: "riviera",
    mode: "light",
    font: "cormorant-manrope",
    layout: { hero: "fullbleed", about: "editorial", booking: "panel", fleet: "spotlight", reviews: "quote", contact: "split" },
    radius: { card: 6, image: 6, button: 999 },
    spacing: "airy",
    heading: { tracking: "-0.01em", leading: 1 },
    image: "arch",
    art: "arches",
    suits: ["mixed", "car"],
    tags: ["island", "car", "premium"],
    tone: { dark: false, hue: 205, sat: 0.35, light: 0.975 },
    header: "center"
  },
  // Beach scooter shack on a budget: huge type, price first, chat bar on phones.
  reef: {
    ...BASE,
    id: "reef",
    mode: "light",
    font: "unbounded-onest",
    layout: { hero: "bigtype", about: "stacked", booking: "ticket", fleet: "tiles", reviews: "stack", contact: "bold" },
    radius: { card: 22, image: 22, button: 999 },
    spacing: "tight",
    heading: { tracking: "-0.03em", leading: 0.98 },
    image: "soft",
    art: "sun",
    suits: ["two-wheel"],
    tags: ["island", "two-wheel"],
    tone: { dark: false, hue: 185, sat: 0.4, light: 0.955 },
    chatBar: true
  },
  // 1970s surf town: warm sand, groovy stripes, printed-photo borders, a fleet strip.
  swell: {
    id: "swell",
    mode: "light",
    font: "shrikhand-rubik",
    layout: { hero: "poster", about: "stats", booking: "open", fleet: "rail", reviews: "cards", contact: "minimal" },
    radius: { card: 28, image: 28, button: 999 },
    spacing: "regular",
    heading: { tracking: "0", leading: 1.02 },
    image: "frame",
    art: "groove",
    ticker: true,
    suits: ["two-wheel", "mixed"],
    tags: ["island", "two-wheel", "car"],
    tone: { dark: false, hue: 36, sat: 0.55, light: 0.935 }
  },
  // Ferry-pier island hopping: navy and white, a collage of prints.
  pier: {
    ...BASE,
    id: "pier",
    mode: "light",
    font: "grotesk-plex",
    layout: { hero: "collage", about: "panel", booking: "open", fleet: "rail", reviews: "cards", contact: "mapfirst" },
    radius: { card: 12, image: 10, button: 10 },
    spacing: "regular",
    heading: { tracking: "-0.025em", leading: 1.02 },
    image: "frame",
    art: "tide",
    suits: ["mixed", "two-wheel"],
    tags: ["island", "two-wheel", "car"],
    tone: { dark: false, hue: 215, sat: 0.25, light: 0.965 }
  },
  // Villa delivery, high end: ivory, a wide photo card, one car in the spotlight.
  villa: {
    ...BASE,
    id: "villa",
    mode: "light",
    font: "instrument",
    layout: { hero: "postcard", about: "editorial", booking: "open", fleet: "spotlight", reviews: "quote", contact: "mapfirst" },
    radius: { card: 18, image: 22, button: 999 },
    spacing: "airy",
    heading: { tracking: "-0.015em", leading: 1.02 },
    image: "arch",
    art: "arches",
    suits: ["car"],
    tags: ["island", "premium", "car"],
    tone: { dark: false, hue: 40, sat: 0.2, light: 0.97 },
    header: "center"
  },
  // City car rental: a search bar on the photo, figures, a spec list.
  metro: {
    ...BASE,
    id: "metro",
    mode: "light",
    font: "grotesk-plex",
    layout: { hero: "search", about: "stats", booking: "panel", fleet: "list", reviews: "cards", contact: "cards" },
    radius: { card: 10, image: 12, button: 10 },
    spacing: "regular",
    heading: { tracking: "-0.03em", leading: 1.02 },
    image: "crisp",
    art: "city",
    suits: ["car"],
    tags: ["car"],
    tone: { dark: false, hue: null, sat: 0.06, light: 0.975 }
  },
  // Airport transfers and car hire: departure-board type, the search first, how pickup works.
  runway: {
    ...BASE,
    id: "runway",
    mode: "light",
    font: "bebas-worksans",
    layout: { hero: "search", about: "steps", booking: "panel", fleet: "list", reviews: "cards", contact: "bold" },
    radius: { card: 6, image: 8, button: 6 },
    spacing: "regular",
    heading: { tracking: "0.01em", leading: 0.95 },
    image: "crisp",
    art: "road",
    suits: ["car"],
    tags: ["car"],
    tone: { dark: false, hue: 220, sat: 0.14, light: 0.965 }
  },
  // Luxury cars: warm black, a letterboxed photo, Bodoni.
  noir: {
    ...BASE,
    id: "noir",
    mode: "dark",
    font: "bodoni-jost",
    layout: { hero: "frame", about: "quote", booking: "panel", fleet: "spotlight", reviews: "quote", contact: "minimal" },
    radius: { card: 2, image: 2, button: 2 },
    spacing: "airy",
    heading: { tracking: "-0.01em", leading: 1.02 },
    image: "crisp",
    art: "bloom",
    suits: ["car"],
    tags: ["car", "premium"],
    tone: { dark: true, hue: 30, sat: 0.08, light: 0.06 }
  },
  // Adventure and off-road motorbikes: earthy dark, slab capitals, mountains.
  trail: {
    ...BASE,
    id: "trail",
    mode: "dark",
    font: "alfaslab-sourcesans",
    layout: { hero: "fullbleed", about: "stats", booking: "ticket", fleet: "tiles", reviews: "stack", contact: "bold" },
    radius: { card: 8, image: 8, button: 8 },
    spacing: "tight",
    heading: { tracking: "0.005em", leading: 0.98 },
    image: "slant",
    art: "peaks",
    suits: ["two-wheel"],
    tags: ["two-wheel"],
    tone: { dark: true, hue: 30, sat: 0.14, light: 0.1 },
    caps: true,
    chatBar: true
  },
  // Classic and vintage scooters: cream, printed photos, a centered name.
  dolce: {
    ...BASE,
    id: "dolce",
    mode: "light",
    font: "dmserif-dmsans",
    layout: { hero: "split", about: "editorial", booking: "panel", fleet: "spotlight", reviews: "quote", contact: "split" },
    radius: { card: 14, image: 14, button: 999 },
    spacing: "airy",
    heading: { tracking: "-0.01em", leading: 1.02 },
    image: "frame",
    art: "dunes",
    suits: ["two-wheel"],
    tags: ["two-wheel", "premium"],
    tone: { dark: false, hue: 40, sat: 0.45, light: 0.955 },
    header: "center"
  },
  // Family cars and minivans: friendly, how renting works, seats up front.
  haven: {
    ...BASE,
    id: "haven",
    mode: "light",
    font: "lora-nunito",
    layout: { hero: "search", about: "steps", booking: "open", fleet: "grid", reviews: "quote", contact: "mapfirst" },
    radius: { card: 26, image: 26, button: 999 },
    spacing: "regular",
    heading: { tracking: "-0.015em", leading: 1.06 },
    image: "soft",
    art: "sun",
    suits: ["car"],
    tags: ["car"],
    tone: { dark: false, hue: null, sat: 0.3, light: 0.965 }
  },
  // Long-term and monthly rentals for expats: calm, monthly prices, steps.
  nomad: {
    ...BASE,
    id: "nomad",
    mode: "light",
    font: "fraunces-figtree",
    layout: { hero: "bigtype", about: "steps", booking: "panel", fleet: "list", reviews: "quote", contact: "mapfirst" },
    radius: { card: 14, image: 18, button: 12 },
    spacing: "airy",
    heading: { tracking: "-0.025em", leading: 1.04 },
    image: "soft",
    art: "dunes",
    suits: ["car", "mixed"],
    tags: ["car", "two-wheel"],
    tone: { dark: false, hue: 30, sat: 0.12, light: 0.96 }
  },
  // Electric cars and scooters: fresh, light green page, figures.
  volt: {
    ...BASE,
    id: "volt",
    mode: "light",
    font: "bricolage-hanken",
    layout: { hero: "split", about: "quote", booking: "open", fleet: "tiles", reviews: "quote", contact: "minimal" },
    radius: { card: 20, image: 24, button: 999 },
    spacing: "regular",
    heading: { tracking: "-0.035em", leading: 1 },
    image: "soft",
    art: "grid",
    suits: ["car", "mixed"],
    tags: ["car", "two-wheel"],
    tone: { dark: false, hue: 140, sat: 0.25, light: 0.965 }
  },
  // Camper and van hire: canvas, mountains in a wide frame, the van in the spotlight.
  roam: {
    ...BASE,
    id: "roam",
    mode: "light",
    font: "alfaslab-sourcesans",
    layout: { hero: "frame", about: "steps", booking: "ticket", fleet: "spotlight", reviews: "cards", contact: "mapfirst" },
    radius: { card: 16, image: 16, button: 999 },
    spacing: "regular",
    heading: { tracking: "0", leading: 1.02 },
    image: "soft",
    art: "peaks",
    suits: ["car"],
    tags: ["car"],
    tone: { dark: false, hue: 28, sat: 0.25, light: 0.945 }
  },
  // Japanese minimal: paper white, lots of space, hairlines.
  washi: {
    ...BASE,
    id: "washi",
    mode: "light",
    font: "shippori-zen",
    layout: { hero: "bigtype", about: "quote", booking: "open", fleet: "list", reviews: "quote", contact: "split" },
    radius: { card: 2, image: 2, button: 2 },
    spacing: "airy",
    heading: { tracking: "0.02em", leading: 1.25 },
    image: "crisp",
    art: "ripple",
    suits: ["car", "mixed", "two-wheel"],
    tags: ["car", "two-wheel"],
    tone: { dark: false, hue: 45, sat: 0.2, light: 0.965 },
    header: "center",
    edge: "hairline"
  },
  // Swiss and Nordic clean: a cover grid, hairlines, nothing extra.
  fjord: {
    ...BASE,
    id: "fjord",
    mode: "light",
    font: "schibsted-publicsans",
    layout: { hero: "cover", about: "panel", booking: "panel", fleet: "list", reviews: "cards", contact: "minimal" },
    radius: { card: 0, image: 0, button: 0 },
    spacing: "regular",
    heading: { tracking: "-0.04em", leading: 0.98 },
    image: "crisp",
    art: "contour",
    suits: ["car", "mixed"],
    tags: ["car"],
    tone: { dark: false, hue: 210, sat: 0.08, light: 0.985 },
    edge: "hairline"
  },
  // Editorial magazine: a masthead cover, a pull quote, a masonry fleet.
  folio: {
    ...BASE,
    id: "folio",
    mode: "light",
    font: "instrument",
    layout: { hero: "cover", about: "quote", booking: "open", fleet: "masonry", reviews: "quote", contact: "split" },
    radius: { card: 4, image: 4, button: 999 },
    spacing: "airy",
    heading: { tracking: "-0.02em", leading: 0.98 },
    image: "crisp",
    art: "bloom",
    suits: ["mixed", "car", "two-wheel"],
    tags: ["car", "two-wheel", "premium"],
    tone: { dark: false, hue: 0, sat: 0, light: 0.985 },
    header: "center",
    edge: "hairline"
  },
  // Bold brutalist: capitals, heavy borders and hard shadows, square corners.
  block: {
    ...BASE,
    id: "block",
    mode: "light",
    font: "archivoblack-archivo",
    layout: { hero: "bigtype", about: "stacked", booking: "ticket", fleet: "list", reviews: "stack", contact: "minimal" },
    radius: { card: 0, image: 0, button: 0 },
    spacing: "tight",
    heading: { tracking: "-0.02em", leading: 0.94 },
    image: "crisp",
    art: "grid",
    suits: ["mixed", "two-wheel", "car"],
    tags: ["car", "two-wheel"],
    tone: { dark: false, hue: 52, sat: 0.7, light: 0.9 },
    edge: "heavy",
    caps: true
  },
  // Warm boutique: terracotta-tinted page, printed photos, a collage.
  amber: {
    ...BASE,
    id: "amber",
    mode: "light",
    font: "dmserif-dmsans",
    layout: { hero: "collage", about: "quote", booking: "open", fleet: "masonry", reviews: "quote", contact: "mapfirst" },
    radius: { card: 20, image: 20, button: 999 },
    spacing: "airy",
    heading: { tracking: "-0.015em", leading: 1.04 },
    image: "frame",
    art: "bloom",
    suits: ["mixed", "car", "two-wheel"],
    tags: ["car", "two-wheel", "island"],
    tone: { dark: false, hue: 22, sat: 0.4, light: 0.95 }
  },
  // Night and neon city: deep violet, a full-width photo, a glowing fleet strip.
  neon: {
    id: "neon",
    mode: "dark",
    font: "syne-intertight",
    layout: { hero: "fullbleed", about: "panel", booking: "ticket", fleet: "tiles", reviews: "stack", contact: "bold" },
    radius: { card: 16, image: 16, button: 999 },
    spacing: "tight",
    heading: { tracking: "-0.02em", leading: 0.96 },
    image: "slant",
    art: "city",
    ticker: true,
    suits: ["two-wheel", "car", "mixed"],
    tags: ["car", "two-wheel"],
    tone: { dark: true, hue: 265, sat: 0.45, light: 0.07 }
  }
};

export function isTemplateId(id: unknown): id is TemplateId {
  return typeof id === "string" && (TEMPLATE_IDS as readonly string[]).includes(id);
}

export function templateDef(id: string | null | undefined): TemplateDef {
  return TEMPLATES[isTemplateId(id) ? id : "coast"];
}

/** Section padding (top and bottom) for each spacing, phone then desktop, in px. */
export const SPACING = {
  airy: { phone: 68, desktop: 112 },
  regular: { phone: 60, desktop: 104 },
  tight: { phone: 52, desktop: 88 }
} as const;
