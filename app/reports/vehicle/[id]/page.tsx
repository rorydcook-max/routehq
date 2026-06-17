import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { getVehicleReportData, type DatePreset } from "@/lib/reports";
import { VehicleReportView } from "./vehicle-report-view";

export default async function VehicleReportPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  const [resolvedParams, resolvedSearch] = await Promise.all([params, searchParams]);
  const vehicleId = resolvedParams.id;
  const preset = (resolvedSearch.preset || "this_month") as DatePreset;
  const customFrom = resolvedSearch.from;
  const customTo = resolvedSearch.to;

  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const data = await getVehicleReportData(organization.id, vehicleId, preset, customFrom, customTo);

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5">
        <Link className="text-sm font-semibold text-[var(--primary)] hover:underline" href="/reports">
          Reports
        </Link>
        <p className="page-eyebrow mt-1">Vehicle</p>
        <h1 className="page-title">{data.vehicle.label}</h1>
        <p className="page-subtitle mt-2">{data.vehicle.plate} &mdash; per-vehicle financial overview</p>
      </div>
      <VehicleReportView data={data} />
    </AppShell>
  );
}
