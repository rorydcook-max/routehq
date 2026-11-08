import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { PageBand } from "@/components/page-band";
import { InfoTip } from "@/components/info-tip";
import { getCurrentMembership } from "@/lib/auth/roles";
import { canDecideMoney } from "@/lib/auth/role-types";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { businessToday } from "@/lib/business-time";
import { getDefaultOrganization } from "@/lib/organization";
import { listReferrals, partnerNetworkSettings, placeOf, PARTNER_COMMISSION_PCT } from "@/lib/partner-network";
import { mainTown } from "@/lib/service-area";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PartnersView } from "./partners-view";

/** Partner network: share the fleet, search partners' free vehicles, copy a referral link, and track commissions. */
export default async function PartnersPage() {
  const [userEmail, organization, membership, t] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getCurrentMembership(), getTranslations("partners")]);
  const settings = partnerNetworkSettings(organization.settings);
  // The ledger shows even with sharing off: money already owed either way still needs settling.
  const referrals = await listReferrals((await createSupabaseServerClient()) as any, organization.id).catch(() => []);
  const place = placeOf(organization.settings);
  // The search starts at the business's own town.
  const town = mainTown(organization.settings);

  return (
    <AppShell hero={<PageBand info={<InfoTip label={t("title")} text={t("help", { pct: PARTNER_COMMISSION_PCT })} />} title={t("title")} />} userEmail={userEmail}>
      <PartnersView
        canEdit={membership?.role === "owner"}
        canSettle={canDecideMoney(membership?.role)}
        country={place.country}
        currency={String(organization.currency || "THB")}
        defaultPlace={town ? { name: town.name, region: town.region, lat: town.lat, lng: town.lng } : null}
        pct={PARTNER_COMMISSION_PCT}
        referrals={referrals}
        sharing={settings.enabled}
        blocked={settings.blocked}
        today={businessToday()}
      />
    </AppShell>
  );
}
