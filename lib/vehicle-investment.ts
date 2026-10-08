/**
 * Buying a vehicle to rent out: how much it makes, year by year, and when to sell.
 *
 * Pure arithmetic, no network. The figures it works from (rent, how often it is
 * out, running costs, what it will sell for) come from research for the model
 * in the operator's area, and the operator can change any of them.
 *
 * Profit if sold after N years
 *   = rent taken over N years
 *   - running costs over N years (insurance, tax, servicing, other)
 *   - price paid and one-off buying costs
 *   - loan interest paid up to then
 *   + what it sells for at the end of year N
 *
 * The best time to sell is the year that gives the highest profit per year
 * owned: after that, falling rent and rising repairs earn less each year than
 * replacing it would.
 */

export type RentStyle = "monthly" | "daily" | "mix";

export type Assumptions = {
  price: number;
  /** Transfer, registration, first service, anything paid once to get it on the road. */
  buyingCosts: number;
  financed: boolean;
  downPayment: number;
  monthlyPayment: number;
  loanMonths: number;
  /** Age in years on the day it is bought (0 for new). */
  ageNow: number;
  /** Rent for a full month with no empty days. */
  rentMonthly: number;
  rentLow: number;
  rentHigh: number;
  /** Share of days it is out on rent, 0-100. */
  occupancy: number;
  occupancyLow: number;
  occupancyHigh: number;
  /** From this age the rent it can ask starts to slip, by this much a year. */
  rentFadeFromAge: number;
  rentFadePct: number;
  insurance: number;
  compulsory: number;
  tax: number;
  /** Servicing, tyres and repairs in the first year owned. */
  maintenance: number;
  /** How much more servicing and repairs cost each following year, in percent. */
  maintenanceGrowthPct: number;
  otherMonthly: number;
  /** What it sells for at the end of each year owned, as a percent of the price paid. Index 0 = after one year. */
  resalePct: number[];
  /** Age after which customers stop wanting it. */
  maxRentalAge: number;
};

export type YearRow = {
  year: number;
  age: number;
  revenue: number;
  costs: number;
  operating: number;
  value: number;
  /** Total profit if sold at the end of this year. */
  profit: number;
  perYear: number;
};

export type Projection = {
  rows: YearRow[];
  best: YearRow;
  cashIn: number;
  totalCost: number;
  /** Profit per year as a percent of everything paid for the vehicle. */
  returnPct: number;
  /** Profit per year as a percent of the operator's own money put in (same as returnPct when paying cash). */
  cashReturnPct: number;
  /** Months until the money put in has come back from rent, or null if it never does within the years modelled. */
  paybackMonths: number | null;
  firstYearMonthly: number;
};

export type Verdict = "strong" | "good" | "thin" | "no";

