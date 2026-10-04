import { businessToday } from "@/lib/business-time";
import { addMonths, formatMonthLabel } from "@/lib/payment-schedule";

/**
 * Monthly billing for rentals with no end date. Rent is scheduled a year
 * ahead; these helpers start that schedule when a rental becomes open-ended
 * and keep it topped up for rentals that run past their first year.
 */

const iso = (date: Date) => date.toISOString().slice(0, 10);
const asDate = (value: string) => new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);

function isRent(payment: any) {
  const metadata = payment?.metadata || {};
  return metadata.type === "rent" && !metadata.is_deposit;
}

/** Rent payments still standing on a rental, latest due date first. */
async function rentPayments(admin: any, rentalId: string) {
  const { data } = await admin
    .from("rental_payments")
    .select("due_date, status, voided, metadata")
    .eq("rental_id", rentalId)
    .order("due_date", { ascending: false });
  return (data || []).filter((payment: any) => !payment.voided && payment.status !== "cancelled" && isRent(payment));
}

/**
 * The day monthly billing starts when a rental with a return date becomes
 * open-ended: the return date, or later when a monthly rental's last rent
 * payment already covers past it (so nobody is charged twice for the same days).
 */
export async function nextMonthlyDue(admin: any, rentalId: string, currentEnd: string, alreadyMonthly: boolean): Promise<string> {
  if (!alreadyMonthly) return currentEnd;
  // Only rent that falls inside the rental counts; anything scheduled past the return date is left over from an earlier plan.
  const last = (await rentPayments(admin, rentalId)).find((payment: any) => String(payment.due_date).slice(0, 10) < currentEnd);
  if (!last?.due_date) return currentEnd;
  const coveredTo = iso(addMonths(asDate(last.due_date), 1));
  return coveredTo > currentEnd ? coveredTo : currentEnd;
}

/** Adds monthly rent payments from `firstDue`. Returns false when they could not be saved. */
export async function addMonthlyPayments(
  admin: any,
  rental: { id: string; organization_id: string; customer_id: string | null; vehicle_id: string | null; currency?: string | null },
  firstDue: string,
  months: number,
  rate: number,
  extra: Record<string, unknown> = {}
): Promise<boolean> {
  if (!rental.customer_id || !rental.vehicle_id || !(rate > 0) || months < 1) return false;
  const today = businessToday();
  const first = asDate(firstDue);
  const records = Array.from({ length: months }, (_, index) => {
    const due = addMonths(first, index);
    return {
      organization_id: rental.organization_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      vehicle_id: rental.vehicle_id,
      amount: rate,
      currency: rental.currency || "THB",
      scheduled_date: iso(due),
      due_date: iso(due),
      // Anything due today or earlier is owed now; the rest waits its turn.
      status: iso(due) <= today ? "pending" : "scheduled",
      metadata: { type: "rent", is_deposit: false, period_label: formatMonthLabel(due), is_upfront: false, open_ended: true, ...extra }
    };
  });
  // A month that already has rent scheduled is not added twice.
  const existing = new Set((await rentPayments(admin, rental.id)).map((payment: any) => String(payment.due_date).slice(0, 10)));
  const fresh = records.filter((record) => !existing.has(record.due_date));
  if (fresh.length === 0) return true;
  const { error } = await admin.from("rental_payments").insert(fresh);
  return !error;
}

/**
 * Keeps open-ended monthly rentals billed ahead: when the last scheduled rent
 * is less than three months away, another six months are added. Run daily.
 */
export async function topUpOpenEndedRent(admin: any): Promise<number> {
  const { data: rentals } = await admin
    .from("rentals")
    .select("id, organization_id, customer_id, vehicle_id, currency, rental_rate, billing_interval, pricing_model")
    .is("deleted_at", null)
    .is("end_date", null)
    .in("status", ["active", "due_soon", "overdue", "extended"]);
  const horizon = iso(addMonths(asDate(businessToday()), 3));
  let added = 0;
  for (const rental of rentals || []) {
    if (String(rental.billing_interval || rental.pricing_model || "").toLowerCase() !== "monthly") continue;
    const last = (await rentPayments(admin, rental.id))[0];
    // A rental with no rent schedule at all is left for a person to look at.
    if (!last?.due_date || String(last.due_date).slice(0, 10) >= horizon) continue;
    const ok = await addMonthlyPayments(admin, rental, iso(addMonths(asDate(last.due_date), 1)), 6, Number(rental.rental_rate || 0), { source: "open_ended_top_up" });
    if (ok) added += 1;
  }
  return added;
}
