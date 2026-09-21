import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { CreateOrganizationForm } from "@/app/onboarding/create-organization-form";
import { OnboardingWizard } from "@/app/onboarding/onboarding-wizard";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
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
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

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
  if (organizationDetail.onboarding_completed || organizationDetail.onboarding_skipped) {
    redirect("/");
  }

  return <OnboardingWizard categories={categories || []} organization={organizationDetail} />;
}
