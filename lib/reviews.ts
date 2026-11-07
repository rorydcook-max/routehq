import "server-only";
import { randomBytes } from "node:crypto";
import { addDaysIso } from "@/lib/scheduled-runs";
import { allCountries } from "@/lib/customer-options";
import { remindersOff, remindRentalCustomerOnce } from "@/lib/customer-messages";
import { notifyOperator } from "@/lib/notify-operator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Renter reviews (Rory, 7 Nov 2026). supabase/migrations/0134_reviews.sql.
 *
 *   - sendReviewRequests: the daily job at 10:00 on the business's clock (app/api/cron/payment-status). A rental
 *     returned 1-3 days ago gets one request (normally the day after the return) on the renter's chat, else email,
 *     with a link to /book/review/<token>. One per rental; Settings > Messaging > "Ask for a review after return".
 *   - loadReviewPage / submitReview: the renter's form. Every rating is kept and the form is the same whatever the
 *     stars (no review gating: Google's policy). 4-5 stars and a Google review link set: "Also post it on Google".
 *   - getPublishedReviews / getReviewStats: what the business's website shows. Published = the renter said yes
 *     AND the business published it.
 */

const REQUEST_WINDOW_DAYS = 3;

export type PublishedReview = {
  id: string;
  /** "Anna M." */
  name: string;
  /** Two-letter country code ("GB"), for a flag. */
  country?: string;
  rating: number;
  text: string;
  vehicleName?: string;
  /** ISO timestamp the review was sent. */
  createdAt: string;
  /** The business's public reply, shown under the review. */
  reply?: string;
};

/** "Anna Maria Müller" -> "Anna M."; one word stays as it is. */
export function reviewName(fullName: unknown): string {
  const words = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const first = words[0].slice(0, 30);
  const last = words.length > 1 ? words[words.length - 1] : "";
  return last ? `${first} ${Array.from(last)[0].toUpperCase()}.` : first;
}

/** The customer's saved nationality ("British", "TH", "Germany") as a country code, when it can be told. */
export function reviewCountry(nationality: unknown): string | null {
  const value = String(nationality || "").trim().toLowerCase();
  if (!value) return null;
  const match = allCountries.find((country) => [country.name, country.country, country.code].some((item) => item.toLowerCase() === value));
  return match?.code || null;
}

/** The Google review link saved on the Reviews page, when it is a web address. */
export function googleReviewUrl(settings: any): string | null {
  const url = String(settings?.reviews?.google_url || "").trim();
  return /^https:\/\/\S+$/i.test(url) ? url : null;
}

export function reviewRequestsOn(settings: any): boolean {
  return !remindersOff(settings).includes("review");
}

function appBase() {
  return String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

export function reviewUrl(token: string) {
  return `${appBase()}/book/review/${token}`;
}

// ── What the business's website shows ────────────────────────────────────────

/** Published reviews of a business, newest first. Through public_published_reviews(): nothing else can leak. */
export async function getPublishedReviews(orgId: string, limit = 20): Promise<PublishedReview[]> {
  if (!orgId) return [];
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data, error } = await admin.rpc("public_published_reviews", { p_organization_id: orgId, p_limit: Math.max(1, Math.min(100, Math.round(limit) || 20)) });
    if (error || !Array.isArray(data)) return [];
    return data.map((row: any) => ({
      id: String(row.id),
      name: String(row.display_name || ""),
      ...(row.country_code ? { country: String(row.country_code) } : {}),
      rating: Number(row.rating),
      text: String(row.body || ""),
      ...(row.vehicle_name ? { vehicleName: String(row.vehicle_name) } : {}),
      createdAt: String(row.submitted_at),
      ...(row.reply ? { reply: String(row.reply) } : {})
    }));
  } catch {
    return [];
  }
}

/** Average stars (one decimal) and how many, of the published reviews. */
export async function getReviewStats(orgId: string): Promise<{ average: number; count: number }> {
  if (!orgId) return { average: 0, count: 0 };
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data, error } = await admin.rpc("public_review_stats", { p_organization_id: orgId });
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row) return { average: 0, count: 0 };
    return { average: Number(row.average || 0), count: Number(row.count || 0) };
  } catch {
    return { average: 0, count: 0 };
  }
}

