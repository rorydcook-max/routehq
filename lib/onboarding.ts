export const onboardingSteps = [
  { step: "business_profile", label: "Business profile complete", href: "/onboarding" },
  { step: "first_vehicle", label: "First vehicle added", href: "/fleet/new" },
  { step: "all_vehicles", label: "All vehicles added", href: "/fleet" },
  { step: "first_customer", label: "First customer added", href: "/customers/new" },
  { step: "first_booking", label: "First booking created", href: "/bookings/new" },
  { step: "contract_template", label: "Contract template reviewed", href: "/settings/contracts" },
  { step: "line_connected", label: "LINE notifications connected", href: "/settings" },
  { step: "team_invited", label: "Team member invited", href: "/invite" }
] as const;

export type OnboardingStepKey = (typeof onboardingSteps)[number]["step"];
type ChecklistRow = { step: string; completed: boolean; completed_at: string | null };

function settingsObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function fleetTargetMet(fleetSize: string | null | undefined, vehicleCount: number) {
  if (fleetSize === "6-15") return vehicleCount >= 6;
  if (fleetSize === "16-50") return vehicleCount >= 16;
  if (fleetSize === "50+") return vehicleCount >= 50;
  return vehicleCount >= 1;
}

export async function markOnboardingStep(supabase: any, organizationId: string, step: OnboardingStepKey, completed = true) {
  const { error } = await supabase.from("onboarding_checklist").upsert(
    {
      organization_id: organizationId,
      step,
      completed,
      completed_at: completed ? new Date().toISOString() : null
    },
    { onConflict: "organization_id,step" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function ensureOnboardingChecklist(supabase: any, organizationId: string) {
  const rows = onboardingSteps.map((item) => ({
    organization_id: organizationId,
    step: item.step,
    completed: false,
    completed_at: null
  }));

  const { error } = await supabase.from("onboarding_checklist").upsert(rows, {
    onConflict: "organization_id,step",
    ignoreDuplicates: true
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getOnboardingStatus(supabase: any, organizationId: string) {
  const [orgResult, checklistResult, vehicleResult, customerResult, rentalResult, memberResult] = await Promise.all([
    supabase.from("organizations").select("id, name, settings, onboarding_completed").eq("id", organizationId).is("deleted_at", null).maybeSingle(),
    supabase.from("onboarding_checklist").select("step, completed, completed_at").eq("organization_id", organizationId),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("rentals").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true)
  ]);

  const error = [orgResult, checklistResult, vehicleResult, customerResult, rentalResult, memberResult].find((result: any) => result.error)?.error;
  if (error) {
    throw new Error(error.message);
  }

  const organization = orgResult.data || {};
  const settings = settingsObject(organization.settings);
  const checklistRows = new Map<string, ChecklistRow>((checklistResult.data || []).map((row: ChecklistRow) => [row.step, row]));
  const vehicleCount = vehicleResult.count || 0;
  const customerCount = customerResult.count || 0;
  const rentalCount = rentalResult.count || 0;
  const memberCount = memberResult.count || 0;

  const dynamicCompletion: Record<OnboardingStepKey, boolean> = {
    business_profile: Boolean(organization.name && settings.location && settings.fleet_type && settings.fleet_size),
    first_vehicle: vehicleCount >= 1,
    all_vehicles: fleetTargetMet(settings.fleet_size, vehicleCount),
    first_customer: customerCount >= 1,
    first_booking: rentalCount >= 1,
    contract_template: Boolean(checklistRows.get("contract_template")?.completed || settings.contract_template_reviewed_at),
    line_connected: Boolean(settings.line_id),
    team_invited: memberCount > 1
  };

  const items = onboardingSteps.map((item) => {
    const stored = checklistRows.get(item.step);
    const completed = Boolean(dynamicCompletion[item.step] || stored?.completed);
    return {
      ...item,
      completed,
      completedAt: completed ? stored?.completed_at || null : null
    };
  });

  return {
    items,
    completedCount: items.filter((item) => item.completed).length,
    totalCount: items.length,
    hidden: Boolean(settings.onboarding_checklist_dismissed_at),
    counts: {
      vehicles: vehicleCount,
      customers: customerCount,
      rentals: rentalCount,
      members: memberCount
    },
    settings
  };
}
