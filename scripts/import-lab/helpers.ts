import * as XLSX from "xlsx";
import { businessToday } from "@/lib/business-time";
import { plateKey } from "@/lib/import/normalize";
import type { ImportPreview, PreviewRental, PreviewTransaction, PreviewVehicle } from "@/lib/import/preview";

export type Cell = string | number | null;
export type Tab = { name: string; rows: Cell[][]; merges?: string[] };

export function workbookBytes(tabs: Tab[]) {
  const book = XLSX.utils.book_new();
  for (const tab of tabs) {
    const sheet = XLSX.utils.aoa_to_sheet(tab.rows.map((row) => row.map((cell) => (cell === null ? "" : cell))));
    if (tab.merges) sheet["!merges"] = tab.merges.map((range) => XLSX.utils.decode_range(range));
    XLSX.utils.book_append_sheet(book, sheet, tab.name);
  }
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// Dates relative to today (the business's own day), written the ways owners write them.
const TODAY = businessToday();
function shift(days: number) {
  const day = new Date(`${TODAY}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day;
}
const pad = (value: number) => String(value).padStart(2, "0");
/** 2026-10-05 */
export const iso = (days: number) => shift(days).toISOString().slice(0, 10);
/** 05/10/2026 */
export const dmy = (days: number, sep = "/") => {
  const day = shift(days);
  return [pad(day.getUTCDate()), pad(day.getUTCMonth() + 1), day.getUTCFullYear()].join(sep);
};
/** 05/10/2569 (Buddhist year) */
export const dmyBE = (days: number) => {
  const day = shift(days);
  return [pad(day.getUTCDate()), pad(day.getUTCMonth() + 1), day.getUTCFullYear() + 543].join("/");
};
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** 5 Oct 2026 */
export const dMonY = (days: number) => {
  const day = shift(days);
  return `${day.getUTCDate()} ${EN_MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear()}`;
};
/** Oct 5th, 2026 */
export const monDthY = (days: number) => {
  const day = shift(days);
  const n = day.getUTCDate();
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${EN_MONTHS[day.getUTCMonth()]} ${n}${suffix}, ${day.getUTCFullYear()}`;
};
/** 5 Oct (no year) */
export const dMon = (days: number) => {
  const day = shift(days);
  return `${day.getUTCDate()} ${EN_MONTHS[day.getUTCMonth()]}`;
};
/** 5 ต.ค. 69 */
export const thaiShort = (days: number) => {
  const day = shift(days);
  return `${day.getUTCDate()} ${TH_MONTHS[day.getUTCMonth()]} ${String(day.getUTCFullYear() + 543).slice(2)}`;
};
/** ต.ค. 2569: a month tab's name */
export const thaiMonthTab = (days: number) => {
  const day = shift(days);
  return `${TH_MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear() + 543}`;
};
/** Oct 2026 */
export const monthTab = (days: number) => {
  const day = shift(days);
  return `${EN_MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear()}`;
};

// Checks. Each returns a description of what's wrong, or null.
export type Check = (preview: ImportPreview) => string | null;
export const vehicle = (preview: ImportPreview, plate: string): PreviewVehicle | undefined => preview.vehicles.find((item) => plateKey(item.plate) === plateKey(plate));
export const rentalOn = (preview: ImportPreview, plate: string): PreviewRental | undefined => preview.rentals.find((item) => plateKey(item.plate) === plateKey(plate) && item.include);
export const moneyOn = (preview: ImportPreview, plate: string): PreviewTransaction[] => preview.transactions.filter((item) => plateKey(item.plate) === plateKey(plate));

export function same(label: string, actual: unknown, expected: unknown): string | null {
  return JSON.stringify(actual) === JSON.stringify(expected) ? null : `${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`;
}

/** The vehicle with this plate has these values. */
export function vehicleHas(plate: string, values: Partial<Record<keyof PreviewVehicle, unknown>>): Check {
  return (preview) => {
    const card = vehicle(preview, plate);
    if (!card) return `no vehicle ${plate} (have: ${preview.vehicles.map((item) => item.plate || "?").join(", ")})`;
    for (const [field, expected] of Object.entries(values)) {
      const problem = same(`${plate} ${field}`, (card as any)[field], expected);
      if (problem) return problem;
    }
    return null;
  };
}

/** The rental on this plate has these values. */
export function rentalHas(plate: string, values: Partial<Record<keyof PreviewRental, unknown>>): Check {
  return (preview) => {
    const card = rentalOn(preview, plate);
    if (!card) return `no rental on ${plate} (have: ${preview.rentals.map((item) => item.plate || "?").join(", ")})`;
    for (const [field, expected] of Object.entries(values)) {
      const problem = same(`rental ${plate} ${field}`, (card as any)[field], expected);
      if (problem) return problem;
    }
    return null;
  };
}

/** Money records: how many of each kind. */
export function moneyKinds(expected: Record<string, number>): Check {
  return (preview) => {
    const counts: Record<string, number> = {};
    for (const item of preview.transactions.filter((record) => record.include)) counts[item.type] = (counts[item.type] || 0) + 1;
    const keys = Object.keys({ ...expected, ...counts }).sort();
    return same("money kinds", Object.fromEntries(keys.map((key) => [key, counts[key] || 0])), Object.fromEntries(keys.map((key) => [key, expected[key] || 0])));
  };
}

/** The money record whose note contains this text is of this kind (and on this date, if given). */
export function moneyNote(text: string, type: string, date?: string): Check {
  return (preview) => {
    const item = preview.transactions.find((record) => record.notes.toLowerCase().includes(text.toLowerCase()));
    if (!item) return `no money record noting "${text}"`;
    return same(`"${text}" kind`, item.type, type) || (date ? same(`"${text}" date`, item.date, date) : null);
  };
}

/** No included card of any kind has this problem. */
export function noProblem(problem: string): Check {
  return (preview) => {
    const cards = [...preview.vehicles, ...preview.rentals, ...preview.customers, ...preview.transactions].filter((item) => item.include && (item.problems as string[]).includes(problem));
    return cards.length ? `${cards.length} card(s) with "${problem}": ${cards.slice(0, 3).map((item) => `${item.sheet} row ${item.row}`).join(", ")}` : null;
  };
}
