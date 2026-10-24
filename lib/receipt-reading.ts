import { readFileAsJson } from "@/lib/ai-vision";

/** Running costs a receipt can be. The same names as the money types. */
export const RECEIPT_COST_TYPES = ["fuel", "repair", "servicing", "maintenance", "insurance", "tax", "fine", "accessories", "finance", "other"] as const;

export type ReadReceipt = {
  /** False when the picture isn't a receipt, invoice or payment slip at all. */
  isReceipt: boolean;
  amount: number | null;
  /** yyyy-mm-dd, Gregorian. */
  date: string | null;
  /** Who was paid (the shop, garage, insurer) or, on a transfer slip, who received it. */
  paidTo: string | null;
  /** On a transfer slip: who sent the money. */
  paidBy: string | null;
  /** fuel, repair, ... (expense receipts only). */
  costType: (typeof RECEIPT_COST_TYPES)[number] | null;
  /** A number plate printed on the receipt (fuel and garage bills often have one). */
  plate: string | null;
  odometer: number | null;
  /** Bank reference or receipt number, for spotting the same slip twice. */
  reference: string | null;
  /** A few words on what was bought or paid for. */
  summary: string | null;
  confidence: number;
};

const SYSTEM =
  "You read receipts, tax invoices and bank transfer slips for a vehicle rental business in Thailand. Receipts may be in Thai, English or both. " +
  "Return JSON with: is_receipt (true only for a receipt, invoice, bill or payment/transfer slip), amount (the total actually paid, including VAT, as a number; on a transfer slip the amount transferred; null if not readable), " +
  "date (the payment date as yyyy-mm-dd in the Gregorian calendar; Thai dates often use the Buddhist year, e.g. 2569 or 69 means 2026, so subtract 543; null if not readable), " +
  "paid_to (the shop, garage, insurer or person who received the money), paid_by (on a transfer slip, the sender's name; otherwise null), " +
  "cost_type (one of fuel, repair, servicing, maintenance, insurance, tax, fine, accessories, finance, other: fuel for petrol/diesel/gas stations, servicing for scheduled services and oil changes, repair for fixing damage or faults, maintenance for tyres, batteries, washing, parts; insurance for policies including compulsory พ.ร.บ.; tax for road/vehicle tax; fine for traffic fines; accessories for car seats, phone holders and the like; finance for loan or lease instalments), " +
  "plate (a Thai or foreign number plate printed on it, else null), odometer (an odometer/mileage figure printed on it, integer, else null), reference (receipt number or bank transaction reference, else null), " +
  "summary (at most 8 words on what was paid for), confidence (0 to 1). Never guess or invent a number: use null when you can't read it.";

function cleanText(value: unknown, max = 120) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text ? text.slice(0, max) : null;
}

/** A Gregorian yyyy-mm-dd within a sensible window, fixing a Buddhist year the reader didn't convert. */
export function receiptDate(value: unknown, today = new Date()) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  let year = Number(match[1]);
  if (year > 2400) year -= 543;
  const iso = `${year}-${match[2]}-${match[3]}`;
  const time = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  const days = (time - today.getTime()) / 86_400_000;
  // A receipt is from the last couple of years and not more than a few days ahead (time zones, typed dates).
  return days > 3 || days < -800 ? null : iso;
}

export function tidyReceipt(raw: Record<string, unknown>): ReadReceipt {
  const amountValue = typeof raw.amount === "number" ? raw.amount : Number(String(raw.amount ?? "").replace(/[^\d.]/g, ""));
  const amount = Number.isFinite(amountValue) && amountValue > 0 && amountValue < 10_000_000 ? Math.round(amountValue * 100) / 100 : null;
  const costType = RECEIPT_COST_TYPES.includes(raw.cost_type as never) ? (raw.cost_type as ReadReceipt["costType"]) : null;
  const odometerValue = Number(raw.odometer);
  return {
    isReceipt: raw.is_receipt !== false,
    amount,
    date: receiptDate(raw.date),
    paidTo: cleanText(raw.paid_to),
    paidBy: cleanText(raw.paid_by),
    costType,
    plate: cleanText(raw.plate, 20),
    odometer: Number.isInteger(odometerValue) && odometerValue > 0 && odometerValue < 2_000_000 ? odometerValue : null,
    reference: cleanText(raw.reference, 60),
    summary: cleanText(raw.summary, 80),
    confidence: typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0.5
  };
}

/**
 * Reads a receipt or transfer slip photo (or PDF). A business's own receipts aren't personal; a customer's
 * transfer slip is (names, account digits), so it only goes to the readers allowed personal documents.
 */
export async function readReceipt(bytes: Buffer, mediaType: string, personal = false): Promise<ReadReceipt> {
  const raw = await readFileAsJson({
    system: SYSTEM,
    prompt: "Read this receipt or payment slip.",
    bytes,
    mediaType: mediaType || "image/jpeg",
    maxTokens: 500,
    personal
  });
  return tidyReceipt(raw);
}

/** Letters and digits only, for matching a plate on a receipt to a vehicle. */
export function plateKey(value: string | null | undefined) {
  return String(value || "").toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
}
