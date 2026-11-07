"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { answerExtensionCheck, releaseHold, type AnswerOutcome } from "@/lib/extension-hold";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** The renter answers "Are you extending?" on /book/extend/<token>. No sign-in: the token is the key. */
export async function answerExtension(input: { token: string; answer: "extend" | "returning"; newEndDate?: string | null }): Promise<AnswerOutcome> {
  const answer = input?.answer === "extend" ? "extend" : input?.answer === "returning" ? "returning" : null;
  const token = String(input?.token || "").trim();
  if (!answer || !token) return { ok: false, error: "not_found" };
  const newEndDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input?.newEndDate || "")) ? String(input.newEndDate) : null;
  const admin = createSupabaseAdminClient() as any;
  const result = await answerExtensionCheck(admin, { token, answer, newEndDate }).catch((): AnswerOutcome => ({ ok: false, error: "failed" }));
  revalidatePath(`/book/extend/${token}`);
  return result;
}

/** The team lets a vehicle held for extension go: the dates open on the booking page and rove.rent at once. */
export async function releaseExtensionHold(rentalId: string): Promise<{ ok: boolean }> {
  const membership = await getCurrentMembership();
  if (!membership || !rentalId) return { ok: false };
  const admin = createSupabaseAdminClient() as any;
  const ok = await releaseHold(admin, membership.organizationId, rentalId).catch(() => false);
  if (ok) {
    revalidatePath(`/bookings/${rentalId}`);
    revalidatePath("/calendar");
  }
  return { ok };
}
