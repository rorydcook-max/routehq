import { customerDate } from "@/lib/i18n/customer-dates";

/**
 * Dates on staff pages, in the reader's language. One place, so a screen never
 * mixes "4 Oct" with "4 ต.ค.".
 *
 * Always the Western calendar and Western digits (the same as on agreements and
 * beside amounts). Burmese, Lao and Sinhala month names are kept in the app
 * (see customer-dates.ts) because browsers do not all carry them.
 */

/** The locale to hand to Intl for this language. */
export function intlLocale(locale: string) {
  return locale === "en" ? "en-GB" : `${locale}-u-ca-gregory-nu-latn`;
}

/** "2026-09-27" -> "27 Sep". */
export function shortDate(iso: string | null | undefined, locale: string) {
  return customerDate(String(iso || ""), locale, false);
}

/** "2026-09-27" -> "27 Sep 2026". */
export function longDate(iso: string | null | undefined, locale: string) {
  return customerDate(String(iso || ""), locale, true);
}

/** "2026-09-30" -> "Wed 30 Sep". Server-rendered pages only for Burmese, Lao and Sinhala (the weekday comes from Intl). */
export function dayOfWeekDate(iso: string | null | undefined, locale: string) {
  const value = String(iso || "");
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const weekday = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
  return `${weekday} ${shortDate(value, locale)}`;
}
