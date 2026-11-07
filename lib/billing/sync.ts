/**
 * Keeps organizations (the single source of truth for a business's plan) in step with its Stripe subscription.
 * Called by the platform webhook and straight after Embedded Checkout completes, always with a subscription
 * freshly read from the API, never the event payload.
 */

import type Stripe from "stripe";
import { PLANS } from "@/lib/plans";
import { parseLookupKey, type BillingInterval, type PaidPlanId } from "@/lib/billing/catalog";
import { applyPlanToFleet } from "@/lib/billing/parking";
import { getStripe } from "@/lib/billing/stripe";

const rank = (plan: string | null | undefined) => {
  const wanted = String(plan || "").toLowerCase() === "growth" ? "pro" : String(plan || "").toLowerCase();
  const index = PLANS.findIndex((entry) => entry.id === wanted);
  return index < 0 ? 2 : index;
};

const iso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);

export async function retrieveSubscription(id: string) {
  return getStripe().subscriptions.retrieve(id, { expand: ["items.data.price", "schedule"] });
}

/** The plan and interval of a set of subscription items (the base item decides). */
export function planOfItems(items: Array<{ price?: Stripe.Price | string | null }>): { plan: PaidPlanId; interval: BillingInterval } | null {
  for (const item of items) {
    const price = item.price && typeof item.price === "object" ? item.price : null;
    const parsed = parseLookupKey(price?.lookup_key);
    if (parsed && parsed.kind === "base") return { plan: parsed.plan, interval: parsed.interval };
  }
  return null;
}

/** When the current paid period ends (item-level in current API versions). */
export function periodEnd(subscription: Stripe.Subscription): string | null {
  const ends = subscription.items.data.map((item: any) => Number(item.current_period_end || 0)).filter(Boolean);
  const fromItems = ends.length ? Math.max(...ends) : Number((subscription as any).current_period_end || 0);
  return iso(fromItems || null);
}

async function scheduledChange(subscription: Stripe.Subscription, end: string | null) {
  if (subscription.cancel_at_period_end || subscription.cancel_at) {
    return { scheduled_plan: "free", scheduled_interval: null, scheduled_change_at: iso(subscription.cancel_at) || end };
  }
  const scheduleRef = subscription.schedule;
  if (!scheduleRef) return { scheduled_plan: null, scheduled_interval: null, scheduled_change_at: null };
  const scheduleId = typeof scheduleRef === "string" ? scheduleRef : scheduleRef.id;
  const schedule = await getStripe().subscriptionSchedules.retrieve(scheduleId, { expand: ["phases.items.price"] });
  const now = Math.floor(Date.now() / 1000);
  const next = schedule.phases.find((phase) => Number(phase.start_date) > now);
  const plan = next ? planOfItems(next.items as any) : null;
  if (!next || !plan) return { scheduled_plan: null, scheduled_interval: null, scheduled_change_at: null };
  return { scheduled_plan: plan.plan, scheduled_interval: plan.interval, scheduled_change_at: iso(Number(next.start_date)) };
}

async function organizationFor(admin: any, subscription: Stripe.Subscription) {
  const fields = "id, subscription_tier, subscription_status, stripe_subscription_id, stripe_customer_id";
  const fromMetadata = subscription.metadata?.organization_id;
  if (fromMetadata) {
    const { data } = await admin.from("organizations").select(fields).eq("id", fromMetadata).maybeSingle();
    if (data) return data;
  }
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;
  const { data } = await admin.from("organizations").select(fields).eq("stripe_customer_id", customerId).maybeSingle();
  return data || null;
}

const CLEAR_PENDING = { pending_plan: null, pending_interval: null, pending_amount: null, pending_currency: null, plan_requested_at: null, plan_request_thread_id: null };

/** Writes one subscription's state onto its business. Returns the business id, or null when none matches. */
export async function syncSubscription(admin: any, subscription: Stripe.Subscription): Promise<string | null> {
  const organization = await organizationFor(admin, subscription);
  if (!organization) return null;
  // An older subscription of this business (replaced since) must not overwrite the current one.
  if (organization.stripe_subscription_id && organization.stripe_subscription_id !== subscription.id && !["active", "trialing", "past_due"].includes(subscription.status)) {
    return organization.id;
  }
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const oldTier = organization.subscription_tier;

  if (subscription.status === "canceled" || subscription.status === "incomplete_expired") {
    if (subscription.status === "incomplete_expired" && organization.stripe_subscription_id !== subscription.id) return organization.id;
    await admin
      .from("organizations")
      .update({
        subscription_tier: "free",
        subscription_status: "active",
        billing_interval: "monthly",
        next_payment_due: null,
        stripe_subscription_id: null,
        stripe_subscription_status: subscription.status,
        subscription_cancel_at_period_end: false,
        scheduled_plan: null,
        scheduled_interval: null,
        scheduled_change_at: null,
        ...CLEAR_PENDING
      })
      .eq("id", organization.id);
    await applyPlanToFleet(admin, organization.id, { park: rank(oldTier) > rank("free") });
    await admin.from("organizations").update({ plan_keep_vehicle_ids: null }).eq("id", organization.id);
    return organization.id;
  }

  if (subscription.status === "incomplete") {
    await admin.from("organizations").update({ stripe_customer_id: customerId || organization.stripe_customer_id, stripe_subscription_status: "incomplete" }).eq("id", organization.id);
    return organization.id;
  }

  const plan = planOfItems(subscription.items.data as any);
  if (!plan) return organization.id;
  const end = subscription.status === "trialing" ? iso(subscription.trial_end) || periodEnd(subscription) : periodEnd(subscription);
  const status = subscription.status === "trialing" ? "trial" : subscription.status === "active" ? "active" : "past_due";
  const scheduled = await scheduledChange(subscription, end);
  const update: Record<string, unknown> = {
    subscription_tier: plan.plan,
    billing_interval: plan.interval,
    subscription_status: status,
    next_payment_due: end,
    stripe_customer_id: customerId || organization.stripe_customer_id,
    stripe_subscription_id: subscription.id,
    stripe_subscription_status: subscription.status,
    subscription_cancel_at_period_end: Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
    subscription_currency: String(subscription.currency || "").toUpperCase() || null,
    ...scheduled,
    ...CLEAR_PENDING
  };
  if (subscription.status === "trialing" && subscription.trial_end) update.trial_ends_at = iso(subscription.trial_end);
  if (!organization.stripe_subscription_id || organization.stripe_subscription_id !== subscription.id) update.subscription_started_at = iso(subscription.start_date) || new Date().toISOString();
  const { error } = await admin.from("organizations").update(update).eq("id", organization.id);
  if (error) throw new Error(error.message);
  const movedDown = rank(plan.plan) < rank(oldTier) && String(organization.subscription_status || "trial") !== "trial";
  await applyPlanToFleet(admin, organization.id, { park: movedDown });
  if (movedDown && !scheduled.scheduled_plan) await admin.from("organizations").update({ plan_keep_vehicle_ids: null }).eq("id", organization.id);
  return organization.id;
}
