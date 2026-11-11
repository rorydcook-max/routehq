import { businessNow } from "@/lib/business-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fleetAverageUtilization, loadFleetFigures } from "@/lib/fleet-metrics";
import { getTaskList, type TaskListItem } from "@/lib/tasks";
import { isRunningCost, moneyInAmount } from "@/lib/transaction-options";
import { withShares } from "@/lib/cost-spread";
import { SERVICE_COST_TYPES } from "@/lib/vehicle-service";
import { rentalsForVehicle } from "@/lib/rental-vehicle-periods";

/** The rental that matters now: the one the car is out on, else the soonest booking. */
export function rentalHappeningNow<T extends { status?: string | null; start_date?: string | null }>(rentals: T[] | null | undefined): T | null {
  const list = (rentals || []).slice().sort((a, b) => String(a.start_date || "").localeCompare(String(b.start_date || "")));
  return list.find((r) => r.status !== "booked") || list[0] || null;
}

export type VehicleDetailDocument = {
  id: string;
  fileName: string;
  category: string;
  mimeType: string | null;
  storageBucket: string;
  storagePath: string;
  url: string | null;
  createdAt: string;
  extractedData: Record<string, unknown>;
};

export type VehicleDetail = {
  /** The business's country and currency, set by the page: which paperwork applies, and money shown in it. */
  country?: string;
  currency?: string;
  vehicle: any;
  category: { id: string; code: string; name: string } | null;
  activeRental: any | null;
  inspections: any[];
  transactions: any[];
  maintenanceEvents: any[];
  complianceEvents: any[];
  rentals: any[];
  documents: VehicleDetailDocument[];
  activityEvents: any[];
  reminders: any[];
  vehicleTasks: TaskListItem[];
  gpsDevice: any | null;
  latestLocation: any | null;
  photos: VehicleDetailDocument[];
  financials: {
    currentMonthRevenue: number;
    lifetimeRevenue: number;
    lifetimeExpenses: number;
    lifetimeProfit: number;
    purchasePrice: number;
    estimatedValue: number;
    depreciation: number;
    roi: number;
    monthlyChart: Array<{ label: string; revenue: number; expenses: number }>;
  };
  utilization: {
    twelveMonth: number;
    lifecycle: number;
    fleetAverage: number;
    daysRentedThisYear: number;
    daysAvailableThisYear: number;
    daysMaintenanceThisYear: number;
    averageDailyRate: number;
    desiredDailyRate: number;
    /** The vehicle's life so far (lifecycle summary on the Rentals tab). */
    ownedSince: string;
    daysOwned: number;
    rentalsCount: number;
    daysRentedAll: number;
    /** Share of days on rent in the last 30 / 90 / 365 days (or since it joined the fleet, if later). */
    last30: number;
    last90: number;
    last365: number;
  };
};

/**
 * Servicing and repairs that exist only as money entries (imported from a sheet, or recorded before the service
 * history was kept) join the vehicle's service history, so the two never disagree (Rory, 11 Nov 2026).
 */
function withMoneyOnlyWork(events: any[], transactions: any[]) {
  const linked = new Set(events.map((event) => event.transaction_id).filter(Boolean));
  const extra = transactions
    .filter((row) => SERVICE_COST_TYPES[String(row.type)] && !row.voided && !linked.has(row.id))
    .map((row) => ({
      id: `money-${row.id}`,
      transaction_id: row.id,
      event_type: SERVICE_COST_TYPES[String(row.type)],
      service_date: String(row.transaction_date || "").slice(0, 10),
      mileage: row.mileage ?? null,
      cost: Number(row.amount) || null,
      supplier: row.supplier || null,
      notes: row.notes || null
    }))
    .filter((event) => event.service_date);
  if (extra.length === 0) return events;
  return [...events, ...extra].sort((a, b) => String(b.service_date || "").localeCompare(String(a.service_date || "")));
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(start: Date, end: Date) {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function dateFromIso(value: string | null | undefined) {
  return value ? startOfDay(new Date(value)) : null;
}

function overlapDays(start: Date, end: Date, windowStart: Date, windowEnd: Date) {
  const effectiveStart = start > windowStart ? start : windowStart;
  const effectiveEnd = end < windowEnd ? end : windowEnd;
  // Inclusive: a rental out and back on the same day is one day on rent (">" counted it as none).
  return effectiveEnd >= effectiveStart ? daysBetween(effectiveStart, effectiveEnd) + 1 : 0;
}

function isExpense(transaction: { type: string; is_deposit?: boolean | null; isDeposit?: boolean | null }) {
  return isRunningCost({ isDeposit: transaction.is_deposit ?? transaction.isDeposit, type: transaction.type });
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleString("en", { month: "short" });
}

function buildMonthlyChart(transactions: any[]) {
  const now = businessNow();
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    return {
      key: monthKey(date),
      label: monthLabel(date),
      revenue: 0,
      expenses: 0
    };
  });
  const byMonth = new Map(months.map((month) => [month.key, month]));

  transactions.forEach((transaction) => {
    const date = dateFromIso(transaction.transaction_date);
    if (!date) {
      return;
    }
    const entry = byMonth.get(monthKey(date));
    if (!entry) {
      return;
    }
    const amount = Math.abs(toNumber(transaction.amount));
    const moneyIn = moneyInAmount({ amount: toNumber(transaction.amount), isDeposit: transaction.is_deposit, type: transaction.type });
    if (moneyIn !== 0) {
      entry.revenue += moneyIn;
    } else if (isExpense(transaction)) {
      entry.expenses += amount;
    }
  });

  return months.map(({ key, ...month }) => month);
}

