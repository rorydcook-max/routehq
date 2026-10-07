import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { getReportsData, type DatePreset } from "@/lib/reports";
import { ReportsView } from "./reports-view";

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string; month?: string }>;
}) {
  const params = await searchParams;
  // Support legacy ?month=YYYY-MM as well as new ?preset=
  const preset = (params.preset || (params.month ? "custom" : "this_month")) as DatePreset;
  const customFrom = params.from;
  const customTo = params.to;
  const legacyMonth = params.month;

  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const data = await getReportsData(organization.id, legacyMonth || preset, customFrom, customTo);

  const say = (await getTranslations("reportsPage")) as unknown as (key: string) => string;

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-4">
        <h1 className="page-title">{say("title")}</h1>
        <p className="page-subtitle page-subtitle-keep mt-1">{say("subtitle")}</p>
      </div>
      <ReportsView data={data} />
    </AppShell>
  );
}
