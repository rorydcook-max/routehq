import { guessField } from "@/lib/import/header-guess";
import { parseDateValue } from "@/lib/import/normalize";

export type ParsedSheet = {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
  sampleRows: Record<string, string>[];
};

type SpreadsheetInput = File | { bytes: Buffer; filename: string; type?: string };
type Merge = { s: { r: number; c: number }; e: { r: number; c: number } };

const text = (cell: unknown) => String(cell ?? "").replace(/^﻿/, "").replace(/\s+/g, " ").trim();
const isBlank = (row: string[]) => !row.some(Boolean);
const filled = (row: string[]) => row.filter(Boolean);
const looksNumeric = (value: string) => /^[-+(]?[฿$]?\s*[\d,.]+\)?\s*[kK]?$/.test(value);

/**
 * Reads CSV the way spreadsheet programs write it: quoted cells (with commas and line breaks inside), and ";" or
 * tab separators when the file was saved in a locale that uses them.
 */
export function parseCsv(content: string): string[][] {
  const source = content.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const outside = firstLine.replace(/"[^"]*"/g, "");
  const best = [",", ";", "\t"].map((char) => ({ char, count: outside.split(char).length - 1 })).sort((a, b) => b.count - a.count)[0];
  const separator = best.count > 0 ? best.char : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"' && !cell.trim()) quoted = true;
    else if (char === separator) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

function extractGoogleSheetId(url: string) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || "";
}

export function isGoogleSheetsUrl(value: string) {
  return /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(value.trim());
}

export async function googleSheetToSpreadsheetInput(url: string): Promise<SpreadsheetInput> {
  const spreadsheetId = extractGoogleSheetId(url);

  if (!spreadsheetId) {
    throw new Error("Enter a valid public Google Sheets share link.");
  }

  const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
  const response = await fetch(exportUrl);

  if (!response.ok) {
    throw new Error("Unable to fetch this Google Sheet. Make sure it is shared publicly or set to anyone with the link can view.");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    throw new Error("Google returned a web page instead of a spreadsheet. Make sure the sheet is public and shareable.");
  }

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    filename: "google-sheet.xlsx",
    type: contentType
  };
}

function inputName(input: SpreadsheetInput) {
  return input instanceof File ? input.name : input.filename;
}

function inputType(input: SpreadsheetInput) {
  return input instanceof File ? input.type : input.type || "";
}

async function inputText(input: SpreadsheetInput) {
  return input instanceof File ? input.text() : input.bytes.toString("utf8");
}

async function inputBytes(input: SpreadsheetInput) {
  return input instanceof File ? Buffer.from(await input.arrayBuffer()) : input.bytes;
}

/** A tab that only sums up the others ("Summary", "Dashboard", "สรุป"): nothing in it to bring in. */
const SUMMARY_TAB = /^\s*(summary|totals?|dashboard|overview|report|charts?|สรุป|สรุปยอด|ภาพรวม|รายงาน)\s*$/i;

/** How much a row reads like column headings: cells that name a known column, and no amounts or dates. */
function headerScore(row: string[]) {
  const cells = filled(row);
  if (cells.length < 2) return 0;
  if (cells.some((cell) => looksNumeric(cell) || parseDateValue(cell))) return 0;
  // Distinct names only: a merged group label filled across its columns ("Vehicle Vehicle Vehicle") counts once.
  return new Set(cells.filter((cell) => cell.length <= 40 && guessField(cell, new Set())).map((cell) => cell.toLowerCase())).size;
}

/**
 * A sheet laid out sideways: one block of columns per vehicle ("Payment Due Date | Amount | Received | Receipt",
 * repeated), the vehicle named above its block. Owners track monthly rent this way. Returned one row per entry:
 * Vehicle, then the block's own columns. Null when the sheet isn't laid out like that.
 */