function calculateFinancials(vehicle: any, transactions: any[]) {
  const now = businessNow();
  const currentMonth = monthKey(now);
  let currentMonthRevenue = 0;
  let lifetimeRevenue = 0;
  let lifetimeExpenses = 0;

  transactions.forEach((transaction) => {
    const amount = Math.abs(toNumber(transaction.amount));
    const moneyIn = moneyInAmount({ amount: toNumber(transaction.amount), isDeposit: transaction.is_deposit, type: transaction.type });
    if (moneyIn !== 0) {
      lifetimeRevenue += moneyIn;
      if (dateFromIso(transaction.transaction_date) && monthKey(new Date(transaction.transaction_date)) === currentMonth) {
        currentMonthRevenue += moneyIn;
      }
    } else if (isExpense(transaction)) {
      lifetimeExpenses += amount;
    }
  });

  const purchasePrice = toNumber(vehicle.purchase_price);
  const estimatedValue = toNumber(vehicle.estimated_value);
  const lifetimeProfit = lifetimeRevenue - lifetimeExpenses;
  const depreciation = Math.max(0, purchasePrice - estimatedValue);

  return {
    currentMonthRevenue,
    lifetimeRevenue,
    lifetimeExpenses,
    lifetimeProfit,
    purchasePrice,
    estimatedValue,
    depreciation,
    roi: purchasePrice > 0 ? (lifetimeProfit / purchasePrice) * 100 : 0,
    // A year's insurance or tax shows as a share in each month it covers, not all in the month it was paid.
    monthlyChart: buildMonthlyChart(withShares(transactions))
  };
}

