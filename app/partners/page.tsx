import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { businessToday } from "@/lib/business-time";
import { getDefaultOrganization } from "@/lib/organization";
import { listReferrals, partnerNetworkSettings } from "@/lib/partner-network";
import { FINDERS_FEE_PCT } from "@/lib/plans";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PartnersView } from "./partners-view";

export default async function PartnersPage() {
  const [userEmail, organization, t] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getTranslations("partners")]);
  const settings = partnerNetworkSettings(organization.settings);
  const referrals = settings.enabled ? await listReferrals((await createSupabaseServerClient()) as any, organization.id) : [];

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-5xl">
        <div className="page-hero mb-4">
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-subtitle mt-2">{t("subtitle", { pct: FINDERS_FEE_PCT })}</p>
        </div>
        {settings.enabled ? (
          <PartnersView referrals={referrals} today={businessToday()} />
        ) : (
          <section className="card p-5">
            <p className="text-[17px] font-bold text-[var(--foreground)]">{t("offTitle")}</p>
            <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{t("offBody", { pct: FINDERS_FEE_PCT })}</p>
            <Link className="primary-action pressable mt-4" href="/settings?tab=rentals#partner-network">
              {t("turnOn")}
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
