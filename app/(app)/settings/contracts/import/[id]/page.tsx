import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getCurrentMembership } from "@/lib/auth/roles";
import { thaiCheckClauses } from "@/lib/contract-import";
import { UPLOADED_TEMPLATE_KEY, styleOf, tidyImportedAgreement, type UploadedTemplateMeta } from "@/lib/contract-import-template";
import { buildSampleContractVariables, embedLogoInContractVariables } from "@/lib/contracts";
import { defaultRentalContractTemplate } from "@/lib/default-contract-template";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ImportReview } from "./review";

type Say = (key: string, values?: Record<string, string | number>) => string;

// Saving and the Thailand check call the model; give them room.
export const maxDuration = 120;

/** Review an uploaded agreement: the original beside RoveHQ's signable copy, with the blanks and wording editable. */
export default async function ImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, userEmail, membership] = await Promise.all([params, getCurrentUserEmail(), getCurrentMembership()]);
  if (!membership) redirect("/login");
  if (membership.role !== "owner") redirect("/settings/contracts");
  const say = (await getTranslations("contractImport")) as unknown as Say;
  const supabase = (await createSupabaseServerClient()) as any;
  const [{ data: row }, { data: organization }] = await Promise.all([
    supabase.from("contract_templates").select("*").eq("id", id).eq("organization_id", membership.organizationId).eq("template_key", UPLOADED_TEMPLATE_KEY).maybeSingle(),
    supabase.from("organizations").select("*").eq("id", membership.organizationId).maybeSingle()
  ]);
  const meta = row?.variables as UploadedTemplateMeta | undefined;
  if (!row || !meta || meta.kind !== "uploaded_agreement" || !organization) redirect("/settings/contracts");

  // The original files, for the left-hand side: short-lived links from the private bucket.
  const admin = createSupabaseAdminClient() as any;
  const paths = (meta.source?.paths || []).filter((path) => path.startsWith(`${membership.organizationId}/`));
  const { data: signed } = paths.length ? await admin.storage.from(meta.source.bucket).createSignedUrls(paths, 60 * 60) : { data: [] as any[] };
  const originals = paths.map((path, index) => ({
    url: String(signed?.[index]?.signedUrl || ""),
    name: meta.source.names?.[index] || path.slice(path.lastIndexOf("/") + 1)
  }));

  const sampleData = await embedLogoInContractVariables(supabase, buildSampleContractVariables(organization));
  const isThai = String(organization.country_code || "").toUpperCase() === "TH";

  return (
    <AppShell userEmail={userEmail}>
      <div className="w-full">
        <div className="page-hero mb-4">
          <BackLink href="/settings/contracts" label={say("backLabel")} />
          <h1 className="page-title">{say("reviewTitle")}</h1>
          <p className="page-subtitle page-subtitle-keep mt-1">{say("reviewSubtitle")}</p>
        </div>
        <ImportReview
          extractedText={meta.extracted_text || ""}
          id={String(row.id)}
          initialCheck={meta.th_check || null}
          initialDoc={tidyImportedAgreement(meta.doc)}
          initialIncludeDetails={Boolean(meta.include_details)}
          isActive={organization.default_contract_template_id === row.id && Boolean(row.is_active)}
          isThai={isThai}
          originals={originals}
          sampleData={sampleData}
          sourceType={meta.source?.type || "pdf"}
          styleCss={styleOf(defaultRentalContractTemplate)}
          thaiClauses={isThai ? thaiCheckClauses() : {}}
        />
      </div>
    </AppShell>
  );
}
