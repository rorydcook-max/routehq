/**
 * A rough price for a stay, from a vehicle's daily / weekly / monthly rates.
 * Shown to customers as "about"; the business confirms the real price.
 */

export type Rates = { dailyRate: number; weeklyRate: number; monthlyRate: number };

export function daysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

/** Cheapest way to cover the days with the rates the vehicle has; null when none fits. */
export function estimateRental(rates: Rates, days: number): number | null {
  const options: number[] = [];
  if (rates.dailyRate > 0) options.push(days * rates.dailyRate);
  if (rates.weeklyRate > 0 && days >= 7) options.push((days / 7) * rates.weeklyRate);
  if (rates.monthlyRate > 0 && days >= 28) options.push((days / 30) * rates.monthlyRate);
  if (options.length === 0) return null;
  // Round to the nearest 10 so an estimate doesn't look like an exact quote.
  return Math.round(Math.min(...options) / 10) * 10;
}

/** The headline price for a card: the longest period the vehicle is priced for. */
export function headlineRate(rates: Rates): { amount: number; per: "month" | "week" | "day" } | null {
  if (rates.monthlyRate > 0) return { amount: rates.monthlyRate, per: "month" };
  if (rates.weeklyRate > 0) return { amount: rates.weeklyRate, per: "week" };
  if (rates.dailyRate > 0) return { amount: rates.dailyRate, per: "day" };
  return null;
}

export type RentalPlan = { pricingModel: "daily" | "weekly" | "monthly"; rate: number };

/**
 * The billing period and price a booking made online gets. `days` is null for
 * a long-term rental with no end date. Returns null when the stay is shorter
 * than anything the vehicle is priced for (a monthly-only car for a weekend).
 */
export function planFor(rates: Rates, days: number | null): RentalPlan | null {
  if (days === null) {
    if (rates.monthlyRate > 0) return { pricingModel: "monthly", rate: rates.monthlyRate };
    if (rates.weeklyRate > 0) return { pricingModel: "weekly", rate: rates.weeklyRate };
    return rates.dailyRate > 0 ? { pricingModel: "daily", rate: rates.dailyRate } : null;
  }
  if (days >= 28 && rates.monthlyRate > 0) return { pricingModel: "monthly", rate: rates.monthlyRate };
  if (days >= 7 && rates.weeklyRate > 0) return { pricingModel: "weekly", rate: rates.weeklyRate };
  return rates.dailyRate > 0 ? { pricingModel: "daily", rate: rates.dailyRate } : null;
}

/** Why a short stay can't be booked online, in the customer's words. */
export function minimumStay(rates: Rates): string | null {
  if (rates.dailyRate > 0) return null;
  if (rates.weeklyRate > 0) return "Minimum 1 week";
  return rates.monthlyRate > 0 ? "Minimum 1 month" : null;
}
