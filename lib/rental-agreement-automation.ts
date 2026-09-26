import { authorisationCoversAutomaticSigning } from "@/lib/signature-authorisation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordActivityEventOnce } from "@/lib/supabase/activity";
import { renderRentalAgreementDraftTemplate } from "@/lib/rental-document-template-adapter";
import { createDraftDocumentVersion, createRentalDocument } from "@/lib/rental-documents";
import { getDocumentFinalisationEligibility } from "@/lib/rental-document-finalisation";
import { calculateFinalRentalDocumentContentHash, finaliseDocumentVersionWithRpc } from "@/lib/rental-document-finalisation-service";
import {
  buildRentalDocumentPdfPath,
  removeRentalDocumentPdf,
  renderFinalPdfBuffer,
  uploadRentalDocumentPdf
} from "@/lib/rental-document-storage";

/**
 * Automatic rental agreements for online bookings.
 *
 * A customer completes their booking and signs in one visit. For that, the
 * business's side of the agreement is prepared and countersigned by the
 * server, using the signature the business pre-authorised in its settings:
 *
 *   ensureRentalAgreementDraft              - when the booking page opens:
 *                                             create the agreement and a first
 *                                             draft if the booking has none.
 *   countersignRentalAgreementForCustomer   - when the customer submits:
 *                                             re-render with their details,
 *                                             then countersign it.
 *
 * The customer then signs through the existing customer-signing path. Every
 * content, hash, path and signatory check in the database still applies; the
 * server only replaces "an operator clicked finalise". The activity log
 * records that the business signature was applied automatically.
 *
 * Runs with the service role (migration 0071). Never call it with data a
 * browser supplied beyond the booking token already validated by the caller.
 */

type Context = {
  admin: any;
  organization: any;
  rental: any;
  vehicle: any;
  customer: any;
  bookingLink: any;
};

