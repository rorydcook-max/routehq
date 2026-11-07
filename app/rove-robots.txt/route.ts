import { renterUrl } from "@/lib/booking-address";

/**
 * rove.rent/robots.txt (the proxy serves it from here on the renter domain): the search page and businesses' booking
 * pages are open; a customer's own booking, change and payment links are not. Points at rove.rent's own sitemap.
 */
export const dynamic = "force-static";

export function GET() {
  const origin = renterUrl();
  // Vehicle photos and share pictures (/api/rove-photo/, /api/rove-og) are open: link previews and image search use them.
  const body = ["User-Agent: *", "Allow: /", "Allow: /api/rove-photo/", "Allow: /api/rove-og", "Disallow: /api/", "Disallow: /book/", "Disallow: /amend/", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
