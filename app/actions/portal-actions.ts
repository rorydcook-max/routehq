"use server";

import { revalidatePath } from "next/cache";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function optionalString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim() || null;
}

async function currentUser(supabase: any) {
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  return user;
}

async function getPortalAction(supabase: any, organizationId: string, actionId: string) {
  const { data, error } = await supabase
    .from("customer_portal_actions")
    .select("*")
    .eq("id", actionId)
    .eq("organisation_id", organizationId)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "Customer request not found.");
  return data;
}

export async function approveExtensionRequest(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const user = await currentUser(supabase);
  const organizationId = requiredString(formData, "organizationId");
  const actionId = requiredString(formData, "actionId");
  const rentalId = requiredString(formData, "rentalId");
  const newEndDate = requiredString(formData, "newEndDate");
  const action = await getPortalAction(supabase, organizationId, actionId);
  const content = { ...(action.content || {}), approved_end_date: newEndDate };

  const [{ error: rentalError }, { error: actionError }] = await Promise.all([
    supabase.from("rentals").update({ end_date: newEndDate, status: "extended" }).eq("id", rentalId).eq("organization_id", organizationId),
    supabase
      .from("customer_portal_actions")
      .update({ status: "resolved", content, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq("id", actionId)
      .eq("organisation_id", organizationId)
  ]);

  if (rentalError || actionError) throw new Error(rentalError?.message || actionError?.message);

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    rental_id: rentalId,
    customer_id: action.customer_id,
    event_type: "extension_request_approved",
    title: "Extension request approved",
    detail: `Rental extended to ${newEndDate}.`,
    metadata: { customer_portal_action_id: actionId, new_end_date: newEndDate }
  });

  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function declinePortalAction(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const user = await currentUser(supabase);
  const organizationId = requiredString(formData, "organizationId");
  const actionId = requiredString(formData, "actionId");
  const rentalId = requiredString(formData, "rentalId");
  const note = optionalString(formData, "note");
  const action = await getPortalAction(supabase, organizationId, actionId);

  const { error } = await supabase
    .from("customer_portal_actions")
    .update({ status: "resolved", content: { ...(action.content || {}), operator_note: note, outcome: "declined" }, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("organisation_id", organizationId);

  if (error) throw new Error(error.message);
  revalidatePath(`/bookings/${rentalId}`);
}

export async function acknowledgePortalAction(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  await currentUser(supabase);
  const organizationId = requiredString(formData, "organizationId");
  const actionId = requiredString(formData, "actionId");
  const rentalId = requiredString(formData, "rentalId");
  const { error } = await supabase
    .from("customer_portal_actions")
    .update({ status: "acknowledged" })
    .eq("id", actionId)
    .eq("organisation_id", organizationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath("/calendar");
}

export async function resolvePortalAction(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const user = await currentUser(supabase);
  const organizationId = requiredString(formData, "organizationId");
  const actionId = requiredString(formData, "actionId");
  const rentalId = requiredString(formData, "rentalId");
  const notes = optionalString(formData, "notes");
  const action = await getPortalAction(supabase, organizationId, actionId);
  const { error } = await supabase
    .from("customer_portal_actions")
    .update({ status: "resolved", content: { ...(action.content || {}), resolution_notes: notes }, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", actionId)
    .eq("organisation_id", organizationId);
  if (error) throw new Error(error.message);
  revalidatePath(`/bookings/${rentalId}`);
}

export async function replyToPortalQuestion(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const user = await currentUser(supabase);
  const organizationId = requiredString(formData, "organizationId");
  const actionId = requiredString(formData, "actionId");
  const rentalId = requiredString(formData, "rentalId");
  const customerId = optionalString(formData, "customerId");
  const reply = requiredString(formData, "reply");
  const action = await getPortalAction(supabase, organizationId, actionId);

  const [{ error: logError }, { error: actionError }] = await Promise.all([
    supabase.from("communication_log").insert({
      organisation_id: organizationId,
      rental_id: rentalId,
      customer_id: customerId || action.customer_id,
      type: "operator_message",
      direction: "outbound",
      content: reply,
      status: "sent",
      created_by: user.id
    }),
    supabase
      .from("customer_portal_actions")
      .update({ status: "resolved", content: { ...(action.content || {}), reply }, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq("id", actionId)
      .eq("organisation_id", organizationId)
  ]);

  if (logError || actionError) throw new Error(logError?.message || actionError?.message);
  revalidatePath(`/bookings/${rentalId}`);
}
