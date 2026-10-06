import { businessToday } from "@/lib/business-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type MatchResult = {
  id: string;
  matchType: "rental_payment" | "task";
  confidence: "high" | "medium";
  label: string;
  subLabel: string;
  /** What kind of money this is, so choosing it sets the right type. */
  suggestedType?: string;
  amount: number;
  rentalId?: string;
  rentalPaymentId?: string;
  taskId?: string;
  customerId?: string;
  customerName?: string;
  vehicleLabel?: string;
  prefilledData: {
    amount: number;
    vehicleId: string | null;
    description: string;
    date: string;
  };
};

function money(value: number) {
  return `฿${Math.round(value || 0).toLocaleString()}`;
}

function dateOnly(value: string | null | undefined) {
  return String(value || "").slice(0, 10);
}

/** "1 Oct" rather than 2026-10-01. */
function shortDate(value: string | null | undefined) {
  const day = dateOnly(value);
  if (!day) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

function dayDistance(left: string | null | undefined, right: string | null | undefined) {
  const leftTime = new Date(dateOnly(left)).getTime();
  const rightTime = new Date(dateOnly(right)).getTime();
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return Infinity;
  return Math.abs(leftTime - rightTime) / 86400000;
}

function amountWithin(inputAmount: number | null, targetAmount: number, percent: number) {
  if (inputAmount === null || !Number.isFinite(inputAmount)) return true;
  if (targetAmount <= 0) return inputAmount <= 0;
  return Math.abs(inputAmount - targetAmount) <= targetAmount * percent;
}

function vehicleLabel(vehicle: any) {
  return [vehicle?.registration_number, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";
}

function paymentDescription(row: any, vehicle: any) {
  const due = dateOnly(row.due_date);
  const month = due
    ? new Intl.DateTimeFormat("en-TH", { month: "short" }).format(new Date(due))
    : "Rental";
  return `${month} rental payment - ${[vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || vehicleLabel(vehicle)}`;
}

/**
 * Every payment the business is waiting for that is overdue, due today or due
 * in the next week, soonest first. Shown at the top of "Record money" so the
 * usual case (rent arrived) is one tap, not a form to fill in.
 */
export async function listPaymentsWaiting(orgId: string): Promise<MatchResult[]> {
  if (!orgId) return [];
  const supabase = (await createSupabaseServerClient()) as any;
  const today = businessToday();
  const { data, error } = await supabase
    .from("rental_payments")
    .select("id, rental_id, amount, due_date, status, voided, metadata, rentals!inner(id, status, vehicle_id, customer_id, vehicles!rentals_vehicle_id_fkey(registration_number, make, model), customers!rentals_customer_id_fkey(full_name))")
    .eq("organization_id", orgId)
    .in("status", ["pending", "overdue", "scheduled"])
    .is("deleted_at", null)
    .lte("due_date", businessToday(7))
    .neq("rentals.status", "cancelled")
    .order("due_date", { ascending: true })
    .limit(40);
  if (error) return [];
  return ((data || []) as any[])
    .filter((row) => !row.voided && !row.metadata?.voided && Number(row.amount || 0) > 0)
    .map((row) => {
      const rental = row.rentals || {};
      const vehicle = rental.vehicles || {};
      const isDeposit = String(row.metadata?.type || "") === "deposit";
      const due = dateOnly(row.due_date);
      const name = [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || vehicleLabel(vehicle);
      const label = isDeposit ? `Deposit - ${name}` : paymentDescription(row, vehicle);
      const amount = Number(row.amount || 0);
      return {
        id: `payment-${row.id}`,
        matchType: "rental_payment" as const,
        confidence: "high" as const,
        label: `${money(amount)} · ${isDeposit ? "deposit" : "rent"} · ${name}`,
        subLabel: !due ? "" : due < today ? `was due ${shortDate(due)}` : due === today ? "due today" : `due ${shortDate(due)}`,
        suggestedType: isDeposit ? "deposit_received" : "rental_income",
        amount,
        rentalId: row.rental_id,
        rentalPaymentId: row.id,
        customerId: rental.customer_id || undefined,
        customerName: rental.customers?.full_name || undefined,
        vehicleLabel: vehicleLabel(vehicle),
        prefilledData: { amount, vehicleId: rental.vehicle_id || null, description: label, date: today }
      };
    });
}

function confidenceRank(value: "high" | "medium") {
  return value === "high" ? 0 : 1;
}

export async function findMatchingOutstandingItems(
  orgId: string,
  type: string,
  amount: number | null,
  vehicleId: string | null,
  date: string
): Promise<MatchResult[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const transactionDate = dateOnly(date) || businessToday();
  const normalizedType = String(type || "").trim();
  const parsedAmount = amount !== null && Number.isFinite(Number(amount)) ? Number(amount) : null;

  if (!orgId || !normalizedType) return [];

  const [paymentsResult, tasksResult] = await Promise.all([
    supabase
      .from("rental_payments")
      .select("id, rental_id, amount, due_date, status, metadata, rentals!inner(id, vehicle_id, customer_id, vehicles!rentals_vehicle_id_fkey(registration_number, make, model), customers!rentals_customer_id_fkey(full_name))")
      .eq("organization_id", orgId)
      .in("status", ["pending", "overdue", "scheduled"])
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .limit(20),
    supabase
      .from("tasks")
      .select("id, title, task_type, due_at, vehicle_id, rental_id, rental_payment_id, vehicles!tasks_vehicle_id_fkey(registration_number, make, model)")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .is("completed_at", null)
      .order("due_at", { ascending: true })
      .limit(20)
  ]);

  if (paymentsResult.error) {
    throw new Error(paymentsResult.error.message);
  }

  const matches: MatchResult[] = [];

  for (const row of paymentsResult.data || []) {
    const rental = row.rentals || {};
    const vehicle = rental.vehicles || {};
    const customer = rental.customers || {};
    const paymentAmount = Number(row.amount || 0);
    const typeMatches = normalizedType === "rental_income";
    const amountHigh = amountWithin(parsedAmount, paymentAmount, 0.1);
    const amountMedium = parsedAmount !== null && amountWithin(parsedAmount, paymentAmount, 0.2);
    const vehicleMatches = !vehicleId || vehicleId === rental.vehicle_id;
    const dateHigh = dayDistance(transactionDate, row.due_date) <= 7;
    const dateMedium = dayDistance(transactionDate, row.due_date) <= 14;

    let confidence: "high" | "medium" | null = null;
    if (typeMatches && amountHigh && vehicleMatches && dateHigh) {
      confidence = "high";
    } else {
      const mediumSignals = [typeMatches, amountMedium, vehicleMatches && Boolean(vehicleId), dateMedium].filter(Boolean).length;
      if (mediumSignals >= 2) confidence = "medium";
    }

    if (!confidence) continue;

    // A deposit is not rent: name it as one, and record it as one when chosen.
    const isDeposit = String(row.metadata?.type || "") === "deposit";
    const label = isDeposit ? `Deposit - ${[vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || vehicleLabel(vehicle)}` : paymentDescription(row, vehicle);
    const due = dateOnly(row.due_date);
    matches.push({
      id: `payment-${row.id}`,
      matchType: "rental_payment",
      confidence,
      label,
      subLabel: `${money(paymentAmount)}${due ? ` due ${shortDate(due)}` : ""}`,
      suggestedType: isDeposit ? "deposit_received" : "rental_income",
      amount: paymentAmount,
      rentalId: row.rental_id,
      rentalPaymentId: row.id,
      customerId: rental.customer_id || undefined,
      customerName: customer.full_name || undefined,
      vehicleLabel: vehicleLabel(vehicle),
      prefilledData: {
        amount: paymentAmount,
        vehicleId: rental.vehicle_id || null,
        description: label,
        date: transactionDate || due || businessToday()
      }
    });
  }

  if (!tasksResult.error) {
    for (const task of tasksResult.data || []) {
      const taskType = String(task.task_type || "").toLowerCase();
      const title = String(task.title || "");
      const isFinanceTask = taskType.includes("payment") || taskType.includes("transaction") || taskType.includes("finance") || title.toLowerCase().includes("payment");
      if (!isFinanceTask) continue;
      const typeMatches = normalizedType === "rental_income";
      const vehicleMatches = !vehicleId || vehicleId === task.vehicle_id;
      const dateClose = dayDistance(transactionDate, task.due_at) <= 7;
      if (!(typeMatches && vehicleMatches && dateClose)) continue;

      matches.push({
        id: `task-${task.id}`,
        matchType: "task",
        confidence: "high",
        label: title,
        subLabel: dateOnly(task.due_at) ? `Due ${shortDate(task.due_at)}` : "",
        amount: parsedAmount || 0,
        rentalId: task.rental_id || undefined,
        rentalPaymentId: task.rental_payment_id || undefined,
        taskId: task.id,
        vehicleLabel: vehicleLabel(task.vehicles),
        prefilledData: {
          amount: parsedAmount || 0,
          vehicleId: task.vehicle_id || null,
          description: title,
          date: transactionDate
        }
      });
    }
  }

  return matches
    .sort((left, right) => confidenceRank(left.confidence) - confidenceRank(right.confidence))
    .slice(0, 3);
}
