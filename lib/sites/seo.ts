import { socialHref } from "@/lib/sites/format";
import { SOCIAL_KEYS, type SiteConfig } from "@/lib/sites/config";
import type { SiteData } from "@/lib/sites/types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * schema.org AutoRental for a business's website, from real data only: name, address, phone, email, opening hours,
 * social profiles, price range from its vehicles, and a rating only when it has published reviews.
 */
export function siteJsonLd(data: SiteData, config: SiteConfig, input: { url: string; description: string; image: string | null }) {
  const sameAs = SOCIAL_KEYS.filter((key) => key !== "whatsapp")
    .map((key) => socialHref(key, config.social[key] || data.business.social[key] || ""))
    .filter(Boolean);
  const prices = data.vehicles.map((vehicle) => vehicle.dailyRate || vehicle.weeklyRate || vehicle.monthlyRate).filter((value) => value > 0);
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    name: data.business.name,
    url: input.url,
    description: input.description
  };
  if (input.image) ld.image = input.image;
  if (data.business.logoUrl && /^https:\/\//.test(data.business.logoUrl)) ld.logo = data.business.logoUrl;
  if (data.business.phone) ld.telephone = data.business.phone;
  if (data.business.email) ld.email = data.business.email;
  if (data.business.address || data.business.place) ld.address = { "@type": "PostalAddress", streetAddress: data.business.address || undefined, addressLocality: data.business.place || undefined };
  if (data.business.currency) ld.currenciesAccepted = data.business.currency;
  if (prices.length) ld.priceRange = `${data.business.currency} ${Math.min(...prices)}–${Math.max(...prices)}`;
  if (sameAs.length) ld.sameAs = sameAs;
  if (config.hours) {
    ld.openingHoursSpecification = config.hours.flatMap((day, index) => (day ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${DAYS[index]}`, opens: day.open, closes: day.close }] : []));
  }
  if (data.reviewStats.count > 0) ld.aggregateRating = { "@type": "AggregateRating", ratingValue: Number(data.reviewStats.average.toFixed(1)), reviewCount: data.reviewStats.count, bestRating: 5, worstRating: 1 };
  return ld;
}

/** JSON for a <script type="application/ld+json">, safe to put in the page. */
export function ldScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
