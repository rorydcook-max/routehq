import { englishDateLocale } from "@/lib/i18n/customer-dates";
import { rentalVehiclePeriods, splitRentalsByVehicle, swappedOut, VEHICLE_CHANGE_COLUMNS, type VehicleChangeRow } from "@/lib/rental-vehicle-periods";

/**
 * Double-booking rules, shared by the booking form (to warn early) and the
 * server actions (to refuse). A booking holds its car from the start date up
 * to, but not including, the end date, so a car returned in the morning can go
 * out again the same day. A booking with no end date holds the car until one
 * is set. The database enforces the same rule (rentals_no_double_booking).
 */

export const BLOCKING_RENTAL_STATUSES = ["booked", "active", "due_soon", "overdue", "extended"] as const;

/** Statuses where the customer has the vehicle: it is not back until a return is recorded, whatever the end date says. */
export const OUT_RENTAL_STATUSES = ["active", "due_soon", "overdue", "extended"] as const;

export type BusyPeriod = {
  rentalId: string;
  code: string | null;
  customerName: string | null;
  /** The booking's customer, so a clash with the same customer's own booking can say so. */
  customerId?: string | null;
  startDate: string;
  endDate: string | null;
  /** True while the customer has the vehicle (handed over, not yet returned). */
  out?: boolean;
  /** The days after this rental, held because the renter answered "Extend" (not yet applied). Blocks the team too. */
  heldForExtension?: boolean;
};

/** Columns of a rental needed by extendHeldUntil / ownerBusyEnd. */
export const EXTEND_HOLD_COLUMNS = "end_date, extension_hold_until, extension_answer, extension_check_end";

/**
 * The renter answered "Extend" for the current end date and it isn't applied yet (owner's decision, 7 Nov 2026): the
 * held days are then off limits everywhere, the team's own booking form, date changes and vehicle pickers included,
 * until the extension is applied (the end date moves) or the hold is released. Returns the first free day, else null.
 * Before an answer, or after "Returning", only customer-facing availability sees the hold (bookableEnd).
 */
export function extendHeldUntil(row: { end_date?: unknown; extension_hold_until?: unknown; extension_answer?: unknown; extension_check_end?: unknown }): string | null {
  const end = row.end_date ? String(row.end_date).slice(0, 10) : null;
  const held = row.extension_hold_until ? String(row.extension_hold_until).slice(0, 10) : null;
  if (!end || !held || held <= end) return null;
  if (row.extension_answer !== "extend" || String(row.extension_check_end || "").slice(0, 10) !== end) return null;
  return held;
}

/** End of the time a rental keeps its vehicle from the team's own bookings: its end date, or a confirmed-wanted extension hold. */
export function ownerBusyEnd(row: { end_date?: unknown; extension_hold_until?: unknown; extension_answer?: unknown; extension_check_end?: unknown }): string | null {
  const end = row.end_date ? String(row.end_date).slice(0, 10) : null;
  return extendHeldUntil(row) || end;
}

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

/** Columns of a rental needed by bookableEnd. */
export const BOOKABLE_END_COLUMNS = "end_date, extension_hold_until";

/**
 * Up to when a rental keeps its vehicle off new bookings, as an end date: the rental's end, or later while the vehicle
 * is held for the renter to extend (rentals.extension_hold_until, worked out by supabase/migrations/0125_extension_hold.sql).
 * Null for no end date. Used wherever customers see availability (booking page and embedded checkout, rove.rent,
 * partner search, booking-link re-holds, inbox reply drafts). The owner's own booking form doesn't block on the hold:
 * the owner sees it on the calendar and the booking, and can release it.
 */
export function bookableEnd(row: { end_date?: unknown; extension_hold_until?: unknown }): string | null {
  const end = row.end_date ? String(row.end_date).slice(0, 10) : null;
  if (!end) return null;
  const held = row.extension_hold_until ? String(row.extension_hold_until).slice(0, 10) : null;
  return held && held > end ? held : end;
}

/** PostgREST `or` filter: rentals still keeping their vehicle on or after `startDate` (no end, end date, or extension hold). */
export function busyOnOrAfter(startDate: string) {
  return `end_date.is.null,end_date.gte.${startDate},extension_hold_until.gt.${startDate}`;
}

