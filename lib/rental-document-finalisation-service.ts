import {
  calculateRentalDocumentContentHash,
  type BusinessSnapshot,
  type RenderedSnapshot
} from "@/lib/rental-documents";

function signatureReferenceFromSnapshot(snapshot: BusinessSnapshot) {
  const signature = snapshot.authorised_signature && typeof snapshot.authorised_signature === "object" ? snapshot.authorised_signature as Record<string, unknown> : {};
  const bucket = String(signature.bucket || "").trim();
  const path = String(signature.path || "").trim();
  return bucket && path ? { bucket, path } : null;
}

function authorisedSignatoryFromSnapshot(snapshot: BusinessSnapshot) {
  const signatory = snapshot.authorised_signatory && typeof snapshot.authorised_signatory === "object" ? snapshot.authorised_signatory as Record<string, unknown> : {};
  return {
    name: String(signatory.name || "").trim(),
    title: String(signatory.title || "").trim(),
    authorisedAt: String(signatory.signature_authorised_at || "").trim(),
    authorisationTextVersion: String(signatory.signature_authorisation_text_version || "").trim()
  };
}

export function calculateFinalRentalDocumentContentHash({
  version,
  finalPdfPath
}: {
  version: any;
  finalPdfPath: string;
}) {
  return calculateRentalDocumentContentHash({
    renderedHtmlSnapshot: version.rendered_html_snapshot,
    renderedDataSnapshot: (version.rendered_data_snapshot || {}) as RenderedSnapshot,
    businessSnapshot: (version.business_snapshot || {}) as BusinessSnapshot,
    templateId: version.template_id,
    templateVersion: version.template_version,
    versionNumber: version.version_number,
    pdfStorageBucket: "documents",
    pdfStoragePath: finalPdfPath
  });
}

export async function finaliseDocumentVersionWithRpc({
  supabase,
  organizationId,
  version,
  finalContentHash,
  finalPdfPath,
  finalPdfGeneratedAt,
  userId
}: {
  supabase: any;
  organizationId: string;
  version: any;
  finalContentHash: string;
  finalPdfPath: string;
  finalPdfGeneratedAt: string;
  userId: string;
}) {
  const snapshot = (version.business_snapshot || {}) as BusinessSnapshot;
  const signatureReference = signatureReferenceFromSnapshot(snapshot);
  const signatory = authorisedSignatoryFromSnapshot(snapshot);
  if (!signatureReference || !signatory.name) {
    const failure = new Error("Finalised version is missing snapshotted authorised signature details.");
    failure.name = "blocking_issues";
    throw failure;
  }

  const { data, error } = await supabase.rpc("finalise_rental_document_version", {
    p_organization_id: organizationId,
    p_document_version_id: version.id,
    p_current_content_hash: version.content_hash,
    p_final_content_hash: finalContentHash,
    p_final_pdf_storage_bucket: "documents",
    p_final_pdf_storage_path: finalPdfPath,
    p_final_pdf_generated_at: finalPdfGeneratedAt,
    p_signer_user_id: userId,
    p_signer_name: signatory.name,
    p_signature_storage_bucket: signatureReference.bucket,
    p_signature_storage_path: signatureReference.path,
    p_consent_text_version: signatory.authorisationTextVersion,
    p_signature_metadata: {
      signatory_title: signatory.title,
      signature_authorised_at: signatory.authorisedAt
    }
  });
  if (error) {
    const failure = new Error(error.message);
    failure.name = error.message.toLowerCase().includes("hash") ? "hash_mismatch" : "finalisation_failed";
    throw failure;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.document_version_id) {
    const failure = new Error("Finalisation did not return a document version.");
    failure.name = "finalisation_failed";
    throw failure;
  }
  return row;
}
