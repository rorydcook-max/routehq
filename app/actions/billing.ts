"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { getCurrentMembership } from "@/lib/auth/roles";
import { said } from "@/lib/i18n/server-text";
import { planCurrency } from "@/lib/plan-currency";
import { PLANS, effectiveLimits, planById } from "@/lib/plans";
import { planItems, type BillingInterval, type PaidPlanId } from "@/lib/billing/catalog";
import { applyPlanToFleet, chooseActive, loadFleet } from "@/lib/billing/parking";
import { getStripe, portalConfigurationId, priceIds, stripeConfigured } from "@/lib/billing/stripe";
import { retrieveSubscription, syncSubscription } from "@/lib/billing/sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { choosePlan } from "@/app/actions/plan";

/**
 * Plans paid through Stripe Billing (phase 1, 7 Nov 2026): Embedded Checkout for a first paid plan, then
 * upgrades straight away with proration and smaller plans (or Free) at the end of the paid period. Owners only.
 */

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const ORG_FIELDS =
  "id, name, currency, subscription_status, subscription_tier, billing_interval, trial_ends_at, stripe_customer_id, stripe_subscription_id, stripe_subscription_status, scheduled_plan";

const LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid"];

const rank = (plan: string | null | undefined) => {
  const index = PLANS.findIndex((entry) => entry.id === planById(plan).id);
  return index < 0 ? 0 : index;
};

async function owner() {
  const membership = await getCurrentMembership();
  if (!membership) return { error: await said("Please sign in first.") } as const;
  if (membership.role !== "owner") return { error: await said("Only the business owner can change this.") } as const;
  if (!stripeConfigured()) return { error: await said("Could not send. Please try again.") } as const;
  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select(ORG_FIELDS).eq("id", membership.organizationId).maybeSingle();
  if (!organization) return { error: await said("Could not send. Please try again.") } as const;
  return { membership, admin, organization } as const;
}

async function appOrigin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") || list.get("host");
  const proto = list.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : String(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** The business's Stripe customer, made on first use. */
async function ensureCustomer(admin: any, organization: any, email: string | null) {
  if (organization.stripe_customer_id) return String(organization.stripe_customer_id);
  const customer = await getStripe().customers.create(
    { name: organization.name || undefined, email: email || undefined, metadata: { organization_id: organization.id } },
    { idempotencyKey: `rovehq-customer-${organization.id}` }
  );
  await admin.from("organizations").update({ stripe_customer_id: customer.id }).eq("id", organization.id);
  return customer.id;
}

/** The live subscription, when there is one. */
async function liveSubscription(organization: any): Promise<Stripe.Subscription | null> {
  if (!organization.stripe_subscription_id) return null;
  const subscription = await retrieveSubscription(organization.stripe_subscription_id).catch(() => null);
  return subscription && LIVE_STATUSES.includes(subscription.status) ? subscription : null;
}

/** Items for a plan, with Business priced for the vehicles that stay active on it. */
async function itemsFor(admin: any, organizationId: string, plan: PaidPlanId, interval: BillingInterval, keep: string[] | null) {
  const [fleet, { data: custom }] = await Promise.all([loadFleet(admin, organizationId), admin.from("organizations").select("custom_limits").eq("id", organizationId).maybeSingle()]);
  const limits = effectiveLimits({ subscription_tier: plan, custom_limits: custom?.custom_limits });
  const active = chooseActive(limits, fleet, keep);
  const kept = fleet.filter((vehicle) => active.has(vehicle.id));
  const motorbikes = kept.filter((vehicle) => vehicle.motorbike).length;
  const wanted = planItems(plan, interval, { cars: kept.length - motorbikes, motorbikes });
  const ids = await priceIds(wanted.map((item) => item.lookupKey));
  return wanted.map((item) => ({ price: ids[item.lookupKey], quantity: item.quantity }));
}

function cleanKeep(keep: unknown): string[] | null {
  if (!Array.isArray(keep)) return null;
  return keep.filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 2000);
}

function paths() {
  revalidatePath("/settings/billing");
  revalidatePath("/settings");
  revalidatePath("/fleet");
}

/** Releases a pending smaller-plan schedule and an end-of-period cancel, so a new change starts clean. */
async function clearScheduledChange(subscription: Stripe.Subscription) {
  const stripe = getStripe();
  if (subscription.schedule) {
    const scheduleId = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id;
    await stripe.subscriptionSchedules.release(scheduleId).catch(() => null);
  }
  if (subscription.cancel_at_period_end || subscription.cancel_at) {
    await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: false, cancel_at: "" as any });
  }
}

