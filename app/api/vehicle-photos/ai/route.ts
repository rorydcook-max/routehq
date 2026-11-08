import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { kindFromCategory } from "@/lib/vehicle-groups";
import { AiImageError, imageProviders, makeImage } from "@/lib/ai-image";
import { aiImagesLeft, canMakeAiImages, recordAiImage } from "@/lib/ai-image-quota";
import { anglesFor, ENHANCE_PROMPT, generatePrompt, missingForGenerate, toPlatformPhoto, type Angle, type VehicleDetails } from "@/lib/ai-vehicle-photos";

/**
 * AI vehicle photos (task build-img, 8 Nov 2026), for the photo manager on the vehicle page and the Add vehicle form.
 * One image per call, so the page can show progress through a set. POST JSON { action, ... }:
 *
 *   status    { vehicleId? }                   set up? what's missing for a generated set? images left this period
 *   generate  { vehicleId, angle }             one view of a generated set, kept aside as a preview
 *             { details, angle }               (Add vehicle form, before the vehicle exists) the image itself, as a data URL
 *   enhance   { vehicleId, documentId }        an enhanced copy of one photo (from its original), as a preview
 *             { image }                        (Add vehicle form) a photo not stored yet, as a data URL; the result likewise
 *   keep      { vehicleId, path, documentId? } a preview becomes a photo (generated), or replaces the photo (enhanced; the original is kept)
 *   discard   { vehicleId, path }              a preview thrown away
 *   revert    { vehicleId, documentId }        an enhanced photo back to its original
 *
 * Previews are files under <org>/vehicle/<id>/photos/ai-…; nothing shows anywhere until kept. Generated photos carry
 * extracted_data.ai_generated (the "AI image" label); enhanced ones carry enhanced + original_path.
 */
export const maxDuration = 120;

type Body = { action?: string; vehicleId?: string; documentId?: string; path?: string; angle?: string; details?: Partial<VehicleDetails>; image?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ANGLES: Angle[] = ["front", "side", "rear", "interior", "detail"];

const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ error, ...extra }, { status });

