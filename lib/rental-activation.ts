import { businessToday } from "@/lib/business-time";
import { addMonths, addWeeks, countBillingPeriods } from "@/lib/payment-schedule";

type SupabaseClient = { from: (table: string) => any };

function dateOnly(value: string | null | undefined): string {
  return String(value || "").slice(0, 10);
}

function daysBetween(d1: string, d2: string): number {
  const a = new Date(`${d1}T00:00:00.000Z`);
  const b = new Date(`${d2}T00:00:00.000Z`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function isNonVoidedRentPayment(p: any): boolean {
  const metadata = p.metadata || {};
  const type = String(metadata.type || "rent").toLowerCase();
  return (
    p.status !== "voided" &&
    !p.voided &&
    !metadata.voided &&
    !["deposit", "deposit_received", "deposit_refunded"].includes(type)
  );
}

function bestMatchTransaction(transactions: any[], usedIds: Set<string>, dueDateStr: string): any | null {
  let matched: any = null;
  let minDiff = Infinity;
  for (const tx of transactions) {
    if (usedIds.has(tx.id)) continue;
    const txDate = dateOnly(tx.transaction_date);
    const diff = Math.abs(daysBetween(dueDateStr, txDate));
    if (diff <= 5 && diff < minDiff) {
      minDiff = diff;
      matched = tx;
    }
  }
  return matched;
}

export async function activateRental(rentalId: string, supabase: SupabaseClient): Promise<void> {
  const { data: rental, error } = await (supabase as any)
    .from("rentals")
    .select("id, organization_id, customer_id, vehicle_id, start_date, end_date, rental_rate, pricing_model, billing_interval, currency, status")
    .eq("id", rentalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !rental) return;

  // Update status to active if needed
  if (rental.status !== "active") {
    const { error: updateError } = await (supabase as any)
      .from("rentals")
      .update({ status: "active" })
      .eq("id", rental.id)
      .eq("organization_id", rental.organization_id);
    if (updateError) throw new Error(updateError.message);
  }

  // Fetch existing non-voided rent payments
  const { data: existingPayRows } = await (supabase as any)
    .from("rental_payments")
    .select("id, due_date, status, amount, currency, voided, metadata, transaction_id")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rental.id)
    .is("deleted_at", null);

  const existingRentPayments = (existingPayRows || []).filter(isNonVoidedRentPayment);

  const today = businessToday();
  const hasScheduledFuture = existingRentPayments.some(
    (p: any) => p.status === "scheduled" && dateOnly(p.due_date) > today
  );

  let newPayments: any[] = [];
  if (!hasScheduledFuture) {
    newPayments = await generatePaymentScheduleInternal(rental, existingRentPayments, supabase);
  }

  // Try to match existing unmatched payments to income transactions
  await matchPaymentsToTransactions(rental, existingRentPayments, supabase);

  // Create tasks for all current unpaid non-voided rent payments
  const allPayments = [...existingRentPayments, ...newPayments];
  await createPaymentTasks(rental, allPayments, supabase);
}

async function generatePaymentScheduleInternal(
  rental: any,
  existingPayments: any[],
  supabase: SupabaseClient
): Promise<any[]> {
  if (!rental.customer_id || !rental.vehicle_id) return [];
  const rentalRate = Number(rental.rental_rate || 0);
  if (rentalRate <= 0) return [];

  const startDateStr = dateOnly(rental.start_date);
  if (!startDateStr) return [];

  const period = String(rental.billing_interval || rental.pricing_model || "monthly").toLowerCase();
  if (!["monthly", "month", "weekly", "week"].includes(period)) return [];

  const { data: txRows } = await (supabase as any)
    .from("transactions")
    .select("id, transaction_date, amount")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rental.id)
    .eq("type", "rental_income")
    .is("deleted_at", null);

  const incomeTransactions: any[] = txRows || [];

  const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
  const endDateStr = dateOnly(rental.end_date) || null;
  const today = businessToday();

  // Build set of dates already covered by existing payments (within 5 days)
  const existingDates = existingPayments.map((p: any) => dateOnly(p.due_date)).filter(Boolean);
  const isDateCovered = (dueDateStr: string) =>
    existingDates.some((d: string) => Math.abs(daysBetween(dueDateStr, d)) <= 5);

  // Track which transactions were already matched by existing paid payments
  const usedTransactionIds = new Set<string>(
    existingPayments
      .filter((p: any) => p.transaction_id)
      .map((p: any) => p.transaction_id as string)
  );

  const records: any[] = [];

  const generate = (dueDateStr: string, index: number, monthLabel?: string) => {
    if (isDateCovered(dueDateStr)) return;

    const matched = bestMatchTransaction(incomeTransactions, usedTransactionIds, dueDateStr);
    if (matched) usedTransactionIds.add(matched.id);

    const status = matched
      ? "paid"
      : dueDateStr < today
        ? "overdue"
        : dueDateStr === today
          ? "pending"
          : "scheduled";

    records.push({
      organization_id: rental.organization_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      vehicle_id: rental.vehicle_id,
      amount: rentalRate,
      currency: rental.currency || "THB",
      scheduled_date: dueDateStr,
      due_date: dueDateStr,
      status,
      paid_at: matched ? new Date().toISOString() : null,
      transaction_id: matched ? matched.id : null,
      metadata: {
        type: "rent",
        is_deposit: false,
        period_index: index,
        ...(monthLabel ? { period_label: monthLabel } : {}),
        auto_generated: true
      }
    });
  };

  if (period === "monthly" || period === "month") {
    const monthsToGenerate = countBillingPeriods(startDateStr, endDateStr, "monthly", 24);
    for (let i = 0; i < monthsToGenerate; i++) {
      const dueDate = addMonths(startDate, i);
      generate(dueDate.toISOString().split("T")[0], i, formatMonthLabel(dueDate));
    }
  } else if (period === "weekly" || period === "week") {
    const weeksToGenerate = endDateStr ? countBillingPeriods(startDateStr, endDateStr, "weekly", 52) : 12;
    for (let i = 0; i < weeksToGenerate; i++) {
      const dueDate = addWeeks(startDate, i);
      generate(dueDate.toISOString().split("T")[0], i);
    }
  }

  if (records.length === 0) return [];

  const { data: inserted, error } = await (supabase as any)
    .from("rental_payments")
    .insert(records)
    .select("id, due_date, status, vehicle_id");

  if (error) {
    console.error("activateRental: failed to insert payment schedule:", error.message);
    return [];
  }

  return inserted || [];
}

