import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRawDepositTransaction, isRevenueTransaction } from "@/lib/transaction-options";

export type DatePreset = "this_month" | "last_month" | "last_3_months" | "last_6_months" | "this_year" | "last_year" | "custom";

export interface DateRange {
  from: string;
  to: string;
  preset: DatePreset;
  label: string;
}

export interface MonthlyDataPoint {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface VehicleExpenseBreakdown {
  type: string;
  label: string;
  amount: number;
}

export interface VehicleMetrics {
  id: string;
  label: string;
  plate: string;
  make: string;
  model: string;
  income: number;
  expenses: number;
  profit: number;
  transactionCount: number;
  rentalCount: number;
  avgDailyRate: number;
  utilizationRate: number;
  roi: number;
  purchasePrice: number;
  expenseBreakdown: VehicleExpenseBreakdown[];
}

export interface OutstandingBalance {
  customerId: string;
  customerName: string;
  phone: string;
  totalBalance: number;
  rentalCount: number;
  oldestDue: string | null;
}

export interface RecentTransaction {
  id: string;
  type: string;
  typeLabel: string;
  amount: number;
  date: string;
  vehicleLabel: string;
  customerName: string | null;
  notes: string | null;
  isIncome: boolean;
}

export interface RevenueByType {
  type: string;
  label: string;
  amount: number;
}

export interface DepositSummary {
  totalDepositsCurrentlyHeld: number;
  totalDepositsReceivedInPeriod: number;
  totalDepositsReturnedInPeriod: number;
  totalDepositsForfeitedInPeriod: number;
  netDepositLiability: number;
}

export interface ExpenseByType {
  type: string;
  label: string;
  amount: number;
}

export interface VehicleRentalRow {
  id: string;
  displayCode: string | null;
  customerName: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  balanceDue: number;
}

export interface VehicleTransactionRow {
  id: string;
  type: string;
  typeLabel: string;
  amount: number;
  date: string;
  notes: string | null;
  supplier: string | null;
  isIncome: boolean;
}

export interface VehicleReportData {
  vehicle: {
    id: string;
    label: string;
    plate: string;
    make: string;
    model: string;
    year: number | null;
    dailyRate: number;
    purchasePrice: number;
    estimatedValue: number;
    status: string;
  };
  dateRange: DateRange;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  utilizationRate: number;
  rentalDays: number;
  rentalCount: number;
  avgDailyRate: number;
  roi: number;
  monthlyData: MonthlyDataPoint[];
  expensesByType: ExpenseByType[];
  rentals: VehicleRentalRow[];
  transactions: VehicleTransactionRow[];
}

// Legacy types kept for backwards compat with any remaining consumers
export type VehicleProfitRow = {
  id: string;
  label: string;
  income: number;
  expenses: number;
  profit: number;
  transactionCount: number;
};

export type CategoryExpenseRow = {
  type: string;
  label: string;
  amount: number;
};

export interface ReportsData {
  dateRange: DateRange;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  revenuePrev: number;
  expensesPrev: number;
  profitPrev: number;
  revenueChange: number;
  expensesChange: number;
  profitChange: number;
  revenueByType: RevenueByType[];
  expensesByType: ExpenseByType[];
  depositSummary: DepositSummary;
  monthlyData: MonthlyDataPoint[];
  vehicleMetrics: VehicleMetrics[];
  outstandingBalances: OutstandingBalance[];
  recentTransactions: RecentTransaction[];
  // Legacy compat fields
  totalIncome: number;
  vehicleRows: VehicleProfitRow[];
  categoryRows: CategoryExpenseRow[];
  monthLabel: string;
}

const typeLabels: Record<string, string> = {
  rental_income: "Rental Income",
  deposit: "Deposit",
  deposit_received: "Deposit received",
  deposit_refunded: "Deposit refunded",
  deposit_forfeited: "Deposit forfeited (kept)",
  deposit_deduction: "Deposit deduction",
  repair: "Repair",
  servicing: "Servicing",
  maintenance: "Maintenance",
  fuel: "Fuel",
  insurance: "Insurance",
  tax: "Tax",
  finance: "Finance",
  fine: "Fine",
  accessories: "Accessories",
  refund: "Refund",
  other: "Other"
};

const expenseTypes = new Set(["repair", "servicing", "maintenance", "fuel", "insurance", "tax", "finance", "fine", "accessories", "refund", "other"]);

function txType(input: string | { type: string }) {
  return typeof input === "string" ? input : input.type;
}

function txIsDeposit(input: string | { is_deposit?: boolean | null; isDeposit?: boolean | null; type: string }) {
  return typeof input === "string" ? false : Boolean(input.is_deposit ?? input.isDeposit);
}

function isIncomeTx(input: string | { amount?: number | null; is_deposit?: boolean | null; isDeposit?: boolean | null; type: string }) {
  return isRevenueTransaction({
    amount: Math.abs(Number(typeof input === "string" ? 1 : input.amount ?? 1)),
    isDeposit: txIsDeposit(input),
    type: txType(input)
  });
}

function isExpenseTx(input: string | { is_deposit?: boolean | null; isDeposit?: boolean | null; type: string }) {
  const type = txType(input);
  return !isRawDepositTransaction({ isDeposit: txIsDeposit(input), type }) && expenseTypes.has(type);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function resolveDateRange(preset: DatePreset, customFrom?: string, customTo?: string): DateRange {
  const now = new Date();

  switch (preset) {
    case "this_month": {
      const from = fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const to = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const label = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleString("en", { month: "long", year: "numeric" });
      return { from, to, preset, label };
    }
    case "last_month": {
      const from = fmtDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const to = fmtDate(new Date(now.getFullYear(), now.getMonth(), 0));
      const label = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en", { month: "long", year: "numeric" });
      return { from, to, preset, label };
    }
    case "last_3_months": {
      const from = fmtDate(new Date(now.getFullYear(), now.getMonth() - 2, 1));
      const to = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { from, to, preset, label: "Last 3 Months" };
    }
    case "last_6_months": {
      const from = fmtDate(new Date(now.getFullYear(), now.getMonth() - 5, 1));
      const to = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      return { from, to, preset, label: "Last 6 Months" };
    }
    case "this_year": {
      const from = `${now.getFullYear()}-01-01`;
      const to = `${now.getFullYear()}-12-31`;
      return { from, to, preset, label: String(now.getFullYear()) };
    }
    case "last_year": {
      const from = `${now.getFullYear() - 1}-01-01`;
      const to = `${now.getFullYear() - 1}-12-31`;
      return { from, to, preset, label: String(now.getFullYear() - 1) };
    }
    case "custom": {
      const from = customFrom || fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const to = customTo || fmtDate(now);
      return { from, to, preset, label: `${from} – ${to}` };
    }
  }
}

function getPreviousPeriod(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const durationMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return { from: fmtDate(prevFrom), to: fmtDate(prevTo) };
}

function buildMonthlyData(transactions: any[], from: string, to: string): MonthlyDataPoint[] {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const months: Array<{ key: string; label: string; revenue: number; expenses: number; profit: number }> = [];

  const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  while (cursor <= toDate) {
    months.push({
      key: `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`,
      label: cursor.toLocaleString("en", { month: "short", year: "2-digit" }),
      revenue: 0,
      expenses: 0,
      profit: 0
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const byMonth = new Map(months.map((m) => [m.key, m]));

  for (const tx of transactions) {
    if (!tx.transaction_date) continue;
    const date = new Date(tx.transaction_date);
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    const entry = byMonth.get(key);
    if (!entry) continue;
    const amount = Math.abs(Number(tx.amount || 0));
    if (isIncomeTx(tx)) {
      entry.revenue += amount;
    } else if (isExpenseTx(tx)) {
      entry.expenses += amount;
    }
  }

  return months.map(({ key, ...m }) => ({ ...m, profit: m.revenue - m.expenses }));
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function vehicleLabel(v: any): string {
  return [v?.registration_number, v?.make, v?.model].filter(Boolean).join(" ");
}

export async function getReportsData(
  organizationId: string,
  presetOrMonth?: string,
  customFrom?: string,
  customTo?: string
): Promise<ReportsData> {
  // Support legacy "YYYY-MM" month format
  let preset: DatePreset = "this_month";
  let resolvedFrom = customFrom;
  let resolvedTo = customTo;

  if (presetOrMonth) {
    if (/^\d{4}-\d{2}$/.test(presetOrMonth)) {
      const [year, monthStr] = presetOrMonth.split("-").map(Number);
      resolvedFrom = `${year}-${pad(monthStr)}-01`;
      resolvedTo = `${year}-${pad(monthStr)}-${pad(new Date(year, monthStr, 0).getDate())}`;
      preset = "custom";
    } else {
      preset = presetOrMonth as DatePreset;
    }
  }

  const dateRange = resolveDateRange(preset, resolvedFrom, resolvedTo);
  const prevPeriod = getPreviousPeriod(dateRange.from, dateRange.to);

  const supabase = (await createSupabaseServerClient()) as any;

  const [txResult, prevTxResult, vehiclesResult, rentalsResult, outstandingResult, depositsHeldResult] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "*, vehicles!transactions_vehicle_id_fkey(registration_number, make, model, purchase_price, estimated_value), customers!transactions_customer_id_fkey(full_name)"
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("transaction_date", dateRange.from)
      .lte("transaction_date", dateRange.to)
      .order("transaction_date", { ascending: false }),

    supabase
      .from("transactions")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("transaction_date", prevPeriod.from)
      .lte("transaction_date", prevPeriod.to),

    supabase
      .from("vehicles")
      .select("id, registration_number, make, model, purchase_price, estimated_value, daily_rate, monthly_rate, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null),

    supabase
      .from("rentals")
      .select("id, vehicle_id, start_date, end_date, status, balance_due, daily_rate, customer_id, customers!rentals_customer_id_fkey(full_name, phone)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gte("start_date", dateRange.from)
      .lte("start_date", dateRange.to),

    supabase
      .from("rentals")
      .select("id, vehicle_id, start_date, end_date, balance_due, customer_id, customers!rentals_customer_id_fkey(full_name, phone)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .gt("balance_due", 0)
      .in("status", ["active", "due_soon", "overdue", "extended", "booked"]),

    supabase
      .from("rentals")
      .select("id, deposit_held, deposit_status, status")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .eq("status", "active")
      .eq("deposit_status", "received")
  ]);

  const transactions: any[] = txResult.data || [];
  const prevTransactions: any[] = prevTxResult.data || [];
  const vehicles: any[] = vehiclesResult.data || [];
  const rentals: any[] = rentalsResult.data || [];
  const outstandingRentals: any[] = outstandingResult.data || [];
  const depositsHeldRentals: any[] = depositsHeldResult.data || [];

  const vehicleMap = new Map(vehicles.map((v: any) => [v.id, v]));

  // Aggregate current period
  let totalRevenue = 0;
  let totalExpenses = 0;
  const revenueByTypeMap = new Map<string, number>();
  const expensesByTypeMap = new Map<string, number>();
  const vIncomeMap = new Map<string, number>();
  const vExpenseMap = new Map<string, number>();
  const vTxCountMap = new Map<string, number>();
  const vExpBreakMap = new Map<string, Map<string, number>>();

  for (const tx of transactions) {
    const amount = Math.abs(Number(tx.amount || 0));
    const type = tx.type as string;

    if (isIncomeTx(tx)) {
      totalRevenue += amount;
      revenueByTypeMap.set(type, (revenueByTypeMap.get(type) || 0) + amount);
    } else if (isExpenseTx(tx)) {
      totalExpenses += amount;
      expensesByTypeMap.set(type, (expensesByTypeMap.get(type) || 0) + amount);
    }

    if (tx.vehicle_id) {
      vTxCountMap.set(tx.vehicle_id, (vTxCountMap.get(tx.vehicle_id) || 0) + 1);
      if (isIncomeTx(tx)) {
        vIncomeMap.set(tx.vehicle_id, (vIncomeMap.get(tx.vehicle_id) || 0) + amount);
      } else if (isExpenseTx(tx)) {
        vExpenseMap.set(tx.vehicle_id, (vExpenseMap.get(tx.vehicle_id) || 0) + amount);
        if (!vExpBreakMap.has(tx.vehicle_id)) vExpBreakMap.set(tx.vehicle_id, new Map());
        const bd = vExpBreakMap.get(tx.vehicle_id)!;
        bd.set(type, (bd.get(type) || 0) + amount);
      }
    }
  }

  // Aggregate previous period
  let revenuePrev = 0;
  let expensesPrev = 0;
  for (const tx of prevTransactions) {
    const amount = Math.abs(Number(tx.amount || 0));
    if (isIncomeTx(tx)) revenuePrev += amount;
    else if (isExpenseTx(tx)) expensesPrev += amount;
  }
  const profitPrev = revenuePrev - expensesPrev;

  const revenueByType: RevenueByType[] = [...revenueByTypeMap.entries()]
    .map(([type, amount]) => ({ type, label: typeLabels[type] || type, amount }))
    .sort((a, b) => b.amount - a.amount);

  const expensesByType: ExpenseByType[] = [...expensesByTypeMap.entries()]
    .map(([type, amount]) => ({ type, label: typeLabels[type] || type, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Per-vehicle rental counts and utilization
  const vRentalCountMap = new Map<string, number>();
  const vRentalDaysMap = new Map<string, number>();

  const rangeDays = Math.max(1, Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000) + 1);

  for (const rental of rentals) {
    if (!rental.vehicle_id || rental.status === "cancelled") continue;
    vRentalCountMap.set(rental.vehicle_id, (vRentalCountMap.get(rental.vehicle_id) || 0) + 1);
    if (rental.start_date && rental.end_date) {
      const days = Math.max(1, Math.ceil((new Date(rental.end_date).getTime() - new Date(rental.start_date).getTime()) / 86400000) + 1);
      vRentalDaysMap.set(rental.vehicle_id, (vRentalDaysMap.get(rental.vehicle_id) || 0) + days);
    }
  }

  // Build per-vehicle metrics for vehicles that have transactions
  const vehicleIdsWithTx = new Set([...vIncomeMap.keys(), ...vExpenseMap.keys()]);

  const vehicleMetrics: VehicleMetrics[] = [...vehicleIdsWithTx]
    .map((vehicleId) => {
      const vehicle = vehicleMap.get(vehicleId);
      const income = vIncomeMap.get(vehicleId) || 0;
      const expenses = vExpenseMap.get(vehicleId) || 0;
      const profit = income - expenses;
      const rentalCount = vRentalCountMap.get(vehicleId) || 0;
      const rentalDays = vRentalDaysMap.get(vehicleId) || 0;
      const purchasePrice = Number(vehicle?.purchase_price || 0);
      const estimatedValue = Number(vehicle?.estimated_value || 0);
      const depreciation = Math.max(0, purchasePrice - estimatedValue);
      const roi = purchasePrice > 0 ? ((profit - depreciation) / purchasePrice) * 100 : 0;
      const avgDailyRate = rentalDays > 0 ? income / rentalDays : 0;
      const utilizationRate = Math.min(100, (rentalDays / rangeDays) * 100);

      const bd = vExpBreakMap.get(vehicleId) || new Map<string, number>();
      const expenseBreakdown: VehicleExpenseBreakdown[] = [...bd.entries()]
        .map(([type, amount]) => ({ type, label: typeLabels[type] || type, amount }))
        .sort((a, b) => b.amount - a.amount);

      return {
        id: vehicleId,
        label: vehicle ? vehicleLabel(vehicle) : vehicleId,
        plate: vehicle?.registration_number || "",
        make: vehicle?.make || "",
        model: vehicle?.model || "",
        income,
        expenses,
        profit,
        transactionCount: vTxCountMap.get(vehicleId) || 0,
        rentalCount,
        avgDailyRate,
        utilizationRate,
        roi,
        purchasePrice,
        expenseBreakdown
      };
    })
    .sort((a, b) => b.profit - a.profit);

  // Outstanding balances by customer
  const custBalMap = new Map<string, { name: string; phone: string; total: number; count: number; oldestDue: string | null }>();
  for (const rental of outstandingRentals) {
    if (!rental.customer_id) continue;
    const existing = custBalMap.get(rental.customer_id) || {
      name: rental.customers?.full_name || "Unknown",
      phone: rental.customers?.phone || "",
      total: 0,
      count: 0,
      oldestDue: null
    };
    existing.total += Number(rental.balance_due || 0);
    existing.count += 1;
    if (rental.end_date && (!existing.oldestDue || rental.end_date < existing.oldestDue)) {
      existing.oldestDue = rental.end_date;
    }
    custBalMap.set(rental.customer_id, existing);
  }

  const outstandingBalances: OutstandingBalance[] = [...custBalMap.entries()]
    .map(([customerId, data]) => ({
      customerId,
      customerName: data.name,
      phone: data.phone,
      totalBalance: data.total,
      rentalCount: data.count,
      oldestDue: data.oldestDue
    }))
    .sort((a, b) => b.totalBalance - a.totalBalance);

  const recentTransactions: RecentTransaction[] = transactions.slice(0, 20).map((tx: any) => ({
    id: tx.id,
    type: tx.type,
    typeLabel: typeLabels[tx.type] || tx.type,
    amount: Math.abs(Number(tx.amount || 0)),
    date: tx.transaction_date,
    vehicleLabel: tx.vehicles ? vehicleLabel(tx.vehicles) : "General",
    customerName: tx.customers?.full_name || null,
    notes: tx.notes,
    isIncome: isIncomeTx(tx)
  }));

  const monthlyData = buildMonthlyData(transactions, dateRange.from, dateRange.to);
  const netProfit = totalRevenue - totalExpenses;
  const totalDepositsCurrentlyHeld = depositsHeldRentals.reduce((sum, rental) => sum + Number(rental.deposit_held || 0), 0);
  const totalDepositsReceivedInPeriod = transactions
    .filter((tx) => tx.type === "deposit_received")
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);
  const totalDepositsReturnedInPeriod = transactions
    .filter((tx) => tx.type === "deposit_refunded")
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);
  const totalDepositsForfeitedInPeriod = transactions
    .filter((tx) => tx.type === "deposit_forfeited")
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount || 0)), 0);
  const depositSummary: DepositSummary = {
    totalDepositsCurrentlyHeld,
    totalDepositsReceivedInPeriod,
    totalDepositsReturnedInPeriod,
    totalDepositsForfeitedInPeriod,
    netDepositLiability: totalDepositsCurrentlyHeld
  };

  return {
    dateRange,
    totalRevenue,
    totalExpenses,
    netProfit,
    revenuePrev,
    expensesPrev,
    profitPrev,
    revenueChange: pctChange(totalRevenue, revenuePrev),
    expensesChange: pctChange(totalExpenses, expensesPrev),
    profitChange: pctChange(netProfit, profitPrev),
    revenueByType,
    expensesByType,
    depositSummary,
    monthlyData,
    vehicleMetrics,
    outstandingBalances,
    recentTransactions,
    // Legacy compat
    totalIncome: totalRevenue,
    vehicleRows: vehicleMetrics.map((v) => ({
      id: v.id,
      label: v.label,
      income: v.income,
      expenses: v.expenses,
      profit: v.profit,
      transactionCount: v.transactionCount
    })),
    categoryRows: expensesByType.map((e) => ({ type: e.type, label: e.label, amount: e.amount })),
    monthLabel: dateRange.label
  };
}

export async function getVehicleReportData(
  organizationId: string,
  vehicleId: string,
  presetOrMonth?: string,
  customFrom?: string,
  customTo?: string
): Promise<VehicleReportData> {
  let preset: DatePreset = "this_month";
  let resolvedFrom = customFrom;
  let resolvedTo = customTo;

  if (presetOrMonth) {
    if (/^\d{4}-\d{2}$/.test(presetOrMonth)) {
      const [year, monthStr] = presetOrMonth.split("-").map(Number);
      resolvedFrom = `${year}-${pad(monthStr)}-01`;
      resolvedTo = `${year}-${pad(monthStr)}-${pad(new Date(year, monthStr, 0).getDate())}`;
      preset = "custom";
    } else {
      preset = presetOrMonth as DatePreset;
    }
  }

  const dateRange = resolveDateRange(preset, resolvedFrom, resolvedTo);
  const supabase = (await createSupabaseServerClient()) as any;

  const [vehicleResult, txResult, rentalsResult] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, registration_number, make, model, year, daily_rate, purchase_price, estimated_value, status")
      .eq("id", vehicleId)
      .eq("organization_id", organizationId)
      .single(),

    supabase
      .from("transactions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null)
      .gte("transaction_date", dateRange.from)
      .lte("transaction_date", dateRange.to)
      .order("transaction_date", { ascending: false }),

    supabase
      .from("rentals")
      .select("id, display_code, start_date, end_date, status, balance_due, customers!rentals_customer_id_fkey(full_name)")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null)
      .gte("start_date", dateRange.from)
      .lte("start_date", dateRange.to)
      .order("start_date", { ascending: false })
  ]);

  const vehicle = vehicleResult.data;
  const transactions: any[] = txResult.data || [];
  const rentals: any[] = rentalsResult.data || [];

  let totalRevenue = 0;
  let totalExpenses = 0;
  const expensesByTypeMap = new Map<string, number>();

  for (const tx of transactions) {
    const amount = Math.abs(Number(tx.amount || 0));
    if (isIncomeTx(tx)) {
      totalRevenue += amount;
    } else if (isExpenseTx(tx)) {
      totalExpenses += amount;
      expensesByTypeMap.set(tx.type, (expensesByTypeMap.get(tx.type) || 0) + amount);
    }
  }

  const rangeDays = Math.max(1, Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000) + 1);

  let rentalDays = 0;
  for (const rental of rentals) {
    if (rental.status === "cancelled") continue;
    if (rental.start_date && rental.end_date) {
      const days = Math.max(1, Math.ceil((new Date(rental.end_date).getTime() - new Date(rental.start_date).getTime()) / 86400000) + 1);
      rentalDays += days;
    }
  }

  const rentalCount = rentals.filter((r: any) => r.status !== "cancelled").length;
  const purchasePrice = Number(vehicle?.purchase_price || 0);
  const estimatedValue = Number(vehicle?.estimated_value || 0);
  const depreciation = Math.max(0, purchasePrice - estimatedValue);
  const netProfit = totalRevenue - totalExpenses;
  const roi = purchasePrice > 0 ? ((netProfit - depreciation) / purchasePrice) * 100 : 0;
  const avgDailyRate = rentalDays > 0 ? totalRevenue / rentalDays : 0;
  const utilizationRate = Math.min(100, (rentalDays / rangeDays) * 100);

  const expensesByType: ExpenseByType[] = [...expensesByTypeMap.entries()]
    .map(([type, amount]) => ({ type, label: typeLabels[type] || type, amount }))
    .sort((a, b) => b.amount - a.amount);

  const monthlyData = buildMonthlyData(transactions, dateRange.from, dateRange.to);

  return {
    vehicle: {
      id: vehicleId,
      label: vehicle ? vehicleLabel(vehicle) : vehicleId,
      plate: vehicle?.registration_number || "",
      make: vehicle?.make || "",
      model: vehicle?.model || "",
      year: vehicle?.year || null,
      dailyRate: Number(vehicle?.daily_rate || 0),
      purchasePrice,
      estimatedValue,
      status: vehicle?.status || "unknown"
    },
    dateRange,
    totalRevenue,
    totalExpenses,
    netProfit,
    utilizationRate,
    rentalDays,
    rentalCount,
    avgDailyRate,
    roi,
    monthlyData,
    expensesByType,
    rentals: rentals.map((r: any) => ({
      id: r.id,
      displayCode: r.display_code,
      customerName: r.customers?.full_name || null,
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status,
      balanceDue: Number(r.balance_due || 0)
    })),
    transactions: transactions.map((tx: any) => ({
      id: tx.id,
      type: tx.type,
      typeLabel: typeLabels[tx.type] || tx.type,
      amount: Math.abs(Number(tx.amount || 0)),
      date: tx.transaction_date,
      notes: tx.notes,
      supplier: tx.supplier,
      isIncome: isIncomeTx(tx)
    }))
  };
}
