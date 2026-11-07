import { formatMoney as formatRegionalMoney } from "@/lib/regional";

/**
 * The booking page's look (Rory, 7 Nov 2026): a template and the sections around the vehicles, kept in
 * organizations.settings.booking_site. The vehicles, prices and booking flow are the same in every template; only the
 * layout, sections and styling change. A business that never picks one keeps "standard", the page as it was.
 * Safe to import from the browser (no server-only imports).
 */

export type BookingTemplate = "standard" | "photo" | "compact" | "monthly" | "scooter";
/** Alphabetical by English name in pickers is handled where they are shown; this is the stored order. */
export const BOOKING_TEMPLATES: BookingTemplate[] = ["standard", "photo", "compact", "monthly", "scooter"];

/** Sections that can be moved. "vehicles" (the booking part) can be moved but never switched off. The hero stays on top. */
export type SiteSection = "vehicles" | "about" | "why" | "faqs" | "reviews" | "map" | "hours" | "social";
export const SITE_SECTIONS: SiteSection[] = ["vehicles", "about", "why", "faqs", "reviews", "map", "hours", "social"];
/** Sections that can be switched off ("hero" included, which is not in the order). */
export type Switchable = Exclude<SiteSection, "vehicles"> | "hero";

export type SiteSocial = { facebook: string; instagram: string; tiktok: string; line: string; whatsapp: string };
export const SOCIAL_KEYS: Array<keyof SiteSocial> = ["facebook", "instagram", "line", "tiktok", "whatsapp"];
/** Opening hours, Monday first: null is closed. The whole list is null when not set. */
export type SiteHours = Array<{ open: string; close: string } | null>;
export type SiteFaq = { q: string; a: string };

export type BookingSite = {
  template: BookingTemplate;
  order: SiteSection[];
  off: Switchable[];
  headline: string;
  subline: string;
  /** The uploaded hero photo (branding bucket). Without one, the first vehicle photo is used. */
  heroPath: string | null;
  about: string;
  why: string[];
  faqs: SiteFaq[];
  /** Their Google reviews page. RoveHQ never shows reviews it cannot point to (no made-up ones, ever). */
  reviewsUrl: string;
  /** Where the map points; empty uses the business address. */
  mapQuery: string;
  hours: SiteHours | null;
  social: SiteSocial;
};

export const LIMITS = { headline: 80, subline: 160, about: 900, why: 4, whyText: 120, faqs: 8, faqQ: 140, faqA: 600, url: 300, map: 200, social: 120 };

export const EMPTY_SOCIAL: SiteSocial = { facebook: "", instagram: "", tiktok: "", line: "", whatsapp: "" };

const text = (value: unknown, max: number) => String(value ?? "").replace(/\s+\n/g, "\n").trim().slice(0, max);
const oneLine = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const time = (value: unknown) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : null);

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

