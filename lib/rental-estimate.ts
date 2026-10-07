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

export type StayQuote = {
  amount: number;
  /** Which rate the price is worked out from. */
  basis: "daily" | "weekly" | "monthly";
  /** In plain words, e.g. "5 days at ฿500 a day". */
  explain: string;
};

const baht = (value: number) => `฿${Math.round(value).toLocaleString("en-US")}`;

/**
 * The price of a number of days from a rate card, the way a rental desk
 * quotes it: under a week uses the daily rate, a week up to a month uses the
 * weekly rate pro rata, a month or more uses the monthly rate pro rata. A
 * missing rate falls back to the nearest one the vehicle does have. A short
 * stay never costs more than the next longer rate (six days at the daily rate
 * is capped at the weekly rate, three weeks at the monthly rate).
 */
export function quoteStay(rates: Rates, days: number): StayQuote | null {
  if (!(days > 0)) return null;
  const order: Array<StayQuote["basis"]> = days >= 28 ? ["monthly", "weekly", "daily"] : days >= 7 ? ["weekly", "daily", "monthly"] : ["daily", "weekly", "monthly"];
  const rateOf = { daily: rates.dailyRate, weekly: rates.weeklyRate, monthly: rates.monthlyRate };
  const basis = order.find((key) => rateOf[key] > 0);
  if (!basis) return null;

  const dayWord = days === 1 ? "day" : "days";
  let amount = basis === "daily" ? days * rates.dailyRate : basis === "weekly" ? (days / 7) * rates.weeklyRate : (days / 30) * rates.monthlyRate;
  let explain =
    basis === "daily"
      ? `${days} ${dayWord} at ${baht(rates.dailyRate)} a day`
      : basis === "weekly"
        ? `${days} ${dayWord} at the weekly rate of ${baht(rates.weeklyRate)}`
        : `${days} ${dayWord} at the monthly rate of ${baht(rates.monthlyRate)}`;

  if (days < 7 && basis === "daily" && rates.weeklyRate > 0 && amount > rates.weeklyRate) {
    amount = rates.weeklyRate;
    explain = `${days} ${dayWord}, charged as one week (${baht(rates.weeklyRate)})`;
  }
  if (days < 28 && basis !== "monthly" && rates.monthlyRate > 0 && amount > rates.monthlyRate) {
    amount = rates.monthlyRate;
    explain = `${days} ${dayWord}, charged as one month (${baht(rates.monthlyRate)})`;
  }
  // To the nearest 10, the way a person would quote it.
  return { amount: Math.max(0, Math.round(amount / 10) * 10), basis, explain };
}

/**
 * The rate card to price extra days on a rental: the vehicle's rates, with the
 * rate this customer actually agreed standing in for its own period (someone
 * paying a negotiated monthly rate keeps it).
 */
export function rentalRateCard(vehicle: { daily_rate?: unknown; weekly_rate?: unknown; monthly_rate?: unknown } | null | undefined, rental: { rental_rate?: unknown; pricing_model?: unknown; billing_interval?: unknown }): Rates {
  const card: Rates = { dailyRate: Number(vehicle?.daily_rate || 0), weeklyRate: Number(vehicle?.weekly_rate || 0), monthlyRate: Number(vehicle?.monthly_rate || 0) };
  const agreed = Number(rental.rental_rate || 0);
  const period = String(rental.billing_interval || rental.pricing_model || "monthly").toLowerCase();
  if (agreed > 0) {
    if (period === "daily") card.dailyRate = agreed;
    else if (period === "weekly") card.weeklyRate = agreed;
    // A one-off agreed price ("custom") is for that whole rental, not a monthly rate to price more days from.
    else if (period === "monthly") card.monthlyRate = agreed;
  }
  return card;
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
 * a rental with no end date, which needs a monthly rate. Returns null when the
 * stay is shorter than anything the vehicle is priced for (a monthly-only car
 * for a weekend) or it has no monthly rate for an open-ended rental.
 */
export function planFor(rates: Rates, days: number | null): RentalPlan | null {
  // No end date always means the monthly rate, renewing each month.
  if (days === null) return rates.monthlyRate > 0 ? { pricingModel: "monthly", rate: rates.monthlyRate } : null;
  if (days >= 28 && rates.monthlyRate > 0) return { pricingModel: "monthly", rate: rates.monthlyRate };
  // Under a month: whichever of the vehicle's prices costs the customer least for the stay, so that a few extra
  // days never cost more than the week or month they fall inside (25 days at the day price can be dearer than
  // the month). A longer price only stands in when the stay could be booked at a shorter one anyway: a
  // monthly-only vehicle is still not offered for a weekend.
  const choices: Array<RentalPlan & { total: number }> = [];
  if (rates.dailyRate > 0) choices.push({ pricingModel: "daily", rate: rates.dailyRate, total: days * rates.dailyRate });
  if (rates.weeklyRate > 0 && (days >= 7 || rates.dailyRate > 0)) choices.push({ pricingModel: "weekly", rate: rates.weeklyRate, total: days > 7 ? Math.round((rates.weeklyRate * days) / 7 / 10) * 10 : rates.weeklyRate });
  if (rates.monthlyRate > 0 && choices.length > 0) choices.push({ pricingModel: "monthly", rate: rates.monthlyRate, total: rates.monthlyRate });
  if (!choices.length) return null;
  const best = choices.reduce((low, choice) => (choice.total < low.total ? choice : low), choices[0]);
  return { pricingModel: best.pricingModel, rate: best.rate };
}

/** Why a short stay can't be booked online, in the customer's words. */
export function minimumStay(rates: Rates): string | null {
  if (rates.dailyRate > 0) return null;
  if (rates.weeklyRate > 0) return "Minimum 1 week";
  return rates.monthlyRate > 0 ? "Minimum 1 month" : null;
}
