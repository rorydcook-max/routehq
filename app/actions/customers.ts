"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildDocumentStoragePath } from "@/services/documents/storage-path";
import { cleanDvlaCode, cleanTcKimlikNo, licenceCategoriesText } from "@/lib/licence";
import { guard, userError } from "@/lib/action-error";
const contactMethods = ["whatsapp", "messenger", "line", "telegram", "sms", "email", "phone"];

function optionalString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim() || null;
}

function fullPhone(formData: FormData, codeKey: string, localKey: string) {
  const raw = String(formData.get(localKey) || "").replace(/[\s\-().]+/g, "").trim();
  if (!raw) {
    return null;
  }
  // Words ("call me maybe") or a number too short to dial are not saved as a phone (real-user test, 8 Nov 2026).
  if (!/^\+?\d+$/.test(raw) || raw.replace(/\D/g, "").length < (raw.startsWith("+") ? 8 : 6)) {
    throw new Error("Check the phone number.");
  }
  if (raw.startsWith("+")) {
    return raw;
  }
  // No country code chosen: keep the number as typed rather than guess a country.
  const code = String(formData.get(codeKey) || "").trim();
  if (!/^\+\d{1,4}$/.test(code)) return raw;
  const normalized = raw.startsWith("0") ? raw.slice(1) : raw;
  return `${code}${normalized}`;
}

function contactChannelFields(formData: FormData, phone: string | null, email?: string | null) {
  const whatsappNumber = optionalString(formData, "whatsappNumber") || phone;
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

function documentStatusFromCategories(categories: string[]) {
  const normalized = categories.map((category) => category.toLowerCase());
  const hasPassport = normalized.some((category) => category.includes("passport"));
  const hasLicense = normalized.some((category) => category.includes("license") || category.includes("licence"));
  const hasSelfie = normalized.some((category) => category.includes("selfie") || category.includes("photo"));
  const count = [hasPassport, hasLicense, hasSelfie].filter(Boolean).length;

  if (count === 3) {
    return "complete";
  }
  if (count === 0) {
    return "no_documents";
  }
  return "missing_documents";
}

async function uploadCustomerDocumentFile({
  supabase,
  file,
  organizationId,
  customerId,
  userId,
  category
}: {
  supabase: any;
  file: File;
  organizationId: string;
  customerId: string;
  userId: string;
  category: string;
}) {
  if (!file || file.size === 0) {
    return null;
  }

  const storagePath = buildDocumentStoragePath({
    organizationId,
    ownerType: "customer",
    ownerId: customerId,
    fileName: file.name || `${category}.upload`
  });
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
      extracted_data: {},
      uploaded_by: userId
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id as string;
}

async function createCustomerDocumentUploads(supabase: any, formData: FormData, organizationId: string, customerId: string, userId: string) {
  const uploads = [
    { key: "passportFile", category: "passport" },
    { key: "driverLicenseFile", category: "driver_license" },
    { key: "selfieFile", category: "selfie" }
  ];
  const uploadedCategories: string[] = [];

  for (const upload of uploads) {
    const file = formData.get(upload.key);
    if (file instanceof File && file.size > 0) {
      await uploadCustomerDocumentFile({
        supabase,
        file,
        organizationId,
        customerId,
        userId,
        category: upload.category
      });
      uploadedCategories.push(upload.category);
    }
  }

  const documentStatus = documentStatusFromCategories(uploadedCategories);
  const { error } = await supabase.from("customers").update({ document_status: documentStatus }).eq("id", customerId).eq("organization_id", organizationId);
  if (error) {
    throw new Error(error.message);
  }
}

/** The Add customer page. A reason it can't be saved comes back as `{ actionError }` for the form to show. */
export async function createCustomer(formData: FormData) {
  return guard(() => createCustomerOrThrow(formData), "Couldn't add the customer. Nothing was saved.");
}

async function createCustomerOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = String(formData.get("organizationId") || "");
  const fullName = String(formData.get("fullName") || "").trim();
  const phone = fullPhone(formData, "phoneCountryCode", "phone");
  const email = optionalString(formData, "email");
  const nationality = optionalString(formData, "nationality");

  const channels = contactChannelFields(formData, phone, email);
  const hasContact = Boolean(phone || email || channels.messenger_id || channels.line_id || channels.telegram_username || channels.instagram_handle || channels.whatsapp_number);
  if (!organizationId || !fullName || !hasContact) {
    throw new Error("Add a name and one way to reach them.");
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: organizationId,
      full_name: fullName,
      phone,
      whatsapp: phone,
      email,
      nationality,
      ...channels,
      preferred_locale: optionalString(formData, "preferredLocale") || "en",
      passport_number: optionalString(formData, "passportNumber"),
      passport_expiry: optionalString(formData, "passportExpiry"),
      driver_license_number: optionalString(formData, "driverLicenseNumber"),
      driver_license_expiry: optionalString(formData, "driverLicenseExpiry"),
      driver_license_country: optionalString(formData, "driverLicenseCountry"),
      emergency_contact_name: optionalString(formData, "emergencyContactName"),
      emergency_contact_phone: fullPhone(formData, "emergencyPhoneCountryCode", "emergencyContactPhone"),
      notes: optionalString(formData, "notes"),
      document_status: "no_documents",
      created_by: user.id
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create customer.");
  }

  // The customer is saved by now: a photo that fails to upload must not show an error that makes the owner add them twice.
  // The customer's page shows which documents are missing, and they can be added there.
  await createCustomerDocumentUploads(supabase, formData, organizationId, data.id, user.id).catch((uploadError) =>
    console.warn("[createCustomer] document upload:", uploadError instanceof Error ? uploadError.message : uploadError)
  );

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "customer",
    entity_id: data.id,
    customer_id: data.id,
    event_type: "customer_created",
    title: "Customer created",
    detail: `${fullName} added to CRM.`
  });

  revalidatePath("/");
  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

