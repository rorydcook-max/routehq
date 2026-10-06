/**
 * Dates on customer pages, written the same way on the server and in the browser.
 *
 * Browsers do not all carry date wording for every language: Chrome has none for
 * Burmese, Lao or Sinhala and quietly falls back to English, while the server
 * writes them properly. The page would then show one thing, flicker to another
 * and log an error. For those languages the month names are kept here instead.
 *
 * Always the Western calendar and Western digits, so a date on the page matches
 * the same date on the agreement and the amounts beside it.
 */
const OWN_MONTHS: Record<string, { months: string[]; yearFirst: boolean }> = {
  my: { months: ["ဇန်", "ဖေ", "မတ်", "ဧ", "မေ", "ဇွန်", "ဇူ", "ဩ", "စက်", "အောက်", "နို", "ဒီ"], yearFirst: true },
  lo: { months: ["ມ.ກ.", "ກ.ພ.", "ມ.ນ.", "ມ.ສ.", "ພ.ພ.", "ມິ.ຖ.", "ກ.ລ.", "ສ.ຫ.", "ກ.ຍ.", "ຕ.ລ.", "ພ.ຈ.", "ທ.ວ."], yearFirst: false },
  si: { months: ["ජන", "පෙබ", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝ", "සැප්", "ඔක්", "නොවැ", "දෙසැ"], yearFirst: true },
};

/** "2026-10-06" -> "6 Oct 2026" (or "6 Oct" without the year), in the reader's language. */
export function customerDate(iso: string, locale: string, withYear = true): string {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const own = OWN_MONTHS[locale];
  if (own) {
    const name = own.months[month - 1] || "";
    if (!withYear) return `${day} ${name}`;
    return own.yearFirst ? `${year} ${name} ${day}` : `${day} ${name} ${year}`;
  }
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : `${locale}-u-ca-gregory-nu-latn`, {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
