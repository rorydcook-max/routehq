import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { amendmentRows, hashFragment, type AmendmentChanges, type AmendmentRow } from "@/lib/rental-amendments";

export type PublicAmendment =
  | { state: "not_found" }
  | {
      state: "awaiting_signature" | "signed" | "cancelled" | "expired";
      token: string;
      businessName: string;
      renterName: string;
      vehicleLabel: string;
      rows: AmendmentRow[];
      changes: AmendmentChanges;
      html: string;
      contentHash: string;
      contentHashFragment: string;
      signedAt: string | null;
      signerName: string | null;
      pdfUrl: string | null;
      contactPhone: string | null;
    };

/** An amendment as its link shows it to the customer. Server only. */
export async function loadPublicAmendment(token: string): Promise<PublicAmendment> {
  const clean = String(token || "").trim();
  if (!/^[a-f0-9]{48}$/.test(clean)) return { state: "not_found" };
  const admin = createSupabaseAdminClient() as any;
  const { data: amendment } = await admin.from("rental_amendments").select("*").eq("token", clean).maybeSingle();
  if (!amendment) return { state: "not_found" };

  const [{ data: rental }, { data: organization }] = await Promise.all([
    admin.from("rentals").select("id, vehicle_id, customer_id").eq("id", amendment.rental_id).maybeSingle(),
    admin.from("organizations").select("name, trading_name, business_phone, settings").eq("id", amendment.organization_id).maybeSingle()
  ]);
  const [{ data: vehicle }, { data: customer }] = await Promise.all([
    rental?.vehicle_id ? admin.from("vehicles").select("make, model, year, registration_number").eq("id", rental.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    rental?.customer_id ? admin.from("customers").select("full_name").eq("id", rental.customer_id).maybeSingle() : Promise.resolve({ data: null })
  ]);

  let pdfUrl: string | null = null;
  if (amendment.status === "signed" && amendment.document_id) {
    const { data: document } = await admin.from("rental_documents").select("current_version_id").eq("id", amendment.document_id).maybeSingle();
    const { data: version } = document?.current_version_id
      ? await admin.from("rental_document_versions").select("final_pdf_storage_path").eq("id", document.current_version_id).maybeSingle()
      : { data: null };
    if (version?.final_pdf_storage_path) {
      const { data } = await admin.storage.from("documents").createSignedUrl(version.final_pdf_storage_path, 60 * 60);
      pdfUrl = data?.signedUrl || null;
    }
  }

  const expired = amendment.status === "awaiting_signature" && new Date(amendment.expires_at).getTime() < Date.now();
  const settings = organization?.settings && typeof organization.settings === "object" ? organization.settings : {};
  return {
    state: expired ? "expired" : amendment.status,
    token: clean,
    businessName: String(organization?.trading_name || organization?.name || "Rental business"),
    renterName: String(customer?.full_name || ""),
    vehicleLabel: [[vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean).join(" "), vehicle?.registration_number].filter(Boolean).join(" - "),
    rows: amendmentRows(amendment.changes),
    changes: amendment.changes,
    html: amendment.rendered_html,
    contentHash: amendment.content_hash,
    contentHashFragment: hashFragment(amendment.content_hash),
    signedAt: amendment.signed_at || null,
    signerName: amendment.signer_name || null,
    pdfUrl,
    contactPhone: String(organization?.business_phone || settings.phone || settings.business_phone || "") || null
  };
}
