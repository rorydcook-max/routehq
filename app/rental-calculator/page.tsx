import { AppShell } from "@/components/app-shell";
import { getTranslations } from "next-intl/server";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { loadFleetFigures } from "@/lib/fleet-metrics";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CalculatorClient } from "./calculator-client";
import type { FleetVehicle, SavedCalc } from "./calculator-client";

export default async function RentalCalculatorPage() {
  const [userEmail, organization] = await Promise.all([
    getCurrentUserEmail(),
    getDefaultOrganization()
  ]);

  const supabase = (await createSupabaseServerClient()) as any;
  const t = await getTranslations("calc");

  // Fetch fleet vehicles for comparison and utilization pre-fill
  const [{ data: vehiclesData }, figures] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, make, model, registration_number, monthly_rate")
      .eq("organization_id", organization.id)
      .is("deleted_at", null),
    // Real utilisation and profit per vehicle (the stored columns were never updated).
    loadFleetFigures(supabase, organization.id).catch(() => new Map())
  ]);

  const fleetVehicles: FleetVehicle[] = (vehiclesData || []).map((v: any) => ({
    id: v.id,
    make: v.make || "",
    model: v.model || "",
    plate: v.registration_number || "",
    utilization: figures.get(v.id)?.utilization12 ?? 0,
    profit: figures.get(v.id)?.profit ?? 0,
    monthlyRate: Number(v.monthly_rate || 0)
  }));

  // Without rental history there is nothing to average. A new fleet with a few weeks of history averages a few percent, which
  // would make every vehicle look like a loss, so below 20% the calculator
  // starts from 70% and just shows the fleet figure for reference.
  const measuredUtilization =
    fleetVehicles.length > 0 && fleetVehicles.some((v) => v.utilization > 0)
      ? Math.round(fleetVehicles.reduce((sum, v) => sum + v.utilization, 0) / fleetVehicles.length)
      : null;
  const fleetAvgUtilization = measuredUtilization !== null && measuredUtilization >= 20 ? measuredUtilization : 70;

  // Fetch last 5 saved calculations (graceful fallback if table doesn't exist yet)
  let savedCalcs: SavedCalc[] = [];
  try {
    const { data: savedData } = await supabase
      .from("calculator_results")
      .select("id, vehicle_make, vehicle_model, vehicle_year, vehicle_trim, purchase_price, recommendation, confidence_score, results, created_at")
      .eq("organisation_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(5);
    savedCalcs = savedData || [];
  } catch {
    // Table may not exist until migration 0024 is applied
  }

  return (
    <AppShell userEmail={userEmail}>
      <div className="mb-4">
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-subtitle mt-2">{t("subtitle")}</p>
      </div>

      <CalculatorClient
        fleetAvgUtilization={fleetAvgUtilization}
        measuredUtilization={measuredUtilization}
        fleetVehicles={fleetVehicles}
        initialSavedCalcs={savedCalcs}
        organizationId={organization.id}
      />
    </AppShell>
  );
}
