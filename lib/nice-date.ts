import { englishDateLocale } from "@/lib/i18n/customer-dates";

/** "2026-11-04" -> "4 Nov 2026" ("Nov 4, 2026" for a US business), for anything a person reads. The calendar date is kept as written. */
export function niceDate(value: unknown): string {
  const iso = String(value || "").slice(0, 10);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(match[2]) - 1];
  return englishDateLocale() === "en-US" ? `${month} ${Number(match[3])}, ${match[1]}` : `${Number(match[3])} ${month} ${match[1]}`;
}
