import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { FleetAssistant } from "@/components/fleet-assistant";
import { BackLink } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The setup assistant after onboarding (Rory, 2 Nov 2026): add vehicles or who's renting now by typing, talking or
 * sending photos, from Fleet and the + menu.
 */
export default async function FleetAssistantPage() {
  const [userEmail, organization, t] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getTranslations("fleetAssistant")]);
  const supabase = (await createSupabaseServerClient()) as any;
  const { count } = await supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).is("deleted_at", null);
  const hasVehicles = (count || 0) > 0;

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-form">
        <div className="page-hero mb-4">
          <BackLink href="/fleet" label={t("pageBack")} />
          <h1 className="page-title">{t("pageTitle")}</h1>
          <p className="page-subtitle measure mt-2">{t("pageSubtitle")}</p>
        </div>
        <FleetAssistant currency={organization.currency || "THB"} greeting={hasVehicles ? t("helloAny") : undefined} hasVehicles={hasVehicles} organizationId={organization.id} />
      </div>
    </AppShell>
  );
}
