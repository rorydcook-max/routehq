"use server";

import { completeRentalJobs, tellRentalCustomer } from "@/lib/customer-messages";
import { revalidatePath } from "next/cache";
import { niceDate } from "@/lib/nice-date";
import { notifyOperator } from "@/lib/notify-operator";
import { receiptOf } from "@/lib/payment-receipts";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncVehicleStatusFromBookings } from "@/lib/vehicle-status";

type Result = { ok: true; paid: number; receiptWaiting: boolean } | { ok: false; error: string };

/**
 * A customer cancels their own booking from their booking link, before they
 * have the vehicle. The dates open up at once. Anything they have already paid
 * is left for the business to settle, as a job on the to-do list.
 */
export async function cancelBookingByCustomer(formData: FormData): Promise<Result> {
  const token = String(formData.get("token") || "").trim();
  const reason = String(formData.get("reason") || "").trim().slice(0, 500);
  if (!token) return { ok: false, error: "This booking link could not be found." };

  const admin = createSupabaseAdminClient() as any;
  const { data: link } = await admin.from("booking_links").select("id, organization_id, rental_id, vehicle_id, customer_id, status, booking_data").eq("token", token).is("deleted_at", null).maybeSingle();
  if (!link?.rental_id) return { ok: false, error: "This booking link could not be found." };

  const { data: rental } = await admin
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, status, start_date, end_date, currency, display_code, reference, vehicles!rentals_vehicle_id_fkey(make, model), customers!rentals_customer_id_fkey(full_name)")
    .eq("id", link.rental_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!rental) return { ok: false, error: "This booking could not be found." };
  if (rental.status === "cancelled" || link.status === "cancelled") return { ok: false, error: "This booking has already been cancelled." };
  // Once the vehicle is with the customer it is a return, not a cancellation.
  if (!["booked", "draft"].includes(String(rental.status))) return { ok: false, error: "This rental has already started, so it can't be cancelled here. Please tell us when you would like to return the vehicle instead." };

  const { data: payments } = await admin.from("rental_payments").select("amount, status, voided, metadata").eq("rental_id", rental.id);
  const live = (payments || []).filter((payment: any) => !payment.voided);
  const paid = live.filter((payment: any) => payment.status === "paid").reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const receiptWaiting = live.some((payment: any) => payment.status !== "paid" && receiptOf(payment.metadata));

  const now = new Date().toISOString();
  const { error: rentalError } = await admin.from("rentals").update({ status: "cancelled" }).eq("id", rental.id).in("status", ["booked", "draft"]);
  if (rentalError) return { ok: false, error: "We couldn't cancel the booking. Please try again or contact us." };
  await Promise.all([
    admin
      .from("booking_links")
      .update({ status: "cancelled", cancelled_at: now, booking_data: { ...(link.booking_data || {}), cancelled_by_customer: { at: now, reason: reason || null } } })
      .eq("rental_id", rental.id),
    // Nothing more is owed on a cancelled booking.
    admin.from("rental_payments").update({ status: "cancelled" }).eq("rental_id", rental.id).in("status", ["scheduled", "pending", "overdue"]),
    admin
      .from("vehicles")
      .update({ status: "available", availability_status: "available_now", current_customer_id: null, current_rental_id: null })
      .eq("id", rental.vehicle_id)
      .eq("current_rental_id", rental.id)
  ]);
  await syncVehicleStatusFromBookings(admin, rental.organization_id, rental.vehicle_id).catch(() => null);

  const vehicle = [rental.vehicles?.make, rental.vehicles?.model].filter(Boolean).join(" ") || "vehicle";
  const who = rental.customers?.full_name || "The customer";
  const when = rental.end_date ? `${niceDate(rental.start_date)} to ${niceDate(rental.end_date)}` : `from ${niceDate(rental.start_date)}, monthly`;
  const currency = String(rental.currency || "THB");
  const money = `${currency === "THB" ? "฿" : `${currency} `}${paid.toLocaleString("en-US")}`;
  const settle = paid > 0 ? ` They have paid ${money}: decide what to refund.` : receiptWaiting ? " They sent a payment receipt that has not been checked yet." : "";
  const detail = `${who} cancelled their booking for the ${vehicle} (${when}) from their booking link.${reason ? ` Their reason: "${reason}".` : ""} The dates are free again.${settle}`;

  await Promise.all([
    recordActivityEvent(admin, {
      organization_id: rental.organization_id,
      entity_type: "rental",
      entity_id: rental.id,
      vehicle_id: rental.vehicle_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      event_type: "booking_cancelled",
      title: "Cancelled by the customer",
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
      metadata: { source: "customer_cancellation", reason: reason || null, paid }
    }),
    paid > 0 || receiptWaiting
      ? admin.from("tasks").insert({
          organization_id: rental.organization_id,
          vehicle_id: rental.vehicle_id,
          rental_id: rental.id,
          title_key: null,
          created_by: null,
          title: paid > 0 ? `Refund to decide - ${who} cancelled the ${vehicle} (${money} paid)` : `Receipt to check - ${who} cancelled the ${vehicle} after sending a payment receipt`,
          task_type: "admin",
          action: paid > 0 ? "refund" : null,
          due_at: now
        })
      : Promise.resolve(null)
  ]);
  notifyOperator(rental.organization_id, `❌ Booking cancelled by the customer: ${who}, ${vehicle}, ${when}. The dates are free again.${settle}`, "operator_notification", `/bookings/${rental.id}`).catch(() => null);

  await tellRentalCustomer(admin, rental.id, ({ firstName }) =>
    `Hi ${firstName}, your booking for the ${vehicle} (${when}) is cancelled, as you asked.${paid > 0 ? ` We'll be in touch about the ${money} you paid.` : ""}`,
    { withLink: false }
  );

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/bookings");
  revalidatePath("/calendar");
  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath(`/book/${token}`);
  return { ok: true, paid, receiptWaiting };
}
