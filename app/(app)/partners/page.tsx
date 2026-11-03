import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Handshake, Search, Send } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageBand } from "@/components/page-band";
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
      {/* Full content width, like the other overview pages. */}
      <div>
        {settings.enabled ? (
          <PartnersView referrals={referrals} today={businessToday()} />
        ) : (
          <section className="card p-5 lg:p-7">
            <h2 className="card-title">{t("offTitle")}</h2>
            <p className="measure mt-1 font-medium text-[var(--foreground-secondary)]">{t("offBody", { pct: FINDERS_FEE_PCT })}</p>
            {/* How it works, in three steps: the same tile shape and tint for each, so none reads as a warning. */}
            <ol className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                { icon: <Search size={22} />, text: t("how_1") },
                { icon: <Send size={22} />, text: t("how_2") },
                { icon: <Handshake size={22} />, text: t("how_3", { pct: FINDERS_FEE_PCT }) }
              ].map((step, index) => (
                <li className="rounded-2xl bg-[var(--panel-secondary)] p-4" key={index}>
                  <span aria-hidden="true" className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">{step.icon}</span>
                  <p className="mt-3 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">{t("how_step", { n: index + 1 })}</p>
                  <p className="mt-0.5 font-semibold text-[var(--foreground)]">{step.text}</p>
                </li>
              ))}
            </ol>
            <Link className="primary-action pressable mt-5" href="/settings?tab=rentals#partner-network">
              {t("turnOn")}
            </Link>
          </section>
        )}
      </div>
    </AppShell>
  );
}
