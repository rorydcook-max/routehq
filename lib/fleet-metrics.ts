import { businessToday } from "@/lib/business-time";
import { isExpenseTransaction, isRevenueTransaction } from "@/lib/transaction-options";

/**
 * Per-vehicle figures worked out from the records themselves. The vehicles
 * table has revenue/profit/utilisation/health columns, but nothing ever kept
 * them up to date, so every car showed 0% and ฿0.
 */

const DAY = 86_400_000;

function toDay(value: string) {
  return Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
}

function overlapDays(start: number, end: number, windowStart: number, windowEnd: number) {
  const from = Math.max(start, windowStart);
  const to = Math.min(end, windowEnd);
  return to >= from ? Math.round((to - from) / DAY) + 1 : 0;
}

export type ComplianceItem = { key: string; label: string; date: string; daysLeft: number };

export type VehicleFigures = {
  revenue: number;
  expenses: number;
  profit: number;
  utilization12: number;
  utilizationLifetime: number;
  compliance: ComplianceItem[];
  healthScore: number;
};

const COMPLIANCE_LABELS: Record<string, string> = {
  tax_expiry_date: "Road tax",
  porbor_expiry_date: "Compulsory insurance",
  insurance_expiry_date: "Insurance",
  next_service_date: "Service"
};

export function complianceItems(metadata: any, today = businessToday()): ComplianceItem[] {
  const compliance = metadata?.compliance || {};
  return Object.entries(COMPLIANCE_LABELS)
    .map(([key, label]) => {
      const date = String(compliance[key] || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return { key, label, date, daysLeft: Math.round((toDay(date) - toDay(today)) / DAY) };
    })
    .filter((item): item is ComplianceItem => Boolean(item))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Loads what computeVehicleFigures needs for a whole business. */
export async function loadFleetFigures(supabase: any, organizationId: string) {
  const [vehicles, rentals, transactions] = await Promise.all([
    supabase.from("vehicles").select("id, purchase_date, created_at, metadata").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("rentals").select("vehicle_id, status, start_date, end_date").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("transactions").select("vehicle_id, amount, type, is_deposit, voided").eq("organization_id", organizationId).is("deleted_at", null)
  ]);
  const error = vehicles.error || rentals.error || transactions.error;
  if (error) throw new Error(error.message);
  return computeVehicleFigures({ vehicles: vehicles.data || [], rentals: rentals.data || [], transactions: transactions.data || [] });
}

export function computeVehicleFigures(input: {
  vehicles: any[];
  rentals: any[];
  transactions: any[];
}): Map<string, VehicleFigures> {
  const today = businessToday();
  const todayMs = toDay(today);
  const yearAgo = todayMs - 364 * DAY;
  const figures = new Map<string, VehicleFigures>();

  for (const vehicle of input.vehicles) {
    const vehicleTransactions = input.transactions.filter((row) => row.vehicle_id === vehicle.id && !row.voided);
    const revenue = vehicleTransactions
      .filter((row) => isRevenueTransaction({ amount: Number(row.amount || 0), isDeposit: row.is_deposit, type: row.type }))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const expenses = vehicleTransactions
      .filter((row) => isExpenseTransaction({ isDeposit: row.is_deposit, type: row.type }))
      .reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);

    const rentalSpans = input.rentals
      .filter((row) => row.vehicle_id === vehicle.id && !["cancelled", "booked"].includes(String(row.status || "")) && row.start_date)
      .map((row) => {
        const start = toDay(String(row.start_date).slice(0, 10));
        const end = row.end_date && String(row.end_date).slice(0, 10) < today ? toDay(String(row.end_date).slice(0, 10)) : todayMs;
        return { start: Math.min(start, todayMs), end };
      });

    const ownedSince = [vehicle.purchase_date, vehicle.created_at]
      .map((value) => String(value || "").slice(0, 10))
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
      .map(toDay)
      .concat(rentalSpans.map((span) => span.start))
      .reduce((earliest, value) => Math.min(earliest, value), todayMs);

    const windowStart = Math.max(yearAgo, ownedSince);
    const windowDays = Math.max(1, Math.round((todayMs - windowStart) / DAY) + 1);
    const lifetimeDays = Math.max(1, Math.round((todayMs - ownedSince) / DAY) + 1);
    const rented12 = rentalSpans.reduce((sum, span) => sum + overlapDays(span.start, span.end, windowStart, todayMs), 0);
    const rentedLifetime = rentalSpans.reduce((sum, span) => sum + overlapDays(span.start, span.end, ownedSince, todayMs), 0);

    const compliance = complianceItems(vehicle.metadata, today);
    // Health reflects paperwork: anything expired costs a lot, anything due within 30 days a little.
    const healthScore = Math.max(
      0,
      100 -
        compliance.filter((item) => item.daysLeft < 0).length * 35 -
        compliance.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 30).length * 10
    );

    figures.set(vehicle.id, {
      revenue,
      expenses,
      profit: revenue - expenses,
      utilization12: Math.min(100, Math.round((rented12 / windowDays) * 100)),
      utilizationLifetime: Math.min(100, Math.round((rentedLifetime / lifetimeDays) * 100)),
      compliance,
      healthScore
    });
  }

  return figures;
}
