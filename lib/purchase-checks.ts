/**
 * Purchase checks: fresh market look-ups in the buying-a-vehicle calculator (app/api/calculator/research). Each one
 * costs real money, so each plan has a quiet allowance per billing period (Rory, 3 Nov 2026: free 0, starter 10,
 * pro 20, business 50; not advertised anywhere, and only shown on the page once 5 or fewer are left). Saved look-ups
 * are free and never count. Platform admins aren't limited. Admin-set custom limits ("lookups") still apply.
 *
 * Counted in organizations.settings.calculator_lookups as { period_start, count }; the count starts again when the
 * period rolls over. The old { month: "YYYY-MM", count } shape is read as this calendar month's count.
 */

import { viewerIsPlatformAdmin } from "@/lib/admin";
import { businessToday, toWallTime } from "@/lib/business-time";
import { effectiveLimits } from "@/lib/plans";

/** Once this many or fewer are left, the calculator says how many. */
export const SHOW_CHECKS_LEFT_AT = 5;

/** What the calculator shows: null means no limit (platform admins, or nothing to count with). */
export type ChecksLeft = { limit: number; left: number; resetsOn: string } | null;

type OrgBilling = {
  subscription_status?: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  next_payment_due?: string | null;
  subscription_started_at?: string | null;
};

/** The same day-of-month and time, some months on; a 31st becomes the month's last day. */
function addMonths(anchor: Date, months: number) {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchor.getUTCDate(), lastDay), anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds()));
}

/** The month-long cycle, counted from the anchor, that "now" falls in. */
function cycleAround(anchor: Date, now: Date) {
  let k = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth());
  while (k > -1200 && addMonths(anchor, k).getTime() > now.getTime()) k -= 1;
  while (k < 1200 && addMonths(anchor, k + 1).getTime() <= now.getTime()) k += 1;
  return { start: addMonths(anchor, k), end: addMonths(anchor, k + 1) };
}

const validDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

/**
 * The billing period purchase checks are counted in, as { start, end } (start is also the counter's key).
 * - Trial: from the trial's start, a month at a time, ending when the trial ends (a 30-day trial is one period).
 *   A trial gets the allowance of the plan it is trialling.
 * - Paid: monthly cycles on the billing day (next_payment_due, else subscription_started_at). Yearly plans also
 *   get a monthly allowance, on the same day each month.
 * - Otherwise (no dates, or a trial that has run out): the calendar month in business time.
 */
export function checkPeriod(org: OrgBilling, now = new Date()): { start: string; end: string } {
  const status = String(org.subscription_status || "trial");
  const trialStart = validDate(org.trial_started_at);
  const trialEnd = validDate(org.trial_ends_at);
  if (status === "trial" && trialStart && trialEnd && trialStart.getTime() <= now.getTime() && now.getTime() < trialEnd.getTime()) {
    const cycle = cycleAround(trialStart, now);
    const end = cycle.end.getTime() < trialEnd.getTime() ? cycle.end : trialEnd;
    return { start: cycle.start.toISOString(), end: end.toISOString() };
  }
  const anchor = status === "active" ? validDate(org.next_payment_due) || validDate(org.subscription_started_at) : null;
  if (anchor) {
    const cycle = cycleAround(anchor, now);
    return { start: cycle.start.toISOString(), end: cycle.end.toISOString() };
  }
  const month = businessToday().slice(0, 7);
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  return { start: `${month}-01`, end: next };
}

type Store = any;

/** Checks used and allowed this period. limit is null for platform admins (no limit). */
async function readAllowance(store: Store, organizationId: string) {
  if (await viewerIsPlatformAdmin().catch(() => false)) return null;
  const { data: row } = await store
    .from("organizations")
    .select("settings, custom_limits, subscription_tier, subscription_status, trial_started_at, trial_ends_at, next_payment_due, subscription_started_at")
    .eq("id", organizationId)
    .maybeSingle();
  if (!row) return null;
  const limit = effectiveLimits({ subscription_tier: row.subscription_tier, custom_limits: row.custom_limits }).comparisonLookups;
  const period = checkPeriod(row);
  const settings = (row.settings || {}) as Record<string, any>;
  const saved = settings.calculator_lookups || {};
  let used = 0;
  if (saved.period_start === period.start) used = Number(saved.count) || 0;
  // The old shape counted calendar months: carry this month's count over once, so nobody gets a fresh allowance on the day this changed.
  else if (!saved.period_start && saved.month === businessToday().slice(0, 7)) used = Number(saved.count) || 0;
  return { limit, used, period, settings };
}

const shown = (limit: number, used: number, periodEnd: string): ChecksLeft => ({ limit, left: Math.max(0, limit - used), resetsOn: toWallTime(periodEnd).slice(0, 10) });

/** What's left this period, without using one (for the page, and with saved look-ups). */
export async function checksLeft(store: Store, organizationId: string): Promise<ChecksLeft> {
  if (!store) return null;
  const state = await readAllowance(store, organizationId);
  return state ? shown(state.limit, state.used, state.period.end) : null;
}

/** Uses one purchase check, if any are left. ok is false when the allowance is used up. */
export async function takeCheck(store: Store, organizationId: string): Promise<{ ok: boolean; checks: ChecksLeft }> {
  if (!store) return { ok: true, checks: null };
  const state = await readAllowance(store, organizationId);
  if (!state) return { ok: true, checks: null };
  if (state.used >= state.limit) return { ok: false, checks: shown(state.limit, state.used, state.period.end) };
  await store
    .from("organizations")
    .update({ settings: { ...state.settings, calculator_lookups: { period_start: state.period.start, count: state.used + 1 } } })
    .eq("id", organizationId);
  return { ok: true, checks: shown(state.limit, state.used + 1, state.period.end) };
}
