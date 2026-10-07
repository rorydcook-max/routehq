import { AppShell } from "@/components/app-shell";
import { getTranslations } from "next-intl/server";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { loadFleetFigures } from "@/lib/fleet-metrics";
import { publicBookingSettings } from "@/lib/public-catalog";
import type { RentStyle } from "@/lib/vehicle-investment";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CalculatorClient } from "./calculator-client";
import type { FleetVehicle, SavedCalc } from "./calculator-client";

export default async function RentalCalculatorPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const supabase = (await createSupabaseServerClient()) as any;
  const t = await getTranslations("calc");

  const [{ data: vehiclesData }, figures, { data: savedData }] = await Promise.all([
    supabase.from("vehicles").select("id, make, model, registration_number, monthly_rate").eq("organization_id", organization.id).is("deleted_at", null),
    loadFleetFigures(supabase, organization.id).catch(() => new Map()),
    supabase
      .from("calculator_results")
      .select("id, vehicle_make, vehicle_model, vehicle_year, vehicle_trim, purchase_price, recommendation, results, created_at")
      .eq("organisation_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(12)
  ]);

  const fleetVehicles: FleetVehicle[] = (vehiclesData || []).map((v: any) => ({
    id: v.id,
    make: v.make || "",
    model: v.model || "",
    plate: v.registration_number || "",
    utilization: figures.get(v.id)?.utilization12 ?? 0,
    monthlyRate: Number(v.monthly_rate || 0)
  }));

  // Start from how this business already works: what it rents out, and whether by the month or the day.
  const defaultCategory = /scoot|bike|motor/i.test(String(organization.settings?.fleet_type || "")) ? "scooter" : "car";
  const offer = publicBookingSettings(organization.settings).offer;
  const defaultStyle: RentStyle = offer === "dates" || offer === "both_dates" ? "daily" : "monthly";

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto mb-4 max-w-2xl">
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-subtitle mt-2">{t("subtitle")}</p>
      </div>
      <CalculatorClient
        currency={organization.currency || "THB"}
        defaultCategory={defaultCategory}
        defaultStyle={defaultStyle}
        fleetVehicles={fleetVehicles}
        initialSavedCalcs={(savedData || []) as SavedCalc[]}
      />
    </AppShell>
  );
}
