import { isBrandColour } from "@/lib/brand";
import type { ArtId, ImageRef } from "@/lib/sites/images";
import { imageRefFrom } from "@/lib/sites/images";
import { TEMPLATE_IDS, type TemplateId } from "@/lib/sites/templates";
import { FONT_IDS } from "@/lib/sites/fonts";

/**
 * A business's booking website (Rory, 7 Nov 2026): one page made of sections, drawn by a template, coloured by a
 * palette and set in a font pairing. Most of what it says comes from RoveHQ (name, vehicles, prices, policies,
 * contact details); this config holds only what the owner changes. Text the owner never edited is not stored, so it
 * stays in the renter's language and follows the business's data.
 *
 * Stored as JSON in booking_sites.draft / booking_sites.published (migration 0133). siteConfigFrom() tidies anything
 * read back, so an older or hand-edited value can never break the page. Safe to import from the browser.
 */

export type SectionId = "about" | "booking" | "fleet" | "reviews" | "faqs" | "contact";
/** The order a new site starts in. The hero is always first and the footer last; "booking" can't be switched off. */
export const SECTION_IDS: SectionId[] = ["about", "booking", "fleet", "reviews", "faqs", "contact"];

/** Every piece of text that can be clicked and edited on the page. */
export const TEXT_SLOTS = [
  "hero.headline",
  "hero.subline",
  "hero.cta",
  "about.title",
  "about.body",
  "booking.title",
  "booking.subline",
  "fleet.title",
  "reviews.title",
  "faqs.title",
  "contact.title",
  "contact.subline"
] as const;
export type TextSlot = (typeof TEXT_SLOTS)[number];
/** Multi-line slots (the rest are one line). */
export const LONG_SLOTS: TextSlot[] = ["about.body", "hero.subline", "contact.subline", "booking.subline"];
export const SLOT_MAX: Record<TextSlot, number> = {
  "hero.headline": 90,
  "hero.subline": 220,
  "hero.cta": 32,
  "about.title": 80,
  "about.body": 1200,
  "booking.title": 80,
  "booking.subline": 200,
  "fleet.title": 80,
  "reviews.title": 80,
  "faqs.title": 80,
  "contact.title": 80,
  "contact.subline": 200
};

export type SiteSocial = { facebook: string; instagram: string; tiktok: string; line: string; whatsapp: string };
export const SOCIAL_KEYS: Array<keyof SiteSocial> = ["facebook", "instagram", "line", "tiktok", "whatsapp"];
export const EMPTY_SOCIAL: SiteSocial = { facebook: "", instagram: "", tiktok: "", line: "", whatsapp: "" };
/** Opening hours, Monday first; null is closed. The whole list is null when not set. */
export type SiteHours = Array<{ open: string; close: string } | null>;
export type SiteFaq = { q: string; a: string };

export type SiteConfig = {
  v: 1;
  template: TemplateId;
  /** "auto" (the template's own), a generated palette id (lib/sites/palettes.ts) or "custom". */
  palette: string;
  customAccent: string | null;
  customDark: boolean;
  /** A font pairing (lib/sites/fonts.ts); null uses the template's. */
  font: string | null;
  sections: Array<{ id: SectionId; on: boolean }>;
  text: Partial<Record<TextSlot, string>>;
  images: { hero: ImageRef | null; about: ImageRef | null };
  /** Up to four short points beside About ("Free delivery nearby"). */
  highlights: string[];
  faqs: SiteFaq[];
  hours: SiteHours | null;
  social: SiteSocial;
  /** Their Google reviews page: shown when there are no RoveHQ reviews yet. Reviews are never made up. */
  reviewsUrl: string;
  /** Where the map points; empty uses the business address. */
  mapQuery: string;
  /** The owner's own words added to the policies the page works out from settings. */
  policyNotes: { cancellation: string; requirements: string };
  /** Vehicles in Fleet highlights, in order; empty picks them automatically. */
  featured: string[];
};

export const LIMITS = { highlights: 4, highlight: 90, faqs: 8, faqQ: 140, faqA: 600, url: 300, map: 200, social: 120, note: 600, featured: 8 };

const oneLine = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const text = (value: unknown, max: number) =>
  String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
const time = (value: unknown) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : null);
const record = (value: unknown): Record<string, any> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {});

/** A web address people can open: https:// added when they typed "facebook.com/…", anything else dropped. */
export function cleanUrl(value: unknown) {
  const raw = oneLine(value, LIMITS.url);
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") ? url.toString() : "";
  } catch {
    return "";
  }
}

function hoursFrom(value: unknown): SiteHours | null {
  if (!Array.isArray(value) || value.length !== 7) return null;
  return value.map((day: any) => (day && time(day.open) && time(day.close) ? { open: time(day.open) as string, close: time(day.close) as string } : null));
}

