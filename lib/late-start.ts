/**
 * Handing a vehicle over after the booked start date. Nothing is owed before the handover, and the
 * owner says how the missed days are treated (one question at the start of the handover):
 * - "from_handover" (the default): rent starts on the handover day.
 *     With an end date, the return date stays and the missed days come off the rent
 *     (a thirtieth of the monthly rate, a seventh of the weekly, or the daily rate, per day).
 *     With no end date, the whole schedule moves with it, so every period is a full one.
 * - "as_booked": the booking keeps its dates and its rent.
 * Either way, anything that fell due before the handover is due on the handover day.
 */

export type LateStartChoice = "from_handover" | "as_booked";

export type LateStart = {
  days: number;
  bookedStart: string;
  bookedEnd: string | null;
  openEnded: boolean;
  /** What comes off the rent for the missed days when rent starts at the handover (0 for open-ended: the schedule moves instead). */
  credit: number;
};

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

/** One day's rent at this booking's price. */
export function dayRateOf(rental: { rental_rate?: unknown; pricing_model?: unknown; billing_interval?: unknown } | null | undefined) {
  const rate = Number(rental?.rental_rate || 0);
  const period = String(rental?.billing_interval || rental?.pricing_model || "monthly").toLowerCase();
  if (period === "daily" || period === "day") return rate;
  if (period === "weekly" || period === "week") return rate / 7;
  return rate / 30;
}

export function lateStartFor(
  rental: { start_date?: unknown; end_date?: unknown; rental_rate?: unknown; pricing_model?: unknown; billing_interval?: unknown; status?: unknown } | null | undefined,
  today: string
): LateStart | null {
  if (rental?.status && String(rental.status).toLowerCase() !== "booked") return null;
  const bookedStart = String(rental?.start_date || "").slice(0, 10);
  if (!bookedStart || bookedStart >= today) return null;
  const bookedEnd = rental?.end_date ? String(rental.end_date).slice(0, 10) : null;
  // Handed over on or after the booked return day: there is no rental left to start from today.
  if (bookedEnd && bookedEnd <= today) return null;
  const days = daysBetween(bookedStart, today);
  const openEnded = !bookedEnd;
  const credit = openEnded ? 0 : Math.round((dayRateOf(rental) * days) / 10) * 10;
  return { days, bookedStart, bookedEnd, openEnded, credit };
}

export function asLateStartChoice(value: unknown): LateStartChoice {
  return value === "as_booked" ? "as_booked" : "from_handover";
}

const OPEN = ["scheduled", "pending", "failed", "overdue"];
const isRent = (row: any) => {
  const type = String(row.metadata?.type || "rent");
  return type === "rent" && row.metadata?.is_deposit !== true && !row.metadata?.early_start;
};
const isVoided = (row: any) => row.voided === true || row.metadata?.voided === true || row.status === "voided";
const monthLabel = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/**
 * Applies the owner's answer at the handover. Safe to call twice (the cash taken during the form, then
 * the form saved): once rent starts at the handover the booking no longer starts in the past.
 * Returns what was done, for the activity log, or null when the handover isn't late.
 */
