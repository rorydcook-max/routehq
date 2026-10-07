/**
 * Business wall-clock times (delivery and collection times).
 *
 * Operators type times as they read them on a clock in Samui, e.g.
 * "2026-09-25T10:00" from a datetime-local input. Postgres timestamptz needs a
 * real instant; storing the bare string made Postgres read it as UTC, so a
 * 10:00 Samui delivery was stored as 10:00 UTC = 17:00 Samui.
 *
 *   wallTimeToIso  - form value -> ISO instant with the business offset applied
 *   toWallTime     - any stored value -> "YYYY-MM-DDTHH:mm" in business time,
 *                    for inputs and display
 *
 * Values without an offset (older rows, booking_data JSON) are treated as
 * already being business wall time.
 */

export const BUSINESS_TIME_ZONE = "Asia/Bangkok";

const HAS_OFFSET = /([zZ]|[+-]\d{2}:?\d{2})$/;

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function offsetMinutes(timeZone: string, at: Date) {
  const p = zonedParts(at, timeZone);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/** "2026-09-25T10:00" (business time) -> "2026-09-25T03:00:00.000Z". Returns null for empty or unreadable input. */
export function wallTimeToIso(value: unknown, timeZone: string = BUSINESS_TIME_ZONE): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (HAS_OFFSET.test(text)) {
    const instant = new Date(text);
    return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
  }
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const guess = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0));
  return new Date(guess - offsetMinutes(timeZone, new Date(guess)) * 60000).toISOString();
}

/**
 * Today's date ("YYYY-MM-DD") in business time. new Date().toISOString() gives
 * the UTC date, which in Thailand is still yesterday until 07:00 - enough to
 * mark rent due today as overdue or date a payment on the wrong day.
 */
export function businessToday(offsetDays = 0, timeZone: string = BUSINESS_TIME_ZONE): string {
  const p = zonedParts(new Date(Date.now() + offsetDays * 86_400_000), timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Any stored value -> "YYYY-MM-DDTHH:mm" in business time (or the date alone for date-only values). */
export function toWallTime(value: unknown, timeZone: string = BUSINESS_TIME_ZONE): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (!HAS_OFFSET.test(text)) return text.slice(0, 16).replace(" ", "T");
  const instant = new Date(text);
  if (Number.isNaN(instant.getTime())) return "";
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * "Now" for calendar sums (this month, this year, twelve months back): a Date
 * whose own year, month and day are the business's, at midday. Code that uses
 * getMonth() and friends on a server running in UTC would otherwise be a day,
 * and at month end a month, behind for the first seven hours of each Thai day.
 */
export function businessNow(timeZone: string = BUSINESS_TIME_ZONE): Date {
  const [year, month, day] = businessToday(0, timeZone).split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Whole days from the business's today to a date (negative once it has passed), or null when there is no
 * readable date. Counted on the calendar, so the answer is the same on a server in UTC and on a phone in
 * Thailand - "new Date()" on each gave different answers for the first seven hours of every day.
 */
export function daysFromToday(value: unknown, timeZone: string = BUSINESS_TIME_ZONE): number | null {
  const day = Date.parse(`${toWallTime(value, timeZone).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(day)) return null;
  return Math.round((day - Date.parse(`${businessToday(0, timeZone)}T00:00:00Z`)) / 86_400_000);
}
