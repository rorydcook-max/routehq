import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { agreementExtraTerms } from "@/lib/contract-rendering";
import { buildSampleContractVariables, embedLogoInContractVariables, ensureDefaultContractTemplate } from "@/lib/contracts";
import { markOnboardingStep } from "@/lib/onboarding";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { feeOn, getTravelPolicySettings } from "@/lib/travel-policy";
import { AgreementTerms } from "./agreement-terms";

type Say = (key: string, values?: Record<string, string | number>) => string;

const BAHT = "฿";

export default async function ContractSettingsPage() {
  const [userEmail, defaultOrganization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const say = (await getTranslations("settingsPage")) as unknown as Say;
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: organizationRow } = await supabase.from("organizations").select("*").eq("id", defaultOrganization.id).maybeSingle();
  const organization = organizationRow || defaultOrganization;
  const template = await ensureDefaultContractTemplate(supabase, organization.id);
  const sampleData = await embedLogoInContractVariables(supabase, buildSampleContractVariables(organization));
  await markOnboardingStep(supabase, organization.id, "contract_template");

  const policy = getTravelPolicySettings(organization.settings);
  const amount = (value: number) => `${BAHT}${Math.round(Number(value) || 0).toLocaleString("en-US")}`;
  // A fee switched off in Settings shows as such, the way the agreement leaves it out.
  const off = say("tp_offShort");
  const numbers = [
    { label: say("tp_km"), value: feeOn(policy, "mileage_limit") ? policy.mileage_limit.toLocaleString("en-US") : say("tp_off_mileage_limit") },
    { label: say("ag_n_late"), value: feeOn(policy, "late_fee_percentage") ? `${policy.late_fee_percentage}%` : off },
    { label: say("ag_n_depositBack"), value: feeOn(policy, "deposit_return_days") ? say("ag_n_days", { count: policy.deposit_return_days }) : say("tp_off_deposit_return_days") },
    { label: say("ag_n_fuel"), value: feeOn(policy, "fuel_charge_per_increment") ? amount(policy.fuel_charge_per_increment) : off },
    { label: say("ag_n_cleaning"), value: feeOn(policy, "cleaning_fee_minimum") ? amount(policy.cleaning_fee_minimum) : off },
    { label: say("ag_n_smoking"), value: feeOn(policy, "smoking_fee_maximum") ? amount(policy.smoking_fee_maximum) : off },
    { label: say("ag_n_repair"), value: feeOn(policy, "emergency_repair_limit") ? amount(policy.emergency_repair_limit) : say("tp_off_emergency_repair_limit") },
    { label: say("ag_n_area"), value: policy.home_territory },
    { label: say("ag_n_law"), value: policy.jurisdiction }
  ].map((row) => ({ ...row, value: String(row.value || "").replace(/^[a-z]/, (letter) => letter.toUpperCase()) })); // "the Kingdom of Thailand" reads as a value, not mid-sentence

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-form">
        <div className="page-hero mb-4">
          <BackLink href="/settings?tab=business" label={say("title")} />
          <h1 className="page-title">{say("ag_title")}</h1>
          <p className="page-subtitle page-subtitle-keep mt-1">{say("ag_subtitle")}</p>
        </div>

        <AgreementTerms
          initialTerms={agreementExtraTerms(organization.settings)}
          numbers={numbers}
          numbersHref="/settings?tab=rentals#travel"
          organizationId={organization.id}
          sampleData={sampleData}
          templateHtml={String(template.content_html || template.body || "")}
        />
      </div>
    </AppShell>
  );
}
