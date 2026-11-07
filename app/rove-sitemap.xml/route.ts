import { renterUrl } from "@/lib/booking-address";
import { listedBusinessesForSitemap } from "@/lib/directory";
import { COUNTRIES, DESTINATIONS, destinationPath } from "@/lib/rove/destinations";
import { GUIDES } from "@/lib/rove/guides";
import { loadMarket } from "@/lib/rove/market";
import { ROVE_LOCALES, roveHasLocale, roveHref } from "@/lib/rove/paths";

/**
 * rove.rent/sitemap.xml (the proxy serves it from here on the renter domain): Rove's own pages (home, countries,
 * destinations, guides and every listed vehicle; each with its other languages as hreflang alternates) and the
 * short-address booking page of every business listed in the directory. Rebuilt at most hourly.
 * Search results are left out: they're followed but not indexed.
 */
export const revalidate = 3600;

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET() {
  const origin = renterUrl();
  const absolute = (path: string, locale = "en") => {
    const href = roveHref(path, locale);
    return `${origin}${href === "/" ? "/" : href}`;
  };
  /** One page and its language versions (hreflang), all listed so each is crawled. */
  const page = (path: string, section: Parameters<typeof roveHasLocale>[0], priority: string, lastmod?: string | null) => {
    const locales = ROVE_LOCALES.filter((locale) => roveHasLocale(section, locale));
    const links = locales.length > 1 ? [...locales.map((locale) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${escape(absolute(path, locale))}"/>`), `<xhtml:link rel="alternate" hreflang="x-default" href="${escape(absolute(path))}"/>`].join("") : "";
    return locales.map((locale) => `<url><loc>${escape(absolute(path, locale))}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${links}<priority>${locale === "en" ? priority : "0.5"}</priority></url>`);
  };

  let businesses: Awaited<ReturnType<typeof listedBusinessesForSitemap>> = [];
  let vehicleIds: string[] = [];
  try {
    const [listed, market] = await Promise.all([listedBusinessesForSitemap(), loadMarket()]);
    businesses = listed;
    vehicleIds = market.vehicles.map((vehicle) => vehicle.id);
  } catch {
    businesses = [];
  }
  const entries = [
    ...page("/", "home", "1"),
    ...Object.keys(COUNTRIES).flatMap((country) => page(`/${country}`, "country", "0.7")),
    ...DESTINATIONS.flatMap((destination) => page(destinationPath(destination), "destination", "0.9")),
    ...page("/guides", "guides", "0.6"),
    ...GUIDES.flatMap((guide) => page(`/guides/${guide.slug}`, "guide", "0.7", `${guide.updated}T00:00:00+07:00`)),
    ...vehicleIds.flatMap((id) => page(`/vehicles/${id}`, "vehicle", "0.6")),
    ...businesses.map(
      (business) =>
        `<url><loc>${escape(`${origin}/${business.slug}`)}</loc>${business.updatedAt ? `<lastmod>${new Date(business.updatedAt).toISOString()}</lastmod>` : ""}<priority>0.8</priority></url>`
    )
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