/** Someone already saved with this phone number, so the owner can open them instead of adding them twice. */
export async function customerWithPhone(organizationId: string, code: string, local: string) {
  const digits = String(local || "").replace(/[\s\-().]+/g, "");
  if (!organizationId || digits.replace(/\D/g, "").length < 6) return null;
  const cleanCode = String(code || "").trim();
  const phone = digits.startsWith("+") || !cleanCode ? digits : `${cleanCode}${digits.startsWith("0") ? digits.slice(1) : digits}`;
  const supabase = (await createSupabaseServerClient()) as any;
  const { data } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .or(`phone.eq.${phone},whatsapp.eq.${phone}`)
    .limit(1)
    .maybeSingle();
  return data ? { id: String(data.id), name: String(data.full_name || "") } : null;
}

/**
 * Someone already saved with this phone, email, Messenger, LINE, Telegram or Instagram (real-user test, 8 Nov 2026:
 * only the phone was checked). Handles are compared without "@" and ignoring case.
 */
export async function customerWithContact(
  organizationId: string,
  fields: { code?: string; phone?: string; whatsapp?: string; email?: string; messenger?: string; line?: string; telegram?: string; instagram?: string }
) {
  if (!organizationId) return null;
  const byPhone = fields.phone ? await customerWithPhone(organizationId, fields.code || "", fields.phone) : null;
  if (byPhone) return byPhone;
  const byWhatsapp = fields.whatsapp ? await customerWithPhone(organizationId, fields.code || "", fields.whatsapp) : null;
  if (byWhatsapp) return byWhatsapp;
  // A value inside PostgREST's or(): quoted, with LIKE wildcards taken literally.
  const quoted = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[%_]/g, (match) => `\\${match}`)}"`;
  const conditions: string[] = [];
  const email = String(fields.email || "").trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) conditions.push(`email.ilike.${quoted(email)}`);
  const handles: Array<[string, string | undefined]> = [
    ["messenger_id", fields.messenger],
    ["line_id", fields.line],
    ["telegram_username", fields.telegram],
    ["instagram_handle", fields.instagram]
  ];
  for (const [column, raw] of handles) {
    const handle = String(raw || "").trim().replace(/^@/, "");
    if (handle.length < 3) continue;
    conditions.push(`${column}.ilike.${quoted(handle)}`, `${column}.ilike.${quoted(`@${handle}`)}`);
  }
  if (!conditions.length) return null;
  const supabase = (await createSupabaseServerClient()) as any;
  const { data } = await supabase
    .from("customers")
    .select("id, full_name")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .or(conditions.join(","))
    .limit(1)
    .maybeSingle();
  return data ? { id: String(data.id), name: String(data.full_name || "") } : null;
}

