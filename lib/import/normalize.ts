export function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

export function cleanPlate(value: unknown) {
  return cleanString(value).replace(/\s+/g, "").toUpperCase();
}

export function parseNumberValue(value: unknown) {
  const cleaned = cleanString(value).replace(/[฿,\s]|THB/gi, "");
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

export function parseDateValue(value: unknown) {
  const raw = cleanString(value);
  if (!raw) {
    return null;
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
    const year = dayFirstMatch[3].length === 2 ? `20${dayFirstMatch[3]}` : gregorianYear(dayFirstMatch[3]);
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

  if (cleaned.includes("rent")) return "rental_income";
  if (cleaned.includes("service")) return "servicing";
  if (cleaned.includes("insur")) return "insurance";
  if (cleaned.includes("fuel")) return "fuel";
  if (cleaned.includes("deposit")) return "deposit";
  if (cleaned.includes("refund")) return "refund";
  if (cleaned.includes("finance") || cleaned.includes("loan")) return "finance";
  return "other";
}
