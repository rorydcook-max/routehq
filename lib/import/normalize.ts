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
  if (isoMatch) {
    return [isoMatch[1], isoMatch[2].padStart(2, "0"), isoMatch[3].padStart(2, "0")].join("-");
  }

  const dayFirstMatch = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dayFirstMatch) {
    const year = dayFirstMatch[3].length === 2 ? `20${dayFirstMatch[3]}` : dayFirstMatch[3];
    return [year, dayFirstMatch[2].padStart(2, "0"), dayFirstMatch[1].padStart(2, "0")].join("-");
  }

  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
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
