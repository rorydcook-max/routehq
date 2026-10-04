"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { tryAutoExtend } from "@/lib/auto-extension";
import { completeRentalJobs, tellRentalCustomer } from "@/lib/customer-messages";
import { moveBookingToVehicle } from "@/lib/extension-picture";
import { niceDate } from "@/lib/nice-date";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Answers to what customers ask from their booking page: extend, switch to
 * monthly, confirm a return, report a problem, ask a question. Every answer
 * closes the job it created on the to-do list and tells the customer on the
 * chat they first used (see lib/customer-messages.ts).
 */

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function optionalString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim() || null;
}

/** The signed-in member, the request, and a client allowed to act on it. */
async function load(formData: FormData) {
  const membership = await getCurrentMembership();
  if (!membership) throw new Error("You must be signed in.");
  const actionId = requiredString(formData, "actionId");
  const rentalId = requiredString(formData, "rentalId");
  const admin = createSupabaseAdminClient() as any;
  const { data: action } = await admin.from("customer_portal_actions").select("*").eq("id", actionId).eq("organisation_id", membership.organizationId).eq("rental_id", rentalId).maybeSingle();
  if (!action) throw new Error("Customer request not found.");
  return { membership, admin, action, actionId, rentalId, organizationId: membership.organizationId as string };
}

async function resolve(admin: any, action: any, userId: string, content: Record<string, unknown>, status: "resolved" | "acknowledged" = "resolved") {
  const { error } = await admin
    .from("customer_portal_actions")
    .update({ status, content: { ...(action.content || {}), ...content }, resolved_by: userId, resolved_at: new Date().toISOString() })
    .eq("id", action.id);
  if (error) throw new Error(error.message);
}

function refresh(rentalId: string) {
  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/calendar");
}

type Answer = { ok: true } | { ok: false; error: string };

/**
 * Says yes to an extension, or a switch to monthly open-ended, that could not
 * be applied automatically. Uses the same rules as the automatic path (priced
 * from the rate card, payment created, no double booking) but skips the notice
 * period: the owner is saying yes.
 *
 * When another booking is in the way the owner can move that booking to a
 * free vehicle in the same step; its customer is told, and keeps their dates
 * and price.
 */
export async function answerExtensionRequest(input: { actionId: string; rentalId: string; newEndDate?: string | null; openEnded?: boolean; move?: { rentalId: string; vehicleId: string } | null }): Promise<Answer> {
  try {
    const form = new FormData();
    form.set("actionId", input.actionId);
    form.set("rentalId", input.rentalId);
    const { membership, admin, action, actionId, rentalId, organizationId } = await load(form);
    if (action.status !== "pending") return { ok: false, error: "This request has already been answered." };
    const openEnded = !!input.openEnded;
    const newEndDate = openEnded ? null : String(input.newEndDate || "").slice(0, 10);
    if (!openEnded && !newEndDate) return { ok: false, error: "Choose the new return date." };

    let moved: { rentalId: string; from: string; to: string; fromVehicleId: string } | null = null;
    if (input.move) {
      const { data: before } = await admin.from("rentals").select("vehicle_id").eq("id", input.move.rentalId).eq("organization_id", organizationId).maybeSingle();
      const result = await moveBookingToVehicle(admin, { organizationId, rentalId: input.move.rentalId, vehicleId: input.move.vehicleId });
      if (!result.ok) return result;
      moved = { rentalId: input.move.rentalId, from: result.from, to: result.to, fromVehicleId: String(before?.vehicle_id || "") };
    }

    const outcome = await tryAutoExtend(admin, rentalId, newEndDate, { openEnded, byStaff: true });
    if (!outcome.applied) {
      // Put the other booking back: nothing should change unless the whole answer goes through.
      if (moved?.fromVehicleId) await moveBookingToVehicle(admin, { organizationId, rentalId: moved.rentalId, vehicleId: moved.fromVehicleId }).catch(() => null);
      return { ok: false, error: `Can't approve this: ${outcome.reason}.` };
    }

    await resolve(admin, action, membership.userId, { outcome: "approved", approved_end_date: newEndDate, approved_open_ended: openEnded, moved_rental_id: moved?.rentalId || null });
    await completeRentalJobs(admin, rentalId, "request", "Approved", actionId);
    await recordActivityEvent(admin, {
      organization_id: organizationId,
      actor_id: membership.userId,
      entity_type: "rental",
      entity_id: rentalId,
      rental_id: rentalId,
      customer_id: action.customer_id,
      event_type: "extension_request_approved",
      title: openEnded ? "Switch to monthly approved" : "Extension request approved",
      detail: openEnded ? "Rental changed to monthly, open-ended." : `Rental extended to ${niceDate(newEndDate)}.`,
      metadata: { customer_portal_action_id: actionId, new_end_date: newEndDate, open_ended: openEnded }
    } as any).catch(() => null);

    if (moved) {
      const detail = `Moved from the ${moved.from} to the ${moved.to} to make room for a longer rental on the ${moved.from}. Dates and price unchanged.`;
      await Promise.all([
        recordActivityEvent(admin, {
          organization_id: organizationId,
          actor_id: membership.userId,
          entity_type: "rental",
          entity_id: moved.rentalId,
          rental_id: moved.rentalId,
          vehicle_id: input.move!.vehicleId,
          event_type: "vehicle_changed",
          title: "Vehicle changed",
          detail
        } as any).catch(() => null),
        admin
          .from("vehicle_changes")
          .insert({ organization_id: organizationId, rental_id: moved.rentalId, from_vehicle_id: moved.fromVehicleId, to_vehicle_id: input.move!.vehicleId, reason: "other", reason_notes: detail, changed_at: new Date().toISOString(), changed_by: membership.userId, original_vehicle_disposition: "keep_assigned" })
          .then(() => null, () => null)
      ]);
      const { from, to } = moved;
      await tellRentalCustomer(
        admin,
        moved.rentalId,
        ({ firstName }) => `Hi ${firstName}, a change to your booking: you'll have the ${to} instead of the ${from}. Your dates and price stay the same. Message us if that doesn't suit you.`,
        { sentBy: membership.userId }
      );
      revalidatePath(`/bookings/${moved.rentalId}`);
      revalidatePath("/bookings");
      revalidatePath("/fleet");
    }
    refresh(rentalId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "That didn't work. Try again." };
  }
}

