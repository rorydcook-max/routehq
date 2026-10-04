import { businessToday } from "@/lib/business-time";
import { remindRentalCustomerOnce } from "@/lib/customer-messages";
import { complianceItems } from "@/lib/fleet-metrics";
import { niceDate } from "@/lib/nice-date";

/**
 * The reminders customers get without anyone sending them, run once a day:
 *
 *   - handover tomorrow
 *   - return in three days, and tomorrow (with how to keep the vehicle longer)
 *   - rent due tomorrow, and rent three days overdue
 *   - the vehicle they have is due a service or a paperwork renewal this week
 *
 * Each goes out once (see remindRentalCustomerOnce) on the customer's own
 * chat, or is left on the booking for the owner when they have none.
 */

const ON_RENT = ["active", "due_soon", "overdue", "extended"];

export async function sendDailyCustomerReminders(admin: any): Promise<Record<string, number>> {
  const today = businessToday();
  const tomorrow = businessToday(1);
  const inThreeDays = businessToday(3);
  const threeDaysAgo = businessToday(-3);
  const sent = { handover: 0, returnSoon: 0, rentDue: 0, rentOverdue: 0, vehicleDue: 0 };

  // ── Handover tomorrow ────────────────────────────────────────────────────
  const { data: starting } = await admin
    .from("rentals")
    .select("id, start_date, delivery_datetime, delivery_location")
    .is("deleted_at", null)
    .eq("status", "booked")
    .eq("start_date", tomorrow);
  for (const rental of starting || []) {
    const ok = await remindRentalCustomerOnce(admin, rental.id, `handover:${tomorrow}`, ({ firstName, vehicle }) =>
      `Hi ${firstName}, your rental of the ${vehicle} starts tomorrow, ${niceDate(tomorrow)}.${rental.delivery_location ? ` Handover: ${rental.delivery_location}.` : ""} If you haven't yet, please finish your details and sign the agreement from your booking page so the handover is quick.`
    );
    if (ok) sent.handover += 1;
  }

  // ── Return coming up ─────────────────────────────────────────────────────
  const { data: ending } = await admin
    .from("rentals")
    .select("id, end_date")
    .is("deleted_at", null)
    .in("status", ON_RENT)
    .in("end_date", [tomorrow, inThreeDays]);
  for (const rental of ending || []) {
    const end = String(rental.end_date).slice(0, 10);
    const ok = await remindRentalCustomerOnce(admin, rental.id, `return:${end}:${end === tomorrow ? "1" : "3"}`, ({ firstName, vehicle }) =>
      `Hi ${firstName}, the ${vehicle} is due back ${end === tomorrow ? "tomorrow" : "in three days"}, ${niceDate(end)}. Want to keep it longer? Choose a new date, or switch to monthly, from your booking page. To arrange the return, tap "Confirm return" there.`
    );
    if (ok) sent.returnSoon += 1;
  }

  // ── Rent due tomorrow, and rent three days late ──────────────────────────
  const { data: payments } = await admin
    .from("rental_payments")
    .select("id, rental_id, amount, due_date, voided, metadata, rentals!inner(status)")
    .is("deleted_at", null)
    .in("status", ["scheduled", "pending", "overdue"])
    .in("due_date", [tomorrow, threeDaysAgo])
    .in("rentals.status", ON_RENT);
  for (const payment of payments || []) {
    if (payment.voided || payment.metadata?.voided) continue;
    // A receipt is already with the business: nothing to chase.
    if (payment.metadata?.receipt?.path) continue;
    const due = String(payment.due_date).slice(0, 10);
    const late = due === threeDaysAgo;
    const ok = await remindRentalCustomerOnce(admin, payment.rental_id, `${late ? "rent-late" : "rent-due"}:${payment.id}`, ({ firstName, vehicle, money }) =>
      late
        ? `Hi ${firstName}, ${money(Number(payment.amount || 0))} for the ${vehicle} was due on ${niceDate(due)} and we haven't recorded it yet. You can pay and send your receipt from your booking page. If you've already paid, please send the receipt and we'll update it.`
        : `Hi ${firstName}, a reminder that ${money(Number(payment.amount || 0))} for the ${vehicle} is due tomorrow, ${niceDate(due)}. You can pay and send your receipt from your booking page. Thank you.`
    );
    if (ok) sent[late ? "rentOverdue" : "rentDue"] += 1;
  }

  // ── The vehicle they have needs a service or a renewal this week ─────────
  const { data: out } = await admin
    .from("rentals")
    .select("id, vehicles!rentals_vehicle_id_fkey(metadata)")
    .is("deleted_at", null)
    .in("status", ON_RENT);
  for (const rental of out || []) {
    for (const item of complianceItems(rental.vehicles?.metadata, today)) {
      if (item.daysLeft < 0 || item.daysLeft > 7) continue;
      const service = item.key === "next_service_date";
      const ok = await remindRentalCustomerOnce(
        admin,
        rental.id,
        `vehicle:${item.key}:${item.date}`,
        ({ firstName, vehicle }) =>
          service
            ? `Hi ${firstName}, the ${vehicle} is due a service on ${niceDate(item.date)}. We'll be in touch to arrange a time that suits you; it usually takes a few hours.`
            : `Hi ${firstName}, the ${item.label.toLowerCase()} on the ${vehicle} is being renewed around ${niceDate(item.date)}. We may need the vehicle or its documents briefly and will be in touch to arrange it.`,
        { withLink: false }
      );
      if (ok) sent.vehicleDue += 1;
    }
  }

  return sent;
}
