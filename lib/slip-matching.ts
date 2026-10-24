/**
 * A customer sends a transfer slip without saying what it is for. The amount on the slip picks the
 * payment: the one it pays exactly (earliest due first), or everything due together when it pays the
 * total. Nothing matches: no guess, the customer picks. Client-safe (no server imports).
 */

export type SlipCandidate = { id: string; amount: number; dueDate: string; receiptSentAt: string | null };
export type SlipBundle = { ids: string[]; amount: number } | null;
export type SlipMatch = { paymentId: string; covers: string[]; amount: number; exact: boolean } | null;

const same = (a: number, b: number) => Math.abs(a - b) <= 1;

export function matchSlip(amount: number | null, payments: SlipCandidate[], bundle: SlipBundle): SlipMatch {
  if (!amount) return null;
  // Not yet sent a receipt for, earliest due first; then the rest (a slip can replace one sent before).
  const order = [...payments].sort((a, b) => Number(Boolean(a.receiptSentAt)) - Number(Boolean(b.receiptSentAt)) || a.dueDate.localeCompare(b.dueDate));
  const single = order.find((payment) => same(payment.amount, amount));
  if (single) return { paymentId: single.id, covers: [], amount: single.amount, exact: true };
  if (bundle && same(bundle.amount, amount)) return { paymentId: bundle.ids[0], covers: bundle.ids, amount: bundle.amount, exact: true };
  // The first few unpaid ones together (rent and a deposit sent in one transfer, without a bundle being offered).
  const open = order.filter((payment) => !payment.receiptSentAt);
  let running = 0;
  for (let index = 0; index < Math.min(open.length, 4); index += 1) {
    running += open[index].amount;
    if (index > 0 && same(running, amount)) {
      const ids = open.slice(0, index + 1).map((payment) => payment.id);
      return { paymentId: ids[0], covers: ids, amount: running, exact: true };
    }
  }
  return null;
}
