/**
 * RouteHQ Value Tracker.
 *
 * All activity counts and savings calculations run on the server during
 * dashboard load. Missing optional tables/columns are treated as zero so the
 * dashboard never fails while integrations are still being rolled out.
 */

const TIER_COST: Record<string, number> = {
  starter: 590,
  growth: 990,
  pro: 2490,
  business: 4990
};

const OWNER_RATE_THB_PER_HOUR = 200;
const STAFF_RATE_THB_PER_HOUR = 72;

type FleetManagerProfile = "solo_owner" | "owner_with_staff" | "staff_managed";

export type RouteHQSavingsData = {
  totalHoursSaved: number;
  timeValueThb: number;
  hardSavingsThb: number;
  totalValueThb: number;
  subscriptionCostThb: number;
  aheadByThb: number;
  isEmpty: boolean;
  hasPositiveAhead: boolean;
};

type CountResult = {
  count: number | null;
  error: unknown;
};

async function safeCount(query: PromiseLike<CountResult>): Promise<number> {
  try {
    const result = await query;
    return result.error ? 0 : result.count ?? 0;
  } catch {
    return 0;
  }
}

async function countSubmittedInspections({
  organizationId,
  monthStartIso,
  nowIso,
  supabase,
  type
}: {
  organizationId: string;
  monthStartIso: string;
  nowIso: string;
  supabase: any;
  type: "delivery" | "return";
}) {
  const modern = await supabase
    .from("inspections")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("type", type)
    .eq("status", "submitted")
    .gte("submitted_at", monthStartIso)
    .lte("submitted_at", nowIso)
    .is("deleted_at", null);

  if (!modern.error) return modern.count ?? 0;

  return safeCount(
    supabase
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("inspection_type", type)
      .gte("inspected_at", monthStartIso)
      .lte("inspected_at", nowIso)
      .is("deleted_at", null)
  );
}

