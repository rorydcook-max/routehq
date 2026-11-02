/**
 * Paperwork paid every month (insurance on a monthly plan, mostly): each instalment is a cost on its date, posted
 * by the daily run until the cover runs out (Rory, 2 Nov 2026). The plan lives on the vehicle in
 * metadata.compliance_plans[<type>] = { amount, currency, type, next, until, eventId }.
 */
import { businessToday } from "@/lib/business-time";

export type CompliancePlan = {
  amount: number;
  currency: string;
  /** The money entry type (insurance, tax, other). */
  type: string;
  /** The next instalment's date. */
  next: string;
  /** The day the cover runs out; no instalment after it. */
  until: string;
  /** The day the cover started: instalments fall on this day of the month. */
  start: string;
  eventId?: string | null;
};

/** The same day of the month, one month on (31 Jan to 28/29 Feb, then back to the 31st where it exists). */
export function nextMonthly(start: string, current: string) {
  const day = Number(start.slice(8, 10));
  const year = Number(current.slice(0, 4));
  const month = Number(current.slice(5, 7)); // next month, 0-based = this month 1-based
  const y = year + Math.floor(month / 12);
  const m = month % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

/**
 * Posts every instalment that has fallen due for these vehicles (all with a plan when vehicleId is left out).
 * Returns how many costs were added. Safe to run twice: an instalment already posted is not posted again.
 */
export async function postDueComplianceInstalments(supabase: any, options: { organizationId?: string; vehicleId?: string; today?: string } = {}) {
  const today = options.today || businessToday();
  let query = supabase
    .from("vehicles")
    .select("id, organization_id, metadata")
    .is("deleted_at", null)
    .not("metadata->compliance_plans", "is", null);
  if (options.organizationId) query = query.eq("organization_id", options.organizationId);
  if (options.vehicleId) query = query.eq("id", options.vehicleId);
  const { data: vehicles, error } = await query;
  if (error) throw new Error(error.message);

  let posted = 0;
  for (const vehicle of vehicles || []) {
    const plans: Record<string, CompliancePlan> = { ...(vehicle.metadata?.compliance_plans || {}) };
    let changed = false;
    for (const [kind, plan] of Object.entries(plans)) {
      if (!plan?.next || !plan.until || !(Number(plan.amount) > 0)) {
        delete plans[kind];
        changed = true;
        continue;
      }
      let next = plan.next;
      // At most 24 in one go, so a plan saved years back can't run away.
      for (let guard = 0; next <= today && next <= plan.until && guard < 24; guard++) {
        const key = `${vehicle.id}:${kind}:${next}`;
        const { data: existing } = await supabase
          .from("transactions")
          .select("id")
          .eq("organization_id", vehicle.organization_id)
          .eq("metadata->>instalment_key", key)
          .is("deleted_at", null)
          .limit(1);
        if (!existing?.length) {
          const { error: insertError } = await supabase.from("transactions").insert({
            organization_id: vehicle.organization_id,
            vehicle_id: vehicle.id,
            type: plan.type || "other",
            amount: Number(plan.amount),
            currency: plan.currency || "THB",
            transaction_date: next,
            metadata: { source: "compliance_plan", compliance_type: kind, compliance_event_id: plan.eventId || null, instalment_key: key }
          });
          if (insertError) throw new Error(insertError.message);
          posted++;
        }
        next = nextMonthly(plan.start || plan.next, next);
      }
      if (next !== plan.next) changed = true;
      if (next > plan.until) {
        delete plans[kind];
        changed = true;
      } else plans[kind] = { ...plan, next };
    }
    if (changed) {
      const metadata = { ...(vehicle.metadata || {}) };
      if (Object.keys(plans).length) metadata.compliance_plans = plans;
      else delete metadata.compliance_plans;
      await supabase.from("vehicles").update({ metadata }).eq("id", vehicle.id);
    }
  }
  return posted;
}
