"use server";

import { guard } from "@/lib/action-error";

import { revalidatePath } from "next/cache";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasCustomerChat, messageCustomer } from "@/lib/customer-messages";
import { isEmailConfigured } from "@/lib/email";

/** What to ask for when a field the person fills in arrives empty (the rest are the page's own ids). */
const MISSING_FIELD: Record<string, string> = {"content":"Write the note first."};

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  if (!value) {
    throw new Error(MISSING_FIELD[key] || `${key} is required.`);
  }
  return value;
}

function optionalString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim() || null;
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function addCommunicationNote(...args: Parameters<typeof addCommunicationNoteOrThrow>) {
  return guard(() => addCommunicationNoteOrThrow(...args));
}

async function addCommunicationNoteOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const organizationId = requiredString(formData, "organizationId");
  const content = requiredString(formData, "content");
  const rentalId = optionalString(formData, "rentalId");
  const customerId = optionalString(formData, "customerId");
  const vehicleId = optionalString(formData, "vehicleId");
  const revalidatePathname = optionalString(formData, "revalidatePathname");

  const { error } = await supabase.from("communication_log").insert({
    organisation_id: organizationId,
    rental_id: rentalId,
    customer_id: customerId,
    type: "manual_note",
    direction: "internal",
    content,
    status: "sent",
    created_by: user.id
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: rentalId ? "rental" : "customer",
    entity_id: rentalId || customerId || organizationId,
    vehicle_id: vehicleId,
    rental_id: rentalId,
    customer_id: customerId,
    event_type: "communication_note_added",
    title: "Communication note added",
    detail: content,
    metadata: { direction: "internal", type: "manual_note" }
  });

  if (revalidatePathname) {
    revalidatePath(revalidatePathname);
  }
  if (rentalId) {
    revalidatePath(`/bookings/${rentalId}`);
  }
  if (customerId) {
    revalidatePath(`/customers/${customerId}`);
  }
}

/**
 * The owner approved a message that was waiting for their say-so ("Ask me first"): it goes out the way it would have,
 * on the customer's chat or by email. With neither, it stays where it is for the owner to send by hand.
 */
export async function sendApprovedCustomerMessage(id: string): Promise<{ ok: boolean; sent: boolean }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  // Read with the member's own access, so only their business's messages can be sent.
  const { data: entry } = await supabase.from("communication_log").select("id, organisation_id, rental_id, customer_id, status, metadata").eq("id", id).maybeSingle();
  if (!entry || entry.status !== "pending" || !entry.metadata?.ask_first || !entry.metadata?.raw_text) return { ok: false, sent: false };
  const admin = createSupabaseAdminClient() as any;
  const { data: customer } = await admin.from("customers").select("email").eq("id", entry.customer_id).maybeSingle();
  const canSend = (await hasCustomerChat(admin, entry.organisation_id, entry.customer_id)) || (Boolean(customer?.email) && isEmailConfigured());
  const stamp = { approved_by: user.id, approved_at: new Date().toISOString() };
  if (!canSend) {
    // Nothing to send it on: no longer "ask first", just a message to send by hand.
    await admin.from("communication_log").update({ metadata: { ...entry.metadata, ask_first: false, ...stamp } }).eq("id", id);
    if (entry.rental_id) revalidatePath(`/bookings/${entry.rental_id}`);
    return { ok: true, sent: false };
  }
  const result = await messageCustomer(admin, {
    organizationId: entry.organisation_id,
    customerId: entry.customer_id,
    rentalId: entry.rental_id,
    text: String(entry.metadata.raw_text),
    locale: entry.metadata.locale || null,
    withLink: entry.metadata.with_link !== false,
    sentBy: user.id,
    metadata: { reminder_key: entry.metadata.reminder_key, approved_from: id }
  });
  // The send made its own record (sent, or failed with a way to send by hand), so this one steps aside.
  await admin.from("communication_log").update({ metadata: { ...entry.metadata, superseded: true, ...stamp } }).eq("id", id);
  if (entry.rental_id) revalidatePath(`/bookings/${entry.rental_id}`);
  revalidatePath("/");
  revalidatePath("/inbox");
  return { ok: true, sent: result.sent };
}

/** The owner sent a ready-made customer message themselves (or decided it isn't needed): it stops showing as waiting. */
export async function markCustomerMessageSent(id: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  // Read and written with the member's own access, so only their business's messages can be touched.
  const { data: entry } = await supabase.from("communication_log").select("id, rental_id, metadata").eq("id", id).maybeSingle();
  if (!entry) return { ok: false };
  const { error } = await supabase
    .from("communication_log")
    .update({ status: "sent", metadata: { ...(entry.metadata || {}), sent_by_hand: true, sent_by_hand_at: new Date().toISOString(), sent_by_hand_by: user.id } })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (entry.rental_id) revalidatePath(`/bookings/${entry.rental_id}`);
  revalidatePath("/");
  return { ok: true };
}
