import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Direct uploads: the browser sends each photo, video or document straight to
 * storage, then submits only the storage paths.
 *
 * Vercel rejects request bodies over 4.5 MB, and a single phone photo can be
 * 5 MB, so files must never travel inside a form submission. The server
 * decides every path (under a prefix it controls) and hands out one-time
 * signed upload URLs; when the form arrives it only accepts paths under that
 * same prefix, and checks each file really is in storage.
 */

export const UPLOAD_BUCKET = "documents";
const MAX_FILES = 20;
// The documents bucket's own limit (Supabase: 50 MB per file on the current plan).
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Where a team member's inspection photos and video go before the inspection is saved. */
export function inspectionUploadPrefix(organizationId: string) {
  return `${organizationId}/inspections/uploads`;
}

/** Where a customer's booking documents go before the booking form is saved. */
export function bookingLinkUploadPrefix(organizationId: string, bookingLinkId: string) {
  return `${organizationId}/booking-links/${bookingLinkId}/uploads`;
}

export type UploadRequest = { field: string; name: string; type: string; size: number };
export type SignedUpload = { field: string; path: string; token: string };
export type PreparedUploads = { uploads: SignedUpload[]; error?: string };
export type UploadedFile = { field: string; path: string; name: string; type: string; size: number };

function safeName(name: string) {
  return String(name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "upload";
}

function safeField(field: string) {
  return String(field || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60);
}

/** Signed upload URLs for files the browser is about to send, all under `prefix`. */
export async function createSignedUploads(prefix: string, files: UploadRequest[]): Promise<SignedUpload[]> {
  if (!Array.isArray(files) || files.length === 0) return [];
  if (files.length > MAX_FILES) throw new Error(`Too many files (${files.length}). The limit is ${MAX_FILES}.`);
  const admin = createSupabaseAdminClient() as any;
  const batch = crypto.randomUUID();
  const signed: SignedUpload[] = [];
  for (const file of files) {
    const field = safeField(file.field);
    if (!field) throw new Error("Each upload needs a field name.");
    if (!(file.size > 0)) throw new Error(`${file.name || "A file"} is empty.`);
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        String(file.type).startsWith("video/")
          ? "The video is larger than 50 MB. Record a shorter walkaround (about 30 seconds) or take the photos instead."
          : `${file.name || "A file"} is larger than 50 MB.`
      );
    }
    if (!/^(image|video)\//.test(file.type) && file.type !== "application/pdf") {
      throw new Error(`${file.name || "A file"} is not a photo, video or PDF.`);
    }
    const path = `${prefix}/${batch}/${field}-${safeName(file.name)}`;
    const { data, error } = await admin.storage.from(UPLOAD_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) throw new Error(error?.message || "Could not prepare the upload.");
    signed.push({ field, path, token: data.token });
  }
  return signed;
}

/**
 * Read the `uploadedFiles` list a form sent and keep only files that are under
 * `prefix` and actually in storage. Anything else is ignored.
 */
export async function readUploadedFiles(formData: FormData, prefix: string): Promise<UploadedFile[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("uploadedFiles") || "[]"));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const admin = createSupabaseAdminClient() as any;
  const files: UploadedFile[] = [];
  for (const entry of parsed.slice(0, MAX_FILES)) {
    const path = String(entry?.path || "");
    if (!path.startsWith(`${prefix}/`) || path.includes("..")) continue;
    const folder = path.slice(0, path.lastIndexOf("/"));
    const fileName = path.slice(path.lastIndexOf("/") + 1);
    const { data } = await admin.storage.from(UPLOAD_BUCKET).list(folder, { search: fileName, limit: 1 });
    const stored = (data || []).find((item: any) => item.name === fileName);
    if (!stored) continue;
    files.push({
      field: safeField(entry?.field),
      path,
      name: String(entry?.name || fileName).slice(0, 200),
      type: String(stored.metadata?.mimetype || entry?.type || ""),
      size: Number(stored.metadata?.size || entry?.size || 0)
    });
  }
  return files;
}

/** Fetch an uploaded file back as a File, e.g. to read a passport with OCR. */
export async function downloadUploadedFile(file: UploadedFile): Promise<File | null> {
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.storage.from(UPLOAD_BUCKET).download(file.path);
  if (error || !data) return null;
  return new File([await data.arrayBuffer()], file.name, { type: file.type || data.type || "application/octet-stream" });
}
