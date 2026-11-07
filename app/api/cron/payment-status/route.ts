import { sendDailyCustomerReminders } from "@/lib/customer-reminders";
import { runExtensionHolds } from "@/lib/extension-hold";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { wallTimeToIso } from "@/lib/business-time";
import { niceMoney } from "@/lib/nice-money";
import { topUpOpenEndedRent } from "@/lib/open-ended-billing";
import { releaseExpiredHoldsEverywhere } from "@/lib/booking-holds";
import { alertLateReturns } from "@/lib/late-returns";
import { syncAllVehicleStatuses } from "@/lib/vehicle-status";
import { refreshAllRenters } from "@/lib/renters";
import { sendTrialNudges } from "@/lib/trial-nudges";
import { postDueComplianceInstalments } from "@/lib/compliance-billing";
import { runIdPhotoRetention } from "@/lib/privacy/erase";
import { addDaysIso, orgTimeZone, runDailyJob, supabaseRunStore } from "@/lib/scheduled-runs";

/**
 * Called every hour by Vercel Cron (vercel.json).
 *
 *  - Every hour, for everyone: holds that have run out are released (they end by the hour, not the day).
 *  - Once a day at 01:00 UTC, for everyone: renters refreshed, ID-photo retention, old scheduled_runs rows cleared.
 *    None of these is tied to a business's clock and all are safe to repeat.
 *  - At 09:00 on each business's own clock (lib/scheduled-runs.ts), once per local day: customer reminders, late
 *    returns, rent top-ups, vehicle statuses, trial nudges, monthly paperwork costs, scheduled -> pending -> overdue
 *    and "payment due tomorrow" jobs, all on that business's date.
 */
const HOUSEKEEPING_UTC_HOUR = 1;

// The payment's own currency (a UK business's pounds), not always baht.
function amountText(amount: number, currency: string | null | undefined) {
  return niceMoney(amount, currency || "THB");
}

