import { bookingRules, clashes } from "@/lib/booking-rules";
import { businessToday } from "@/lib/business-time";
import { notifyOperator } from "@/lib/notify-operator";
import { BLOCKING_RENTAL_STATUSES } from "@/lib/rental-conflicts";
import { quoteStay, rentalRateCard } from "@/lib/rental-estimate";
import { recordActivityEvent } from "@/lib/supabase/activity";

/**
 * A customer asks, from their booking page, to keep the vehicle longer. When
 * nothing stands in the way the rental is extended on the spot, with a payment for
 * the extra days priced from the vehicle's daily, weekly and monthly rates. Otherwise the request
 * goes to the business with the reason.
 */

export type ExtensionOutcome =
  | { applied: true; newEndDate: string; amount: number; dueDate: string; currency: string; explain: string | null }
  | { applied: false; reason: string };

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

export async function tryAutoExtend(admin: any, rentalId: string, newEndDateRaw: unknown): Promise<ExtensionOutcome> {
  const newEndDate = String(newEndDateRaw || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newEndDate)) return { applied: false, reason: "no new date was given" };

  const { data: rental } = await admin
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, start_date, end_date, status, rental_rate, pricing_model, billing_interval, currency, vehicles!rentals_vehicle_id_fkey(make, model, daily_rate, weekly_rate, monthly_rate), customers!rentals_customer_id_fkey(full_name)")
    .eq("id", rentalId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!rental) return { applied: false, reason: "the rental could not be found" };
  if (!["active", "due_soon", "overdue", "extended"].includes(String(rental.status))) return { applied: false, reason: "the rental is not on rent" };

  const currentEnd = rental.end_date ? String(rental.end_date).slice(0, 10) : null;
  if (!currentEnd) return { applied: false, reason: "the rental has no end date to extend" };
  if (newEndDate <= currentEnd) return { applied: false, reason: "the new date is not after the current return date" };

  const { data: organization } = await admin.from("organizations").select("settings").eq("id", rental.organization_id).maybeSingle();
  const rules = bookingRules(organization?.settings);
  const today = businessToday();
  if (currentEnd < today) return { applied: false, reason: "the return date has already passed" };
  if (daysBetween(today, currentEnd) < rules.extendNoticeDays) {
    return { applied: false, reason: `it was asked for less than ${rules.extendNoticeDays} ${rules.extendNoticeDays === 1 ? "day" : "days"} before the return date` };
  }

  const { data: others } = await admin
    .from("rentals")
    .select("start_date, end_date")
    .eq("organization_id", rental.organization_id)
    .eq("vehicle_id", rental.vehicle_id)
    .neq("id", rental.id)
    .is("deleted_at", null)
    .in("status", BLOCKING_RENTAL_STATUSES as unknown as string[]);
  const start = String(rental.start_date).slice(0, 10);
  const blocked = (others || []).some((row: any) =>
    clashes(start, newEndDate, { startDate: String(row.start_date).slice(0, 10), endDate: row.end_date ? String(row.end_date).slice(0, 10) : null }, rules.gapDays)
  );
  if (blocked) return { applied: false, reason: "another booking for this vehicle is in the way" };

  const extraDays = daysBetween(currentEnd, newEndDate);
  const quote = quoteStay(rentalRateCard(rental.vehicles, rental), extraDays);
  const amount = quote?.amount ?? 0;
  const currency = String(rental.currency || "THB");

  // The database refuses the change if another booking slipped in meanwhile.
  const { error: updateError } = await admin.from("rentals").update({ end_date: newEndDate }).eq("id", rental.id).eq("end_date", rental.end_date);
  if (updateError) return { applied: false, reason: "another booking for this vehicle is in the way" };

  if (amount > 0 && rental.customer_id) {
    const { error: paymentError } = await admin.from("rental_payments").insert({
      organization_id: rental.organization_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      vehicle_id: rental.vehicle_id,
      due_date: currentEnd,
      scheduled_date: currentEnd,
      status: "pending",
      amount,
      currency,
      metadata: {
        type: "extension",
        description: `Extension - ${currentEnd} to ${newEndDate}`,
        adjustment_type: "extension",
        previous_end_date: currentEnd,
        new_end_date: newEndDate,
        extension_days: extraDays,
        priced_as: quote?.explain || null,
        source: "customer_request_auto"
      }
    });
    if (paymentError) {
      // Don't leave a longer rental with nothing to pay for it.
      await admin.from("rentals").update({ end_date: rental.end_date }).eq("id", rental.id);
      return { applied: false, reason: "the extension payment could not be created" };
    }
  }

  const vehicle = [rental.vehicles?.make, rental.vehicles?.model].filter(Boolean).join(" ") || "vehicle";
  const who = rental.customers?.full_name || "The customer";
  const money = `${currency === "THB" ? "฿" : `${currency} `}${amount.toLocaleString("en-US")}`;
  const detail = `${who} asked to keep the ${vehicle} until ${newEndDate} (was ${currentEnd}). Nothing was in the way, so it was extended automatically. ${money} is due on ${currentEnd}${quote ? ` (${quote.explain})` : ""}.`;
  await Promise.all([
    recordActivityEvent(admin, {
      organization_id: rental.organization_id,
      entity_type: "rental",
      entity_id: rental.id,
      vehicle_id: rental.vehicle_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      event_type: "rental_extended",
      title: `Rental extended to ${newEndDate}`,
      detail
    } as any).catch(() => null),
    admin.from("communication_log").insert({
      organisation_id: rental.organization_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      type: "system_event",
      direction: "internal",
      content: detail,
      status: "sent",
      metadata: { adjustment_type: "extension", previous_end_date: currentEnd, new_end_date: newEndDate, extension_payment_amount: amount, source: "customer_request_auto" }
    })
  ]);
  notifyOperator(rental.organization_id, `📅 Extended automatically: ${who} keeps the ${vehicle} until ${newEndDate}. ${money} due on ${currentEnd}.`, "portal_action").catch(() => null);

  return { applied: true, newEndDate, amount, dueDate: currentEnd, currency, explain: quote?.explain || null };
}
