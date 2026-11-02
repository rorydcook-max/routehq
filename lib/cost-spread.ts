/**
 * A cost paid once for a long stretch (a year of insurance, road tax) counts a share in each month it covers,
 * so a month's or a vehicle's costs show 1/12 of a yearly payment instead of all of it in the month it was paid
 * (Rory, 2 Nov 2026). The payment itself keeps its real date; only views by month or period use the shares.
 * A transaction carries the stretch in metadata.spread = { from, to } (YYYY-MM-DD, both days included).
 */

export type Spread = { from: string; to: string };

/** One month's part of a spread payment. */
export type Share = {
  /** The first day of the month, or the cover's first day in its first month. */
  date: string;
  amount: number;
  index: number;
  count: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The stretch a transaction covers, when it is spread and the dates make sense. */
export function spreadOf(transaction: { metadata?: any; spread?: Spread | null } | null | undefined): Spread | null {
  const raw = transaction?.spread ?? transaction?.metadata?.spread;
  if (!raw || typeof raw !== "object") return null;
  const from = String(raw.from || "").slice(0, 10);
  const to = String(raw.to || "").slice(0, 10);
  if (!DAY.test(from) || !DAY.test(to) || to <= from) return null;
  return { from, to };
}

function monthAdd(day: string, months: number) {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7)) - 1 + months;
  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * How many months the stretch covers, counted the way people pay: 15 Mar to 14 Mar next year is 12,
 * a 6-month policy is 6. Whole months by day count, never fewer than one.
 */
export function monthsCovered(spread: Spread) {
  const days = (Date.parse(`${spread.to}T00:00:00Z`) - Date.parse(`${spread.from}T00:00:00Z`)) / 86_400_000 + 1;
  return Math.max(1, Math.round(days / 30.4375));
}

/** The amount split evenly over the months covered, starting in the cover's first month; the last month takes the rounding. */
export function sharesOf(amount: number, spread: Spread): Share[] {
  const count = monthsCovered(spread);
  const total = Math.abs(Number(amount || 0));
  const each = Math.round((total / count) * 100) / 100;
  const shares: Share[] = [];
  for (let index = 0; index < count; index++) {
    const month = monthAdd(spread.from, index);
    shares.push({
      date: index === 0 ? spread.from : `${month}-01`,
      amount: index === count - 1 ? Math.round((total - each * (count - 1)) * 100) / 100 : each,
      index,
      count
    });
  }
  return shares;
}

/**
 * Swaps each spread transaction for its monthly shares (same fields, the share's date and amount), leaving the rest.
 * Each share keeps the original in `shareOf` so a view can say "share of ฿12,000 paid 15 Mar" and edit the real entry.
 * dateKey/amountKey/idKey name the fields, so it works for database rows and for the list's own shape.
 */
export function withShares<T extends Record<string, any>>(
  transactions: T[],
  keys: { date?: string; amount?: string; id?: string } = {}
): Array<T & { shareOf?: { id: string; amount: number; date: string; index: number; count: number; original: T } }> {
  const dateKey = keys.date || "transaction_date";
  const amountKey = keys.amount || "amount";
  const idKey = keys.id || "id";
  const out: Array<T & { shareOf?: any }> = [];
  for (const transaction of transactions) {
    const spread = spreadOf(transaction);
    if (!spread) {
      out.push(transaction);
      continue;
    }
    const sign = Number(transaction[amountKey] || 0) < 0 ? -1 : 1;
    for (const share of sharesOf(Number(transaction[amountKey] || 0), spread)) {
      out.push({
        ...transaction,
        [idKey]: `${transaction[idKey]}~${share.index}`,
        [dateKey]: share.date,
        [amountKey]: sign * share.amount,
        shareOf: {
          id: String(transaction[idKey]),
          amount: Number(transaction[amountKey] || 0),
          date: String(transaction[dateKey] || "").slice(0, 10),
          index: share.index,
          count: share.count,
          original: transaction
        }
      });
    }
  }
  return out;
}

/**
 * For a report between two days: the transactions paid in the range, with spread ones swapped for the shares
 * that fall in it, plus shares of spread payments made outside the range that cover part of it.
 * `spreadRows` are the spread transactions whose cover overlaps the range (loaded separately, any payment date).
 */
export function inRangeWithShares<T extends Record<string, any>>(paidInRange: T[], spreadRows: T[], from: string, to: string) {
  const seen = new Set<string>();
  const all: T[] = [];
  for (const row of [...paidInRange, ...spreadRows]) {
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    all.push(row);
  }
  // Newest first, as the queries return them.
  return withShares(all)
    .filter((row) => {
      const day = String(row.transaction_date || "").slice(0, 10);
      return day >= from && day <= to;
    })
    .sort((a, b) => String(b.transaction_date || "").localeCompare(String(a.transaction_date || "")));
}
