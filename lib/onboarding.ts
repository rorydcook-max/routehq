import { onlineSigningGaps } from "@/lib/online-signing-readiness";
import { organizationOffersPromptPay } from "@/lib/payment-methods";
import { orgCountry } from "@/lib/regional";
export const onboardingSteps = [
  // In the order that makes RoveHQ worth coming back to (Rory, 2 Nov 2026): the business in first (vehicles, then who is
  // renting them now, so money due and returns show at once), reminders that send themselves, the booking page out in
  // the world, then what online bookings need, then the rest.
  { step: "business_profile", label: "Business profile complete", href: "/onboarding" },
  { step: "first_vehicle", label: "Add your vehicles", href: "/onboarding?step=2" },
  // Told to the chat (the fleet assistant is part of it): ?chat=1 opens it on Fleet.
  { step: "current_rentals", label: "Add who's renting now", href: "/fleet?chat=1" },
  { step: "reminders", label: "Turn on automatic reminders", href: "/settings?tab=messaging" },
  { step: "booking_page", label: "Share your booking page", href: "/booking-page" },
  // Without these the customer is stopped at the last step of their booking link.
  { step: "signature", label: "Add your signature", href: "/settings/signature" },
  { step: "payment_methods", label: "Say how customers pay you", href: "/settings?tab=rentals#payment-methods" },
  // Only for accounts that came straight in without checking their email first.
  { step: "verify_email", label: "Verify your email", href: "#verify-email" },
  { step: "first_booking", label: "First booking created", href: "/bookings/new" },
  { step: "contract_template", label: "Contract template reviewed", href: "/settings/contracts" },
  { step: "line_connected", label: "LINE notifications connected", href: "/settings?tab=notifications" },
  { step: "team_invited", label: "Team member invited", href: "/invite" }
] as const;

export type OnboardingStepKey = (typeof onboardingSteps)[number]["step"];
type ChecklistRow = { step: string; completed: boolean; completed_at: string | null };

function settingsObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, any>) : {};
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

  // A tick on the set-up list must never stop real work: a teammate, who may not change the list, still makes bookings.
  if (error) console.warn("set-up checklist not updated:", error.message);
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

  // A tick on the set-up list must never stop real work: a teammate, who may not change the list, still makes bookings.
  if (error) console.warn("set-up checklist not updated:", error.message);
}

export async function getOnboardingStatus(supabase: any, organizationId: string, options: { emailPending?: boolean } = {}) {
  const [orgResult, checklistResult, vehicleResult, customerResult, rentalResult, memberResult, channelResult] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", organizationId).is("deleted_at", null).maybeSingle(),
    supabase.from("onboarding_checklist").select("step, completed, completed_at").eq("organization_id", organizationId),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("rentals").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("messaging_channels").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).neq("status", "disconnected").neq("provider", "website")
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
    business_profile: Boolean(organization.name && settings.location),
    verify_email: !options.emailPending,
    first_vehicle: vehicleCount >= 1,
    current_rentals: rentalCount >= 1,
    // Reminders send themselves once a chat app (LINE, Telegram, WhatsApp...) is connected.
    reminders: (channelResult?.count || 0) > 0,
    booking_page: false,
    signature: orgResult.data ? onlineSigningGaps(orgResult.data).length === 0 : false,
    // PromptPay counts only for businesses in Thailand (lib/payment-methods.ts), where it is offered.
    payment_methods: Boolean((organizationOffersPromptPay(organization) && (organization.promptpay_id || organization.promptpay_qr_url)) || organization.bank_account_number || organization.wise_link || organization.revolut_link),
    first_booking: rentalCount >= 1,
    contract_template: Boolean(checklistRows.get("contract_template")?.completed || settings.contract_template_reviewed_at),
    // The morning summary on LINE is connected on Settings › Notifications (organizations.line_user_id).
    line_connected: Boolean(organization.line_user_id || settings.line_id),
    team_invited: memberCount > 1
  };
  // LINE's morning summary is offered only to businesses in Thailand (Settings › Notifications shows its card there,
  // or where it is already connected), so a business elsewhere is never asked to set it up.
  const offersLine = orgCountry(organization) === "TH" || Boolean(organization.line_user_id);

  // Steps already dealt with in setup, or not needed for this account, are left off the list (and the count).
  const items = onboardingSteps.filter((item) => item.step !== "business_profile" && (item.step !== "verify_email" || options.emailPending) && (item.step !== "line_connected" || offersLine)).map((item) => {
    const stored = checklistRows.get(item.step);
    const completed = item.step === "verify_email" ? !options.emailPending : Boolean(dynamicCompletion[item.step] || stored?.completed);
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
