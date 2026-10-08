import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { researchAvailable } from "@/lib/ai-research";
import { FleetValueView, type ValueRow } from "./fleet-value-view";

/** What the fleet is worth today, vehicle by vehicle, against what was paid. Owner only (under Reports). */
export default async function FleetValuePage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const supabase = (await createSupabaseServerClient()) as any;
  const t = await getTranslations("fleetValue");
  const { data } = await supabase
    .from("vehicles")
    .select("id, make, model, trim, year, registration_number, mileage, purchase_price, purchase_date, estimated_value, metadata, status")
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .neq("status", "retired")
    .order("make")
    .order("model");

  const rows: ValueRow[] = (data || []).map((vehicle: any) => {
    const valuation = vehicle.metadata?.valuation || null;
    const own = vehicle.estimated_value == null ? null : Number(vehicle.estimated_value);
    return {
      id: vehicle.id,
      name: [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" "),
      plate: vehicle.registration_number || "",
      hasYear: Boolean(vehicle.year),
      condition: vehicle.metadata?.condition?.value || null,
      conditionByDamage: vehicle.metadata?.condition?.by === "damage" ? String(vehicle.metadata.condition.damage_on || "") : null,
      mileage: vehicle.mileage == null ? null : Number(vehicle.mileage),
      paid: vehicle.purchase_price == null ? null : Number(vehicle.purchase_price),
      boughtOn: vehicle.purchase_date || null,
      value: own && own > 0 ? own : null,
      ownFigure: Boolean(own && own > 0 && (!valuation?.typical || Number(valuation.value || valuation.typical) !== own)),
      sumInsured: Number(vehicle.metadata?.compliance?.insurance_sum_insured || 0) || null,
      valuation
    };
  });

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl">
        <div className="page-hero mb-5">
          <Link className="text-sm font-bold text-[var(--primary)]" href="/reports">
            {t("back")}
          </Link>
          <h1 className="page-title mt-2">{t("title")}</h1>
          <p className="page-subtitle mt-2">{t("subtitle")}</p>
        </div>
        <FleetValueView canEstimate={researchAvailable()} currency={organization.currency || "THB"} rows={rows} />
      </div>
    </AppShell>
  );
}
