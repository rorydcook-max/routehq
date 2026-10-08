import { isExpenseTransaction, isRawDepositTransaction, isRevenueTransaction } from "@/lib/transaction-options";

/**
 * Vehicles owned by someone else and run by the business: each month, what the
 * vehicle brought in, what it cost, and the owner's share. The share is a
 * percentage either of the money in, or of the profit after the vehicle's costs.
 * Stored on the vehicle in metadata.partner.
 */
export type Partner = { name: string; phone: string; pct: number; basis: "income" | "profit" };

export function partnerOf(metadata: unknown): Partner | null {
  const raw = (metadata && typeof metadata === "object" ? (metadata as Record<string, any>).partner : null) || null;
  if (!raw || !String(raw.name || "").trim()) return null;
  const pct = Math.max(0, Math.min(100, Number(raw.pct) || 0));
  return { name: String(raw.name).trim().slice(0, 80), phone: String(raw.phone || "").slice(0, 30), pct, basis: raw.basis === "profit" ? "profit" : "income" };
}

export type StatementLine = { date: string; label: string; amount: number; kind: "in" | "out" };
export type VehicleStatement = {
  vehicleId: string;
  name: string;
  plate: string;
  income: number;
  costs: number;
  profit: number;
  share: number;
  partner: Partner;
  lines: StatementLine[];
};

/** Works out each partner-owned vehicle's month from its money in and out. */
export function buildStatements(
  vehicles: Array<{ id: string; make: string; model: string; registration_number: string | null; metadata: unknown }>,
  transactions: Array<{ vehicle_id: string | null; type: string; amount: unknown; is_deposit?: boolean | null; voided?: boolean | null; transaction_date: string; notes?: string | null }>,
  typeLabel: (type: string) => string
): VehicleStatement[] {
  const result: VehicleStatement[] = [];
  for (const vehicle of vehicles) {
    const partner = partnerOf(vehicle.metadata);
    if (!partner) continue;
    let income = 0;
    let costs = 0;
    const lines: StatementLine[] = [];
    for (const row of transactions) {
      if (row.vehicle_id !== vehicle.id || row.voided) continue;
      if (isRawDepositTransaction({ isDeposit: row.is_deposit, type: row.type })) continue;
      const amount = Math.abs(Number(row.amount || 0));
      if (row.type === "refund") {
        // Rent paid back comes off what the vehicle brought in.
        income -= amount;
        lines.push({ date: row.transaction_date, label: typeLabel(row.type), amount: -amount, kind: "in" });
      } else if (isRevenueTransaction({ amount, isDeposit: row.is_deposit, type: row.type })) {
        income += amount;
        lines.push({ date: row.transaction_date, label: typeLabel(row.type), amount, kind: "in" });
      } else if (isExpenseTransaction({ isDeposit: row.is_deposit, type: row.type })) {
        costs += amount;
        lines.push({ date: row.transaction_date, label: typeLabel(row.type), amount, kind: "out" });
      }
    }
    const profit = income - costs;
    const base = partner.basis === "profit" ? Math.max(0, profit) : income;
    result.push({
      vehicleId: vehicle.id,
      name: `${vehicle.make} ${vehicle.model}`.trim(),
      plate: vehicle.registration_number || "",
      income,
      costs,
      profit,
      share: Math.round((base * partner.pct) / 100),
      partner,
      lines: lines.sort((a, b) => a.date.localeCompare(b.date))
    });
  }
  return result;
}
