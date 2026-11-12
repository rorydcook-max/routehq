import { businessToday } from "@/lib/business-time";
import { isRunningCost, moneyInAmount } from "@/lib/transaction-options";
import { loadVehicleChanges, splitRentalsByVehicle, type VehicleChangeRow } from "@/lib/rental-vehicle-periods";

/**
 * Per-vehicle figures worked out from the records themselves. The vehicles
 * table has revenue/profit/utilisation/health columns, but nothing ever kept
 * them up to date, so every car showed 0% and ฿0.
 */

const DAY = 86_400_000;

function toDay(value: string) {
  return Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
}

function overlapDays(start: number, end: number, windowStart: number, windowEnd: number) {
  const from = Math.max(start, windowStart);
  const to = Math.min(end, windowEnd);
  return to >= from ? Math.round((to - from) / DAY) + 1 : 0;
}

/** kmLeft: set when the service is due by km (within 500 km, or past it) rather than by date. */
export type ComplianceItem = { key: string; label: string; date: string; daysLeft: number; kmLeft?: number };

/** A service is flagged this many km before its next-due km. */
export const SERVICE_KM_WARNING = 500;

export type VehicleFigures = {
  revenue: number;
  expenses: number;
  profit: number;
  utilization12: number;
  utilizationLifetime: number;
  compliance: ComplianceItem[];
  healthScore: number;
  /** Archived (status inactive): left out of the fleet average. */
  archived?: boolean;
};

const COMPLIANCE_LABELS: Record<string, string> = {
  tax_expiry_date: "Road tax",
  porbor_expiry_date: "Compulsory insurance",
  insurance_expiry_date: "Insurance",
  next_service_date: "Service",
  // The oil change has its own due date and km: a service often includes one, but not always (Rory, 12 Nov 2026).
  oil_change_due_date: "Oil change"
};

/** Work due by km as well as by date: the date it is listed under, and where its due km is kept. */
const KM_DUE: Array<{ key: string; label: string; field: string }> = [
  { key: "next_service_date", label: "Service", field: "next_service_mileage" },
  { key: "oil_change_due_date", label: "Oil change", field: "oil_change_due_mileage" }
];