async function loadContext(organizationId: string, rentalId: string): Promise<Context> {
  const admin = createSupabaseAdminClient() as any;
  const [{ data: organization, error: orgError }, { data: rental, error: rentalError }] = await Promise.all([
    admin.from("organizations").select("*").eq("id", organizationId).is("deleted_at", null).maybeSingle(),
    admin.from("rentals").select("*").eq("id", rentalId).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle()
  ]);
  if (orgError || !organization) throw new Error(orgError?.message || "Business was not found.");
  if (rentalError || !rental) throw new Error(rentalError?.message || "Rental was not found.");

  const [vehicleResult, customerResult, bookingLinkResult] = await Promise.all([
    rental.vehicle_id
      ? admin.from("vehicles").select("*").eq("id", rental.vehicle_id).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    rental.customer_id
      ? admin.from("customers").select("*").eq("id", rental.customer_id).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from("booking_links")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  const queryError = [vehicleResult, customerResult, bookingLinkResult].find((result: any) => result.error)?.error;
  if (queryError) throw new Error(queryError.message);

  return {
    admin,
    organization,
    rental,
    vehicle: vehicleResult.data,
    customer: customerResult.data,
    bookingLink: bookingLinkResult.data
  };
}

async function latestAgreement(admin: any, organizationId: string, rentalId: string) {
  const { data: document, error } = await admin
    .from("rental_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("rental_id", rentalId)
    .eq("document_type", "rental_agreement")
    .not("status", "in", "(voided,superseded)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!document?.current_version_id) return { document: document || null, version: null };
  const { data: version, error: versionError } = await admin
    .from("rental_document_versions")
    .select("*")
    .eq("id", document.current_version_id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (versionError) throw new Error(versionError.message);
  return { document, version: version || null };
}

/**
 * Create the booking's agreement document. The database allows only one live
 * agreement per rental, so if another request created it a moment earlier
 * the insert is refused and that document is used instead.
 */
async function createAgreementDocument(context: Context) {
  try {
    return await createRentalDocument({
      supabase: context.admin,
      organizationId: context.organization.id,
      rentalId: context.rental.id,
      documentType: "rental_agreement",
      legacyContractId: context.bookingLink?.contract_id || context.rental.contract_id || null,
      sourceEventType: "customer_booking_link",
      sourceEventId: context.bookingLink?.id || null,
      createdBy: null
    });
  } catch (error) {
    const existing = await latestAgreement(context.admin, context.organization.id, context.rental.id);
    if (existing.document) return existing.document;
    throw error;
  }
}

async function render(context: Context) {
  return renderRentalAgreementDraftTemplate({
    supabase: context.admin,
    organization: context.organization,
    rental: context.rental,
    customer: context.customer,
    vehicle: context.vehicle,
    bookingLink: context.bookingLink,
    templateId: null
  });
}

async function newDraftVersion(context: Context, documentId: string, rendered: Awaited<ReturnType<typeof render>>) {
  return createDraftDocumentVersion({
    supabase: context.admin,
    organizationId: context.organization.id,
    documentId,
    renderedHtmlSnapshot: rendered.renderedHtml,
    renderedDataSnapshot: rendered.renderedDataSnapshot,
    businessSnapshot: rendered.businessSnapshot,
    templateId: rendered.templateId,
    templateVersion: rendered.templateVersion,
    createdBy: null
  });
}

/**
 * Make sure a booking has an agreement to show and sign. Creates the agreement
 * and a first draft only if there is none. Never throws: a booking page must
 * always load, and without a draft it simply shows the rendered preview.
 */
export async function ensureRentalAgreementDraft({ organizationId, rentalId }: { organizationId: string; rentalId: string }) {
  try {
    const context = await loadContext(organizationId, rentalId);
    const existing = await latestAgreement(context.admin, organizationId, rentalId);
    if (existing.version) return { documentId: existing.document.id as string, created: false };

    const rendered = await render(context);
    const document = existing.document || (await createAgreementDocument(context));
    // Another request may have drafted it while this one was rendering.
    if (document.current_version_id) return { documentId: document.id as string, created: false };
    await newDraftVersion(context, document.id, rendered);
    return { documentId: document.id as string, created: true };
  } catch {
    return null;
  }
}

export type CountersignResult =
  | { ok: true; documentId: string; versionId: string; reused: boolean }
  | { ok: false; reason: "not_eligible" | "failed"; message: string; blockingIssues: string[] };

/**
 * Re-render the agreement with the customer's submitted details and
 * countersign it with the business's pre-authorised signature, so the
 * customer can sign in the same visit.
 */
export async function countersignRentalAgreementForCustomer({
  organizationId,
  rentalId
}: {
  organizationId: string;
  rentalId: string;
}): Promise<CountersignResult> {
  try {
    const context = await loadContext(organizationId, rentalId);
    const rendered = await render(context);
    let { document, version } = await latestAgreement(context.admin, organizationId, rentalId);

    // Already countersigned with exactly this content: nothing to redo.
    if (version && ["finalised", "signed"].includes(String(version.status)) && version.rendered_html_snapshot === rendered.renderedHtml) {
      return { ok: true, documentId: document.id, versionId: version.id, reused: true };
    }

    if (!document) {
      document = await createAgreementDocument(context);
    }

    // A draft whose content still matches can be reused; otherwise the
    // customer's details changed the text, so a new version is made.
    if (!version || version.status !== "draft" || version.rendered_html_snapshot !== rendered.renderedHtml) {
      version = await newDraftVersion(context, document.id, rendered);
      document = { ...document, current_version_id: version.id };
    }

    // The business must have accepted wording that covers automatic signing.
    // A business on the v1 wording still countersigns manually from the booking page.
    const acceptedVersion = version.business_snapshot?.authorised_signatory?.signature_authorisation_text_version;
    if (!authorisationCoversAutomaticSigning(acceptedVersion)) {
      return {
        ok: false,
        reason: "not_eligible",
        message: "The business's signature authorisation does not cover automatic signing of online bookings.",
        blockingIssues: [`signature_authorisation_version_${acceptedVersion || "missing"}_does_not_cover_automatic_signing`]
      };
    }

    const eligibility = getDocumentFinalisationEligibility({ featureEnabled: true, organizationId, document, version });
    if (!eligibility.eligible) {
      return {
        ok: false,
        reason: "not_eligible",
        message: "The rental agreement cannot be countersigned yet.",
        blockingIssues: (eligibility.blockingIssues || []).map((issue: any) => String(issue?.code || issue?.message || issue))
      };
    }

    const finalPdfPath = buildRentalDocumentPdfPath({
      organizationId,
      rentalId,
      documentId: document.id,
      versionId: version.id,
      state: "final"
    });
    const finalContentHash = calculateFinalRentalDocumentContentHash({ version, finalPdfPath });
    const pdf = await renderFinalPdfBuffer(version.rendered_html_snapshot);
    const finalPdfGeneratedAt = new Date().toISOString();
    await uploadRentalDocumentPdf({
      path: finalPdfPath,
      pdf,
      metadata: {
        organization_id: organizationId,
        rental_id: rentalId,
        document_id: document.id,
        version_id: version.id,
        document_state: "final",
        content_hash: finalContentHash,
        generated_at: finalPdfGeneratedAt
      }
    });

    try {
      await finaliseDocumentVersionWithRpc({
        supabase: context.admin,
        organizationId,
        version,
        finalContentHash,
        finalPdfPath,
        finalPdfGeneratedAt,
        userId: null
      });
    } catch (error) {
      await removeRentalDocumentPdf(finalPdfPath);
      throw error;
    }

    await recordActivityEventOnce(
      context.admin,
      {
        organization_id: organizationId,
        actor_id: null,
        entity_type: "document",
        entity_id: document.id,
        vehicle_id: context.rental.vehicle_id || null,
        rental_id: rentalId,
        customer_id: context.rental.customer_id || null,
        event_type: "rental_document_business_signature_applied",
        title: "Business signature applied automatically",
        detail: `The business's pre-authorised signature was applied to version ${version.version_number} when the customer submitted their online booking.`,
        metadata: {
          document_id: document.id,
          version_id: version.id,
          signer_role: "authorised_business_signatory",
          applied_by: "server",
          trigger: "customer_online_booking"
        }
      },
      `rental_document_business_signature_applied:${version.id}`
    );

    return { ok: true, documentId: document.id, versionId: version.id, reused: false };
  } catch (error) {
    return {
      ok: false,
      reason: "failed",
      message: error instanceof Error ? error.message : String(error),
      blockingIssues: []
    };
  }
}
