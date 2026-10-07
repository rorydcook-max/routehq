import Link from "next/link";
import { getTranslations } from "next-intl/server";
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

  const say = (await getTranslations("reportsPage")) as unknown as (key: string) => string;
  const name = [data.vehicle.make, data.vehicle.model].filter(Boolean).join(" ");

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-4">
        <Link className="font-bold text-[var(--primary)]" href="/reports">
          {say("vr_back")}
        </Link>
        <h1 className="page-title mt-2">{data.vehicle.plate || data.vehicle.label}</h1>
        {name ? <p className="page-subtitle page-subtitle-keep mt-1">{name}</p> : null}
      </div>
      <VehicleReportView data={data} />
    </AppShell>
  );
}
