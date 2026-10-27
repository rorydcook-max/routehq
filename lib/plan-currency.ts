/**
 * Plan prices in the business's own currency (Rory, 26 Oct 2026): set in THB
 * (lib/plans.ts), converted, then rounded UP to a tidy price, and charged in
 * that currency. The rates are a fixed table, not live, so a business's price
 * doesn't move from day to day; review it every quarter (launch checklist).
 */

import { BUSINESS_INCLUDED, YEARLY_MONTHS, businessExtras, type FleetMix, type Plan } from "@/lib/plans";

/** Units of each currency per 1 THB, open.er-api.com, 26 Oct 2026. */
export const PLAN_RATES_DATE = "2026-10-26";
const PER_THB: Record<string, number> = {
  THB: 1,
  USD: 0.029619,
  EUR: 0.026428,
  GBP: 0.022146,
  AUD: 0.042143,
  NZD: 0.05194,
  CAD: 0.041493,
  SGD: 0.037863,
  MYR: 0.12101,
  IDR: 535.048113,
  PHP: 1.882968,
  VND: 765.047261,
  LAK: 661.481223,
  MMK: 62.174147,
  KHR: 121.6,
  INR: 2.813062,
  LKR: 9.796023,
  CNY: 0.198173,
  TWD: 0.965053,
  HKD: 0.232286,
  JPY: 4.64563,
  KRW: 39.22491,
  BRL: 0.149444,
  MXN: 0.553986,
  COP: 93.918767,
  SEK: 0.294066,
  NOK: 0.276599,
  ILS: 0.092289,
  AED: 0.108778,
  ZAR: 0.491682
};

export function planCurrency(currency: string | null | undefined) {
  const code = String(currency || "THB").toUpperCase();
  return PER_THB[code] ? code : "THB";
}

/** Decimal places the currency is normally written with (0 for JPY, IDR, VND...). */
function minorDigits(currency: string) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * A THB price in another currency, rounded up to two significant figures
 * (฿490 → $15, Rp270,000; ฿40 → $1.20), never below the currency's smallest unit.
 * THB itself is left exactly as set.
 */
export function localPrice(thb: number, currency: string): number {
  const code = planCurrency(currency);
  if (code === "THB" || thb <= 0) return thb;
  const value = thb * PER_THB[code];
  const smallest = 10 ** -minorDigits(code);
  const step = Math.max(smallest, 10 ** (Math.floor(Math.log10(value)) - 1));
  const rounded = Math.ceil(value / step - 1e-9) * step;
  // Clear float noise (1.2000000000000002).
  return Number(rounded.toFixed(Math.max(0, -Math.floor(Math.log10(step)))));
}

/** "$15", "$1.20", "Rp270.000", "฿990": whole amounts without decimals, others with the currency's usual decimals. */
export function formatPlanPrice(amount: number, currency: string, numberLocale: string) {
  const code = planCurrency(currency);
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: whole ? 0 : minorDigits(code),
    maximumFractionDigits: whole ? 0 : minorDigits(code)
  }).format(amount);
}

/** One plan's prices in a currency: the base a month and, on Business, each extra vehicle. */
export function planPrices(plan: Plan, currency: string) {
  return {
    monthly: localPrice(plan.monthly, currency),
    extraCar: localPrice(plan.extraCar, currency),
    extraMotorbike: localPrice(plan.extraMotorbike, currency)
  };
}

/**
 * What a fleet pays a month on this plan, in the currency. Built from the
 * rounded local prices, so the total always adds up from what the card shows.
 */
export function fleetMonthly(plan: Plan, fleet: FleetMix, currency: string) {
  const prices = planPrices(plan, currency);
  if (plan.id !== "business") return prices.monthly;
  const extras = businessExtras(fleet);
  const total = prices.monthly + extras.cars * prices.extraCar + extras.motorbikes * prices.extraMotorbike;
  return Number(total.toFixed(minorDigits(planCurrency(currency))));
}

export function yearlyOf(monthly: number, currency: string) {
  return Number((monthly * YEARLY_MONTHS).toFixed(minorDigits(planCurrency(currency))));
}

/**
 * What a business is asked to pay for a plan: the full price for its fleet, monthly or for the year,
 * and half of it for founding members (the first 100 paying businesses).
 */
export function planCharge(plan: Plan, fleet: FleetMix, currency: string, interval: "monthly" | "yearly", founding: boolean) {
  const code = planCurrency(currency);
  const monthly = fleetMonthly(plan, fleet, code);
  const full = interval === "yearly" ? yearlyOf(monthly, code) : monthly;
  const digits = minorDigits(code);
  const half = Math.ceil((full / 2) * 10 ** digits - 1e-9) / 10 ** digits;
  return { currency: code, full, amount: founding ? half : full, founding };
}

export { BUSINESS_INCLUDED };
