import { businessDay } from "@/lib/business-time";

/**
 * A rental that changed vehicle (in-app "Change vehicle", or "Started on a different vehicle?" on a new booking) keeps
 * rentals.vehicle_id = the vehicle it is on now, rentals.original_vehicle_id = the first one, and one vehicle_changes row
 * per change. Everything that puts a rental on a vehicle (vehicle pages, calendar by vehicle, utilization, reports)
 * splits it into per-vehicle periods here, so the earlier vehicle shows the rental up to the change and the later one
 * from it. Both periods include the day of the change, as a return and a handover on the same day do.
 */

export const VEHICLE_CHANGE_COLUMNS = "rental_id, from_vehicle_id, to_vehicle_id, changed_at, rate_before, rate_after";

export type VehicleChangeRow = {
  rental_id: string;
  from_vehicle_id: string | null;
  to_vehicle_id: string | null;
  changed_at: string;
  rate_before?: number | string | null;
  rate_after?: number | string | null;
};

export type RentalVehiclePeriod = {
  vehicleId: string;
  /** YYYY-MM-DD, both days included. end null: no end date yet. */
  start: string;
  end: string | null;
  /** The vehicle the rental was on before this period (null for the first). */
  fromVehicleId: string | null;
  /** The vehicle it moved to at the end of this period (null for the last). */
  toVehicleId: string | null;
  /** The agreed rate during this period, when the change recorded one. */
  rate: number | null;
};

type RentalLike = {
  id: string;
  vehicle_id?: string | null;
  original_vehicle_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
};

const day = (value: unknown) => (value ? String(value).slice(0, 10) : "");
const rate = (value: unknown) => (value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));

/** The rental's time split by vehicle, oldest first. A rental that never changed vehicle is one period on vehicle_id. */
export function rentalVehiclePeriods(rental: RentalLike, changes: VehicleChangeRow[]): RentalVehiclePeriod[] {
  const start = day(rental.start_date);
  const end = rental.end_date ? day(rental.end_date) : null;
  const current = rental.vehicle_id || null;
  const whole = current && start ? [{ vehicleId: current, start, end, fromVehicleId: null, toVehicleId: null, rate: null }] : [];
  const own = changes
    .filter((change) => change.rental_id === rental.id && change.changed_at)
    .sort((a, b) => String(a.changed_at).localeCompare(String(b.changed_at)));
  // Not handed over yet: a change only moved the booking, so it was never on the earlier vehicle.
  if (!start || own.length === 0 || ["booked", "draft", "cancelled"].includes(String(rental.status || ""))) return whole;

  const periods: RentalVehiclePeriod[] = [];
  let vehicle: string | null = rental.original_vehicle_id || own[0].from_vehicle_id || current;
  let from = start;
  let previous: string | null = null;
  let lastRate: number | null = null;
  for (const change of own) {
    const swap = businessDay(change.changed_at);
    const next = change.to_vehicle_id || current;
    // Moved before it went out: the rental starts on the vehicle it moved to.
    if (swap <= start) {
      vehicle = next;
      lastRate = rate(change.rate_after);
      continue;
    }
    if (end && swap > end) break;
    if (next === vehicle) continue;
    if (vehicle) periods.push({ vehicleId: vehicle, start: from, end: swap, fromVehicleId: previous, toVehicleId: next, rate: rate(change.rate_before) ?? lastRate });
    previous = vehicle;
    vehicle = next;
    from = swap;
    lastRate = rate(change.rate_after);
  }
  const last = current || vehicle;
  if (!last) return periods;
  periods.push({ vehicleId: last, start: from, end, fromVehicleId: previous, toVehicleId: null, rate: periods.length ? lastRate : null });
  return periods;
}

export type VehiclePeriodRow<T> = T & { vehicle_id: string; start_date: string; end_date: string | null; vehicle_period?: RentalVehiclePeriod };

/**
 * One row per rental per vehicle: the rental's own fields, with vehicle_id, start_date and end_date (and rental_rate,
 * where the change recorded one) for that vehicle's period. Rows for a rental that changed vehicle carry vehicle_period.
 */
export function splitRentalsByVehicle<T extends RentalLike>(rentals: T[], changes: VehicleChangeRow[]): Array<VehiclePeriodRow<T>> {
  const changed = new Set(changes.map((change) => change.rental_id));
  const rows: Array<VehiclePeriodRow<T>> = [];
  for (const rental of rentals) {
    if (!changed.has(rental.id)) {
      rows.push(rental as VehiclePeriodRow<T>);
      continue;
    }
    const periods = rentalVehiclePeriods(rental, changes);
    if (periods.length <= 1) {
      rows.push(rental as VehiclePeriodRow<T>);
      continue;
    }
    for (const period of periods) {
      rows.push({
        ...rental,
        vehicle_id: period.vehicleId,
        start_date: period.start,
        end_date: period.end,
        ...(period.rate !== null && "rental_rate" in rental ? { rental_rate: period.rate } : {}),
        vehicle_period: period
      });
    }
  }
  return rows;
}

/** The rental left this vehicle for another one at the end of this row's period. */
export function swappedOut(row: { vehicle_period?: RentalVehiclePeriod | null }) {
  return Boolean(row.vehicle_period?.toVehicleId);
}

/** Every vehicle change in the business (a short table: one row per change), for splitting a list of rentals. */
export async function loadVehicleChanges(supabase: any, organizationId: string): Promise<VehicleChangeRow[]> {
  const { data, error } = await supabase.from("vehicle_changes").select(VEHICLE_CHANGE_COLUMNS).eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
  return (data || []) as VehicleChangeRow[];
}

/**
 * The rentals that spent time on one vehicle, as that vehicle's periods: `rentals` (read by rentals.vehicle_id) plus the
 * ones that have since moved to another vehicle, read with `select`. `keep` filters the rows the same way the caller's
 * own query did (status, dates), on each period's own dates.
 */
export async function rentalsForVehicle<T extends RentalLike>(
  supabase: any,
  args: { organizationId: string; vehicleId: string; rentals: T[]; select: string; keep?: (row: VehiclePeriodRow<T>) => boolean }
): Promise<Array<VehiclePeriodRow<T>>> {
  const { data: touching, error } = await supabase
    .from("vehicle_changes")
    .select("rental_id")
    .eq("organization_id", args.organizationId)
    .or(`from_vehicle_id.eq.${args.vehicleId},to_vehicle_id.eq.${args.vehicleId}`);
  if (error) throw new Error(error.message);
  const rentalIds = Array.from(new Set(((touching || []) as Array<{ rental_id: string }>).map((row) => row.rental_id)));
  if (rentalIds.length === 0) return args.rentals as Array<VehiclePeriodRow<T>>;

  const have = new Set(args.rentals.map((rental) => rental.id));
  const missing = rentalIds.filter((id) => !have.has(id));
  const [changesResult, extraResult] = await Promise.all([
    supabase.from("vehicle_changes").select(VEHICLE_CHANGE_COLUMNS).eq("organization_id", args.organizationId).in("rental_id", rentalIds),
    missing.length
      ? supabase.from("rentals").select(args.select).eq("organization_id", args.organizationId).in("id", missing).is("deleted_at", null)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (changesResult.error || extraResult.error) throw new Error((changesResult.error || extraResult.error).message);
  return splitRentalsByVehicle([...args.rentals, ...((extraResult.data || []) as T[])], (changesResult.data || []) as VehicleChangeRow[]).filter(
    (row) => row.vehicle_id === args.vehicleId && (!args.keep || args.keep(row))
  );
}
