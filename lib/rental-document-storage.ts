import { htmlToPdf } from "@/lib/html-to-pdf";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function timestampRevision() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "");
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

export async function renderFinalPdfBuffer(html: string) {
  return htmlToPdf(html);
}
