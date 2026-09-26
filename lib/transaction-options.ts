export const TRANSACTION_TYPE_OPTIONS = [
  { value: "rental_income", label: "Rental Income", category: "revenue" },
  { value: "deposit_received", label: "Deposit received", category: "deposit" },
  { value: "deposit_refunded", label: "Deposit refunded", category: "deposit" },
  { value: "deposit_forfeited", label: "Deposit forfeited (kept)", category: "revenue" },
  { value: "deposit_deduction", label: "Deposit deduction", category: "revenue" },
  { value: "deposit", label: "Deposit", category: "deposit" },
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
  { value: "other", label: "Other", category: "expense" }
] as const;

export function isIncomeTransactionType(type: string) {
  return type === "rental_income" || type === "Rental Income" || type === "deposit_forfeited" || type === "deposit_deduction" || type === "Deposit forfeited (kept)" || type === "Deposit deduction";
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
