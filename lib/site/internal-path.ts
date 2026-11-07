import { CONTRACT_BUILDER_PAGES, isContractBuilder } from "@/lib/contract-builder/fields";
import { LEAD_COUNTRIES } from "@/lib/leads";
import { currencyForCountry, isSiteCurrency, PRICING_CURRENCIES } from "@/lib/site-currency";

/**
 * Where proxy.ts serves each website address from (Rory, 3 Nov 2026: the website is drawn ahead of time and served
 * from Vercel's cache, not drawn again for every visit and every search-engine crawl).
 *
 * The pages live under app/(site)/site/[locale]/, one copy per language. Everything that used to be read from the
 * request while drawing a page is in the internal address instead, worked out here from the request by the proxy:
 * - the language: /th/pricing → /site/th/pricing/…, /pricing → /site/en/pricing/…;
 * - the visitor's currency (home and pricing), from their country, never their language (lib/site-currency.ts);
 * - the pricing page's monthly/yearly and currency choice (?billing=yearly&currency=EUR);
 * - the visitor's country, which the main contract builder starts on.
 * Each combination is drawn once and then served from the cache. The public addresses never change.
 * Safe to import from the proxy (no server-only imports).
 */

export const SITE_INTERNAL_PREFIX = "/site";
/** "No country" in an internal address (a resource page that doesn't start on the visitor's country). */
export const NO_COUNTRY = "-";

/** The pricing page's segment: detected currency, chosen currency, monthly or yearly. "THB_EUR_y". */
export function pricingView(detected: string, chosen: string, yearly: boolean) {
  return `${detected}_${chosen}_${yearly ? "y" : "m"}`;
}

export function parsePricingView(view: string): { detected: string; chosen: string; yearly: boolean } | null {
  const match = /^([A-Z]{3})_([A-Z]{3})_([my])$/.exec(view);
  if (!match || !isSiteCurrency(match[1]) || !isSiteCurrency(match[2])) return null;
  return { detected: match[1], chosen: match[2], yearly: match[3] === "y" };
}

/** The visitor's country (Vercel's x-vercel-ip-country; SITE_DEFAULT_COUNTRY on a server without it), or "". */
export function visitorCountryFrom(headers: Headers) {
  return String(headers.get("x-vercel-ip-country") || process.env.SITE_DEFAULT_COUNTRY || "").trim().toUpperCase();
}

/**
 * Search engines and AI crawlers (SEO, 7 Nov 2026). They see prices in US dollars, whatever country they crawl from:
 * Googlebot crawling from Jakarta used to be shown rupiah, and that is what ended up in search results and AI answers.
 */
const CRAWLER =
  /googlebot|google-inspectiontool|googleother|google-extended|storebot-google|adsbot-google|mediapartners-google|apis-google|feedfetcher-google|bingbot|bingpreview|msnbot|adidxbot|duckduckbot|duckassistbot|yandexbot|yandeximages|baiduspider|applebot|slurp|petalbot|seznambot|naverbot|yeti\/|sogou|qwantbot|mojeekbot|gptbot|chatgpt-user|oai-searchbot|claudebot|claude-user|claude-searchbot|anthropic-ai|perplexitybot|perplexity-user|ccbot|bytespider|amazonbot|meta-externalagent|meta-externalfetcher|facebookexternalhit|facebookbot|linkedinbot|twitterbot|slackbot|discordbot|telegrambot|whatsapp|cohere-ai|youbot|diffbot|mistralai-user|ai2bot|timpibot|semrushbot|ahrefsbot|mj12bot|dotbot|\bbot\b|crawler|spider/i;

export function isCrawler(userAgent: string | null | undefined) {
  return CRAWLER.test(String(userAgent || ""));
}

/**
 * The visitor's currency: their country's, US dollars when we can't tell (lib/site-currency.ts). Crawlers always get
 * US dollars, and so does a request with no country (on Vercel every visitor has one). SITE_DEFAULT_COUNTRY stands in
 * for the missing country only in development (a local server has no x-vercel-ip-country).
 */
export function visitorCurrencyFrom(headers: Headers) {
  if (isCrawler(headers.get("user-agent"))) return "USD";
  const country = String(headers.get("x-vercel-ip-country") || "").trim();
  if (country) return currencyForCountry(country) || "USD";
  if (process.env.NODE_ENV === "development") return currencyForCountry(process.env.SITE_DEFAULT_COUNTRY) || "USD";
  return "USD";
}

/**
 * The internal address of a website page. `path` is the page without a language ("/pricing", "/home",
 * "/guides/<slug>"); `search` the address's query (only the pricing page reads it).
 */
export function siteInternalPath(path: string, locale: string, headers: Headers, search: URLSearchParams) {
  const base = `${SITE_INTERNAL_PREFIX}/${locale}`;
  if (path === "/" || path === "/home") return `${base}/home/${visitorCurrencyFrom(headers)}`;
  if (path === "/pricing") {
    const detected = visitorCurrencyFrom(headers);
    const asked = String(search.get("currency") || "").toUpperCase();
    // Only the currencies the page offers (plus the visitor's own), so a made-up ?currency= is just the default.
    const chosen = (PRICING_CURRENCIES.includes(asked) || asked === detected) && isSiteCurrency(asked) ? asked : detected;
    return `${base}/pricing/${pricingView(detected, chosen, search.get("billing") === "yearly")}`;
  }
  const resource = path.match(/^\/resources\/([^/]+)$/);
  if (resource) {
    // The main contract builder starts on the visitor's country; a country or city page on its own.
    const slug = resource[1];
    const country = visitorCountryFrom(headers);
    const here = isContractBuilder(slug) && !CONTRACT_BUILDER_PAGES[slug] && (LEAD_COUNTRIES as readonly string[]).includes(country) ? country : NO_COUNTRY;
    return `${base}${path}/${here}`;
  }
  return `${base}${path}`;
}
