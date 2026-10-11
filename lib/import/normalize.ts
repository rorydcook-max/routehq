export function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

/** A plate as it is written: Thai plates have spaces ("กข 1234 ภูเก็ต"), which are kept, one at a time. */
export function cleanPlate(value: unknown) {
  return cleanString(value).replace(/\s+/g, " ").toUpperCase();
}

/** For telling whether two plates are the same vehicle: spacing, dashes and case ignored. */
export function plateKey(value: unknown) {
  return cleanString(value).replace(/[\s-]+/g, "").toUpperCase();
}

/**
 * Finds a plate in a map of plate keys, allowing the province to be missing on
 * one side: "ขจ 1122" and "ขจ 1122 สุราษฎร์ธานี" are the same vehicle.
 */
export function findByPlate<T>(map: Map<string, T>, plate: unknown): T | undefined {
  const key = plateKey(plate);
  if (!key) return undefined;
  const exact = map.get(key);
  if (exact !== undefined) return exact;
  const digits = /\d/.test(key);
  if (!digits || key.length < 4) return undefined;
  for (const [candidate, value] of map) {
    if (candidate.startsWith(key) || key.startsWith(candidate)) return value;
  }
  return undefined;
}

export function parseNumberValue(value: unknown) {
  // "฿12,000", "12000 บาท", "THB 12,000.-" all mean twelve thousand.
  const cleaned = cleanString(value).replace(/[฿,\s]|THB|บาท|บ\.|\.-$/gi, "");
  if (!cleaned) {
    return null;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseIntegerValue(value: unknown) {
  const parsed = parseNumberValue(value);
  return parsed === null ? null : Math.round(parsed);
}

export function parseBooleanValue(value: unknown) {
  const cleaned = cleanString(value).toLowerCase();
  if (!cleaned) {
    return null;
  }
  if (["yes", "y", "true", "1", "ใช่"].includes(cleaned)) {
    return true;
  }
  if (["no", "n", "false", "0", "ไม่", "ไม่ใช่"].includes(cleaned)) {
    return false;
  }
  return null;
}

/** Thai month names and their usual short forms, as written in notebooks and sheets. */
const THAI_MONTHS: Array<[RegExp, number]> = [
  [/^(ม\.?ค\.?|มกราคม)$/, 1],
  [/^(ก\.?พ\.?|กุมภาพันธ์)$/, 2],
  [/^(มี\.?ค\.?|มีนาคม)$/, 3],
  [/^(เม\.?ย\.?|เมษายน)$/, 4],
  [/^(พ\.?ค\.?|พฤษภาคม)$/, 5],
  [/^(มิ\.?ย\.?|มิถุนายน)$/, 6],
  [/^(ก\.?ค\.?|กรกฎาคม)$/, 7],
  [/^(ส\.?ค\.?|สิงหาคม)$/, 8],
  [/^(ก\.?ย\.?|กันยายน)$/, 9],
  [/^(ต\.?ค\.?|ตุลาคม)$/, 10],
  [/^(พ\.?ย\.?|พฤศจิกายน)$/, 11],
  [/^(ธ\.?ค\.?|ธันวาคม)$/, 12]
];

/** "69" on a Thai sheet is 2569 (2026), not 2069: a two-digit year too far ahead is read as Buddhist. */
function fourDigitYear(two: string) {
  const thisYear = new Date().getFullYear();
  const guess = 2000 + Number(two);
  return guess > thisYear + 5 ? String(guess + 500 - 543) : String(guess);
}

export function parseDateValue(value: unknown) {
  const raw = cleanString(value);
  if (!raw) {
    return null;
  }

  // Thai dates: "5 ต.ค. 2569", "5 ตุลาคม 69", "5 ต.ค.69".
  const thaiMatch = raw.match(/^(\d{1,2})\s*([ก-๙.]+?)\s*(\d{2,4})$/);
  if (thaiMatch) {
    const month = THAI_MONTHS.find(([pattern]) => pattern.test(thaiMatch[2]))?.[1];
    if (month) {
      const year = thaiMatch[3].length === 2 ? fourDigitYear(thaiMatch[3]) : String(Number(thaiMatch[3]) > 2400 ? Number(thaiMatch[3]) - 543 : Number(thaiMatch[3]));
      const date = new Date(Date.UTC(Number(year), month - 1, Number(thaiMatch[1])));
      return date.getUTCDate() === Number(thaiMatch[1]) ? [year, String(month).padStart(2, "0"), thaiMatch[1].padStart(2, "0")].join("-") : null;
    }
  }

  const cleaned = raw.replace(/(\d+)(st|nd|rd|th)/gi, "$1").replace(/\./g, "/");
  const isoMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  // Thai documents often use the Buddhist calendar (2569 = 2026).
  const gregorianYear = (year: string) => String(Number(year) > 2400 ? Number(year) - 543 : Number(year));
  // Rejects impossible dates such as 31-02-2026 instead of storing them.
  const real = (year: string, month: string, day: string) => {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
      ? [year, month.padStart(2, "0"), day.padStart(2, "0")].join("-")
      : null;
  };

  if (isoMatch) {
    return real(gregorianYear(isoMatch[1]), isoMatch[2], isoMatch[3]);
  }

  const dayFirstMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dayFirstMatch) {
    const year = dayFirstMatch[3].length === 2 ? fourDigitYear(dayFirstMatch[3]) : gregorianYear(dayFirstMatch[3]);
    return real(year, dayFirstMatch[2], dayFirstMatch[1]);
  }

  // Text dates like "Jul 22 2023". Read the calendar date as written: going
  // through toISOString() would shift it a day back on a server east of UTC.
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return [parsed.getFullYear(), String(parsed.getMonth() + 1).padStart(2, "0"), String(parsed.getDate()).padStart(2, "0")].join("-");
}

/** Numbers like mileage where "Unknown", "-" or blank mean "not known", never zero. */
export function parseKnownNumber(value: unknown) {
  const text = cleanString(value).toLowerCase();
  if (!text || ["unknown", "n/a", "na", "-", "?", "tbc", "tbd"].includes(text)) return null;
  return parseNumberValue(value);
}

export function normalizeTransactionType(value: unknown) {
  const cleaned = cleanString(value).toLowerCase().replace(/\s+/g, "_");
  const allowed = new Set([
    "rental_income",
    "charge_recovered",
    "repair",
    "servicing",
    "maintenance",
    "fuel",
    "insurance",
    "tax",
    "finance",
    "fine",
    "accessories",
    "refund",
    "deposit",
    "deposit_received",
    "deposit_refunded",
    "deposit_forfeited",
    "deposit_deduction",
    "other"
  ]);

  if (allowed.has(cleaned)) {
    return cleaned;
  }

  // Thai words operators write in a money column.
  if (/ค่าเช่า|เช่า/.test(cleaned)) return "rental_income";
  if (/มัดจำ|ประกันความเสียหาย/.test(cleaned)) return "deposit";
  if (/คืนเงิน/.test(cleaned)) return "refund";
  if (/ซ่อม/.test(cleaned)) return "repair";
  if (/น้ำมัน/.test(cleaned)) return "fuel";
  if (/ประกัน|พรบ|พ\.ร\.บ/.test(cleaned)) return "insurance";
  if (/ภาษี|ทะเบียน/.test(cleaned)) return "tax";
  if (/เช็ค|บริการ|ถ่ายน้ำมัน/.test(cleaned)) return "servicing";
  if (/ค่าปรับ|ใบสั่ง/.test(cleaned)) return "fine";
  if (/ผ่อน|ไฟแนนซ์/.test(cleaned)) return "finance";
  if (cleaned.includes("rent")) return "rental_income";
  if (cleaned.includes("service")) return "servicing";
  if (cleaned.includes("insur")) return "insurance";
  if (cleaned.includes("fuel")) return "fuel";
  if (cleaned.includes("deposit")) return "deposit";
  if (cleaned.includes("refund")) return "refund";
  if (cleaned.includes("finance") || cleaned.includes("loan")) return "finance";
  return "other";
}
