/**
 * Rent already in Money in & out for a vehicle but not tied to any booking (imported from a sheet, or entered before
 * the booking was added). When a booking for that vehicle covers those dates, the booking page asks "are these from
 * this booking?" and links the ones the owner picks (Rory, 2 Nov 2026). Nothing is linked without asking.
 */

export type LoosePayment = { id: string; amount: number; date: string; notes: string | null };

const day = (value: unknown) => String(value || "").slice(0, 10);
const daysApart = (a: string, b: string) => Math.abs(new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86400000;

/** Unlinked rent for this booking's vehicle within its dates (a few days' slack either side), minus any the owner said aren't from it. */
export async function loosePaymentsFor(supabase: any, rental: { id: string; vehicle_id?: string | null; start_date?: string | null; end_date?: string | null; organization_id: string }): Promise<LoosePayment[]> {
  if (!rental.vehicle_id || !rental.start_date) return [];
  const start = new Date(`${day(rental.start_date)}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 3);
  const end = new Date(`${day(rental.end_date) || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  const { data } = await supabase
    .from("transactions")
    .select("id, amount, transaction_date, notes, metadata")
    .eq("organization_id", rental.organization_id)
    .eq("vehicle_id", rental.vehicle_id)
    .eq("type", "rental_income")
    .is("rental_id", null)
    .is("deleted_at", null)
    .or("voided.is.null,voided.eq.false")
    .gte("transaction_date", start.toISOString().slice(0, 10))
    .lte("transaction_date", end.toISOString().slice(0, 10))
    .order("transaction_date", { ascending: true })
    .limit(60);
  return ((data || []) as any[])
    .filter((row) => !(Array.isArray(row.metadata?.not_rentals) && row.metadata.not_rentals.includes(rental.id)))
    .map((row) => ({ id: row.id, amount: Number(row.amount), date: day(row.transaction_date), notes: row.notes || null }));
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
      .eq("vehicle_id", rental.vehicle_id)
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
