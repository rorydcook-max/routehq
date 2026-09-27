import { businessToday } from "@/lib/business-time";

/**
 * What each rental owes right now: unpaid payments due today or earlier.
 * rentals.balance_due is everything still unpaid, including rent that isn't
 * due for months on an open-ended rental, so it is the wrong number to show
 * as "outstanding" or to chase a customer for.
 */
export async function amountDueNowByRental(supabase: any, rentalIds: string[]) {
  const due = new Map<string, number>();
  const ids = rentalIds.filter(Boolean);
  if (!ids.length) return due;
  const { data } = await supabase
    .from("rental_payments")
    .select("rental_id, amount, voided, metadata")
    .in("rental_id", ids)
    .is("deleted_at", null)
    .in("status", ["scheduled", "pending", "overdue"])
    .lte("due_date", businessToday());
  for (const row of (data || []) as any[]) {
    if (row.voided || row.metadata?.voided) continue;
    due.set(row.rental_id, (due.get(row.rental_id) || 0) + Number(row.amount || 0));
  }
  return due;
}
