import { bookingRules, clashes } from "@/lib/booking-rules";
import { businessToday } from "@/lib/business-time";
import { notifyOperator } from "@/lib/notify-operator";
import { BLOCKING_RENTAL_STATUSES } from "@/lib/rental-conflicts";
import { recordActivityEvent } from "@/lib/supabase/activity";

/**
 * A customer asks, from their booking page, to keep the vehicle longer. When
 * nothing stands in the way the rental is extended on the spot at the rate
 * they already pay, with a payment for the extra days. Otherwise the request
 * goes to the business with the reason.
 */

export type ExtensionOutcome =
  | { applied: true; newEndDate: string; amount: number; dueDate: string; currency: string }
  | { applied: false; reason: string };

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

/** The price of extra days at the rental's own rate. */
export function extensionAmount(rental: { rental_rate: unknown; pricing_model?: unknown; billing_interval?: unknown }, days: number) {
  const rate = Number(rental.rental_rate || 0);
  const period = String(rental.billing_interval || rental.pricing_model || "monthly").toLowerCase();
  const perDay = period === "daily" ? rate : period === "weekly" ? rate / 7 : rate / 30;
  // To the nearest 10, the way a person would quote it.
  return Math.max(0, Math.round((perDay * days) / 10) * 10);
}

export async function tryAutoExtend(admin: any, rentalId: string, newEndDateRaw: unknown): Promise<ExtensionOutcome> {
  const newEndDate = String(newEndDateRaw || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newEndDate)) return { applied: false, reason: "no new date was given" };

  const { data: rental } = await admin
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, start_date, end_date, status, rental_rate, pricing_model, billing_interval, currency, vehicles!rentals_vehicle_id_fkey(make, model), customers!rentals_customer_id_fkey(full_name)")
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
  const amount = extensionAmount(rental, extraDays);
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
  const detail = `${who} asked to keep the ${vehicle} until ${newEndDate} (was ${currentEnd}). Nothing was in the way, so it was extended automatically. ${money} is due on ${currentEnd}.`;
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

  return { applied: true, newEndDate, amount, dueDate: currentEnd, currency };
}
