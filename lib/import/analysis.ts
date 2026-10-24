/**
 * The column mapping the importer works from: what each column of each sheet means. The AI's answer (when there is
 * one) is made safe here, and anything it didn't place is read from the header. Kept apart from the route so the
 * importer's test library can run the same steps without a server.
 */
import { IMPORT_FIELD_KEYS } from "@/lib/import/fields";
import { guessField } from "@/lib/import/header-guess";
import type { ParsedSheet } from "@/lib/import/spreadsheet";
import { cleanString, parseDateValue, parseNumberValue } from "@/lib/import/normalize";
import { looksLikePlate, looksLikeVehicleName, sheetDataType } from "@/lib/import/preview";

export type ColumnMapping = { source_column: string; routehq_field: string; confidence?: number; sample_values?: string[] };
export type SheetAnalysis = {
  sheet_name: string;
  primary_data_type: string;
  confidence?: number;
  column_mappings: ColumnMapping[];
  row_count?: number;
};
export type Analysis = { detected_data_types: string[]; import_summary: string; sheets: SheetAnalysis[] };

const DATA_TYPES = new Set(["vehicles", "customers", "rentals", "transactions"]);

const YES_NO = /^(true|false|yes|no|y|n|ใช่|ไม่|ไม่ใช่|✓|✔|✗|x|☑|☐|done|paid|unpaid|returned|out)$/i;
const DATE_FIELDS = new Set(["start_date", "end_date", "date", "next_payment_date", "tax_expiry_date", "insurance_expiry_date", "porbor_expiry_date", "purchase_date", "last_service_date", "next_service_date", "finance_end_date"]);

/**
 * A header can mislead; the column's values settle it. Only columns read from their header are changed (the AI has
 * seen the values already):
 * - "Returned" full of yes/no is whether the vehicle came back, not a return date; "Paid" full of yes/no likewise.
 * - "Paid" holding amounts is money already paid (on a bookings sheet) or money in (on a ledger).
 * - On a bookings sheet a lone "Total" is the booking's total price, and a lone "Date" is when it started.
 */
function refineByValues(sheet: ParsedSheet, mappings: ColumnMapping[]) {
  const has = (field: string) => mappings.some((mapping) => mapping.routehq_field === field);
  const values = (header: string) => sheet.rows.map((row) => cleanString(row[header])).filter(Boolean);
  const mostly = (list: string[], test: (value: string) => boolean) => list.length > 0 && list.filter(test).length >= list.length * 0.7;
  const move = (mapping: ColumnMapping, field: string) => {
    mapping.routehq_field = field === "__ignore__" || !has(field) ? field : "__ignore__";
  };
  const guessed = (mapping: ColumnMapping) => (mapping.confidence ?? 0) <= 0.6 && mapping.routehq_field !== "__ignore__";
  const bookings = () => ["customer_name", "first_name", "last_name", "full_name"].some(has) && (has("start_date") || has("end_date") || has("rental_days") || (has("date") && (has("daily_rate") || has("rental_rate"))));

  for (const mapping of mappings.filter(guessed)) {
    const list = values(mapping.source_column);
    if (DATE_FIELDS.has(mapping.routehq_field) && mostly(list, (value) => YES_NO.test(value))) {
      move(mapping, /return|back|คืน/i.test(mapping.source_column) ? "returned" : /paid|receiv|จ่าย|รับ/i.test(mapping.source_column) ? "paid" : "__ignore__");
    } else if (mapping.routehq_field === "paid" && mostly(list, (value) => !YES_NO.test(value) && parseNumberValue(value) !== null)) {
      move(mapping, bookings() ? "amount_paid" : "money_in");
    }
  }
  if (bookings()) {
    const amount = mappings.find((mapping) => mapping.routehq_field === "amount" && guessed(mapping));
    if (amount) move(amount, "rental_total");
    const date = mappings.find((mapping) => mapping.routehq_field === "date" && guessed(mapping));
    if (date && !has("start_date")) move(date, "start_date");
  } else {
    const total = mappings.find((mapping) => mapping.routehq_field === "rental_total" && guessed(mapping));
    if (total) move(total, "amount");
  }
}

/**
 * A column the header didn't explain (no heading, or one nobody uses) read from what's in it: plates, dates,
 * phone numbers, "3 days", vehicle models, amounts, people's names. Only used when nothing else placed it.
 */
