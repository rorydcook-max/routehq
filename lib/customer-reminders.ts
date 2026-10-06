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
 *   - a change to their rental is still waiting for their signature
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
  const sent = { handover: 0, returnSoon: 0, rentDue: 0, rentOverdue: 0, vehicleDue: 0, signature: 0 };

  // ── Handover tomorrow ────────────────────────────────────────────────────
  const { data: starting } = await admin
    .from("rentals")
    .select("id, start_date, delivery_datetime, delivery_location")
    .is("deleted_at", null)
    .eq("status", "booked")
    .eq("start_date", tomorrow);
  for (const rental of starting || []) {
    const ok = await remindRentalCustomerOnce(admin, rental.id, `handover:${tomorrow}`, ({ say, t, vehicle, date }) =>
      `${say("handoverTomorrow", { vehicle, date: date(tomorrow) })}${rental.delivery_location ? ` ${t("handoverPlace", { place: rental.delivery_location })}` : ""} ${t("finishDetails")}`
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
    const ok = await remindRentalCustomerOnce(admin, rental.id, `return:${end}:${end === tomorrow ? "1" : "3"}`, ({ say, t, label, vehicle, date }) =>
      `${say(end === tomorrow ? "dueBackTomorrow" : "dueBackThreeDays", { vehicle, date: date(end) })} ${t("keepLonger", { button: label("confirmReturn") })}`
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
    const ok = await remindRentalCustomerOnce(admin, payment.rental_id, `${late ? "rent-late" : "rent-due"}:${payment.id}`, ({ say, vehicle, money, date }) =>
      say(late ? "rentLate" : "rentDueTomorrow", { amount: money(Number(payment.amount || 0)), vehicle, date: date(due) })
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
        ({ say, vehicle, date }) => say(service ? "serviceDue" : "renewalDue", { vehicle, date: date(item.date) }),
        { withLink: false }
      );
      if (ok) sent.vehicleDue += 1;
    }
  }

  // ── A change is waiting for their signature ──────────────────────────────
  // The day after it was sent, then every three days, until it is signed or cancelled.
  const { data: unsigned } = await admin
    .from("rental_amendments")
    .select("id, rental_id, token, changes, created_at, expires_at")
    .eq("status", "awaiting_signature");
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  for (const amendment of unsigned || []) {
    if (amendment.expires_at && new Date(amendment.expires_at).getTime() < Date.now()) continue;
    const days = Math.floor((Date.now() - new Date(amendment.created_at).getTime()) / 86_400_000);
    if (days < 1 || (days - 1) % 3 !== 0) continue;
    const link = `${base}/amend/${amendment.token}`;
    const already = Boolean(amendment.changes?.applied_before_signature);
    const replacement = amendment.changes?.new_vehicle_label ? String(amendment.changes.new_vehicle_label) : "";
    const ok = await remindRentalCustomerOnce(
      admin,
      amendment.rental_id,
      `amendment:${amendment.id}:${days}`,
      ({ say, vehicle }) => (already ? say("signStillNeeded", { vehicle: replacement || vehicle, link }) : say("signWaiting", { vehicle, link })),
      { withLink: false }
    );
    if (ok) sent.signature += 1;
  }

  return sent;
}
