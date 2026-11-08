/**
 * AI vehicle photos allowance (task build-img, 8 Nov 2026): each image an AI provider makes, generated or enhanced,
 * costs real money (about US$0.05, lib/ai-image.ts), so each plan has a modest allowance per billing period, counted
 * the same way as purchase checks (lib/purchase-checks.ts: trial, billing-day cycles, else calendar month). Every
 * image made counts, kept or discarded. Platform admins aren't limited. Rows in ai_image_usage (migration 0141).
 *
 * A set of four generated photos is 4 images; enhancing one photo is 1.
 */

import { viewerIsPlatformAdmin } from "@/lib/admin";
import { toWallTime } from "@/lib/business-time";
import { planById, type PlanId } from "@/lib/plans";
import { checkPeriod } from "@/lib/purchase-checks";

/** Images a billing period (a trial gets the allowance of the plan it is trialling). Worst case at ~US$0.05 each: Business US$7.50. */
export const AI_IMAGES_PER_PERIOD: Record<PlanId, number> = { free: 4, starter: 20, pro: 60, business: 150 };

export type ImagesLeft = { limit: number; left: number; resetsOn: string } | null;

async function readAllowance(admin: any, organizationId: string) {
  if (await viewerIsPlatformAdmin().catch(() => false)) return null;
  const { data: row } = await admin
    .from("organizations")
    .select("subscription_tier, subscription_status, trial_started_at, trial_ends_at, next_payment_due, subscription_started_at")
    .eq("id", organizationId)
    .maybeSingle();
  if (!row) return null;
  const limit = AI_IMAGES_PER_PERIOD[planById(row.subscription_tier).id];
  const period = checkPeriod(row);
  const { count } = await admin
    .from("ai_image_usage")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", new Date(period.start).toISOString())
    .lt("created_at", new Date(period.end).toISOString());
  return { limit, used: Number(count) || 0, period };
}

/** What's left this period; null means no limit (platform admins). */
export async function aiImagesLeft(admin: any, organizationId: string): Promise<ImagesLeft> {
  const state = await readAllowance(admin, organizationId);
  return state ? { limit: state.limit, left: Math.max(0, state.limit - state.used), resetsOn: toWallTime(state.period.end).slice(0, 10) } : null;
}

/** Whether `count` more images fit in this period's allowance. */
export async function canMakeAiImages(admin: any, organizationId: string, count = 1) {
  const left = await aiImagesLeft(admin, organizationId);
  return { ok: !left || left.left >= count, left };
}

/** Records one image made (after the provider returned it, so failures never count). */
export async function recordAiImage(admin: any, row: { organizationId: string; vehicleId: string | null; kind: "generate" | "enhance"; provider: string; model: string; userId: string | null }) {
  await admin.from("ai_image_usage").insert({
    organization_id: row.organizationId,
    vehicle_id: row.vehicleId,
    kind: row.kind,
    provider: row.provider,
    model: row.model,
    created_by: row.userId
  });
}