/**
 * Choosing a paid plan. No subscription yet: an Embedded Checkout session (clientSecret). A subscription already:
 * a bigger plan (or yearly) switches now with proration; a smaller one waits for the end of the paid period.
 */
export async function choosePaidPlan(input: { plan: string; interval: string; keep?: string[] | null }): Promise<Result<{ clientSecret?: string; outcome: "checkout" | "changed" | "scheduled" | "same" }>> {
  const context = await owner();
  if ("error" in context) return { ok: false, error: String(context.error) };
  const { membership, admin, organization } = context;
  const wanted = PLANS.find((plan) => plan.id === input.plan && plan.monthly > 0);
  if (!wanted) return { ok: false, error: await said("Could not send. Please try again.") };
  const plan = wanted.id as PaidPlanId;
  const interval: BillingInterval = input.interval === "yearly" ? "yearly" : "monthly";
  const keep = cleanKeep(input.keep);
  const stripe = getStripe();

  try {
    const subscription = await liveSubscription(organization);
    if (!subscription) {
      const customer = await ensureCustomer(admin, organization, membership.email ?? null);
      const items = await itemsFor(admin, organization.id, plan, interval, null);
      const origin = await appOrigin();
      // A trial still running: the first payment waits for its end (Stripe needs at least two days' notice).
      const trialEnd = organization.subscription_status === "trial" && organization.trial_ends_at ? Math.floor(new Date(organization.trial_ends_at).getTime() / 1000) : 0;
      const keepTrial = trialEnd > Math.floor(Date.now() / 1000) + 2 * 24 * 60 * 60 + 300;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page",
        customer,
        client_reference_id: organization.id,
        currency: planCurrency(organization.currency).toLowerCase(),
        line_items: items,
        automatic_tax: { enabled: true },
        billing_address_collection: "required",
        tax_id_collection: { enabled: true },
        customer_update: { address: "auto", name: "auto" },
        redirect_on_completion: "if_required",
        return_url: `${origin}/settings/billing?checkout={CHECKOUT_SESSION_ID}`,
        metadata: { organization_id: organization.id, plan, interval },
        subscription_data: {
          metadata: { organization_id: organization.id },
          billing_mode: { type: "flexible" },
          ...(keepTrial ? { trial_end: trialEnd } : {})
        }
      } as Stripe.Checkout.SessionCreateParams);
      if (!session.client_secret) return { ok: false, error: await said("Could not send. Please try again.") };
      return { ok: true, outcome: "checkout", clientSecret: session.client_secret };
    }

    const currentTier = planById(organization.subscription_tier).id;
    const currentInterval = organization.billing_interval === "yearly" ? "yearly" : "monthly";
    const smaller = rank(plan) < rank(currentTier) || (plan === currentTier && currentInterval === "yearly" && interval === "monthly");
    const items = await itemsFor(admin, organization.id, plan, interval, smaller ? keep : null);

    if (!smaller) {
      if (plan === currentTier && interval === currentInterval && plan !== "business" && !organization.scheduled_plan) return { ok: true, outcome: "same" };
      await clearScheduledChange(subscription);
      const fresh = await retrieveSubscription(subscription.id);
      await stripe.subscriptions.update(fresh.id, {
        items: [...fresh.items.data.map((item) => ({ id: item.id, deleted: true })), ...items],
        proration_behavior: "always_invoice",
        payment_behavior: "error_if_incomplete",
        cancel_at_period_end: false
      });
      await admin.from("organizations").update({ plan_keep_vehicle_ids: null }).eq("id", organization.id);
      await syncSubscription(admin, await retrieveSubscription(subscription.id));
      paths();
      return { ok: true, outcome: "changed" };
    }

    // Smaller: keep what was paid for until the period ends, then switch (a subscription schedule).
    await clearScheduledChange(subscription);
    const fresh = await retrieveSubscription(subscription.id);
    const schedule = await stripe.subscriptionSchedules.create({ from_subscription: fresh.id });
    const current = schedule.phases[schedule.phases.length - 1];
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      proration_behavior: "none",
      phases: [
        {
          items: current.items.map((item) => ({ price: typeof item.price === "string" ? item.price : item.price.id, quantity: item.quantity ?? 1 })),
          start_date: current.start_date,
          end_date: current.end_date
        },
        { items, duration: { interval: interval === "yearly" ? "year" : "month", interval_count: 1 } }
      ]
    } as Stripe.SubscriptionScheduleUpdateParams);
    await admin.from("organizations").update({ plan_keep_vehicle_ids: keep }).eq("id", organization.id);
    await syncSubscription(admin, await retrieveSubscription(subscription.id));
    paths();
    return { ok: true, outcome: "scheduled" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("choosePaidPlan", message);
    if (/card|payment|declin/i.test(message)) return { ok: false, error: await said("The payment didn't go through. Update your card and try again.") };
    return { ok: false, error: await said("Could not send. Please try again.") };
  }
}