async function loadVehicle(admin: any, organizationId: string, vehicleId: string) {
  if (!UUID.test(vehicleId)) return null;
  const { data } = await admin
    .from("vehicles")
    .select("id, organization_id, make, model, trim, year, color, registration_number, specifications, deleted_at, vehicle_categories(code, name)")
    .eq("id", vehicleId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data && !data.deleted_at ? data : null;
}

function detailsOf(vehicle: any, country: string | null): VehicleDetails {
  const specs = vehicle.specifications && typeof vehicle.specifications === "object" ? vehicle.specifications : {};
  return {
    make: String(vehicle.make || ""),
    model: String(vehicle.model || ""),
    year: vehicle.year ? Number(vehicle.year) : null,
    color: String(vehicle.color || ""),
    trim: vehicle.trim || null,
    body: String(specs.body_type || specs.body_class || "") || null,
    plate: vehicle.registration_number || null,
    kind: kindFromCategory(vehicle.vehicle_categories),
    country
  };
}

const pendingPrefix = (organizationId: string, vehicleId: string) => `${organizationId}/vehicle/${vehicleId}/photos/ai-`;

async function photoDocument(admin: any, organizationId: string, vehicleId: string, documentId: string) {
  if (!UUID.test(documentId)) return null;
  const { data } = await admin
    .from("documents")
    .select("id, storage_path, mime_type, extracted_data")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .eq("owner_type", "vehicle")
    .eq("owner_id", vehicleId)
    .eq("category", "vehicle_photo")
    .is("deleted_at", null)
    .maybeSingle();
  return data || null;
}

async function storePreview(admin: any, path: string, photo: { bytes: Buffer; mediaType: string }) {
  const { error } = await admin.storage.from("documents").upload(path, photo.bytes, { contentType: photo.mediaType, upsert: false });
  if (error) throw new Error(error.message);
  const { data: signed } = await admin.storage.from("documents").createSignedUrl(path, 3600);
  return signed?.signedUrl as string | undefined;
}

function errorResponse(error: unknown) {
  if (error instanceof AiImageError) return fail(error.reason, error.reason === "no_provider" ? 503 : error.reason === "refused" ? 422 : 502);
  console.error("[vehicle-photos/ai]", error instanceof Error ? error.message : error);
  return fail("failed", 500);
}

export async function POST(request: Request) {
  const membership = await getCurrentMembership().catch(() => null);
  if (!membership) return fail("signin", 401);
  if (/view|read/i.test(String(membership.role))) return fail("forbidden", 403);
  const body = (await request.json().catch(() => ({}))) as Body;
  const admin = createSupabaseAdminClient() as any;
  const organizationId = membership.organizationId;
  const { data: organization } = await admin.from("organizations").select("country_code").eq("id", organizationId).maybeSingle();
  const country = (organization?.country_code as string | null) || null;
  const vehicle = body.vehicleId ? await loadVehicle(admin, organizationId, body.vehicleId) : null;
  if (body.vehicleId && !vehicle) return fail("not_found", 404);

  try {
    switch (body.action) {
      case "status": {
        const details = vehicle ? detailsOf(vehicle, country) : null;
        return NextResponse.json({
          configured: imageProviders().length > 0,
          missing: details ? missingForGenerate(details) : [],
          angles: anglesFor(details?.kind || String(body.details?.kind || "car")),
          left: await aiImagesLeft(admin, organizationId)
        });
      }

      case "generate": {
        const angle = ANGLES.includes(body.angle as Angle) ? (body.angle as Angle) : null;
        if (!angle) return fail("bad_request");
        const details: VehicleDetails = vehicle
          ? detailsOf(vehicle, country)
          : {
              make: String(body.details?.make || "").slice(0, 60),
              model: String(body.details?.model || "").slice(0, 80),
              year: Number(body.details?.year) || null,
              color: String(body.details?.color || "").slice(0, 40),
              trim: String(body.details?.trim || "").slice(0, 80) || null,
              body: String(body.details?.body || "").slice(0, 40) || null,
              plate: String(body.details?.plate || "").slice(0, 16) || null,
              kind: String(body.details?.kind || "car").slice(0, 20),
              country
            };
        const missing = missingForGenerate(details);
        if (missing.length) return fail("missing", 400, { missing });
        const allowance = await canMakeAiImages(admin, organizationId, 1);
        if (!allowance.ok) return fail("quota", 429, { left: allowance.left });
        const made = await makeImage({ prompt: generatePrompt(details, angle) });
        await recordAiImage(admin, { organizationId, vehicleId: vehicle?.id || null, kind: "generate", provider: made.provider, model: made.model, userId: membership.userId });
        const photo = await toPlatformPhoto(made.bytes);
        if (!vehicle) return NextResponse.json({ dataUrl: `data:${photo.mediaType};base64,${photo.bytes.toString("base64")}`, angle, left: await aiImagesLeft(admin, organizationId) });
        const path = `${pendingPrefix(organizationId, vehicle.id)}${Date.now()}-${crypto.randomUUID()}-${angle}.${photo.extension}`;
        const url = await storePreview(admin, path, photo);
        return NextResponse.json({ path, url, angle, left: await aiImagesLeft(admin, organizationId) });
      }

      case "enhance": {
        // The Add vehicle form sends the photo itself (it isn't stored yet) and gets the result back as a data URL.
        const draft = !vehicle ? /^data:(image\/[\w.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.image || "")) : null;
        if (!vehicle && !draft) return fail("bad_request");
        const document = vehicle ? await photoDocument(admin, organizationId, vehicle.id, String(body.documentId || "")) : null;
        if (vehicle && !document) return fail("not_found", 404);
        if (document?.extracted_data?.ai_generated === true) return fail("generated");
        const allowance = await canMakeAiImages(admin, organizationId, 1);
        if (!allowance.ok) return fail("quota", 429, { left: allowance.left });
        let bytes: Buffer;
        let mediaType: string;
        if (draft) {
          bytes = Buffer.from(draft[2], "base64");
          mediaType = draft[1];
        } else {
          // Always from the original photo, so enhancing twice never builds on an earlier edit.
          const source = String(document.extracted_data?.original_path || document.storage_path);
          const { data: blob, error: downloadError } = await admin.storage.from("documents").download(source);
          if (downloadError || !blob) return fail("not_found", 404);
          bytes = Buffer.from(await blob.arrayBuffer());
          mediaType = blob.type || document.mime_type || "image/jpeg";
        }
        try {
          // A JPEG within 2000px: every provider reads it (HEIC and very large files aren't always accepted).
          const sharp = (await import("sharp")).default;
          bytes = await sharp(bytes, { failOn: "none" }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
          mediaType = "image/jpeg";
        } catch {
          // Sent as it is.
        }
        const made = await makeImage({ prompt: ENHANCE_PROMPT, image: { bytes, mediaType } });
        await recordAiImage(admin, { organizationId, vehicleId: vehicle?.id || null, kind: "enhance", provider: made.provider, model: made.model, userId: membership.userId });
        const photo = await toPlatformPhoto(made.bytes);
        if (!vehicle || !document) return NextResponse.json({ dataUrl: `data:${photo.mediaType};base64,${photo.bytes.toString("base64")}`, left: await aiImagesLeft(admin, organizationId) });
        const path = `${pendingPrefix(organizationId, vehicle.id)}${Date.now()}-${crypto.randomUUID()}-enhanced.${photo.extension}`;
        const url = await storePreview(admin, path, photo);
        return NextResponse.json({ path, url, documentId: document.id, left: await aiImagesLeft(admin, organizationId) });
      }

      case "keep": {
        const path = String(body.path || "");
        if (!vehicle || !path.startsWith(pendingPrefix(organizationId, vehicle.id)) || path.includes("..")) return fail("bad_request");
        const { data: used } = await admin.from("documents").select("id").eq("storage_path", path).is("deleted_at", null).limit(1);
        if (used?.length) return NextResponse.json({ ok: true });
        const { data: file } = await admin.storage.from("documents").download(path);
        if (!file) return fail("not_found", 404);
        const size = (await file.arrayBuffer()).byteLength;
        const mediaType = path.endsWith(".webp") ? "image/webp" : "image/png";

        if (body.documentId) {
          // Enhanced: the photo keeps its place; the original stays in storage so it can be put back.
          const document = await photoDocument(admin, organizationId, vehicle.id, body.documentId);
          if (!document) return fail("not_found", 404);
          const extracted = document.extracted_data && typeof document.extracted_data === "object" ? document.extracted_data : {};
          const originalPath = extracted.original_path || document.storage_path;
          const originalType = extracted.original_path ? extracted.original_mime_type || null : document.mime_type || null;
          // An earlier enhanced copy (not the original) is replaced: its file goes.
          if (extracted.original_path && document.storage_path !== extracted.original_path) await admin.storage.from("documents").remove([document.storage_path]);
          const { error } = await admin
            .from("documents")
            .update({ storage_path: path, mime_type: mediaType, size_bytes: size, extracted_data: { ...extracted, enhanced: true, original_path: originalPath, original_mime_type: originalType } })
            .eq("id", document.id)
            .eq("organization_id", organizationId);
          if (error) throw new Error(error.message);
        } else {
          // Generated: a new photo after the others.
          const { data: existing } = await admin
            .from("documents")
            .select("extracted_data")
            .eq("organization_id", organizationId)
            .eq("owner_type", "vehicle")
            .eq("owner_id", vehicle.id)
            .eq("category", "vehicle_photo")
            .is("deleted_at", null);
          const rows = (existing || []) as any[];
          const next = Math.max(rows.length, rows.reduce((top, row) => (Number.isFinite(Number(row.extracted_data?.vehicle_photo_order)) ? Math.max(top, Number(row.extracted_data.vehicle_photo_order) + 1) : top), 0));
          const angle = /-(front|side|rear|interior|detail)\.\w+$/.exec(path)?.[1] || null;
          const { error } = await admin.from("documents").insert({
            organization_id: organizationId,
            owner_type: "vehicle",
            owner_id: vehicle.id,
            storage_bucket: "documents",
            storage_path: path,
            file_name: `ai-${angle || "photo"}.${path.split(".").pop()}`,
            mime_type: mediaType,
            size_bytes: size,
            category: "vehicle_photo",
            ocr_status: "not_started",
            extracted_data: { vehicle_photo_order: next, ai_generated: true, ai_angle: angle },
            uploaded_by: membership.userId
          });
          if (error) throw new Error(error.message);
        }
        revalidatePath("/fleet");
        revalidatePath(`/fleet/${vehicle.id}`);
        return NextResponse.json({ ok: true });
      }

      case "discard": {
        const path = String(body.path || "");
        if (!vehicle || !path.startsWith(pendingPrefix(organizationId, vehicle.id)) || path.includes("..")) return fail("bad_request");
        const { data: used } = await admin.from("documents").select("id").eq("storage_path", path).is("deleted_at", null).limit(1);
        // A preview nobody kept: its file goes. A kept photo is removed from the photo manager, not here.
        if (!used?.length) await admin.storage.from("documents").remove([path]);
        return NextResponse.json({ ok: true });
      }

      case "revert": {
        if (!vehicle) return fail("bad_request");
        const document = await photoDocument(admin, organizationId, vehicle.id, String(body.documentId || ""));
        const extracted = document?.extracted_data && typeof document.extracted_data === "object" ? document.extracted_data : {};
        if (!document || !extracted.original_path) return fail("not_found", 404);
        const { enhanced: _enhanced, original_path: _original, original_mime_type: originalType, ...rest } = extracted;
        const { error } = await admin
          .from("documents")
          .update({ storage_path: extracted.original_path, mime_type: originalType || "image/jpeg", extracted_data: rest })
          .eq("id", document.id)
          .eq("organization_id", organizationId);
        if (error) throw new Error(error.message);
        if (document.storage_path !== extracted.original_path) await admin.storage.from("documents").remove([document.storage_path]);
        revalidatePath("/fleet");
        revalidatePath(`/fleet/${vehicle.id}`);
        return NextResponse.json({ ok: true });
      }

      default:
        return fail("bad_request");
    }
  } catch (error) {
    return errorResponse(error);
  }
}
