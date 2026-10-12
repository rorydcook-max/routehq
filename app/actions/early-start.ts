"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { said } from "@/lib/i18n/server-text";
import { canDecideMoney, getCurrentMembership } from "@/lib/auth/roles";

/**
 * A teammate handed a vehicle over early and the customer asked for the extra days free. The charge was
 * written (and not collected); the owner or a manager now waives it or keeps it.
 */
export async function decideEarlyWaiver(rentalId: string, decision: "waive" | "keep"): Promise<{ ok: boolean; error?: string }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("You must be signed in.") };
  if (!canDecideMoney(membership.role)) return { ok: false, error: await said("Only the owner or a manager can decide this.") };

  // Read through the signed-in user, so only someone in the business gets this far.
  const { data: rental } = await supabase.from("rentals").select("id, organization_id, vehicle_id, customer_id").eq("id", rentalId).is("deleted_at", null).maybeSingle();
  if (!rental) return { ok: false, error: await said("Rental not found.") };

  const admin = createSupabaseAdminClient() as any;
  const { data: rows } = await admin.from("rental_payments").select("id, amount, status, metadata").eq("rental_id", rentalId).eq("organization_id", rental.organization_id).is("deleted_at", null);
  const charge = (rows || []).find((row: any) => row.metadata?.early_start?.waiver_requested && !row.metadata.early_start.waiver_decided);
  const now = new Date().toISOString();
  if (charge) {
    const early = { ...charge.metadata.early_start, waiver_decided: decision, waiver_decided_by: membership.userId, waiver_decided_at: now };
    // Already paid: nothing to waive here (a refund is the way back).
    const waive = decision === "waive" && !["paid", "reconciled"].includes(String(charge.status));
    const { error } = await admin
      .from("rental_payments")
      .update({ ...(waive ? { status: "waived" } : {}), metadata: { ...charge.metadata, early_start: early } })
      .eq("id", charge.id);
    if (error) return { ok: false, error: error.message };
    await recordActivityEvent(admin, {
      organization_id: rental.organization_id,
      actor_id: membership.userId,
      entity_type: "rental",
      entity_id: rental.id,
      rental_id: rental.id,
      vehicle_id: rental.vehicle_id,
      customer_id: rental.customer_id,
      event_type: waive ? "early_days_waived" : "early_days_kept",
      title: waive ? "Early days given free" : "Early days charged",
      detail: `${charge.metadata.early_start.days} days before the booked start, ฿${Math.round(Number(charge.amount)).toLocaleString("en-US")}: ${waive ? "waived" : "kept as a charge"}.`
    }).catch(() => undefined);
  }
  await admin.from("tasks").update({ completed_at: now, completion_notes: decision === "waive" ? "Waived" : "Kept the charge" }).eq("rental_id", rentalId).eq("action", "waive_early").is("completed_at", null);
  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true };
}
