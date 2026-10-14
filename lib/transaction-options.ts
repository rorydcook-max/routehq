export const TRANSACTION_TYPE_OPTIONS = [
  { value: "rental_income", label: "Rental Income", category: "revenue" },
  { value: "deposit_received", label: "Deposit received", category: "deposit" },
  { value: "deposit_refunded", label: "Deposit refunded", category: "deposit" },
  { value: "deposit_forfeited", label: "Deposit forfeited (kept)", category: "revenue" },
  { value: "deposit_deduction", label: "Deposit deduction", category: "revenue" },
  { value: "deposit", label: "Deposit", category: "deposit" },
  { value: "charge_recovered", label: "Charge paid by customer", category: "revenue" },
  { value: "refund", label: "Refund", category: "expense" },
  { value: "repair", label: "Repair", category: "expense" },
  { value: "servicing", label: "Servicing", category: "expense" },
  { value: "maintenance", label: "Maintenance", category: "expense" },
  { value: "fuel", label: "Fuel", category: "expense" },
  { value: "insurance", label: "Insurance", category: "expense" },
  { value: "tax", label: "Tax", category: "expense" },
  { value: "finance", label: "Finance", category: "expense" },
  { value: "fine", label: "Fine", category: "expense" },
  { value: "accessories", label: "Accessories", category: "expense" },
  { value: "finders_fee", label: "Finder's fee paid", category: "expense" },
  { value: "finders_fee_income", label: "Finder's fee received", category: "revenue" },
  { value: "other", label: "Other", category: "expense" }
] as const;

export function isIncomeTransactionType(type: string) {
  return type === "rental_income" || type === "Rental Income" || type === "charge_recovered" || type === "finders_fee_income" || type === "deposit_forfeited" || type === "deposit_deduction" || type === "Deposit forfeited (kept)" || type === "Deposit deduction";
}

export function isRawDepositTransaction({
  isDeposit,
  type
}: {
  isDeposit?: boolean | null;
  type: string;
}) {
  return Boolean(isDeposit) || type === "deposit" || type === "deposit_received" || type === "deposit_refunded";
}

/** Money going out of the business (repairs, fuel, insurance...). Stored as positive amounts; the type says it's a cost. */
export function isExpenseTransaction({ isDeposit, type }: { isDeposit?: boolean | null; type: string }) {
  return !isRawDepositTransaction({ isDeposit, type }) && !isIncomeTransactionType(type);
}

export function isRevenueTransaction({
  amount,
  isDeposit,
  type
}: {
  amount: number;
  isDeposit?: boolean | null;
  type: string;
}) {
  return amount > 0 && !isRawDepositTransaction({ isDeposit, type }) && isIncomeTransactionType(type);
}

/**
 * Money given back to a customer (not a deposit). It is recorded and listed as money out,
 * but it is not a cost of running the business: it comes off money in (Rory, Oct 2026).
 */
export function isRefundTransaction({ isDeposit, type }: { isDeposit?: boolean | null; type: string }) {
  return !isRawDepositTransaction({ isDeposit, type }) && (type === "refund" || type === "Refund");
}

/** A cost of running the business: money out that is not a refund. */
export function isRunningCost(input: { isDeposit?: boolean | null; type: string }) {
  return isExpenseTransaction(input) && !isRefundTransaction(input);
}

/** What a transaction adds to money in: income counts, a refund takes off, everything else is 0. */
export function moneyInAmount(input: { amount: number; isDeposit?: boolean | null; type: string }) {
  if (isRevenueTransaction(input)) return input.amount;
  if (isRefundTransaction(input)) return -Math.abs(input.amount);
  return 0;
}
