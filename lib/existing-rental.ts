/**
 * A rental that already existed before it was recorded in RouteHQ (the booking
 * form's "existing rental", and the importer). Marks rent due before
 * "paidBefore" as paid, and records a deposit already held.
 */
export async function settleExistingRental(supabase: any, input: { rental: any; organizationId: string; userId: string; paidBefore: string | null; depositHeld: number; currency: string; recordMoney?: boolean }) {
  const { rental, organizationId, userId, paidBefore, depositHeld, currency } = input;
  // False when the rent received is already in Money in & out (an import with a payment sheet): rows are only marked paid.
  const recordMoney = input.recordMoney !== false;
  const startDate = String(rental.start_date || "").slice(0, 10);

  if (paidBefore) {
    const { data: rows } = await supabase
      .from("rental_payments")
      .select("id, amount, due_date, metadata, voided")
      .eq("organization_id", organizationId)
      .eq("rental_id", rental.id)
      .in("status", ["pending", "overdue", "scheduled"])
      .lt("due_date", paidBefore)
      .is("deleted_at", null)
      .order("due_date", { ascending: true });
    for (const payment of (rows || []).filter((row: any) => !row.voided && row.metadata?.type !== "deposit" && row.metadata?.is_deposit !== true)) {
      const due = String(payment.due_date).slice(0, 10);
      if (!recordMoney) {
        await supabase
          .from("rental_payments")
          .update({ status: "paid", paid_at: `${due}T00:00:00.000Z`, metadata: { ...(payment.metadata || {}), setup_source: "operator_existing_rental", paid_per_sheet: true } })
          .eq("id", payment.id);
        continue;
      }
      const { data: transaction } = await supabase
        .from("transactions")
        .insert({
          organization_id: organizationId,
          vehicle_id: rental.vehicle_id,
          rental_id: rental.id,
          customer_id: rental.customer_id,
          rental_payment_id: payment.id,
          type: "rental_income",
          amount: Number(payment.amount || 0),
          currency,
          transaction_date: due,
          notes: "Rent already paid when the rental was recorded",
          metadata: { source: "existing_rental_setup" },
          created_by: userId
        })
        .select("id")
        .single();
      await supabase
        .from("rental_payments")
        .update({ status: "paid", paid_at: `${due}T00:00:00.000Z`, transaction_id: transaction?.id || null, metadata: { ...(payment.metadata || {}), setup_source: "operator_existing_rental" } })
        .eq("id", payment.id);
    }
  }

  if (depositHeld > 0) {
    const received = `${startDate}T00:00:00.000Z`;
    // The schedule may already have a deposit row waiting (written when the rental was set up): that row is the
    // deposit, now marked as held. Adding a second, paid row left the first one showing as owed.
    const { data: waitingDeposits } = await supabase
      .from("rental_payments")
      .select("id, metadata")
      .eq("organization_id", organizationId)
      .eq("rental_id", rental.id)
      .in("status", ["pending", "overdue", "scheduled"])
      .is("deleted_at", null);
    const unpaidDeposits = ((waitingDeposits || []) as any[]).filter((row) => row.metadata?.type === "deposit" || row.metadata?.is_deposit === true);
    const depositFields = {
      due_date: startDate,
      scheduled_date: startDate,
      paid_at: received,
      status: "paid",
      amount: depositHeld,
      currency
    };
    let depositPayment: { id: string } | null = null;
    if (unpaidDeposits.length) {
      const [first, ...rest] = unpaidDeposits;
      const { data } = await supabase
        .from("rental_payments")
        .update({ ...depositFields, metadata: { ...(first.metadata || {}), type: "deposit", is_deposit: true, description: "Security deposit - already held", setup_source: "operator_existing_rental" } })
        .eq("id", first.id)
        .select("id")
        .single();
      depositPayment = data;
      if (rest.length) await supabase.from("rental_payments").update({ deleted_at: new Date().toISOString() }).in("id", rest.map((row: any) => row.id));
    } else {
      const { data } = await supabase
        .from("rental_payments")
        .insert({
          organization_id: organizationId,
          rental_id: rental.id,
          customer_id: rental.customer_id,
          vehicle_id: rental.vehicle_id,
          ...depositFields,
          metadata: { type: "deposit", is_deposit: true, description: "Security deposit - already held", setup_source: "operator_existing_rental" }
        })
        .select("id")
        .single();
      depositPayment = data;
    }
    await supabase.from("transactions").insert({
      organization_id: organizationId,
      vehicle_id: rental.vehicle_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      rental_payment_id: depositPayment?.id || null,
      type: "deposit_received",
      amount: depositHeld,
      currency,
      transaction_date: startDate,
      notes: "Security deposit already held when the rental was recorded",
      is_deposit: true,
      deposit_rental_id: rental.id,
      metadata: { source: "existing_rental_setup" },
      created_by: userId
    });
    await supabase.from("rentals").update({ deposit_held: depositHeld, deposit_status: "received", deposit_received_at: received }).eq("id", rental.id).eq("organization_id", organizationId);
  }
}
