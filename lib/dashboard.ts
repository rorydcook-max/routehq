import { computeVehicleFigures, type VehicleFigures } from "@/lib/fleet-metrics";
import { customers as seedCustomers, reminders as seedReminders, rentals as seedRentals, timeline as seedTimeline, transactions as seedTransactions, vehicles as seedVehicles } from "@/lib/data";
import { calculateDashboardMetrics } from "@/lib/metrics";
import type { Customer, Reminder, Rental, TimelineEvent, Transaction, Vehicle, VehicleStatus } from "@/lib/types";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultOrganization } from "@/lib/organization";
import { businessToday } from "@/lib/business-time";
import { QUIET_ACTIVITY_EVENT_FILTER } from "@/lib/activity-noise";

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
      .not("event_type", "in", QUIET_ACTIVITY_EVENT_FILTER)
      .order("occurred_at", { ascending: false })
      .limit(10)
  ]);

  const queryError = [vehiclesResult, customersResult, rentalsResult, transactionsResult, remindersResult, eventsResult].find((result) => result.error)?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  // Overdue = unpaid payments whose due date has passed. A rental's whole
  // remaining balance (future rent, an extension due next month) is not overdue.
  const { data: latePayments } = await supabase
    .from("rental_payments")
    .select("rental_id, amount, due_date, status, metadata, voided")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", ["scheduled", "pending", "overdue"])
    .lt("due_date", businessToday());
  const overdueByRental = new Map<string, { amount: number; since: string }>();
  for (const payment of latePayments || []) {
    if (payment.voided || payment.metadata?.voided) continue;
    const current = overdueByRental.get(payment.rental_id) || { amount: 0, since: payment.due_date };
    current.amount += Number(payment.amount || 0);
    if (payment.due_date < current.since) current.since = payment.due_date;
    overdueByRental.set(payment.rental_id, current);
  }

  const rentalRows = rentalsResult.data || [];
  const figures = computeVehicleFigures({
    vehicles: vehiclesResult.data || [],
    rentals: rentalRows,
    transactions: transactionsResult.data || []
  });
  const vehicles: Vehicle[] = (vehiclesResult.data || [])
    .map((row: any) => mapVehicle(row, figures.get(row.id)))
    .sort((a: Vehicle, b: Vehicle) => b.profit - a.profit);
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  // A deposit is held from the moment it is received until it is handed back or
  // kept, whatever stage the booking is at: a finished or cancelled booking
  // whose deposit has not been settled yet is still money you are holding.
  const depositsHeldRows = rentalRows.filter((row: any) => String(row.deposit_status || "").toLowerCase() === "received" && Number(row.deposit_held || 0) > 0);
  const depositsHeld = depositsHeldRows.reduce((sum: number, row: any) => sum + Number(row.deposit_held || 0), 0);
  // The dashboard is about what's happening now: returned and cancelled bookings
  // used to be mapped to "Active"/"Booked" and showed up in today's schedule.
  const rentals: Rental[] = rentalRows
    .filter((row: any) => !["completed", "cancelled", "draft"].includes(String(row.status || "").toLowerCase()))
    .map((row: any) => {
      const late = overdueByRental.get(row.id);
      const held = String(row.deposit_status || "").toLowerCase() === "received" ? Number(row.deposit_held || 0) : 0;
      return { ...mapRental(row), overdue: late?.amount || 0, overdueSince: late?.since || null, depositHeld: held };
    });
  // A vehicle booked for next month is free today. "Booked" is kept for one whose booking starts today or has started.
  const todayDate = businessToday();
  for (const vehicle of vehicles) {
    if (vehicle.status !== "Reserved") continue;
    const starts = rentals.filter((rental) => rental.vehicleId === vehicle.id && rental.status === "Booked").map((rental) => String(rental.start || "").slice(0, 10)).sort();
    if (starts.length > 0 && starts[0] > todayDate) vehicle.freeUntil = starts[0];
  }
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

function mapVehicle(row: any, figures?: VehicleFigures): Vehicle {
  const compliance = row.metadata?.compliance || {};
  const finance = row.metadata?.finance || {};

  return {
    id: row.id,
    plate: row.registration_number,
    categoryId: row.category_id || null,
    make: row.make,
    model: row.model,
    trim: row.trim || "",
    year: row.year || 0,
    color: row.color || "",
    status: vehicleStatusMap[row.status] || "Available",
    dailyRate: Number(row.daily_rate || 0),
    weeklyRate: Number(row.weekly_rate || 0),
    monthlyRate: Number(row.monthly_rate || 0),
    utilization: figures ? figures.utilization12 : Number(row.utilization_12_month || 0),
    lifecycleUtilization: figures ? figures.utilizationLifetime : Number(row.utilization_lifecycle || 0),
    revenue: figures ? figures.revenue : Number(row.revenue_generated || 0),
    profit: figures ? figures.profit : Number(row.profit_generated || 0),
    mileage: Number(row.mileage || 0),
    nextService: compliance.next_service_date || "",
    taxExpiry: compliance.tax_expiry_date || "",
    insuranceExpiry: compliance.insurance_expiry_date || compliance.porbor_expiry_date || "",
    financeDue: finance.end_date || "",
    healthScore: figures ? figures.healthScore : Number(row.health_score || 0),
    purchasePrice: Number(row.purchase_price || 0),
    estimatedValue: Number(row.estimated_value || 0),
    complianceNext: figures?.compliance[0] || null,
    complianceAttentionCount: figures ? figures.compliance.filter((item) => item.daysLeft <= 30).length : 0,
    compliance: figures?.compliance || []
  };
}

function mapRental(row: any): Rental {
  return {
    id: row.id,
    vehicleId: row.vehicle_id || null,
    customer: row.customers?.full_name || "Unknown customer",
    hasCustomer: Boolean(row.customers?.full_name),
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