export type Outcome = {
  expected: Projection;
  cautious: Projection;
  upside: Projection;
  verdict: Verdict;
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** How many years it can sensibly be kept: until customers stop wanting it, ten at most. */
export function horizonYears(a: Assumptions) {
  return clamp(Math.round(a.maxRentalAge - a.ageNow), 1, 10);
}

export function project(a: Assumptions): Projection {
  const years = horizonYears(a);
  const totalCost = a.price + a.buyingCosts;
  const loanMonths = Math.max(1, a.loanMonths);
  const borrowed = a.financed ? Math.max(0, a.price - a.downPayment) : 0;
  const totalInterest = a.financed ? Math.max(0, a.monthlyPayment * loanMonths - borrowed) : 0;
  const cashIn = a.financed ? Math.min(a.price, a.downPayment) + a.buyingCosts : totalCost;

  const rows: YearRow[] = [];
  let operatingSoFar = 0;
  let valueAtStart = a.price;

  for (let year = 1; year <= years; year++) {
    const age = a.ageNow + year - 1;
    const fadeYears = Math.max(0, age - a.rentFadeFromAge + 1);
    const rentFactor = Math.pow(1 - clamp(a.rentFadePct, 0, 50) / 100, fadeYears);
    const revenue = a.rentMonthly * 12 * (clamp(a.occupancy, 0, 100) / 100) * rentFactor;
    // Comprehensive cover is priced on what the vehicle is worth, so it falls as the vehicle does.
    const insurance = a.insurance * clamp(valueAtStart / Math.max(1, a.price), 0.45, 1);
    const maintenance = a.maintenance * Math.pow(1 + clamp(a.maintenanceGrowthPct, 0, 100) / 100, year - 1);
    const costs = insurance + a.compulsory + a.tax + maintenance + a.otherMonthly * 12;
    const operating = revenue - costs;
    operatingSoFar += operating;

    const value = a.price * (clamp(resaleAt(a.resalePct, year), 0, 130) / 100);
    const interestPaid = totalInterest * Math.min(1, (year * 12) / loanMonths);
    const profit = operatingSoFar - totalCost - interestPaid + value;

    rows.push({ year, age: age + 1, revenue, costs, operating, value, profit, perYear: profit / year });
    valueAtStart = value;
  }

  const top = rows.reduce((high, row) => (row.perYear > high.perYear ? row : high), rows[0]);
  // When keeping it a year or two longer earns as good as the same per year (within 3%), keep it: selling and
  // replacing a vehicle is work and risk the sums do not see.
  const nearTop = top.perYear > 0 ? rows.filter((row) => row.perYear >= top.perYear * 0.97) : [top];
  const best = nearTop[nearTop.length - 1];

  // Money back: rent less running costs and loan payments, month by month, until it covers what was put in.
  let paybackMonths: number | null = null;
  let cash = -cashIn;
  for (const row of rows) {
    for (let month = 1; month <= 12; month++) {
      const monthIndex = (row.year - 1) * 12 + month;
      const payment = a.financed && monthIndex <= loanMonths ? a.monthlyPayment : 0;
      cash += row.operating / 12 - payment;
      if (cash >= 0 && paybackMonths === null) paybackMonths = monthIndex;
    }
  }

  const firstPayment = a.financed ? a.monthlyPayment : 0;
  return {
    rows,
    best,
    cashIn,
    totalCost,
    returnPct: totalCost > 0 ? (best.perYear / totalCost) * 100 : 0,
    cashReturnPct: cashIn > 0 ? (best.perYear / cashIn) * 100 : 0,
    paybackMonths,
    firstYearMonthly: rows[0].operating / 12 - firstPayment
  };
}

function resaleAt(curve: number[], year: number) {
  if (!curve.length) return 0;
  if (year <= curve.length) return num(curve[year - 1]);
  // Past the end of the curve: keep falling at the last yearly rate.
  const last = num(curve[curve.length - 1]);
  const before = curve.length > 1 ? num(curve[curve.length - 2]) : last / 0.9;
  const rate = before > 0 ? clamp(last / before, 0.5, 1) : 0.9;
  return last * Math.pow(rate, year - curve.length);
}

/** Expected case, a slow year (low rent, more empty days, dearer repairs, weaker resale) and a good one. */
export function evaluate(a: Assumptions): Outcome {
  const expected = project(a);
  const cautious = project({
    ...a,
    rentMonthly: Math.min(a.rentLow || a.rentMonthly * 0.85, a.rentMonthly),
    occupancy: Math.min(a.occupancyLow || a.occupancy * 0.8, a.occupancy),
    maintenance: a.maintenance * 1.2,
    resalePct: a.resalePct.map((value) => value * 0.9)
  });
  const upside = project({
    ...a,
    rentMonthly: Math.max(a.rentHigh || a.rentMonthly * 1.1, a.rentMonthly),
    occupancy: Math.max(a.occupancyHigh || a.occupancy * 1.1, a.occupancy),
    resalePct: a.resalePct.map((value) => value * 1.05)
  });

  let verdict: Verdict;
  if (expected.best.perYear <= 0 || expected.returnPct < 4) verdict = "no";
  else if (expected.returnPct >= 18 && cautious.best.perYear > 0) verdict = "strong";
  else if (expected.returnPct >= 10) verdict = "good";
  else verdict = "thin";
  // A buy that loses money in a slow year is never better than "thin".
  if (verdict === "good" && cautious.best.perYear < 0) verdict = "thin";

  return { expected, cautious, upside, verdict };
}

// ── Starting figures when nothing better is known ────────────────────────────

type ClassDefaults = {
  /** Value kept each year, by age at the start of the year (last entry repeats). */
  keep: number[];
  rentShare: number;
  dayShare: number;
  insuranceShare: number;
  maintenanceShare: number;
  taxShare: number;
  compulsoryShare: number;
  buyingShare: number;
  maxAge: number;
  fadeFrom: number;
};

const CLASS_DEFAULTS: Record<string, ClassDefaults> = {
  car: { keep: [0.82, 0.88, 0.9, 0.91, 0.92, 0.92, 0.93], rentShare: 0.028, dayShare: 0.0016, insuranceShare: 0.03, maintenanceShare: 0.025, taxShare: 0.003, compulsoryShare: 0.001, buyingShare: 0.01, maxAge: 10, fadeFrom: 4 },
  van: { keep: [0.83, 0.89, 0.91, 0.92, 0.92, 0.93], rentShare: 0.027, dayShare: 0.0016, insuranceShare: 0.03, maintenanceShare: 0.03, taxShare: 0.003, compulsoryShare: 0.001, buyingShare: 0.01, maxAge: 12, fadeFrom: 5 },
  scooter: { keep: [0.78, 0.85, 0.87, 0.88, 0.89, 0.9], rentShare: 0.055, dayShare: 0.004, insuranceShare: 0.02, maintenanceShare: 0.07, taxShare: 0.002, compulsoryShare: 0.006, buyingShare: 0.015, maxAge: 7, fadeFrom: 3 },
  motorcycle: { keep: [0.8, 0.86, 0.88, 0.89, 0.9, 0.9], rentShare: 0.045, dayShare: 0.0035, insuranceShare: 0.03, maintenanceShare: 0.06, taxShare: 0.002, compulsoryShare: 0.004, buyingShare: 0.015, maxAge: 8, fadeFrom: 3 },
  atv: { keep: [0.78, 0.84, 0.86, 0.88, 0.88], rentShare: 0.05, dayShare: 0.005, insuranceShare: 0.02, maintenanceShare: 0.09, taxShare: 0, compulsoryShare: 0, buyingShare: 0.01, maxAge: 7, fadeFrom: 3 },
  ebike: { keep: [0.7, 0.78, 0.8, 0.82, 0.82], rentShare: 0.06, dayShare: 0.006, insuranceShare: 0.01, maintenanceShare: 0.08, taxShare: 0, compulsoryShare: 0, buyingShare: 0.005, maxAge: 5, fadeFrom: 2 }
};

/** What it will sell for after each year owned (percent of the price paid), from how this kind of vehicle usually loses value. */
export function defaultResaleCurve(category: string, ageNow: number) {
  const d = CLASS_DEFAULTS[category] || CLASS_DEFAULTS.car;
  const curve: number[] = [];
  // A used vehicle bought at a dealer's price sells back for a little less straight away.
  let value = ageNow > 0 ? 95 : 100;
  for (let year = 0; year < 10; year++) {
    const age = ageNow + year;
    value *= d.keep[Math.min(age, d.keep.length - 1)];
    curve.push(Math.round(value * 10) / 10);
  }
  return curve;
}

/** A flat "loses X% a year" curve, for when the operator sets the rate themselves. */
export function flatResaleCurve(lossPct: number) {
  const keep = 1 - clamp(lossPct, 0, 60) / 100;
  return Array.from({ length: 10 }, (_, index) => Math.round(Math.pow(keep, index + 1) * 1000) / 10);
}

/** The average yearly loss of value a curve implies over the given number of years. */
export function yearlyLossPct(curve: number[], years: number) {
  const at = clamp(resaleAt(curve, Math.max(1, years)), 1, 130) / 100;
  return Math.round((1 - Math.pow(at, 1 / Math.max(1, years))) * 1000) / 10;
}

export type Research = {
  rent_month_low?: number;
  rent_month_typical?: number;
  rent_month_high?: number;
  rent_day_low?: number;
  rent_day_typical?: number;
  rent_day_high?: number;
  rent_week_low?: number;
  rent_week_typical?: number;
  rent_week_high?: number;
  /** The believable local prices found, by the day, week and month. */
  rates?: import("@/lib/rate-range").RateRanges;
  rent_quotes?: import("@/lib/rate-range").RateQuote[];
  occupancy_long?: number;
  occupancy_short?: number;
  insurance_year?: number;
  compulsory_year?: number;
  tax_year?: number;
  maintenance_year?: number;
  maintenance_growth_pct?: number;
  buying_costs?: number;
  resale_pct_by_year?: number[];
  rent_fade_from_age?: number;
  rent_fade_pct?: number;
  max_rental_age?: number;
  market_price_low?: number;
  market_price_high?: number;
  notes?: string[];
  confidence?: string;
};

/** Days a month a day-rate vehicle earns when it is never idle. */
const DAYS = 30;

/**
 * Turns research (or nothing) into a full set of figures. Anything the research
 * did not give, or gave as nonsense, falls back to the usual share of the price
 * for that kind of vehicle.
 */
export function buildAssumptions(input: {
  category: string;
  price: number;
  ageNow: number;
  style: RentStyle;
  financed: boolean;
  downPayment: number;
  monthlyPayment: number;
  loanMonths: number;
  research?: Research | null;
}): Assumptions {
  const d = CLASS_DEFAULTS[input.category] || CLASS_DEFAULTS.car;
  const r = input.research || {};
  const price = Math.max(0, input.price);
  const positive = (value: unknown, fallback: number) => (num(value) > 0 ? num(value) : fallback);

  const month = positive(r.rent_month_typical, price * d.rentShare);
  const monthLow = positive(r.rent_month_low, month * 0.85);
  const monthHigh = positive(r.rent_month_high, month * 1.15);
  const day = positive(r.rent_day_typical, price * d.dayShare);
  const dayLow = positive(r.rent_day_low, day * 0.8);
  const dayHigh = positive(r.rent_day_high, day * 1.25);
  // A share sometimes comes back as 0.8 rather than 80.
  const percent = (value: unknown, fallback: number) => {
    const given = positive(value, fallback);
    return given <= 1 ? given * 100 : given;
  };
  const occLong = clamp(percent(r.occupancy_long, 80), 20, 98);
  const occShort = clamp(percent(r.occupancy_short, 50), 10, 95);

  const blend = (monthly: number, daily: number) =>
    input.style === "monthly" ? monthly : input.style === "daily" ? daily : (monthly + daily) / 2;

  const occupancy = blend(occLong, occShort);
  const given = Array.isArray(r.resale_pct_by_year) ? r.resale_pct_by_year.map((v) => num(v)) : [];
  const asPercent = given.length > 0 && given.every((v) => v <= 1.3) ? given.map((v) => v * 100) : given;
  const curve = asPercent.length >= 3 && asPercent.every((v) => v > 0 && v <= 130) ? asPercent : defaultResaleCurve(input.category, input.ageNow);

  return {
    price,
    // Transfer and registration fees are left out: small next to the price, and the owner asked for them not to be counted.
    buyingCosts: 0,
    financed: input.financed,
    downPayment: input.downPayment,
    monthlyPayment: input.monthlyPayment,
    loanMonths: input.loanMonths,
    ageNow: input.ageNow,
    rentMonthly: Math.round(blend(month, day * DAYS)),
    rentLow: Math.round(blend(monthLow, dayLow * DAYS)),
    rentHigh: Math.round(blend(monthHigh, dayHigh * DAYS)),
    occupancy: Math.round(occupancy),
    occupancyLow: Math.round(occupancy * 0.8),
    occupancyHigh: Math.round(Math.min(98, occupancy * 1.12)),
    rentFadeFromAge: clamp(positive(r.rent_fade_from_age, d.fadeFrom), 1, 15),
    rentFadePct: clamp(positive(r.rent_fade_pct, 4), 0, 20),
    insurance: Math.round(positive(r.insurance_year, price * d.insuranceShare)),
    compulsory: Math.round(r.compulsory_year !== undefined && num(r.compulsory_year) >= 0 ? num(r.compulsory_year) : price * d.compulsoryShare),
    tax: Math.round(r.tax_year !== undefined && num(r.tax_year) >= 0 ? num(r.tax_year) : price * d.taxShare),
    maintenance: Math.round(positive(r.maintenance_year, price * d.maintenanceShare)),
    maintenanceGrowthPct: clamp(positive(r.maintenance_growth_pct, 12), 0, 40),
    otherMonthly: 0,
    resalePct: curve,
    maxRentalAge: clamp(positive(r.max_rental_age, d.maxAge), input.ageNow + 1, 20)
  };
}
