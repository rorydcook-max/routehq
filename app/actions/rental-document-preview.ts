"use server";

import { revalidatePath } from "next/cache";
import { calculateFinalRentalDocumentContentHash, finaliseDocumentVersionWithRpc } from "@/lib/rental-document-finalisation-service";
import { getDocumentFinalisationEligibility, type DocumentFinalisationEligibility } from "@/lib/rental-document-finalisation";
import {
  buildRentalDocumentPdfPath,
  createRentalDocumentSignedUrl,
  removeRentalDocumentPdf,
  renderDraftPdfBuffer,
  renderFinalPdfBuffer,
  uploadRentalDocumentPdf
} from "@/lib/rental-document-storage";
import { renderRentalAgreementDraftTemplate, type RentalDocumentTemplateWarning } from "@/lib/rental-document-template-adapter";
import {
  createDraftDocumentVersion,
  createRentalDocument,
  getRentalDocument,
  getRentalDocumentVersion,
  renderRentalDocumentVersion,
  type BusinessSnapshot,
  type RenderedSnapshot
} from "@/lib/rental-documents";
import { recordActivityEvent, recordActivityEventOnce } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type RentalDocumentPreviewState = {
  ok: boolean;
  error?: string;
  errorCode?: string;
  renderedHtml?: string;
  warnings?: RentalDocumentTemplateWarning[];
  missingVariables?: string[];
  contentHash?: string;
  documentId?: string;
  versionId?: string;
  versionNumber?: number;
  templateId?: string | null;
  templateVersion?: number | null;
  pdfGeneratedAt?: string | null;
  signedPdfUrl?: string | null;
  finalPdfGeneratedAt?: string | null;
  finalSignedPdfUrl?: string | null;
  finalisationEligibility?: DocumentFinalisationEligibility;
};

async function requireOperatorContext(supabase: any) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) {
    const failure = new Error("You must be signed in to preview rental documents.");
    failure.name = "unauthorised";
    throw failure;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.organization_id) {
    const failure = new Error(membershipError?.message || "Organization membership was not found.");
    failure.name = "unauthorised";
    throw failure;
  }
  if (!["owner", "manager", "operator"].includes(String(membership.role || ""))) {
    const failure = new Error("You do not have permission to preview rental documents.");
    failure.name = "unauthorised";
    throw failure;
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", membership.organization_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (organizationError || !organization) {
    const failure = new Error(organizationError?.message || "Organization was not found.");
    failure.name = "wrong_organisation";
    throw failure;
  }

  return { user, organization, organizationId: membership.organization_id as string };
}

