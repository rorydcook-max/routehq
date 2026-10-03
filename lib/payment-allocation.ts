/**
 * Spreads one amount of money over scheduled payments. Used when a customer's
 * transfer isn't exactly one payment: it is short, it is too much, or it covers
 * several payments at once (rent and deposit together, say). The same function
 * builds the preview staff see and decides what gets recorded, so the two agree.
 */

export type OpenPayment = {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
};

export type AllocationLine = OpenPayment & {
  /** How much of the money goes to this payment. */
  paid: number;
  /** What is still owed on it afterwards. */
  stillDue: number;
  /** Money beyond what was owed anywhere, recorded on this payment. */
  extra: number;
  /** Not chosen by staff: leftover money was carried on to this payment. */
  carried: boolean;
};

const round = (value: number) => Math.round(value * 100) / 100;
const byDueDate = (a: OpenPayment, b: OpenPayment) => a.dueDate.localeCompare(b.dueDate);

/**
 * `chosen` are the payments the money is for, in the order they should be
 * settled. Anything left over goes to the rental's other open payments,
 * soonest first; if there are none, it is recorded as extra on the last line.
 * Differences under one baht are treated as paid in full.
 */
export function allocatePayment(received: number, chosen: OpenPayment[], others: OpenPayment[]): AllocationLine[] {
  let left = round(Math.max(0, received));
  const lines: AllocationLine[] = [];

  const take = (payment: OpenPayment, carried: boolean) => {
    const paid = round(Math.min(left, payment.amount));
    left = round(left - paid);
    let stillDue = round(payment.amount - paid);
    if (stillDue < 1) stillDue = 0;
    lines.push({ ...payment, paid, stillDue, extra: 0, carried });
  };

  for (const payment of chosen) take(payment, false);
  if (left >= 1) {
    for (const payment of [...others].sort(byDueDate)) {
      if (left < 1) break;
      take(payment, true);
    }
  }
  if (left > 0) {
    const last = [...lines].reverse().find((line) => line.paid > 0) || lines[0];
    if (last) {
      last.paid = round(last.paid + left);
      last.extra = left >= 1 ? left : 0;
    }
  }
  return lines;
}