type Totals = {
  scheduledToPending: number;
  pendingToOverdue: number;
  tasksCreated: number;
  openEndedToppedUp: number;
  lateReturnAlerts: number;
  customerReminders: Record<string, number>;
  trialNudges: number;
  complianceInstalments: number;
  extensionChecks: number;
  extensionHoldsLapsed: number;
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "";
  // With no secret configured, "Bearer undefined" would have been accepted.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient() as any;
  const store = supabaseRunStore(supabase);
  const now = new Date();

  const { data: orgs, error: orgsError } = await supabase.from("organizations").select("id, timezone, country_code, settings").is("deleted_at", null);
  if (orgsError) return NextResponse.json({ error: orgsError.message }, { status: 500 });
  const zones = new Map<string, string>(((orgs || []) as any[]).map((org) => [String(org.id), orgTimeZone(org)]));

  // ── Every hour ───────────────────────────────────────────────────────────
  const holdsReleased = await releaseExpiredHoldsEverywhere(supabase, (id) => zones.get(id)).catch(() => 0);

  // ── Once a day, not tied to any business's clock ─────────────────────────
  let housekeeping: Record<string, unknown> | null = null;
  if (now.getUTCHours() === HOUSEKEEPING_UTC_HOUR) {
    // RoveHQ's copy of renters who said yes: rentals move on (returned, paid, deposit settled), so it is refreshed daily.
    const rentersRefreshed = await refreshAllRenters(supabase).catch(() => 0);
    // Renters' ID photos N months after their last rental (lib/privacy/erase.ts): a dry run that only logs unless
    // ID_PHOTO_RETENTION=on, and then only for businesses that switched it on. 200 at most per run.
    const idPhotoRetention = await runIdPhotoRetention(supabase).catch(() => null);
    await store.prune?.(60).catch(() => null);
    housekeeping = { rentersRefreshed, idPhotoRetention };
  }

  // ── 09:00 on each business's clock ───────────────────────────────────────
  const totals: Totals = {
    scheduledToPending: 0,
    pendingToOverdue: 0,
    tasksCreated: 0,
    openEndedToppedUp: 0,
    lateReturnAlerts: 0,
    customerReminders: {},
    trialNudges: 0,
    complianceInstalments: 0,
    extensionChecks: 0,
    extensionHoldsLapsed: 0
  };
  const errors: string[] = [];

  const run = await runDailyJob({
    job: "customer_reminders",
    orgs: (orgs || []) as any[],
    store,
    at: now,
    // Runs inside the group's time zone: businessToday() anywhere below is their date.
    work: async ({ zone, localDate, orgs: due }) => {
      const ids = due.map((org) => String(org.id));
      const today = localDate;
      const tomorrow = addDaysIso(localDate, 1);

      // Open-ended rentals are billed a year ahead at handover; keep adding months after that.
      totals.openEndedToppedUp += await topUpOpenEndedRent(supabase, ids).catch(() => 0);
      totals.lateReturnAlerts += await alertLateReturns(supabase, ids).catch(() => 0);
      // After holds are released: each vehicle shows as on rent, booked or available to match its bookings.
      await syncAllVehicleStatuses(supabase, ids).catch(() => 0);
      // Handover tomorrow, return coming up, rent due or late, service due: each sent once.
      const reminders = await sendDailyCustomerReminders(supabase, { organizationIds: ids }).catch(() => null);
      for (const [kind, count] of Object.entries(reminders || {})) totals.customerReminders[kind] = (totals.customerReminders[kind] || 0) + Number(count || 0);
      // Hold for extension: unanswered holds lift 2 days before the end; monthly renters ending in a week are asked if they're extending.
      const holds = await runExtensionHolds(supabase, ids, today).catch(() => null);
      totals.extensionChecks += holds?.asked || 0;
      totals.extensionHoldsLapsed += holds?.lapsed || 0;
      // New businesses that stalled in their first week: one nudge towards their next step on day 1, 3 and 7.
      totals.trialNudges += await sendTrialNudges(supabase, ids).catch(() => 0);
      // Insurance or tax paid every month: this month's instalment is added as a cost on its day, until the cover runs out.
      totals.complianceInstalments += await postDueComplianceInstalments(supabase, { organizationIds: ids, today }).catch(() => 0);

      const scheduledResult = await supabase
        .from("rental_payments")
        .update({ status: "pending" })
        .in("organization_id", ids)
        .eq("status", "scheduled")
        .eq("due_date", today)
        .or("voided.is.null,voided.eq.false")
        .select("id");
      totals.scheduledToPending += scheduledResult.data?.length || 0;

      const overdueResult = await supabase
        .from("rental_payments")
        .update({ status: "overdue" })
        .in("organization_id", ids)
        .eq("status", "pending")
        .lt("due_date", today)
        .or("voided.is.null,voided.eq.false")
        .select("id");
      totals.pendingToOverdue += overdueResult.data?.length || 0;

      const { data: dueTomorrow, error: dueTomorrowError } = await supabase
        .from("rental_payments")
        .select(
          `
          id, amount, currency, due_date, rental_id,
          rentals!rental_payments_rental_id_fkey(
            id, organization_id, customer_id, vehicle_id,
            customers!rentals_customer_id_fkey(full_name),
            vehicles!rentals_vehicle_id_fkey(make, model, registration_number)
          )
        `
        )
        .in("organization_id", ids)
        .eq("status", "scheduled")
        .eq("due_date", tomorrow)
        .or("voided.is.null,voided.eq.false");
      if (dueTomorrowError) {
        errors.push(`${zone}: ${dueTomorrowError.message}`);
        return;
      }

      for (const payment of dueTomorrow || []) {
        const rental = payment.rentals;
        if (!rental?.organization_id) continue;

        const { data: existingTask } = await supabase
          .from("tasks")
          .select("id")
          .eq("organization_id", rental.organization_id)
          .eq("rental_payment_id", payment.id)
          .is("deleted_at", null)
          .limit(1);

        if (existingTask?.length) continue;

        const customerName = rental.customers?.full_name || "Customer";
        const vehicle = rental.vehicles || {};
        const vehicleLabel = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "vehicle";
        const plate = vehicle.registration_number ? ` (${vehicle.registration_number})` : "";
        const { error: taskError } = await supabase.from("tasks").insert({
          organization_id: rental.organization_id,
          vehicle_id: rental.vehicle_id || null,
          rental_id: rental.id,
          rental_payment_id: payment.id,
          title: `Payment due tomorrow - ${customerName}`,
          task_type: "payment_reminder",
          // 09:00 on the business's clock on the due date (was 09:00 UTC).
          due_at: wallTimeToIso(`${payment.due_date}T09:00`, zone) || `${payment.due_date}T09:00:00.000Z`,
          completion_notes: `${amountText(Number(payment.amount || 0), payment.currency)} due for ${vehicleLabel}${plate}`,
          created_by: null
        });

        if (!taskError) {
          totals.tasksCreated += 1;
        }
      }
    }
  });

  return NextResponse.json({
    success: errors.length === 0,
    ...(errors.length ? { errors } : {}),
    holdsReleased,
    housekeeping,
    remindersRan: run.ran,
    remindersAlreadyDone: run.alreadyDone,
    guard: run.guard,
    ...totals
  });
}