/** "Add a new customer" inside the booking form. A reason it can't be saved comes back as `{ actionError }`. */
export async function createInlineCustomer(formData: FormData) {
  return guard(() => createInlineCustomerOrThrow(formData), "Couldn't add the customer. Nothing was saved.");
}

async function createInlineCustomerOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const organizationId = String(formData.get("organizationId") || "");
  const fullName = String(formData.get("fullName") || "").trim();
  const phone = fullPhone(formData, "phoneCountryCode", "phone");
  const nationality = optionalString(formData, "nationality");
  const email = optionalString(formData, "email");

  // A phone isn't required when the owner reaches the customer another way, e.g. a Messenger link
  // (Rory, 8 Nov 2026: a customer with only a Facebook profile couldn't be added). Name plus any one contact is enough.
  const channels = contactChannelFields(formData, phone, email);
  const hasContact = Boolean(phone || email || channels.messenger_id || channels.line_id || channels.telegram_username || channels.instagram_handle || channels.whatsapp_number);
  if (!organizationId || !fullName || !hasContact) {
    throw new Error("Add a name and one way to reach them.");
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: organizationId,
      full_name: fullName,
      phone,
      whatsapp: phone,
      email,
      nationality,
      ...channels,
      preferred_locale: "en",
      document_status: "no_documents",
      created_by: user.id
    })
    .select("id, full_name, phone, nationality, document_status")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create customer.");
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "customer",
    entity_id: data.id,
    customer_id: data.id,
    event_type: "customer_created",
    title: "Customer created",
    detail: `${fullName} added inline during booking.`
  });

  revalidatePath("/customers");
  return {
    id: data.id as string,
    full_name: data.full_name as string,
    phone: (data.phone as string | null) || null,
    nationality: (data.nationality as string | null) || null,
    document_status: (data.document_status as string | null) || "no_documents",
    label: data.phone ? `${data.full_name} · ${data.phone}` : String(data.full_name)
  };
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function updateCustomer(...args: Parameters<typeof updateCustomerOrThrow>) {
  return guard(() => updateCustomerOrThrow(...args));
}

