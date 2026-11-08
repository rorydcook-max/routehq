import { NextResponse } from "next/server";
import { publicBookingSettings } from "@/lib/public-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PHOTO_WIDTHS } from "@/lib/photo-url";
import { vehiclePhotoRefs } from "@/lib/vehicle-photos";

/**
 * Public vehicle and website photos at one stable, cacheable address (task build-img, 8 Nov 2026; first made for
 * rove.rent on 7 Nov). Signed storage links expire after hours, so shared links and cached pages showed broken
 * pictures; this address never changes and the image is sent from here, resized.
 *
 *   /api/rove-photo/<vehicle>/<document>?v=…  a vehicle photo (v changes when the file does): cached for a year
 *   /api/rove-photo/<vehicle>/<n>             its nth photo in the order set on the vehicle page: cached for an hour
 *   /api/rove-photo/site/<org>/branding/site/… an image uploaded for the business's website
 *
 * Only photos the public can already see: a vehicle that isn't deleted or parked, of a business whose booking page
 * is on (the website, rove.rent and the partner network all show that page's vehicles); a website image named in
 * the business's site. Anything else is "not found".
 *
 * ?w= resizes (to the next width up in PHOTO_WIDTHS, never larger than the original) and sends WebP; &f=jpg sends
 * JPEG for share previews (some apps don't show WebP).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// s-maxage so Vercel's CDN keeps each size too (it ignores max-age), and only the first request for a size is resized.
const YEAR = "public, max-age=31536000, s-maxage=31536000, immutable";
const HOUR = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";
const notFound = () => new NextResponse("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });

async function publicOrganization(admin: any, organizationId: string) {
  const { data: organization } = await admin.from("organizations").select("id, settings, deleted_at").eq("id", organizationId).maybeSingle();
  if (!organization || organization.deleted_at || !publicBookingSettings(organization.settings).enabled) return null;
  return organization;
}

export async function GET(request: Request, { params }: { params: Promise<{ parts: string[] }> }) {
  const { parts } = await params;
  const admin = createSupabaseAdminClient() as any;
  let bucket = "documents";
  let path: string | null = null;
  let cache = YEAR;

  if (parts[0] === "site") {
    // A website image: <org>/branding/site/<file>, named in the business's published (or draft) site.
    path = parts.slice(1).map((part) => decodeURIComponent(part)).join("/");
    const organizationId = path.split("/")[0];
    if (!UUID.test(organizationId) || !/^[0-9a-f-]{36}\/branding\/[\w./-]{1,200}$/i.test(path) || path.includes("..")) return notFound();
    if (!(await publicOrganization(admin, organizationId))) return notFound();
    const { data: site } = await admin.from("booking_sites").select("draft, published").eq("organization_id", organizationId).maybeSingle();
    const named = [site?.published?.images?.hero, site?.published?.images?.about, site?.draft?.images?.hero, site?.draft?.images?.about].some((ref: any) => ref?.kind === "upload" && ref.path === path);
    if (!named) return notFound();
    bucket = "branding";
  } else {
    const [vehicleId, which] = parts;
    if (parts.length !== 2 || !UUID.test(vehicleId || "")) return notFound();
    const { data: vehicle } = await admin.from("vehicles").select("id, organization_id, deleted_at, parked_at").eq("id", vehicleId).maybeSingle();
    if (!vehicle || vehicle.deleted_at || vehicle.parked_at) return notFound();
    if (!(await publicOrganization(admin, vehicle.organization_id))) return notFound();
    const refs = (await vehiclePhotoRefs(admin, vehicle.organization_id, 30, vehicleId).catch(() => new Map())).get(vehicleId) || [];
    if (UUID.test(which || "")) {
      path = refs.find((ref: { id: string }) => ref.id === which)?.path || null;
    } else {
      const position = Number(which);
      if (!Number.isInteger(position) || position < 0 || position > 29) return notFound();
      path = refs[position]?.path || null;
      // Which photo is nth changes when the owner reorders them.
      cache = HOUR;
    }
  }
  if (!path) return notFound();

  const { data: blob, error } = await admin.storage.from(bucket).download(path);
  if (error || !blob) return notFound();
  const original = Buffer.from(await blob.arrayBuffer());
  const url = new URL(request.url);
  const wanted = Number(url.searchParams.get("w"));
  const width = Number.isFinite(wanted) && wanted > 0 ? PHOTO_WIDTHS.find((size) => size >= wanted) || PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1] : PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1];
  const jpeg = url.searchParams.get("f") === "jpg";

  let body: Buffer = original;
  let type = blob.type || "image/jpeg";
  try {
    const sharp = (await import("sharp")).default;
    const image = sharp(original, { failOn: "none" }).rotate().resize({ width, withoutEnlargement: true });
    body = jpeg ? await image.jpeg({ quality: 80, mozjpeg: true }).toBuffer() : await image.webp({ quality: 72 }).toBuffer();
    type = jpeg ? "image/jpeg" : "image/webp";
  } catch (problem) {
    // No image library on this server: the original file, still at the stable address.
    console.error("[rove-photo] resize:", problem instanceof Error ? problem.message : problem);
  }
  return new NextResponse(new Uint8Array(body), { status: 200, headers: { "content-type": type, "cache-control": cache, "content-length": String(body.length) } });
}
