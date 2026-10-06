import { completeRentalJobs, tellRentalCustomer } from "@/lib/customer-messages";
import { niceDate } from "@/lib/nice-date";
import { bookingRules, clashes } from "@/lib/booking-rules";
import { businessToday } from "@/lib/business-time";
import { notifyOperator } from "@/lib/notify-operator";
import { addMonthlyPayments, nextMonthlyDue } from "@/lib/open-ended-billing";
import { BLOCKING_RENTAL_STATUSES } from "@/lib/rental-conflicts";
import { planFor, quoteStay, rentalRateCard } from "@/lib/rental-estimate";
import { recordActivityEvent } from "@/lib/supabase/activity";

/**
 * A customer asks, from their booking page, to keep the vehicle longer: either
 * to a new return date, or with no end date at the monthly rate. When nothing
 * stands in the way the rental is changed on the spot. Extra days to a new date
 * are priced from the vehicle's daily, weekly and monthly rates; with no end
 * date the monthly rate is billed each month. Otherwise the request goes to the
 * business with the reason.
 */

export type ExtensionOutcome =
  | { applied: true; openEnded: false; newEndDate: string; amount: number; dueDate: string; currency: string; explain: string | null }
  | { applied: true; openEnded: true; newEndDate: null; amount: number; dueDate: string; currency: string; explain: string | null }
  | { applied: false; reason: string };

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

