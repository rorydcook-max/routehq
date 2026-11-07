import type { Metadata } from "next";
import { renterUrl, siteDomain } from "@/lib/booking-address";
import { schemaDateTime } from "@/lib/site/schema";
import { ROVE_DEFAULT_LOCALE, ROVE_LOCALES, roveHasLocale, roveHref } from "@/lib/rove/paths";

/**
 * Search-engine details for rove.rent (task "roverent", 7 Nov 2026): canonical addresses, hreflang alternates for
 * the languages each page is written in, share images, and structured data. Ratings only ever come from a business's
 * real published reviews (lib/reviews.ts); nothing here makes any up.
 */

export const ROVE_NAME = "Rove";

export function roveOrigin() {
  return renterUrl();
}

export function roveAbsolute(path: string, locale = ROVE_DEFAULT_LOCALE) {
  const href = roveHref(path, locale);
  return `${roveOrigin()}${href === "/" ? "/" : href}`;
}

/** RoveHQ's website, for "List your fleet" and the publisher. */
export function roveHqSite() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || `https://${siteDomain()}`).replace(/\/$/, "");
}

type Section = Parameters<typeof roveHasLocale>[0];

/** Canonical plus hreflang for every language the page is written in (and x-default, the English address). */
export function roveAlternates(path: string, locale: string, section: Section): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const code of ROVE_LOCALES) if (roveHasLocale(section, code)) languages[code] = roveAbsolute(path, code);
  languages["x-default"] = roveAbsolute(path, ROVE_DEFAULT_LOCALE);
  return { canonical: roveAbsolute(path, locale), languages };
}

/** The share picture: drawn by app/api/rove-og (title and a line under it). */
export function roveOgImage(title: string, subtitle?: string) {
  const query = new URLSearchParams({ title: title.slice(0, 90), ...(subtitle ? { subtitle: subtitle.slice(0, 120) } : {}) });
  return `${roveOrigin()}/api/rove-og?${query.toString()}`;
}

/** One page's metadata: title, description, canonical/hreflang, Open Graph and Twitter. */
export function roveMetadata(input: { title: string; description: string; path: string; locale: string; section: Section; image?: string | null; noindex?: boolean; ogTitle?: string }): Metadata {
  const image = input.image || roveOgImage(input.ogTitle || input.title, input.description);
  const url = roveAbsolute(input.path, input.locale);
  return {
    title: { absolute: input.title },
    description: input.description,
    applicationName: ROVE_NAME,
    alternates: roveAlternates(input.path, input.locale, input.section),
    openGraph: { type: "website", siteName: ROVE_NAME, title: input.ogTitle || input.title, description: input.description, url, locale: input.locale, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: input.ogTitle || input.title, description: input.description, images: [image] },
    ...(input.noindex ? { robots: { index: false, follow: true } } : {})
  };
}

export const ROVE_ORG_ID = () => `${roveOrigin()}/#organization`;
export const ROVE_SITE_ID = () => `${roveOrigin()}/#website`;

/** Organization (Rove, run by RoveHQ) and WebSite with its search: on every Rove page (the layout). */
export function roveSiteWideLd(locale: string) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": ROVE_ORG_ID(),
      name: ROVE_NAME,
      url: `${roveOrigin()}/`,
      logo: { "@type": "ImageObject", url: `${roveOrigin()}/icon.svg` },
      parentOrganization: { "@type": "Organization", name: "RoveHQ", url: roveHqSite() }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": ROVE_SITE_ID(),
      name: ROVE_NAME,
      url: `${roveOrigin()}/`,
      inLanguage: locale,
      publisher: { "@id": ROVE_ORG_ID() },
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${roveOrigin()}/search?place={search_term_string}` },
        "query-input": "required name=search_term_string"
      }
    }
  ];
}

export function breadcrumbLd(items: Array<{ name: string; path: string; locale?: string }>, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: roveAbsolute(item.path, item.locale || locale) }))
  };
}

export function itemListLd(name: string, items: Array<{ name: string; path: string }>, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, url: roveAbsolute(item.path, locale) }))
  };
}

export function articleLd(input: { title: string; description: string; path: string; published: string; updated: string; image: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.title,
    description: input.description,
    mainEntityOfPage: roveAbsolute(input.path),
    image: [input.image],
    datePublished: schemaDateTime(input.published),
    dateModified: schemaDateTime(input.updated),
    inLanguage: "en",
    author: { "@id": ROVE_ORG_ID(), "@type": "Organization", name: ROVE_NAME, url: `${roveOrigin()}/` },
    publisher: { "@id": ROVE_ORG_ID(), "@type": "Organization", name: ROVE_NAME, logo: { "@type": "ImageObject", url: `${roveOrigin()}/icon.svg` } }
  };
}

/** A JSON-LD script's text, safe inside <script> (no "</script>" can close it early). */
export function ldText(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