function unfoldVehicleBlocks(sheetName: string, rows: string[][]): ParsedSheet | null {
  for (let headerAt = 0; headerAt < Math.min(rows.length, 8); headerAt += 1) {
    const header = rows[headerAt];
    const counts = new Map<string, number>();
    for (const cell of header) if (cell) counts.set(cell.toLowerCase(), (counts.get(cell.toLowerCase()) || 0) + 1);
    const repeated = [...counts.entries()].find(([label, count]) => count >= 2 && /due|date|วันที่|ครบกำหนด|วันจ่าย/i.test(label) && header.filter(Boolean).length >= count * 2);
    if (!repeated) continue;
    const starts = header.map((cell, index) => (cell.toLowerCase() === repeated[0] ? index : -1)).filter((index) => index >= 0);
    const width = starts[1] - starts[0];
    if (!(width >= 2 && width <= 8)) continue;
    const labels = header.slice(starts[0], starts[0] + width).map((cell, index) => cell || `Column ${index + 1}`);
    // The vehicle each block is for: the most telling text above the block (not a "[NAME]" placeholder).
    const vehicleOf = (start: number) => {
      const candidates: string[] = [];
      for (let above = 0; above < headerAt; above += 1) {
        for (let column = start; column < start + width; column += 1) {
          const value = rows[above][column] || "";
          if (value && !/\[.*\]|^contact|^rented by/i.test(value)) candidates.push(value);
        }
      }
      return candidates.sort((x, y) => y.length - x.length)[0] || "";
    };
    const vehicles = starts.map(vehicleOf);
    // Blocks need a vehicle above them; without one this is an ordinary table with a repeated heading.
    if (vehicles.filter(Boolean).length < starts.length) continue;
    const out: Record<string, string>[] = [];
    for (const row of rows.slice(headerAt + 1)) {
      starts.forEach((start, block) => {
        const cells = labels.map((_, index) => row[start + index] || "");
        // An entry needs more than a tick box: a date or an amount.
        if (!cells.some((cell) => cell && !/^(true|false)$/i.test(cell))) return;
        out.push({ Vehicle: vehicles[block], ...Object.fromEntries(labels.map((label, index) => [label, cells[index]])) });
      });
    }
    if (!out.length) return null;
    const headers = ["Vehicle", ...labels];
    return { sheetName, headers, rows: out, sampleRows: out.slice(0, 5) };
  }
  return null;
}

/** Copies a merged cell's value into every cell it covers, so a merged heading or vehicle name reaches each column and row. */
function fillMerges(rows: string[][], merges: Merge[]) {
  for (const merge of merges) {
    const value = rows[merge.s.r]?.[merge.s.c] || "";
    if (!value) continue;
    for (let r = merge.s.r; r <= merge.e.r; r += 1) {
      if (!rows[r]) continue;
      for (let c = merge.s.c; c <= merge.e.c; c += 1) if (!rows[r][c]) rows[r][c] = value;
    }
  }
}

/** The best heading row from `from` on: the one that names most known columns, else the first with two cells. */
function findHeader(rows: string[][], from: number) {
  let best = -1;
  let bestScore = 1;
  let firstWide = -1;
  let seen = 0;
  for (let index = from; index < rows.length && seen < 12; index += 1) {
    if (isBlank(rows[index])) continue;
    seen += 1;
    if (firstWide < 0 && filled(rows[index]).length >= 2) firstWide = index;
    const score = headerScore(rows[index]);
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  }
  return best >= 0 ? best : firstWide;
}

/** A second table starting here: a heading row (after a gap or a one-cell title), or a title then a heading row. */
function newTableAt(rows: string[][], index: number) {
  const row = rows[index];
  const previous = rows[index - 1] || [];
  if (headerScore(row) >= 2 && (isBlank(previous) || filled(previous).length === 1)) return true;
  if (filled(row).length === 1 && !parseDateValue(filled(row)[0])) {
    let next = index + 1;
    while (next < rows.length && isBlank(rows[next])) next += 1;
    return next < rows.length && headerScore(rows[next]) >= 2;
  }
  return false;
}

/**
 * Turns a tab's grid into tables of rows keyed by column heading. Handles what owners' sheets actually look like:
 * a title above the headings, headings in two rows under a merged group label, two columns with the same heading,
 * a day's date written as a heading row above that day's entries, a totals block underneath, and a second table
 * further down the same tab.
 */
