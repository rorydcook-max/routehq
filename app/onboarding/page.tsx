import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { CreateOrganizationForm } from "@/app/onboarding/create-organization-form";
import { OnboardingWizard } from "@/app/onboarding/onboarding-wizard";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/auth/active-organization-server";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ preview?: string; step?: string; added?: string; rentals?: string }> }) {
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
  const [{ data: organizationDetail, error: organizationError }, { data: vehicles }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, default_locale, settings, onboarding_completed, onboarding_skipped")
      .eq("id", organization.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("vehicles").select("make, model, registration_number").eq("organization_id", organization.id).is("deleted_at", null).order("created_at", { ascending: true }).limit(60)
  ]);

  if (organizationError || !organizationDetail) {
    throw new Error(organizationError?.message || "Organization was not found.");
  }
  // Once step 1 is saved, setup is done and this page is simply "Add your vehicles" (the Get ready list, the short form and
  // the import all come back here). It never sends anyone away: saving step 1 re-draws this page, and a redirect then
  // skipped straight past the vehicles step.
  const profileDone = Boolean(organizationDetail.settings?.location);

  // Where they are, guessed from where they are browsing, until they say.
  const countryCode = ((await headers()).get("x-vercel-ip-country") || "").toUpperCase();
  const defaultCountry = COUNTRY_NAMES[countryCode] || "Thailand";
  const names = (vehicles || []).map((row: any) => [row.make, row.model, row.registration_number].filter(Boolean).join(" "));
  const initialStep = previewStep === 1 || previewStep === 2 ? previewStep : profileDone ? 2 : 1;
  const openAssistant = (await searchParams).rentals === "1";
  return <OnboardingWizard defaultCountry={defaultCountry} openAssistant={openAssistant} initialStep={initialStep as 1 | 2} organization={organizationDetail} vehicles={names} />;
}

const COUNTRY_NAMES: Record<string, string> = {
  TH: "Thailand", ID: "Indonesia", PH: "Philippines", VN: "Vietnam", MY: "Malaysia", SG: "Singapore", LA: "Laos", KH: "Cambodia",
  CN: "China", JP: "Japan", TW: "Taiwan", KR: "South Korea", BN: "Brunei", IN: "India", BD: "Bangladesh", LK: "Sri Lanka"
};
