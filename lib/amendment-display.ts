/**
 * A change to a rental, as rows for the screen in the reader's language.
 *
 * The signed document keeps its own English wording (lib/rental-amendments.ts),
 * which is what gets hashed. This is only for showing people what is changing:
 * dates and money in their own format, and the few joining words translated.
 * `say` is the "customer" translations.
 */

type Changes = {
  currency?: string | null;
  billing_period?: string | null;
  previous_end_date?: string | null;
  new_end_date?: string | null;
  extension_amount?: number | null;
  extension_due_date?: string | null;
  previous_rate?: number | null;
  new_rate?: number | null;
  rate_from?: string | null;
  previous_deposit?: number | null;
  new_deposit?: number | null;
  deposit_due_date?: string | null;
  previous_vehicle_label?: string | null;
  new_vehicle_id?: string | null;
  new_vehicle_label?: string | null;
};

type Say = (key: string, values?: Record<string, string | number>) => string;

export type AmendmentDisplayRow = { key: string; label: string; before: string | null; after: string };

export function amendmentDisplayRows(changes: Changes | null | undefined, locale: string, say: Say): AmendmentDisplayRow[] {
  if (!changes) return [];
  const currency = changes.currency || "THB";
  const money = (value: number | null | undefined) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0));
  const date = (value: string | null | undefined) => {
    const day = String(value || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "-";
    // Same calendar and digits as every other date in the app (the Thai locale would otherwise give Buddhist years).
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : `${locale}-u-ca-gregory-nu-latn`, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
  };
  const period = String(changes.billing_period || "monthly").toLowerCase();
  const perPeriod = (value: number | null | undefined) =>
    period === "daily" ? say("perDay", { rate: money(value) }) : period === "weekly" ? say("perWeek", { rate: money(value) }) : period === "custom" ? money(value) : say("perMonth", { rate: money(value) });

  const rows: AmendmentDisplayRow[] = [];
  if (changes.new_vehicle_id) {
    rows.push({ key: "vehicle", label: say("rowVehicle"), before: changes.previous_vehicle_label || null, after: changes.new_vehicle_label || "-" });
  }
  if (changes.new_end_date) {
    rows.push({ key: "end", label: say("rowReturnDate"), before: changes.previous_end_date ? date(changes.previous_end_date) : null, after: date(changes.new_end_date) });
    if (Number(changes.extension_amount || 0) > 0) {
      rows.push({ key: "extension", label: say("rowExtensionCharge"), before: null, after: `${money(changes.extension_amount)} · ${say("amDue", { date: date(changes.extension_due_date) })}` });
    }
  }
  if (changes.new_rate !== null && changes.new_rate !== undefined) {
    rows.push({ key: "rate", label: say("rowRentalRate"), before: perPeriod(changes.previous_rate), after: `${perPeriod(changes.new_rate)} · ${say("amFrom", { date: date(changes.rate_from) })}` });
  }
  if (changes.new_deposit !== null && changes.new_deposit !== undefined) {
    const more = Number(changes.new_deposit) - Number(changes.previous_deposit || 0);
    rows.push({
      key: "deposit",
      label: say("rowDeposit"),
      before: money(changes.previous_deposit),
      after: money(changes.new_deposit) + (more > 0 ? ` (${say("amMore", { amount: money(more), date: date(changes.deposit_due_date) })})` : "")
    });
  }
  return rows;
}
