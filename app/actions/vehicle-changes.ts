"use server";

import { revalidatePath } from "next/cache";
import { guard } from "@/lib/action-error";
import { adoptBusinessClock } from "@/lib/auth/active-organization-server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { businessDay, businessToday, wallTimeToIso } from "@/lib/business-time";
import { vehicleConflictMessage } from "@/lib/rental-conflicts";
import { rentalVehiclePeriods, VEHICLE_CHANGE_COLUMNS, type VehicleChangeRow } from "@/lib/rental-vehicle-periods";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Corrects a change of vehicle already on a booking (Rory, 11 Nov 2026: a swap entered a month early could not be
 * fixed without deleting the booking): the day of the change and, for the first change, the vehicle the rental
 * started on. Payments and money entries follow: each one moves to the vehicle the rental was on that day.
 */
async function updateVehicleChangeOrThrow(input: { rentalId: string; changeId: string; date: string; fromVehicleId?: string | null }) {
  const membership = await getCurrentMembership();
  if (!membership) throw new Error("Please sign in again.");
  const organizationId = membership.organizationId;
  const admin = createSupabaseAdminClient() as any;
  await adoptBusinessClock(admin, organizationId);
  const date = String(input.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Choose the day the customer changed vehicle.");

  const [{ data: rental }, { data: changeRows }] = await Promise.all([
    admin.from("rentals").select("id, vehicle_id, original_vehicle_id, start_date, end_date, status, customer_id").eq("id", input.rentalId).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle(),
    admin.from("vehicle_changes").select(`id, ${VEHICLE_CHANGE_COLUMNS}`).eq("organization_id", organizationId).eq("rental_id", input.rentalId).order("changed_at", { ascending: true })
  ]);
  if (!rental) throw new Error("This booking could not be found.");
  const changes = (changeRows || []) as Array<VehicleChangeRow & { id: string }>;
  const index = changes.findIndex((row) => row.id === input.changeId);
  if (index < 0) throw new Error("This vehicle change could not be found.");
  const change = changes[index];
  const start = String(rental.start_date || "").slice(0, 10);
  const end = rental.end_date ? String(rental.end_date).slice(0, 10) : null;
  const before = index > 0 ? businessDay(changes[index - 1].changed_at) : null;
  const after = index < changes.length - 1 ? businessDay(changes[index + 1].changed_at) : null;

  if (date <= start) throw new Error("The vehicle change must be after the start date.");
  if (date > businessToday()) throw new Error("The vehicle change can't be in the future.");
  if (end && date >= end) throw new Error("The vehicle change must be before the return date.");
  if (before && date <= before) throw new Error("This change must be after the one before it.");
  if (after && date >= after) throw new Error("This change must be before the one after it.");

  const wantsFrom = index === 0 && input.fromVehicleId ? String(input.fromVehicleId) : null;
  const fromVehicleId = wantsFrom || change.from_vehicle_id;
  if (wantsFrom && wantsFrom !== change.from_vehicle_id) {
    if (wantsFrom === change.to_vehicle_id) throw new Error("Choose a different vehicle for the start of the rental.");
    const { data: vehicle } = await admin.from("vehicles").select("id").eq("id", wantsFrom).eq("organization_id", organizationId).is("deleted_at", null).maybeSingle();
    if (!vehicle) throw new Error("Vehicle was not found.");
  }

  // Each vehicle must be free for the days this rental now has it.
  if (fromVehicleId) {
    const clash = await vehicleConflictMessage(admin, { organizationId, vehicleId: fromVehicleId, startDate: before || start, endDate: date, excludeRentalId: rental.id, customerId: rental.customer_id });
    if (clash) throw new Error(clash);
  }
  if (change.to_vehicle_id) {
    const clash = await vehicleConflictMessage(admin, { organizationId, vehicleId: change.to_vehicle_id, startDate: date, endDate: after || end, excludeRentalId: rental.id, customerId: rental.customer_id });
    if (clash) throw new Error(clash);
  }

  const oldChangedAt = change.changed_at;
  const changedAt = wallTimeToIso(`${date}T09:00`) || `${date}T00:00:00.000Z`;
  const { error } = await admin.from("vehicle_changes").update({ changed_at: changedAt, from_vehicle_id: fromVehicleId }).eq("id", change.id).eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  if (wantsFrom && wantsFrom !== rental.original_vehicle_id) {
    await admin.from("rentals").update({ original_vehicle_id: wantsFrom }).eq("id", rental.id).eq("organization_id", organizationId);
  }
  await admin.from("activity_events").update({ occurred_at: changedAt }).eq("organization_id", organizationId).eq("rental_id", rental.id).eq("event_type", "vehicle_changed").eq("occurred_at", oldChangedAt);

  // Payments and money entries follow the vehicle the rental was on that day.
  const updated = changes.map((row, i) => (i === index ? { ...row, changed_at: changedAt, from_vehicle_id: fromVehicleId } : row));
  const periods = rentalVehiclePeriods({ ...rental, original_vehicle_id: wantsFrom || rental.original_vehicle_id, status: rental.status === "booked" || rental.status === "draft" ? "active" : rental.status }, updated);
  for (let i = 0; i < periods.length; i += 1) {
    const period = periods[i];
    const next = periods[i + 1]?.start || null;
    let payments = admin.from("rental_payments").update({ vehicle_id: period.vehicleId }).eq("organization_id", organizationId).eq("rental_id", rental.id);
    let money = admin.from("transactions").update({ vehicle_id: period.vehicleId }).eq("organization_id", organizationId).eq("rental_id", rental.id);
    if (i > 0) {
      payments = payments.gte("due_date", period.start);
      money = money.gte("transaction_date", period.start);
    }
    if (next) {
      payments = payments.lt("due_date", next);
      money = money.lt("transaction_date", next);
    }
    await Promise.all([payments, money]);
  }

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath(`/bookings/${rental.id}/edit`);
  revalidatePath("/fleet");
  revalidatePath("/calendar");
  revalidatePath("/money");
  return { ok: true as const };
}

export async function updateVehicleChange(...args: Parameters<typeof updateVehicleChangeOrThrow>) {
  return guard(() => updateVehicleChangeOrThrow(...args), "Couldn't save the vehicle change. Nothing was changed.");
}
