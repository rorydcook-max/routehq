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

  // A time after the date ("08/10/2026 09:00", "2026-10-13T10:00", "9:00 AM") isn't part of the day.
  const dateOnly = raw.replace(/[T\s,]+\d{1,2}[:.]\d{2}(?::\d{2})?(?:\.\d+)?\s*(?:am|pm)?\s*(?:Z|[+-]\d{2}:?\d{2})?$/i, "").trim();
  const cleaned = dateOnly.replace(/(\d+)(st|nd|rd|th)/gi, "$1").replace(/\./g, "/");
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
    // Day first, as Thailand and Europe write it; a date that only works month first (10/22/2026) is American.
    return real(year, dayFirstMatch[2], dayFirstMatch[1]) || real(year, dayFirstMatch[1], dayFirstMatch[2]);
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

/**
 * Two names that could be the same person: one is missing, they match, the first names match, or one contains
 * the other ("Maria" / "Maria Garcia"). A phone number alone is not enough to say a row is someone already saved:
 * numbers get shared and reused, and a booking attached to the wrong person shows them someone else's rental.
 */
export function namesAgree(a: unknown, b: unknown) {
  const tidy = (value: unknown) => cleanString(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
  const x = tidy(a);
  const y = tidy(b);
  if (!x || !y || x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  return x.split(" ")[0] === y.split(" ")[0];
}

/**
 * What a cost was for, from how the owner described it ("Front wipers", "Brakes, oil change, service",
 * "Insurance excess for bumper repair"). Checked in order: buying a vehicle, tax, insurance (an excess for a repair is an insurance cost),
 * fines, fuel, finance, add-ons, repairs ("wiper spray motor" is a repair), servicing, then upkeep. "other" when nothing fits.
 */
export function categorizeCost(description: unknown) {
  const text = cleanString(description).toLowerCase();
  if (!text) return "other";
  if (/car purchase|vehicle purchase|bought (the |a )?(car|vehicle|bike)|purchase of (the )?(car|vehicle)|ซื้อรถ/.test(text)) return "vehicle_purchase";
  if (/\btax\b|registration renewal|ภาษี|ต่อทะเบียน/.test(text)) return "tax";
  if (/insurance|excess|\bprb\b|p\.r\.b|compulsory|ประกัน|พ\.?ร\.?บ/.test(text)) return "insurance";
  if (/\bfine\b|ticket|parking fine|police|ค่าปรับ|ใบสั่ง/.test(text)) return "fine";
  if (/\bfuel\b|petrol|diesel|gasoline|น้ำมันรถ|เติมน้ำมัน/.test(text)) return "fuel";
  if (/gps|dash ?cam|camera|\bcam\b|infotainment|carplay|android auto|seat cover|tint|key ?fob|armrest|sim card|\bscreen\b|gear (stick|lever) cover|phone holder|accessor|ฟิล์ม|กล้อง/.test(text)) return "accessories";
  if (/repair|fix|replac|puncture|blowout|broken|motor|caliper|shock|joint|gearbox|belt|bush|strut|wishbone|catch|mirror|button|upholster|suspension|bumper|windscreen|windshield|trim|ซ่อม|เปลี่ยน/.test(text)) return "repair";
  if (/servic|oil change|\boil\b|transmission oil|filter|ถ่ายน้ำมัน|เช็คระยะ/.test(text)) return "servicing";
  if (/tyre|tire|wiper|batter|bulb|clean|detail|ceramic|glass coat|wash|polish|brake pad|air ?con|wheel align|balanc|tracking|ล้างรถ|ยาง|แบต/.test(text)) return "maintenance";
  if (/finance|instal(l)?ment|loan|ค่างวด|ผ่อน/.test(text)) return "finance";
  return "other";
}
