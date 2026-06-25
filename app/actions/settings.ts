"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import OpenAI from "openai";
import { supportedCalendarCodes } from "@/lib/i18n/calendars";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultOrganizationSlug } from "@/lib/supabase/config";
import { jurisdictionByCountry, mergeTravelPolicySettings, type HomeTerritoryType, type IslandTravelPolicy } from "@/lib/travel-policy";
import { buildDailySummaryMessage, sendLineMessage } from "@/services/messaging/line";

const supportedLocales = new Set<string>(supportedLocaleCodes);
const supportedCalendars = new Set<string>(supportedCalendarCodes);

export async function updatePreferredLocale(formData: FormData) {
  const preferredLocale = String(formData.get("preferredLocale") || "en");
  const preferredCalendar = String(formData.get("preferredCalendar") || "gregory");
  if (!supportedLocales.has(preferredLocale)) {
    throw new Error("Unsupported language.");
  }
  if (!supportedCalendars.has(preferredCalendar)) {
    throw new Error("Unsupported calendar.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("users").upsert({
    id: user.id,
    full_name: user.user_metadata?.full_name ?? null,
    preferred_locale: preferredLocale,
    preferred_calendar: preferredCalendar
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

function optionalStringFromForm(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim() || null;
}

function optionalNumberFromForm(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value ? Number(value) : null;
}

function requiredNumberFromForm(formData: FormData, key: string, fallback: number) {
  const value = Number(String(formData.get(key) || "").trim());
  return Number.isFinite(value) ? value : fallback;
}

function promptPayQrExtension(file: File) {
  const mime = file.type || "";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  const nameExt = file.name?.split(".").pop()?.toLowerCase();
  if (nameExt && ["png", "jpg", "jpeg", "webp"].includes(nameExt)) return nameExt === "jpeg" ? "jpg" : nameExt;
  return null;
}

function businessLogoExtension(file: File) {
  const mime = file.type || "";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  const nameExt = file.name?.split(".").pop()?.toLowerCase();
  if (nameExt && ["png", "jpg", "jpeg", "svg", "webp"].includes(nameExt)) return nameExt === "jpeg" ? "jpg" : nameExt;
  return null;
}

function storagePathFromPublicUrl(url: string | null | undefined) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/documents/";
  const index = url.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
}

function logoStorageReferenceFromUrl(url: string | null | undefined) {
  if (!url) return null;

  for (const bucket of ["branding", "documents"] as const) {
    const publicMarker = `/storage/v1/object/public/${bucket}/`;
    const signedMarker = `/storage/v1/object/sign/${bucket}/`;
    const marker = url.includes(publicMarker) ? publicMarker : url.includes(signedMarker) ? signedMarker : null;

    if (marker) {
      const [, pathWithQuery] = url.split(marker);
      return {
        bucket,
        path: decodeURIComponent(pathWithQuery.split("?")[0])
      };
    }
  }

  return null;
}

const validPaymentMethods = new Set(["cash", "promptpay", "bank_transfer", "wise", "revolut"]);

function parseAcceptedPaymentMethods(formData: FormData) {
  const raw = String(formData.get("accepted_payment_methods") || "[]");
  let parsed: unknown = [];

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  const methods = Array.isArray(parsed)
    ? parsed.filter((method): method is string => typeof method === "string" && validPaymentMethods.has(method))
    : [];

  return Array.from(new Set(["cash", ...methods]));
}

export async function updatePaymentSettings(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.organization_id) {
    throw new Error(membershipError?.message || "Organization membership was not found.");
  }

  const acceptedPaymentMethods = parseAcceptedPaymentMethods(formData);
  const requestedDefaultMethod = String(formData.get("default_payment_method") || "cash");
  const defaultPaymentMethod = acceptedPaymentMethods.includes(requestedDefaultMethod) ? requestedDefaultMethod : "cash";
  const receiptPrefix = String(formData.get("receipt_prefix") || "REC").trim().slice(0, 6) || "REC";
  const removePromptPayQr = String(formData.get("promptpay_qr_remove") || "") === "true";
  const promptPayQrFile = formData.get("promptpay_qr");

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("promptpay_qr_url")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError) {
    throw new Error(organizationError.message);
  }

  let promptPayQrUrl = organization?.promptpay_qr_url ?? null;

  if (removePromptPayQr) {
    const existingPath = storagePathFromPublicUrl(promptPayQrUrl);
    if (existingPath) {
      await supabase.storage.from("documents").remove([existingPath]);
    }
    promptPayQrUrl = null;
  }

  if (promptPayQrFile instanceof File && promptPayQrFile.size > 0) {
    const extension = promptPayQrExtension(promptPayQrFile);
    if (!extension) {
      throw new Error("PromptPay QR code must be a PNG, JPEG, or WebP image.");
    }

    const storagePath = `${membership.organization_id}/settings/promptpay-qr.${extension}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, promptPayQrFile, {
      contentType: promptPayQrFile.type || undefined,
      upsert: true
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage.from("documents").getPublicUrl(storagePath);
    promptPayQrUrl = publicUrlData?.publicUrl || null;
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      accepted_payment_methods: acceptedPaymentMethods,
      promptpay_id: optionalStringFromForm(formData, "promptpay_id"),
      promptpay_qr_url: promptPayQrUrl,
      bank_name: optionalStringFromForm(formData, "bank_name"),
      bank_account_number: optionalStringFromForm(formData, "bank_account_number"),
      bank_account_name: optionalStringFromForm(formData, "bank_account_name"),
      wise_link: optionalStringFromForm(formData, "wise_link"),
      revolut_link: optionalStringFromForm(formData, "revolut_link"),
      receipt_prefix: receiptPrefix,
      receipt_footer_text: optionalStringFromForm(formData, "receipt_footer_text"),
      default_payment_method: defaultPaymentMethod
    })
    .eq("id", membership.organization_id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

export async function updateUpfrontDiscountSettings(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.organization_id) {
    throw new Error(membershipError?.message || "Organization membership was not found.");
  }

  const enabled = String(formData.get("upfront_discount_enabled") || "") === "true";
  const minPeriods = Math.max(1, Number(formData.get("upfront_discount_min_periods") || 3));
  const rateValue = String(formData.get("upfront_discount_rate") || "").trim();
  const label = String(formData.get("upfront_discount_label") || "").trim();

  const { error } = await supabase
    .from("organizations")
    .update({
      upfront_discount_enabled: enabled,
      upfront_discount_min_periods: minPeriods,
      upfront_discount_rate: rateValue ? Number(rateValue) : null,
      upfront_discount_label: label || null
    })
    .eq("id", membership.organization_id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

export async function updateBusinessLogo(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.organization_id) {
    throw new Error(membershipError?.message || "Organization membership was not found.");
  }

  const removeLogo = String(formData.get("remove_logo") || "") === "true";
  const logoFile = formData.get("logo");

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("logo_url")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError) {
    throw new Error(organizationError.message);
  }

  let logoUrl = organization?.logo_url ?? null;

  if (removeLogo || (logoFile instanceof File && logoFile.size > 0)) {
    const existingLogo = logoStorageReferenceFromUrl(logoUrl);
    if (existingLogo) {
      await supabase.storage.from(existingLogo.bucket).remove([existingLogo.path]);
    }
    logoUrl = null;
  }

  if (logoFile instanceof File && logoFile.size > 0) {
    if (logoFile.size > 2 * 1024 * 1024) {
      throw new Error("Business logo must be 2MB or smaller.");
    }

    const extension = businessLogoExtension(logoFile);
    if (!extension) {
      throw new Error("Business logo must be a PNG, JPG, SVG, or WebP image.");
    }

    const storagePath = `${membership.organization_id}/branding/logo.${extension}`;
    const buffer = Buffer.from(await logoFile.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, buffer, {
      contentType: logoFile.type || undefined,
      upsert: true
    });

    if (uploadError) {
      console.error("Logo upload failed:", uploadError);
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage.from("documents").getPublicUrl(storagePath);
    logoUrl = publicUrlData?.publicUrl || null;
  }

  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: logoUrl })
    .eq("id", membership.organization_id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function updateTravelPolicySettings(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = String(formData.get("organizationId") || "");
  const country = String(formData.get("country") || "Thailand");
  const homeTerritoryType = String(formData.get("homeTerritoryType") || "island") as HomeTerritoryType;
  const islandTravelPolicy = String(formData.get("islandTravelPolicy") || "deposit_required") as IslandTravelPolicy;
  const homeTerritory = String(formData.get("homeTerritory") || "").trim();
  const jurisdiction = String(formData.get("jurisdiction") || jurisdictionByCountry[country] || "").trim();

  if (!organizationId || !homeTerritory || !jurisdiction) {
    throw new Error("Home territory and jurisdiction are required.");
  }
  if (!["island", "mainland"].includes(homeTerritoryType)) {
    throw new Error("Unsupported home territory type.");
  }
  if (!["deposit_required", "notice_only", "not_permitted"].includes(islandTravelPolicy)) {
    throw new Error("Unsupported island travel policy.");
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError || !organization) {
    throw new Error(organizationError?.message || "Organization was not found.");
  }

  const settings = mergeTravelPolicySettings(organization.settings, {
    home_territory: homeTerritory,
    home_territory_type: homeTerritoryType,
    island_travel_policy: islandTravelPolicy,
    secondary_deposit_amount: requiredNumberFromForm(formData, "secondaryDepositAmount", 5000),
    geofence_monitoring_enabled: formData.get("geofenceMonitoringEnabled") === "on",
    country,
    jurisdiction,
    mileage_limit: requiredNumberFromForm(formData, "mileageLimit", 1500),
    fuel_charge_per_increment: requiredNumberFromForm(formData, "fuelChargePerIncrement", 150),
    late_fee_percentage: requiredNumberFromForm(formData, "lateFeePercentage", 5),
    cleaning_fee_minimum: requiredNumberFromForm(formData, "cleaningFeeMinimum", 500),
    smoking_fee_maximum: requiredNumberFromForm(formData, "smokingFeeMaximum", 2000),
    emergency_repair_limit: requiredNumberFromForm(formData, "emergencyRepairLimit", 2000),
    deposit_return_days: requiredNumberFromForm(formData, "depositReturnDays", 5),
    owner_line_id: String(formData.get("ownerLineId") || "").trim(),
    owner_whatsapp: String(formData.get("ownerWhatsapp") || "").trim(),
    promptpay_id: String(formData.get("promptpayId") || "").trim()
  });

  const { error } = await supabase
    .from("organizations")
    .update({ settings })
    .eq("id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/contracts");
}

export async function createBranch(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = String(formData.get("organizationId") || "");
  const name = String(formData.get("name") || "").trim();
  const address = String(formData.get("address") || "").trim();

  if (!organizationId || !name || !address) {
    throw new Error("Branch name and address are required.");
  }

  const { error } = await supabase.from("branches").insert({
    organization_id: organizationId,
    name,
    address,
    latitude: optionalNumberFromForm(formData, "latitude"),
    longitude: optionalNumberFromForm(formData, "longitude"),
    phone: optionalStringFromForm(formData, "phone"),
    email: optionalStringFromForm(formData, "email"),
    is_active: true
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/fleet/new");
}

export async function updateBranch(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = String(formData.get("organizationId") || "");
  const branchId = String(formData.get("branchId") || "");
  const name = String(formData.get("name") || "").trim();

  if (!organizationId || !branchId || !name) {
    throw new Error("Branch name is required.");
  }

  const { error } = await supabase
    .from("branches")
    .update({
      name,
      address: optionalStringFromForm(formData, "address"),
      latitude: optionalNumberFromForm(formData, "latitude"),
      longitude: optionalNumberFromForm(formData, "longitude"),
      phone: optionalStringFromForm(formData, "phone"),
      email: optionalStringFromForm(formData, "email"),
      is_active: formData.get("isActive") === "on"
    })
    .eq("id", branchId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/fleet/new");
}

export async function deleteBranch(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = String(formData.get("organizationId") || "");
  const branchId = String(formData.get("branchId") || "");

  if (!organizationId || !branchId) {
    throw new Error("Branch ID is required.");
  }

  const { error } = await supabase.from("branches").delete().eq("id", branchId).eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/fleet/new");
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseJsonObject(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    const start = value.indexOf("{");
    const end = value.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(value.slice(start, end + 1));
    }
    throw new Error("AI research did not return valid JSON.");
  }
}

function collectResponseSources(response: any) {
  const sources: unknown[] = [];

  for (const item of response.output || []) {
    const actionSources = item?.action?.sources;
    if (Array.isArray(actionSources)) {
      sources.push(...actionSources);
    }

    for (const content of item?.content || []) {
      for (const annotation of content?.annotations || []) {
        if (annotation?.type === "url_citation") {
          sources.push(annotation);
        }
      }
    }
  }

  return sources;
}

async function requirePlatformAdmin() {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: platformAdmin, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !platformAdmin) {
    throw new Error("Only FleetOS platform admins can manage the global vehicle catalog.");
  }

  return { supabase, user };
}

export async function createVehicleMake(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const name = String(formData.get("name") || "").trim();

  if (!name) {
    throw new Error("Make name is required.");
  }

  const { error } = await supabase.from("vehicle_makes").insert({
    name,
    slug: slugify(name),
    origin_country: optionalStringFromForm(formData, "originCountry"),
    logo_url: optionalStringFromForm(formData, "logoUrl"),
    sort_order: optionalNumberFromForm(formData, "sortOrder") || 1000,
    is_active: true
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/fleet/new");
}

export async function createVehicleModel(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const makeId = String(formData.get("makeId") || "");
  const name = String(formData.get("name") || "").trim();
  const categoryCode = String(formData.get("categoryCode") || "").trim();

  if (!makeId || !name || !categoryCode) {
    throw new Error("Make, model name, and category are required.");
  }

  const { error } = await supabase.from("vehicle_models").insert({
    make_id: makeId,
    name,
    category_code: categoryCode,
    body_type: optionalStringFromForm(formData, "bodyType"),
    is_active: true
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/fleet/new");
}

export async function createVehicleTrim(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const modelId = String(formData.get("modelId") || "");
  const name = String(formData.get("name") || "").trim();
  const yearFrom = optionalNumberFromForm(formData, "yearFrom");

  if (!modelId || !name || !yearFrom) {
    throw new Error("Model, trim name, and year from are required.");
  }

  const { error } = await supabase.from("vehicle_trims").insert({
    model_id: modelId,
    name,
    year_from: yearFrom,
    year_to: optionalNumberFromForm(formData, "yearTo"),
    engine_cc: optionalNumberFromForm(formData, "engineCc"),
    transmission: optionalStringFromForm(formData, "transmission"),
    fuel_type: optionalStringFromForm(formData, "fuelType"),
    seating_capacity: optionalNumberFromForm(formData, "seatingCapacity"),
    drivetrain: optionalStringFromForm(formData, "drivetrain"),
    is_active: true
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/fleet/new");
}

async function findOrCreateMake(supabase: any, name: string) {
  const { data: existing, error: existingError } = await supabase
    .from("vehicle_makes")
    .select("id")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("vehicle_makes")
    .insert({
      name,
      slug: slugify(name),
      sort_order: 1000,
      is_active: true
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create vehicle make.");
  }

  return data.id;
}

async function findOrCreateModel(supabase: any, makeId: string, name: string, categoryCode: string | null) {
  const safeCategoryCode = categoryCode || "car";
  const { data: existing, error: existingError } = await supabase
    .from("vehicle_models")
    .select("id")
    .eq("make_id", makeId)
    .ilike("name", name)
    .eq("category_code", safeCategoryCode)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("vehicle_models")
    .insert({
      make_id: makeId,
      name,
      category_code: safeCategoryCode,
      is_active: true
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create vehicle model.");
  }

  return data.id;
}

export async function approveVehicleCatalogSubmission(formData: FormData) {
  const { supabase, user } = await requirePlatformAdmin();
  const submissionId = String(formData.get("submissionId") || "");
  const curatorNotes = optionalStringFromForm(formData, "curatorNotes");

  if (!submissionId) {
    throw new Error("Submission ID is required.");
  }

  const { data: submission, error: submissionError } = await supabase
    .from("vehicle_catalog_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (submissionError || !submission) {
    throw new Error(submissionError?.message || "Catalog submission not found.");
  }

  const makeName = String(submission.make_name || "").trim();
  const modelName = String(submission.model_name || "").trim();
  const trimName = String(submission.trim_name || "").trim();

  if (!makeName) {
    throw new Error("Submission needs a make before it can be approved.");
  }

  const makeId = await findOrCreateMake(supabase, makeName);
  let modelId: string | null = null;

  if (modelName) {
    modelId = await findOrCreateModel(supabase, makeId, modelName, submission.category_code);
  }

  if (modelId && trimName && submission.year_from) {
    const { data: existingTrim, error: existingTrimError } = await supabase
      .from("vehicle_trims")
      .select("id")
      .eq("model_id", modelId)
      .ilike("name", trimName)
      .eq("year_from", submission.year_from)
      .limit(1)
      .maybeSingle();

    if (existingTrimError) {
      throw new Error(existingTrimError.message);
    }

    if (!existingTrim?.id) {
      const { error: trimError } = await supabase.from("vehicle_trims").insert({
        model_id: modelId,
        name: trimName,
        year_from: submission.year_from,
        year_to: submission.year_to,
        engine_cc: submission.engine_cc,
        transmission: submission.transmission,
        fuel_type: submission.fuel_type,
        seating_capacity: submission.seating_capacity,
        drivetrain: submission.drivetrain,
        source: "user_submitted",
        verification_status: "verified",
        raw_ai_payload: {
          submission_id: submission.id,
          reviewed_by: user.id
        },
        is_active: true
      });

      if (trimError) {
        throw new Error(trimError.message);
      }
    }
  }

  const { error: updateError } = await supabase
    .from("vehicle_catalog_submissions")
    .update({
      status: "merged",
      curator_notes: curatorNotes
    })
    .eq("id", submissionId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/settings");
  revalidatePath("/fleet/new");
}

async function insertCatalogCandidate(supabase: any, candidate: any, reviewedBy: string, submissionId: string) {
  const makeName = String(candidate?.make || "").trim();
  const modelName = String(candidate?.model || "").trim();
  const trimName = String(candidate?.trim || "").trim();
  const yearFrom = Number(candidate?.year_from);

  if (!makeName || !modelName) {
    return false;
  }

  const makeId = await findOrCreateMake(supabase, makeName);
  const modelId = await findOrCreateModel(supabase, makeId, modelName, candidate?.category_code || "car");

  if (!trimName || !Number.isInteger(yearFrom)) {
    return true;
  }

  const { data: existingTrim, error: existingTrimError } = await supabase
    .from("vehicle_trims")
    .select("id")
    .eq("model_id", modelId)
    .ilike("name", trimName)
    .eq("year_from", yearFrom)
    .limit(1)
    .maybeSingle();

  if (existingTrimError) {
    throw new Error(existingTrimError.message);
  }

  if (existingTrim?.id) {
    return false;
  }

  const { error } = await supabase.from("vehicle_trims").insert({
    model_id: modelId,
    name: trimName,
    year_from: yearFrom,
    year_to: Number.isInteger(Number(candidate?.year_to)) ? Number(candidate.year_to) : null,
    engine_cc: Number.isInteger(Number(candidate?.engine_cc)) ? Number(candidate.engine_cc) : null,
    transmission: optionalStringFromCandidate(candidate?.transmission),
    fuel_type: optionalStringFromCandidate(candidate?.fuel_type),
    seating_capacity: Number.isInteger(Number(candidate?.seating_capacity)) ? Number(candidate.seating_capacity) : null,
    drivetrain: optionalStringFromCandidate(candidate?.drivetrain),
    source: "ai_researched",
    verification_status: "verified",
    confidence_score: Number.isFinite(Number(candidate?.confidence_score)) ? Number(candidate.confidence_score) : null,
    raw_ai_payload: {
      submission_id: submissionId,
      reviewed_by: reviewedBy,
      candidate
    },
    is_active: true
  });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

function optionalStringFromCandidate(value: unknown) {
  return String(value || "").trim() || null;
}

export async function mergeVehicleCatalogResearch(formData: FormData) {
  const { supabase, user } = await requirePlatformAdmin();
  const submissionId = String(formData.get("submissionId") || "");

  if (!submissionId) {
    throw new Error("Submission ID is required.");
  }

  const { data: submission, error: submissionError } = await supabase
    .from("vehicle_catalog_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (submissionError || !submission) {
    throw new Error(submissionError?.message || "Catalog submission not found.");
  }

  const payload = submission.research_payload || {};
  const candidates = [
    ...(Array.isArray(payload.likely_matches) ? payload.likely_matches : []),
    ...(Array.isArray(payload.missing_related_trims) ? payload.missing_related_trims : [])
  ];

  if (candidates.length === 0) {
    throw new Error("No AI research candidates are available to merge.");
  }

  let added = 0;
  for (const candidate of candidates) {
    if (await insertCatalogCandidate(supabase, candidate, user.id, submissionId)) {
      added += 1;
    }
  }

  const { error: updateError } = await supabase
    .from("vehicle_catalog_submissions")
    .update({
      status: "merged",
      curator_notes: `Merged ${added} AI-researched catalog candidate${added === 1 ? "" : "s"}.`
    })
    .eq("id", submissionId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  revalidatePath("/settings");
  revalidatePath("/fleet/new");
}

export async function rejectVehicleCatalogSubmission(formData: FormData) {
  const { supabase } = await requirePlatformAdmin();
  const submissionId = String(formData.get("submissionId") || "");

  if (!submissionId) {
    throw new Error("Submission ID is required.");
  }

  const { error } = await supabase
    .from("vehicle_catalog_submissions")
    .update({
      status: "rejected",
      curator_notes: optionalStringFromForm(formData, "curatorNotes")
    })
    .eq("id", submissionId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings");
}

export async function researchVehicleCatalogSubmission(formData: FormData) {
  const { supabase, user } = await requirePlatformAdmin();
  const submissionId = String(formData.get("submissionId") || "");

  if (!submissionId) {
    throw new Error("Submission ID is required.");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for catalog research.");
  }

  const { data: submission, error: submissionError } = await supabase
    .from("vehicle_catalog_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (submissionError || !submission) {
    throw new Error(submissionError?.message || "Catalog submission not found.");
  }

  const client = new OpenAI({ apiKey }) as any;
  const model = process.env.OPENAI_CATALOG_RESEARCH_MODEL || process.env.OPENAI_TRIM_CATALOG_MODEL || "gpt-4o";
  const prompt = `You are researching vehicle catalog data for FleetOS, a Southeast Asia vehicle rental operating system.

Research this user-submitted vehicle catalog suggestion using web search:
- Make: ${submission.make_name || "unknown"}
- Model: ${submission.model_name || "unknown"}
- Trim: ${submission.trim_name || "unknown"}
- Category: ${submission.category_code || "unknown"}
- Year from: ${submission.year_from || "unknown"}
- Year to: ${submission.year_to || "unknown"}
- Engine CC: ${submission.engine_cc || "unknown"}
- Transmission: ${submission.transmission || "unknown"}
- Fuel type: ${submission.fuel_type || "unknown"}
- Seats: ${submission.seating_capacity || "unknown"}
- Drivetrain: ${submission.drivetrain || "unknown"}

Focus on Thailand and Southeast Asia market availability. Check whether the submitted make/model/trim likely exists, whether it may be misspelled, and whether there are related trims for the same model/year range that FleetOS may be missing.

Return only JSON with this structure:
{
  "status": "found" | "inconclusive" | "not_found",
  "summary": "short plain-English summary",
  "suggested_make": "canonical make or null",
  "suggested_model": "canonical model or null",
  "suggested_category_code": "car | motorcycle | scooter | e-bike | van | atv | null",
  "likely_matches": [
    {
      "make": "canonical make",
      "model": "canonical model",
      "trim": "specific purchasable trim",
      "year_from": 2020,
      "year_to": null,
      "engine_cc": 2000,
      "transmission": "Automatic",
      "fuel_type": "diesel",
      "seating_capacity": 5,
      "drivetrain": "4WD",
      "confidence_score": 0.0,
      "rationale": "why this may match the user submission",
      "source_urls": ["https://..."]
    }
  ],
  "missing_related_trims": [
    {
      "make": "canonical make",
      "model": "canonical model",
      "trim": "specific purchasable trim",
      "year_from": 2020,
      "year_to": null,
      "engine_cc": 2000,
      "transmission": "Automatic",
      "fuel_type": "diesel",
      "seating_capacity": 5,
      "drivetrain": "4WD",
      "confidence_score": 0.0,
      "source_urls": ["https://..."]
    }
  ],
  "review_recommendation": "approve" | "edit_before_approve" | "reject" | "manual_research"
}

Rules:
- Do not invent trims.
- Prefer official manufacturer, distributor, brochure, or reputable vehicle-market sources.
- If evidence is weak, use status "inconclusive" and review_recommendation "manual_research".
- Each trim must be one specific purchasable variant, not a broad trim family.
- Return raw JSON only. Do not wrap the JSON in markdown fences or add commentary before or after it.`;

  try {
    const response = await client.responses.create({
      model,
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      input: prompt
    });

    const payload = parseJsonObject(response.output_text || "");
    const sources = collectResponseSources(response);

    const { error: updateError } = await supabase
      .from("vehicle_catalog_submissions")
      .update({
        research_status: "researched",
        research_payload: {
          ...payload,
          researched_by: user.id,
          model
        },
        research_sources: sources,
        researched_at: new Date().toISOString()
      })
      .eq("id", submissionId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } catch (error) {
    const { error: updateError } = await supabase
      .from("vehicle_catalog_submissions")
      .update({
        research_status: "failed",
        research_payload: {
          error: error instanceof Error ? error.message : "AI research failed.",
          error_name: error instanceof Error ? error.name : "UnknownError",
          researched_by: user.id
        },
        researched_at: new Date().toISOString()
      })
      .eq("id", submissionId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    throw error;
  }

  revalidatePath("/settings");
}

const NOTIFICATION_KEYS = [
  "daily_active_rentals",
  "daily_overdue",
  "daily_payments",
  "daily_compliance",
  "daily_revenue",
  "event_payment_received",
  "event_contract_signed",
  "event_gps_offline",
  "event_compliance_expiry",
  "event_rental_overdue",
  "event_new_booking"
] as const;

export async function saveNotificationSettings(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = String(formData.get("organizationId") || "");
  if (!organizationId) {
    throw new Error("Organization ID is required.");
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgError || !organization) {
    throw new Error(orgError?.message || "Organization not found.");
  }

  const dailySummaryTime = String(formData.get("daily_summary_time") || "08:00");
  const notifications: Record<string, boolean> = {};
  for (const key of NOTIFICATION_KEYS) {
    notifications[key] = formData.get(key) === "on";
  }

  const updatedSettings = {
    ...organization.settings,
    daily_summary_time: dailySummaryTime,
    line_notifications: notifications
  };

  const { error } = await supabase
    .from("organizations")
    .update({ settings: updatedSettings })
    .eq("id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/settings/notifications");
}

export async function updateLineSettings(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = String(formData.get("organizationId") || "");
  if (!organizationId) throw new Error("Organization ID is required.");

  const lineUserId = String(formData.get("line_user_id") || "").trim() || null;
  const lineNotificationsEnabled = formData.get("line_notifications_enabled") === "on";
  const lineDailySummaryEnabled = formData.get("line_daily_summary_enabled") === "on";
  const lineDailySummaryTime = String(formData.get("line_daily_summary_time") || "08:00").trim();

  const { error } = await supabase
    .from("organizations")
    .update({
      line_user_id: lineUserId,
      line_notifications_enabled: lineNotificationsEnabled,
      line_daily_summary_enabled: lineDailySummaryEnabled,
      line_daily_summary_time: lineDailySummaryTime
    })
    .eq("id", organizationId);

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}

export async function disconnectLine(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = String(formData.get("organizationId") || "");
  if (!organizationId) throw new Error("Organization ID is required.");

  const { error } = await supabase
    .from("organizations")
    .update({
      line_user_id: null,
      line_notifications_enabled: false
    })
    .eq("id", organizationId);

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
}

export async function saveOperatorSignature(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.organization_id) {
    throw new Error(membershipError?.message || "Organization membership was not found.");
  }

  const removeSignature = String(formData.get("remove_signature") || "") === "true";
  const signatureDataUrl = String(formData.get("signature_data_url") || "").trim();

  let signatureUrl: string | null = null;

  if (!removeSignature && signatureDataUrl.startsWith("data:image/png;base64,")) {
    const base64Data = signatureDataUrl.slice("data:image/png;base64,".length);
    const buffer = Buffer.from(base64Data, "base64");
    const storagePath = `${membership.organization_id}/branding/operator-signature.png`;

    const { error: uploadError } = await supabase.storage.from("branding").upload(storagePath, buffer, {
      contentType: "image/png",
      upsert: true
    });

    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrlData } = supabase.storage.from("branding").getPublicUrl(storagePath);
    signatureUrl = publicUrlData?.publicUrl ?? null;
  }

  const { error } = await supabase
    .from("organizations")
    .update({ owner_signature_url: signatureUrl })
    .eq("id", membership.organization_id);

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function sendTestLineSummary(): Promise<{ success: boolean; message: string }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Not authenticated." };

  const admin = createSupabaseAdminClient() as any;
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, line_user_id, line_channel_access_token, promptpay_id")
    .eq("slug", getDefaultOrganizationSlug())
    .is("deleted_at", null)
    .single();

  if (!org) return { success: false, message: "Organization not found." };

  const lineUserId: string = org.line_user_id ?? "";
  if (!lineUserId) return { success: false, message: "No LINE User ID configured. Add it below and save first." };

  const accessToken: string =
    org.line_channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
  if (!accessToken) return { success: false, message: "No LINE Channel Access Token available." };

  // Fetch real data for the test message
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + "-01";

  const [rentalsRes, vehiclesRes, txRes] = await Promise.all([
    admin
      .from("rentals")
      .select("id, end_date, status, customers!rentals_customer_id_fkey(full_name, phone), vehicles!rentals_vehicle_id_fkey(make, model, registration_number)")
      .eq("organization_id", org.id)
      .in("status", ["active", "overdue", "due_soon", "booked"])
      .is("deleted_at", null),
    admin
      .from("vehicles")
      .select("id, make, model, registration_number, metadata")
      .eq("organization_id", org.id)
      .eq("is_active", true)
      .is("deleted_at", null),
    admin
      .from("transactions")
      .select("amount")
      .eq("organization_id", org.id)
      .not("type", "in", '("deposit_received","deposit_refunded")')
      .neq("is_deposit", true)
      .gte("transaction_date", firstOfMonth)
      .lte("transaction_date", today)
      .is("deleted_at", null)
  ]);

  const rentals: any[] = rentalsRes.data ?? [];
  const vehicles: any[] = vehiclesRes.data ?? [];
  const monthlyRevenue = (txRes.data ?? []).reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0);

  function vLabel(v: any) {
    if (!v) return "Vehicle";
    const parts = [v.make, v.model].filter(Boolean).join(" ");
    return v.registration_number ? `${parts} (${v.registration_number})` : parts || "Vehicle";
  }

  const complianceChecks = [
    { key: "tax_expiry_date", label: "Vehicle Tax (ต่อภาษี)" },
    { key: "porbor_expiry_date", label: "Compulsory Insurance (พรบ)" },
    { key: "insurance_expiry_date", label: "Full Insurance" },
    { key: "next_service_date", label: "Scheduled Service" }
  ];

  const urgentCompliance: Array<{ vehicleLabel: string; item: string; daysUntil: number }> = [];
  for (const v of vehicles) {
    const compliance = v.metadata?.compliance ?? {};
    for (const { key, label } of complianceChecks) {
      const dateStr: string | undefined = compliance[key];
      if (!dateStr) continue;
      const daysUntil = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
      if (daysUntil >= 0 && daysUntil <= 14) {
        urgentCompliance.push({ vehicleLabel: vLabel(v), item: label, daysUntil });
      }
    }
  }

  const message = buildDailySummaryMessage({
    businessName: org.name,
    activeRentals: rentals.map((r: any) => ({
      customerName: r.customers?.full_name ?? "Customer",
      vehicleLabel: vLabel(r.vehicles),
      returnDate: r.end_date ?? null,
      daysRemaining: r.end_date ? Math.ceil((new Date(r.end_date).getTime() - Date.now()) / 86_400_000) : null
    })),
    returnsToday: rentals.filter((r: any) => r.end_date === today).map((r: any) => ({
      customerName: r.customers?.full_name ?? "Customer",
      vehicleLabel: vLabel(r.vehicles),
      phone: r.customers?.phone ?? ""
    })),
    returnsTomorrow: rentals.filter((r: any) => r.end_date === tomorrow).map((r: any) => ({
      customerName: r.customers?.full_name ?? "Customer",
      vehicleLabel: vLabel(r.vehicles)
    })),
    overdueRentals: rentals.filter((r: any) => r.status === "overdue" || (r.end_date && r.end_date < today)).map((r: any) => ({
      customerName: r.customers?.full_name ?? "Customer",
      vehicleLabel: vLabel(r.vehicles),
      daysOverdue: r.end_date ? Math.ceil((Date.now() - new Date(r.end_date).getTime()) / 86_400_000) : 1
    })),
    urgentCompliance,
    monthlyRevenue
  });

  const result = await sendLineMessage(accessToken, lineUserId, [message]);

  if (result.success) {
    await admin.from("line_messages").insert({
      organisation_id: org.id,
      type: "test_summary",
      recipient_line_id: lineUserId,
      message_content: message,
      status: "sent",
      sent_at: new Date().toISOString()
    });
    return { success: true, message: "Test summary sent to your LINE!" };
  }

  await admin.from("line_messages").insert({
    organisation_id: org.id,
    type: "test_summary",
    recipient_line_id: lineUserId,
    message_content: message,
    status: "failed",
    error: result.error ?? "Unknown error"
  });
  return { success: false, message: result.error ?? "Failed to send message." };
}