async function loadRentalPreviewContext(supabase: any, organizationId: string, rentalId: string) {
  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Rental was not found for this organization.");
  }

  const [vehicleResult, customerResult, bookingLinkResult] = await Promise.all([
    rental.vehicle_id
      ? supabase
          .from("vehicles")
          .select("*")
          .eq("id", rental.vehicle_id)
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    rental.customer_id
      ? supabase
          .from("customers")
          .select("*")
          .eq("id", rental.customer_id)
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
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
  if (queryError) {
    throw new Error(queryError.message);
  }

  return {
    rental,
    vehicle: vehicleResult.data,
    customer: customerResult.data,
    bookingLink: bookingLinkResult.data
  };
}

async function requireDraftVersionContext(supabase: any, organizationId: string, versionId: string) {
  const version = await getRentalDocumentVersion({ supabase, organizationId, documentVersionId: versionId });
  const document = await getRentalDocument({ supabase, organizationId, documentId: version.document_id });
  const { rental } = await loadRentalPreviewContext(supabase, organizationId, document.rental_id);
  if (version.status !== "draft") {
    const failure = new Error("Only draft rental document versions can generate draft PDFs.");
    failure.name = "version_not_draft";
    throw failure;
  }
  if (document.organization_id !== organizationId || rental.organization_id !== organizationId) {
    const failure = new Error("Rental document ownership check failed.");
    failure.name = "wrong_organisation";
    throw failure;
  }
  return { document, version, rental };
}

async function loadDocumentVersionContext(supabase: any, organizationId: string, versionId: string) {
  const version = await getRentalDocumentVersion({ supabase, organizationId, documentVersionId: versionId });
  const document = await getRentalDocument({ supabase, organizationId, documentId: version.document_id });
  const { rental } = await loadRentalPreviewContext(supabase, organizationId, document.rental_id);
  if (document.organization_id !== organizationId || version.organization_id !== organizationId || rental.organization_id !== organizationId) {
    const failure = new Error("Rental document ownership check failed.");
    failure.name = "wrong_organisation";
    throw failure;
  }
  return { document, version, rental };
}

async function existingBusinessSignature(supabase: any, organizationId: string, versionId: string) {
  const { data, error } = await supabase
    .from("rental_document_signatures")
    .select("id, content_hash_at_signing")
    .eq("organization_id", organizationId)
    .eq("document_version_id", versionId)
    .eq("signer_role", "authorised_business_signatory")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || null;
}

export async function generateRentalDocumentDraftPreview(
  _previousState: RentalDocumentPreviewState,
  formData: FormData
): Promise<RentalDocumentPreviewState> {
  try {
    const supabase = (await createSupabaseServerClient()) as any;
    const { user, organization, organizationId } = await requireOperatorContext(supabase);
    const rentalId = String(formData.get("rental_id") || "").trim();
    const versionId = String(formData.get("version_id") || "").trim();
    const templateId = String(formData.get("template_id") || "").trim() || null;
    const mode = String(formData.get("mode") || "preview");

    if ((mode === "generate_pdf" || mode === "download_pdf" || mode === "refresh_eligibility" || mode === "finalise_version" || mode === "download_final_pdf") && !versionId) {
      throw new Error("Draft document version id is required.");
    }
    if (!["generate_pdf", "download_pdf", "refresh_eligibility", "finalise_version", "download_final_pdf"].includes(mode) && !rentalId) {
      throw new Error("Rental id is required.");
    }

    if (mode === "refresh_eligibility") {
      const { document, version } = await loadDocumentVersionContext(supabase, organizationId, versionId);
      const eligibility = getDocumentFinalisationEligibility({
        featureEnabled: true,
        organizationId,
        document,
        version
      });
      return {
        ok: true,
        documentId: document.id,
        versionId: version.id,
        versionNumber: version.version_number,
        contentHash: version.content_hash,
        finalisationEligibility: eligibility,
        finalPdfGeneratedAt: version.final_pdf_generated_at || null
      };
    }

    if (mode === "finalise_version") {
      const confirmed = String(formData.get("finalisation_confirmed") || "") === "true";
      if (!confirmed) {
        throw new Error("You must confirm finalisation before freezing this version.");
      }
      const { document, version, rental } = await loadDocumentVersionContext(supabase, organizationId, versionId);
      if (version.status === "signed" && (version.final_pdf_storage_path || version.pdf_storage_path)) {
        const signature = await existingBusinessSignature(supabase, organizationId, version.id);
        if (signature?.content_hash_at_signing === version.content_hash) {
          return {
            ok: true,
            documentId: document.id,
            versionId: version.id,
            versionNumber: version.version_number,
            contentHash: version.content_hash,
            finalPdfGeneratedAt: version.final_pdf_generated_at || version.finalised_at,
            finalisationEligibility: getDocumentFinalisationEligibility({ featureEnabled: true, organizationId, document, version })
          };
        }
      }
      if (version.status === "finalised" && (version.final_pdf_storage_path || version.pdf_storage_path)) {
        const existingFinalPdfPath = version.final_pdf_storage_path || version.pdf_storage_path;
        if (!existingFinalPdfPath) throw new Error("This finalised version does not have a final PDF yet.");
        await finaliseDocumentVersionWithRpc({
          supabase,
          organizationId,
          version,
          finalContentHash: version.content_hash,
          finalPdfPath: existingFinalPdfPath,
          finalPdfGeneratedAt: version.final_pdf_generated_at || version.finalised_at || new Date().toISOString(),
          userId: user.id
        });
        await recordActivityEventOnce(
          supabase,
          {
            organization_id: organizationId,
            actor_id: user.id,
            entity_type: "document",
            entity_id: document.id,
            vehicle_id: rental.vehicle_id || null,
            rental_id: rental.id,
            customer_id: rental.customer_id || null,
            event_type: "rental_document_business_signature_applied",
            title: "Authorised business signature applied",
            detail: `Business signature applied to version ${version.version_number}.`,
            metadata: { document_id: document.id, version_id: version.id, signer_role: "authorised_business_signatory" }
          },
          `rental_document_business_signature_applied:${version.id}`
        );
        revalidatePath(`/bookings/${rental.id}`);
        return {
          ok: true,
          documentId: document.id,
          versionId: version.id,
          versionNumber: version.version_number,
          contentHash: version.content_hash,
          finalPdfGeneratedAt: version.final_pdf_generated_at || version.finalised_at,
          finalisationEligibility: getDocumentFinalisationEligibility({
            featureEnabled: true,
            organizationId,
            document: { ...document, status: "signed" } as any,
            version: { ...version, status: "signed" } as any
          })
        };
      }
      const eligibility = getDocumentFinalisationEligibility({ featureEnabled: true, organizationId, document, version });
      if (!eligibility.eligible) {
        return {
          ok: false,
          error: "This draft is not eligible for finalisation.",
          errorCode: "blocking_issues",
          documentId: document.id,
          versionId: version.id,
          versionNumber: version.version_number,
          contentHash: version.content_hash,
          finalisationEligibility: eligibility
        };
      }
      const finalPdfPath = buildRentalDocumentPdfPath({
        organizationId,
        rentalId: rental.id,
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
          rental_id: rental.id,
          document_id: document.id,
          version_id: version.id,
          document_state: "final",
          content_hash: finalContentHash,
          generated_at: finalPdfGeneratedAt
        }
      });
      let finalised;
      try {
        finalised = await finaliseDocumentVersionWithRpc({
          supabase,
          organizationId,
          version,
          finalContentHash,
          finalPdfPath,
          finalPdfGeneratedAt,
          userId: user.id
        });
      } catch (error) {
        await removeRentalDocumentPdf(finalPdfPath);
        throw error;
      }
      await recordActivityEventOnce(supabase, {
        organization_id: organizationId,
        actor_id: user.id,
        entity_type: "document",
        entity_id: document.id,
        vehicle_id: rental.vehicle_id || null,
        rental_id: rental.id,
        customer_id: rental.customer_id || null,
        event_type: "rental_document_version_finalised",
        title: "Rental document version finalised",
        detail: `Version ${version.version_number} finalised.`,
        metadata: { document_id: document.id, version_id: version.id }
      }, `rental_document_version_finalised:${version.id}`);
      await recordActivityEventOnce(supabase, {
        organization_id: organizationId,
        actor_id: user.id,
        entity_type: "document",
        entity_id: document.id,
        vehicle_id: rental.vehicle_id || null,
        rental_id: rental.id,
        customer_id: rental.customer_id || null,
        event_type: "rental_document_final_pdf_generated",
        title: "Final rental document PDF generated",
        detail: `Final internal PDF generated for version ${version.version_number}.`,
        metadata: { document_id: document.id, version_id: version.id }
      }, `rental_document_final_pdf_generated:${version.id}:${finalPdfPath}`);
      await recordActivityEventOnce(
        supabase,
        {
          organization_id: organizationId,
          actor_id: user.id,
          entity_type: "document",
          entity_id: document.id,
          vehicle_id: rental.vehicle_id || null,
          rental_id: rental.id,
          customer_id: rental.customer_id || null,
          event_type: "rental_document_business_signature_applied",
          title: "Authorised business signature applied",
          detail: `Business signature applied to version ${version.version_number}.`,
          metadata: { document_id: document.id, version_id: version.id, signer_role: "authorised_business_signatory" }
        },
        `rental_document_business_signature_applied:${version.id}`
      );
      revalidatePath(`/bookings/${rental.id}`);
      return {
        ok: true,
        documentId: document.id,
        versionId: version.id,
        versionNumber: version.version_number,
        contentHash: finalised.content_hash,
        finalPdfGeneratedAt,
        finalisationEligibility: getDocumentFinalisationEligibility({
          featureEnabled: true,
          organizationId,
          document: { ...document, current_version_id: version.id, status: "signed" } as any,
          version: {
            ...version,
            status: "signed",
            content_hash: finalised.content_hash,
            pdf_storage_bucket: "documents",
            pdf_storage_path: finalPdfPath,
            final_pdf_storage_bucket: "documents",
            final_pdf_storage_path: finalPdfPath,
            final_pdf_generated_at: finalPdfGeneratedAt,
            finalised_at: finalised.finalised_at
          } as any
        })
      };
    }

    if (mode === "download_final_pdf") {
      const { document, version, rental } = await loadDocumentVersionContext(supabase, organizationId, versionId);
      if (!["finalised", "signed"].includes(version.status)) {
        throw new Error("Only finalised or signed versions can download a final PDF.");
      }
      const finalBucket = version.final_pdf_storage_bucket || version.pdf_storage_bucket;
      const finalPath = version.final_pdf_storage_path || version.pdf_storage_path;
      if (!finalBucket || !finalPath) throw new Error("This version does not have a final PDF yet.");
      const finalSignedPdfUrl = await createRentalDocumentSignedUrl(finalBucket, finalPath, 10 * 60);
      await recordActivityEvent(supabase, {
        organization_id: organizationId,
        actor_id: user.id,
        entity_type: "document",
        entity_id: document.id,
        vehicle_id: rental.vehicle_id || null,
        rental_id: rental.id,
        customer_id: rental.customer_id || null,
        event_type: "rental_document_final_pdf_downloaded",
        title: "Final rental document PDF downloaded",
        detail: `Short-lived final PDF URL generated for version ${version.version_number}.`,
        metadata: { document_id: document.id, version_id: version.id }
      });
      return {
        ok: true,
        documentId: document.id,
        versionId: version.id,
        versionNumber: version.version_number,
        contentHash: version.content_hash,
        finalSignedPdfUrl,
        finalPdfGeneratedAt: version.final_pdf_generated_at || version.finalised_at
      };
    }

    if (mode === "generate_pdf") {
      const { document, version, rental } = await requireDraftVersionContext(supabase, organizationId, versionId);
      const pdfPath = buildRentalDocumentPdfPath({
        organizationId,
        rentalId: rental.id,
        documentId: document.id,
        versionId: version.id,
        state: "draft"
      });
      const pdf = await renderDraftPdfBuffer(version.rendered_html_snapshot);
      const draftPdfGeneratedAt = new Date().toISOString();
      await uploadRentalDocumentPdf({
        path: pdfPath,
        pdf,
        metadata: {
          organization_id: organizationId,
          rental_id: rental.id,
          document_id: document.id,
          version_id: version.id,
          document_state: "draft",
          content_hash: version.content_hash,
          generated_at: draftPdfGeneratedAt
        }
      });
      let updated;
      try {
        updated = await renderRentalDocumentVersion({
          supabase,
          organizationId,
          versionId: version.id,
          renderedHtmlSnapshot: version.rendered_html_snapshot,
          renderedDataSnapshot: (version.rendered_data_snapshot || {}) as RenderedSnapshot,
          businessSnapshot: (version.business_snapshot || {}) as BusinessSnapshot,
          templateId: version.template_id,
          templateVersion: version.template_version,
          draftPdfStorageBucket: "documents",
          draftPdfStoragePath: pdfPath,
          draftPdfGeneratedAt,
          createdBy: user.id,
          status: "draft"
        });
      } catch (error) {
        await removeRentalDocumentPdf(pdfPath);
        throw error;
      }
      await recordActivityEventOnce(supabase, {
        organization_id: organizationId,
        actor_id: user.id,
        entity_type: "document",
        entity_id: document.id,
        vehicle_id: rental.vehicle_id || null,
        rental_id: rental.id,
        customer_id: rental.customer_id || null,
        event_type: "rental_document_draft_pdf_generated",
        title: "Draft rental document PDF generated",
        detail: `Draft PDF generated for version ${updated.version.version_number}.`,
        metadata: { document_id: document.id, version_id: version.id }
      }, `rental_document_draft_pdf_generated:${version.id}:${pdfPath}`);
      revalidatePath(`/bookings/${rental.id}`);
      return {
        ok: true,
        documentId: document.id,
        versionId: version.id,
        versionNumber: updated.version.version_number,
        contentHash: updated.version.content_hash,
        pdfGeneratedAt: draftPdfGeneratedAt
      };
    }

    if (mode === "download_pdf") {
      const { document, version, rental } = await requireDraftVersionContext(supabase, organizationId, versionId);
      const draftBucket = version.draft_pdf_storage_bucket || (version.status === "draft" ? version.pdf_storage_bucket : null);
      const draftPath = version.draft_pdf_storage_path || (version.status === "draft" ? version.pdf_storage_path : null);
      if (!draftBucket || !draftPath) {
        throw new Error("This draft version does not have a generated PDF yet.");
      }
      const signedPdfUrl = await createRentalDocumentSignedUrl(draftBucket, draftPath, 10 * 60);
      await recordActivityEvent(supabase, {
        organization_id: organizationId,
        actor_id: user.id,
        entity_type: "document",
        entity_id: document.id,
        vehicle_id: rental.vehicle_id || null,
        rental_id: rental.id,
        customer_id: rental.customer_id || null,
        event_type: "rental_document_draft_pdf_downloaded",
        title: "Draft rental document PDF downloaded",
        detail: `Short-lived draft PDF URL generated for version ${version.version_number}.`,
        metadata: { document_id: document.id, version_id: version.id }
      });
      return {
        ok: true,
        documentId: document.id,
        versionId: version.id,
        versionNumber: version.version_number,
        contentHash: version.content_hash,
        signedPdfUrl,
        pdfGeneratedAt: version.generated_at
      };
    }

    const { rental, vehicle, customer, bookingLink } = await loadRentalPreviewContext(supabase, organizationId, rentalId);
    const rendered = await renderRentalAgreementDraftTemplate({
      supabase,
      organization,
      rental,
      customer,
      vehicle,
      bookingLink,
      templateId
    });

    if (mode === "save_draft") {
      const document = await createRentalDocument({
        supabase,
        organizationId,
        rentalId,
        documentType: "rental_agreement",
        legacyContractId: bookingLink?.contract_id || rental.contract_id || null,
        sourceEventType: "internal_preview",
        sourceEventId: bookingLink?.id || null,
        createdBy: user.id
      });
      const version = await createDraftDocumentVersion({
        supabase,
        organizationId,
        documentId: document.id,
        renderedHtmlSnapshot: rendered.renderedHtml,
        renderedDataSnapshot: rendered.renderedDataSnapshot,
        businessSnapshot: rendered.businessSnapshot,
        templateId: rendered.templateId,
        templateVersion: rendered.templateVersion,
        createdBy: user.id
      });

      await recordActivityEventOnce(supabase, {
        organization_id: organizationId,
        actor_id: user.id,
        entity_type: "document",
        entity_id: document.id,
        vehicle_id: rental.vehicle_id || null,
        rental_id: rental.id,
        customer_id: rental.customer_id || null,
        event_type: "rental_document_draft_saved",
        title: "Draft rental document saved",
        detail: `Draft rental agreement version ${version.version_number} saved for internal preview.`,
        metadata: {
          document_id: document.id,
          version_id: version.id,
          content_hash: version.content_hash
        }
      }, `rental_document_draft_saved:${version.id}`);

      revalidatePath(`/bookings/${rentalId}`);

      return {
        ok: true,
        renderedHtml: rendered.renderedHtml,
        warnings: rendered.warnings,
        missingVariables: rendered.missingVariables,
        contentHash: version.content_hash,
        documentId: document.id,
        versionId: version.id,
        versionNumber: version.version_number,
        templateId: rendered.templateId,
        templateVersion: rendered.templateVersion,
        pdfGeneratedAt: null
      };
    }

    return {
      ok: true,
      renderedHtml: rendered.renderedHtml,
      warnings: rendered.warnings,
      missingVariables: rendered.missingVariables,
      contentHash: rendered.contentHash,
      templateId: rendered.templateId,
      templateVersion: rendered.templateVersion,
      pdfGeneratedAt: null
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to generate rental document preview.",
      errorCode: error instanceof Error && error.name !== "Error" ? error.name : "finalisation_failed"
    };
  }
}
