import type { Route } from "next";
import { permanentRedirect } from "next/navigation";
import { renterUrl } from "@/lib/booking-address";

export const dynamic = "force-dynamic";

/**
 * The old directory search (rovehq.app/rent): Rove's own search page on rove.rent now (task "roverent", 7 Nov 2026,
 * app/(rove)/rove/[locale]/search). Same question carried over; with none, Rove's home page.
 * Each business's booking page stays at /rent/<slug>.
 */
export default async function DirectoryRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["place", "from", "to", "kind", "lat", "lng", "monthly"]) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value.slice(0, 80));
  }
  const search = query.toString();
  permanentRedirect((search ? `${renterUrl()}/search?${search}` : `${renterUrl()}/`) as Route);
}
