import { businessToday } from "@/lib/business-time";
import { getDashboardData } from "@/lib/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRunningCost, moneyInAmount } from "@/lib/transaction-options";
import type { AssistantRecords } from "@/lib/assistant-actions";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { countryCode } from "@/lib/country-paperwork";

const COUNTRY_NAMES: Record<string, string> = { TH: "Thailand", MY: "Malaysia", ID: "Indonesia", PH: "the Philippines", VN: "Vietnam" };

/** The business's money and country, so the answers aren't written for Thailand when the business is elsewhere. */
async function businessPlace() {
  try {
    const organization = (await getDefaultOrganization()) as any;
    const code = countryCode(organization.country_code || organization.settings?.main_location?.country);
    return { currency: String(organization.currency || "THB"), country: COUNTRY_NAMES[code] || (code ? code : "Thailand") };
  } catch {
    return { currency: "THB", country: "Thailand" };
  }
}

export type AskTurn = { role: "user" | "assistant"; content: string };

/** The records an action is checked against: real vehicles, customers and vehicle types. */
export async function assistantRecords(): Promise<AssistantRecords> {
  const [data, place] = await Promise.all([getDashboardData(), businessPlace()]);
  const categories = data.organizationId ? await getVehicleCategories(data.organizationId) : [];
  return {
    today: businessToday(),
    currency: place.currency,
    vehicles: data.vehicles.map((vehicle) => ({ id: vehicle.id, name: `${vehicle.make} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ""}`, plate: vehicle.plate })),
    customers: data.customers.map((customer) => ({ id: customer.id, name: customer.name })),
    categories
  };
}

function monthKey(iso: string) {
  return String(iso || "").slice(0, 7);
}

function addMonths(isoMonth: string, count: number) {
  const date = new Date(Date.UTC(Number(isoMonth.slice(0, 4)), Number(isoMonth.slice(5, 7)) - 1 + count, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Everything the assistant is allowed to know, worked out by the app rather
 * than by the model: the model reads figures, it doesn't do the bookkeeping.
 */
export async function businessSnapshot() {
  const [data, place] = await Promise.all([getDashboardData(), businessPlace()]);
  const today = businessToday();
  const thisMonth = monthKey(today);
  const supabase = (await createSupabaseServerClient()) as any;

  // Rent already scheduled for the months ahead.
  const horizon = `${addMonths(thisMonth, 6)}-01`;
  const { data: upcoming } = data.organizationId
    ? await supabase
        .from("rental_payments")
        .select("rental_id, amount, due_date, status, voided, metadata")
        .eq("organization_id", data.organizationId)
        .is("deleted_at", null)
        .in("status", ["scheduled", "pending", "overdue"])
        .lt("due_date", horizon)
    : { data: [] };
  const scheduledByMonth = new Map<string, number>();
  const scheduledRentalMonths = new Set<string>();
  for (const payment of upcoming || []) {
    if (payment.voided || payment.metadata?.voided) continue;
    // Anything still unpaid from earlier months is owed now, so it counts in this month.
    const key = monthKey(payment.due_date) < thisMonth ? thisMonth : monthKey(payment.due_date);
    scheduledByMonth.set(key, (scheduledByMonth.get(key) || 0) + Number(payment.amount || 0));
    scheduledRentalMonths.add(`${payment.rental_id}|${key}`);
  }

  // An open-ended rental may have no payment scheduled for a later month. Where
  // it doesn't, the month is filled in at its current rate and kept apart as an
  // assumption, so nothing is counted twice.
  const openEnded = data.rentals.filter((rental) => rental.end === "Indefinite" && rental.status !== "Booked");
  const projection = Array.from({ length: 6 }, (_, index) => {
    const month = addMonths(thisMonth, index);
    const scheduled = Math.round(scheduledByMonth.get(month) || 0);
    const assumed = index === 0 ? 0 : Math.round(openEnded.filter((rental) => !scheduledRentalMonths.has(`${rental.id}|${month}`)).reduce((sum, rental) => sum + Number(rental.rentalRate || 0), 0));
    return { month, scheduled, assumedIfOpenEndedRentalsContinue: assumed, total: scheduled + assumed };
  });

  const incomeByMonth = new Map<string, number>();
  const costsByMonth = new Map<string, number>();
  for (const transaction of data.transactions) {
    const key = monthKey(transaction.date);
    const type = transaction.rawType || transaction.type;
    const moneyIn = moneyInAmount({ amount: transaction.amount, isDeposit: transaction.isDeposit, type });
    if (moneyIn !== 0) incomeByMonth.set(key, (incomeByMonth.get(key) || 0) + moneyIn);
    else if (isRunningCost({ isDeposit: transaction.isDeposit, type })) costsByMonth.set(key, (costsByMonth.get(key) || 0) + Math.abs(transaction.amount));
  }
  const history = Array.from({ length: 12 }, (_, index) => {
    const month = addMonths(thisMonth, index - 11);
    const income = Math.round(incomeByMonth.get(month) || 0);
    const costs = Math.round(costsByMonth.get(month) || 0);
    return { month, income, costs, profit: income - costs };
  });

  return {
    today,
    currency: place.currency,
    country: place.country,
    vehicles: data.vehicles.map((vehicle) => ({
      id: vehicle.id,
      name: `${vehicle.make} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ""}`,
      plate: vehicle.plate,
      colour: vehicle.color || undefined,
      status: vehicle.status,
      monthlyRate: vehicle.monthlyRate || null,
      incomeToDate: Math.round(vehicle.revenue),
      profitToDate: Math.round(vehicle.profit),
      percentOfLast12MonthsRented: vehicle.utilization,
      purchasePrice: vehicle.purchasePrice || null,
      upcomingRenewals: (vehicle.compliance || []).map((item) => ({ what: item.label, date: item.date, daysFromToday: item.daysLeft }))
    })),
    currentRentals: data.rentals.map((rental) => ({
      id: rental.id,
      customer: rental.customer,
      vehicle: rental.vehicle,
      status: rental.status,
      from: rental.start,
      until: rental.end === "Indefinite" ? "open-ended" : rental.end,
      rate: rental.rentalRate,
      overdueNow: Math.round(rental.overdue || 0),
      depositHeld: Math.round(rental.depositHeld || 0)
    })),
    last12Months: history,
    next6MonthsRent: projection,
    // Added up here so the total is never left to the model's arithmetic.
    next6MonthsRentTotal: projection.reduce((sum, month) => sum + month.total, 0),
    overdueIncludedInFirstMonth: Math.round(data.rentals.reduce((sum, rental) => sum + (rental.overdue || 0), 0)),
    customers: data.customers.map((customer) => ({ id: customer.id, name: customer.name })),
    vehicleTypes: data.organizationId ? await getVehicleCategories(data.organizationId) : [],
    totals: { depositsHeld: Math.round(data.metrics.depositsHeld || 0), customers: data.customers.length }
  };
}
