import type { TableRow } from "@/lib/supabase/database.types";

export type VehicleProfitabilityInput = {
  vehicle: Pick<TableRow<"vehicles">, "id" | "purchase_price" | "estimated_value">;
  transactions: Array<Pick<TableRow<"transactions">, "vehicle_id" | "amount" | "type">>;
  rentals: Array<Pick<TableRow<"rentals">, "vehicle_id" | "start_date" | "end_date" | "status">>;
  analysisStart: Date;
  analysisEnd: Date;
};

export type VehicleProfitability = {
  revenue: number;
  expenses: number;
  netProfit: number;
  depreciation: number;
  roi: number | null;
  rentedDays: number;
  availableDays: number;
  utilizationRate: number;
};

export function calculateVehicleProfitability(input: VehicleProfitabilityInput): VehicleProfitability {
  const vehicleTransactions = input.transactions.filter((transaction) => transaction.vehicle_id === input.vehicle.id);
  const revenue = vehicleTransactions.filter((transaction) => transaction.amount > 0).reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const expenses = Math.abs(vehicleTransactions.filter((transaction) => transaction.amount < 0).reduce((sum, transaction) => sum + Number(transaction.amount), 0));
  const depreciation = Math.max(0, Number(input.vehicle.purchase_price || 0) - Number(input.vehicle.estimated_value || 0));
  const netProfit = revenue - expenses - depreciation;
  const purchasePrice = Number(input.vehicle.purchase_price || 0);
  const totalDays = daysBetween(input.analysisStart, input.analysisEnd);
  const rentedDays = input.rentals
    .filter((rental) => rental.vehicle_id === input.vehicle.id && !["cancelled", "draft"].includes(rental.status))
    .reduce((sum, rental) => sum + overlappingDays(input.analysisStart, input.analysisEnd, new Date(rental.start_date), rental.end_date ? new Date(rental.end_date) : input.analysisEnd), 0);

  return {
    revenue,
    expenses,
    netProfit,
    depreciation,
    roi: purchasePrice > 0 ? netProfit / purchasePrice : null,
    rentedDays,
    availableDays: Math.max(0, totalDays - rentedDays),
    utilizationRate: totalDays > 0 ? rentedDays / totalDays : 0
  };
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

function overlappingDays(windowStart: Date, windowEnd: Date, periodStart: Date, periodEnd: Date) {
  const start = new Date(Math.max(windowStart.getTime(), periodStart.getTime()));
  const end = new Date(Math.min(windowEnd.getTime(), periodEnd.getTime()));
  return daysBetween(start, end);
}