/**
 * Free (also "Cancel"): a paid subscription ends at the end of its period and the business is on Free from
 * then; with no subscription it switches as before. `keep`: the vehicles that stay active on Free.
 */
export async function chooseFreePlan(input: { keep?: string[] | null } = {}): Promise<Result<{ outcome: "scheduled" | "free" | "freeAfterTrial" }>> {
  const context = await owner();
  if ("error" in context) return { ok: false, error: String(context.error) };
  const { admin, organization } = context;
  const keep = cleanKeep(input.keep);
  try {
    const subscription = await liveSubscription(organization);
    if (subscription) {
      await clearScheduledChange(subscription);
      await getStripe().subscriptions.update(subscription.id, { cancel_at_period_end: true });
      await admin.from("organizations").update({ plan_keep_vehicle_ids: keep }).eq("id", organization.id);
      await syncSubscription(admin, await retrieveSubscription(subscription.id));
      paths();
      return { ok: true, outcome: "scheduled" };
    }
    const before = planById(organization.subscription_tier).id;
    const result = await choosePlan({ plan: "free", interval: "monthly" });
    if (!result.ok) return result;
    if (result.outcome === "free") {
      await admin.from("organizations").update({ plan_keep_vehicle_ids: keep }).eq("id", organization.id);
      await applyPlanToFleet(admin, organization.id, { park: before !== "free", keep });
    }
    paths();
    return { ok: true, outcome: result.outcome === "freeAfterTrial" ? "freeAfterTrial" : "free" };
  } catch (error) {
    console.error("chooseFreePlan", error instanceof Error ? error.message : error);
    return { ok: false, error: await said("Could not send. Please try again.") };
  }
}

/** Keep the current plan: undoes a pending move to a smaller plan or to Free. */
export async function keepCurrentPlan(): Promise<Result> {
  const context = await owner();
  if ("error" in context) return { ok: false, error: String(context.error) };
  const { admin, organization } = context;
  try {
    const subscription = await liveSubscription(organization);
    if (subscription) {
      await clearScheduledChange(subscription);
      await syncSubscription(admin, await retrieveSubscription(subscription.id));
    }
    await admin.from("organizations").update({ plan_keep_vehicle_ids: null, scheduled_plan: null, scheduled_interval: null, scheduled_change_at: null }).eq("id", organization.id);
    paths();
    return { ok: true };
  } catch (error) {
    console.error("keepCurrentPlan", error instanceof Error ? error.message : error);
    return { ok: false, error: await said("Could not send. Please try again.") };
  }
}

/** Straight after Embedded Checkout: read the session and put the new plan on the business without waiting for the webhook. */
export async function completeCheckout(sessionId: string): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in first.") };
  if (!/^cs_[A-Za-z0-9_]+$/.test(String(sessionId || ""))) return { ok: false, error: await said("Could not send. Please try again.") };
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== membership.organizationId) return { ok: false, error: await said("Could not send. Please try again.") };
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    if (session.status !== "complete" || !subscriptionId) return { ok: false, error: await said("The payment didn't go through. Update your card and try again.") };
    const admin = createSupabaseAdminClient() as any;
    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
    if (customerId) await admin.from("organizations").update({ stripe_customer_id: customerId }).eq("id", membership.organizationId).is("stripe_customer_id", null);
    await syncSubscription(admin, await retrieveSubscription(subscriptionId));
    paths();
    return { ok: true };
  } catch (error) {
    console.error("completeCheckout", error instanceof Error ? error.message : error);
    return { ok: false, error: await said("Could not send. Please try again.") };
  }
}

/** Stripe's Customer Portal for the card, billing details and invoices. */
export async function openBillingPortal(): Promise<Result<{ url: string }>> {
  const context = await owner();
  if ("error" in context) return { ok: false, error: String(context.error) };
  const { membership, admin, organization } = context;
  try {
    const customer = await ensureCustomer(admin, organization, membership.email ?? null);
    const configuration = await portalConfigurationId().catch(() => null);
    const session = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: `${await appOrigin()}/settings/billing`,
      ...(configuration ? { configuration } : {})
    });
    return { ok: true, url: session.url };
  } catch (error) {
    console.error("openBillingPortal", error instanceof Error ? error.message : error);
    return { ok: false, error: await said("Could not send. Please try again.") };
  }
}
