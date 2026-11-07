"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership, OWNER_ONLY_MESSAGE } from "@/lib/auth/roles";
import { said } from "@/lib/i18n/server-text";
import { tellRentalCustomer } from "@/lib/customer-messages";
import { reviewRowFor, reviewUrl, submitReview, type SubmitReviewResult } from "@/lib/reviews";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: string };

/** The renter sends their review on /book/review/<token>. No sign-in: the token is the key. */
export async function sendRenterReview(input: { token: string; rating: number; text: string; consent: boolean }): Promise<SubmitReviewResult> {
  const token = String(input?.token || "").trim();
  if (!token) return { ok: false, error: "not_found" };
  const admin = createSupabaseAdminClient() as any;
  const result = await submitReview(admin, { token, rating: Number(input?.rating), text: String(input?.text || ""), consent: input?.consent === true }).catch(
    (): SubmitReviewResult => ({ ok: false, error: "failed" })
  );
  revalidatePath(`/book/review/${token}`);
  return result;
}

export type ReviewRequestResult = { ok: true; url: string; sent: boolean; submitted: boolean } | { ok: false; error: string };

/**
 * "Ask for a review" on a returned rental's booking: makes (or reuses) the rental's review link and sends it on the
 * renter's usual channel when there is one. The link is returned either way, for "Copy link".
 */
export async function requestRentalReview(rentalId: string, send = true): Promise<ReviewRequestResult> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  const admin = createSupabaseAdminClient() as any;
  const row = await reviewRowFor(admin, membership.organizationId, String(rentalId || "")).catch(() => null);
  if (!row) return { ok: false, error: await said("Review not found.") };
  const url = reviewUrl(row.token);
  if (row.submitted || !send) return { ok: true, url, sent: false, submitted: row.submitted };
  const result = await tellRentalCustomer(admin, rentalId, ({ say, vehicle }) => say("reviewRequest", { vehicle, link: url }), {
    withLink: false,
    sentBy: membership.userId || null,
    metadata: { reminder_key: "review" }
  });
  revalidatePath(`/bookings/${rentalId}`);
  return { ok: true, url, sent: result.sent, submitted: false };
}

/** A review of the signed-in person's business, or null. */
async function ownReview(reviewId: string) {
  const membership = await getCurrentMembership();
  if (!membership || !reviewId) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data: review } = await admin.from("rental_reviews").select("id, rental_id, customer_id, vehicle_id, consent, submitted_at").eq("id", reviewId).eq("organization_id", membership.organizationId).maybeSingle();
  if (!review?.submitted_at) return null;
  return { admin, membership, review };
}

/** Looking at a review (publishing, hiding, replying) closes its "Review to check" job. */
async function markChecked(admin: any, organizationId: string, rentalId: string) {
  const now = new Date().toISOString();
  await admin.from("rental_reviews").update({ checked_at: now }).eq("rental_id", rentalId).eq("organization_id", organizationId).is("checked_at", null).then(() => null, () => null);
  await admin.from("tasks").update({ completed_at: now, completion_notes: "Checked" }).eq("organization_id", organizationId).eq("rental_id", rentalId).eq("action", "review").is("completed_at", null).then(() => null, () => null);
}

function refresh(review: any) {
  revalidatePath("/customers/reviews");
  revalidatePath("/customers");
  revalidatePath("/tasks");
  if (review.customer_id) revalidatePath(`/customers/${review.customer_id}`);
  if (review.vehicle_id) revalidatePath(`/fleet/${review.vehicle_id}`);
}

/** Publish (shown on the website: only when the renter said yes) or Hide. */
export async function setReviewPublished(reviewId: string, published: boolean): Promise<Result> {
  const found = await ownReview(reviewId);
  if (!found) return { ok: false, error: await said("Review not found.") };
  const { admin, membership, review } = found;
  if (published && !review.consent) return { ok: false, error: await said("This renter didn't agree to show their review.") };
  const { error } = await admin
    .from("rental_reviews")
    .update({ published: !!published, published_at: published ? new Date().toISOString() : null })
    .eq("id", review.id)
    .eq("organization_id", membership.organizationId);
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  await markChecked(admin, membership.organizationId, review.rental_id);
  refresh(review);
  return { ok: true };
}

/** The business's public reply, shown under the review. Empty removes it. */
export async function saveReviewReply(reviewId: string, reply: string): Promise<Result> {
  const found = await ownReview(reviewId);
  if (!found) return { ok: false, error: await said("Review not found.") };
  const { admin, membership, review } = found;
  const text = String(reply || "").trim().slice(0, 1000);
  const { error } = await admin
    .from("rental_reviews")
    .update({ reply: text || null, replied_at: text ? new Date().toISOString() : null })
    .eq("id", review.id)
    .eq("organization_id", membership.organizationId);
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  await markChecked(admin, membership.organizationId, review.rental_id);
  refresh(review);
  return { ok: true };
}

/** Marks a review as looked at without changing it. */
export async function markReviewChecked(reviewId: string): Promise<Result> {
  const found = await ownReview(reviewId);
  if (!found) return { ok: false, error: await said("Review not found.") };
  await markChecked(found.admin, found.membership.organizationId, found.review.rental_id);
  refresh(found.review);
  return { ok: true };
}

/** The business's Google review link, offered to renters who gave 4-5 stars (owner only). Empty removes it. */
export async function saveGoogleReviewLink(url: string): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  if (membership.role !== "owner") return { ok: false, error: await said(OWNER_ONLY_MESSAGE) };
  let clean = String(url || "").trim();
  if (clean && !/^https?:\/\//i.test(clean)) clean = `https://${clean}`;
  clean = clean.replace(/^http:\/\//i, "https://");
  if (clean) {
    try {
      const parsed = new URL(clean);
      if (!parsed.hostname.includes(".")) throw new Error("host");
    } catch {
      return { ok: false, error: await said("Enter a web address.") };
    }
  }
  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select("settings").eq("id", membership.organizationId).maybeSingle();
  if (!organization) return { ok: false, error: await said("Business not found.") };
  const settings = organization.settings && typeof organization.settings === "object" ? organization.settings : {};
  const { error } = await admin
    .from("organizations")
    .update({ settings: { ...settings, reviews: { ...(settings.reviews || {}), google_url: clean || null } } })
    .eq("id", membership.organizationId);
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  revalidatePath("/customers/reviews");
  return { ok: true };
}
