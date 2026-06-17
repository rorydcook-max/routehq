import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TaskListItem } from "@/lib/tasks";
import { isRawDepositTransaction, isRevenueTransaction } from "@/lib/transaction-options";

const expenseTypes = new Set(["repair", "servicing", "maintenance", "fuel", "insurance", "tax", "finance", "fine", "accessories", "refund"]);

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
  };
};

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
  return effectiveEnd > effectiveStart ? daysBetween(effectiveStart, effectiveEnd) + 1 : 0;
}

function isExpense(transaction: { type: string; is_deposit?: boolean | null; isDeposit?: boolean | null }) {
  return !isRawDepositTransaction({ isDeposit: transaction.is_deposit ?? transaction.isDeposit, type: transaction.type }) && expenseTypes.has(transaction.type);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return date.toLocaleString("en", { month: "short" });
}

function buildMonthlyChart(transactions: any[]) {
  const now = new Date();
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
    if (isRevenueTransaction({ amount: toNumber(transaction.amount), isDeposit: transaction.is_deposit, type: transaction.type })) {
      entry.revenue += amount;
    } else if (isExpense(transaction)) {
      entry.expenses += amount;
    }
  });

  return months.map(({ key, ...month }) => month);
}

function calculateFinancials(vehicle: any, transactions: any[]) {
  const now = new Date();
  const currentMonth = monthKey(now);
  let currentMonthRevenue = 0;
  let lifetimeRevenue = 0;
  let lifetimeExpenses = 0;

  transactions.forEach((transaction) => {
    const amount = Math.abs(toNumber(transaction.amount));
    if (isRevenueTransaction({ amount: toNumber(transaction.amount), isDeposit: transaction.is_deposit, type: transaction.type })) {
      lifetimeRevenue += amount;
      if (dateFromIso(transaction.transaction_date) && monthKey(new Date(transaction.transaction_date)) === currentMonth) {
        currentMonthRevenue += amount;
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
    monthlyChart: buildMonthlyChart(transactions)
  };
}

function calculateUtilization(vehicle: any, rentals: any[], transactions: any[], fleetVehicles: any[]) {
  const today = startOfDay(new Date());
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const twelveMonthStart = new Date(today);
  twelveMonthStart.setDate(today.getDate() - 365);
  const ownedSince = dateFromIso(vehicle.purchase_date) || dateFromIso(vehicle.created_at) || today;

  const rentalWindows = rentals
    .filter((rental) => rental.status !== "cancelled")
    .map((rental) => {
      const start = dateFromIso(rental.start_date) || today;
      const end = dateFromIso(rental.end_date) || today;
      return { start, end, rental };
    });

  const daysRentedLast365 = rentalWindows.reduce((total, item) => total + overlapDays(item.start, item.end, twelveMonthStart, today), 0);
  const daysRentedLifecycle = rentalWindows.reduce((total, item) => total + overlapDays(item.start, item.end, ownedSince, today), 0);
  const daysRentedThisYear = rentalWindows.reduce((total, item) => total + overlapDays(item.start, item.end, yearStart, today), 0);
  const daysInYearSoFar = Math.max(1, daysBetween(yearStart, today) + 1);
  const lifecycleDays = Math.max(1, daysBetween(ownedSince, today) + 1);
  const totalRentalRevenue = transactions
    .filter((transaction) =>
      isRevenueTransaction({
        amount: toNumber(transaction.amount),
        isDeposit: transaction.is_deposit,
        type: transaction.type
      })
    )
    .reduce((sum, transaction) => sum + Math.abs(toNumber(transaction.amount)), 0);
  const totalRentalDays = rentalWindows.reduce((sum, item) => sum + Math.max(1, daysBetween(item.start, item.end) + 1), 0);
  const maintenanceThisYear = vehicle.status === "maintenance" ? 1 : 0;
  const fleetAverage =
    fleetVehicles.length > 0
      ? fleetVehicles.reduce((sum, item) => sum + toNumber(item.utilization_12_month), 0) / fleetVehicles.length
      : toNumber(vehicle.utilization_12_month);

  return {
    twelveMonth: Math.min(100, (daysRentedLast365 / 365) * 100),
    lifecycle: Math.min(100, (daysRentedLifecycle / lifecycleDays) * 100),
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
  return document.mimeType?.startsWith("image/") || ["photo", "photos", "vehicle_photo", "vehicle_image"].includes(document.category);
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
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
      .select("*, customers!rentals_customer_id_fkey(full_name, nationality, phone)")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
    supabase.from("documents").select("*").eq("organization_id", organizationId).eq("owner_type", "vehicle").eq("owner_id", vehicleId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("activity_events").select("*").eq("organization_id", organizationId).eq("vehicle_id", vehicleId).order("occurred_at", { ascending: false }),
    supabase.from("reminders").select("*").eq("organization_id", organizationId).eq("vehicle_id", vehicleId).is("deleted_at", null).order("due_date", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, task_type, due_at, completed_at, vehicle_id, rental_id")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehicleId)
      .is("completed_at", null)
      .is("deleted_at", null)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(10),
    supabase.from("gps_devices").select("*").eq("organization_id", organizationId).eq("vehicle_id", vehicleId).is("deleted_at", null).maybeSingle(),
    supabase.from("vehicle_locations").select("*").eq("organization_id", organizationId).eq("vehicle_id", vehicleId).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("vehicles").select("id, utilization_12_month").eq("organization_id", organizationId).is("deleted_at", null)
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

  const documents = await addDocumentUrls(supabase, documentsResult.data || []);
  const inspections = await addInspectionUrls(supabase, inspectionsResult.data || []);
  const transactions = transactionsResult.data || [];
  const rentals = rentalsResult.data || [];

  return {
    vehicle,
    category: vehicle.vehicle_categories || null,
    activeRental: activeRentalResult.data || null,
    inspections,
    transactions,
    maintenanceEvents: maintenanceResult.data || [],
    complianceEvents: complianceResult.data || [],
    rentals,
    documents,
    activityEvents: eventsResult.data || [],
    reminders: remindersResult.data || [],
    vehicleTasks: (tasksResult.data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      taskType: row.task_type,
      dueAt: row.due_at,
      completedAt: row.completed_at,
      vehicleId: row.vehicle_id,
      rentalId: row.rental_id,
      vehicleLabel: [vehicle.registration_number, vehicle.make, vehicle.model].filter(Boolean).join(" ") || null,
      rentalLabel: null
    })),
    gpsDevice: gpsResult.data || null,
    latestLocation: locationResult.data || null,
    photos: sortVehiclePhotos(documents),
    financials: calculateFinancials(vehicle, transactions),
    utilization: calculateUtilization(vehicle, rentals, transactions, fleetResult.data || [])
  };
}