// ── The request, the day after the return ────────────────────────────────────

/**
 * For businesses at their 10:00 (app/api/cron/payment-status), on their own date `today`. Rentals returned 1 to 3
 * days ago (normally exactly yesterday; later only when the request couldn't go out on the day) get one request.
 */
export async function sendReviewRequests(admin: any, organizationIds: string[], today: string): Promise<number> {
  if (!organizationIds.length) return 0;
  const { data: organizations } = await admin.from("organizations").select("id, settings").in("id", organizationIds);
  const on = ((organizations || []) as any[]).filter((organization) => reviewRequestsOn(organization.settings)).map((organization) => String(organization.id));
  if (!on.length) return 0;

  const { data: returned } = await admin
    .from("rentals")
    .select("id, organization_id, customer_id, vehicle_id, end_date")
    .in("organization_id", on)
    .is("deleted_at", null)
    .eq("status", "completed")
    .not("customer_id", "is", null)
    .gte("end_date", addDaysIso(today, -REQUEST_WINDOW_DAYS))
    .lte("end_date", addDaysIso(today, -1));
  const rows = (returned || []) as any[];
  if (!rows.length) return 0;

  const { data: existing } = await admin.from("rental_reviews").select("rental_id").in("rental_id", rows.map((row) => row.id));
  const asked = new Set(((existing || []) as any[]).map((row) => String(row.rental_id)));

  let sent = 0;
  for (const rental of rows) {
    if (asked.has(String(rental.id))) continue;
    const token = randomBytes(18).toString("base64url");
    // The row is the claim: the unique rental_id lets only one run make it.
    const { error } = await admin.from("rental_reviews").insert({
      organization_id: rental.organization_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      vehicle_id: rental.vehicle_id || null,
      token
    });
    if (error) continue;
    const link = reviewUrl(token);
    const ok = await remindRentalCustomerOnce(admin, rental.id, "review", ({ say, vehicle }) => say("reviewRequest", { vehicle, link }), { withLink: false }).catch(() => false);
    if (ok) {
      sent += 1;
    } else {
      // Not sent (messages off, reminders off for this renter): let a later day try again.
      await admin.from("rental_reviews").delete().eq("rental_id", rental.id).is("submitted_at", null).then(() => null, () => null);
    }
  }
  return sent;
}

// ── The renter's form ────────────────────────────────────────────────────────

export type ReviewPage =
  | { state: "not_found" }
  | {
      state: "open" | "done";
      id: string;
      organizationId: string;
      businessName: string;
      brandColour: string | null;
      vehicle: string;
      /** "Anna M.", as it will show. */
      displayName: string;
      country: string | null;
      rating: number | null;
      googleUrl: string | null;
    };

export async function loadReviewPage(admin: any, token: string): Promise<ReviewPage> {
  if (!token || token.length < 16 || token.length > 64) return { state: "not_found" };
  const { data: review } = await admin
    .from("rental_reviews")
    .select(
      "id, organization_id, rating, display_name, country_code, submitted_at, customers(full_name, nationality), vehicles(make, model), organizations(name, trading_name, contract_accent_colour, settings)"
    )
    .eq("token", token)
    .maybeSingle();
  if (!review) return { state: "not_found" };
  const organization = review.organizations || {};
  const done = Boolean(review.submitted_at);
  return {
    state: done ? "done" : "open",
    id: review.id,
    organizationId: review.organization_id,
    businessName: String(organization.trading_name || organization.name || ""),
    brandColour: organization.contract_accent_colour || null,
    vehicle: [review.vehicles?.make, review.vehicles?.model].filter(Boolean).join(" "),
    displayName: done ? String(review.display_name || "") : reviewName(review.customers?.full_name),
    country: done ? review.country_code || null : reviewCountry(review.customers?.nationality),
    rating: review.rating ?? null,
    googleUrl: googleReviewUrl(organization.settings)
  };
}

export type SubmitReviewResult = { ok: true; googleUrl: string | null } | { ok: false; error: "not_found" | "done" | "rating" | "failed" };

