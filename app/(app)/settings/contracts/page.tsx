import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getCurrentMembership } from "@/lib/auth/roles";
import { organizationAgreementLanguage } from "@/lib/agreement-language";
import { localizeAgreementTemplate } from "@/lib/agreement-localize";
import { UPLOADED_TEMPLATE_KEY } from "@/lib/contract-import-template";
import { agreementExtraTerms } from "@/lib/contract-rendering";
import { buildSampleContractVariables, embedLogoInContractVariables, ensureDefaultContractTemplate } from "@/lib/contracts";
import { markOnboardingStep } from "@/lib/onboarding";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { defaultLocationRules, feeOn, getTravelPolicySettings, territoryText, travelCountryCode } from "@/lib/travel-policy";
import { distanceUnitFor } from "@/lib/regional";
import { AgreementTerms } from "./agreement-terms";
import { ContractImportCard } from "./import-card";
import { currencySymbol } from "@/components/currency-symbol";
import { distanceKey } from "@/lib/business-units";

type Say = (key: string, values?: Record<string, string | number>) => string;

// Reading an uploaded agreement with the vision model can take a minute or two (Settings › Use your own agreement).
export const maxDuration = 300;

export default async function ContractSettingsPage({ searchParams }: { searchParams: Promise<{ file?: string }> }) {
  const [userEmail, defaultOrganization, membership, params] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getCurrentMembership(), searchParams]);
  const say = (await getTranslations("settingsPage")) as unknown as Say;
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: organizationRow } = await supabase.from("organizations").select("*").eq("id", defaultOrganization.id).maybeSingle();
  const organization = organizationRow || defaultOrganization;
  const [template, sampleData, { data: latestUpload }] = await Promise.all([
    ensureDefaultContractTemplate(supabase, organization.id),
    embedLogoInContractVariables(supabase, buildSampleContractVariables(organization)),
    // The owner's most recent upload, so a draft they haven't finished reviewing can be picked up again (also
    // when an older upload is the one in use: a newer one otherwise had no way back to its review screen).
    supabase
      .from("contract_templates")
      .select("id, title, is_active, created_at")
      .eq("organization_id", organization.id)
      .eq("template_key", UPLOADED_TEMPLATE_KEY)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);
  await markOnboardingStep(supabase, organization.id, "contract_template");
  const usingUploaded = template?.template_key === UPLOADED_TEMPLATE_KEY;

  const policy = getTravelPolicySettings(organization.settings, organization.currency);
  const mainTravel = defaultLocationRules(organization.settings, travelCountryCode(organization));
  const money = currencySymbol(organization.currency);
  const amount = (value: number) => `${money}${Math.round(Number(value) || 0).toLocaleString("en-US")}`;
  // A fee switched off in Settings shows as such, the way the agreement leaves it out.
  const off = say("tp_offShort");
  const numbers = [
    { label: say(distanceKey("tp_km")), value: feeOn(policy, "mileage_limit") ? policy.mileage_limit.toLocaleString("en-US") : say("tp_off_mileage_limit") },
    { label: say("ag_n_late"), value: feeOn(policy, "late_fee_percentage") ? `${policy.late_fee_percentage}%` : off },
    { label: say("ag_n_depositBack"), value: feeOn(policy, "deposit_return_days") ? say("ag_n_days", { count: policy.deposit_return_days }) : say("tp_off_deposit_return_days") },
    { label: say("ag_n_fuel"), value: feeOn(policy, "fuel_charge_per_increment") ? amount(policy.fuel_charge_per_increment) : off },
    { label: say("ag_n_cleaning"), value: feeOn(policy, "cleaning_fee_minimum") ? amount(policy.cleaning_fee_minimum) : off },
    { label: say("ag_n_smoking"), value: feeOn(policy, "smoking_fee_maximum") ? amount(policy.smoking_fee_maximum) : off },
    { label: say("ag_n_repair"), value: feeOn(policy, "emergency_repair_limit") ? amount(policy.emergency_repair_limit) : say("tp_off_emergency_repair_limit") },
    // The main location's travel area and law (each location has its own: Settings › Travel area and limits).
    { label: say("ag_n_area"), value: territoryText(mainTravel, travelCountryCode(organization), distanceUnitFor(organization)) },
    { label: say("ag_n_law"), value: mainTravel.law || policy.jurisdiction }
  ].map((row) => ({ ...row, value: String(row.value || "").replace(/^[a-z]/, (letter) => letter.toUpperCase()) })); // "the Kingdom of Thailand" reads as a value, not mid-sentence

  // A file handed over from the chat widget ("Upload my own contract"): only a path inside this business's folder.
  const handoffFile = typeof params?.file === "string" && params.file.startsWith(`${organization.id}/`) && !params.file.includes("..") ? params.file : null;

  const importCard =
    membership?.role === "owner" ? (
      <ContractImportCard
        active={usingUploaded ? { id: String(template.id), title: String(template.title || template.name || "") } : null}
        draft={latestUpload && latestUpload.id !== template?.id ? { id: String(latestUpload.id), title: String(latestUpload.title || "") } : null}
        handoffFile={handoffFile}
      />
    ) : null;

  // English plus the business location's language; the RoveHQ wording is localized here so the browser gets one language pair.
  const language = organizationAgreementLanguage(organization);
  const templateHtml = localizeAgreementTemplate(String(template.content_html || template.body || ""), language);
  const languageLabel = usingUploaded
    ? say("ag_ownAgreement")
    : language === "en"
      ? say("ag_languagesEn")
      : say("ag_languages", { language: say(`ag_lang_${language}`) });

  return (
    <AppShell userEmail={userEmail}>
      <div className="w-full max-w-6xl">
        <div className="page-hero mb-4">
          <BackLink href="/settings?tab=business" label={say("title")} />
          <h1 className="page-title">{say("ag_title")}</h1>
          <p className="page-subtitle page-subtitle-keep mt-1">{say(usingUploaded ? "ag_introOwn" : "ag_intro")}</p>
        </div>

        <AgreementTerms
          initialTerms={agreementExtraTerms(organization.settings)}
          languageLabel={languageLabel}
          languageTip={usingUploaded ? undefined : say("ag_languagesTip")}
          numbers={usingUploaded ? [] : numbers}
          numbersHref="/settings?tab=rentals#travel"
          organizationId={organization.id}
          sampleData={sampleData}
          side={importCard}
          templateHtml={templateHtml}
        />
      </div>
    </AppShell>
  );
}
