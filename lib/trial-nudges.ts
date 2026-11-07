import { businessDay, businessTimeZone, businessToday } from "@/lib/business-time";
import { getOnboardingStatus } from "@/lib/onboarding";
import { notifyOperator } from "@/lib/notify-operator";
import type { AlertKey } from "@/lib/operator-alert-text";

/**
 * Nudges in the free trial (Rory, 2 Nov 2026): on day 1, 3 and 7 after signing up, a business that hasn't finished
 * getting going gets one short alert (phone, LINE, Telegram, whichever they use) pointing at its next step.
 * Each is sent once; a business that has taken a booking or rental is left alone. The words are in the operator's
 * language (operatorAlerts.nudge* in locales/<lang>/common.json).
 */
const NUDGE_DAYS = [1, 3, 7];

const NUDGES: Record<string, { key: AlertKey; emoji: string; url: string }> = {
  first_vehicle: { key: "nudgeFirstVehicle", emoji: "🚗", url: "/onboarding?step=2" },
  current_rentals: { key: "nudgeCurrentRentals", emoji: "📋", url: "/onboarding?step=2&rentals=1" },
  reminders: { key: "nudgeReminders", emoji: "💬", url: "/settings?tab=messaging" },
  booking_page: { key: "nudgeBookingPage", emoji: "🔗", url: "/" },
  signature: { key: "nudgeSignature", emoji: "✍️", url: "/settings/signature" },
  payment_methods: { key: "nudgePaymentMethods", emoji: "💳", url: "/settings?tab=rentals#payment-methods" }
};

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10)) - Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10))) / 86_400_000);
}

/**
 * `organizationIds`: the businesses the hourly job is running, inside their time zone, so the day count is on their
 * calendar. Left out: every business signed up in the last nine days.
 */
export async function sendTrialNudges(admin: any, organizationIds?: string[]): Promise<number> {
  if (organizationIds && !organizationIds.length) return 0;
  const today = businessToday();
  const since = new Date(Date.now() - 9 * 86_400_000).toISOString();
  let query = admin
    .from("organizations")
    .select("id, created_at, default_locale, settings, subscription_status")
    .gte("created_at", since)
    .is("deleted_at", null);
  if (organizationIds) query = query.in("id", organizationIds);
  const { data: orgs } = await query;
  let sent = 0;
  for (const org of (orgs || []) as any[]) {
    if (org.subscription_status && org.subscription_status !== "trial") continue;
    const signedUp = businessDay(org.created_at, businessTimeZone());
    const day = daysBetween(signedUp, today);
    if (!NUDGE_DAYS.includes(day)) continue;
    const settings = org.settings || {};
    const done: number[] = Array.isArray(settings.trial_nudges) ? settings.trial_nudges : [];
    if (done.includes(day)) continue;
    const status = await getOnboardingStatus(admin, org.id).catch(() => null);
    if (!status || status.counts.rentals > 0) continue;
    const next = status.items.find((item) => !item.completed && NUDGES[item.step]);
    if (!next) continue;
    const nudge = NUDGES[next.step];
    // Marked first, so a second run the same day can't send it twice.
    await admin.from("organizations").update({ settings: { ...settings, trial_nudges: [...done, day] } }).eq("id", org.id);
    await notifyOperator(org.id, { emoji: nudge.emoji, key: nudge.key }, "trial_nudge", nudge.url).catch(() => null);
    sent += 1;
  }
  return sent;
}
