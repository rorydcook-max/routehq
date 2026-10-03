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
