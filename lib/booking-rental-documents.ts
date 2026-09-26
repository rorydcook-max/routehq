import { createRentalDocumentSignedUrl } from "@/lib/rental-document-storage";

// The operator's view of the legally relevant documents on a booking:
// the rental agreement, delivery report, return report and any amendments.
// Rows are read with the operator's own (RLS-scoped) client; download links
// are signed only for files that client was allowed to see.

const documentLabels: Record<string, string> = {
  rental_agreement: "Rental agreement",
  agreement_amendment: "Agreement amendment",
  delivery_report: "Delivery report",
  return_report: "Return report",
  vehicle_substitution: "Vehicle substitution",
  extension_amendment: "Extension amendment",
  early_termination_statement: "Early termination statement",
  incident_report: "Incident report",
  deposit_reconciliation: "Deposit reconciliation",
  final_rental_pack: "Final rental pack"
};

const documentOrder = Object.keys(documentLabels);

const signerLabels: Record<string, string> = {
  authorised_business_signatory: "Business",
  operator: "Staff",
  renter: "Renter",
  additional_driver: "Additional driver",
  witness: "Witness"
};

export type BookingRentalDocument = {
  id: string;
  type: string;
  label: string;
  status: string;
  versionNumber: number | null;
  finalisedAt: string | null;
  contentHash: string | null;
  pdfUrl: string | null;
  certificateUrl: string | null;
  verificationReference: string | null;
  signatures: Array<{ role: string; roleLabel: string; name: string; signedAt: string }>;
};

async function signedUrl(bucket: string | null | undefined, path: string | null | undefined) {
  if (!bucket || !path) return null;
  try {
    return await createRentalDocumentSignedUrl(bucket, path, 60 * 60);
  } catch {
    return null;
  }
}

export async function getBookingRentalDocuments(supabase: any, organizationId: string, rentalId: string): Promise<BookingRentalDocument[]> {
  const { data: documents, error } = await supabase
    .from("rental_documents")
    .select("id, document_type, status, current_version_id, finalised_at")
    .eq("organization_id", organizationId)
    .eq("rental_id", rentalId);
  if (error || !documents?.length) return [];

  const versionIds = documents.map((document: any) => document.current_version_id).filter(Boolean);
  const [versionsResult, signaturesResult, certificatesResult] = versionIds.length
    ? await Promise.all([
        supabase
          .from("rental_document_versions")
          .select("id, version_number, status, content_hash, finalised_at, final_pdf_storage_bucket, final_pdf_storage_path, pdf_storage_bucket, pdf_storage_path")
          .eq("organization_id", organizationId)
          .in("id", versionIds),
        supabase
          .from("rental_document_signatures")
          .select("document_version_id, signer_role, signer_name, signed_at")
          .eq("organization_id", organizationId)
          .in("document_version_id", versionIds)
          .order("signed_at", { ascending: true }),
        supabase
          .from("rental_document_execution_certificates")
          .select("document_version_id, certificate_storage_bucket, certificate_storage_path, verification_reference")
          .eq("organization_id", organizationId)
          .in("document_version_id", versionIds)
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const versions = new Map<string, any>((versionsResult.data || []).map((version: any) => [version.id, version]));
  const certificates = new Map<string, any>((certificatesResult.data || []).map((certificate: any) => [certificate.document_version_id, certificate]));

  const rows = await Promise.all(
    documents.map(async (document: any): Promise<BookingRentalDocument> => {
      const version = document.current_version_id ? versions.get(document.current_version_id) : null;
      const certificate = version ? certificates.get(version.id) : null;
      const isFinal = version && ["finalised", "signed"].includes(String(version.status));
      const signatures = version
        ? (signaturesResult.data || [])
            .filter((signature: any) => signature.document_version_id === version.id)
            .map((signature: any) => ({
              role: signature.signer_role,
              roleLabel: signerLabels[signature.signer_role] || signature.signer_role,
              name: signature.signer_name,
              signedAt: signature.signed_at
            }))
        : [];

      return {
        id: document.id,
        type: document.document_type,
        label: documentLabels[document.document_type] || document.document_type,
        status: document.status,
        versionNumber: version?.version_number ?? null,
        finalisedAt: version?.finalised_at || document.finalised_at || null,
        contentHash: isFinal ? version.content_hash || null : null,
        pdfUrl: isFinal
          ? await signedUrl(version.final_pdf_storage_bucket || version.pdf_storage_bucket, version.final_pdf_storage_path || version.pdf_storage_path)
          : null,
        certificateUrl: certificate ? await signedUrl(certificate.certificate_storage_bucket, certificate.certificate_storage_path) : null,
        verificationReference: certificate?.verification_reference || null,
        signatures
      };
    })
  );

  return rows.sort((a, b) => documentOrder.indexOf(a.type) - documentOrder.indexOf(b.type));
}

export function businessSignatureOf(documents: BookingRentalDocument[]) {
  const agreement = documents.find((document) => document.type === "rental_agreement");
  return agreement?.signatures.find((signature) => signature.role === "authorised_business_signatory" || signature.role === "operator") || null;
}

export function renterSignatureOf(documents: BookingRentalDocument[]) {
  const agreement = documents.find((document) => document.type === "rental_agreement");
  return agreement?.signatures.find((signature) => signature.role === "renter") || null;
}
