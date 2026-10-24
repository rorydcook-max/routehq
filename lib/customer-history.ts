/**
 * Shared customer history across RouteHQ businesses (migration 0100). A business reports a rental that ended badly;
 * other businesses are warned when the same person books or gets in touch with them.
 *
 * A person is recognised by their passport or driving licence number and their phone / WhatsApp number, each turned
 * into a keyed hash before it is stored or compared, so reports can't be browsed or reversed into anyone's details.
 * Other businesses only ever see anonymous summaries (what kind of problem, how much, which month, how many
 * businesses), never who reported it or any notes.
 */
import { createHmac } from "node:crypto";
import type { HistorySignal } from "@/lib/customer-history-kinds";

export { REPORT_KINDS, type HistorySignal, type ReportKind } from "@/lib/customer-history-kinds";

type Identifiers = { phone?: string | null; whatsapp_number?: string | null; passport_number?: string | null; driver_license_number?: string | null };

let warned = false;
function secret() {
  const value = process.env.CUSTOMER_MATCH_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("CUSTOMER_MATCH_SECRET is not set.");
  if (!warned) {
    console.warn("[customer-history] CUSTOMER_MATCH_SECRET not set: using the development value.");
    warned = true;
  }
  return "routehq-development-customer-match";
}

/** Digits of a phone number, Thai numbers in their 0… form, so "+66 81 234 5678" and "081-234-5678" agree. */
function phoneKey(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("66") && digits.length === 11) digits = `0${digits.slice(2)}`;
  return digits.length >= 9 && digits.length <= 15 ? `p:${digits}` : null;
}

/** A passport or licence number, letters and digits only. */
function documentKey(value: unknown) {
  const text = String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return text.length >= 6 && /\d/.test(text) ? `d:${text}` : null;
}

/** The keyed hashes a person can be recognised by (at most six). */
export function customerMatchKeys(customer: Identifiers): string[] {
  const raw = [phoneKey(customer.phone), phoneKey(customer.whatsapp_number), documentKey(customer.passport_number), documentKey(customer.driver_license_number)].filter(Boolean) as string[];
  const key = secret();
  return Array.from(new Set(raw)).slice(0, 6).map((value) => createHmac("sha256", key).update(value).digest("base64url").slice(0, 32));
}

/** What other businesses have reported about this person, for a business that has them in front of it. */
export async function sharedHistory(supabase: any, organizationId: string, customer: Identifiers | null | undefined): Promise<HistorySignal[]> {
  if (!customer) return [];
  const keys = customerMatchKeys(customer);
  if (!keys.length) return [];
  const { data, error } = await supabase.rpc("customer_report_signals", { p_org: organizationId, p_keys: keys });
  if (error || !Array.isArray(data)) return [];
  return data.map((row: any) => ({
    kind: row.kind,
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    latest: String(row.latest),
    reporters: Number(row.reporters || 1),
    reports: Number(row.reports || 1)
  }));
}