async function matchPaymentsToTransactions(
  rental: any,
  payments: any[],
  supabase: SupabaseClient
): Promise<void> {
  const unmatchedPayments = payments.filter((p: any) => p.status !== "paid" && !p.transaction_id);
  if (unmatchedPayments.length === 0) return;

  const { data: txRows } = await (supabase as any)
    .from("transactions")
    .select("id, transaction_date, amount")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rental.id)
    .eq("type", "rental_income")
    .is("deleted_at", null);

  const incomeTransactions: any[] = txRows || [];
  const usedIds = new Set<string>(
    payments.filter((p: any) => p.transaction_id).map((p: any) => p.transaction_id as string)
  );

  for (const payment of unmatchedPayments) {
    const dueDateStr = dateOnly(payment.due_date);
    if (!dueDateStr) continue;

    const matched = bestMatchTransaction(incomeTransactions, usedIds, dueDateStr);
    if (!matched) continue;

    usedIds.add(matched.id);
    await (supabase as any)
      .from("rental_payments")
      .update({ status: "paid", transaction_id: matched.id, paid_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("organization_id", rental.organization_id);
  }
}

async function createPaymentTasks(
  rental: any,
  payments: any[],
  supabase: SupabaseClient
): Promise<void> {
  for (const payment of payments) {
    const status = String(payment.status || "");
    if (!["scheduled", "pending", "overdue"].includes(status)) continue;
    if (!payment.id) continue;

    const { data: existing } = await (supabase as any)
      .from("tasks")
      .select("id")
      .eq("organization_id", rental.organization_id)
      .eq("rental_payment_id", payment.id)
      .eq("task_type", "payment_reminder")
      .limit(1);

    if (existing?.length) continue;

    await (supabase as any).from("tasks").insert({
      organization_id: rental.organization_id,
      vehicle_id: payment.vehicle_id || rental.vehicle_id || null,
      rental_id: rental.id,
      rental_payment_id: payment.id,
      title: `Payment due - ${dateOnly(payment.due_date)}`,
      task_type: "payment_reminder",
      due_at: `${dateOnly(payment.due_date)}T09:00:00.000Z`,
      created_by: null
    });
  }
}
