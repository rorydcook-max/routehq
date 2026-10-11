/**
 * A rental that already existed before it was recorded in RouteHQ (the booking
 * form's "existing rental", and the importer). Marks rent due before
 * "paidBefore" as paid, and records a deposit already held.
 */
export async function settleExistingRental(supabase: any, input: { rental: any; organizationId: string; userId: string; paidBefore: string | null; depositHeld: number; currency: string }) {
  const { rental, organizationId, userId, paidBefore, depositHeld, currency } = input;
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
    const { data: depositPayment } = await supabase
      .from("rental_payments")
      .insert({
        organization_id: organizationId,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        vehicle_id: rental.vehicle_id,
        due_date: startDate,
        scheduled_date: startDate,
        paid_at: received,
        status: "paid",
        amount: depositHeld,
        currency,
        metadata: { type: "deposit", is_deposit: true, description: "Security deposit - already held", setup_source: "operator_existing_rental" }
      })
      .select("id")
      .single();
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
