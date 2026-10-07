import { intlLocale } from "@/lib/i18n/dates";

/**
 * Rent periods are saved as English text ("October 2026"). This says the month
 * and year in the reader's language; anything that is not a month and a year
 * comes back exactly as it was saved.
 */
export function monthPeriod(period: string | null | undefined, locale: string) {
  const text = String(period || "");
  // Short rentals are saved as "3 days" or "Whole rental".
  const days = text.match(/^(\d+) days?$/);
  if (days) {
    try {
      return new Intl.NumberFormat(intlLocale(locale), { style: "unit", unit: "day", unitDisplay: "long" }).format(Number(days[1]));
    } catch {
      return text;
    }
  }
  if (text === "Whole rental") return locale === "th" ? "ตลอดการเช่า" : text;
  const month = text.match(/^([A-Za-z]+) (\d{4})$/);
  if (!month) return text;
  const parsed = Date.parse(`1 ${month[1]} ${month[2]} UTC`);
  if (Number.isNaN(parsed)) return text;
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(parsed));
  } catch {
    return text;
  }
}