function calculateUtilization(vehicle: any, rentals: any[], transactions: any[], fleetVehicles: any[]) {
  const today = startOfDay(businessNow());
  const twelveMonthStart = new Date(today);
  twelveMonthStart.setDate(today.getDate() - 365);
  const rentalWindows = rentals
    // A booking that has not been handed over yet is not time on rent.
    .filter((rental) => rental.status !== "cancelled" && rental.status !== "booked")
    .map((rental) => {
      const start = dateFromIso(rental.start_date) || today;
      const end = dateFromIso(rental.end_date) || today;
      return { start, end, rental };
    });
  // A rental recorded from before the vehicle was added means it was in the fleet by then (as lib/fleet-metrics.ts counts it).
  const firstRental = rentalWindows.reduce<Date | null>((earliest, item) => (!earliest || item.start < earliest ? item.start : earliest), null);
  const added = dateFromIso(vehicle.purchase_date) || dateFromIso(vehicle.created_at) || today;
  const ownedSince = firstRental && firstRental < added ? (firstRental < today ? firstRental : today) : added;
  // "This year" starts when you got the vehicle if that was after 1 January,
  // so a car added last week does not show hundreds of idle days.
  const januaryFirst = new Date(today.getFullYear(), 0, 1);
  const yearStart = ownedSince > januaryFirst ? ownedSince : januaryFirst;

  const daysRentedLast365 = rentalWindows.reduce((total, item) => total + overlapDays(item.start, item.end, twelveMonthStart, today), 0);
  const daysRentedLifecycle = rentalWindows.reduce((total, item) => total + overlapDays(item.start, item.end, ownedSince, today), 0);
  const daysRentedThisYear = rentalWindows.reduce((total, item) => total + overlapDays(item.start, item.end, yearStart, today), 0);
  const daysInYearSoFar = Math.max(1, daysBetween(yearStart, today) + 1);
  const lifecycleDays = Math.max(1, daysBetween(ownedSince, today) + 1);
  const totalRentalRevenue = transactions.reduce(
    (sum, transaction) => sum + moneyInAmount({ amount: Math.abs(toNumber(transaction.amount)), isDeposit: transaction.is_deposit, type: transaction.type }),
    0
  );
  const totalRentalDays = rentalWindows.reduce((sum, item) => sum + Math.max(1, daysBetween(item.start, item.end) + 1), 0);
  const maintenanceThisYear = vehicle.status === "maintenance" ? 1 : 0;
  // The same figure as the fleet page's "How busy" (lib/fleet-metrics.ts): archived vehicles left out.
  const fleetAverage =
    fleetVehicles.length > 0
      ? fleetAverageUtilization(fleetVehicles.map((item) => ({ utilization: toNumber(item.utilization_12_month), archived: Boolean(item.archived) })))
      : toNumber(vehicle.utilization_12_month);

  // The fleet list and this page must agree, so both use the fleet figures:
  // days on rent out of the days you have had the vehicle (at most the last
  // 12 months). Dividing by 365 made a car added last week look idle.
  const own = fleetVehicles.find((item) => item.id === vehicle.id);
  // Days on rent in a recent window, out of the days it was in the fleet during that window.
  const recent = (days: number) => {
    const start = new Date(today);
    start.setDate(today.getDate() - (days - 1));
    const from = ownedSince > start ? ownedSince : start;
    const windowDays = Math.max(1, daysBetween(from, today) + 1);
    const rented = rentalWindows.reduce((total, item) => total + overlapDays(item.start, item.end, from, today), 0);
    return Math.min(100, (rented / windowDays) * 100);
  };

  return {
    ownedSince: `${ownedSince.getFullYear()}-${String(ownedSince.getMonth() + 1).padStart(2, "0")}-${String(ownedSince.getDate()).padStart(2, "0")}`,
    daysOwned: lifecycleDays,
    rentalsCount: rentalWindows.length,
    daysRentedAll: daysRentedLifecycle,
    last30: recent(30),
    last90: recent(90),
    last365: recent(365),
    twelveMonth: own ? toNumber(own.utilization_12_month) : Math.min(100, (daysRentedLast365 / 365) * 100),
    lifecycle: own ? toNumber(own.utilization_lifecycle) : Math.min(100, (daysRentedLifecycle / lifecycleDays) * 100),
    fleetAverage,
    daysRentedThisYear,
    daysAvailableThisYear: Math.max(0, daysInYearSoFar - daysRentedThisYear - maintenanceThisYear),
    daysMaintenanceThisYear: maintenanceThisYear,
    averageDailyRate: totalRentalDays > 0 ? totalRentalRevenue / totalRentalDays : 0,
    desiredDailyRate: toNumber(vehicle.monthly_rate) > 0 ? toNumber(vehicle.monthly_rate) / 30 : toNumber(vehicle.daily_rate)
  };
}

async function addDocumentUrls(supabase: any, documents: any[]): Promise<VehicleDetailDocument[]> {
  return Promise.all(
    documents.map(async (document) => {
      const { data } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 60 * 60);
      return {
        id: document.id,
        fileName: document.file_name,
        category: document.category,
        mimeType: document.mime_type,
        storageBucket: document.storage_bucket,
        storagePath: document.storage_path,
        url: data?.signedUrl || null,
        createdAt: document.created_at,
        extractedData: document.extracted_data || {}
      };
    })
  );
}

async function createSignedPath(supabase: any, storagePath: string | null | undefined) {
  if (!storagePath || /^https?:\/\//.test(storagePath) || storagePath.startsWith("data:")) {
    return storagePath || null;
  }

  const { data } = await supabase.storage.from("documents").createSignedUrl(storagePath, 60 * 60);
  return data?.signedUrl || null;
}

