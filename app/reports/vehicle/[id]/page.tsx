import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
import { VehicleTitle } from "@/components/vehicle-identity";
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
        <BackLink href="/reports" label={say("vr_back")} />
        {/* The one vehicle header: name, year, plate chip (the plate is no longer the title). */}
        <VehicleTitle
          as="h1"
          className="gap-x-3"
          name={name || data.vehicle.label}
          nameClassName="page-title"
          plate={name ? data.vehicle.plate : null}
          plateClassName="!px-2 !py-1 !text-[14px]"
          year={(data.vehicle as unknown as { year?: string | number | null }).year}
        />
      </div>
      <VehicleReportView data={data} />
    </AppShell>
  );
}
