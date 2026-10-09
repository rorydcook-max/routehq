/**
 * Double-booking rules, shared by the booking form (to warn early) and the
 * server actions (to refuse). A booking holds its car from the start date up
 * to, but not including, the end date, so a car returned in the morning can go
 * out again the same day. A booking with no end date holds the car until one
 * is set. The database enforces the same rule (rentals_no_double_booking).
 */

export const BLOCKING_RENTAL_STATUSES = ["booked", "active", "due_soon", "overdue", "extended"] as const;

export type BusyPeriod = {
  rentalId: string;
  code: string | null;
  customerName: string | null;
  startDate: string;
  endDate: string | null;
};

function addDay(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Exclusive end of the period a booking holds the car for. */
function holdEnd(startDate: string, endDate: string | null) {
  if (!endDate) return "9999-12-31";
  return endDate > startDate ? endDate : addDay(startDate);
}

export function overlaps(startDate: string, endDate: string | null, period: Pick<BusyPeriod, "startDate" | "endDate">) {
  return startDate < holdEnd(period.startDate, period.endDate) && period.startDate < holdEnd(startDate, endDate);
}

export function findConflict(periods: BusyPeriod[], startDate: string, endDate: string | null, excludeRentalId?: string | null) {
  if (!startDate) return null;
  return periods.find((period) => period.rentalId !== excludeRentalId && overlaps(startDate, endDate, period)) || null;
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

export function conflictMessage(period: BusyPeriod) {
  const when = period.endDate ? `from ${shortDate(period.startDate)} to ${shortDate(period.endDate)}` : `from ${shortDate(period.startDate)} with no end date`;
  const who = [period.code, period.customerName].filter(Boolean).join(", ");
  return `This vehicle is already booked ${when}${who ? ` (${who})` : ""}. Choose other dates or another vehicle.`;
}

/** Busy periods for one or more vehicles, keyed by vehicle id. */
export async function loadBusyPeriods(supabase: any, organizationId: string, vehicleIds?: string[]) {
  let query = supabase
    .from("rentals")
    .select("id, vehicle_id, display_code, reference, start_date, end_date, customers!rentals_customer_id_fkey(full_name)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", BLOCKING_RENTAL_STATUSES as unknown as string[]);
  if (vehicleIds?.length) query = query.in("vehicle_id", vehicleIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const byVehicle: Record<string, BusyPeriod[]> = {};
  for (const row of data || []) {
    if (!row.vehicle_id || !row.start_date) continue;
    (byVehicle[row.vehicle_id] ||= []).push({
      rentalId: row.id,
      code: row.display_code || row.reference || null,
      customerName: row.customers?.full_name || null,
      startDate: String(row.start_date).slice(0, 10),
      endDate: row.end_date ? String(row.end_date).slice(0, 10) : null
    });
  }
  for (const list of Object.values(byVehicle)) list.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return byVehicle;
}

/** Returns a friendly message when the dates clash with another booking, else null. */
export async function vehicleConflictMessage(
  supabase: any,
  args: { organizationId: string; vehicleId: string; startDate: string; endDate: string | null; excludeRentalId?: string | null }
) {
  const busy = await loadBusyPeriods(supabase, args.organizationId, [args.vehicleId]);
  const conflict = findConflict(busy[args.vehicleId] || [], args.startDate, args.endDate, args.excludeRentalId);
  return conflict ? conflictMessage(conflict) : null;
}

/** Maps the database's double-booking constraint error to the friendly message. */
export function isDoubleBookingError(error: { code?: string; message?: string } | null | undefined) {
  return !!error && (error.code === "23P01" || String(error.message || "").includes("rentals_no_double_booking"));
}

/**
 * Handing over before the booked start date: is the vehicle actually free from
 * today until this booking ends? Returns the rental in the way, else null.
 */
export async function earlyHandoverBlocker(
  supabase: any,
  args: { organizationId: string; vehicleId: string; rentalId: string; startDate: string | null | undefined; endDate: string | null; today: string }
): Promise<BusyPeriod | null> {
  const booked = String(args.startDate || "").slice(0, 10);
  if (!booked || args.today >= booked) return null;
  const busy = await loadBusyPeriods(supabase, args.organizationId, [args.vehicleId]);
  return findConflict(busy[args.vehicleId] || [], args.today, args.endDate || booked, args.rentalId);
}

export const DOUBLE_BOOKING_MESSAGE = "This vehicle is already booked for some of those dates. Choose other dates or another vehicle.";
