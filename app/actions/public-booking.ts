"use server";

import { headers } from "next/headers";
import { buildContractVariables, renderContractTemplate } from "@/lib/contract-rendering";
import { defaultRentalContractTemplate, embedLogoInContractVariables, ensureDefaultContractTemplate } from "@/lib/contracts";
import { htmlToPdf } from "@/lib/html-to-pdf";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { processCustomerPortalAction } from "@/lib/portal-notifications";
import { notifyContractSigned } from "@/lib/line/notifications";
import { notifyOperator } from "@/lib/notify-operator";
import { generatePaymentSchedule } from "@/lib/payment-schedule";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function optionalString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim() || null;
}

function fullPhone(formData: FormData, codeKey: string, localKey: string) {
  const raw = String(formData.get(localKey) || "").replace(/\s+/g, "").trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith("+")) {
    return raw;
  }
  const code = String(formData.get(codeKey) || "+66").trim();
  const normalized = raw.startsWith("0") ? raw.slice(1) : raw;
  return `${code}${normalized}`;
}

const contactMethods = ["whatsapp", "messenger", "line", "telegram", "sms", "email", "phone"];

function contactChannelFields(formData: FormData, phone: string | null, email: string | null) {
  const whatsappNumber = optionalString(formData, "whatsappNumber") || null;
  const messengerId = optionalString(formData, "messengerId");
  const lineId = optionalString(formData, "lineId");
  const telegramUsername = optionalString(formData, "telegramUsername");
  const instagramHandle = optionalString(formData, "instagramHandle");
  const submittedPreference = optionalString(formData, "preferredContactMethod");
  const inferredPreference = whatsappNumber
    ? "whatsapp"
    : messengerId
      ? "messenger"
      : lineId
        ? "line"
        : telegramUsername
          ? "telegram"
          : email
            ? "email"
            : phone
              ? "phone"
              : null;

  return {
    whatsapp_number: whatsappNumber,
    messenger_id: messengerId,
    line_id: lineId,
    telegram_username: telegramUsername,
    instagram_handle: instagramHandle,
    preferred_contact_method: submittedPreference && contactMethods.includes(submittedPreference) ? submittedPreference : inferredPreference
  };
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function documentStatus(categories: string[]) {
  const set = new Set(categories);
  if (["passport", "driver_license", "selfie"].every((category) => set.has(category))) {
    return "complete";
  }
  if (set.size === 0) {
    return "no_documents";
  }
  return "missing_documents";
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

async function logCommunicationEvent({
  supabase,
  organizationId,
  rentalId,
  customerId,
  type,
  content,
  channel = "booking_portal",
  direction = "inbound",
  status = "sent",
  metadata = {}
}: {
  supabase: any;
  organizationId: string;
  rentalId: string | null;
  customerId?: string | null;
  type: "automated_reminder" | "manual_note" | "customer_portal_action" | "booking_link_activity" | "operator_message" | "system_event";
  content: string;
  channel?: string | null;
  direction?: "outbound" | "inbound" | "internal";
  status?: "pending" | "sent" | "failed" | "read";
  metadata?: Record<string, unknown>;
}) {
  if (!rentalId) return;
  await supabase.from("communication_log").insert({
    organisation_id: organizationId,
    rental_id: rentalId,
    customer_id: customerId || null,
    type,
    channel,
    direction,
    content,
    status,
    metadata
  });
}

async function generateScheduleAfterPublicCompletion({
  supabase,
  bookingLink,
  rental,
  preferredDeliveryDateTime,
  effectivePaymentTiming
}: {
  supabase: any;
  bookingLink: any;
  rental: any;
  preferredDeliveryDateTime: string | null;
  effectivePaymentTiming: "now" | "on_delivery";
}) {
  const { data: existing } = await supabase
    .from("rental_payments")
    .select("id")
    .eq("rental_id", rental.id)
    .neq("status", "voided")
    .limit(1);

  if (existing && existing.length > 0) {
    return;
  }

  const bookingData = (bookingLink.booking_data || {}) as Record<string, any>;
  const deliveryDate =
    preferredDeliveryDateTime ||
    rental.delivery_datetime ||
    bookingData.delivery_datetime ||
    rental.start_date ||
    todayDate();
  const upfrontPeriods = Number(rental.upfront_periods || bookingData.upfront_periods || 0);
  const upfrontRate = Number(rental.upfront_rate || bookingData.upfront_rate || 0) || null;

  await generatePaymentSchedule({
    supabase,
    organisationId: rental.organization_id,
    rentalId: rental.id,
    rentalRate: Number(rental.rental_rate || 0),
    depositAmount: Number(rental.deposit_amount || 0),
    deliveryDate,
    endDate: rental.end_date || null,
    billingPeriod: rental.billing_interval || rental.pricing_model || "monthly",
    upfrontPeriods: effectivePaymentTiming === "now" ? upfrontPeriods : 0,
    upfrontRate
  });
}

async function uploadPublicCustomerDocument({
  supabase,
  organizationId,
  customerId,
  category,
  file
}: {
  supabase: any;
  organizationId: string;
  customerId: string;
  category: string;
  file: File;
}) {
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  const storagePath = `${organizationId}/customers/${customerId}/documents/${category}-${crypto.randomUUID()}-${safeFileName(file.name || `${category}.upload`)}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      organization_id: organizationId,
      owner_type: "customer",
      owner_id: customerId,
      storage_bucket: "documents",
      storage_path: storagePath,
      file_name: file.name || `${category}.upload`,
      mime_type: file.type || null,
      size_bytes: file.size,
      category,
      ocr_status: "queued",
      extracted_data: {}
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

async function uploadSignedContract({
  supabase,
  organizationId,
  contractId,
  html
}: {
  supabase: any;
  organizationId: string;
  contractId: string;
  html: string;
}) {
  const storagePath = `${organizationId}/contracts/${contractId}/signed-contract-${Date.now()}.pdf`;
  const file = await htmlToPdf(html);
  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, {
    contentType: "application/pdf",
    upsert: true
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      organization_id: organizationId,
      owner_type: "contract",
      owner_id: contractId,
      storage_bucket: "documents",
      storage_path: storagePath,
      file_name: "signed-contract.pdf",
      mime_type: "application/pdf",
      size_bytes: file.byteLength,
      category: "rental_agreement",
      ocr_status: "not_started",
      extracted_data: {}
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { documentId: data.id as string, storagePath };
}

export async function reportPublicBookingPayment(formData: FormData) {
  const token = requiredString(formData, "token");
  const method = optionalString(formData, "preferredPaymentMethod");
  const timing = optionalString(formData, "paymentTiming");
  const supabase = createSupabaseAdminClient() as any;

  const { data: bookingLink, error: bookingError } = await supabase
    .from("booking_links")
    .select("*")
    .eq("token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (bookingError || !bookingLink) {
    throw new Error("This booking link could not be found.");
  }
  if (bookingLink.status === "cancelled") {
    throw new Error("This booking has been cancelled.");
  }

  const reportedAt = new Date().toISOString();
  const { error } = await supabase
    .from("booking_links")
    .update({
      payment_reported_by_customer: true,
      payment_reported_at: reportedAt,
      ...(method ? { preferred_payment_method: method } : {}),
      ...(timing ? { payment_timing: timing === "now" ? "now" : "on_delivery" } : {})
    })
    .eq("id", bookingLink.id)
    .eq("organization_id", bookingLink.organization_id);

  if (error) {
    throw new Error(error.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: bookingLink.organization_id,
    entity_type: "rental",
    entity_id: bookingLink.rental_id,
    vehicle_id: bookingLink.vehicle_id,
    rental_id: bookingLink.rental_id,
    customer_id: bookingLink.customer_id,
    event_type: "payment_reported_by_customer",
    title: "Customer reported payment",
    detail: `Customer reported ${method || "a"} payment through the booking link.`
  });

  await logCommunicationEvent({
    supabase,
    organizationId: bookingLink.organization_id,
    rentalId: bookingLink.rental_id,
    customerId: bookingLink.customer_id,
    type: "booking_link_activity",
    content: `Customer reported payment sent via ${method || "selected payment method"}`,
    metadata: { booking_link_id: bookingLink.id, payment_method: method, payment_timing: timing }
  });

  return { success: true, paymentReportedAt: reportedAt };
}

export async function submitCustomerPortalAction(formData: FormData) {
  const token = requiredString(formData, "token");
  const actionType = requiredString(formData, "actionType");
  const supabase = createSupabaseAdminClient() as any;

  const { data: bookingLink, error: bookingError } = await supabase
    .from("booking_links")
    .select("*")
    .eq("token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (bookingError || !bookingLink?.rental_id) {
    throw new Error("This booking link could not be found.");
  }

  const content: Record<string, unknown> = {};
  if (actionType === "extension_request") {
    content.new_end_date = requiredString(formData, "newEndDate");
    content.note = optionalString(formData, "note");
  } else if (actionType === "return_confirmation") {
    content.return_date = requiredString(formData, "returnDate");
    content.return_time = requiredString(formData, "returnTime");
    content.return_location = optionalString(formData, "returnLocation");
    content.note = optionalString(formData, "note");
  } else if (actionType === "problem_report") {
    content.category = requiredString(formData, "category");
    content.description = requiredString(formData, "description");
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const storagePath = `${bookingLink.organization_id}/portal-actions/${bookingLink.rental_id}/${crypto.randomUUID()}-${safeFileName(photo.name || "problem-photo")}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, photo, {
        contentType: photo.type || undefined,
        upsert: false
      });
      if (uploadError) throw new Error(uploadError.message);
      content.photo_path = storagePath;
    }
  } else if (actionType === "question") {
    content.question = requiredString(formData, "question");
  } else {
    throw new Error("Unsupported portal action.");
  }

  const { data: action, error } = await supabase
    .from("customer_portal_actions")
    .insert({
      organisation_id: bookingLink.organization_id,
      rental_id: bookingLink.rental_id,
      customer_id: bookingLink.customer_id,
      booking_link_token: token,
      action_type: actionType,
      content,
      status: "pending"
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await logCommunicationEvent({
    supabase,
    organizationId: bookingLink.organization_id,
    rentalId: bookingLink.rental_id,
    customerId: bookingLink.customer_id,
    type: "customer_portal_action",
    content: portalActionCommunicationText(actionType, content),
    metadata: { booking_link_id: bookingLink.id, customer_portal_action_id: action.id, action_type: actionType }
  });

  await processCustomerPortalAction(supabase, action.id);

  const portalActionMessages: Record<string, string> = {
    extension_request: `📅 Extension requested — customer wants to extend their rental`,
    return_confirmation: `✅ Customer confirmed their return date`,
    problem_report: `⚠️ Customer reported a problem with their rental`,
    question: `💬 Customer asked a question via the booking portal`
  };
  const notifyMsg = portalActionMessages[actionType] ?? `📣 Customer submitted a portal action: ${actionType}`;
  notifyOperator(bookingLink.organization_id, notifyMsg, "portal_action").catch(() => null);

  return { success: true, actionType };
}

function portalActionCommunicationText(actionType: string, content: Record<string, unknown>) {
  if (actionType === "extension_request") return `Customer requested an extension to ${content.new_end_date || "a new return date"}`;
  if (actionType === "return_confirmation") return `Customer confirmed return ${content.return_date || ""} ${content.return_time || ""}${content.return_location ? ` at ${content.return_location}` : ""}`.trim();
  if (actionType === "problem_report") return `Customer reported a problem: ${content.category || "Other"}`;
  if (actionType === "question") return "Customer asked a question through the booking portal";
  return "Customer submitted a booking portal action";
}

export async function completePublicBooking(formData: FormData) {
  const token = requiredString(formData, "token");
  const signature = requiredString(formData, "signature");
  const signedName = requiredString(formData, "signedName");
  const supabase = createSupabaseAdminClient() as any;

  if (signature.length > 280_000) {
    throw new Error("Signature is too large. Please clear and sign again.");
  }

  const { data: bookingLink, error: bookingError } = await supabase
    .from("booking_links")
    .select("*")
    .eq("token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (bookingError || !bookingLink) {
    throw new Error("This booking link could not be found.");
  }
  if (bookingLink.status === "cancelled") {
    throw new Error("This booking has been cancelled.");
  }
  if (bookingLink.expires_at && new Date(bookingLink.expires_at).getTime() < Date.now()) {
    await supabase.from("booking_links").update({ status: "expired" }).eq("id", bookingLink.id);
    throw new Error("This booking link has expired.");
  }
  // customer_id may be null when the booking was created without a customer —
  // we create the customer record from the submitted form data in that case.
  if (!bookingLink.rental_id || !bookingLink.vehicle_id || !bookingLink.contract_id) {
    throw new Error("This booking link is missing required records.");
  }

  const organizationId = bookingLink.organization_id as string;
  let customerId = bookingLink.customer_id as string | null;
  const contractId = bookingLink.contract_id as string;
  const preferredDeliveryLocation = optionalString(formData, "preferredDeliveryLocation");
  const preferredDeliveryDateTime = optionalString(formData, "preferredDeliveryDateTime");
  const preferredPaymentMethod = optionalString(formData, "preferredPaymentMethod");
  const paymentTiming = optionalString(formData, "paymentTiming");
  const customerUpfrontPeriods = Number(formData.get("upfrontPeriods") || 0);
  const customerUpfrontRate = Number(formData.get("upfrontRate") || 0) || null;
  const existingDeliveryDateTime = String(((bookingLink.booking_data || {}) as Record<string, unknown>).delivery_datetime || "").slice(0, 16);

  if (preferredDeliveryDateTime && preferredDeliveryDateTime !== existingDeliveryDateTime && new Date(preferredDeliveryDateTime).getTime() < Date.now()) {
    throw new Error("Choose a delivery time that is not in the past.");
  }

  // Parse submitted personal details (required for both create and update paths)
  const fullName = requiredString(formData, "fullName");
  const phone = fullPhone(formData, "phoneCountryCode", "phone") || requiredString(formData, "phone");
  const email = optionalString(formData, "email");
  const nationality = requiredString(formData, "nationality");
  const emergencyPhone = fullPhone(formData, "emergencyPhoneCountryCode", "emergencyContactPhone");
  const contactFields = formData.has("contactChannelsSubmitted") ? contactChannelFields(formData, phone, email) : {};

  if (!customerId) {
    // No customer linked yet — create a new record from form data, then link it everywhere
    const { data: newCustomer, error: createError } = await supabase
      .from("customers")
      .insert({
        organization_id: organizationId,
        full_name: fullName,
        phone,
        whatsapp: phone,
        email,
        nationality,
        ...contactFields,
        date_of_birth: optionalString(formData, "dateOfBirth"),
        address: optionalString(formData, "address"),
        emergency_contact_name: optionalString(formData, "emergencyContactName"),
        emergency_contact_phone: emergencyPhone,
        preferred_locale: optionalString(formData, "preferredLocale") || "en",
        document_status: "no_documents"
      })
      .select("id")
      .single();

    if (createError || !newCustomer) {
      throw new Error(createError?.message || "Failed to create customer record.");
    }
    customerId = newCustomer.id as string;

    // Link the new customer to all related records in parallel
    await Promise.all([
      supabase.from("booking_links").update({ customer_id: customerId }).eq("id", bookingLink.id),
      supabase.from("rentals").update({ customer_id: customerId }).eq("id", bookingLink.rental_id),
      supabase.from("contracts").update({ customer_id: customerId }).eq("id", contractId),
      supabase.from("vehicles").update({ current_customer_id: customerId }).eq("id", bookingLink.vehicle_id)
    ]);
  } else {
    // Customer already linked — update their details with the submitted form data
    const { error: customerError } = await supabase
      .from("customers")
      .update({
        full_name: fullName,
        phone,
        whatsapp: phone,
        email,
        nationality,
        ...contactFields,
        date_of_birth: optionalString(formData, "dateOfBirth"),
        address: optionalString(formData, "address"),
        emergency_contact_name: optionalString(formData, "emergencyContactName"),
        emergency_contact_phone: emergencyPhone,
        preferred_locale: optionalString(formData, "preferredLocale") || "en"
      })
      .eq("id", customerId)
      .eq("organization_id", organizationId);

    if (customerError) {
      throw new Error(customerError.message);
    }
  }

  // customerId is guaranteed non-null beyond this point
  const uploads = [
    { keys: ["passportFile", "passportCameraFile"], category: "passport" },
    { keys: ["driverLicenseFile", "driverLicenseCameraFile"], category: "driver_license" },
    { keys: ["selfieFile", "selfieCameraFile"], category: "selfie" }
  ];

  for (const upload of uploads) {
    const file = upload.keys.flatMap((key) => formData.getAll(key)).find((value) => value instanceof File && value.size > 0);
    if (file instanceof File) {
      await uploadPublicCustomerDocument({
        supabase,
        organizationId,
        customerId,
        category: upload.category,
        file
      });
    }
  }

  const { data: documents } = await supabase
    .from("documents")
    .select("category")
    .eq("organization_id", organizationId)
    .eq("owner_type", "customer")
    .eq("owner_id", customerId)
    .is("deleted_at", null);
  const customerDocumentStatus = documentStatus((documents || []).map((document: any) => document.category));

  await supabase.from("customers").update({ document_status: customerDocumentStatus }).eq("id", customerId).eq("organization_id", organizationId);

  const [{ data: organization }, { data: rental }, { data: vehicle }, { data: customer }, template] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", organizationId).maybeSingle(),
    supabase.from("rentals").select("*").eq("id", bookingLink.rental_id).maybeSingle(),
    supabase.from("vehicles").select("*").eq("id", bookingLink.vehicle_id).maybeSingle(),
    supabase.from("customers").select("*").eq("id", customerId).maybeSingle(),
    ensureDefaultContractTemplate(supabase, organizationId)
  ]);

  if (!rental) {
    throw new Error("Rental record was not found.");
  }

  const contractTemplate = template?.content_html || template?.body || defaultRentalContractTemplate;
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
  const bodyHtml = renderContractTemplate(contractTemplate, contractVariables);
  const signedHtml = `${bodyHtml}
    <hr />
    <h3>Customer Signature</h3>
    <p>Signed by ${signedName} on ${new Date().toLocaleString("en-TH")}.</p>
    <img alt="Customer signature" src="${signature}" style="max-width: 320px; border: 1px solid #d6e5e2; border-radius: 8px;" />
  `;
  const headerStore = await headers();
  const customerIp = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || null;
  const signedAt = new Date().toISOString();
  const contractUpload = await uploadSignedContract({
    supabase,
    organizationId,
    contractId,
    html: signedHtml
  });

  const updatedBookingData = {
    ...((bookingLink.booking_data || {}) as Record<string, unknown>),
    ...(preferredDeliveryLocation ? { delivery_location: preferredDeliveryLocation } : {}),
    ...(preferredDeliveryDateTime ? { delivery_datetime: preferredDeliveryDateTime } : {}),
    ...(preferredDeliveryLocation || preferredDeliveryDateTime ? { delivery_details_submitted_by_customer: true } : {})
  };

  const requestedPaymentTiming = paymentTiming === "now" ? "now" : "on_delivery";
  const deliveryDatetime = rental.delivery_datetime ? new Date(rental.delivery_datetime) : preferredDeliveryDateTime ? new Date(preferredDeliveryDateTime) : null;
  const isDeliveryNowOrPast = deliveryDatetime ? deliveryDatetime.getTime() <= Date.now() : false;
  const effectivePaymentTiming = isDeliveryNowOrPast ? "now" : requestedPaymentTiming;
  const rentalPaymentUpdate =
    effectivePaymentTiming === "now"
      ? {
          payment_due_trigger: "immediate",
          payment_due_after_delivery: false,
          first_payment_amount: null,
          deposit_payment_amount: null
        }
      : {
          payment_due_trigger: "on_delivery",
          payment_due_after_delivery: true,
          first_payment_amount: Number(rental.rental_rate || 0),
          deposit_payment_amount: Number(rental.deposit_amount || 0)
        };

  const rentalUpdate = supabase
    .from("rentals")
    .update({
      ...(preferredDeliveryLocation ? { delivery_location: preferredDeliveryLocation } : {}),
      ...(preferredDeliveryDateTime ? { delivery_datetime: preferredDeliveryDateTime } : {}),
      ...rentalPaymentUpdate,
      ...(customerUpfrontPeriods > 0 && !rental.upfront_periods ? { upfront_periods: customerUpfrontPeriods, upfront_rate: customerUpfrontRate, upfront_accepted: true } : {})
    })
    .eq("id", bookingLink.rental_id)
    .eq("organization_id", organizationId);

  const [{ error: contractError }, { error: bookingUpdateError }, { error: rentalUpdateError }] = await Promise.all([
    supabase
      .from("contracts")
      .update({
        status: "signed",
        content_html: signedHtml,
        content_pdf_url: contractUpload.storagePath,
        document_id: contractUpload.documentId,
        customer_signature: signature,
        customer_signed_at: signedAt,
        customer_signed_name: signedName,
        customer_signed_ip: customerIp,
        signed_at: signedAt
      })
      .eq("id", contractId)
      .eq("organization_id", organizationId),
    supabase
      .from("booking_links")
      .update({
        status: "completed",
        booking_data: updatedBookingData,
        preferred_payment_method: preferredPaymentMethod,
        payment_timing: effectivePaymentTiming,
        customer_details_submitted_at: bookingLink.customer_details_submitted_at || signedAt,
        documents_uploaded_at: customerDocumentStatus === "complete" ? signedAt : bookingLink.documents_uploaded_at,
        contract_signed_at: signedAt,
        completed_at: signedAt
      })
      .eq("id", bookingLink.id)
      .eq("organization_id", organizationId),
    rentalUpdate
  ]);

  if (contractError || bookingUpdateError || rentalUpdateError) {
    throw new Error(contractError?.message || bookingUpdateError?.message || rentalUpdateError?.message || "Unable to complete booking.");
  }

  await generateScheduleAfterPublicCompletion({
    supabase,
    bookingLink,
    rental: {
      ...rental,
      customer_id: customerId,
      ...(customerUpfrontPeriods > 0 && !rental.upfront_periods ? { upfront_periods: customerUpfrontPeriods, upfront_rate: customerUpfrontRate } : {})
    },
    preferredDeliveryDateTime,
    effectivePaymentTiming
  });

  await Promise.all([
    recordActivityEvent(supabase, {
      organization_id: organizationId,
      entity_type: "rental",
      entity_id: bookingLink.rental_id,
      vehicle_id: bookingLink.vehicle_id,
      rental_id: bookingLink.rental_id,
      customer_id: customerId,
      event_type: "booking_completed",
      title: "Booking completed",
      detail: [
        `${fullName} completed their details and signed the rental agreement.`,
        preferredPaymentMethod ? `Preferred payment: ${preferredPaymentMethod} (${effectivePaymentTiming === "now" ? "pay now" : "pay on delivery"}).` : ""
      ].filter(Boolean).join(" ")
    }),
    supabase.from("notifications").insert({
      organization_id: organizationId,
      customer_id: customerId,
      rental_id: bookingLink.rental_id,
      vehicle_id: bookingLink.vehicle_id,
      channel: "in_app",
      provider: "fleetos",
      locale: "en",
      status: "queued",
      recipient: organizationId,
      subject: `${fullName} has completed their booking details`,
      body: `${fullName} has completed their details and signed the rental agreement.`,
      metadata: { booking_link_id: bookingLink.id }
    }),
    logCommunicationEvent({
      supabase,
      organizationId,
      rentalId: bookingLink.rental_id,
      customerId,
      type: "booking_link_activity",
      content: "Customer submitted personal details and documents",
      metadata: { booking_link_id: bookingLink.id, document_status: customerDocumentStatus }
    }),
    logCommunicationEvent({
      supabase,
      organizationId,
      rentalId: bookingLink.rental_id,
      customerId,
      type: "booking_link_activity",
      content: "Customer signed rental contract",
      metadata: { booking_link_id: bookingLink.id, contract_id: contractId, signed_at: signedAt }
    })
  ]);

  const vehicleLabel = vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.registration_number})` : "";
  const customerDisplayName = customer?.full_name || signedName;

  notifyContractSigned({ customerName: customerDisplayName, vehicleLabel }).catch(() => null);

  notifyOperator(
    organizationId,
    `✅ ${customerDisplayName} completed booking form for ${vehicleLabel || "their vehicle"}`,
    "booking_form_completed"
  ).catch(() => null);

  notifyOperator(
    organizationId,
    `✍️ ${customerDisplayName} signed the rental contract for ${vehicleLabel || "their vehicle"}`,
    "contract_signed"
  ).catch(() => null);

  const { data: signedUrl } = await supabase.storage.from("documents").createSignedUrl(contractUpload.storagePath, 60 * 60);
  return {
    success: true,
    signedContractUrl: signedUrl?.signedUrl || null
  };
}
