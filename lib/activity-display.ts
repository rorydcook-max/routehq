/**
 * The history on a booking is for the owner, not for an auditor: record-keeping
 * steps the app takes on its own are left out, and what remains is named in
 * the reader's language by its kind (the stored titles are English).
 */
const HOUSEKEEPING = new Set([
  "rental_document_version_created",
  "rental_document_created",
  "rental_document_draft_saved",
  "rental_document_draft_pdf_generated",
  "rental_document_final_pdf_generated",
  "rental_document_final_pdf_downloaded",
  "rental_document_version_finalised",
  "rental_document_email_skipped",
  "rental_document_business_signature_applied",
  "rental_document_material_change_blocked",
  "payment_schedule_generated",
  "payment_setup",
  "transaction_created",
  "signature_authorisation_accepted",
  "contract_branding_updated",
  "delivery_report_finalised",
  "return_report_finalised"
]);

export function visibleActivity<T extends { event_type?: string | null }>(events: T[]): T[] {
  return (events || []).filter((event) => !HOUSEKEEPING.has(String(event.event_type || "")));
}

/** The name of an event in the reader's language, or its stored title when the kind is not one we name. */
export function activityTitle(event: { event_type?: string | null; title?: string | null }, t: { has: (key: never) => boolean } & ((key: never) => string)) {
  const key = `hist_${String(event.event_type || "")}`;
  return t.has(key as never) ? t(key as never) : String(event.title || "");
}