function sectionsFrom(value: unknown): SiteConfig["sections"] {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set<SectionId>();
  const sections: SiteConfig["sections"] = [];
  for (const item of list) {
    const id = record(item).id as SectionId;
    if (!SECTION_IDS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    sections.push({ id, on: id === "booking" ? true : record(item).on !== false });
  }
  // A section missing from what was stored goes at the end, so new sections always appear somewhere.
  for (const id of SECTION_IDS) if (!seen.has(id)) sections.push({ id, on: true });
  return sections;
}

function textFrom(value: unknown): SiteConfig["text"] {
  const raw = record(value);
  const out: SiteConfig["text"] = {};
  for (const slot of TEXT_SLOTS) {
    const clean = LONG_SLOTS.includes(slot) ? text(raw[slot], SLOT_MAX[slot]) : oneLine(raw[slot], SLOT_MAX[slot]);
    if (clean) out[slot] = clean;
  }
  return out;
}

/** The starting config: a template that suits the fleet, everything else from RoveHQ. */
export function defaultSiteConfig(template: TemplateId = "coast"): SiteConfig {
  return {
    v: 1,
    template,
    palette: "auto",
    customAccent: null,
    customDark: false,
    font: null,
    sections: SECTION_IDS.map((id) => ({ id, on: true })),
    text: {},
    images: { hero: null, about: null },
    highlights: [],
    faqs: [],
    hours: null,
    social: { ...EMPTY_SOCIAL },
    reviewsUrl: "",
    mapQuery: "",
    policyNotes: { cancellation: "", requirements: "" },
    featured: []
  };
}

/** Reads (and tidies) a stored config. `fallbackTemplate` is used when none was chosen. */
export function siteConfigFrom(value: unknown, fallbackTemplate: TemplateId = "coast"): SiteConfig {
  const raw = record(value);
  const base = defaultSiteConfig(TEMPLATE_IDS.includes(raw.template) ? raw.template : fallbackTemplate);
  const images = record(raw.images);
  const social = record(raw.social);
  const notes = record(raw.policyNotes);
  return {
    ...base,
    palette: typeof raw.palette === "string" && /^[a-z0-9-]{1,24}$/.test(raw.palette) ? raw.palette : "auto",
    customAccent: isBrandColour(raw.customAccent) ? String(raw.customAccent).toLowerCase() : null,
    customDark: raw.customDark === true,
    font: typeof raw.font === "string" && FONT_IDS.includes(raw.font) ? raw.font : null,
    sections: sectionsFrom(raw.sections),
    text: textFrom(raw.text),
    images: { hero: imageRefFrom(images.hero), about: imageRefFrom(images.about) },
    highlights: (Array.isArray(raw.highlights) ? raw.highlights : []).map((line: unknown) => oneLine(line, LIMITS.highlight)).filter(Boolean).slice(0, LIMITS.highlights),
    faqs: (Array.isArray(raw.faqs) ? raw.faqs : [])
      .map((faq: any) => ({ q: oneLine(faq?.q, LIMITS.faqQ), a: text(faq?.a, LIMITS.faqA) }))
      .filter((faq: SiteFaq) => faq.q && faq.a)
      .slice(0, LIMITS.faqs),
    hours: hoursFrom(raw.hours),
    social: Object.fromEntries(SOCIAL_KEYS.map((key) => [key, oneLine(social[key], LIMITS.social)])) as SiteSocial,
    reviewsUrl: cleanUrl(raw.reviewsUrl),
    mapQuery: oneLine(raw.mapQuery, LIMITS.map),
    policyNotes: { cancellation: text(notes.cancellation, LIMITS.note), requirements: text(notes.requirements, LIMITS.note) },
    featured: (Array.isArray(raw.featured) ? raw.featured : [])
      .map((id: unknown) => String(id || "").slice(0, 60))
      .filter((id: string, index: number, list: string[]) => id && list.indexOf(id) === index)
      .slice(0, LIMITS.featured)
  };
}

/** The template that suits a fleet when the owner hasn't picked one: Moto for mostly two wheels, Coast otherwise. */
export function templateForFleet(kinds: string[]): TemplateId {
  if (!kinds.length) return "coast";
  const twoWheels = kinds.filter((kind) => ["scooter", "motorbike", "ebike"].includes(kind)).length;
  return twoWheels / kinds.length > 0.5 ? "moto" : "coast";
}

/**
 * The booking page before the website builder (organizations.settings.booking_site, 7 Nov 2026): its five templates
 * map onto the nearest new one, and what the owner wrote carries over.
 */
const LEGACY_TEMPLATE: Record<string, TemplateId> = { standard: "coast", photo: "coast", scooter: "moto", compact: "summit", monthly: "summit" };

export function siteConfigFromLegacy(settings: unknown, kinds: string[]): SiteConfig {
  const legacy = record(record(settings).booking_site);
  const template = LEGACY_TEMPLATE[String(legacy.template || "")] || templateForFleet(kinds);
  const config = defaultSiteConfig(template);
  if (!Object.keys(legacy).length) return config;
  const off = Array.isArray(legacy.off) ? legacy.off.map(String) : [];
  return siteConfigFrom(
    {
      ...config,
      sections: SECTION_IDS.map((id) => ({ id, on: !(["about", "faqs", "reviews"].includes(id) && off.includes(id)) })),
      text: { "hero.headline": legacy.headline, "hero.subline": legacy.subline, "about.body": legacy.about },
      images: { hero: legacy.hero_path ? { kind: "upload", path: legacy.hero_path } : null, about: null },
      highlights: legacy.why,
      faqs: legacy.faqs,
      hours: legacy.hours,
      social: legacy.social,
      reviewsUrl: legacy.reviews_url,
      mapQuery: legacy.map_query
    },
    template
  );
}

/** Two configs are the same site (for "Unpublished changes"). */
export function sameSite(a: SiteConfig | null, b: SiteConfig | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isSectionOn(config: SiteConfig, id: SectionId) {
  return config.sections.find((section) => section.id === id)?.on !== false;
}

/** The editor and its preview talk over postMessage (same origin only). */
export const SITE_MESSAGE = { config: "rove-site:config", ready: "rove-site:ready", text: "rove-site:text" } as const;

export type { ArtId, ImageRef };
