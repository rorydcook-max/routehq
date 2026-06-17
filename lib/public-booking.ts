import { buildContractVariables, renderContractTemplate } from "@/lib/contract-rendering";
import { defaultRentalContractTemplate } from "@/lib/default-contract-template";
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
    default_payment_method: acceptedMethods.includes(defaultMethod) ? defaultMethod : "cash"
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
    supabase
      .from("contract_templates")
      .select("*")
      .eq("organization_id", bookingLink.organization_id)
      .eq("is_default", true)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const [paymentsResult, portalActionsResult, inspectionsResult] = bookingLink.rental_id
    ? await Promise.all([
        supabase
          .from("rental_payments")
          .select("amount, amount_paid, status")
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
    if (payment.status === "paid") return sum;
    return sum + Math.max(0, Number(payment.amount || 0) - Number(payment.amount_paid || 0));
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
  const signedContractPath = contract?.content_pdf_url || null;
  const signedContractUrl = signedContractPath
    ? (await supabase.storage.from("documents").createSignedUrl(signedContractPath, 60 * 60)).data?.signedUrl || null
    : null;
  const contractTemplate = template?.content_html || template?.body || contract?.content_html || defaultRentalContractTemplate;
  const contractHtml = renderContractTemplate(
    contractTemplate,
    buildContractVariables({
      organization,
      customer,
      vehicle,
      rental,
      bookingLink
    })
  );

  const rentalStatus = rental?.status || "booked";
  const state = rentalStatus === "cancelled" || bookingLink.status === "cancelled"
    ? "cancelled"
    : rentalStatus === "active" || rentalStatus === "due_soon" || rentalStatus === "overdue" || rentalStatus === "extended"
      ? "active"
      : rentalStatus === "completed" || bookingLink.status === "completed"
        ? "completed"
        : "ready";

  return {
    state: state as PublicBookingState,
    bookingLink,
    organization,
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
      agreement: bookingLink.status === "completed" || contract?.status === "signed"
    },
    org_payment: organizationPaymentSettings(organization),
    customerPortalActions: portalActionsResult.data || [],
    deliveryInspection,
    deliveryPhotoUrls: deliveryPhotoUrls.filter(Boolean),
    contractHtml,
    signedContractUrl
  };
}
