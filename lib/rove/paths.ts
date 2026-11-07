import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { COUNTRY_SLUGS, DESTINATION_KEYS, GUIDE_SLUGS } from "@/lib/rove/guide-slugs";

/**
 * rove.rent's own pages (task "roverent", 7 Nov 2026) and where proxy.ts serves them from.
 *
 * Public addresses (English at the root, other languages under /<code>/, like rovehq.io):
 *   /                         home
 *   /search                   search results (?place=&from=&to=&kind=...)
 *   /vehicles/<id>            one vehicle
 *   /guides, /guides/<slug>   renter guides (English only for now)
 *   /<country>                a country's destinations (English only for now)
 *   /<country>/<place>        a destination (English only for now)
 * Each is drawn from app/(rove)/rove/[locale]/... (the internal prefix /rove/<locale>), which reads nothing from the
 * request, so the static ones are served from the cache. Everything else on rove.rent (a business's page at
 * rove.rent/<slug>, booking links) is unchanged. No server code: the proxy imports this file.
 */

export const ROVE_INTERNAL_PREFIX = "/rove";
export const ROVE_DEFAULT_LOCALE = "en";
export const ROVE_LOCALES: readonly string[] = supportedLocaleCodes;

/** Pages written in every language (their words are all in locales/<code>/common.json). */
type Section = "home" | "search" | "vehicle" | "guides" | "guide" | "country" | "destination";
const ALL_LANGUAGES: Section[] = ["home", "search", "vehicle"];

export type RovePage = { section: Section; locale: string; rest: string; prefixed: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a page is written in this language (English always is). */
export function roveHasLocale(section: Section, locale: string) {
  return locale === ROVE_DEFAULT_LOCALE || (ALL_LANGUAGES.includes(section) && ROVE_LOCALES.includes(locale));
}

function sectionOf(rest: string): Section | null {
  if (rest === "/") return "home";
  if (rest === "/search") return "search";
  if (rest === "/guides") return "guides";
  const parts = rest.split("/").filter(Boolean);
  if (parts[0] === "vehicles" && parts.length === 2 && UUID.test(parts[1])) return "vehicle";
  if (parts[0] === "guides" && parts.length === 2 && GUIDE_SLUGS.includes(parts[1])) return "guide";
  if (parts.length === 1 && COUNTRY_SLUGS.includes(parts[0])) return "country";
  if (parts.length === 2 && DESTINATION_KEYS.includes(`${parts[0]}/${parts[1]}`)) return "destination";
  return null;
}

/** A rove.rent address that is one of Rove's own pages, with its language; null for anything else. */
export function parseRovePath(pathname: string): RovePage | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const first = clean.split("/")[1] || "";
  const prefixed = first !== ROVE_DEFAULT_LOCALE && ROVE_LOCALES.includes(first);
  const locale = prefixed ? first : ROVE_DEFAULT_LOCALE;
  const rest = prefixed ? clean.slice(first.length + 1) || "/" : clean || "/";
  const section = sectionOf(rest);
  return section ? { section, locale, rest, prefixed } : null;
}

/** The public address of a Rove page in a language: roveHref("/search", "th") is "/th/search". */
export function roveHref(path: string, locale: string) {
  if (locale === ROVE_DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Where the proxy serves a Rove page from. */
export function roveInternalPath(page: RovePage) {
  return `${ROVE_INTERNAL_PREFIX}/${page.locale}${page.rest === "/" ? "" : page.rest}`;
}

/**
 * Rove's own pages are the only ones on rove.rent that may be measured (after consent): a business's page there
 * (rove.rent/<slug>), booking links and changes are the business's (lib/analytics.ts).
 */
export function isRoveOwnPath(pathname: string) {
  return parseRovePath(pathname) !== null;
}
