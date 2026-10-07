import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { buildSampleContractVariables, contractVariables, embedLogoInContractVariables, ensureDefaultContractTemplate } from "@/lib/contracts";
import { markOnboardingStep } from "@/lib/onboarding";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContractTemplateEditor } from "./contract-template-editor";

export default async function ContractSettingsPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const say = (await getTranslations("settingsPage")) as unknown as (key: string) => string;
  const supabase = (await createSupabaseServerClient()) as any;
  const template = await ensureDefaultContractTemplate(supabase, organization.id);
  const sampleData = await embedLogoInContractVariables(supabase, buildSampleContractVariables(organization));
  await markOnboardingStep(supabase, organization.id, "contract_template");

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-4">
        <Link className="font-bold text-[var(--primary)]" href={"/settings?tab=business" as Route}>
          {say("backToSettings")}
        </Link>
        <h1 className="page-title mt-2">{say("ct_title")}</h1>
        <p className="page-subtitle page-subtitle-keep mt-1 max-w-2xl">{say("ct_subtitle")}</p>
      </div>

      <ContractTemplateEditor organizationId={organization.id} sampleData={sampleData} template={template} variables={contractVariables} />
    </AppShell>
  );
}
