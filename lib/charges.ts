import { businessToday } from "@/lib/business-time";
import { tellRentalCustomer } from "@/lib/customer-messages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Billing a renter for a cost that is theirs (damage, a fine, fuel, cleaning) and that the deposit did not cover.
 *
 * The cost itself is money out, recorded as an expense. The bill is an amount due on the booking: it shows on the
 * booking, on the customer's page (where they can pay it) and in what is owed. When it is paid it is recorded as
 * "charge paid by customer", money in, so the cost and what came back stand side by side. If the customer never
 * pays, the owner waives it from the booking and the expense stands alone.
 */
export type ChargeReason = "damage" | "fuel" | "cleaning" | "fine" | "repair" | "other";

export async function billRentalCustomer(
  supabase: any,
  input: {
    organizationId: string;
    rentalId: string;
    amount: number;
    /** Shown to the customer and on the booking, as written. Left out when the reasons say it (the return form). */
    description?: string | null;
    reasons?: string[];
    expenseTransactionId?: string | null;
    /** Tell the customer now (a bill added later). The return form leaves it to its own closing message. */
    tellCustomer?: boolean;
    sentBy?: string | null;
  }
): Promise<{ id: string } | null> {
  const amount = Math.round(Number(input.amount || 0) * 100) / 100;
  if (!(amount > 0)) return null;
  const { data: rental } = await supabase
    .from("rentals")
    .select("id, organization_id, customer_id, vehicle_id, currency")
    .eq("id", input.rentalId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!rental?.customer_id) throw new Error("This booking has no customer to bill.");
  const today = businessToday();
  const { data, error } = await supabase
    .from("rental_payments")
    .insert({
      organization_id: rental.organization_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      vehicle_id: rental.vehicle_id,
      due_date: today,
      scheduled_date: today,
      amount,
      currency: rental.currency || "THB",
      status: "pending",
      metadata: {
        type: "charge",
        ...(input.description ? { description: input.description } : {}),
        charge_reasons: input.reasons || [],
        ...(input.expenseTransactionId ? { expense_transaction_id: input.expenseTransactionId } : {})
      }
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (input.tellCustomer) {
    await tellRentalCustomer(
      createSupabaseAdminClient() as any,
      rental.id,
      ({ say, money }) => input.description ? say("chargeAdded", { amount: money(amount), reason: input.description }) : say("chargeAddedPlain", { amount: money(amount) }),
      { sentBy: input.sentBy || null }
    );
  }
  return { id: String(data.id) };
}

/** How much of a booking's deposit is still held and not yet returned or kept. */
export function depositStillHeld(rental: { deposit_held?: unknown; deposit_refunded_amount?: unknown; deposit_forfeited_amount?: unknown; deposit_status?: unknown }) {
  if (rental?.deposit_status === "fully_returned") return 0;
  return Math.max(0, Number(rental?.deposit_held || 0) - Number(rental?.deposit_refunded_amount || 0) - Number(rental?.deposit_forfeited_amount || 0));
}

/**
 * A cost the renter is responsible for, added against their booking: it comes out of any deposit still held first,
 * and what the deposit does not cover is billed to them (unless the owner says not to, for example because
 * insurance covers anything above the deposit). The customer is told once, with both parts.
 */
export async function chargeRenter(
  supabase: any,
  input: {
    organizationId: string;
    rentalId: string;
    amount: number;
    description?: string | null;
    reasons?: string[];
    expenseTransactionId?: string | null;
    billRemainder: boolean;
    sentBy?: string | null;
  }
): Promise<{ fromDeposit: number; billed: number }> {
  const amount = Math.round(Number(input.amount || 0) * 100) / 100;
  if (!(amount > 0)) return { fromDeposit: 0, billed: 0 };
  const { data: rental } = await supabase
    .from("rentals")
    .select("id, deposit_held, deposit_refunded_amount, deposit_forfeited_amount, deposit_status")
    .eq("id", input.rentalId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!rental) throw new Error("Booking was not found.");

  const fromDeposit = Math.min(depositStillHeld(rental), amount);
  if (fromDeposit > 0) {
    const { applyDepositDeduction } = await import("@/app/actions/deposits");
    const deduction = new FormData();
    deduction.set("organizationId", input.organizationId);
    deduction.set("rentalId", input.rentalId);
    deduction.set("deductionAmount", String(fromDeposit));
    deduction.set("reason", input.description || (input.reasons || []).join(", ") || "Charge");
    deduction.set("notes", "Taken from the deposit for a cost added to the booking.");
    await applyDepositDeduction(deduction);
  }

  const rest = Math.round((amount - fromDeposit) * 100) / 100;
  let billed = 0;
  if (rest > 0 && input.billRemainder) {
    await billRentalCustomer(supabase, { ...input, amount: rest, tellCustomer: false });
    billed = rest;
  }

  if (fromDeposit > 0 || billed > 0) {
    await tellRentalCustomer(
      createSupabaseAdminClient() as any,
      input.rentalId,
      ({ say, t, money }) => {
        const reason = input.description || "";
        const lines: string[] = [];
        if (fromDeposit > 0) lines.push(reason ? say("chargeFromDeposit", { amount: money(fromDeposit), reason }) : say("chargeFromDepositPlain", { amount: money(fromDeposit) }));
        if (billed > 0) lines.push(fromDeposit > 0 ? t("chargeRestToPay", { amount: money(billed) }) : reason ? say("chargeAdded", { amount: money(billed), reason }) : say("chargeAddedPlain", { amount: money(billed) }));
        return lines.join(" ");
      },
      { sentBy: input.sentBy || null }
    );
  }
  return { fromDeposit, billed };
}