function tablesFromMatrix(sheetName: string, matrix: unknown[][], merges: Merge[] = []): ParsedSheet[] {
  if (SUMMARY_TAB.test(sheetName)) return [];
  const width = Math.max(0, ...matrix.map((row) => row.length));
  const rows = matrix.map((row) => Array.from({ length: width }, (_, index) => text(row[index])));
  fillMerges(rows, merges);
  if (!rows.some((row) => !isBlank(row))) return [];

  const sideways = unfoldVehicleBlocks(sheetName, rows.filter((row) => !isBlank(row)));
  if (sideways) return [sideways];

  const tables: ParsedSheet[] = [];
  let at = 0;
  while (at < rows.length) {
    const headerAt = findHeader(rows, at);
    if (headerAt < 0) break;
    // A one-cell row just above the headings is the table's title ("Expenses").
    let titleAt = headerAt - 1;
    while (titleAt >= at && isBlank(rows[titleAt])) titleAt -= 1;
    const title = titleAt >= at && filled(rows[titleAt]).length === 1 ? filled(rows[titleAt])[0] : "";
    // Headings under a merged group label ("Current renter" over Name | Phone | Since) carry the label.
    const groupAt = headerAt - 1;
    const grouped = groupAt >= 0 && merges.some((merge) => merge.s.r === groupAt && merge.e.r === groupAt && merge.e.c > merge.s.c);
    // No heading row at all (a notebook typed into a sheet): the first row is already an entry. Columns are
    // numbered and read from their values instead.
    const headless = headerScore(rows[headerAt]) === 0 && filled(rows[headerAt]).some((cell) => looksNumeric(cell) || parseDateValue(cell));
    const seenNames = new Map<string, number>();
    const headers = (headless ? rows[headerAt].map(() => "") : rows[headerAt]).map((cell, index) => {
      const group = grouped ? rows[groupAt][index] : "";
      let name = cell && group && group !== cell ? `${group} ${cell}` : cell || group || `Column ${index + 1}`;
      // Two columns with the same heading both keep their values ("Date", "Date (2)").
      const count = (seenNames.get(name.toLowerCase()) || 0) + 1;
      seenNames.set(name.toLowerCase(), count);
      if (count > 1) name = `${name} (${count})`;
      return name;
    });

    const data: { cells: string[]; heading: string | null }[] = [];
    let heading: string | null = null;
    let index = headless ? headerAt : headerAt + 1;
    let stopped = false;
    for (; index < rows.length; index += 1) {
      const row = rows[index];
      if (isBlank(row)) continue;
      if (data.length && index > headerAt && newTableAt(rows, index)) break;
      // A "Totals" row: the rest of this table is a summary.
      if (row.some((cell) => /^(grand )?totals?:?$|^รวม(ทั้งหมด)?$/i.test(cell))) {
        stopped = true;
        continue;
      }
      if (stopped) continue;
      const cells = filled(row);
      // A row holding only a date is a heading for the entries under it.
      if (cells.length === 1 && parseDateValue(cells[0]) && !looksNumeric(cells[0])) {
        heading = cells[0];
        continue;
      }
      data.push({ cells: row, heading });
    }
    at = Math.max(index, headerAt + 1);

    // Little side tables (per-vehicle totals under an unnamed or "Totals" column) are left out.
    const keep = headers.map((header, column) => {
      if (headless) return data.some((item) => item.cells[column]);
      if (!/^(column \d+|totals?)( \(\d+\))?$/i.test(header)) return true;
      const count = data.filter((item) => item.cells[column]).length;
      return count >= data.length * 0.5 && count > 0;
    });
    const kept = headers.map((header, column) => ({ header, column })).filter((item) => keep[item.column]);
    const records = data.map((item) => Object.fromEntries(kept.map(({ header, column }) => [header, item.cells[column] || ""])));
    const outHeaders = kept.map((item) => item.header);
    if (data.some((item) => item.heading)) {
      const dateHeader = outHeaders.includes("Date") ? "Date (heading)" : "Date";
      outHeaders.unshift(dateHeader);
      data.forEach((item, row) => {
        records[row] = { [dateHeader]: item.heading || "", ...records[row] };
      });
    }
    if (records.length || !tables.length) {
      const name = tables.length ? `${sheetName} · ${title || tables.length + 1}` : sheetName;
      tables.push({ sheetName: name, headers: outHeaders, rows: records, sampleRows: records.slice(0, 5) });
    }
    if (index <= headerAt) break;
  }
  return tables.filter((table) => table.rows.length || tables.length === 1);
}

export async function parseSpreadsheetFile(file: SpreadsheetInput): Promise<ParsedSheet[]> {
  const extension = inputName(file).split(".").pop()?.toLowerCase();

  if (extension === "csv" || extension === "tsv" || inputType(file).includes("csv")) {
    return tablesFromMatrix(inputName(file) || "CSV import", parseCsv(await inputText(file)));
  }

  let xlsx: any;
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
    xlsx = await dynamicImport("xlsx");
  } catch {
    throw new Error("The xlsx package is required for Excel imports. Run npm install xlsx, then restart the app.");
  }

  const workbook = xlsx.read(await inputBytes(file), {
    cellDates: false,
    type: "buffer"
  });

  return workbook.SheetNames.flatMap((sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = xlsx.utils.sheet_to_json(sheet, {
      blankrows: true,
      defval: "",
      header: 1,
      raw: false,
      // Excel's default date format would come out American (10/5/26); ISO can't be misread.
      dateNF: "yyyy-mm-dd"
    }) as unknown[][];
    const start = sheet["!ref"] ? xlsx.utils.decode_range(sheet["!ref"]).s : { r: 0, c: 0 };
    const merges: Merge[] = (sheet["!merges"] || []).map((merge: Merge) => ({ s: { r: merge.s.r - start.r, c: merge.s.c - start.c }, e: { r: merge.e.r - start.r, c: merge.e.c - start.c } }));
    return tablesFromMatrix(sheetName, matrix, merges);
  }) as ParsedSheet[];
}
