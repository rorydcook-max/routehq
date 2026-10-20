import { businessToday } from "@/lib/business-time";

/**
 * Rentals whose vehicle has been handed over. Money is only owed on these:
 * a booking that never went out has nothing owed, only a handover to do
 * (or cancel), and what it would collect is shown as "to collect at handover".
 */
// Values of the rental_status enum only: anything else makes a database filter fail outright.
export const HANDED_OVER_STATUSES = ["active", "due_soon", "overdue", "extended", "completed"];

export function isHandedOver(status: unknown) {
  return HANDED_OVER_STATUSES.includes(String(status || "").toLowerCase());
}

/**
 * What each rental owes right now: unpaid payments due today or earlier, on a
 * rental that has been handed over. rentals.balance_due is everything still
 * unpaid, including rent that isn't due for months on an open-ended rental, so
 * it is the wrong number to show as "outstanding" or to chase a customer for.
 */
export async function amountDueNowByRental(supabase: any, rentalIds: string[]) {
  const due = new Map<string, number>();
  const ids = rentalIds.filter(Boolean);
  if (!ids.length) return due;
  const { data, error } = await supabase
    .from("rental_payments")
    .select("rental_id, amount, voided, metadata, rentals!inner(status)")
    .in("rental_id", ids)
    .is("deleted_at", null)
    .in("status", ["scheduled", "pending", "overdue"])
    .in("rentals.status", HANDED_OVER_STATUSES)
    .lte("due_date", businessToday());
  if (error) console.error("[balances] amount due now failed:", error.message);
  for (const row of (data || []) as any[]) {
    if (row.voided || row.metadata?.voided) continue;
    due.set(row.rental_id, (due.get(row.rental_id) || 0) + Number(row.amount || 0));
  }
  return due;
}
