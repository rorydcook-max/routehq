"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { tryAutoExtend } from "@/lib/auto-extension";
import { completeRentalJobs, tellRentalCustomer } from "@/lib/customer-messages";
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

/**
 * Approves an extension, or a switch to monthly open-ended, that could not be
 * applied automatically. Uses the same rules as the automatic path (priced from
 * the rate card, payment created, no double booking) but skips the notice
 * period: the owner is saying yes.
 */
export async function approveExtensionRequest(formData: FormData) {
  const { membership, admin, action, actionId, rentalId, organizationId } = await load(formData);
  const openEnded = String(formData.get("openEnded") || "") === "true";
  const newEndDate = openEnded ? null : requiredString(formData, "newEndDate");

  const outcome = await tryAutoExtend(admin, rentalId, newEndDate, { openEnded, byStaff: true });
  if (!outcome.applied) throw new Error(`Can't approve this yet: ${outcome.reason}.`);

  await resolve(admin, action, membership.userId, { outcome: "approved", approved_end_date: newEndDate, approved_open_ended: openEnded });
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
  refresh(rentalId);
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
