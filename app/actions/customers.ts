"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { markOnboardingStep } from "@/lib/onboarding";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildDocumentStoragePath } from "@/services/documents/storage-path";

const activeRentalStatuses = ["booked", "active", "due_soon", "overdue", "extended"];
const contactMethods = ["whatsapp", "messenger", "line", "telegram", "sms", "email", "phone"];

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

export async function createCustomer(formData: FormData) {
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

  if (!organizationId || !fullName || !phone || !nationality) {
    throw new Error("Full name, phone number, and nationality are required.");
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
      ...contactChannelFields(formData, phone, email),
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

  await createCustomerDocumentUploads(supabase, formData, organizationId, data.id, user.id);

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
  await markOnboardingStep(supabase, organizationId, "first_customer");

  revalidatePath("/");
  revalidatePath("/customers");
  redirect(`/customers/${data.id}`);
}

export async function createInlineCustomer(formData: FormData) {
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

  if (!organizationId || !fullName || !phone || !nationality) {
    throw new Error("Name, phone, and nationality are required.");
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
      ...contactChannelFields(formData, phone, email),
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
  await markOnboardingStep(supabase, organizationId, "first_customer");

  revalidatePath("/customers");
  return {
    id: data.id as string,
    full_name: data.full_name as string,
    phone: (data.phone as string | null) || null,
    nationality: (data.nationality as string | null) || null,
    document_status: (data.document_status as string | null) || "no_documents",
    label: `${data.full_name} · ${data.phone || ""}`
  };
}

export async function updateCustomer(formData: FormData) {
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
  if (formData.has("emergencyContactName")) updates.emergency_contact_name = optionalString(formData, "emergencyContactName");
  if (formData.has("emergencyContactPhone")) updates.emergency_contact_phone = fullPhone(formData, "emergencyPhoneCountryCode", "emergencyContactPhone");
  if (notes !== undefined) updates.notes = notes;

  const { error } = await supabase.from("customers").update(updates).eq("id", customerId).eq("organization_id", organizationId);
  if (error) {
    throw new Error(error.message);
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

export async function uploadCustomerDocument(formData: FormData) {
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

export async function deleteCustomer(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const customerId = String(formData.get("customerId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  if (!customerId || !organizationId) {
    throw new Error("Customer is required.");
  }

  const { data: activeRentals, error: rentalError } = await supabase
    .from("rentals")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .in("status", activeRentalStatuses)
    .is("deleted_at", null);

  if (rentalError) {
    throw new Error(rentalError.message);
  }

  if ((activeRentals || []).length > 0) {
    throw new Error("This customer has active rentals and cannot be deleted.");
  }

  const { error } = await supabase.from("customers").update({ deleted_at: new Date().toISOString() }).eq("id", customerId).eq("organization_id", organizationId);
  if (error) {
    throw new Error(error.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "customer",
    entity_id: customerId,
    customer_id: customerId,
    event_type: "customer_deleted",
    title: "Customer deleted",
    detail: "Customer was soft-deleted."
  });

  revalidatePath("/customers");
  redirect("/customers");
}
