"use server";

import { revalidatePath } from "next/cache";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function optionalString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim() || null;
}

export async function addCommunicationNote(formData: FormData) {
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
