"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { tellRentalCustomer } from "@/lib/customer-messages";
import { moveBookingToVehicle } from "@/lib/extension-picture";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Moves a booking that hasn't been handed over yet to another vehicle that is
 * free for all of its dates. Dates and price stay as they are and the
 * customer is told. (A vehicle swap during a rental is "Change vehicle".)
 */
export async function moveBooking(rentalId: string, vehicleId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const membership = await getCurrentMembership();
    if (!membership) return { ok: false, error: "You must be signed in." };
    const organizationId = membership.organizationId as string;
    const admin = createSupabaseAdminClient() as any;

    const { data: before } = await admin.from("rentals").select("vehicle_id, customer_id").eq("id", rentalId).eq("organization_id", organizationId).maybeSingle();
    if (!before) return { ok: false, error: "Booking not found." };
    const result = await moveBookingToVehicle(admin, { organizationId, rentalId, vehicleId });
    if (!result.ok) return { ok: false, error: result.error.replace("the other booking's", "this booking's").replace("The other booking", "This booking") };

    const detail = `Moved from the ${result.from} to the ${result.to}. Dates and price unchanged.`;
    await Promise.all([
      recordActivityEvent(admin, {
        organization_id: organizationId,
        actor_id: membership.userId,
        entity_type: "rental",
        entity_id: rentalId,
        rental_id: rentalId,
        vehicle_id: vehicleId,
        customer_id: before.customer_id,
        event_type: "vehicle_changed",
        title: "Vehicle changed",
        detail
      } as any).catch(() => null),
      admin
        .from("vehicle_changes")
        .insert({ organization_id: organizationId, rental_id: rentalId, from_vehicle_id: before.vehicle_id, to_vehicle_id: vehicleId, reason: "other", reason_notes: detail, changed_at: new Date().toISOString(), changed_by: membership.userId, original_vehicle_disposition: "keep_assigned" })
        .then(() => null, () => null)
    ]);
    await tellRentalCustomer(
      admin,
      rentalId,
      ({ firstName }) => `Hi ${firstName}, a change to your booking: you'll have the ${result.to} instead of the ${result.from}. Your dates and price stay the same. Message us if that doesn't suit you.`,
      { sentBy: membership.userId }
    );

    revalidatePath(`/bookings/${rentalId}`);
    revalidatePath("/bookings");
    revalidatePath("/calendar");
    revalidatePath("/fleet");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "That didn't work. Try again." };
  }
}