async function updateCustomerOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const customerId = String(formData.get("customerId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const fullName = optionalString(formData, "fullName");
  const notes = formData.has("notes") ? String(formData.get("notes") || "") : undefined;

  if (!customerId || !organizationId) {
    throw new Error("Customer is required.");
  }

  const updates: Record<string, unknown> = {};
  if (fullName) updates.full_name = fullName;
  if (formData.has("email")) updates.email = optionalString(formData, "email");
  if (formData.has("phone")) updates.phone = fullPhone(formData, "phoneCountryCode", "phone") || optionalString(formData, "phone");
  if (formData.has("whatsappNumber")) updates.whatsapp_number = optionalString(formData, "whatsappNumber");
  if (formData.has("messengerId")) updates.messenger_id = optionalString(formData, "messengerId");
  if (formData.has("lineId")) updates.line_id = optionalString(formData, "lineId");
  if (formData.has("telegramUsername")) updates.telegram_username = optionalString(formData, "telegramUsername");
  if (formData.has("instagramHandle")) updates.instagram_handle = optionalString(formData, "instagramHandle");
  if (formData.has("preferredContactMethod")) {
    const preferredContactMethod = optionalString(formData, "preferredContactMethod");
    updates.preferred_contact_method = preferredContactMethod && contactMethods.includes(preferredContactMethod) ? preferredContactMethod : null;
  }
  if (formData.has("nationality")) updates.nationality = optionalString(formData, "nationality");
  if (formData.has("preferredLocale")) updates.preferred_locale = optionalString(formData, "preferredLocale") || "en";
  if (formData.has("passportNumber")) updates.passport_number = optionalString(formData, "passportNumber");
  if (formData.has("passportExpiry")) updates.passport_expiry = optionalString(formData, "passportExpiry");
  if (formData.has("driverLicenseNumber")) updates.driver_license_number = optionalString(formData, "driverLicenseNumber");
  if (formData.has("driverLicenseExpiry")) updates.driver_license_expiry = optionalString(formData, "driverLicenseExpiry");
  if (formData.has("driverLicenseCountry")) updates.driver_license_country = optionalString(formData, "driverLicenseCountry");
  // EU licence categories (AM, A1, A2, A, B, BE...) and, for UK businesses, the DVLA check code.
  if (formData.has("licenceCategoriesShown")) updates.license_type = licenceCategoriesText(formData.getAll("licenceCategories")) || null;
  // Countries without EU-style categories: the class as written on their licence.
  if (formData.has("licenceClassText")) updates.license_type = optionalString(formData, "licenceClassText");
  if (formData.has("dvlaCheckCode")) updates.dvla_check_code = cleanDvlaCode(formData.get("dvlaCheckCode")) || null;
  // Türkiye: the KABİS details (lib/kabis.ts). A T.C. Kimlik No that fails its checksum is not saved, so the
  // KABİS block shows it as missing rather than copying a typo into the police system.
  if (formData.has("nationalIdNumber")) updates.national_id_number = cleanTcKimlikNo(formData.get("nationalIdNumber")) || null;
  if (formData.has("driverLicenseIssued")) updates.driver_license_issued = optionalString(formData, "driverLicenseIssued");
  if (formData.has("dateOfBirth")) updates.date_of_birth = optionalString(formData, "dateOfBirth");
  if (formData.has("address")) updates.address = optionalString(formData, "address");
  if (formData.has("emergencyContactName")) updates.emergency_contact_name = optionalString(formData, "emergencyContactName");
  if (formData.has("emergencyContactPhone")) updates.emergency_contact_phone = fullPhone(formData, "emergencyPhoneCountryCode", "emergencyContactPhone");
  if (notes !== undefined) updates.notes = notes;
  // Phone removed: the WhatsApp copy of that same number goes too, or messages keep going to a number that was taken off.
  if (formData.has("phone") && !updates.phone) {
    const { data: before } = await supabase.from("customers").select("phone, whatsapp_number").eq("id", customerId).eq("organization_id", organizationId).maybeSingle();
    const digits = (value: unknown) => String(value || "").replace(/\D/g, "");
    const oldPhone = digits(before?.phone);
    if (oldPhone && digits(before?.whatsapp_number) === oldPhone && (!formData.has("whatsappNumber") || !updates.whatsapp_number || digits(updates.whatsapp_number) === oldPhone)) {
      updates.whatsapp_number = null;
      updates.whatsapp = null;
    }
  }
  // "Don't rent to them again": a warning whenever they are picked for a booking, with the reason.
  if (formData.has("doNotRent")) {
    const on = String(formData.get("doNotRent")) === "true";
    updates.do_not_rent = on;
    updates.do_not_rent_reason = on ? optionalString(formData, "doNotRentReason") : null;
    updates.do_not_rent_at = on ? new Date().toISOString() : null;
  }

  const { error } = await supabase.from("customers").update(updates).eq("id", customerId).eq("organization_id", organizationId);
  if (error) {
    throw new Error(error.message);
  }
  // Passport or national ID card: saved on its own so a database without the column yet (migration 0142) still saves the rest.
  const idDocumentType = optionalString(formData, "idDocumentType");
  if (idDocumentType === "passport" || idDocumentType === "national_id") {
    await supabase.from("customers").update({ id_document_type: idDocumentType }).eq("id", customerId).eq("organization_id", organizationId).then(() => null, () => null);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "customer",
    entity_id: customerId,
    customer_id: customerId,
    event_type: "customer_updated",
    title: "Customer updated",
    detail: fullName ? `${fullName} updated.` : "Customer profile updated."
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function uploadCustomerDocument(...args: Parameters<typeof uploadCustomerDocumentOrThrow>) {
  return guard(() => uploadCustomerDocumentOrThrow(...args));
}

async function uploadCustomerDocumentOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const customerId = String(formData.get("customerId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const category = String(formData.get("category") || "other").trim();
  const file = formData.get("documentFile");

  if (!customerId || !organizationId || !(file instanceof File) || file.size === 0) {
    throw new Error("Choose a document to upload.");
  }

  const documentId = await uploadCustomerDocumentFile({
    supabase,
    file,
    organizationId,
    customerId,
    userId: user.id,
    category
  });

  const { data: documents, error: documentError } = await supabase
    .from("documents")
    .select("category")
    .eq("organization_id", organizationId)
    .eq("owner_type", "customer")
    .eq("owner_id", customerId)
    .is("deleted_at", null);

  if (documentError) {
    throw new Error(documentError.message);
  }

  const { error } = await supabase
    .from("customers")
    .update({ document_status: documentStatusFromCategories((documents || []).map((document: any) => document.category)) })
    .eq("id", customerId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "document",
    entity_id: documentId || customerId,
    customer_id: customerId,
    event_type: "customer_document_uploaded",
    title: "Customer document uploaded",
    detail: `${category.replace(/_/g, " ")} uploaded.`
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
}

/**
 * A passport or driving licence photo added while making a booking (Rory, 1 Nov 2026): a rental that has already
 * started has no booking link, so the documents are added there and then. Returns the customer's new document status.
 */
export async function uploadCustomerDocumentQuick(formData: FormData): Promise<{ success: boolean; error?: string; documentStatus?: string }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const customerId = String(formData.get("customerId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const category = String(formData.get("category") || "");
  const file = formData.get("documentFile");
  if (!customerId || !organizationId || !["passport", "driver_license", "selfie"].includes(category)) return { success: false, error: "Choose a document to upload." };
  if (!(file instanceof File) || file.size === 0) return { success: false, error: "Choose a document to upload." };

  try {
    const documentId = await uploadCustomerDocumentFile({ supabase, file, organizationId, customerId, userId: user.id, category });
    const { data: documents } = await supabase
      .from("documents")
      .select("category")
      .eq("organization_id", organizationId)
      .eq("owner_type", "customer")
      .eq("owner_id", customerId)
      .is("deleted_at", null);
    const documentStatus = documentStatusFromCategories((documents || []).map((document: any) => document.category));
    await supabase.from("customers").update({ document_status: documentStatus }).eq("id", customerId).eq("organization_id", organizationId);
    await recordActivityEvent(supabase, {
      organization_id: organizationId,
      actor_id: user.id,
      entity_type: "document",
      entity_id: documentId || customerId,
      customer_id: customerId,
      event_type: "customer_document_uploaded",
      title: "Customer document uploaded",
      detail: `${category.replace(/_/g, " ")} uploaded while making a booking.`
    });
    revalidatePath(`/customers/${customerId}`);
    return { success: true, documentStatus };
  } catch (error) {
    return { success: false, error: await userError(error, "The upload didn't work. Try again.") };
  }
}
