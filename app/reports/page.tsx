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

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5">
        <p className="page-eyebrow">Reports</p>
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle mt-1">How the business is doing, from what you&apos;ve actually recorded.</p>
      </div>
      <ReportsView data={data} />
    </AppShell>
  );
}
