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
