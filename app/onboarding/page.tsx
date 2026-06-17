import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/app/onboarding/onboarding-wizard";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const supabase = (await createSupabaseServerClient()) as any;
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
