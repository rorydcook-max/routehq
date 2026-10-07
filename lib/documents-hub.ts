import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRentalDocumentSignedUrl } from "@/lib/rental-document-storage";

export type DocumentListItem = {
  id: string;
  fileName: string;
  category: string;
  ownerType: string;
  ownerId: string | null;
  /** Names and references only; the page words the rest in the reader's language. Empty when the owner is unknown. */
  ownerLabel: string;
  /** For signed paperwork: which document it is ("rental_agreement"). */
  docType?: string | null;
  /** For inspection photos: taken at handover or at return. */
  inspectionType?: "delivery" | "return" | null;
  mimeType: string | null;
  createdAt: string;
  signedUrl: string | null;
  href: string | null;
};

const SIGNED_DOCUMENT_LABELS: Record<string, string> = {
  rental_agreement: "Rental agreement",
  agreement_amendment: "Agreement amendment",
  extension_amendment: "Extension amendment",
  delivery_report: "Handover report",
  return_report: "Return report",
  vehicle_substitution: "Vehicle substitution",
  early_termination_statement: "Early termination statement",
  incident_report: "Incident report",
  deposit_reconciliation: "Deposit reconciliation",
  final_rental_pack: "Final rental pack"
};

async function signedPath(supabase: any, path: string | null | undefined, bucket = "documents") {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  return data?.signedUrl || null;
}

function ownerHref(ownerType: string, ownerId: string | null) {
  if (!ownerId) return null;
  if (ownerType === "vehicle") return `/fleet/${ownerId}`;
  if (ownerType === "customer") return `/customers/${ownerId}`;
  if (ownerType === "rental") return `/bookings/${ownerId}`;
  return null;
}

function rentalLabel(rental: any) {
  if (!rental) return "";
  const reference = rental.reference || rental.display_code || String(rental.id || "").slice(0, 8);
  return [reference, rental.customers?.full_name].filter(Boolean).join(" · ");
}

/**
 * Every file across the business: uploads (customer IDs, vehicle photos,
 * inspection photos) and the signed rental documents (agreements, delivery
 * and return reports, amendments), newest first.
 */
export async function getDocumentList(organizationId: string, limit = 150): Promise<DocumentListItem[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const [uploadsResult, signedResult] = await Promise.all([
    supabase
      .from("documents")
      .select("id, file_name, category, owner_type, owner_id, mime_type, storage_path, created_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("rental_documents")
      .select("id, document_type, status, rental_id, current_version_id, finalised_at, created_at")
      .eq("organization_id", organizationId)
      .in("status", ["signed", "finalised"])
      .order("created_at", { ascending: false })
      .limit(limit)
  ]);

  if (uploadsResult.error) {
    throw new Error(uploadsResult.error.message);
  }
  const data = uploadsResult.data || [];
  const signed = signedResult.data || [];

  const idsOf = (type: string) => [...new Set(data.filter((row: any) => row.owner_type === type && row.owner_id).map((row: any) => row.owner_id))];
  const vehicleIds = idsOf("vehicle");
  const customerIds = idsOf("customer");
  const inspectionIds = idsOf("inspection");
  const versionIds = signed.map((row: any) => row.current_version_id).filter(Boolean);

  const [vehiclesResult, customersResult, inspectionsResult, versionsResult] = await Promise.all([
    vehicleIds.length ? supabase.from("vehicles").select("id, registration_number, make, model").in("id", vehicleIds) : Promise.resolve({ data: [] }),
    customerIds.length ? supabase.from("customers").select("id, full_name").in("id", customerIds) : Promise.resolve({ data: [] }),
    inspectionIds.length ? supabase.from("inspections").select("id, rental_id, type").in("id", inspectionIds) : Promise.resolve({ data: [] }),
    versionIds.length
      ? supabase.from("rental_document_versions").select("id, final_pdf_storage_bucket, final_pdf_storage_path, pdf_storage_bucket, pdf_storage_path, swap:rendered_data_snapshot->swap").in("id", versionIds)
      : Promise.resolve({ data: [] })
  ]);

  const inspectionById = new Map((inspectionsResult.data || []).map((row: any) => [row.id, row]));
  const rentalIds = [
    ...new Set([
      ...idsOf("rental"),
      ...(inspectionsResult.data || []).map((row: any) => row.rental_id).filter(Boolean),
      ...signed.map((row: any) => row.rental_id)
    ])
  ];
  const { data: rentals } = rentalIds.length
    ? await supabase.from("rentals").select("id, reference, display_code, customers!rentals_customer_id_fkey(full_name)").in("id", rentalIds)
    : { data: [] };

  const vehicleLabels = new Map((vehiclesResult.data || []).map((row: any) => [row.id, [row.registration_number, row.make, row.model].filter(Boolean).join(" ")]));
  const customerLabels = new Map((customersResult.data || []).map((row: any) => [row.id, row.full_name]));
  const rentalById = new Map((rentals || []).map((row: any) => [row.id, row]));
  const versionById = new Map((versionsResult.data || []).map((row: any) => [row.id, row]));

  const uploads = await Promise.all(
    data.map(async (row: any): Promise<DocumentListItem> => {
      let ownerLabel = "";
      let inspectionType: "delivery" | "return" | null = null;
      let href = ownerHref(row.owner_type, row.owner_id);
      if (row.owner_type === "vehicle" && row.owner_id) ownerLabel = String(vehicleLabels.get(row.owner_id) || "");
      if (row.owner_type === "customer" && row.owner_id) ownerLabel = String(customerLabels.get(row.owner_id) || "");
      if (row.owner_type === "rental" && row.owner_id) ownerLabel = rentalLabel(rentalById.get(row.owner_id));
      if (row.owner_type === "inspection" && row.owner_id) {
        // Inspection photos belong to a booking: link there.
        const inspection: any = inspectionById.get(row.owner_id);
        ownerLabel = rentalLabel(rentalById.get(inspection?.rental_id));
        inspectionType = inspection?.type === "return" ? "return" : "delivery";
        href = inspection?.rental_id ? `/bookings/${inspection.rental_id}` : null;
      }
      return {
        id: row.id,
        fileName: row.file_name,
        category: row.category,
        ownerType: row.owner_type,
        ownerId: row.owner_id,
        ownerLabel,
        inspectionType,
        mimeType: row.mime_type,
        createdAt: row.created_at,
        signedUrl: await signedPath(supabase, row.storage_path),
        href
      };
    })
  );

  const signedItems = await Promise.all(
    signed.map(async (row: any): Promise<DocumentListItem> => {
      const version: any = versionById.get(row.current_version_id);
      return {
        id: `rental-document-${row.id}`,
        fileName: SIGNED_DOCUMENT_LABELS[row.document_type] || row.document_type,
        category: "signed_document",
        docType: version?.swap === true && ["delivery_report", "return_report"].includes(row.document_type) ? `${row.document_type}_swap` : row.document_type,
        ownerType: "signed",
        ownerId: row.rental_id,
        ownerLabel: rentalLabel(rentalById.get(row.rental_id)),
        mimeType: "application/pdf",
        createdAt: row.finalised_at || row.created_at,
        // Row read with the member's own access; the link is signed by the
        // document service like on the booking page.
        signedUrl: version
          ? await createRentalDocumentSignedUrl(
              version.final_pdf_storage_bucket || version.pdf_storage_bucket || "documents",
              version.final_pdf_storage_path || version.pdf_storage_path,
              60 * 60
            ).catch(() => null)
          : null,
        href: `/bookings/${row.rental_id}`
      };
    })
  );

  return [...signedItems, ...uploads].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
