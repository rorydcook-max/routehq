import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { agreementExtraTerms } from "@/lib/contract-rendering";
import { buildSampleContractVariables, embedLogoInContractVariables, ensureDefaultContractTemplate } from "@/lib/contracts";
import { markOnboardingStep } from "@/lib/onboarding";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTravelPolicySettings } from "@/lib/travel-policy";
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
  const numbers = [
    { label: say("ag_n_late"), value: `${policy.late_fee_percentage}%` },
    { label: say("ag_n_depositBack"), value: say("ag_n_days", { count: policy.deposit_return_days }) },
    { label: say("ag_n_fuel"), value: amount(policy.fuel_charge_per_increment) },
    { label: say("ag_n_cleaning"), value: amount(policy.cleaning_fee_minimum) },
    { label: say("ag_n_smoking"), value: amount(policy.smoking_fee_maximum) },
    { label: say("ag_n_repair"), value: amount(policy.emergency_repair_limit) },
    { label: say("ag_n_area"), value: policy.home_territory },
    { label: say("ag_n_law"), value: policy.jurisdiction }
  ];

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl">
        <div className="page-hero mb-4">
          <Link className="font-bold text-[var(--primary)]" href={"/settings?tab=business" as Route}>
            {say("backToSettings")}
          </Link>
          <h1 className="page-title mt-2">{say("ag_title")}</h1>
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
