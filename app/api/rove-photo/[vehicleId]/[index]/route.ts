import { NextResponse } from "next/server";
import { canBeListed, directorySettings } from "@/lib/directory";
import { publicBookingSettings } from "@/lib/public-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { vehiclePhotoUrls } from "@/lib/vehicle-photos";

/**
 * A listed vehicle's photo for rove.rent (task "roverent", 7 Nov 2026): /api/rove-photo/<vehicle>/<n> hands out a
 * fresh signed link to its nth photo (in the order set on the vehicle page). Cached pages, share previews and
 * search engines keep one stable address while the signed links behind it expire. Only vehicles a renter could
 * find on Rove (listed business, online booking on, not parked or deleted); anything else is "not found".
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_FOR = 6 * 3600;

export async function GET(_request: Request, { params }: { params: Promise<{ vehicleId: string; index: string }> }) {
  const { vehicleId, index } = await params;
  const position = Number(index);
  if (!UUID.test(vehicleId) || !Number.isInteger(position) || position < 0 || position > 11) return new NextResponse("Not found", { status: 404 });
  const admin = createSupabaseAdminClient() as any;
  const { data: vehicle } = await admin.from("vehicles").select("id, organization_id, deleted_at, parked_at").eq("id", vehicleId).maybeSingle();
  if (!vehicle || vehicle.deleted_at || vehicle.parked_at) return new NextResponse("Not found", { status: 404 });
  const { data: organization } = await admin
    .from("organizations")
    .select("id, settings, subscription_tier, subscription_status, directory_addon, deleted_at")
    .eq("id", vehicle.organization_id)
    .maybeSingle();
  if (!organization || organization.deleted_at || !canBeListed(organization) || !directorySettings(organization.settings).enabled || !publicBookingSettings(organization.settings).enabled) {
    return new NextResponse("Not found", { status: 404 });
  }
  const photos = await vehiclePhotoUrls(admin, organization.id, position + 1, SIGNED_FOR, vehicleId).catch(() => new Map<string, string[]>());
  const url = photos.get(vehicleId)?.[position];
  if (!url) return new NextResponse("Not found", { status: 404 });
  // Cached well inside the signed link's life, so a cached redirect never points at an expired link.
  return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "public, max-age=1800, s-maxage=3000" } });
}
