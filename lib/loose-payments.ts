/**
 * Rent already in Money in & out for a vehicle but not tied to any booking (imported from a sheet, or entered before
 * the booking was added). When a booking for that vehicle covers those dates, the booking page asks "are these from
 * this booking?" and links the ones the owner picks (Rory, 2 Nov 2026). Nothing is linked without asking.
 */

import { rentalVehiclePeriods, VEHICLE_CHANGE_COLUMNS, type VehicleChangeRow } from "@/lib/rental-vehicle-periods";

export type LoosePayment = { id: string; amount: number; date: string; notes: string | null; likely?: boolean };

const day = (value: unknown) => String(value || "").slice(0, 10);
const daysApart = (a: string, b: string) => Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86400000;

/** Unlinked rent for this booking's vehicle within its dates (a few days' slack either side), minus any the owner said aren't from it. */
export async function loosePaymentsFor(supabase: any, rental: { id: string; vehicle_id?: string | null; original_vehicle_id?: string | null; status?: string | null; start_date?: string | null; end_date?: string | null; organization_id: string }): Promise<LoosePayment[]> {
  if (!rental.vehicle_id || !rental.start_date) return [];
  const shift = (iso: string, days: number) => {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };
  // A rental that changed vehicle: each vehicle's payments are looked for only in the days the rental was on it
  // (Rory, 11 Nov 2026: a booking that began on another vehicle was offered the later vehicle's unrelated payments).
  const [{ data: changes }, { data: schedule }] = await Promise.all([
    supabase.from("vehicle_changes").select(VEHICLE_CHANGE_COLUMNS).eq("organization_id", rental.organization_id).eq("rental_id", rental.id),
    supabase.from("rental_payments").select("amount, due_date, voided, metadata").eq("organization_id", rental.organization_id).eq("rental_id", rental.id).is("deleted_at", null)
  ]);
  const periods = rentalVehiclePeriods(rental, (changes || []) as VehicleChangeRow[]);
  if (periods.length === 0) return [];
  const today = new Date().toISOString().slice(0, 10);
  const found = await Promise.all(
    periods.map((period, index) => {
      const from = index === 0 ? shift(period.start, -3) : period.start;
      const last = index === periods.length - 1;
      // Up to the day before the change; the last period runs a week past the end (or today).
      const to = last ? shift(period.end || today, 7) : shift(period.end || today, -1);
      return supabase
        .from("transactions")
        .select("id, amount, transaction_date, notes, metadata")
        .eq("organization_id", rental.organization_id)
        .eq("vehicle_id", period.vehicleId)
        .eq("type", "rental_income")
        .is("rental_id", null)
        .is("deleted_at", null)
        .or("voided.is.null,voided.eq.false")
        .gte("transaction_date", from)
        .lte("transaction_date", to)
        .order("transaction_date", { ascending: true })
        .limit(60);
    })
  );
  const rent = ((schedule || []) as any[]).filter((row) => !row.voided && row.metadata?.type !== "deposit" && row.metadata?.is_deposit !== true);
  const seen = new Set<string>();
  return found
    .flatMap((result) => (result.data || []) as any[])
    .filter((row) => !seen.has(row.id) && Boolean(seen.add(row.id)))
    .filter((row) => !(Array.isArray(row.metadata?.not_rentals) && row.metadata.not_rentals.includes(rental.id)))
    .map((row) => {
      const date = day(row.transaction_date);
      // Likely this booking's: the same amount as one of its rents, within a few days of when that rent was due.
      const likely = rent.some((due) => Math.abs(Number(due.amount) - Number(row.amount)) < 0.5 && daysApart(day(due.due_date), date) <= 5);
      return { id: row.id, amount: Number(row.amount), date, notes: row.notes || null, likely };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Makes the chosen payments this booking's. Each one settles the closest rent of the same amount on the booking's
 * schedule (within three weeks): an unpaid one is marked paid with it; one already marked paid by the "already paid
 * when recorded" setup has that stand-in entry replaced by the real payment, so the money is never counted twice.
 * A payment with no matching rent is still linked to the booking.
 */
export async function linkPaymentsToRental(supabase: any, rental: { id: string; organization_id: string; customer_id?: string | null; vehicle_id?: string | null }, transactionIds: string[]) {
  if (!transactionIds.length) return 0;
  const [{ data: loose }, { data: schedule }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, amount, transaction_date")
      .eq("organization_id", rental.organization_id)
      .is("rental_id", null)
      .in("id", transactionIds),
    supabase
      .from("rental_payments")
      .select("id, amount, due_date, status, transaction_id, metadata, voided")
      .eq("organization_id", rental.organization_id)
      .eq("rental_id", rental.id)
      .is("deleted_at", null)
  ]);
  const rows = ((schedule || []) as any[]).filter((row) => !row.voided && row.metadata?.type !== "deposit" && row.metadata?.is_deposit !== true);
  const used = new Set<string>();
  // Stand-in entries made when the booking was recorded as "already paid": replaced, not added to.
  const standInIds = rows.map((row) => row.transaction_id).filter(Boolean);
  const { data: standIns } = standInIds.length
    ? await supabase.from("transactions").select("id, metadata").in("id", standInIds)
    : { data: [] };
  const isStandIn = new Set(((standIns || []) as any[]).filter((row) => row.metadata?.source === "existing_rental_setup").map((row) => row.id));

  let linked = 0;
  for (const payment of ((loose || []) as any[]).sort((a, b) => day(a.transaction_date).localeCompare(day(b.transaction_date)))) {
    const date = day(payment.transaction_date);
    const candidates = rows
      .filter((row) => !used.has(row.id) && Math.abs(Number(row.amount) - Number(payment.amount)) < 0.5 && daysApart(day(row.due_date), date) <= 21)
      .filter((row) => row.status !== "paid" || isStandIn.has(row.transaction_id))
      .sort((a, b) => Number(a.status === "paid") - Number(b.status === "paid") || daysApart(day(a.due_date), date) - daysApart(day(b.due_date), date));
    const match = candidates[0];
    if (match) {
      used.add(match.id);
      if (match.status === "paid" && match.transaction_id && isStandIn.has(match.transaction_id)) {
        await supabase.from("transactions").update({ deleted_at: new Date().toISOString(), notes: "Replaced by the real payment linked from Money in & out" }).eq("id", match.transaction_id);
      }
      await supabase
        .from("rental_payments")
        .update({ status: "paid", paid_at: `${date}T00:00:00.000Z`, transaction_id: payment.id, metadata: { ...(match.metadata || {}), linked_existing_payment: true } })
        .eq("id", match.id);
    }
    await supabase
      .from("transactions")
      .update({ rental_id: rental.id, customer_id: rental.customer_id || null, rental_payment_id: match?.id || null })
      .eq("id", payment.id)
      .eq("organization_id", rental.organization_id);
    linked++;
  }
  return linked;
}

/** The owner says these payments aren't from this booking: it stops asking about them. */
export async function markNotFromRental(supabase: any, organizationId: string, rentalId: string, transactionIds: string[]) {
  if (!transactionIds.length) return;
  const { data } = await supabase.from("transactions").select("id, metadata").eq("organization_id", organizationId).in("id", transactionIds);
  for (const row of (data || []) as any[]) {
    const not = Array.isArray(row.metadata?.not_rentals) ? row.metadata.not_rentals : [];
    await supabase.from("transactions").update({ metadata: { ...(row.metadata || {}), not_rentals: [...new Set([...not, rentalId])] } }).eq("id", row.id);
  }
}

export { daysApart };
