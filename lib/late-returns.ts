import { businessToday } from "@/lib/business-time";
import { notifyOperator } from "@/lib/notify-operator";

/**
 * A vehicle that is late back puts the next booking for it at risk. Once a
 * day the business is told about each booking, starting within a week, whose
 * vehicle has not come back from the rental before it.
 */

export type LateReturnRisk = {
  organizationId: string;
  vehicle: string;
  lateRentalId: string;
  lateCustomer: string;
  dueBack: string;
  nextRentalId: string;
  nextCustomer: string;
  nextStart: string;
};

const label = (row: any) => [row?.vehicles?.make, row?.vehicles?.model].filter(Boolean).join(" ") || "vehicle";
const shortDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export async function findLateReturnRisks(admin: any, organizationId?: string): Promise<LateReturnRisk[]> {
  const today = businessToday();
  const weekAhead = businessToday(7);
  let lateQuery = admin
    .from("rentals")
    .select("id, organization_id, vehicle_id, end_date, vehicles!rentals_vehicle_id_fkey(make, model), customers!rentals_customer_id_fkey(full_name)")
    .is("deleted_at", null)
    .in("status", ["active", "due_soon", "overdue", "extended"])
    .not("end_date", "is", null)
    .lt("end_date", today);
  if (organizationId) lateQuery = lateQuery.eq("organization_id", organizationId);
  const { data: late } = await lateQuery;
  if (!late?.length) return [];

  const { data: booked } = await admin
    .from("rentals")
    .select("id, vehicle_id, start_date, customers!rentals_customer_id_fkey(full_name)")
    .is("deleted_at", null)
    .eq("status", "booked")
    .in("vehicle_id", late.map((row: any) => row.vehicle_id))
    .lte("start_date", weekAhead)
    .order("start_date", { ascending: true });

  const risks: LateReturnRisk[] = [];
  for (const row of late) {
    const next = (booked || []).find((booking: any) => booking.vehicle_id === row.vehicle_id);
    if (!next) continue;
    risks.push({
      organizationId: row.organization_id,
      vehicle: label(row),
      lateRentalId: row.id,
      lateCustomer: row.customers?.full_name || "The customer",
      dueBack: String(row.end_date).slice(0, 10),
      nextRentalId: next.id,
      nextCustomer: next.customers?.full_name || "the next customer",
      nextStart: String(next.start_date).slice(0, 10)
    });
  }
  return risks;
}

/** Sends one alert per booking at risk. Returns how many were sent. */
export async function alertLateReturns(admin: any): Promise<number> {
  const risks = await findLateReturnRisks(admin);
  const today = businessToday();
  for (const risk of risks) {
    const handover = risk.nextStart < today ? `was due on ${shortDate(risk.nextStart)}` : risk.nextStart === today ? "is today" : `is on ${shortDate(risk.nextStart)}`;
    await notifyOperator(
      risk.organizationId,
      `⚠️ Late return: the ${risk.vehicle} was due back from ${risk.lateCustomer} on ${shortDate(risk.dueBack)} and is still out. ${risk.nextCustomer}'s handover ${handover}.`,
      "operator_notification"
    ).catch(() => null);
  }
  return risks.length;
}