export const REVIEW_TEXT_MAX = 600;

/** The renter sends the form. Kept whatever the stars; the business is told and gets a To do. */
export async function submitReview(admin: any, input: { token: string; rating: number; text: string; consent: boolean }): Promise<SubmitReviewResult> {
  const page = await loadReviewPage(admin, input.token);
  if (page.state === "not_found") return { ok: false, error: "not_found" };
  if (page.state === "done") return { ok: false, error: "done" };
  const rating = Math.round(Number(input.rating));
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "rating" };
  const text = String(input.text || "").replace(/\s+\n/g, "\n").trim().slice(0, REVIEW_TEXT_MAX);

  const { data: saved, error } = await admin
    .from("rental_reviews")
    .update({
      rating,
      body: text || null,
      consent: input.consent === true,
      display_name: page.displayName || null,
      country_code: page.country,
      submitted_at: new Date().toISOString()
    })
    .eq("id", page.id)
    .is("submitted_at", null)
    .select("id, rental_id, vehicle_id")
    .maybeSingle();
  if (error) return { ok: false, error: "failed" };
  if (!saved) return { ok: false, error: "done" };

  const who = page.displayName || "Customer";
  await admin
    .from("tasks")
    .insert({
      organization_id: page.organizationId,
      rental_id: saved.rental_id,
      vehicle_id: saved.vehicle_id || null,
      title: `Review from ${who} to check`,
      title_key: null,
      task_type: "admin",
      action: "review",
      due_at: new Date().toISOString(),
      created_by: null
    })
    .then(() => null, () => null);
  await notifyOperator(page.organizationId, { emoji: "⭐", key: "reviewReceived", values: { customer: page.displayName || null, rating } }, "portal_action", "/customers/reviews").catch(() => null);

  return { ok: true, googleUrl: rating >= 4 ? page.googleUrl : null };
}

// ── The business's side ──────────────────────────────────────────────────────

export type OperatorReview = {
  id: string;
  rating: number;
  text: string;
  displayName: string;
  country: string | null;
  customerId: string | null;
  customerName: string;
  vehicleId: string | null;
  vehicle: string;
  rentalId: string;
  submittedAt: string;
  consent: boolean;
  published: boolean;
  reply: string;
  checked: boolean;
  isTest: boolean;
};

/** Every review a business has received, newest first. `supabase` may be the signed-in client (RLS: own business). */
export async function listReviews(supabase: any, organizationId: string, filter: { customerId?: string; vehicleId?: string; limit?: number } = {}): Promise<OperatorReview[]> {
  let query = supabase
    .from("rental_reviews")
    .select("id, rating, body, display_name, country_code, customer_id, vehicle_id, rental_id, submitted_at, consent, published, reply, checked_at, is_test, customers(full_name), vehicles(make, model, registration_number)")
    .eq("organization_id", organizationId)
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(filter.limit || 500);
  if (filter.customerId) query = query.eq("customer_id", filter.customerId);
  if (filter.vehicleId) query = query.eq("vehicle_id", filter.vehicleId);
  const { data } = await query;
  return ((data || []) as any[]).map((row) => ({
    id: row.id,
    rating: Number(row.rating || 0),
    text: String(row.body || ""),
    displayName: String(row.display_name || ""),
    country: row.country_code || null,
    customerId: row.customer_id || null,
    customerName: String(row.customers?.full_name || row.display_name || ""),
    vehicleId: row.vehicle_id || null,
    vehicle: [row.vehicles?.make, row.vehicles?.model].filter(Boolean).join(" ") || String(row.vehicles?.registration_number || ""),
    rentalId: row.rental_id,
    submittedAt: row.submitted_at,
    consent: Boolean(row.consent),
    published: Boolean(row.published),
    reply: String(row.reply || ""),
    checked: Boolean(row.checked_at),
    isTest: Boolean(row.is_test)
  }));
}

/** Average (one decimal) and count of a list of reviews. */
export function averageOf(reviews: Array<{ rating: number }>): { average: number; count: number } {
  if (!reviews.length) return { average: 0, count: 0 };
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { average: Math.round((total / reviews.length) * 10) / 10, count: reviews.length };
}
