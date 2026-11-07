/**
 * RoveHQ's plans as Stripe Prices (Stripe Billing, phase 1, 7 Nov 2026). One Price per plan and interval,
 * found by lookup_key, with an amount for every plan currency (currency_options), so the amounts are exactly
 * the ones the plans page shows (lib/plan-currency.ts). Business adds one item per extra car and per extra
 * motorbike over what its base covers. Free has no Stripe Price: it is simply no subscription.
 */

import { PLANS, businessExtras, planById, type FleetMix, type PlanId } from "@/lib/plans";
import { PLAN_CURRENCIES, localPrice, planCurrency, yearlyOf } from "@/lib/plan-currency";

export type BillingInterval = "monthly" | "yearly";
export type PriceKind = "base" | "extra_car" | "extra_motorbike";
export type PaidPlanId = Exclude<PlanId, "free">;

export const PAID_PLANS = PLANS.filter((plan) => plan.monthly > 0).map((plan) => plan.id as PaidPlanId);

/** The default currency of each Price; every other plan currency is a currency_option. */
export const BASE_CURRENCY = "THB";

/** Software as a service, business use. */
export const SAAS_TAX_CODE = "txcd_10103001";

/** Stripe's zero-decimal currencies among ours. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "BIF", "CLP", "DJF", "GNF", "KMF", "MGA", "PYG", "RWF", "UGX", "VUV", "XAF", "XOF", "XPF"]);

export function toMinor(amount: number, currency: string) {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}

export function fromMinor(amount: number, currency: string) {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? amount : amount / 100;
}

export function lookupKey(plan: PaidPlanId, interval: BillingInterval, kind: PriceKind = "base") {
  const period = interval === "yearly" ? "annual" : "monthly";
  return kind === "base" ? `${plan}_${period}` : `${plan}_${kind}_${period}`;
}

/** Reads a lookup_key back: which plan, interval and kind of item it is. */
export function parseLookupKey(key: string | null | undefined): { plan: PaidPlanId; interval: BillingInterval; kind: PriceKind } | null {
  const match = /^(starter|pro|business)_(?:(extra_car|extra_motorbike)_)?(monthly|annual)$/.exec(String(key || ""));
  if (!match) return null;
  return { plan: match[1] as PaidPlanId, kind: (match[2] as PriceKind) || "base", interval: match[3] === "annual" ? "yearly" : "monthly" };
}

/** The THB amount (a month) behind a kind of item. */
function monthlyThb(plan: PaidPlanId, kind: PriceKind) {
  const definition = planById(plan);
  return kind === "extra_car" ? definition.extraCar : kind === "extra_motorbike" ? definition.extraMotorbike : definition.monthly;
}

/** One item's amount in a currency for an interval, as the plans page works it out. */
export function itemAmount(plan: PaidPlanId, kind: PriceKind, interval: BillingInterval, currency: string) {
  const code = planCurrency(currency);
  const monthly = localPrice(monthlyThb(plan, kind), code);
  return interval === "yearly" ? yearlyOf(monthly, code) : monthly;
}

/** Every Price the catalog needs (for the seed script). */
export function catalogPrices() {
  const prices: Array<{ plan: PaidPlanId; kind: PriceKind; interval: BillingInterval; lookupKey: string; amounts: Record<string, number> }> = [];
  for (const plan of PAID_PLANS) {
    const kinds: PriceKind[] = planById(plan).extraCar > 0 ? ["base", "extra_car", "extra_motorbike"] : ["base"];
    for (const kind of kinds) {
      for (const interval of ["monthly", "yearly"] as BillingInterval[]) {
        const amounts: Record<string, number> = {};
        for (const currency of PLAN_CURRENCIES) amounts[currency] = toMinor(itemAmount(plan, kind, interval, currency), currency);
        prices.push({ plan, kind, interval, lookupKey: lookupKey(plan, interval, kind), amounts });
      }
    }
  }
  return prices;
}

/** The items a subscription to this plan has for this fleet: Business adds its extra vehicles. */
export function planItems(plan: PaidPlanId, interval: BillingInterval, fleet: FleetMix): Array<{ lookupKey: string; quantity: number }> {
  const items = [{ lookupKey: lookupKey(plan, interval), quantity: 1 }];
  if (planById(plan).extraCar > 0) {
    const extras = businessExtras(fleet);
    if (extras.cars > 0) items.push({ lookupKey: lookupKey(plan, interval, "extra_car"), quantity: extras.cars });
    if (extras.motorbikes > 0) items.push({ lookupKey: lookupKey(plan, interval, "extra_motorbike"), quantity: extras.motorbikes });
  }
  return items;
}
