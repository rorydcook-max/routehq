"use server";

import { revalidatePath } from "next/cache";
import { ensureOnboardingChecklist, getOnboardingStatus as getOnboardingStatusForOrg, markOnboardingStep, type OnboardingStepKey } from "@/lib/onboarding";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const validSteps = new Set([
  "business_profile",
  "first_vehicle",
  "all_vehicles",
  "first_customer",
  "first_booking",
  "contract_template",
  "line_connected",
  "team_invited"
]);

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

function optionalNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").replace(/,/g, "").trim();
  return value ? Number(value) : null;
}

function settingsObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

async function uploadOnboardingVehiclePhoto({
  supabase,
  file,
  organizationId,
  vehicleId,
  userId
}: {
  supabase: any;
  file: File;
  organizationId: string;
  vehicleId: string;
  userId: string;
}) {
  if (!file || file.size === 0) return;

  const extension = file.name.split(".").pop()?.toLowerCase() || "upload";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${organizationId}/vehicle/${vehicleId}/photos/${Date.now()}-${safeName || `vehicle-photo.${extension}`}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: documentError } = await supabase.from("documents").insert({
    organization_id: organizationId,
    owner_type: "vehicle",
    owner_id: vehicleId,
    storage_bucket: "documents",
    storage_path: storagePath,
    file_name: file.name || `vehicle-photo.${extension}`,
    mime_type: file.type || null,
    size_bytes: file.size,
    category: "vehicle_photo",
    ocr_status: "not_started",
    extracted_data: {},
    uploaded_by: userId
  });

  if (documentError) {
    throw new Error(documentError.message);
  }
}

async function requireUser() {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  return { supabase, user };
}

export async function saveBusinessProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const organizationId = requiredString(formData, "organizationId");
  const name = requiredString(formData, "businessName");
  const location = requiredString(formData, "location");
  const country = requiredString(formData, "country");
  const region = requiredString(formData, "region");
  const town = requiredString(formData, "town");
  const fleetType = requiredString(formData, "fleetType");
  const fleetSize = requiredString(formData, "fleetSize");
  const language = requiredString(formData, "language");
  const currency = optionalString(formData, "currency") || "THB";

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orgError || !organization) {
    throw new Error(orgError?.message || "Organization was not found.");
  }

  const settings = settingsObject(organization.settings);
  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      default_locale: language,
      currency,
      supported_currencies: Array.from(new Set([currency, "THB", "USD"])),
      settings: {
        ...settings,
        location,
        main_location: {
          country,
          region,
          town,
          label: location
        },
        fleet_type: fleetType,
        fleet_size: fleetSize,
        preferred_currency: currency,
        primary_language: language,
        business_profile_completed_at: new Date().toISOString()
      }
    })
    .eq("id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  const { data: existingBranch } = await supabase
    .from("branches")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const branchPayload = {
    organization_id: organizationId,
    name: town,
    address: location,
    is_active: true
  };

  if (existingBranch?.id) {
    const { error: branchError } = await supabase.from("branches").update(branchPayload).eq("id", existingBranch.id);
    if (branchError) {
      throw new Error(branchError.message);
    }
  } else {
    const { error: branchError } = await supabase.from("branches").insert(branchPayload);
    if (branchError) {
      throw new Error(branchError.message);
    }
  }

  await supabase
    .from("users")
    .update({ preferred_locale: language })
    .eq("id", user.id);

  await ensureOnboardingChecklist(supabase, organizationId);
  await markOnboardingStep(supabase, organizationId, "business_profile");
  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "organization",
    entity_id: organizationId,
    event_type: "onboarding_business_profile_completed",
    title: "Business profile completed",
    detail: `${name} onboarding profile saved.`
  });

  revalidatePath("/");
  revalidatePath("/onboarding");
}

