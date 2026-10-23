/**
 * A vehicle handed back before the time already paid for runs out. Whether to
 * refund anything is the owner's decision; this works out the pro-rata figure
 * to suggest: for each paid rent payment, the share of its period that falls
 * after the return day.
 */

export type EarlyReturn = {
  /** Suggested refund, rounded to the nearest 10. */
  amount: number;
  unusedDays: number;
  /** Days in the paid period(s) the unused days belong to. */
  periodDays: number;
  /** Rent paid for those periods. */
  paid: number;
  /** Still owed on the booking at the time of the return, to net off. */
  owed?: number;
};

const day = (value: unknown) => String(value || "").slice(0, 10);

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addInterval(iso: string, interval: string) {
  if (interval === "weekly") return addDays(iso, 7);
  if (interval === "daily") return addDays(iso, 1);
  const date = new Date(`${iso}T00:00:00Z`);
  const dayOfMonth = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + 1);
  // 31 Jan + 1 month is the end of February, not 3 March.
  if (date.getUTCDate() !== dayOfMonth) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

const isDeposit = (payment: any) => payment.metadata?.is_deposit === true || ["deposit", "deposit_top_up"].includes(String(payment.metadata?.type || ""));

/**
 * `payments` is every payment on the rental (any status). `previousEnd` is the
 * return date the rental had before the vehicle came back, if it had one.
 */
export function earlyReturnSuggestion(input: { payments: any[]; returnDate: string; previousEnd: string | null; interval: string }): EarlyReturn | null {
  const { returnDate, previousEnd } = input;
  const interval = String(input.interval || "monthly").toLowerCase();
  const rent = input.payments.filter((payment) => !isDeposit(payment) && payment.due_date).sort((a, b) => day(a.due_date).localeCompare(day(b.due_date)));
  // The return day itself counts as used.
  const usedUntil = addDays(returnDate, 1);

  let unusedDays = 0;
  let periodDays = 0;
  let paid = 0;
  let amount = 0;
  rent.forEach((payment, index) => {
    if (!["paid", "reconciled"].includes(String(payment.status))) return;
    const share = unusedShare(rent, index, usedUntil, previousEnd, interval);
    if (!share) return;
    unusedDays += share.unused;
    periodDays += share.length;
    paid += Number(payment.amount || 0);
    amount += share.amount;
  });

  const rounded = Math.round(amount / 10) * 10;
  return rounded > 0 ? { amount: rounded, unusedDays, periodDays, paid } : null;
}

const OPEN = ["scheduled", "pending", "failed", "overdue"];

export type EarlyReturnOwed = {
  /** The part of the unpaid rent that is for days after the return: the sum of the shares, so exactly what is taken off. */
  amount: number;
  unusedDays: number;
  /** Each unpaid payment and the part of it for days after the return. */
  shares: Array<{ id: string; share: number }>;
};

/**
 * Back early with rent not yet paid: how much of what is owed is for days after the return. Like a refund, taking
 * it off is the owner's decision; this is the figure to offer.
 */
export function earlyReturnOwed(input: { payments: any[]; returnDate: string; previousEnd: string | null; interval: string }): EarlyReturnOwed | null {
  const interval = String(input.interval || "monthly").toLowerCase();
  const rent = input.payments.filter((payment) => !isDeposit(payment) && payment.due_date).sort((a, b) => day(a.due_date).localeCompare(day(b.due_date)));
  const usedUntil = addDays(input.returnDate, 1);
  let unusedDays = 0;
  let amount = 0;
  const shares: EarlyReturnOwed["shares"] = [];
  rent.forEach((payment, index) => {
    if (!OPEN.includes(String(payment.status)) || payment.voided === true) return;
    const share = unusedShare(rent, index, usedUntil, input.previousEnd, interval);
    if (!share || share.amount <= 0) return;
    unusedDays = Math.max(unusedDays, share.unused);
    shares.push({ id: String(payment.id), share: Math.round(share.amount) });
  });
  // The figure offered is exactly what "Take it off" takes: the sum of the per-payment shares (not rounded to 10,
  // which offered ฿40,070 and then took ฿40,074).
  amount = shares.reduce((sum, item) => sum + item.share, 0);
  return amount > 0 ? { amount, unusedDays, shares } : null;
}

/** For one rent payment: the days its period covers, how many fall after the return, and that share of the amount. */
function unusedShare(rent: any[], index: number, usedUntil: string, previousEnd: string | null, interval: string) {
  {
    const payment = rent[index];
    const metadata = payment.metadata || {};
    let periodStart = day(payment.due_date);
    let periodEnd: string;
    if (metadata.type === "extension" && metadata.previous_end_date && metadata.new_end_date) {
      periodStart = day(metadata.previous_end_date);
      periodEnd = day(metadata.new_end_date);
    } else {
      // The period runs to the next rent payment, or to where the first extension took over, whichever comes first.
      // Cancelled payments mark nothing.
      const live = (row: any) => !row.voided && !["voided", "waived", "cancelled"].includes(String(row.status));
      const next = rent.slice(index + 1).find((row) => live(row) && row.metadata?.type !== "extension" && day(row.due_date) > periodStart);
      const extendedFrom = rent
        .filter((row) => row.metadata?.type === "extension" && row.metadata?.previous_end_date && day(row.metadata.previous_end_date) > periodStart)
        .map((row) => day(row.metadata.previous_end_date))
        .sort()[0];
      const ends = [next ? day(next.due_date) : "", extendedFrom || ""].filter(Boolean).sort();
      periodEnd = ends[0] || (previousEnd && previousEnd > periodStart ? previousEnd : addInterval(periodStart, interval));
    }
    const length = daysBetween(periodStart, periodEnd);
    const unused = daysBetween(usedUntil > periodStart ? usedUntil : periodStart, periodEnd);
    if (length <= 0 || unused <= 0) return null;
    return { length, unused: Math.min(unused, length), amount: (Number(payment.amount || 0) * Math.min(unused, length)) / length };
  }
}
