/** "2026-11-04" -> "4 Nov 2026", for anything a person reads. The calendar date is kept as written. */
export function niceDate(value: unknown): string {
  const iso = String(value || "").slice(0, 10);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value || "");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}
