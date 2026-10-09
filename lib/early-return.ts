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
    if (length <= 0 || unused <= 0) return;
    unusedDays += unused;
    periodDays += length;
    paid += Number(payment.amount || 0);
    amount += (Number(payment.amount || 0) * Math.min(unused, length)) / length;
  });

  const rounded = Math.round(amount / 10) * 10;
  return rounded > 0 ? { amount: rounded, unusedDays, periodDays, paid } : null;
}