export function complianceItems(metadata: any, today = businessToday(), mileage?: number | null): ComplianceItem[] {
  const compliance = metadata?.compliance || {};
  const items = Object.entries(COMPLIANCE_LABELS)
    .map(([key, label]) => {
      const date = String(compliance[key] || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return { key, label, date, daysLeft: Math.round((toDay(date) - toDay(today)) / DAY) } as ComplianceItem;
    })
    .filter((item): item is ComplianceItem => Boolean(item));

  // Service by km, whichever comes first: close to (or past) the km, it is due now even if the date is months away.
  const odometer = Number(mileage || 0);
  for (const work of KM_DUE) {
    const dueKm = Number(compliance[work.field] || 0);
    if (!(dueKm > 0 && odometer > 0 && dueKm - odometer <= SERVICE_KM_WARNING)) continue;
    const kmLeft = dueKm - odometer;
    const byKm: ComplianceItem = { key: work.key, label: work.label, date: today, daysLeft: kmLeft < 0 ? -1 : 0, kmLeft };
    const index = items.findIndex((item) => item.key === work.key);
    if (index === -1) items.push(byKm);
    else if (items[index].daysLeft > byKm.daysLeft) items[index] = byKm;
  }
  return items.sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * How busy the fleet is: the 12-month share of days on rent (utilization12), averaged over the vehicles in the fleet
 * (archived ones left out) and rounded to a whole percent. The fleet page's "How busy" and the vehicle page's
 * "Fleet average" both use this, so they always agree (final pre-release test, 8 Nov 2026: 33% against 25%).
 */
export function fleetAverageUtilization(items: Array<{ utilization: number; archived?: boolean }>) {
  const inFleet = items.filter((item) => !item.archived);
  return inFleet.length ? Math.round(inFleet.reduce((sum, item) => sum + Number(item.utilization || 0), 0) / inFleet.length) : 0;
}

/** Loads what computeVehicleFigures needs for a whole business. */
export async function loadFleetFigures(supabase: any, organizationId: string) {
  const [vehicles, rentals, transactions, changes] = await Promise.all([
    supabase.from("vehicles").select("id, status, purchase_date, created_at, mileage, metadata").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("rentals").select("id, vehicle_id, original_vehicle_id, status, start_date, end_date").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("transactions").select("vehicle_id, amount, type, is_deposit, voided").eq("organization_id", organizationId).is("deleted_at", null),
    loadVehicleChanges(supabase, organizationId)
  ]);
  const error = vehicles.error || rentals.error || transactions.error;
  if (error) throw new Error(error.message);
  return computeVehicleFigures({ vehicles: vehicles.data || [], rentals: rentals.data || [], transactions: transactions.data || [], changes });
}

export function computeVehicleFigures(input: {
  vehicles: any[];
  rentals: any[];
  transactions: any[];
  /** Vehicle changes: a rental that changed vehicle counts on each vehicle for its own days (lib/rental-vehicle-periods.ts). */
  changes?: VehicleChangeRow[];
}): Map<string, VehicleFigures> {
  const rentals = input.changes?.length ? splitRentalsByVehicle(input.rentals, input.changes) : input.rentals;
  const today = businessToday();
  const todayMs = toDay(today);
  const yearAgo = todayMs - 364 * DAY;
  const figures = new Map<string, VehicleFigures>();

  for (const vehicle of input.vehicles) {
    const vehicleTransactions = input.transactions.filter((row) => row.vehicle_id === vehicle.id && !row.voided);
    // Refunds come off what the vehicle brought in; they are not a running cost.
    const revenue = vehicleTransactions.reduce((sum, row) => sum + moneyInAmount({ amount: Number(row.amount || 0), isDeposit: row.is_deposit, type: row.type }), 0);
    const expenses = vehicleTransactions
      .filter((row) => isRunningCost({ isDeposit: row.is_deposit, type: row.type }))
      .reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);

    const rentalSpans = rentals
      .filter((row) => row.vehicle_id === vehicle.id && !["cancelled", "booked"].includes(String(row.status || "")) && row.start_date)
      .map((row) => {
        const start = toDay(String(row.start_date).slice(0, 10));
        const end = row.end_date && String(row.end_date).slice(0, 10) < today ? toDay(String(row.end_date).slice(0, 10)) : todayMs;
        return { start: Math.min(start, todayMs), end };
      })
      // Rented spells from before the bookings were in RoveHQ, worked out from the rent paid (Rory, 2 Nov 2026):
      // vehicles.metadata.rented_periods = [{ start, end }].
      .concat(
        (Array.isArray(vehicle.metadata?.rented_periods) ? vehicle.metadata.rented_periods : [])
          .filter((period: any) => /^\d{4}-\d{2}-\d{2}/.test(String(period?.start || "")) && /^\d{4}-\d{2}-\d{2}/.test(String(period?.end || "")))
          .map((period: any) => ({ start: Math.min(toDay(String(period.start).slice(0, 10)), todayMs), end: Math.min(toDay(String(period.end).slice(0, 10)), todayMs) }))
      )
      .sort((a, b) => a.start - b.start)
      // Overlapping spells (a history spell and the booking that carried it on) count once.
      .reduce((merged: Array<{ start: number; end: number }>, span) => {
        const last = merged[merged.length - 1];
        if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
        else merged.push({ ...span });
        return merged;
      }, []);

    const ownedSince = [vehicle.purchase_date, vehicle.created_at]
      .map((value) => String(value || "").slice(0, 10))
      .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
      .map(toDay)
      .concat(rentalSpans.map((span) => span.start))
      .reduce((earliest, value) => Math.min(earliest, value), todayMs);

    const windowStart = Math.max(yearAgo, ownedSince);
    const windowDays = Math.max(1, Math.round((todayMs - windowStart) / DAY) + 1);
    const lifetimeDays = Math.max(1, Math.round((todayMs - ownedSince) / DAY) + 1);
    const rented12 = rentalSpans.reduce((sum, span) => sum + overlapDays(span.start, span.end, windowStart, todayMs), 0);
    const rentedLifetime = rentalSpans.reduce((sum, span) => sum + overlapDays(span.start, span.end, ownedSince, todayMs), 0);

    const compliance = complianceItems(vehicle.metadata, today, vehicle.mileage);
    // Health reflects paperwork: anything expired costs a lot, anything due within 30 days a little.
    const healthScore = Math.max(
      0,
      100 -
        compliance.filter((item) => item.daysLeft < 0).length * 35 -
        compliance.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 30).length * 10
    );

    figures.set(vehicle.id, {
      revenue,
      expenses,
      profit: revenue - expenses,
      utilization12: Math.min(100, Math.round((rented12 / windowDays) * 100)),
      utilizationLifetime: Math.min(100, Math.round((rentedLifetime / lifetimeDays) * 100)),
      compliance,
      healthScore,
      archived: String(vehicle.status || "") === "inactive"
    });
  }

  return figures;
}
