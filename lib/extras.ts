/**
 * Paid extras (child seat, airport delivery...) are rental income, but they are
 * tracked apart so the owner can see what was paid for them and refund them,
 * take them off, or move them onto the rent.
 *
 * Where extras live:
 * - rentals.extras: the lines picked ({ name, amount, ... }); a line taken off has removed_at.
 * - a rental_payments row with metadata.type "extras" (billed with the first rent);
 * - or, once moved, inside a rent payment as metadata.includes_extras { amount, names };
 * - money paid for them back to the customer: a refund transaction with metadata.refund_of "extras";
 * - money paid for them taken off later rent: metadata.extras_credit on that rent payment.
 */

export type ExtrasLine = { id?: string; name: string; amount: number; per?: string; price?: number; removed_at?: string | null };

export function extrasLines(rental: any): ExtrasLine[] {
  return (Array.isArray(rental?.extras) ? rental.extras : [])
    .map((line: any) => ({ ...line, name: String(line?.name || ""), amount: Number(line?.amount || 0) }))
    .filter((line: ExtrasLine) => line.name);
}

export function activeExtrasLines(rental: any): ExtrasLine[] {
  return extrasLines(rental).filter((line) => !line.removed_at);
}

const OPEN = ["pending", "scheduled", "overdue"];
const GONE = ["cancelled", "waived", "refunded"];

export function isOpenPayment(row: any) {
  return OPEN.includes(String(row?.status || "pending"));
}

function live(row: any) {
  return !row?.deleted_at && !row?.voided && !row?.metadata?.voided && !GONE.includes(String(row?.status || ""));
}

export function isExtrasPayment(row: any) {
  return row?.metadata?.type === "extras";
}

/** Rent the extras can be moved onto or taken off: open, not a deposit, charge or extras row. */
export function isRentPayment(row: any) {
  const type = String(row?.metadata?.type || "rent");
  return live(row) && !row?.metadata?.is_deposit && ["rent", "extension"].includes(type);
}

function includedExtras(row: any) {
  return Math.max(0, Number(row?.metadata?.includes_extras?.amount || 0));
}

/**
 * What a payment being received is worth in extras, for the money record:
 * the whole of an extras payment, or the extras part of a rent payment they were moved onto.
 */
export function extrasIncomeTag(metadata: any, amountPaid: number): Record<string, unknown> {
  if (metadata?.type === "extras") {
    return { income_kind: "extras", extras_amount: amountPaid, extras: Array.isArray(metadata?.extras) ? metadata.extras : [] };
  }
  const included = includedExtras({ metadata });
  if (included > 0) {
    return { extras_amount: Math.min(included, amountPaid), extras: Array.isArray(metadata?.includes_extras?.names) ? metadata.includes_extras.names : [] };
  }
  return {};
}

export type ExtrasSummary = {
  lines: ExtrasLine[];
  removedLines: ExtrasLine[];
  /** Extras still to be paid (in their own payment or inside rent). */
  open: number;
  /** Of those, still in their own payment (not yet moved onto rent). */
  openOwn: number;
  paid: number;
  refunded: number;
  credited: number;
  /** Paid for extras and not yet refunded or taken off rent. */
  available: number;
  /** The next rent payment still to come, for "add to the next rent". */
  nextRent: { id: string; amount: number; dueDate: string } | null;
};

export function extrasSummary(rental: any, payments: any[], transactions: any[]): ExtrasSummary {
  const rows = (payments || []).filter(live);
  let open = 0;
  let openOwn = 0;
  let paid = 0;
  let credited = 0;
  for (const row of rows) {
    const amount = Number(row.amount || 0);
    if (isExtrasPayment(row)) {
      if (row.status === "paid") paid += amount;
      else if (isOpenPayment(row)) {
        open += amount;
        openOwn += amount;
      }
    } else {
      const included = includedExtras(row);
      if (included > 0) {
        if (row.status === "paid") paid += Math.min(included, amount);
        else if (isOpenPayment(row)) open += included;
      }
    }
    credited += Math.max(0, Number(row.metadata?.extras_credit || 0));
  }
  const refunded = (transactions || [])
    .filter((tx: any) => tx?.metadata?.refund_of === "extras" && !tx?.voided && !tx?.metadata?.voided && !tx?.deleted_at)
    .reduce((sum: number, tx: any) => sum + Math.abs(Number(tx.amount || 0)), 0);
  const next = rows
    .filter((row) => isRentPayment(row) && isOpenPayment(row))
    .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")))[0];
  return {
    lines: activeExtrasLines(rental),
    removedLines: extrasLines(rental).filter((line) => line.removed_at),
    open: round(open),
    openOwn: round(openOwn),
    paid: round(paid),
    refunded: round(refunded),
    credited: round(credited),
    available: round(Math.max(0, paid - refunded - credited)),
    nextRent: next ? { id: next.id, amount: Number(next.amount || 0), dueDate: String(next.due_date || "").slice(0, 10) } : null
  };
}

export function round(value: number) {
  return Math.round(Number(value || 0) * 100) / 100;
}

/**
 * The excess once a damage waiver extra is on the booking (Settings › Paid extras, ready-made "Damage waiver"):
 * the lower amount set on the waiver. Null when the booking has no waiver, so the standard excess stands.
 */
export function waiverExcess(rental: any): number | null {
  const waiver = activeExtrasLines(rental).find((line: any) => line.preset === "damage_waiver");
  return waiver ? Math.max(0, Number((waiver as any).excess) || 0) : null;
}

/**
 * Agreement variables from the booking's ready-made extras, for contract templates (lib/contract-rendering.ts):
 *   damage_waiver (true/false), damage_waiver_excess, standard_insurance_excess,
 *   young_driver (true/false), young_driver_age, additional_driver, cross_border, cross_border_countries,
 *   one_way, out_of_hours (true/false).
 * insurance_excess itself is the waiver's lower amount when there is a waiver (see waiverExcess).
 */
export function extrasAgreementVariables(rental: any, standardExcess: unknown, format: (value: unknown) => string): Record<string, string | boolean> {
  const lines = activeExtrasLines(rental) as Array<ExtrasLine & { preset?: string; excess?: number; minAge?: number; countries?: string }>;
  const find = (preset: string) => lines.find((line) => line.preset === preset);
  const waiver = find("damage_waiver");
  const young = find("young_driver");
  const cross = find("cross_border");
  return {
    damage_waiver: Boolean(waiver),
    damage_waiver_excess: waiver ? format(waiver.excess || 0) : "",
    standard_insurance_excess: format(standardExcess || 0),
    young_driver: Boolean(young),
    young_driver_age: young?.minAge ? String(young.minAge) : "",
    additional_driver: Boolean(find("additional_driver")),
    cross_border: Boolean(cross),
    cross_border_countries: cross?.countries ? String(cross.countries) : "",
    one_way: Boolean(find("one_way")),
    out_of_hours: Boolean(find("out_of_hours"))
  };
}
