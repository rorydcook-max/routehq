import { buildContractVariables, extractBodyHtml, renderContractTemplate } from "@/lib/contract-rendering";
import { resolveOrganizationBrandingDisplayUrls } from "@/lib/branding-assets";
import { defaultRentalContractTemplate, embedLogoInContractVariables, ensureDefaultContractTemplate } from "@/lib/contracts";
import { getCustomerExecutedAgreementDownload, loadPublicRentalAgreement } from "@/lib/rental-document-customer-signing";
import { ensureRentalAgreementDraft } from "@/lib/rental-agreement-automation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicBookingState = "not_found" | "expired" | "cancelled" | "ready" | "active" | "completed";

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
    return { state: "cancelled" as PublicBookingState, bookingLink };
  }

  const expiresAt = bookingLink.expires_at ? new Date(bookingLink.expires_at) : null;
  if (expiresAt && expiresAt.getTime() < Date.now() && bookingLink.status !== "completed") {
    await supabase.from("booking_links").update({ status: "expired" }).eq("id", bookingLink.id);
    return { state: "expired" as PublicBookingState, bookingLink };
  }

  const shouldLogOpen = ["pending", "sent"].includes(bookingLink.status) && !bookingLink.viewed_at;
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

  const [{ data: organization }, { data: rental }, { data: vehicle }, { data: customer }, { data: contract }, { data: documents }, { data: template }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", bookingLink.organization_id).maybeSingle(),
    bookingLink.rental_id ? supabase.from("rentals").select("*").eq("id", bookingLink.rental_id).maybeSingle() : Promise.resolve({ data: null }),
    bookingLink.vehicle_id ? supabase.from("vehicles").select("*").eq("id", bookingLink.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
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

  const [paymentsResult, portalActionsResult, inspectionsResult] = bookingLink.rental_id
    ? await Promise.all([
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
    : [{ data: [] }, { data: [] }, { data: [] }];

  const outstandingBalance = (paymentsResult.data || []).reduce((sum: number, payment: any) => {
    if (["paid", "voided", "waived", "cancelled"].includes(payment.status)) return sum;
    return sum + Number(payment.amount || 0);
  }, 0);
  const deliveryInspection = inspectionsResult.data?.[0] || null;
  const deliveryPhotos = Array.isArray(deliveryInspection?.photos) ? deliveryInspection.photos : [];
  const deliveryPhotoUrls = await Promise.all(
    deliveryPhotos.map(async (photo: any) => {
      const path = photo?.url || photo?.storage_path || photo?.path;
      if (!path) return null;
      if (/^https?:\/\//.test(path)) return path;
      return (await supabase.storage.from("documents").createSignedUrl(path, 60 * 60)).data?.signedUrl || null;
    })
  );

  const uploadedCategories = new Set((documents || []).map((document: any) => document.category));
  // Every booking needs an agreement in the document engine. Nothing else
  // creates one, so the first time the page opens a draft is made here.
  if (bookingLink.rental_id && bookingLink.status !== "cancelled") {
    await ensureRentalAgreementDraft({ organizationId: bookingLink.organization_id, rentalId: bookingLink.rental_id });
  }
  const rentalDocumentAgreement = await loadPublicRentalAgreement(token);
  const executedDownloads = rentalDocumentAgreement?.eligibility?.fullyExecuted
    ? {
        originalAgreementUrl: await getCustomerExecutedAgreementDownload(token, "original").catch(() => null),
        executionCertificateUrl: await getCustomerExecutedAgreementDownload(token, "certificate").catch(() => null)
      }
    : null;
  const signedContractPath = contract?.content_pdf_url || null;
  const signedContractUrl = signedContractPath
    ? (await supabase.storage.from("documents").createSignedUrl(signedContractPath, 60 * 60)).data?.signedUrl || null
    : null;
  const contractTemplate = template?.content_html || template?.body || contract?.content_html || defaultRentalContractTemplate;
  const organizationBranding = organization
    ? await resolveOrganizationBrandingDisplayUrls(supabase, organization, { allowExternalUrl: true, expiresIn: 60 * 60 })
    : { logoUrl: null, signatureUrl: null };
  const organizationForDisplay = organization
    ? {
        ...organization,
        logo_display_url: organizationBranding.logoUrl,
        owner_signature_display_url: organizationBranding.signatureUrl
      }
    : organization;
  const contractVariables = await embedLogoInContractVariables(
    supabase,
    buildContractVariables({
      organization,
      customer,
      vehicle,
      rental,
      bookingLink
    })
  );
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
    org_payment: organizationPaymentSettings(organization),
    customerPortalActions: portalActionsResult.data || [],
    deliveryInspection,
    deliveryPhotoUrls: deliveryPhotoUrls.filter(Boolean),
    contractHtml,
    signedContractUrl,
    rentalDocumentAgreement,
    executedAgreementDownloads: executedDownloads
  };
}
