import { buildContractVariables, extractBodyHtml, renderContractTemplate } from "@/lib/contract-rendering";
import { getCustomerInspectionReports } from "@/lib/booking-rental-documents";
import { holdDeadline, retakeHold } from "@/lib/booking-holds";
import { bookingRules } from "@/lib/booking-rules";
import { resolveOrganizationBrandingDisplayUrls } from "@/lib/branding-assets";
import { defaultRentalContractTemplate, embedLogoInContractVariables, ensureDefaultContractTemplate } from "@/lib/contracts";
import { loadPublicRentalAgreementForPage } from "@/lib/rental-document-customer-signing";
import { ensureRentalAgreementDraft } from "@/lib/rental-agreement-automation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { freshPromptPayQrUrl } from "@/lib/promptpay-qr";

export type PublicBookingState = "not_found" | "expired" | "cancelled" | "taken" | "ready" | "active" | "completed";

const documentCategories = ["passport", "driver_license", "selfie"];

const fallbackPaymentMethods = ["cash"];

function normalizePaymentMethods(value: unknown) {
  const methods = Array.isArray(value) ? value.map(String) : fallbackPaymentMethods;
  const unique = Array.from(new Set(methods.map((method) => method.trim()).filter(Boolean)));
  return unique.includes("cash") ? unique : ["cash", ...unique];
}

function organizationPaymentSettings(organization: any) {
  const acceptedMethods = normalizePaymentMethods(organization?.accepted_payment_methods);
  const defaultMethod = String(organization?.default_payment_method || "cash");

  return {
    accepted_payment_methods: acceptedMethods,
    promptpay_id: organization?.promptpay_id || null,
    promptpay_qr_url: organization?.promptpay_qr_url || null,
    bank_name: organization?.bank_name || null,
    bank_account_number: organization?.bank_account_number || null,
    bank_account_name: organization?.bank_account_name || null,
    wise_link: organization?.wise_link || null,
    revolut_link: organization?.revolut_link || null,
    default_payment_method: acceptedMethods.includes(defaultMethod) ? defaultMethod : "cash",
    upfront_discount_enabled: Boolean(organization?.upfront_discount_enabled),
    upfront_discount_min_periods: Number(organization?.upfront_discount_min_periods ?? 3),
    upfront_discount_rate: organization?.upfront_discount_rate ? Number(organization.upfront_discount_rate) : null,
    upfront_discount_label: organization?.upfront_discount_label || null
  };
}

async function logBookingLinkActivity(supabase: any, bookingLink: any, content: string) {
  if (!bookingLink?.organization_id || !bookingLink?.rental_id) return;
  await supabase.from("communication_log").insert({
    organisation_id: bookingLink.organization_id,
    rental_id: bookingLink.rental_id,
    customer_id: bookingLink.customer_id,
    type: "booking_link_activity",
    channel: "booking_portal",
    direction: "inbound",
    content,
    status: "sent",
    metadata: { booking_link_id: bookingLink.id, token: bookingLink.token }
  });
}

