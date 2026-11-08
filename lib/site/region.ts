/**
 * The visitor's part of the world, for the website (global audience, Rory 8 Nov 2026: "We're a global business").
 * Worked out from the currency proxy.ts already puts in the home and pricing pages' addresses (the visitor's country's
 * currency, US dollars for crawlers and unknown visitors: lib/site/internal-path.ts), so no page is drawn more often.
 *
 * - Asia sees QR payments and payment slips first, which is how most renters there pay (PromptPay, QRIS, VietQR...).
 * - Everyone else sees online booking, agreements and bank transfer / Wise / Revolut first, with card payments
 *   through Stripe as coming soon (operator card payments are planned, not live).
 * - Guides about the visitor's region come first, then the ones for every market, then the rest.
 * Safe to import from the proxy (no server-only imports).
 */

export const SITE_REGIONS = ["asia", "europe", "americas", "oceania", "other"] as const;
export type SiteRegion = (typeof SITE_REGIONS)[number];

export const isSiteRegion = (value: string): value is SiteRegion => (SITE_REGIONS as readonly string[]).includes(value);

const BY_CURRENCY: Record<string, SiteRegion> = {
  THB: "asia", IDR: "asia", VND: "asia", LAK: "asia", MMK: "asia", KHR: "asia", MYR: "asia", PHP: "asia", SGD: "asia",
  INR: "asia", LKR: "asia", CNY: "asia", TWD: "asia", HKD: "asia", JPY: "asia", KRW: "asia",
  EUR: "europe", GBP: "europe", SEK: "europe", NOK: "europe", DKK: "europe", CHF: "europe", PLN: "europe", CZK: "europe", HUF: "europe",
  USD: "americas", CAD: "americas", MXN: "americas", BRL: "americas", COP: "americas", CRC: "americas", CLP: "americas", PEN: "americas", ARS: "americas",
  AUD: "oceania", NZD: "oceania"
};

/** The region a currency's countries are in; "americas" for US dollars (also what crawlers and unknown visitors get). */
export function regionForCurrency(currency: string | null | undefined): SiteRegion {
  return BY_CURRENCY[String(currency || "").trim().toUpperCase()] || "other";
}

/** Whether the visitor's region pays mostly by QR code and payment slip. */
export const paysByQr = (region: SiteRegion) => region === "asia";

const ASIA = "th id vn la mm kh my ph sg in lk cn tw hk jp kr bn tl np bd mv";
const EUROPE = "eu europe gb uk ie fr de nl be lu es pt it gr mt cy at ch dk se no fi is pl cz sk hu si hr ro bg ee lv lt me al mk rs ba tr";
const AMERICAS = "us ca mx cr pa gt bz hn ni sv br co pe cl ar uy ec bo py do pr jm bs americas latam";
const OCEANIA = "au nz fj oceania";
const LOOKUP = new Map<string, SiteRegion>([
  ...ASIA.split(" ").map((code) => [code, "asia"] as [string, SiteRegion]),
  ["asia", "asia"],
  ...EUROPE.split(" ").map((code) => [code, "europe"] as [string, SiteRegion]),
  ...AMERICAS.split(" ").map((code) => [code, "americas"] as [string, SiteRegion]),
  ...OCEANIA.split(" ").map((code) => [code, "oceania"] as [string, SiteRegion])
]);

/**
 * The regions a guide's `country:` frontmatter names: "global" (or nothing) is none, "th" is Asia, "us, gb" is the
 * Americas and Europe, "eu" is Europe.
 */
export function regionsForCountries(country: string | null | undefined): SiteRegion[] {
  const regions = new Set<SiteRegion>();
  for (const code of String(country || "").toLowerCase().split(/[\s,]+/)) {
    const region = LOOKUP.get(code);
    if (region) regions.add(region);
  }
  return [...regions];
}
