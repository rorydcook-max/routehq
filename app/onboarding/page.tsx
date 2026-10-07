import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { CreateOrganizationForm } from "@/app/onboarding/create-organization-form";
import { OnboardingWizard } from "@/app/onboarding/onboarding-wizard";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/auth/active-organization-server";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  // On a developer's machine only: /onboarding?preview=2 shows a step of the wizard for an account that has already finished it. Never on the live site.
  const previewStep = process.env.NODE_ENV === "development" ? Number((await searchParams).preview || 0) : 0;
  await getCurrentUserEmail();
  const supabase = (await createSupabaseServerClient()) as any;

  // A new account has no organisation yet. Create one before anything else,
  // rather than letting getDefaultOrganization fall back to a default slug.
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: membership } = await getActiveMembership(supabase, user.id);

  if (!membership?.organization_id) {
    // They typed the business name when they signed up: do not ask for it again on its own screen. The wizard's first step shows it and lets them change it.
    const signupName = String(user.user_metadata?.business_name || "").trim();
    if (signupName.length >= 2 && signupName.length <= 120) {
      const { error: createError } = await supabase.rpc("create_my_organization", {
        p_name: signupName,
        p_full_name: String(user.user_metadata?.full_name || "").trim() || null
      });
      if (!createError) redirect("/onboarding");
    }
    const say = (await getTranslations("auth")) as unknown as (key: string) => string;
    return (
      <AuthCard body={say("orgBody")} title={say("orgTitle")}>
        <CreateOrganizationForm defaultBusinessName={String(user.user_metadata?.business_name || "")} />
      </AuthCard>
    );
  }

  const organization = await getDefaultOrganization();
  const [{ data: organizationDetail, error: organizationError }, { data: profileStep }, { data: vehicles }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, default_locale, settings, onboarding_completed, onboarding_skipped")
      .eq("id", organization.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("onboarding_checklist").select("completed").eq("organization_id", organization.id).eq("step", "business_profile").maybeSingle(),
    supabase.from("vehicles").select("make, model, registration_number, metadata").eq("organization_id", organization.id).is("deleted_at", null).order("created_at", { ascending: true }).limit(1)
  ]);

  if (organizationError || !organizationDetail) {
    throw new Error(organizationError?.message || "Organization was not found.");
  }
  if ((organizationDetail.onboarding_completed || organizationDetail.onboarding_skipped) && !previewStep) {
    redirect("/");
  }

  // Start the wizard in the language the person has been reading so far (their phone's, or the one they picked when signing up).
  const locale = await getLocale();
  // The vehicle is added on the normal Add vehicle screen, which sends the person back here. Carry on from where they are.
  const first = (vehicles || [])[0];
  const firstVehicle = first ? { make: first.make, model: first.model, registrationNumber: first.registration_number, compliance: first.metadata?.compliance || null } : null;
  const resumeStep = !profileStep?.completed ? 1 : firstVehicle ? 3 : 2;
  return (
    <OnboardingWizard
      firstVehicle={firstVehicle}
      initialLanguage={locale === "th" ? "th" : undefined}
      initialStep={previewStep >= 1 && previewStep <= 3 ? previewStep : resumeStep}
      organization={organizationDetail}
    />
  );
}
