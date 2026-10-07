import { businessToday } from "@/lib/business-time";

type PaymentScheduleSupabase = {
  from: (table: string) => any;
};

export type GeneratePaymentScheduleParams = {
  supabase: PaymentScheduleSupabase;
  organisationId: string;
  rentalId: string;
  rentalRate: number;
  depositAmount?: number;
  deliveryDate: string;
  endDate?: string | null;
  billingPeriod: string;
  upfrontPeriods?: number;
  upfrontRate?: number | null;
};

function dateOnly(date: Date) {
  return date.toISOString().split("T")[0];
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const originalDay = next.getUTCDate();
  next.setUTCMonth(next.getUTCMonth() + months);
  if (next.getUTCDate() !== originalDay) {
    next.setUTCDate(0);
  }
  return next;
}

export function addWeeks(date: Date, weeks: number): Date {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + weeks * 7);
  return next;
}

// The rent a customer owes first. A daily price is charged for the whole stay in one payment;
// every other price (week, month, fixed) is one period's worth.
export function firstRentCharge(rental: { rental_rate?: unknown; pricing_model?: unknown; billing_interval?: unknown; start_date?: unknown; end_date?: unknown } | null | undefined): number {
  const rate = Number(rental?.rental_rate || 0);
  const period = String(rental?.billing_interval || rental?.pricing_model || "").toLowerCase();
  if ((period === "daily" || period === "day") && rental?.start_date && rental?.end_date) {
    return rate * Math.max(1, daysBetween(String(rental.start_date), String(rental.end_date)));
  }
  return rate;
}

export function daysBetween(date1: string, date2: string): number {
  const start = new Date(`${String(date1).slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${String(date2).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

/**
 * How many billing periods start before the rental ends. A rental from
 * 1 Oct to 1 Nov is one month, not two: the return day starts no new period.
 * A part period at the end still counts as a period.
 */
export function countBillingPeriods(startDate: string, endDate: string | null | undefined, period: "monthly" | "weekly", cap: number) {
  if (!endDate) return cap;
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return cap;
  let count = 0;
  while (count < cap && (period === "monthly" ? addMonths(start, count) : addWeeks(start, count)) < end) count++;
  return Math.max(1, count);
}

/**
 * What each billing period of a rental with set dates costs. Every whole
 * period is the full price. A part period at the end is charged for its days
 * only (a thirtieth of the month, or a seventh of the week, per day, to the
 * nearest 10), so 39 days at 18,000 a month is 18,000 then 5,400, not two full
 * months. A rental shorter than one period still pays the one full period:
 * that is the price the customer chose it at.
 */
export function billingPeriodAmounts(startDate: string, endDate: string | null | undefined, period: "monthly" | "weekly", rate: number, cap: number): number[] {
  const count = countBillingPeriods(startDate, endDate, period, cap);
  const amounts = Array.from({ length: count }, () => rate);
  if (!endDate || count < 2) return amounts;
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00.000Z`);
  const step = (index: number) => (period === "monthly" ? addMonths(start, index) : addWeeks(start, index));
  const lastStart = step(count - 1).toISOString().slice(0, 10);
  const lastFullEnd = step(count).toISOString().slice(0, 10);
  const end = String(endDate).slice(0, 10);
  if (end < lastFullEnd) {
    const days = daysBetween(lastStart, end);
    const part = Math.round((rate * days) / (period === "monthly" ? 30 : 7) / 10) * 10;
    amounts[count - 1] = Math.max(0, Math.min(rate, part));
  }
  return amounts;
}

/** How far ahead rent is scheduled on a rental with no end date. The daily job rolls it forward a month at a time. */
export const OPEN_ENDED_MONTHS_AHEAD = 2;

/**
 * How many monthly payments a rental with no end date gets, counted from its
 * first payment: everything due up to today, plus the next two months. A year
 * or two of rent lined up for a rental that could end next week was noise on
 * every screen that lists payments.
 */
