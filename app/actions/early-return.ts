"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { completeRentalJobs, tellRentalCustomer } from "@/lib/customer-messages";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { said } from "@/lib/i18n/server-text";
import { canDecideMoney, getCurrentMembership } from "@/lib/auth/roles";

const OPEN = ["scheduled", "pending", "failed", "overdue"];
const isDeposit = (row: any) => row.metadata?.is_deposit === true || ["deposit", "deposit_top_up"].includes(String(row.metadata?.type || ""));

/**
 * Back early with rent unpaid: the owner takes off the part that is for days after the return, or keeps what was
 * booked. Either way the customer is then told what is still to pay, and the "Rent to decide" job closes.
 */
export async function decideEarlyReturnOwed(rentalId: string, decision: "take_off" | "keep"): Promise<{ ok: boolean; error?: string; owed?: number }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: await said("You must be signed in.") };
  if (decision === "take_off" && !canDecideMoney((await getCurrentMembership())?.role)) return { ok: false, error: await said("Only the owner or a manager can take rent off. Ask them to decide.") };

  // Read through the signed-in user, so only someone in the business gets this far.
  const { data: rental } = await supabase.from("rentals").select("id, organization_id, vehicle_id, customer_id, currency").eq("id", rentalId).is("deleted_at", null).maybeSingle();
  if (!rental) return { ok: false, error: await said("Rental not found.") };

  const admin = createSupabaseAdminClient() as any;
  const { data: rows } = await admin.from("rental_payments").select("id, amount, status, voided, metadata").eq("rental_id", rentalId).eq("organization_id", rental.organization_id).is("deleted_at", null);
  const marked = (rows || []).filter((row: any) => row.metadata?.early_return_owed && !row.metadata.early_return_owed.decided && OPEN.includes(String(row.status)));
  if (!marked.length) {
    // Paid or settled some other way first: nothing is left to decide, so the job closes instead of standing forever.
    await completeRentalJobs(admin, rentalId, "owed_early", "Nothing left to decide");
    revalidatePath("/tasks");
    revalidatePath("/");
    return { ok: true };
  }

  let takenOff = 0;
  // One write per payment, all at once.
  await Promise.all(
    marked.map((row: any) => {
      const info = row.metadata.early_return_owed;
      const metadata = { ...row.metadata, early_return_owed: { ...info, decided: decision, decided_at: new Date().toISOString(), decided_by: user.id } };
      if (decision !== "take_off") return admin.from("rental_payments").update({ metadata }).eq("id", row.id);
      const amount = Number(row.amount || 0);
      const share = Math.min(amount, Number(info.share || 0));
      const left = Math.round((amount - share) * 100) / 100;
      takenOff += share;
      return admin
        .from("rental_payments")
        .update(left > 0.5 ? { amount: left, metadata: { ...metadata, scheduled_amount: amount } } : { status: "cancelled", metadata: { ...metadata, scheduled_amount: amount, cancelled_reason: "Returned early: not charged for the days after" } })
        .eq("id", row.id);
    })
  );

  const { data: stillOpen } = await admin.from("rental_payments").select("amount, status, voided, metadata").eq("rental_id", rentalId).in("status", OPEN).is("deleted_at", null);
  const owed = (stillOpen || []).filter((row: any) => !row.voided && !isDeposit(row)).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
  await Promise.all([
    admin.from("rentals").update({ balance_due: owed }).eq("id", rentalId),
    completeRentalJobs(admin, rentalId, "owed_early", decision === "take_off" ? `Took ${Math.round(takenOff)} off` : "Kept as booked")
  ]);

  if (owed > 0) {
    // The thank-you for the return held the amount back until now: it goes out whole, replacing that one.
    await tellRentalCustomer(admin, rentalId, ({ say, t, vehicle, money }) => [say("returnedThanks", { vehicle }), t("stillToPay", { amount: money(owed) })].join(" "), { sentBy: user.id, withLink: true, replacesEarlier: true });
  }

  // The history line is written after the reply, so the page updates without waiting for it.
  after(() => recordActivityEvent(supabase, {
    organization_id: rental.organization_id,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: rental.vehicle_id,
    rental_id: rentalId,
    customer_id: rental.customer_id,
    event_type: "early_return_owed",
    title: decision === "take_off" ? "Rent for unused days taken off" : "Rent kept as booked",
    detail: decision === "take_off" ? `${Math.round(takenOff)} taken off after an early return; ${Math.round(owed)} still to pay.` : `Kept as booked after an early return; ${Math.round(owed)} still to pay.`
  }).catch(() => null));

  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true, owed };
}
