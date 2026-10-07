"use server";

import { revalidatePath } from "next/cache";
import { ensureOnboardingChecklist, getOnboardingStatus as getOnboardingStatusForOrg, markOnboardingStep } from "@/lib/onboarding";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function settingsObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, any>) : {};
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
  const businessPhone = String(formData.get("businessPhone") || "").trim().slice(0, 80);
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
      // Asked for in setup because it goes on the agreement and the customer's booking link.
      ...(businessPhone ? { business_phone: businessPhone } : {}),
      default_locale: language,
      currency,
      supported_currencies: Array.from(new Set([currency, "THB", "USD"])),
      settings: {
        ...settings,
        ...(businessPhone ? { business_phone: businessPhone } : {}),
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
