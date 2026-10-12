import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Handshake } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageBand } from "@/components/page-band";
import { VehicleArt } from "@/components/vehicle-art";
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
    <AppShell hero={<PageBand keepSubtitle subtitle={t("subtitle", { pct: FINDERS_FEE_PCT })} title={t("title")} />} userEmail={userEmail}>
      <div className="max-w-5xl">
        {settings.enabled ? (
          <PartnersView referrals={referrals} today={businessToday()} />
        ) : (
          <section className="card p-5 lg:p-7">
            <div aria-hidden="true" className="mb-4 flex items-center gap-3">
              <VehicleArt colour="white" kind="car" model="City" size="sm" />
              <span className="h-[3px] w-6 rounded-full bg-[var(--border-strong)]" />
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-light)] text-[#5c3a0c]">
                <Handshake size={26} />
              </span>
              <span className="h-[3px] w-6 rounded-full bg-[var(--border-strong)]" />
              <VehicleArt colour="red" kind="scooter" model="Click" size="sm" />
            </div>
            <p className="text-[20px] font-bold text-[var(--foreground)]">{t("offTitle")}</p>
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