export async function applyLateStart(
  supabase: any,
  args: { organizationId: string; rentalId: string; today: string; choice: unknown }
): Promise<{ late: LateStart; choice: LateStartChoice; creditApplied: number; refundDue: number } | null> {
  const { data: rental } = await supabase
    .from("rentals")
    .select("id, vehicle_id, customer_id, start_date, end_date, rental_rate, pricing_model, billing_interval, status, currency")
    .eq("id", args.rentalId)
    .eq("organization_id", args.organizationId)
    .maybeSingle();
  const late = lateStartFor(rental, args.today);
  if (!rental || !late) return null;
  const choice = asLateStartChoice(args.choice);

  const { data: payRows } = await supabase
    .from("rental_payments")
    .select("id, amount, status, due_date, voided, metadata")
    .eq("organization_id", args.organizationId)
    .eq("rental_id", args.rentalId)
    .is("deleted_at", null)
    .order("due_date", { ascending: true });
  const open = ((payRows || []) as any[]).filter((row) => OPEN.includes(String(row.status)) && !isVoided(row));
  const allRent = ((payRows || []) as any[]).filter((row) => isRent(row) && !isVoided(row) && !["cancelled", "waived"].includes(String(row.status)));

  let creditApplied = 0;
  let refundDue = 0;
  if (choice === "from_handover") {
    if (late.openEnded) {
      // The whole schedule moves with the handover, so every period is a full one.
      for (const row of open.filter(isRent)) {
        const moved = addDays(String(row.due_date).slice(0, 10), late.days);
        const metadata = { ...(row.metadata || {}), ...(row.metadata?.period_label && /^[A-Z][a-z]+ \d{4}$/.test(String(row.metadata.period_label)) ? { period_label: monthLabel(moved) } : {}), late_start: { days: late.days, moved_from: String(row.due_date).slice(0, 10) } };
        // A moved date that is still before today stays as it is; one that lands today or later isn't late any more.
        const status = moved >= args.today ? (moved === args.today ? "pending" : "scheduled") : row.status;
        await supabase.from("rental_payments").update({ due_date: moved, scheduled_date: moved, metadata, status }).eq("id", row.id);
        row.status = status;
        row.due_date = moved;
      }
    } else if (allRent.length > 0 && late.credit > 0) {
      // Same return date: the missed days come off the rent, earliest unpaid rent first.
      let left = late.credit;
      for (const row of open.filter(isRent)) {
        if (left <= 0) break;
        const take = Math.min(left, Number(row.amount || 0));
        const remaining = Number(row.amount || 0) - take;
        left -= take;
        creditApplied += take;
        // A daily booking's one rent row says how many days it covers: it now covers fewer.
        const dayCount = String(row.metadata?.period_label || "").match(/^(\d+) days?$/);
        const newCount = dayCount ? Math.max(1, Number(dayCount[1]) - late.days) : 0;
        const metadata = {
          ...(row.metadata || {}),
          ...(dayCount ? { period_label: `${newCount} ${newCount === 1 ? "day" : "days"}` } : {}),
          late_start: { days: late.days, taken_off: take }
        };
        await supabase
          .from("rental_payments")
          .update(remaining > 0 ? { amount: remaining, metadata } : { status: "waived", metadata: { ...metadata, waived_reason: "late_start" } })
          .eq("id", row.id);
        row.amount = remaining;
      }
      // Rent already paid for days the customer never had: that much goes back.
      refundDue = Math.max(0, left);
    }
    const { error } = await supabase.from("rentals").update({ start_date: args.today }).eq("id", args.rentalId).eq("organization_id", args.organizationId);
    if (error) throw new Error(error.message);
  }

  // Nothing was owed before the handover: whatever fell due before it is due today.
  const stillEarlier = open.filter((row) => Number(row.amount || 0) > 0 && String(row.due_date).slice(0, 10) < args.today);
  if (stillEarlier.length) {
    await supabase
      .from("rental_payments")
      .update({ due_date: args.today, scheduled_date: args.today, status: "pending" })
      .in("id", stillEarlier.map((row) => row.id));
  }

  if (refundDue > 0) {
    const baht = `฿${Math.round(refundDue).toLocaleString("en-US")}`;
    await supabase.from("tasks").insert({
      organization_id: args.organizationId,
      rental_id: args.rentalId,
      vehicle_id: rental.vehicle_id || null,
      title: `Refund - rent paid for ${late.days} ${late.days === 1 ? "day" : "days"} before the handover (${baht})`,
      task_type: "admin",
      action: "refund",
      due_at: new Date().toISOString()
    });
  }

  return { late, choice, creditApplied, refundDue };
}

/** What happened, in a sentence for the booking's history. */
export function lateStartNote(result: NonNullable<Awaited<ReturnType<typeof applyLateStart>>>) {
  const { late, choice, creditApplied, refundDue } = result;
  const days = `${late.days} ${late.days === 1 ? "day" : "days"}`;
  const baht = (value: number) => `฿${Math.round(value).toLocaleString("en-US")}`;
  if (choice === "as_booked") return `Handed over ${days} after the booked start. Kept the booked dates and rent.`;
  if (late.openEnded) return `Handed over ${days} after the booked start. Rent starts from the handover; every payment date moved ${days} later.`;
  const parts = [`Handed over ${days} after the booked start. Rent starts from the handover; the return date stays.`];
  if (creditApplied > 0) parts.push(`${baht(creditApplied)} taken off the rent.`);
  if (refundDue > 0) parts.push(`${baht(refundDue)} of rent already paid is to give back.`);
  return parts.join(" ");
}