export function overlaps(startDate: string, endDate: string | null, period: Pick<BusyPeriod, "startDate" | "endDate">) {
  return startDate < holdEnd(period.startDate, period.endDate) && period.startDate < holdEnd(startDate, endDate);
}

export function findConflict(periods: BusyPeriod[], startDate: string, endDate: string | null, excludeRentalId?: string | null, today = new Date().toISOString().slice(0, 10)) {
  if (!startDate) return null;
  return (
    periods.find((period) => {
      if (period.rentalId === excludeRentalId) return false;
      // A vehicle still with its customer past the due date is not back yet: it holds the car up to today,
      // so a booking starting today clashes instead of slipping through. Later dates are left alone, as
      // a day late should not block next month.
      const held = period.out && period.endDate && period.endDate <= today ? { ...period, endDate: addDay(today) } : period;
      return overlaps(startDate, endDate, held);
    }) || null
  );
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat(englishDateLocale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

export function conflictMessage(period: BusyPeriod, customerId?: string | null) {
  if (period.heldForExtension) return `Held for extension: ${period.customerName || "the renter"} wants to extend. Confirm or release the hold first.`;
  // The clash is this customer's own booking (often one recorded earlier for the same rental): say so.
  if (customerId && period.customerId === customerId) {
    const span = period.endDate ? `${shortDate(period.startDate)} to ${shortDate(period.endDate)}` : `from ${shortDate(period.startDate)}`;
    return `This customer already has a booking on this vehicle: ${period.code || "another booking"}, ${span}. Open that booking to change it.`;
  }
  const when = period.endDate ? `from ${shortDate(period.startDate)} to ${shortDate(period.endDate)}` : `from ${shortDate(period.startDate)} with no end date`;
  const who = [period.code, period.customerName].filter(Boolean).join(", ");
  return `This vehicle is already booked ${when}${who ? ` (${who})` : ""}. Choose other dates or another vehicle.`;
}

/** Busy periods for one or more vehicles, keyed by vehicle id. */
export async function loadBusyPeriods(supabase: any, organizationId: string, vehicleIds?: string[]) {
  let query = supabase
    .from("rentals")
    .select(`id, vehicle_id, customer_id, display_code, reference, start_date, status, ${EXTEND_HOLD_COLUMNS}, customers!rentals_customer_id_fkey(full_name)`)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", BLOCKING_RENTAL_STATUSES as unknown as string[]);
  if (vehicleIds?.length) query = query.in("vehicle_id", vehicleIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // A rental that changed vehicle holds the vehicle it is on now only from the day of the change, not from its start.
  const onSince = await currentVehicleSince(supabase, organizationId, (data || []) as any[]);

  const byVehicle: Record<string, BusyPeriod[]> = {};
  for (const row of data || []) {
    if (!row.vehicle_id || !row.start_date) continue;
    (byVehicle[row.vehicle_id] ||= []).push({
      rentalId: row.id,
      code: row.display_code || row.reference || null,
      customerName: row.customers?.full_name || null,
      customerId: row.customer_id || null,
      startDate: onSince[row.id] || String(row.start_date).slice(0, 10),
      endDate: row.end_date ? String(row.end_date).slice(0, 10) : null,
      out: (OUT_RENTAL_STATUSES as readonly string[]).includes(String(row.status || ""))
    });
    // The renter said "Extend" and it isn't applied yet: the held days block the team's bookings too (same rental id,
    // so the rental's own date changes and extension aren't blocked by its own hold).
    const held = extendHeldUntil(row);
    if (held) {
      byVehicle[row.vehicle_id].push({
        rentalId: row.id,
        code: row.display_code || row.reference || null,
        customerName: row.customers?.full_name || null,
        startDate: String(row.end_date).slice(0, 10),
        endDate: held,
        heldForExtension: true
      });
    }
  }
  await addSwappedOffPeriods(supabase, organizationId, vehicleIds, byVehicle);
  for (const list of Object.values(byVehicle)) list.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return byVehicle;
}

/** For rentals that changed vehicle: the day each one moved onto the vehicle it is on now, keyed by rental id. */
async function currentVehicleSince(supabase: any, organizationId: string, rentals: any[]): Promise<Record<string, string>> {
  const since: Record<string, string> = {};
  const ids = rentals.map((row) => row.id).filter(Boolean);
  if (ids.length === 0) return since;
  const { data: changes, error } = await supabase.from("vehicle_changes").select(VEHICLE_CHANGE_COLUMNS).eq("organization_id", organizationId).in("rental_id", ids);
  if (error || !changes?.length) return since;
  const changed = new Set((changes as VehicleChangeRow[]).map((change) => change.rental_id));
  for (const row of rentals) {
    if (!changed.has(row.id)) continue;
    const periods = rentalVehiclePeriods(row, changes as VehicleChangeRow[]);
    const last = periods[periods.length - 1];
    if (periods.length > 1 && last?.vehicleId === row.vehicle_id) since[row.id] = last.start;
  }
  return since;
}

/**
 * A rental that changed vehicle holds the earlier vehicle from its start up to (not including) the day of the change,
 * and nothing after it (lib/rental-vehicle-periods.ts). Rentals are read by their current vehicle above, so those
 * earlier spells are added here; a back-dated booking on the earlier vehicle then can't land on them.
 */
async function addSwappedOffPeriods(supabase: any, organizationId: string, vehicleIds: string[] | undefined, byVehicle: Record<string, BusyPeriod[]>) {
  let touching = supabase.from("vehicle_changes").select("rental_id").eq("organization_id", organizationId);
  if (vehicleIds?.length) touching = touching.in("from_vehicle_id", vehicleIds);
  const { data: touched } = await touching;
  const rentalIds = Array.from(new Set(((touched || []) as Array<{ rental_id: string }>).map((row) => row.rental_id)));
  if (rentalIds.length === 0) return;
  const [rentalsResult, changesResult] = await Promise.all([
    supabase
      .from("rentals")
      .select("id, vehicle_id, original_vehicle_id, customer_id, display_code, reference, start_date, end_date, status, customers!rentals_customer_id_fkey(full_name)")
      .eq("organization_id", organizationId)
      .in("id", rentalIds)
      .is("deleted_at", null)
      .in("status", BLOCKING_RENTAL_STATUSES as unknown as string[]),
    supabase.from("vehicle_changes").select(VEHICLE_CHANGE_COLUMNS).eq("organization_id", organizationId).in("rental_id", rentalIds)
  ]);
  if (rentalsResult.error || changesResult.error) return;
  const wanted = vehicleIds?.length ? new Set(vehicleIds) : null;
  for (const row of splitRentalsByVehicle((rentalsResult.data || []) as any[], (changesResult.data || []) as VehicleChangeRow[])) {
    if (!swappedOut(row) || (wanted && !wanted.has(row.vehicle_id))) continue;
    (byVehicle[row.vehicle_id] ||= []).push({
      rentalId: row.id,
      code: row.display_code || row.reference || null,
      customerName: row.customers?.full_name || null,
      customerId: row.customer_id || null,
      startDate: String(row.start_date).slice(0, 10),
      endDate: row.end_date ? String(row.end_date).slice(0, 10) : null
    });
  }
}

export const PARKED_MESSAGE = "This vehicle is parked: your plan has room for fewer vehicles. Choose another vehicle or move up a plan.";

/** The database refused a booking on a parked vehicle (trigger rentals_block_parked_vehicle). */
export function isParkedVehicleError(error: { message?: string } | null | undefined) {
  return !!error && String(error.message || "").includes("vehicle_parked");
}

/** Returns a friendly message when the dates clash with another booking, else null. */
export async function vehicleConflictMessage(
  supabase: any,
  args: { organizationId: string; vehicleId: string; startDate: string; endDate: string | null; excludeRentalId?: string | null; customerId?: string | null }
) {
  // Parked (over the plan's vehicle limit): no new bookings and nothing moved onto it; its own rental carries on.
  const { data: vehicle } = await supabase.from("vehicles").select("parked_at").eq("id", args.vehicleId).maybeSingle();
  if (vehicle?.parked_at) {
    const { data: own } = args.excludeRentalId ? await supabase.from("rentals").select("vehicle_id").eq("id", args.excludeRentalId).maybeSingle() : { data: null };
    if (own?.vehicle_id !== args.vehicleId) return PARKED_MESSAGE;
  }
  const busy = await loadBusyPeriods(supabase, args.organizationId, [args.vehicleId]);
  const conflict = findConflict(busy[args.vehicleId] || [], args.startDate, args.endDate, args.excludeRentalId);
  return conflict ? conflictMessage(conflict, args.customerId) : null;
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