export async function getValueTrackerData({
  organizationId,
  subscriptionTier,
  createdAt,
  supabase
}: {
  organizationId: string;
  subscriptionTier: string | null;
  createdAt: string | null;
  supabase: any;
}): Promise<RouteHQSavingsData> {
  const now = new Date();
  const nowIso = now.toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartIso = monthStart.toISOString();
  const monthStartDate = monthStartIso.slice(0, 10);
  const todayDate = nowIso.slice(0, 10);
  const subscriptionCostThb = TIER_COST[subscriptionTier ?? "growth"] ?? 990;

  const orgStart = createdAt ? new Date(createdAt) : now;
  const msActive = Math.max(0, now.getTime() - orgStart.getTime());
  const weeksActive = Math.max(1, Math.ceil(msActive / (7 * 24 * 3600_000)));
  const monthsActive = Math.max(1, Math.ceil(msActive / (30 * 24 * 3600_000)));

  const [
    vehicleCount,
    userCount,
    rentalDurationResult,
    transactionCount,
    bookingCount,
    paymentCount,
    deliveryCount,
    returnCount,
    lineReminderCount,
    complianceAlertsCount,
    orgProfileResult
  ] = await Promise.all([
    safeCount(
      supabase
        .from("vehicles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .not("status", "in", "(inactive,retired)")
        .is("deleted_at", null)
    ),

    safeCount(
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("is_active", true)
    ),

    supabase
      .from("rentals")
      .select("start_date, end_date")
      .eq("organization_id", organizationId)
      .neq("status", "cancelled")
      .not("start_date", "is", null)
      .not("end_date", "is", null)
      .is("deleted_at", null),

    safeCount(
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("transaction_date", monthStartDate)
        .lte("transaction_date", todayDate)
        .is("deleted_at", null)
    ),

    safeCount(
      supabase
        .from("rentals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", monthStartIso)
        .lte("created_at", nowIso)
        .is("deleted_at", null)
    ),

    safeCount(
      supabase
        .from("rental_payments")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", monthStartIso)
        .lte("created_at", nowIso)
        .is("deleted_at", null)
    ),

    countSubmittedInspections({ organizationId, monthStartIso, nowIso, supabase, type: "delivery" }),
    countSubmittedInspections({ organizationId, monthStartIso, nowIso, supabase, type: "return" }),

    safeCount(
      supabase
        .from("line_messages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("type", "payment_reminder")
        .eq("status", "sent")
        .gte("created_at", monthStartIso)
        .lte("created_at", nowIso)
    ),

    safeCount(
      supabase
        .from("reminders")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "sent")
        .gte("created_at", monthStartIso)
        .lte("created_at", nowIso)
    ),

    supabase
      .from("organizations")
      .select("fleet_manager_profile")
      .eq("id", organizationId)
      .maybeSingle()
  ]);

  const rentalsWithDates: Array<{ start_date: string | null; end_date: string | null }> =
    rentalDurationResult.error ? [] : rentalDurationResult.data ?? [];
  const avgRentalDurationDays =
    rentalsWithDates.length > 0
      ? rentalsWithDates.reduce((sum, rental) => {
          if (!rental.start_date || !rental.end_date) return sum;
          const days = Math.ceil((new Date(rental.end_date).getTime() - new Date(rental.start_date).getTime()) / 86_400_000);
          return sum + Math.max(0, days);
        }, 0) / rentalsWithDates.length
      : 14;
  const rentalType = avgRentalDurationDays > 14 ? "long_term" : "short_term";
  void rentalType;

  const savedProfile = orgProfileResult.error
    ? null
    : (orgProfileResult.data?.fleet_manager_profile as FleetManagerProfile | null);
  const profile: FleetManagerProfile =
    savedProfile && ["solo_owner", "owner_with_staff", "staff_managed"].includes(savedProfile)
      ? savedProfile
      : vehicleCount > 8 || userCount > 1
        ? "owner_with_staff"
        : "solo_owner";

  let ownerTaskMinutes = 0;
  let staffTaskMinutes = 0;

  if (profile === "solo_owner") {
    ownerTaskMinutes =
      transactionCount * 7.25 +
      bookingCount * 55 +
      paymentCount * 9.5 +
      deliveryCount * 22 +
      returnCount * 31.5 +
      lineReminderCount * 8 +
      deliveryCount * 15 +
      complianceAlertsCount * 19 +
      weeksActive * 15 +
      monthsActive * 210;
  } else {
    ownerTaskMinutes =
      lineReminderCount * 8 +
      deliveryCount * 15 +
      complianceAlertsCount * 19 +
      weeksActive * 15 +
      monthsActive * 210;

    staffTaskMinutes =
      transactionCount * 7.25 +
      bookingCount * 55 +
      paymentCount * 9.5 +
      deliveryCount * 22 +
      returnCount * 31.5;
  }

  const ownerValueThb = (ownerTaskMinutes / 60) * OWNER_RATE_THB_PER_HOUR;
  const staffValueThb = (staffTaskMinutes / 60) * STAFF_RATE_THB_PER_HOUR;
  const timeValueThb = ownerValueThb + staffValueThb;
  const totalHoursSaved = (ownerTaskMinutes + staffTaskMinutes) / 60;
  const hardSavingsThb = bookingCount * 20 + complianceAlertsCount * 500;
  const totalValueThb = timeValueThb + hardSavingsThb;
  const aheadByThb = totalValueThb - subscriptionCostThb;

  return {
    totalHoursSaved: Math.round(totalHoursSaved * 10) / 10,
    timeValueThb: Math.round(timeValueThb),
    hardSavingsThb: Math.round(hardSavingsThb),
    totalValueThb: Math.round(totalValueThb),
    subscriptionCostThb,
    aheadByThb: Math.round(aheadByThb),
    isEmpty: totalHoursSaved < 0.5 && transactionCount === 0 && bookingCount === 0,
    hasPositiveAhead: aheadByThb > 0
  };
}