export async function tryAutoExtend(admin: any, rentalId: string, newEndDateRaw: unknown, options: { openEnded?: boolean; byStaff?: boolean } = {}): Promise<ExtensionOutcome> {
  const openEnded = !!options.openEnded;
  const newEndDate = openEnded ? null : String(newEndDateRaw || "").slice(0, 10);
  if (!openEnded && !/^\d{4}-\d{2}-\d{2}$/.test(String(newEndDate))) return { applied: false, reason: "no new date was given" };

  const { data: rental } = await admin
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, start_date, end_date, status, rental_rate, pricing_model, billing_interval, currency, vehicles!rentals_vehicle_id_fkey(make, model, daily_rate, weekly_rate, monthly_rate), customers!rentals_customer_id_fkey(full_name)")
    .eq("id", rentalId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!rental) return { applied: false, reason: "the rental could not be found" };
  if (!["active", "due_soon", "overdue", "extended"].includes(String(rental.status))) return { applied: false, reason: "the rental is not on rent" };

  const currentEnd = rental.end_date ? String(rental.end_date).slice(0, 10) : null;
  if (!currentEnd) return { applied: false, reason: "the rental already has no end date" };
  if (newEndDate && newEndDate <= currentEnd) return { applied: false, reason: "the new date is not after the current return date" };

  const { data: organization } = await admin.from("organizations").select("settings").eq("id", rental.organization_id).maybeSingle();
  const rules = bookingRules(organization?.settings);
  const today = businessToday();
  if (!options.byStaff && currentEnd < today) return { applied: false, reason: "the return date has already passed" };
  // The notice period is for requests applied without anyone looking; an owner approving it has looked.
  if (!options.byStaff && daysBetween(today, currentEnd) < rules.extendNoticeDays) {
    return { applied: false, reason: `it was asked for less than ${rules.extendNoticeDays} ${rules.extendNoticeDays === 1 ? "day" : "days"} before the return date` };
  }

  const card = rentalRateCard(rental.vehicles, rental);
  if (openEnded && !(card.monthlyRate > 0)) return { applied: false, reason: "this vehicle has no monthly rate set" };

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
  if (blocked) return { applied: false, reason: openEnded ? "a later booking for this vehicle is in the way" : "another booking for this vehicle is in the way" };

  const currency = String(rental.currency || "THB");
  const vehicle = [rental.vehicles?.make, rental.vehicles?.model].filter(Boolean).join(" ") || "vehicle";
  const who = rental.customers?.full_name || "The customer";
  const baht = (value: number) => `${currency === "THB" ? "฿" : `${currency} `}${value.toLocaleString("en-US")}`;

  let outcome: ExtensionOutcome;
  let detail: string;
  let title: string;
  let alert: string;
  let logMetadata: Record<string, unknown>;

  if (openEnded) {
    const previous = { end_date: rental.end_date, is_indefinite: false, rental_rate: rental.rental_rate, pricing_model: rental.pricing_model, billing_interval: rental.billing_interval };
    const firstDue = await nextMonthlyDue(admin, rental.id, currentEnd, String(rental.billing_interval || rental.pricing_model || "").toLowerCase() === "monthly");
    // The database refuses the change if another booking slipped in meanwhile.
    const { error: updateError } = await admin
      .from("rentals")
      .update({ end_date: null, is_indefinite: true, rental_rate: card.monthlyRate, pricing_model: "monthly", billing_interval: "monthly", recurring_billing: true })
      .eq("id", rental.id)
      .eq("end_date", rental.end_date);
    if (updateError) return { applied: false, reason: "a later booking for this vehicle is in the way" };

    const created = await addMonthlyPayments(admin, { ...rental, currency }, firstDue, 12, card.monthlyRate, { source: "customer_request_auto", previous_end_date: currentEnd }).catch(() => false);
    if (!created) {
      // Don't leave an open-ended rental with nothing to pay for it.
      await admin.from("rentals").update(previous).eq("id", rental.id);
      return { applied: false, reason: "the monthly payments could not be created" };
    }

    outcome = { applied: true, openEnded: true, newEndDate: null, amount: card.monthlyRate, dueDate: firstDue, currency, explain: `${baht(card.monthlyRate)} a month` };
    title = "Rental changed to no end date";
    detail = `${who} asked to keep the ${vehicle} with no end date (was due back ${niceDate(currentEnd)}). ${options.byStaff ? "You approved it." : "Nothing was in the way, so it was changed automatically."} ${baht(card.monthlyRate)} is due each month from ${niceDate(firstDue)}.`;
    alert = `📅 Now open-ended: ${who} keeps the ${vehicle} with no end date. ${baht(card.monthlyRate)} a month from ${niceDate(firstDue)}.`;
    logMetadata = { adjustment_type: "extension", open_ended: true, previous_end_date: currentEnd, new_end_date: null, monthly_rate: card.monthlyRate, first_due: firstDue, source: "customer_request_auto" };
  } else {
    const endDate = String(newEndDate);
    const extraDays = daysBetween(currentEnd, endDate);
    const quote = quoteStay(card, extraDays);
    const amount = quote?.amount ?? 0;
    // With nobody looking, extra days are only added at a rate meant for a stay of that length
    // (the same rule as booking online). A few days on a monthly-only vehicle, or a vehicle with
    // no rates at all, goes to the business to price - never through at a slice of the monthly
    // rate, and never for nothing.
    if (!(amount > 0)) {
      return { applied: false, reason: "no rates to price the extra days. Set a price with Extend on the booking" };
    }
    if (!options.byStaff && !planFor(card, extraDays)) {
      return { applied: false, reason: `no rate for a stay this short. Approve for ${baht(amount)} (${quote?.explain}), or set a price with Extend` };
    }

    // The database refuses the change if another booking slipped in meanwhile.
    const { error: updateError } = await admin.from("rentals").update({ end_date: endDate }).eq("id", rental.id).eq("end_date", rental.end_date);
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
          description: `Extension - ${niceDate(currentEnd)} to ${niceDate(endDate)}`,
          adjustment_type: "extension",
          previous_end_date: currentEnd,
          new_end_date: endDate,
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

    outcome = { applied: true, openEnded: false, newEndDate: endDate, amount, dueDate: currentEnd, currency, explain: quote?.explain || null };
    title = `Rental extended to ${niceDate(endDate)}`;
    detail = `${who} asked to keep the ${vehicle} until ${niceDate(endDate)} (was ${niceDate(currentEnd)}). ${options.byStaff ? "You approved it." : "Nothing was in the way, so it was extended automatically."} ${baht(amount)} is due on ${niceDate(currentEnd)}${quote ? ` (${quote.explain})` : ""}.`;
    alert = `📅 Extended automatically: ${who} keeps the ${vehicle} until ${niceDate(endDate)}. ${baht(amount)} due on ${niceDate(currentEnd)}.`;
    logMetadata = { adjustment_type: "extension", previous_end_date: currentEnd, new_end_date: endDate, extension_payment_amount: amount, source: "customer_request_auto" };
  }

  await Promise.all([
    recordActivityEvent(admin, {
      organization_id: rental.organization_id,
      entity_type: "rental",
      entity_id: rental.id,
      vehicle_id: rental.vehicle_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      event_type: "rental_extended",
      title,
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
      metadata: logMetadata
    })
  ]);
  if (!options.byStaff) notifyOperator(rental.organization_id, alert, "portal_action", `/bookings/${rental.id}`).catch(() => null);

  await tellRentalCustomer(admin, rental.id, ({ firstName, money }) =>
    outcome.applied && outcome.openEnded
      ? `Hi ${firstName}, your rental of the ${vehicle} is now monthly with no end date. ${money(outcome.amount)} is due each month from ${niceDate(outcome.dueDate)}. Tell us when you'd like to return it.`
      : outcome.applied
        ? `Hi ${firstName}, your rental of the ${vehicle} is extended to ${niceDate(outcome.newEndDate)}.${outcome.amount > 0 ? ` ${money(outcome.amount)} for the extra days is due on ${niceDate(outcome.dueDate)}.` : ""}`
        : ""
  );

  return outcome;
}