function guessFromValues(list: string[], used: Set<string>, unnamed: boolean): string | null {
  if (list.length === 0) return null;
  const share = (test: (value: string) => boolean) => list.filter(test).length / list.length;
  const free = (field: string) => !used.has(field);
  if (share(looksLikePlate) >= 0.7 && free("registration_number")) return "registration_number";
  if (share((value) => /^\d+\s*(days?|d|วัน|nights?)$/i.test(value)) >= 0.7 && free("rental_days")) return "rental_days";
  if (share((value) => /@/.test(value)) >= 0.7 && free("email")) return "email";
  if (share((value) => /^(\+?\d[\d\s-]{7,15})$/.test(value) && value.replace(/\D/g, "").length >= 9 && value.replace(/\D/g, "").length <= 13 && /^(\+|0)/.test(value)) >= 0.7 && free("phone")) return "phone";
  // The rest only for columns with no heading at all: a named column nobody recognised ("Location", "Seats") is
  // better left for the owner than turned into a renter or an amount.
  if (!unnamed) return null;
  if (share((value) => Boolean(parseDateValue(value)) && !/^\d+([.,]\d+)?$/.test(value)) >= 0.7) {
    if (free("start_date")) return "start_date";
    if (free("end_date")) return "end_date";
    return null;
  }
  if (share((value) => YES_NO.test(value)) >= 0.7) return null;
  if (share(looksLikeVehicleName) >= 0.6 && free("vehicle_name")) return "vehicle_name";
  if (share((value) => parseNumberValue(value) !== null) >= 0.8) return free("amount") ? "amount" : null;
  if (share((value) => /^[\p{L}][\p{L}\p{M} .'-]{1,40}$/u.test(value) && !/\d/.test(value)) >= 0.8 && free("customer_name")) return "customer_name";
  return null;
}

function samplesFor(sheet: ParsedSheet, header: string) {
  return sheet.rows
    .map((row) => row[header])
    .filter((value) => String(value || "").trim())
    .slice(0, 3);
}

/**
 * Make the AI's answer safe to show: every column of every sheet appears once
 * (so anything the AI skipped can still be mapped by hand), unknown field
 * names become "ignore", and row counts come from the file, not the AI.
 */
export function normaliseAnalysis(raw: any, sheets: ParsedSheet[]): Analysis {
  const rawSheets: any[] = Array.isArray(raw?.sheets) ? raw.sheets : [];
  const analysed: SheetAnalysis[] = sheets.map((sheet) => {
    const match = rawSheets.find((item) => item?.sheet_name === sheet.sheetName) || (sheets.length === 1 ? rawSheets[0] : null);
    const suggestions = new Map<string, any>(
      (Array.isArray(match?.column_mappings) ? match.column_mappings : []).map((mapping: any) => [String(mapping?.source_column || ""), mapping])
    );
    const used = new Set<string>();
    const first = sheet.headers.map((header) => {
      const suggestion = suggestions.get(header);
      let field = String(suggestion?.routehq_field || "");
      // One column per field: a second column claiming the same field is left for the user to decide.
      if (!IMPORT_FIELD_KEYS.has(field) || used.has(field)) field = "__ignore__";
      if (field !== "__ignore__") used.add(field);
      return { header, field, confidence: field === "__ignore__" ? 0 : Number(suggestion?.confidence || 0) };
    });
    // Columns the AI didn't place (or every column, when it wasn't available) are read from their headers.
    const column_mappings = first.map(({ header, field, confidence }) => {
      let chosen = field;
      let sure = confidence;
      if (chosen === "__ignore__") {
        const guess = guessField(header, used);
        if (guess && IMPORT_FIELD_KEYS.has(guess)) {
          chosen = guess;
          sure = 0.6;
          used.add(guess);
        }
      }
      return { source_column: header, routehq_field: chosen, confidence: sure, sample_values: samplesFor(sheet, header) };
    });
    // Still unplaced and the AI didn't look at it: read it from its values.
    for (const mapping of column_mappings) {
      if (mapping.routehq_field !== "__ignore__" || suggestions.has(mapping.source_column)) continue;
      const guess = guessFromValues(sheet.rows.map((row) => cleanString(row[mapping.source_column])).filter(Boolean), used, /^column \d+$/i.test(mapping.source_column));
      if (guess) {
        mapping.routehq_field = guess;
        mapping.confidence = 0.5;
        used.add(guess);
      }
    }
    // Dates read from their values on a sheet with no renter are just dates (a ledger), not rental starts.
    const fieldsNow = new Set(column_mappings.map((mapping) => mapping.routehq_field));
    if (!["customer_name", "first_name", "last_name", "full_name"].some((field) => fieldsNow.has(field))) {
      for (const mapping of column_mappings) if (mapping.confidence === 0.5 && mapping.routehq_field === "start_date" && !fieldsNow.has("date")) mapping.routehq_field = "date";
    }
    // Amounts read from their values on a bookings sheet are the rent.
    if (fieldsNow.has("customer_name") && (fieldsNow.has("start_date") || fieldsNow.has("rental_days"))) {
      for (const mapping of column_mappings) if (mapping.confidence === 0.5 && mapping.routehq_field === "amount" && !fieldsNow.has("rental_rate")) mapping.routehq_field = "rental_rate";
    }
    refineByValues(sheet, column_mappings);
    const type = String(match?.primary_data_type || "").toLowerCase();
    const inferred = sheetDataType("", column_mappings);
    return {
      sheet_name: sheet.sheetName,
      primary_data_type: DATA_TYPES.has(type) ? type : inferred === "payments" ? "transactions" : inferred,
      confidence: Number(match?.confidence || 0),
      column_mappings,
      row_count: sheet.rows.length
    };
  });

  const detected = Array.from(new Set(analysed.map((sheet) => sheet.primary_data_type)));
  const summary = analysed
    .map((sheet) => `${sheet.sheet_name}: ${sheet.row_count} row${sheet.row_count === 1 ? "" : "s"} of ${sheet.primary_data_type}`)
    .join(" · ");
  return { detected_data_types: detected, import_summary: summary, sheets: analysed };
}
