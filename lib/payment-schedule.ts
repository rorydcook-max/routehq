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

export function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export async function generatePaymentSchedule({
  supabase,
  organisationId,
  rentalId,
  rentalRate,
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
    const monthsToGenerate = countBillingPeriods(normalizedDeliveryDate, endDate, "monthly", 12);

    for (let i = 0; i < monthsToGenerate; i++) {
      const dueDate = addMonths(deliveryDateObj, i);
      const isUpfront = i < upfrontPeriods;
      const amount = isUpfront ? upfrontRate || rentalRate : rentalRate;

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

    for (let i = 0; i < weeksToGenerate; i++) {
      const dueDate = addWeeks(deliveryDateObj, i);
      const isUpfront = i < upfrontPeriods;
      records.push({
        organization_id: organisationId,
        rental_id: rentalId,
        customer_id: rental.customer_id,
        vehicle_id: rental.vehicle_id,
        amount: rentalRate,
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
  }

  if (records.length > 0) {
    const { error } = await supabase.from("rental_payments").insert(records);
    if (error) {
      throw new Error(error.message);
    }
  }
}
