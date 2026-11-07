import { supportedLocaleCodes } from "@/lib/i18n/locales";

/**
 * Language-prefixed addresses for RoveHQ's own website (SEO: one address per language).
 *
 * English lives at the root (/pricing, /guides/<slug>); every other language under its code (/th/pricing,
 * /zh-TW/guides/<slug>). proxy.ts serves every one of them from that language's page drawn ahead of time
 * (app/(site)/site/[locale], lib/site/internal-path.ts). The staff app's addresses never carry a prefix.
 * Safe to import from the proxy and the browser (no server-only imports).
 */

export const DEFAULT_SITE_LOCALE = "en";

const codes = new Set<string>(supportedLocaleCodes);

/** Website pages, written without a language prefix. "/" is the home page for someone signed out. */
export function isSitePath(path: string) {
  return (
    path === "/" ||
    path === "/home" ||
    path === "/pricing" ||
    path === "/faq" ||
    path === "/contact" ||
    path === "/guides" ||
    path.startsWith("/guides/") ||
    path === "/resources" ||
    path.startsWith("/resources/") ||
    path === "/docs" ||
    path.startsWith("/docs/") ||
    // Switching from other rental software (lib/site/switch.ts).
    path === "/switch" ||
    path.startsWith("/switch/") ||
    // Privacy policy, terms, DPA, sub-processors, cookies (lib/site/legal.ts).
    path === "/legal" ||
    path.startsWith("/legal/") ||
    // RoveHQ for each kind of rental business (lib/site/segments.ts).
    path === "/car-rental-software" ||
    path === "/scooter-rental-software" ||
    path === "/motorcycle-rental-software" ||
    // Booking page templates, with example pages (app/(site)/site/[locale]/booking-pages).
    path === "/booking-pages"
  );
}

/** "/th/pricing" → { locale: "th", rest: "/pricing" }; "/th" → { locale: "th", rest: "/" }; "/pricing" → { locale: null, rest: "/pricing" }. */
export function splitSiteLocale(pathname: string): { locale: string | null; rest: string } {
  const match = pathname.match(/^\/([A-Za-z]{2,3}(?:-[A-Za-z]{2})?)(\/.*)?$/);
  if (match && codes.has(match[1])) return { locale: match[1], rest: match[2] || "/" };
  return { locale: null, rest: pathname };
}

/**
 * A website address in a language: "/pricing" → "/th/pricing", "/" → "/th", "/home#how" → "/th#how".
 * Anything that is not a website page (sign-in, "#how", external links) comes back unchanged; English has no prefix.
 */
export function localizeSitePath(href: string, locale: string | null | undefined) {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const cut = href.search(/[?#]/);
  const base = cut === -1 ? href : href.slice(0, cut);
  const suffix = cut === -1 ? "" : href.slice(cut);
  // Already in a language: re-home it.
  const { locale: existing, rest } = splitSiteLocale(base);
  const path = existing ? rest : base;
  if (!isSitePath(path)) return href;
  if (!locale || locale === DEFAULT_SITE_LOCALE || !codes.has(locale)) return `${path}${suffix}`;
  const page = path === "/home" ? "/" : path;
  return `/${locale}${page === "/" ? "" : page}${suffix}`;
}

/**
 * The hreflang value for a language. Search engines expect ISO 639-1 codes; Filipino has none ("fil" is ISO 639-2),
 * so its pages are announced as Tagalog ("tl"), the language Filipino is standardised from. The address stays /fil/.
 */
export function hreflangFor(locale: string) {
  return locale === "fil" ? "tl" : locale;
}