export async function getPublicBookingDetail(token: string) {
  const supabase = createSupabaseAdminClient() as any;
  const { data: bookingLink, error: bookingError } = await supabase
    .from("booking_links")
    .select("*")
    .eq("token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (bookingError || !bookingLink) {
    return { state: "not_found" as PublicBookingState };
  }

  if (bookingLink.status === "cancelled") {
    // Enough about the business to tell the customer who to contact and where to book again.
    const { data: cancelledOrg } = await supabase.from("organizations").select("name, slug, settings").eq("id", bookingLink.organization_id).maybeSingle();
    return { state: "cancelled" as PublicBookingState, bookingLink, organization: cancelledOrg };
  }

  const expiresAt = bookingLink.expires_at ? new Date(bookingLink.expires_at) : null;
  if (expiresAt && expiresAt.getTime() < Date.now() && bookingLink.status !== "completed") {
    await supabase.from("booking_links").update({ status: "expired" }).eq("id", bookingLink.id);
    return { state: "expired" as PublicBookingState, bookingLink };
  }

  // Holds: a customer who comes back after their hold ran out gets the vehicle
  // again if it is still free; otherwise they are told the dates have gone.
  if (bookingLink.status !== "completed") {
    if (bookingLink.hold_released_at) {
      const retaken = await retakeHold(supabase, bookingLink);
      if (!retaken) {
        // Enough about the business to tell the customer who to contact and where to rebook.
        const { data: takenOrg } = await supabase.from("organizations").select("name, slug, settings").eq("id", bookingLink.organization_id).maybeSingle();
        return { state: "taken" as PublicBookingState, bookingLink, organization: takenOrg };
      }
    } else if (bookingLink.hold_until && new Date(bookingLink.hold_until).getTime() < Date.now()) {
      // Out of time but nobody has released it yet: they are here now, so give them a fresh hold.
      const { data: holdOrg } = await supabase.from("organizations").select("settings").eq("id", bookingLink.organization_id).maybeSingle();
      await supabase.from("booking_links").update({ hold_until: holdDeadline(bookingRules(holdOrg?.settings).holdHours) }).eq("id", bookingLink.id);
    }
  }

  const shouldLogOpen = ["pending", "sent"].includes(bookingLink.status) && !bookingLink.viewed_at;
  // Marking the link as opened runs alongside the reads below instead of ahead of them.
  const markOpened = (async () => {
    if (["pending", "sent"].includes(bookingLink.status)) {
      await supabase
        .from("booking_links")
        .update({ status: "viewed", viewed_at: new Date().toISOString() })
        .eq("id", bookingLink.id)
        .is("viewed_at", null);
    }
    if (shouldLogOpen) {
      await logBookingLinkActivity(supabase, bookingLink, "Customer opened booking link");
    }
  })().catch(() => null);

  // Everything that only needs the link is fetched in one go: the customer is waiting on a phone.
  const rentalReads = bookingLink.rental_id
    ? Promise.all([
        supabase
          .from("rental_payments")
          .select("amount, status")
          .eq("organization_id", bookingLink.organization_id)
          .eq("rental_id", bookingLink.rental_id)
          .is("deleted_at", null),
        supabase
          .from("customer_portal_actions")
          .select("*")
          .eq("organisation_id", bookingLink.organization_id)
          .eq("rental_id", bookingLink.rental_id)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("inspections")
          .select("*")
          .eq("organization_id", bookingLink.organization_id)
          .eq("rental_id", bookingLink.rental_id)
          .eq("type", "delivery")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
      ])
    : Promise.resolve([{ data: [] }, { data: [] }, { data: [] }] as any[]);
  // Every booking needs an agreement in the document engine. Nothing else
  // creates one, so the first time the page opens a draft is made here.
  const agreementReads = (async () => {
    // Once the customer has signed there is nothing to prepare.
    if (bookingLink.rental_id && bookingLink.status !== "cancelled" && !bookingLink.contract_signed_at) {
      await ensureRentalAgreementDraft({ organizationId: bookingLink.organization_id, rentalId: bookingLink.rental_id });
    }
    // One load of the agreement records answers everything the page asks about it.
    return loadPublicRentalAgreementForPage(token);
  })();

  const [{ data: organization }, { data: rental }, { data: vehicle }, { data: customer }, { data: contract }, { data: documents }, { data: template }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", bookingLink.organization_id).maybeSingle(),
    bookingLink.rental_id ? supabase.from("rentals").select("*").eq("id", bookingLink.rental_id).maybeSingle() : Promise.resolve({ data: null }),
    bookingLink.vehicle_id ? supabase.from("vehicles").select("*, vehicle_categories(code, name)").eq("id", bookingLink.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    bookingLink.customer_id ? supabase.from("customers").select("*").eq("id", bookingLink.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    bookingLink.contract_id ? supabase.from("contracts").select("*").eq("id", bookingLink.contract_id).maybeSingle() : Promise.resolve({ data: null }),
    bookingLink.customer_id
      ? supabase
          .from("documents")
          .select("*")
          .eq("organization_id", bookingLink.organization_id)
          .eq("owner_type", "customer")
          .eq("owner_id", bookingLink.customer_id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ensureDefaultContractTemplate(supabase, bookingLink.organization_id).then((data) => ({ data }))
  ]);

  const [paymentsResult, portalActionsResult, inspectionsResult] = await rentalReads;

  const outstandingBalance = (paymentsResult.data || []).reduce((sum: number, payment: any) => {
    if (["paid", "voided", "waived", "cancelled"].includes(payment.status)) return sum;
    return sum + Number(payment.amount || 0);
  }, 0);
  const deliveryInspection = inspectionsResult.data?.[0] || null;
  const deliveryPhotos = Array.isArray(deliveryInspection?.photos) ? deliveryInspection.photos : [];
  const deliveryPhotoUrlsPending = Promise.all(
    deliveryPhotos.map(async (photo: any) => {
      const path = photo?.url || photo?.storage_path || photo?.path;
      if (!path) return null;
      if (/^https?:\/\//.test(path)) return path;
      return (await supabase.storage.from("documents").createSignedUrl(path, 60 * 60)).data?.signedUrl || null;
    })
  );

  const uploadedCategories = new Set((documents || []).map((document: any) => document.category));
  const signedContractPath = contract?.content_pdf_url || null;
  const contractTemplate = template?.content_html || template?.body || contract?.content_html || defaultRentalContractTemplate;
  // The agreement text is built after the branding lookup, as before: it relies on what that lookup resolves.
  const brandingPending: Promise<{ logoUrl: string | null; signatureUrl: string | null }> = organization
    ? resolveOrganizationBrandingDisplayUrls(supabase, organization, { allowExternalUrl: true, expiresIn: 60 * 60 })
    : Promise.resolve({ logoUrl: null, signatureUrl: null });
  // The remaining lookups don't depend on each other, so they run together.
  const [promptPayQrUrl, deliveryPhotoUrls, agreementResult, signedContractUrl, organizationBranding, contractVariables] = await Promise.all([
    freshPromptPayQrUrl(supabase, organization?.promptpay_qr_url),
    deliveryPhotoUrlsPending,
    agreementReads,
    signedContractPath
      ? supabase.storage.from("documents").createSignedUrl(signedContractPath, 60 * 60).then((result: any) => result.data?.signedUrl || null)
      : Promise.resolve(null),
    brandingPending,
    brandingPending.then(() =>
      embedLogoInContractVariables(
        supabase,
        buildContractVariables({
          organization,
          customer,
          vehicle,
          rental,
          bookingLink
        })
      )
    ),
    markOpened
  ]);
  const inspectionReports = bookingLink.rental_id ? await getCustomerInspectionReports(supabase, bookingLink.organization_id, bookingLink.rental_id) : [];
  // Receipts the business has issued for this rental: the customer paid, so the receipt is theirs to keep.
  const receipts: Array<{ id: string; number: string; url: string }> = bookingLink.rental_id
    ? await supabase
        .from("receipts")
        .select("id, receipt_number, pdf_url")
        .eq("organisation_id", bookingLink.organization_id)
        .eq("rental_id", bookingLink.rental_id)
        .order("created_at", { ascending: true })
        .then(({ data }: { data: any[] | null }) =>
          (data || [])
            .filter((row) => /^https?:\/\//.test(String(row.pdf_url || "")))
            .map((row) => ({ id: String(row.id), number: String(row.receipt_number || ""), url: String(row.pdf_url) }))
        )
    : [];
  const rentalDocumentAgreement = agreementResult.agreement;
  const executedDownloads = agreementResult.downloads;
  const organizationForDisplay = organization
    ? {
        ...organization,
        logo_display_url: organizationBranding.logoUrl,
        owner_signature_display_url: organizationBranding.signatureUrl
      }
    : organization;
  const renderedContract = renderContractTemplate(
    contractTemplate,
    contractVariables
  );
  const documentStart = renderedContract.search(/<!doctype\s+html|<html(?:\s|>)/i);
  const contractDocument = documentStart >= 0
    ? renderedContract.slice(documentStart)
    : renderedContract;
  const contractHtml = extractBodyHtml(contractDocument);

  const rentalStatus = rental?.status || "booked";
  const agreementSigned = Boolean(rentalDocumentAgreement?.eligibility?.fullyExecuted);
  // A running rental shows the customer portal once the agreement is signed.
  // One entered by the team without an agreement shows the signing form first.
  // "Completed" means the rental has ended, not that the customer finished the
  // form: a signed booking that hasn't started shows its confirmation.
  const state = rentalStatus === "cancelled" || bookingLink.status === "cancelled"
    ? "cancelled"
    : ["active", "due_soon", "overdue", "extended"].includes(rentalStatus)
      ? agreementSigned ? "active" : "ready"
      : rentalStatus === "completed"
        ? "completed"
        : "ready";

  return {
    state: state as PublicBookingState,
    bookingLink,
    organization: organizationForDisplay,
    rental: rental
      ? {
          ...rental,
          status: rentalStatus,
          outstanding_balance: outstandingBalance
        }
      : rental,
    vehicle,
    customer,
    contract,
    documents: documents || [],
    uploadedCategories,
    documentStatus: {
      passport: uploadedCategories.has("passport"),
      driver_license: uploadedCategories.has("driver_license"),
      selfie: uploadedCategories.has("selfie")
    },
    completion: {
      details: Boolean(bookingLink.customer_details_submitted_at),
      documents: documentCategories.every((category) => uploadedCategories.has(category)),
      agreement: Boolean(rentalDocumentAgreement?.eligibility?.fullyExecuted)
    },
    org_payment: { ...organizationPaymentSettings(organization), promptpay_qr_url: promptPayQrUrl },
    customerPortalActions: portalActionsResult.data || [],
    deliveryInspection,
    deliveryPhotoUrls: deliveryPhotoUrls.filter(Boolean),
    inspectionReports,
    receipts,
    contractHtml,
    signedContractUrl,
    rentalDocumentAgreement,
    executedAgreementDownloads: executedDownloads
  };
}
