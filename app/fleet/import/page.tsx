import { BackLink } from "@/components/ui";
import { ImportWizard, type RecentImport } from "@/app/import/import-wizard";
import { AppShell } from "@/components/app-shell";
import { getTranslations } from "next-intl/server";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ImportVehiclesPage() {
  const [userEmail, organization, t] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getTranslations("importer")]);
  const supabase = (await createSupabaseServerClient()) as any;
  // Imports from the last 30 days: each can still be taken back.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: batches } = await supabase
    .from("import_batches")
    .select("id, source_name, created_at, status, counts")
    .eq("organization_id", organization.id)
    .in("status", ["imported", "undone"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);
  const recent: RecentImport[] = (batches || []).map((batch: any) => ({ id: batch.id, sourceName: batch.source_name, createdAt: batch.created_at, status: batch.status, counts: batch.counts || {} }));

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-form">
        <div className="page-hero mb-4">
          <BackLink href="/fleet" label={t("back")} />
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-subtitle measure mt-2">{t("subtitle")}</p>
        </div>

        <ImportWizard recent={recent} />
      </div>
    </AppShell>
  );
}