export function openEndedMonthCount(firstDue: string, today = businessToday()) {
  const first = String(firstDue).slice(0, 10);
  const start = new Date(`${first}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return 1;
  const from = new Date(`${today > first ? today : first}T00:00:00.000Z`);
  const horizon = addMonths(from, OPEN_ENDED_MONTHS_AHEAD);
  let count = 0;
  while (count < 240 && addMonths(start, count) <= horizon) count++;
  return Math.max(1, count);
}

export function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export async function generatePaymentSchedule({
  supabase,
  organisationId,
  rentalId,
  rentalRate,
  depositAmount = 0,
  deliveryDate,
  endDate,
  billingPeriod,
  upfrontPeriods = 0,
  upfrontRate
}: GeneratePaymentScheduleParams): Promise<void> {
  const normalizedDeliveryDate = String(deliveryDate || "").slice(0, 10);
  if (!normalizedDeliveryDate || rentalRate <= 0) {
    return;
  }

  const deliveryDateObj = new Date(`${normalizedDeliveryDate}T00:00:00.000Z`);
  if (Number.isNaN(deliveryDateObj.getTime())) {
    return;
  }

  const { data: rental } = await supabase
    .from("rentals")
    .select("customer_id, vehicle_id, currency")
    .eq("id", rentalId)
    .eq("organization_id", organisationId)
    .maybeSingle();

  if (!rental?.customer_id || !rental?.vehicle_id) {
    throw new Error("A customer and vehicle are required before generating a payment schedule.");
  }

  const currency = rental?.currency || "THB";
  const records: Record<string, any>[] = [];
  const period = String(billingPeriod || "").toLowerCase();
  const paidNow = new Date().toISOString();
  const paidAtDate = `${normalizedDeliveryDate}T00:00:00.000Z`;

  if (period === "monthly" || period === "month") {
    // With no end date: what is due so far and the next two months (never fewer than the months paid ahead).
    const monthsToGenerate = endDate
      ? countBillingPeriods(normalizedDeliveryDate, endDate, "monthly", 12)
      : Math.max(openEndedMonthCount(normalizedDeliveryDate), upfrontPeriods);

    const monthAmounts = endDate ? billingPeriodAmounts(normalizedDeliveryDate, endDate, "monthly", rentalRate, 12) : [];
    for (let i = 0; i < monthsToGenerate; i++) {
      const dueDate = addMonths(deliveryDateObj, i);
      const isUpfront = i < upfrontPeriods;
      const amount = isUpfront ? upfrontRate || rentalRate : monthAmounts[i] ?? rentalRate;

      records.push({
        organization_id: organisationId,
        rental_id: rentalId,
        customer_id: rental.customer_id,
        vehicle_id: rental.vehicle_id,
        amount,
        currency,
        scheduled_date: dateOnly(dueDate),
        due_date: dateOnly(dueDate),
        status: isUpfront ? "paid" : "scheduled",
        paid_at: isUpfront ? paidNow : null,
        metadata: {
          type: "rent",
          is_deposit: false,
          period_index: i,
          period_label: formatMonthLabel(dueDate),
          is_upfront: isUpfront,
          paid_date: isUpfront ? paidAtDate : null
        }
      });
    }
  } else if (period === "weekly" || period === "week") {
    const weeksToGenerate = endDate ? countBillingPeriods(normalizedDeliveryDate, endDate, "weekly", 52) : 12;

    const weekAmounts = endDate ? billingPeriodAmounts(normalizedDeliveryDate, endDate, "weekly", rentalRate, 52) : [];
    for (let i = 0; i < weeksToGenerate; i++) {
      const dueDate = addWeeks(deliveryDateObj, i);
      const isUpfront = i < upfrontPeriods;
      records.push({
        organization_id: organisationId,
        rental_id: rentalId,
        customer_id: rental.customer_id,
        vehicle_id: rental.vehicle_id,
        amount: isUpfront ? rentalRate : weekAmounts[i] ?? rentalRate,
        currency,
        scheduled_date: dateOnly(dueDate),
        due_date: dateOnly(dueDate),
        status: isUpfront ? "paid" : "scheduled",
        paid_at: isUpfront ? paidNow : null,
        metadata: {
          type: "rent",
          is_deposit: false,
          period_index: i,
          is_upfront: isUpfront
        }
      });
    }
  } else {
    // Daily and one-off prices: the whole rent is one payment, due at handover.
    // (Without this a short rental had no payments at all, and no deposit either.)
    const isDaily = period === "daily" || period === "day";
    const days = isDaily && endDate ? Math.max(1, daysBetween(normalizedDeliveryDate, endDate)) : 1;
    records.push({
      organization_id: organisationId,
      rental_id: rentalId,
      customer_id: rental.customer_id,
      vehicle_id: rental.vehicle_id,
      amount: isDaily ? rentalRate * days : rentalRate,
      currency,
      scheduled_date: normalizedDeliveryDate,
      due_date: normalizedDeliveryDate,
      status: "scheduled",
      paid_at: null,
      metadata: {
        type: "rent",
        is_deposit: false,
        period_index: 0,
        period_label: isDaily ? `${days} ${days === 1 ? "day" : "days"}` : "Whole rental",
        is_upfront: false
      }
    });
  }

  // The deposit is due with the first rent. Collected at handover, it is marked paid there.
  if (records.length > 0 && depositAmount > 0) {
    records.unshift({
      organization_id: organisationId,
      rental_id: rentalId,
      customer_id: rental.customer_id,
      vehicle_id: rental.vehicle_id,
      amount: depositAmount,
      currency,
      scheduled_date: normalizedDeliveryDate,
      due_date: normalizedDeliveryDate,
      status: "scheduled",
      paid_at: null,
      metadata: { type: "deposit", is_deposit: true, description: "Security deposit" }
    });
  }

  if (records.length > 0) {
    const { error } = await supabase.from("rental_payments").insert(records);
    if (error) {
      throw new Error(error.message);
    }
  }
}