async function addInspectionUrls(supabase: any, inspections: any[]) {
  return Promise.all(
    inspections.map(async (inspection) => {
      const photos = Array.isArray(inspection.photos) ? inspection.photos : [];
      const damageItems = Array.isArray(inspection.damage_items) ? inspection.damage_items : [];
      const signedPhotos = await Promise.all(
        photos.map(async (photo: any) => ({
          ...photo,
          signed_url: await createSignedPath(supabase, photo.url)
        }))
      );
      const signedDamageItems = await Promise.all(
        damageItems.map(async (item: any) => ({
          ...item,
          photo_url: await createSignedPath(supabase, item.photo_url)
        }))
      );

      return {
        ...inspection,
        photos: signedPhotos,
        damage_items: signedDamageItems,
        signed_video_url: await createSignedPath(supabase, inspection.video_url)
      };
    })
  );
}

function isVehiclePhoto(document: VehicleDetailDocument) {
  if (["photo", "photos", "vehicle_photo", "vehicle_image"].includes(document.category)) return true;
  // A photographed registration book, insurance or receipt is paperwork, not a vehicle photo (test-app-nov8: a logbook
  // picture showed as the "Main photo" with an Enhance button that could only fail).
  if (/logbook|registration|insurance|purchase|receipt|invoice|tax|contract/i.test(String(document.category || ""))) return false;
  return Boolean(document.mimeType?.startsWith("image/"));
}

function vehiclePhotoOrder(document: VehicleDetailDocument) {
  const order = Number(document.extractedData?.vehicle_photo_order);
  return Number.isFinite(order) ? order : null;
}

