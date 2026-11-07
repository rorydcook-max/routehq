import type { ArtId } from "@/lib/sites/images";

/**
 * Website templates (Rory, 7 Nov 2026). A template is data: which layout each section uses, its default palette
 * mode, font pairing, corner radii, spacing and image treatment. The section components (components/site/sections)
 * read these, so a new template is a new entry here plus, at most, a new layout variant for a section or two.
 * Phase 2 adds 20+ more this way. Safe to import from the browser.
 */

export type TemplateId = "coast" | "moto" | "summit";
export const TEMPLATE_IDS: TemplateId[] = ["coast", "moto", "summit"];

export type HeroLayout = "postcard" | "poster" | "split";
export type AboutLayout = "editorial" | "stacked" | "panel";
export type FleetLayout = "rail" | "tiles" | "grid";
export type ReviewsLayout = "quote" | "stack" | "cards";
export type ContactLayout = "split" | "bold" | "cards";
export type BookingLayout = "open" | "ticket" | "panel";

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
  /** How photos are framed. */
  image: "soft" | "slant" | "crisp";
  /** The built-in art behind the hero when there is no photo. */
  art: ArtId;
  /** Fleet names running across the page (one moving strip; still when reduced motion is on). */
  ticker: boolean;
  /** The kinds of business it was designed for, for the gallery's order. */
  suits: Array<"car" | "two-wheel" | "mixed">;
};

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
    suits: ["mixed", "car", "two-wheel"]
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
    suits: ["two-wheel", "mixed"]
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
    suits: ["car", "mixed"]
  }
};

export function templateDef(id: string | null | undefined): TemplateDef {
  return TEMPLATES[(id as TemplateId) in TEMPLATES ? (id as TemplateId) : "coast"];
}

/** Section padding (top and bottom) for each spacing, phone then desktop, in px. */
export const SPACING = {
  airy: { phone: 68, desktop: 112 },
  regular: { phone: 60, desktop: 104 },
  tight: { phone: 52, desktop: 88 }
} as const;