export async function declinePortalAction(formData: FormData) {
  const { membership, admin, action, actionId, rentalId } = await load(formData);
  const note = optionalString(formData, "note");
  await resolve(admin, action, membership.userId, { operator_note: note, outcome: "declined" });
  await completeRentalJobs(admin, rentalId, "request", "Declined", actionId);
  const openEnded = !!action.content?.open_ended;
  await tellRentalCustomer(
    admin,
    rentalId,
    ({ firstName, vehicle }) =>
      `Hi ${firstName}, sorry, we can't ${openEnded ? `change your rental of the ${vehicle} to monthly with no end date` : `extend your rental of the ${vehicle}${action.content?.new_end_date ? ` to ${niceDate(action.content.new_end_date)}` : ""}`}.${note ? ` ${note}` : ""} Your return date stays as it is. Message us if you'd like to talk it through.`,
    { sentBy: membership.userId }
  );
  refresh(rentalId);
}

export async function acknowledgePortalAction(formData: FormData) {
  const { membership, admin, action, actionId, rentalId } = await load(formData);
  await resolve(admin, action, membership.userId, { outcome: "acknowledged" }, "acknowledged");
  await completeRentalJobs(admin, rentalId, "request", "Acknowledged", actionId);
  const content = action.content || {};
  await tellRentalCustomer(
    admin,
    rentalId,
    ({ firstName, vehicle }) =>
      `Hi ${firstName}, thanks. We've noted the return of the ${vehicle}${content.return_date ? ` on ${niceDate(content.return_date)}` : ""}${content.return_time ? ` at ${content.return_time}` : ""}${content.return_location ? `, ${content.return_location}` : ""}. See you then.`,
    { sentBy: membership.userId }
  );
  refresh(rentalId);
}

export async function resolvePortalAction(formData: FormData) {
  const { membership, admin, action, actionId, rentalId } = await load(formData);
  const notes = optionalString(formData, "notes");
  await resolve(admin, action, membership.userId, { resolution_notes: notes });
  await completeRentalJobs(admin, rentalId, "request", notes || "Resolved", actionId);
  refresh(rentalId);
}

/** Sends the answer to the customer's question; if they have no chat, it is kept on the booking marked "not sent". */
export async function replyToPortalQuestion(formData: FormData) {
  const { membership, admin, action, actionId, rentalId } = await load(formData);
  const reply = requiredString(formData, "reply");
  await resolve(admin, action, membership.userId, { reply });
  await completeRentalJobs(admin, rentalId, "request", "Answered", actionId);
  await tellRentalCustomer(admin, rentalId, ({ firstName }) => `Hi ${firstName}, ${reply}`, { sentBy: membership.userId });
  refresh(rentalId);
}
