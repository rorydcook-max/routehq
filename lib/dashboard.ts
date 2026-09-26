import { customers as seedCustomers, reminders as seedReminders, rentals as seedRentals, timeline as seedTimeline, transactions as seedTransactions, vehicles as seedVehicles } from "@/lib/data";
import { calculateDashboardMetrics } from "@/lib/metrics";
import type { Customer, Reminder, Rental, TimelineEvent, Transaction, Vehicle, VehicleStatus } from "@/lib/types";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultOrganization } from "@/lib/organization";

type DashboardMetrics = ReturnType<typeof calculateDashboardMetrics> & {
  depositsHeld: number;
  depositsHeldCount: number;
};

export type DashboardData = {
  organizationId: string | null;
  vehicles: Vehicle[];
  rentals: Rental[];
  customers: Customer[];
  transactions: Transaction[];
  reminders: Reminder[];
  timeline: TimelineEvent[];
  metrics: DashboardMetrics;
};

const vehicleStatusMap: Record<string, VehicleStatus> = {
  available: "Available",
  rented: "Rented",
  maintenance: "Maintenance",
  reserved: "Reserved",
  inactive: "Maintenance",
  retired: "Maintenance"
};

const rentalStatusMap: Record<string, Rental["status"]> = {
  active: "Active",
  booked: "Booked",
  due_soon: "Due Soon",
  overdue: "Overdue",
  extended: "Active"
};

const transactionTypeMap: Record<string, Transaction["type"]> = {
  rental_income: "Rental Income",
  deposit: "Deposit",
  deposit_received: "Deposit received",
  deposit_refunded: "Deposit refunded",
  deposit_forfeited: "Deposit forfeited (kept)",
  deposit_deduction: "Deposit deduction",
  refund: "Refund",
  repair: "Repair",
  maintenance: "Maintenance",
  fuel: "Fuel",
  insurance: "Insurance",
  tax: "Tax",
  fine: "Fine",
  accessories: "Accessories",
  finance: "Finance Payment",
  servicing: "Maintenance",
  other: "Rental Income"
};

const reminderTypeMap: Record<string, Reminder["type"]> = {
  payment: "Payment",
  compliance: "Compliance",
  maintenance: "Maintenance",
  rental: "Rental"
};

const severityMap: Record<string, Reminder["severity"]> = {
  high: "High",
  medium: "Medium",
  low: "Low"
};

export async function getDashboardData(): Promise<DashboardData> {
  if (!hasSupabaseEnv()) {
    return getSeedDashboardData();
  }

  const supabase = (await createSupabaseServerClient()) as any;
  const organization = await getDefaultOrganization();

  const organizationId = organization.id;
  const [vehiclesResult, customersResult, rentalsResult, transactionsResult, remindersResult, eventsResult] = await Promise.all([
    supabase.from("vehicles").select("*").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: true }),
    supabase.from("customers").select("*").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: true }),
    supabase
      .from("rentals")
      .select("*, customers!rentals_customer_id_fkey(full_name), vehicles!rentals_vehicle_id_fkey(make, model, registration_number)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
    supabase
      .from("transactions")
      .select("*, vehicles!transactions_vehicle_id_fkey(registration_number)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false }),
    supabase
      .from("reminders")
      .select("*, vehicles!reminders_vehicle_id_fkey(make, model, registration_number), customers!reminders_customer_id_fkey(full_name), rentals!reminders_rental_id_fkey(display_code, reference)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("due_date", { ascending: true }),
    supabase
      .from("activity_events")
      .select("*")
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: false })
      .limit(10)
  ]);

  const queryError = [vehiclesResult, customersResult, rentalsResult, transactionsResult, remindersResult, eventsResult].find((result) => result.error)?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  const vehicles: Vehicle[] = (vehiclesResult.data || []).map(mapVehicle).sort((a: Vehicle, b: Vehicle) => b.profit - a.profit);
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const rentalRows = rentalsResult.data || [];
  const depositsHeldRows = rentalRows.filter((row: any) => {
    const status = String(row.status || "").toLowerCase();
    const depositStatus = String(row.deposit_status || "").toLowerCase();
    return status !== "completed" && status !== "cancelled" && depositStatus === "received";
  });
  const depositsHeld = depositsHeldRows.reduce((sum: number, row: any) => sum + Number(row.deposit_held || 0), 0);
  // The dashboard is about what's happening now: returned and cancelled bookings
  // used to be mapped to "Active"/"Booked" and showed up in today's schedule.
  const rentals: Rental[] = rentalRows
    .filter((row: any) => !["completed", "cancelled"].includes(String(row.status || "").toLowerCase()))
    .map(mapRental);
  const customers: Customer[] = (customersResult.data || []).map(mapCustomer);
  const transactions: Transaction[] = (transactionsResult.data || []).map(mapTransaction);
  const reminders: Reminder[] = (remindersResult.data || []).map(mapReminder);
  const timeline: TimelineEvent[] = (eventsResult.data || []).map((event: any) => mapTimelineEvent(event, vehicleById));
  const metrics = calculateDashboardMetrics({ vehicles, rentals, transactions, reminders });

  return {
    organizationId,
    vehicles,
    rentals,
    customers,
    transactions,
    reminders,
    timeline,
    metrics: {
      ...metrics,
      depositsHeld,
      depositsHeldCount: depositsHeldRows.length
    }
  };
}

