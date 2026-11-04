import { renterUrl } from "@/lib/booking-address";
import { listedBusinessesForSitemap } from "@/lib/directory";

/**
 * rove.rent/sitemap.xml (the proxy serves it from here on the renter domain): the search page and the short-address
 * booking page of every business listed in the directory. Rebuilt at most hourly.
 */
export const revalidate = 3600;

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET() {
  const origin = renterUrl();
  let businesses: Awaited<ReturnType<typeof listedBusinessesForSitemap>> = [];
  try {
    businesses = await listedBusinessesForSitemap();
  } catch {
    businesses = [];
  }
  const entries = [
    `<url><loc>${escape(`${origin}/`)}</loc><priority>1</priority></url>`,
    ...businesses.map(
      (business) =>
        `<url><loc>${escape(`${origin}/${business.slug}`)}</loc>${business.updatedAt ? `<lastmod>${new Date(business.updatedAt).toISOString()}</lastmod>` : ""}<priority>0.8</priority></url>`
    )
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
