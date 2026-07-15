import { htmlToPdf } from "@/lib/html-to-pdf";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function timestampRevision() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "");
}

export function withDraftWatermark(html: string) {
  const banner = `<div style="position: fixed; top: 10mm; left: 15mm; right: 15mm; z-index: 9999; border: 2px solid #b91c1c; color: #b91c1c; background: rgba(255,255,255,0.92); font-family: Arial, sans-serif; font-size: 16px; font-weight: 700; text-align: center; padding: 8px;">DRAFT - NOT SIGNED</div>`;
  const watermark = `<div style="position: fixed; top: 45%; left: 8%; right: 8%; z-index: 9998; transform: rotate(-22deg); opacity: 0.08; color: #991b1b; font-family: Arial, sans-serif; font-size: 72px; font-weight: 900; text-align: center;">DRAFT - NOT SIGNED</div>`;
  return html.includes("<body") ? html.replace(/<body([^>]*)>/i, `<body$1>${banner}${watermark}`) : `${banner}${watermark}${html}`;
}

export function buildRentalDocumentPdfPath({
  organizationId,
  rentalId,
  documentId,
  versionId,
  state
}: {
  organizationId: string;
  rentalId: string;
  documentId: string;
  versionId: string;
  state: "draft" | "final";
}) {
  return `organizations/${organizationId}/rentals/${rentalId}/rental-documents/${documentId}/versions/${versionId}/${state}-${timestampRevision()}.pdf`;
}

function documentStorage() {
  return (createSupabaseAdminClient() as any).storage.from("documents");
}

export async function uploadRentalDocumentPdf({
  path,
  pdf,
  metadata
}: {
  path: string;
  pdf: Buffer;
  metadata: Record<string, string>;
}) {
  const { error } = await documentStorage().upload(path, pdf, {
    contentType: "application/pdf",
    upsert: false,
    metadata
  });
  if (error) {
    const failure = new Error(error.message);
    failure.name = "storage_upload_failed";
    throw failure;
  }
}

export async function removeRentalDocumentPdf(path: string) {
  await documentStorage().remove([path]);
}

export async function createRentalDocumentSignedUrl(bucket: string, path: string, expiresIn = 10 * 60) {
  if (bucket !== "documents") {
    const failure = new Error("Only document PDF storage can be signed by this service.");
    failure.name = "invalid_storage_path";
    throw failure;
  }
  const { data, error } = await documentStorage().createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) {
    const failure = new Error(error?.message || "Unable to create signed PDF URL.");
    failure.name = "download_unavailable";
    throw failure;
  }
  return data.signedUrl;
}

export async function renderDraftPdfBuffer(html: string) {
  return htmlToPdf(withDraftWatermark(html));
}

export async function renderFinalPdfBuffer(html: string) {
  return htmlToPdf(html);
}
