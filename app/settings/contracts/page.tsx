import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { buildSampleContractVariables, contractVariables, ensureDefaultContractTemplate } from "@/lib/contracts";
import { markOnboardingStep } from "@/lib/onboarding";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContractTemplateEditor } from "./contract-template-editor";

export default async function ContractSettingsPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const supabase = (await createSupabaseServerClient()) as any;
  const template = await ensureDefaultContractTemplate(supabase, organization.id);
  const sampleData = buildSampleContractVariables(organization);
  await markOnboardingStep(supabase, organization.id, "contract_template");

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link className="text-sm font-bold text-[var(--primary)]" href="/settings">
            Back to settings
          </Link>
          <h1 className="page-title mt-2">Contract templates</h1>
          <p className="page-subtitle mt-2 max-w-2xl">
            Edit the default rental agreement used by customer booking links. Variables in double curly braces are replaced when the contract is generated.
          </p>
        </div>
        <Badge tone="blue">{template.language || template.locale || "en"}</Badge>
      </div>

      <Card className="mb-4">
        <SectionHeader eyebrow="Default template" title={template.name || template.title || "Standard rental agreement"} />
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          This stage supports one default template. The database already supports multiple templates by language and vehicle type for the next contract phase.
        </p>
      </Card>

      <ContractTemplateEditor organizationId={organization.id} sampleData={sampleData} template={template} variables={contractVariables} />
    </AppShell>
  );
}
