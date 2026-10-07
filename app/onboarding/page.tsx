import { redirect } from "next/navigation";
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
    return (
      <AuthCard eyebrow="RouteHQ" title="Set up your business">
        <CreateOrganizationForm defaultBusinessName={String(user.user_metadata?.business_name || "")} />
      </AuthCard>
    );
  }

  const organization = await getDefaultOrganization();
  const [{ data: organizationDetail, error: organizationError }, { data: categories, error: categoriesError }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, default_locale, settings, onboarding_completed, onboarding_skipped")
      .eq("id", organization.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("vehicle_categories")
      .select("id, code, name")
      .or(`organization_id.is.null,organization_id.eq.${organization.id}`)
      .order("sort_order", { ascending: true })
  ]);

  if (organizationError || !organizationDetail) {
    throw new Error(organizationError?.message || "Organization was not found.");
  }
  if (categoriesError) {
    throw new Error(categoriesError.message);
  }
  if ((organizationDetail.onboarding_completed || organizationDetail.onboarding_skipped) && !previewStep) {
    redirect("/");
  }

  return <OnboardingWizard categories={categories || []} initialStep={previewStep >= 1 && previewStep <= 3 ? previewStep : 1} organization={organizationDetail} />;
}