function getSeedDashboardData(): DashboardData {
  return {
    organizationId: null,
    vehicles: seedVehicles,
    rentals: seedRentals,
    customers: seedCustomers,
    transactions: seedTransactions,
    reminders: seedReminders,
    timeline: seedTimeline,
    metrics: {
      ...calculateDashboardMetrics({
        vehicles: seedVehicles,
        rentals: seedRentals,
        transactions: seedTransactions,
        reminders: seedReminders
      }),
      depositsHeld: 0,
      depositsHeldCount: 0
    }
  };
}

function mapVehicle(row: any): Vehicle {
  const compliance = row.metadata?.compliance || {};
  const finance = row.metadata?.finance || {};

  return {
    id: row.id,
    plate: row.registration_number,
    make: row.make,
    model: row.model,
    trim: row.trim || "",
    year: row.year || 0,
    color: row.color || "",
    status: vehicleStatusMap[row.status] || "Available",
    dailyRate: Number(row.daily_rate || 0),
    weeklyRate: Number(row.weekly_rate || 0),
    monthlyRate: Number(row.monthly_rate || 0),
    utilization: Number(row.utilization_12_month || 0),
    lifecycleUtilization: Number(row.utilization_lifecycle || 0),
    revenue: Number(row.revenue_generated || 0),
    profit: Number(row.profit_generated || 0),
    mileage: Number(row.mileage || 0),
    nextService: compliance.next_service_date || "",
    taxExpiry: compliance.tax_expiry_date || "",
    insuranceExpiry: compliance.insurance_expiry_date || compliance.porbor_expiry_date || "",
    financeDue: finance.end_date || "",
    healthScore: Number(row.health_score || 0),
    purchasePrice: Number(row.purchase_price || 0),
    estimatedValue: Number(row.estimated_value || 0)
  };
}

function mapRental(row: any): Rental {
  return {
    id: row.id,
    customer: row.customers?.full_name || "Unknown customer",
    vehicle: [row.vehicles?.make, row.vehicles?.model].filter(Boolean).join(" ") || "Unknown vehicle",
    plate: row.vehicles?.registration_number || "",
    start: row.start_date,
    end: row.end_date || "Indefinite",
    status: rentalStatusMap[row.status] || "Booked",
    location: row.delivery_location || "",
    balance: Number(row.balance_due || 0),
    deposit: Number(row.deposit_amount || 0),
    rentalRate: Number(row.rental_rate || 0)
  };
}

function mapCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.full_name,
    phone: row.phone || "",
    nationality: row.nationality || "",
    lifetimeValue: Number(row.lifetime_value || 0),
    documents: formatDocumentStatus(row.document_status),
    openBalance: Number(row.open_balance || 0)
  };
}

function mapTransaction(row: any): Transaction {
  return {
    id: row.id,
    type: transactionTypeMap[row.type] || "Rental Income",
    rawType: row.type,
    isDeposit: Boolean(row.is_deposit),
    vehicle: row.vehicles?.registration_number || "",
    amount: Number(row.amount || 0),
    date: row.transaction_date,
    note: row.notes || ""
  };
}

function mapReminder(row: any): Reminder {
  const target = row.vehicles
    ? `${row.vehicles.registration_number} ${row.vehicles.make} ${row.vehicles.model}`
    : row.customers?.full_name || row.rentals?.reference || row.rentals?.display_code || "";

  return {
    id: row.id,
    title: row.title,
    target,
    due: row.due_date,
    severity: severityMap[row.severity] || "Medium",
    type: reminderTypeMap[row.type] || "Payment"
  };
}

function formatDocumentStatus(status: string) {
  const labels: Record<string, string> = {
    complete: "Complete",
    no_documents: "No Documents",
    missing_license: "Missing License",
    missing_passport: "Missing Passport",
    missing_documents: "Missing Documents"
  };

  return labels[status] || status;
}

function mapTimelineEvent(row: any, vehicleById: Map<string, Vehicle>): TimelineEvent {
  return {
    id: row.id,
    vehicle: vehicleById.get(row.entity_id)?.plate || row.entity_type,
    title: row.title,
    date: row.occurred_at?.slice(0, 10) || row.created_at?.slice(0, 10) || "",
    detail: row.detail || ""
  };
}

export const money = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);
