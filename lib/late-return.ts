import { daysBetween, quoteStay, rentalRateCard } from "@/lib/rental-estimate";

/**
 * A vehicle brought back after the booked return date, mirroring an early handover: one question on the
 * return form. The extra days are priced from this booking's rates (whole days, as rent; a monthly booking
 * pays the pro-rata day price, as an extension would), and the owner can change the figure and either
 * take it from the deposit, charge it to the renter (an amount due, payable at the return), or waive it.
 * Before this, a late return kept the old end date and was never charged.
 */

export type LateReturnChoice = "deposit" | "charge" | "waive";

export type LateReturn = { days: number; amount: number; bookedEnd: string };

export function lateReturnFor(
  rental: { end_date?: unknown; rental_rate?: unknown; pricing_model?: unknown; billing_interval?: unknown; currency?: unknown } | null | undefined,
  vehicle: { daily_rate?: unknown; weekly_rate?: unknown; monthly_rate?: unknown } | null | undefined,
  today: string
): LateReturn | null {
  const bookedEnd = rental?.end_date ? String(rental.end_date).slice(0, 10) : "";
  if (!bookedEnd || bookedEnd >= today) return null;
  const days = daysBetween(bookedEnd, today);
  // Rounded as the booking's currency is (baht to 10, other currencies to the cent).
  const quote = rental?.currency ? quoteStay(rentalRateCard(vehicle, rental || {}), days, String(rental.currency)) : quoteStay(rentalRateCard(vehicle, rental || {}), days);
  return { days, amount: quote?.amount || 0, bookedEnd };
}

export function asLateReturnChoice(value: unknown): LateReturnChoice | null {
  return value === "deposit" || value === "charge" || value === "waive" ? value : null;
}

/** An amount typed on the form, to the cent and never below zero. */
export function lateReturnAmount(value: unknown): number {
  const amount = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

/**
 * The charge for the late days, as rent due today. Written once per booking: the cash taken on the return
 * form and then the form's save both call it, and the second finds the row. While unpaid, a changed amount
 * replaces the one written; once paid it stays as it is.
 */
export async function ensureLateReturnCharge(
  supabase: any,
  args: { organizationId: string; rentalId: string; vehicleId: string | null; customerId: string | null; currency: string; today: string; late: LateReturn; amount: number; choice: LateReturnChoice }
) {
  const amount = Math.round(Number(args.amount || 0) * 100) / 100;
  if (!(amount > 0) || args.choice === "waive") return null;
  const { data: rows } = await supabase
    .from("rental_payments")
    .select("id, amount, status, metadata")
    .eq("organization_id", args.organizationId)
    .eq("rental_id", args.rentalId)
    .is("deleted_at", null);
  const existing = (rows || []).find((row: any) => row.metadata?.late_return && !["voided", "cancelled", "waived"].includes(String(row.status)));
  const dayWord = args.late.days === 1 ? "day" : "days";
  const lateMeta = { days: args.late.days, booked_end: args.late.bookedEnd, returned: args.today, choice: args.choice, suggested: args.late.amount };
  if (existing) {
    if (!["paid", "reconciled"].includes(String(existing.status)) && Number(existing.amount) !== amount) {
      await supabase.from("rental_payments").update({ amount, metadata: { ...(existing.metadata || {}), late_return: { ...(existing.metadata?.late_return || {}), ...lateMeta } } }).eq("id", existing.id);
    }
    return existing.id as string;
  }
  const { data, error } = await supabase
    .from("rental_payments")
    .insert({
      organization_id: args.organizationId,
      rental_id: args.rentalId,
      vehicle_id: args.vehicleId,
      customer_id: args.customerId,
      amount,
      currency: args.currency || "THB",
      status: "pending",
      due_date: args.today,
      scheduled_date: args.today,
      metadata: {
        type: "rent",
        description: `Returned ${args.late.days} ${dayWord} late`,
        period_label: `${args.late.days} ${dayWord} late`,
        late_return: lateMeta
      }
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data?.id as string;
}