export async function createOnboardingVehicle(formData: FormData) {
  const { supabase, user } = await requireUser();
  const organizationId = requiredString(formData, "organizationId");
  const categoryId = requiredString(formData, "categoryId");
  const make = requiredString(formData, "make");
  const model = requiredString(formData, "model");
  const registrationNumber = requiredString(formData, "registrationNumber").toUpperCase();
  const currency = optionalString(formData, "currency") || "THB";

  const specifications = {
    transmission: optionalString(formData, "transmission"),
    seating_capacity: optionalNumber(formData, "seatingCapacity"),
    engine_cc: optionalNumber(formData, "engineCc"),
    fuel_type: optionalString(formData, "fuelType")
  };

  const metadata = {
    compliance: {
      tax_expiry_date: optionalString(formData, "taxExpiryDate"),
      porbor_expiry_date: optionalString(formData, "porborExpiryDate"),
      insurance_expiry_date: optionalString(formData, "insuranceExpiryDate"),
      next_service_date: optionalString(formData, "nextServiceDate")
    },
    onboarding: {
      created_from_onboarding: true
    },
    currency
  };

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      organization_id: organizationId,
      category_id: categoryId,
      make,
      model,
      trim: optionalString(formData, "trim"),
      year: optionalNumber(formData, "year"),
      vin: optionalString(formData, "vin"),
      registration_number: registrationNumber,
      color: optionalString(formData, "color"),
      mileage: optionalNumber(formData, "mileage") || 0,
      status: "available",
      availability_status: "available_now",
      service_area: "home_branch",
      partner_network_enabled: false,
      daily_rate: optionalNumber(formData, "dailyRate") || 0,
      weekly_rate: optionalNumber(formData, "weeklyRate") || 0,
      monthly_rate: optionalNumber(formData, "monthlyRate") || 0,
      utilization_12_month: 0,
      utilization_lifecycle: 0,
      revenue_generated: 0,
      profit_generated: 0,
      health_score: 100,
      specifications,
      metadata,
      created_by: user.id
    })
    .select("id, make, model, registration_number, metadata")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create first vehicle.");
  }

  for (const photo of formData.getAll("vehiclePhotos")) {
    if (photo instanceof File && photo.size > 0) {
      await uploadOnboardingVehiclePhoto({
        supabase,
        file: photo,
        organizationId,
        vehicleId: data.id,
        userId: user.id
      });
    }
  }

  await markOnboardingStep(supabase, organizationId, "first_vehicle");
  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "vehicle",
    entity_id: data.id,
    vehicle_id: data.id,
    event_type: "vehicle_created",
    title: "First vehicle added",
    detail: `${registrationNumber} ${make} ${model} added during onboarding.`
  });

  revalidatePath("/");
  revalidatePath("/fleet");
  revalidatePath("/onboarding");

  return {
    id: data.id as string,
    make,
    model,
    registrationNumber,
    compliance: metadata.compliance
  };
}

export async function skipFirstVehicle(formData: FormData) {
  const { supabase } = await requireUser();
  const organizationId = requiredString(formData, "organizationId");
  await ensureOnboardingChecklist(supabase, organizationId);
  await markOnboardingStep(supabase, organizationId, "first_vehicle", false);
  revalidatePath("/onboarding");
}

export async function finishOnboarding(formData: FormData) {
  const { supabase } = await requireUser();
  const organizationId = requiredString(formData, "organizationId");
  const lineId = optionalString(formData, "lineId");
  const lineConnected = String(formData.get("lineConnected") || "") === "true";

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orgError || !organization) {
    throw new Error(orgError?.message || "Organization was not found.");
  }

  const settings = settingsObject(organization.settings);
  await ensureOnboardingChecklist(supabase, organizationId);

  if (lineConnected || lineId) {
    await markOnboardingStep(supabase, organizationId, "line_connected");
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      settings: {
        ...settings,
        ...(lineId ? { line_id: lineId } : {}),
        onboarding_completed_at: new Date().toISOString()
      }
    })
    .eq("id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/onboarding");
}

export async function completeOnboardingStep(step: string, organizationId?: string) {
  if (!validSteps.has(step)) {
    throw new Error("Invalid onboarding step.");
  }

  const { supabase } = await requireUser();
  const resolvedOrganizationId = organizationId || "";
  if (!resolvedOrganizationId) {
    throw new Error("Organization is required.");
  }

  await markOnboardingStep(supabase, resolvedOrganizationId, step as OnboardingStepKey);
  revalidatePath("/");
}

export async function dismissChecklist(formData: FormData) {
  const { supabase } = await requireUser();
  const organizationId = requiredString(formData, "organizationId");
  const { data: organization, error: orgError } = await supabase.from("organizations").select("settings").eq("id", organizationId).maybeSingle();

  if (orgError || !organization) {
    throw new Error(orgError?.message || "Organization was not found.");
  }

  const settings = settingsObject(organization.settings);
  const { error } = await supabase
    .from("organizations")
    .update({
      settings: {
        ...settings,
        onboarding_checklist_dismissed_at: new Date().toISOString()
      }
    })
    .eq("id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function getOnboardingStatus(organizationId: string) {
  const { supabase } = await requireUser();
  return getOnboardingStatusForOrg(supabase, organizationId);
}
