import QRCode from "qrcode";

/**
 * Thai QR Payment (PromptPay) codes that already carry the amount, so the
 * payer scans and confirms instead of typing a number. Follows the EMVCo
 * merchant-presented format the Bank of Thailand uses; no payment provider
 * is involved and the money goes straight to the account behind the ID.
 */

function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC-16/CCITT-FALSE, as the standard requires for the last field. */
function crc16(payload: string) {
  let crc = 0xffff;
  for (let index = 0; index < payload.length; index++) {
    crc ^= payload.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * A PromptPay ID is a Thai mobile number (10 digits), a national or tax ID
 * (13 digits) or an e-wallet ID (15 digits). Returns null for anything else.
 */
function promptPayTarget(rawId: string) {
  const digits = String(rawId || "").replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return field("01", `0066${digits.slice(1)}`);
  if (digits.length === 11 && digits.startsWith("66")) return field("01", `00${digits}`);
  if (digits.length === 13) return field("02", digits);
  if (digits.length === 15) return field("03", digits);
  return null;
}

/** The text a banking app reads from the QR. Null when the ID isn't a valid PromptPay ID. */
export function promptPayPayload(promptPayId: string, amount?: number | null) {
  const target = promptPayTarget(promptPayId);
  if (!target) return null;
  const hasAmount = typeof amount === "number" && Number.isFinite(amount) && amount > 0;
  const body = [
    field("00", "01"),
    // 12 = made for one payment of a set amount; 11 = reusable, payer types the amount.
    field("01", hasAmount ? "12" : "11"),
    field("29", field("00", "A000000677010111") + target),
    field("53", "764"),
    hasAmount ? field("54", (amount as number).toFixed(2)) : "",
    field("58", "TH")
  ].join("");
  const withCrcTag = `${body}6304`;
  return `${withCrcTag}${crc16(withCrcTag)}`;
}

/**
 * The business's own QR picture, read once when it is uploaded (Settings › How customers pay you), is the same kind of
 * text. Kept as it was read, so the money goes exactly where their own QR sends it; only the amount is added
 * (Rory, 11 Nov 2026: an uploaded QR made the customer type the amount, a generated one fills it in).
 */

/** The top-level fields of a Thai QR text, in order. Null when it isn't well formed. */
function readFields(payload: string): Array<[string, string]> | null {
  const fields: Array<[string, string]> = [];
  let at = 0;
  while (at < payload.length) {
    const id = payload.slice(at, at + 2);
    const length = Number(payload.slice(at + 2, at + 4));
    if (!/^\d{2}$/.test(id) || !Number.isInteger(length) || at + 4 + length > payload.length) return null;
    fields.push([id, payload.slice(at + 4, at + 4 + length)]);
    at += 4 + length;
  }
  return fields;
}

/** A QR text that is a Thai bank QR (PromptPay or bill payment) with a correct checksum. */
export function isThaiQrPayload(value: unknown): value is string {
  const payload = String(value || "").trim();
  if (payload.length < 30 || payload.length > 400 || !/^[\x20-\x7E]+$/.test(payload)) return false;
  const fields = readFields(payload);
  if (!fields || fields[0]?.[0] !== "00" || fields[fields.length - 1]?.[0] !== "63") return false;
  if (!fields.some(([id, body]) => (id === "29" || id === "30") && body.includes("A000000677"))) return false;
  return crc16(payload.slice(0, -4)) === payload.slice(-4).toUpperCase();
}

/** The business's own QR text with the amount filled in. Null when the text isn't a Thai bank QR. */
export function thaiQrWithAmount(payload: string | null | undefined, amount?: number | null) {
  const text = String(payload || "").trim();
  if (!isThaiQrPayload(text)) return null;
  const hasAmount = typeof amount === "number" && Number.isFinite(amount) && amount > 0;
  if (!hasAmount) return text;
  const fields = (readFields(text) || []).filter(([id]) => id !== "54" && id !== "63");
  const out: string[] = [];
  let amountPlaced = false;
  for (const [id, body] of fields) {
    // The amount (54) sits after the currency (53); fields stay in number order.
    if (!amountPlaced && Number(id) > 54) {
      out.push(field("54", (amount as number).toFixed(2)));
      amountPlaced = true;
    }
    out.push(field(id, id === "01" ? "12" : body));
  }
  if (!amountPlaced) out.push(field("54", (amount as number).toFixed(2)));
  const withCrcTag = `${out.join("")}6304`;
  return `${withCrcTag}${crc16(withCrcTag)}`;
}

/** The QR for an amount: from the business's own QR text when there is one, else from its PromptPay ID. */
export function paymentQrText(source: { payload?: string | null; promptPayId?: string | null }, amount?: number | null) {
  return thaiQrWithAmount(source.payload, amount) || (source.promptPayId ? promptPayPayload(source.promptPayId, amount) : null);
}

/** The same, as an SVG picture. */
export async function paymentQrSvg(source: { payload?: string | null; promptPayId?: string | null }, amount?: number | null) {
  const text = paymentQrText(source, amount);
  if (!text) return null;
  try {
    return await QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  } catch {
    return null;
  }
}

/** An SVG picture of the QR, ready to drop into a page. Null when the ID isn't usable. */
export async function promptPayQrSvg(promptPayId: string, amount?: number | null) {
  const payload = promptPayPayload(promptPayId, amount);
  if (!payload) return null;
  try {
    return await QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  } catch {
    return null;
  }
}
