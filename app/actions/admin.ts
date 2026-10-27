"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { ADMIN_STATUSES, logAdminAction, requirePlatformAdmin } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** RouteHQ admin console actions. Each one checks the person is a platform admin, makes the change, and logs it. */

const TIERS = ["free", "starter", "pro", "business"] as const;
const back = (organizationId: string, notice: string) => redirect(`/platform/businesses/${organizationId}?done=${encodeURIComponent(notice)}` as Route);

async function current(organizationId: string) {
  const db = createSupabaseAdminClient() as any;
  const { data } = await db.from("organizations").select("*").eq("id", organizationId).maybeSingle();
  if (!data) throw new Error("Business not found");
  return { db, org: data as any };
}

/** Change plan, billing interval and status in one go. */
export async function adminSetPlan(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const tier = String(formData.get("tier") || "");
  const interval = String(formData.get("interval") || "monthly") === "yearly" ? "yearly" : "monthly";
  const status = String(formData.get("status") || "");
  if (!TIERS.includes(tier as never) || !ADMIN_STATUSES.includes(status as never)) back(organizationId, "error");
  const { db, org } = await current(organizationId);
  const update: Record<string, unknown> = { subscription_tier: tier, billing_interval: interval, subscription_status: status };
  // Turning a business to paying starts its first period now if it has none yet.
  if (status === "active" && !org.next_payment_due) {
    const next = new Date();
    next.setMonth(next.getMonth() + (interval === "yearly" ? 12 : 1));
    update.next_payment_due = next.toISOString();
    update.subscription_started_at = org.subscription_started_at || new Date().toISOString();
  }
  const { error } = await db.from("organizations").update(update).eq("id", organizationId);
  if (error) back(organizationId, "error");
  await logAdminAction(admin, {
    action: "plan_changed",
    organizationId,
    details: { from: { tier: org.subscription_tier, interval: org.billing_interval, status: org.subscription_status }, to: { tier, interval, status } }
  });
  revalidatePath("/platform", "layout");
  back(organizationId, "plan");
}

/** Move the trial end: a number of days from the later of now and the current end, or an exact date. */
export async function adminExtendTrial(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const days = Number(formData.get("days") || 0);
  const date = String(formData.get("date") || "");
  const { db, org } = await current(organizationId);
  let ends: Date;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    ends = new Date(`${date}T16:59:59Z`); // end of that day in Thailand
  } else if (days > 0 && days <= 365) {
    const from = Math.max(Date.now(), org.trial_ends_at ? Date.parse(org.trial_ends_at) : 0);
    ends = new Date(from + days * 86_400_000);
  } else {
    back(organizationId, "error");
    return;
  }
  // A trial that had run out comes back to life when extended.
  const update: Record<string, unknown> = { trial_ends_at: ends.toISOString() };
  if (["expired", "trial"].includes(org.subscription_status || "trial")) update.subscription_status = "trial";
  const { error } = await db.from("organizations").update(update).eq("id", organizationId);
  if (error) back(organizationId, "error");
  await logAdminAction(admin, { action: "trial_extended", organizationId, details: { from: org.trial_ends_at, to: ends.toISOString() } });
  revalidatePath("/platform", "layout");
  back(organizationId, "trial");
}

/** Founding member price (half price for life) on or off. */
export async function adminSetFounding(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const on = formData.get("on") === "1";
  const { db, org } = await current(organizationId);
  const { error } = await db.from("organizations").update({ founding_member: on }).eq("id", organizationId);
  if (error) back(organizationId, "error");
  await logAdminAction(admin, { action: on ? "founding_on" : "founding_off", organizationId, details: { was: !!org.founding_member } });
  revalidatePath("/platform", "layout");
  back(organizationId, "founding");
}
