import { overlaps } from "@/lib/rental-conflicts";

/**
 * A business's booking rules, set once in Settings and applied everywhere.
 * Stored in organizations.settings.booking_rules. Safe to import from client
 * code: no server dependencies.
 */

export type BookingRules = {
  /** How long a new booking link keeps its vehicle before the customer signs. */
  holdHours: number;
  /** Online bookings can't start sooner than this many hours from now. */
  leadHours: number;
  /** Days of notice a customer gives before returning an open-ended rental. */
  endNoticeDays: number;
  /** An extension asked for at least this many days before the end is applied automatically. */
  extendNoticeDays: number;
  /** Days kept free after each rental for cleaning and checks. */
  gapDays: number;
};

export const HOLD_HOUR_OPTIONS = [6, 12, 24, 48, 72];
export const LEAD_HOUR_OPTIONS = [0, 12, 24, 48, 72];
export const END_NOTICE_OPTIONS = [0, 1, 3, 7, 14, 30];
export const EXTEND_NOTICE_OPTIONS = [0, 1, 2, 3, 7];
export const GAP_DAY_OPTIONS = [0, 1, 2, 3];

export const DEFAULT_BOOKING_RULES: BookingRules = { holdHours: 24, leadHours: 0, endNoticeDays: 0, extendNoticeDays: 0, gapDays: 0 };

function pick(value: unknown, options: number[], fallback: number) {
  const number = Number(value);
  return options.includes(number) ? number : fallback;
}

export function bookingRules(settings: unknown): BookingRules {
  const all = settings && typeof settings === "object" ? (settings as Record<string, any>) : {};
  const raw = all.booking_rules && typeof all.booking_rules === "object" ? all.booking_rules : {};
  return {
    // The hold length used to live with the public booking page settings.
    holdHours: pick(raw.hold_hours ?? all.public_booking?.hold_hours, HOLD_HOUR_OPTIONS, DEFAULT_BOOKING_RULES.holdHours),
    leadHours: pick(raw.lead_hours, LEAD_HOUR_OPTIONS, DEFAULT_BOOKING_RULES.leadHours),
    endNoticeDays: pick(raw.end_notice_days, END_NOTICE_OPTIONS, DEFAULT_BOOKING_RULES.endNoticeDays),
    extendNoticeDays: pick(raw.extend_notice_days, EXTEND_NOTICE_OPTIONS, DEFAULT_BOOKING_RULES.extendNoticeDays),
    gapDays: pick(raw.gap_days, GAP_DAY_OPTIONS, DEFAULT_BOOKING_RULES.gapDays)
  };
}

export function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** First date an online booking may start, given today's business date and the time in Thailand. */
export function earliestStart(today: string, leadHours: number, now = new Date()) {
  if (leadHours <= 0) return today;
  const bangkok = new Date(now.getTime() + leadHours * 3_600_000 + 7 * 3_600_000);
  const date = bangkok.toISOString().slice(0, 10);
  return date > today ? date : today;
}

/** A busy period with the turnaround gap added to its end, so the days after a return stay free. */
export function withGap<T extends { startDate: string; endDate: string | null }>(period: T, gapDays: number): T {
  if (!gapDays || !period.endDate) return period;
  return { ...period, endDate: addDaysIso(period.endDate, gapDays) };
}

/** True when the dates clash with a period, allowing for the turnaround gap on either side. */
export function clashes(startDate: string, endDate: string | null, period: { startDate: string; endDate: string | null }, gapDays = 0) {
  if (overlaps(startDate, endDate, period)) return true;
  if (!gapDays) return false;
  const paddedPeriod = period.endDate ? { ...period, endDate: addDaysIso(period.endDate, gapDays) } : period;
  const paddedEnd = endDate ? addDaysIso(endDate, gapDays) : null;
  return overlaps(startDate, endDate, paddedPeriod) || overlaps(startDate, paddedEnd, period);
}
