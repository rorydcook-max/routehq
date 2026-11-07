/**
 * The Stripe client for RoveHQ's own billing (server only: it holds the secret key). The API version is pinned
 * to the one the installed SDK was built for, so a Stripe-side default change never alters behavior.
 */

import Stripe from "stripe";
import { lookupKey, type BillingInterval, type PaidPlanId } from "@/lib/billing/catalog";

export const STRIPE_API_VERSION = "2026-09-30.endive" as const;

let client: Stripe | null = null;

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (typeof window !== "undefined") throw new Error("Stripe secret client used in the browser");
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!client) client = new Stripe(key, { apiVersion: STRIPE_API_VERSION as any, appInfo: { name: "RoveHQ", url: "https://rovehq.app" }, maxNetworkRetries: 2 });
  return client;
}

const priceCache = new Map<string, { id: string; at: number }>();

/** Price IDs by lookup_key (cached for ten minutes). Throws when a Price is missing: run scripts/stripe-seed-plans.ts. */
export async function priceIds(keys: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const missing = keys.filter((key) => !priceCache.has(key) || now - priceCache.get(key)!.at > 10 * 60_000);
  if (missing.length) {
    const list = await getStripe().prices.list({ lookup_keys: missing, active: true, limit: 100 });
    for (const price of list.data) if (price.lookup_key) priceCache.set(price.lookup_key, { id: price.id, at: now });
  }
  const result: Record<string, string> = {};
  for (const key of keys) {
    const hit = priceCache.get(key);
    if (!hit) throw new Error(`Stripe price ${key} not found`);
    result[key] = hit.id;
  }
  return result;
}

export async function basePriceId(plan: PaidPlanId, interval: BillingInterval) {
  const key = lookupKey(plan, interval);
  return (await priceIds([key]))[key];
}

const PORTAL_TAG = "rovehq_plan_portal";
let portalConfig: { id: string; at: number } | null = null;

/**
 * The Customer Portal configuration the seed script made (payment method, billing details, invoices; plan
 * changes and canceling stay in the app). Null: Stripe's default configuration is used.
 */
export async function portalConfigurationId(): Promise<string | null> {
  if (process.env.STRIPE_PORTAL_CONFIGURATION_ID) return process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  if (portalConfig && Date.now() - portalConfig.at < 60 * 60_000) return portalConfig.id;
  const list = await getStripe().billingPortal.configurations.list({ active: true, limit: 100 });
  const found = list.data.find((configuration) => configuration.metadata?.tag === PORTAL_TAG);
  if (!found) return null;
  portalConfig = { id: found.id, at: Date.now() };
  return found.id;
}

export { PORTAL_TAG };
