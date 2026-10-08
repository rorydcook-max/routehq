/**
 * Rental prices collected from many places (shop price lists, Facebook posts,
 * classifieds, guides) always include a few that are not real: a chain's airport
 * price, a misread page, a "from ฿99" teaser. This keeps the believable ones and
 * gives the lowest, highest and average of those.
 */
export type RateQuote = { period: "day" | "week" | "month"; price: number; where?: string };
export type RateRange = { low: number; high: number; average: number; count: number; dropped: number };
export type RateRanges = Partial<Record<RateQuote["period"], RateRange>>;

const PERIODS: RateQuote["period"][] = ["day", "week", "month"];

function quantile(sorted: number[], q: number) {
  const at = (sorted.length - 1) * q;
  const below = Math.floor(at);
  const above = Math.ceil(at);
  return sorted[below] + (sorted[above] - sorted[below]) * (at - below);
}

/** Lowest, highest and average of the believable prices, or null when too few were found to say. */
export function rateRange(prices: number[]): RateRange | null {
  const all = prices.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (all.length < 2) return null;
  const median = quantile(all, 0.5);
  // Far from the middle price is not a real local price, whatever the source.
  let kept = all.filter((value) => value >= median / 2.5 && value <= median * 2.5);
  if (kept.length >= 4) {
    const q1 = quantile(kept, 0.25);
    const q3 = quantile(kept, 0.75);
    const spread = q3 - q1;
    kept = kept.filter((value) => value >= q1 - 1.5 * spread && value <= q3 + 1.5 * spread);
  }
  if (kept.length < 2) return null;
  const average = kept.reduce((sum, value) => sum + value, 0) / kept.length;
  const round = (value: number) => Math.round(value / 10) * 10;
  return { low: round(kept[0]), high: round(kept[kept.length - 1]), average: round(average), count: kept.length, dropped: all.length - kept.length };
}

/** Accepts whatever the research gave back and sorts it into day, week and month. */
export function cleanQuotes(raw: unknown): RateQuote[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const quotes: RateQuote[] = [];
  for (const item of raw as any[]) {
    const period = String(item?.period || "").toLowerCase().replace(/ly$/, "").replace(/^dai$/, "day") as RateQuote["period"];
    const price = Math.round(Number(item?.price));
    if (!PERIODS.includes(period) || !(price > 0)) continue;
    const where = String(item?.where || item?.source || "").slice(0, 80);
    const key = `${period}|${price}|${where.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    quotes.push({ period, price, where });
  }
  return quotes.slice(0, 60);
}

/**
 * A week costs more than a couple of days and less than seven full days; a month
 * more than about eight days and less than thirty. A "weekly" price outside that,
 * next to the day prices found, is a day price filed under the wrong heading.
 */
const SPAN: Record<"week" | "month", [number, number]> = { week: [2.5, 7.5], month: [8, 32] };

export function rateRanges(quotes: RateQuote[]): RateRanges {
  const ranges: RateRanges = {};
  const day = rateRange(quotes.filter((quote) => quote.period === "day").map((quote) => quote.price));
  if (day) ranges.day = day;
  for (const period of ["week", "month"] as const) {
    let prices = quotes.filter((quote) => quote.period === period).map((quote) => quote.price);
    const found = prices.length;
    if (day) prices = prices.filter((price) => price >= day.low * SPAN[period][0] && price <= day.high * SPAN[period][1]);
    const range = rateRange(prices);
    if (range) ranges[period] = { ...range, dropped: range.dropped + (found - prices.length) };
  }
  return ranges;
}
