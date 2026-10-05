"use server";

import { readFileAsJson, visionProvider } from "@/lib/ai-vision";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Reads a customer's passport or driving licence photo so their booking form
 * can fill itself in. Called from the customer's booking page with the link's
 * token; nothing here trusts the browser beyond that token.
 *
 * The customer always sees and can correct what was read before they sign.
 */

export type IdentityFields = {
  fullName: string | null;
  /** ISO 3166-1 alpha-2, for the nationality picker. */
  nationalityCode: string | null;
  dateOfBirth: string | null;
  passportNumber: string | null;
  licenceNumber: string | null;
  licenceExpiry: string | null;
  licenceCountry: string | null;
};

export type IdentityRead = { ok: true; fields: IdentityFields } | { ok: false; reason: "unreadable" | "unavailable" };

// A link can read a handful of photos (retakes included); after that the customer types.
const MAX_READS_PER_LINK = 12;
const MAX_BYTES = 3 * 1024 * 1024;

const text = (value: unknown, max = 80) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
const isoDate = (value: unknown) => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null);
const countryCode = (value: unknown) => (typeof value === "string" && /^[A-Za-z]{2}$/.test(value.trim()) ? value.trim().toUpperCase() : null);

export async function readIdentityDocument(formData: FormData): Promise<IdentityRead> {
  try {
    const token = String(formData.get("token") || "");
    const kind = String(formData.get("kind") || "");
    const file = formData.get("file");
    if (!token || (kind !== "passport" && kind !== "driver_license")) return { ok: false, reason: "unavailable" };
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES || !file.type.startsWith("image/")) return { ok: false, reason: "unavailable" };

    if (!visionProvider()) return { ok: false, reason: "unavailable" };

    const admin = createSupabaseAdminClient() as any;
    const { data: link } = await admin.from("booking_links").select("id, status, booking_data").eq("token", token).maybeSingle();
    if (!link || ["cancelled", "expired"].includes(String(link.status || ""))) return { ok: false, reason: "unavailable" };
    const bookingData = (link.booking_data || {}) as Record<string, unknown>;
    const reads = Number(bookingData.ocr_reads || 0);
    if (reads >= MAX_READS_PER_LINK) return { ok: false, reason: "unavailable" };

    const wanted =
      kind === "passport"
        ? "is_document (true only if this is a passport or a national identity card with readable text), full_name (given names then family name, in Latin letters, normal capitalisation such as \"Anna Maria Schmidt\"), nationality (the adjective in English, such as \"German\"), nationality_country_code (ISO 3166-1 alpha-2), date_of_birth (YYYY-MM-DD), document_number, expiry_date (YYYY-MM-DD)"
        : "is_document (true only if this is a driving licence or international driving permit with readable text), full_name (given names then family name, in Latin letters, normal capitalisation), licence_number, expiry_date (YYYY-MM-DD, or null if the licence shows no expiry), issuing_country (in English), date_of_birth (YYYY-MM-DD)";
    const parsed = await readFileAsJson({
      system:
        "You read identity documents for a vehicle rental form. Copy what is printed; never guess, complete or correct anything. Use null for any field you cannot read clearly. If the photo is blurred, cropped, a plain colour, or not the document asked for, is_document is false and every other field is null.",
      prompt: `Return JSON with: ${wanted}.`,
      bytes: Buffer.from(await file.arrayBuffer()),
      mediaType: file.type || "image/jpeg",
      maxTokens: 400
    });
    const fields: IdentityFields = {
      fullName: text(parsed.full_name),
      nationalityCode: kind === "passport" ? countryCode(parsed.nationality_country_code) : null,
      dateOfBirth: isoDate(parsed.date_of_birth),
      passportNumber: kind === "passport" ? text(parsed.document_number, 40) : null,
      licenceNumber: kind === "driver_license" ? text(parsed.licence_number, 40) : null,
      licenceExpiry: kind === "driver_license" ? isoDate(parsed.expiry_date) : null,
      licenceCountry: kind === "driver_license" ? text(parsed.issuing_country, 60) : null
    };
    const read = parsed.is_document === true && Object.values(fields).some(Boolean);

    // Count every attempt; keep what was read so the submit step doesn't read the same photo again.
    const next: Record<string, unknown> = { ...bookingData, ocr_reads: reads + 1 };
    if (read && kind === "passport") {
      next.ocr_passport_read = true;
      if (fields.passportNumber) next.ocr_passport_number = fields.passportNumber;
      if (text(parsed.nationality)) next.ocr_nationality = text(parsed.nationality);
    }
    if (read && kind === "driver_license") {
      next.ocr_licence_read = true;
      if (fields.licenceNumber) next.ocr_licence_number = fields.licenceNumber;
      if (fields.licenceCountry) next.ocr_licence_country = fields.licenceCountry;
      if (fields.licenceExpiry) next.ocr_licence_expiry = fields.licenceExpiry;
    }
    await admin.from("booking_links").update({ booking_data: next }).eq("id", link.id);

    return read ? { ok: true, fields } : { ok: false, reason: "unreadable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
