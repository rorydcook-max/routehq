import { PLANS } from "@/lib/plans";
import { localPrice } from "@/lib/plan-currency";
import { siteOrigin, siteUrl } from "@/lib/site/seo";

/**
 * Structured data (schema.org JSON-LD) for RoveHQ's website (SEO, 7 Nov 2026). The layout puts Organization and
 * WebSite on every page; pages add SoftwareApplication (home, pricing, the vehicle pages), FAQPage where they show
 * questions, and BreadcrumbList on inner pages. No ratings or reviews: we have none to show.
 */

/** Our time zone: content dates (YYYY-MM-DD) are days in Thailand. */
const CONTENT_TZ = "+07:00";

/**
 * A content date as a full ISO 8601 date-time with a time zone, as Google asks for in structured data
 * ("2026-10-20" → "2026-10-20T09:00:00+07:00"). A value that already has a time and zone is kept; anything
 * unreadable gives undefined, so the property is left out rather than invalid.
 */
export function schemaDateTime(value: string | null | undefined): string | undefined {
  const text = String(value || "").trim();
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Number.isNaN(Date.parse(`${text}T00:00:00Z`)) ? undefined : `${text}T09:00:00${CONTENT_TZ}`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export const ORGANIZATION_ID = () => `${siteOrigin()}/#organization`;
export const WEBSITE_ID = () => `${siteOrigin()}/#website`;
export const SOFTWARE_ID = () => `${siteOrigin()}/#software`;
const LOGO = () => `${siteOrigin()}/rovehq-logo.svg`;

/** RoveHQ, the company, for publisher / provider properties and the site-wide block. */
export function organizationLd() {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID(),
    name: "RoveHQ",
    url: siteOrigin(),
    logo: { "@type": "ImageObject", url: LOGO() }
  };
}

/** Organization and WebSite: on every website page (the layout). */
export function siteWideLd(locale: string) {
  return [
    { "@context": "https://schema.org", ...organizationLd() },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": WEBSITE_ID(),
      name: "RoveHQ",
      url: siteUrl("/", locale),
      inLanguage: locale,
      publisher: { "@id": ORGANIZATION_ID() }
    }
  ];
}

/** The plans as schema.org offers, in US dollars (the same rounding the pricing page shows). */
export function planOffersLd() {
  return PLANS.map((plan) => ({
    "@type": "Offer",
    name: plan.id.charAt(0).toUpperCase() + plan.id.slice(1),
    price: localPrice(plan.monthly, "USD"),
    priceCurrency: "USD",
    url: siteUrl("/pricing", "en"),
    ...(plan.monthly > 0 ? { priceSpecification: { "@type": "UnitPriceSpecification", price: localPrice(plan.monthly, "USD"), priceCurrency: "USD", unitCode: "MON", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } } } : {})
  }));
}

/** RoveHQ, the product: SoftwareApplication with the real plan prices. No aggregateRating. */
export function softwareApplicationLd({ description, locale, url }: { description: string; locale: string; url?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": SOFTWARE_ID(),
    name: "RoveHQ",
    url: url || siteUrl("/", locale),
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Vehicle rental management",
    operatingSystem: "Web, Android, iOS",
    description,
    inLanguage: locale,
    offers: planOffersLd(),
    publisher: { "@id": ORGANIZATION_ID() }
  };
}

/** BreadcrumbList from Home to this page. `path`s are website paths without a language; the last item is the page. */
export function breadcrumbLd(items: Array<{ name: string; path: string; locale?: string }>, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: siteUrl(item.path, item.locale || locale) }))
  };
}

/** FAQPage from the questions a page shows. */
export function faqLd(items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } }))
  };
}
