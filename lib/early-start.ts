import { daysBetween, quoteStay, rentalRateCard } from "@/lib/rental-estimate";

/**
 * Handing a vehicle over before the booked start date. The customer has it for extra days, and the owner
 * says what happens to them (one question at the start of the handover, nothing to set up):
 * - "charge": the extra days are charged at this booking's rates, collected like any rent;
 * - "shorten": same length as booked, so it comes back earlier (fixed-term bookings only);
 * - "free": no charge, back on the booked date.
 * Before this, an early handover simply started the rental today and gave the extra days away.
 */

export type EarlyStartChoice = "charge" | "shorten" | "free";

export type EarlyStart = {
  days: number;
  amount: number;
  bookedStart: string;
  bookedEnd: string | null;
  /** The return date if the booking keeps its length; null when that isn't possible (open-ended, or it would end today or before). */
  shortenedEnd: string | null;
};

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function earlyStartFor(
  rental: { start_date?: unknown; end_date?: unknown; rental_rate?: unknown; pricing_model?: unknown; billing_interval?: unknown } | null | undefined,
  vehicle: { daily_rate?: unknown; weekly_rate?: unknown; monthly_rate?: unknown } | null | undefined,
  today: string
): EarlyStart | null {
  const bookedStart = String(rental?.start_date || "").slice(0, 10);
  if (!bookedStart || bookedStart <= today) return null;
  const days = daysBetween(today, bookedStart);
  const bookedEnd = rental?.end_date ? String(rental.end_date).slice(0, 10) : null;
  const quote = quoteStay(rentalRateCard(vehicle, rental || {}), days);
  const shortenedEnd = bookedEnd ? addDays(bookedEnd, -days) : null;
  return { days, amount: quote?.amount || 0, bookedStart, bookedEnd, shortenedEnd: shortenedEnd && shortenedEnd > today ? shortenedEnd : null };
}

export function asEarlyStartChoice(value: unknown): EarlyStartChoice | null {
  return value === "charge" || value === "shorten" || value === "free" ? value : null;
}

/**
 * What actually happens to the extra days. Nothing chosen means they are charged (when there is a price
 * for them). Giving them away is the owner's call: a teammate's "free" is charged instead.
 */
export function settleEarlyChoice(value: unknown, early: EarlyStart | null, isOwner: boolean): EarlyStartChoice {
  const chosen = asEarlyStartChoice(value);
  const chargeable = Boolean(early && early.amount > 0);
  if (!chosen) return chargeable ? "charge" : "free";
  if (chosen === "free" && chargeable && !isOwner) return "charge";
  return chosen;
}

/**
 * The charge for the extra days, as a payment due today. Written once per booking: a second call (the
 * cash recorded during the handover, then the handover saved) finds it and does nothing.
 */
export async function ensureEarlyStartCharge(
  supabase: any,
  args: { organizationId: string; rentalId: string; vehicleId: string | null; customerId: string | null; currency: string; today: string; early: EarlyStart }
) {
  if (args.early.amount <= 0) return null;
  const { data: rows } = await supabase
    .from("rental_payments")
    .select("id, metadata")
    .eq("organization_id", args.organizationId)
    .eq("rental_id", args.rentalId)
    .is("deleted_at", null);
  const existing = (rows || []).find((row: any) => row.metadata?.early_start);
  if (existing) return existing.id as string;
  const { data, error } = await supabase
    .from("rental_payments")
    .insert({
      organization_id: args.organizationId,
      rental_id: args.rentalId,
      vehicle_id: args.vehicleId,
      customer_id: args.customerId,
      amount: args.early.amount,
      currency: args.currency || "THB",
      status: "scheduled",
      due_date: args.today,
      scheduled_date: args.today,
      metadata: {
        type: "rent",
        description: `${args.early.days} ${args.early.days === 1 ? "day" : "days"} before the booked start`,
        period_label: `${args.early.days} ${args.early.days === 1 ? "day" : "days"} early`,
        early_start: { days: args.early.days, from: args.today, booked_start: args.early.bookedStart }
      }
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data?.id as string;
}
