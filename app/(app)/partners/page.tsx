import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { PageBand } from "@/components/page-band";
import { getCurrentMembership } from "@/lib/auth/roles";
import { canDecideMoney } from "@/lib/auth/role-types";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { businessToday } from "@/lib/business-time";
import { townsFor } from "@/lib/onboarding-locations";
import { getDefaultOrganization } from "@/lib/organization";
import { listReferrals, partnerNetworkSettings, placeOf, PARTNER_COMMISSION_PCT } from "@/lib/partner-network";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PartnersView, type RegionOption } from "./partners-view";

/** Partner network: share the fleet, search partners' free vehicles, copy a referral link, and track commissions. */
export default async function PartnersPage() {
  const [userEmail, organization, membership, t] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getCurrentMembership(), getTranslations("partners")]);
  const settings = partnerNetworkSettings(organization.settings);
  // The ledger shows even with sharing off: money already owed either way still needs settling.
  const referrals = await listReferrals((await createSupabaseServerClient()) as any, organization.id).catch(() => []);
  const place = placeOf(organization.settings);

  // The towns and areas offered at setup, for the searcher's country; provinces and towns in alphabetical order.
  const byRegion = new Map<string, string[]>();
  for (const { town, region } of townsFor(place.country)) byRegion.set(region, [...(byRegion.get(region) || []), town]);
  const regions: RegionOption[] = [...byRegion.entries()]
    .map(([name, towns]) => ({ name, towns: [...towns].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const knownTown = regions.some((region) => region.towns.some((town) => town.toLowerCase() === place.town.toLowerCase()));

  return (
    <AppShell hero={<PageBand keepSubtitle subtitle={t("help", { pct: PARTNER_COMMISSION_PCT })} title={t("title")} />} userEmail={userEmail}>
      <PartnersView
        canEdit={membership?.role === "owner"}
        canSettle={canDecideMoney(membership?.role)}
        country={place.country}
        currency={String(organization.currency || "THB")}
        defaultTown={knownTown ? place.town : ""}
        pct={PARTNER_COMMISSION_PCT}
        referrals={referrals}
        regions={regions}
        sharing={settings.enabled}
        blocked={settings.blocked}
        today={businessToday()}
      />
    </AppShell>
  );
}