function sortVehiclePhotos(documents: VehicleDetailDocument[]) {
  return documents
    .filter(isVehiclePhoto)
    .sort((left, right) => {
      const leftOrder = vehiclePhotoOrder(left);
      const rightOrder = vehiclePhotoOrder(right);

      if (leftOrder !== null && rightOrder !== null) {
        return leftOrder - rightOrder;
      }

      if (leftOrder !== null) {
        return -1;
      }

      if (rightOrder !== null) {
        return 1;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
}

const VEHICLE_RENTAL_COLUMNS = "*, customers!rentals_customer_id_fkey(full_name, nationality, phone)";

/**
 * Every rental that spent time on this vehicle, with the dates it was on it: one that changed vehicle shows here only
 * for its own period (lib/rental-vehicle-periods.ts), and names the vehicle it came from or moved to.
 */
async function vehicleRentals(supabase: any, organizationId: string, vehicleId: string, own: any[]) {
  const rows: any[] = await rentalsForVehicle(supabase, { organizationId, vehicleId, rentals: own, select: VEHICLE_RENTAL_COLUMNS }).catch(() => own);
  const otherIds = Array.from(new Set(rows.flatMap((row) => [row.vehicle_period?.fromVehicleId, row.vehicle_period?.toVehicleId]).filter(Boolean)));
  if (otherIds.length === 0) return rows;
  const { data } = await supabase.from("vehicles").select("id, make, model, registration_number").eq("organization_id", organizationId).in("id", otherIds);
  const label = new Map(((data || []) as any[]).map((v) => [v.id, [v.make, v.model].filter(Boolean).join(" ") || String(v.registration_number || "")]));
  return rows
    .map((row) =>
      row.vehicle_period
        ? { ...row, moved_from_label: label.get(row.vehicle_period.fromVehicleId) || null, moved_to_label: label.get(row.vehicle_period.toVehicleId) || null }
        : row
    )
    .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")));
}

export async function getVehicleDetail(vehicleId: string, organizationId: string): Promise<VehicleDetail | null> {
  const supabase = (await createSupabaseServerClient()) as any;

  const vehicleResult = await supabase
    .from("vehicles")
    .select("*, vehicle_categories!vehicles_category_id_fkey(id, code, name)")
    .eq("id", vehicleId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (vehicleResult.error) {
    throw new Error(vehicleResult.error.message);
  }

  if (!vehicleResult.data) {
    return null;
  }

  const vehicle = vehicleResult.data;
  const [
    activeRentalResult,
    inspectionsResult,
    transactionsResult,
    maintenanceResult,
    complianceResult,
    rentalsResult,
    documentsResult,
    eventsResult,
    remindersResult,
    tasksResult,
    gpsResult,
    locationResult,
    fleetResult
  ] = await Promise.all([
    supabase
      .from("rentals")
      .select("*, customers!rentals_customer_id_fkey(full_name, nationality, phone)")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehicleId)
      .in("status", ["booked", "active", "due_soon", "overdue", "extended"])
      .is("deleted_at", null)
      .order("start_date", { ascending: true })
      .limit(20),
    supabase
      .from("inspections")
      .select("*, customers!inspections_customer_id_fkey(full_name, nationality, phone), rentals!inspections_rental_id_fkey(display_code, reference, start_date, end_date)")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("transactions").select("*").eq("organization_id", organizationId).eq("vehicle_id", vehicleId).is("deleted_at", null).order("transaction_date", { ascending: false }),
    supabase.from("maintenance_events").select("*").eq("organization_id", organizationId).eq("vehicle_id", vehicleId).is("deleted_at", null).order("service_date", { ascending: false }),
    supabase.from("compliance_events").select("*").eq("organization_id", organizationId).eq("vehicle_id", vehicleId).is("deleted_at", null).order("expiry_date", { ascending: false }),
    supabase
      .from("rentals")
      .select(VEHICLE_RENTAL_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
    supabase.from("documents").select("*").eq("organization_id", organizationId).eq("owner_type", "vehicle").eq("owner_id", vehicleId).is("deleted_at", null).order("created_at", { ascending: false }),
    // The page shows the recent history; a busy car's whole log was read on every visit.
    supabase.from("activity_events").select("*").eq("organization_id", organizationId).eq("vehicle_id", vehicleId).order("occurred_at", { ascending: false }).limit(100),
    supabase.from("reminders").select("*").eq("organization_id", organizationId).eq("vehicle_id", vehicleId).is("deleted_at", null).order("due_date", { ascending: true }),
    // The same jobs To do shows for this vehicle (payments are read from the schedule, not listed here).
    getTaskList(organizationId)
      .then((items) => ({ data: items.filter((item) => item.kind === "task" && !item.completedAt && !item.coveredBy && item.vehicleId === vehicleId), error: null }))
      .catch(() => ({ data: [] as TaskListItem[], error: null })),
    supabase.from("gps_devices").select("*").eq("organization_id", organizationId).eq("vehicle_id", vehicleId).is("deleted_at", null).maybeSingle(),
    supabase.from("vehicle_locations").select("*").eq("organization_id", organizationId).eq("vehicle_id", vehicleId).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
    // Fleet average utilisation, worked out from rentals (the stored column was never updated).
    loadFleetFigures(supabase, organizationId)
      .then((figures) => ({
        data: Array.from(figures.entries()).map(([id, item]) => ({ id, utilization_12_month: item.utilization12, utilization_lifecycle: item.utilizationLifetime, archived: Boolean(item.archived) })),
        error: null
      }))
      .catch((error: Error) => ({ data: [], error }))
  ]);

  const results = [
    activeRentalResult,
    inspectionsResult,
    transactionsResult,
    maintenanceResult,
    complianceResult,
    rentalsResult,
    documentsResult,
    eventsResult,
    remindersResult,
    tasksResult,
    gpsResult,
    locationResult,
    fleetResult
  ];
  const queryError = results.find((result) => result.error && result.error.code !== "PGRST116")?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  // Signed links for files and inspection photos, fetched side by side rather than one after the other.
  const [documents, inspections] = await Promise.all([addDocumentUrls(supabase, documentsResult.data || []), addInspectionUrls(supabase, inspectionsResult.data || [])]);
  const transactions = transactionsResult.data || [];
  const rentals = await vehicleRentals(supabase, organizationId, vehicleId, rentalsResult.data || []);

  return {
    vehicle,
    category: vehicle.vehicle_categories || null,
    activeRental: rentalHappeningNow(activeRentalResult.data as any[]),
    inspections,
    transactions,
    maintenanceEvents: withMoneyOnlyWork(maintenanceResult.data || [], transactions),
    complianceEvents: complianceResult.data || [],
    rentals,
    documents,
    activityEvents: eventsResult.data || [],
    reminders: remindersResult.data || [],
    vehicleTasks: (tasksResult.data || []) as TaskListItem[],
    gpsDevice: gpsResult.data || null,
    latestLocation: locationResult.data || null,
    photos: sortVehiclePhotos(documents),
    financials: calculateFinancials(vehicle, transactions),
    utilization: calculateUtilization(vehicle, rentals, transactions, fleetResult.data || [])
  };
}