/** Reads (and tidies) whatever is stored, so a hand-edited or older value can never break the page. */
export function bookingSiteFrom(settings: unknown): BookingSite {
  const all = settings && typeof settings === "object" ? (settings as Record<string, any>) : {};
  const raw = all.booking_site && typeof all.booking_site === "object" ? all.booking_site : {};
  const order = Array.isArray(raw.order) ? raw.order.filter((id: unknown, index: number, list: unknown[]) => SITE_SECTIONS.includes(id as SiteSection) && list.indexOf(id) === index) : [];
  // Any section missing from a stored order goes at the end, so new sections always appear somewhere.
  for (const id of SITE_SECTIONS) if (!order.includes(id)) order.push(id);
  const switchable: Switchable[] = ["hero", "about", "why", "faqs", "reviews", "map", "hours", "social"];
  const hours = Array.isArray(raw.hours) && raw.hours.length === 7
    ? raw.hours.map((day: any) => (day && time(day.open) && time(day.close) ? { open: time(day.open) as string, close: time(day.close) as string } : null))
    : null;
  const social = raw.social && typeof raw.social === "object" ? raw.social : {};
  return {
    template: BOOKING_TEMPLATES.includes(raw.template) ? raw.template : "standard",
    order,
    off: Array.isArray(raw.off) ? raw.off.filter((id: unknown) => switchable.includes(id as Switchable)) : [],
    headline: oneLine(raw.headline, LIMITS.headline),
    subline: oneLine(raw.subline, LIMITS.subline),
    heroPath: typeof raw.hero_path === "string" && raw.hero_path ? raw.hero_path : null,
    about: text(raw.about, LIMITS.about),
    why: (Array.isArray(raw.why) ? raw.why : []).map((line: unknown) => oneLine(line, LIMITS.whyText)).filter(Boolean).slice(0, LIMITS.why),
    faqs: (Array.isArray(raw.faqs) ? raw.faqs : [])
      .map((faq: any) => ({ q: oneLine(faq?.q, LIMITS.faqQ), a: text(faq?.a, LIMITS.faqA) }))
      .filter((faq: SiteFaq) => faq.q && faq.a)
      .slice(0, LIMITS.faqs),
    reviewsUrl: cleanUrl(raw.reviews_url),
    mapQuery: oneLine(raw.map_query, LIMITS.map),
    hours,
    social: Object.fromEntries(SOCIAL_KEYS.map((key) => [key, oneLine(social[key], LIMITS.social)])) as SiteSocial
  };
}

/** The stored shape (snake_case, like the rest of settings). */
export function bookingSiteToStored(site: BookingSite) {
  return {
    template: site.template,
    order: site.order,
    off: site.off,
    headline: site.headline,
    subline: site.subline,
    hero_path: site.heroPath,
    about: site.about,
    why: site.why,
    faqs: site.faqs,
    reviews_url: site.reviewsUrl,
    map_query: site.mapQuery,
    hours: site.hours,
    social: site.social
  };
}

/** How each template lays the vehicles out. */
export function catalogLayoutFor(template: BookingTemplate): "grid" | "list" | "tiles" {
  if (template === "compact") return "list";
  if (template === "scooter") return "tiles";
  return "grid";
}

/** The lowest monthly and daily prices on the page, for "From ... a month" in the templates' top part. */
export function lowestPrices(vehicles: Array<{ monthlyRate: number; dailyRate: number }>) {
  const lowest = (values: number[]) => (values.length ? Math.min(...values) : null);
  return {
    fromMonthly: lowest(vehicles.map((vehicle) => vehicle.monthlyRate).filter((rate) => rate > 0)),
    fromDaily: lowest(vehicles.map((vehicle) => vehicle.dailyRate).filter((rate) => rate > 0))
  };
}

/** Prices the way the booking page writes them: ฿ for baht, the currency's own symbol otherwise. */
export function sitePrice(value: number, currency: string) {
  return currency === "THB" ? `฿${Math.round(value).toLocaleString("en-US")}` : formatRegionalMoney(value, currency, "en-GB");
}

/** A link for each social account, from what the owner typed (@name, a number, or a full address). */
export function socialHref(key: keyof SiteSocial, value: string) {
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, "");
  switch (key) {
    case "facebook":
      return raw.includes(".") ? `https://${raw.replace(/^\/+/, "")}` : `https://facebook.com/${handle}`;
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "line":
      // LINE official accounts start with @; a personal ID opens the add-friend page.
      return raw.startsWith("@") ? `https://line.me/R/ti/p/${encodeURIComponent(raw)}` : `https://line.me/ti/p/~${encodeURIComponent(handle)}`;
    case "whatsapp": {
      const digits = raw.replace(/[^\d]/g, "");
      return digits.length >= 7 ? `https://wa.me/${digits}` : null;
    }
  }
}

/** A Google map with no key needed: the embed form of a normal search, and the link to open it in Maps. */
export function mapLinks(query: string) {
  const q = encodeURIComponent(query);
  return { embed: `https://www.google.com/maps?q=${q}&output=embed`, open: `https://www.google.com/maps/search/?api=1&query=${q}` };
}
