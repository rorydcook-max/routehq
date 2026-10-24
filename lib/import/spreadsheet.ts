export type ParsedSheet = {
  sheetName: string;
  headers: string[];
  rows: Record<string, string>[];
  sampleRows: Record<string, string>[];
};

type SpreadsheetInput = File | { bytes: Buffer; filename: string; type?: string };

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
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

const text = (cell: unknown) => String(cell ?? "").trim();

/**
 * A sheet laid out sideways: one block of columns per vehicle ("Payment Due Date | Amount | Received | Receipt",
 * repeated), the vehicle named above its block. Owners track monthly rent this way. Returned one row per entry:
 * Vehicle, then the block's own columns. Null when the sheet isn't laid out like that.
 */
function unfoldVehicleBlocks(sheetName: string, rows: unknown[][]): ParsedSheet | null {
  for (let headerAt = 0; headerAt < Math.min(rows.length, 8); headerAt += 1) {
    const header = rows[headerAt].map(text);
    const counts = new Map<string, number>();
    for (const cell of header) if (cell) counts.set(cell.toLowerCase(), (counts.get(cell.toLowerCase()) || 0) + 1);
    const repeated = [...counts.entries()].find(([label, count]) => count >= 3 && /due|date|วันที่|ครบกำหนด/i.test(label));
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
          const value = text(rows[above][column]).replace(/\s+/g, " ").trim();
          if (value && !/\[.*\]|^contact|^rented by/i.test(value)) candidates.push(value);
        }
      }
      return candidates.sort((x, y) => y.length - x.length)[0] || "";
    };
    const vehicles = starts.map(vehicleOf);
    const out: Record<string, string>[] = [];
    for (const row of rows.slice(headerAt + 1)) {
      starts.forEach((start, block) => {
        const cells = labels.map((_, index) => text(row[start + index]));
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

function rowsFromMatrix(sheetName: string, matrix: unknown[][]): ParsedSheet | null {
  const usefulRows = matrix.filter((row) => row.some((cell) => text(cell)));
  if (usefulRows.length === 0) {
    return null;
  }

  const sideways = unfoldVehicleBlocks(sheetName, usefulRows);
  if (sideways) return sideways;

  const headerIndex = usefulRows.findIndex((row) => row.filter((cell) => text(cell)).length >= 2);
  let headers = (usefulRows[Math.max(headerIndex, 0)] || []).map((cell, index) => String(cell || `Column ${index + 1}`).trim());
  let dataRows = usefulRows.slice(Math.max(headerIndex, 0) + 1);
  // A "Totals" block under the table is a summary, not more records.
  const totalsAt = dataRows.findIndex((row) => row.some((cell) => /^totals?:?$/i.test(text(cell))));
  if (totalsAt >= 0) dataRows = dataRows.slice(0, totalsAt);
  // A little table beside the main one (per-vehicle totals under an unnamed or "Totals" column) is left out.
  const keep = headers.map((header, index) => {
    if (!/^(column \d+|totals?)$/i.test(header)) return true;
    const filled = dataRows.filter((row) => text(row[index])).length;
    return filled >= dataRows.length * 0.5;
  });
  const kept = headers.map((header, index) => ({ header, index })).filter((item) => keep[item.index]);
  headers = kept.map((item) => item.header);
  const rows = dataRows.map((row) => Object.fromEntries(kept.map(({ header, index }) => [header, text(row[index])])));

  return {
    sheetName,
    headers,
    rows,
    sampleRows: rows.slice(0, 5)
  };
}

export async function parseSpreadsheetFile(file: SpreadsheetInput): Promise<ParsedSheet[]> {
  const extension = inputName(file).split(".").pop()?.toLowerCase();

  if (extension === "csv" || inputType(file).includes("csv")) {
    const text = await inputText(file);
    const matrix = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map(parseCsvLine);
    const parsed = rowsFromMatrix(inputName(file) || "CSV import", matrix);
    return parsed ? [parsed] : [];
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

  return workbook.SheetNames.map((sheetName: string) => {
    const matrix = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      blankrows: false,
      defval: "",
      header: 1,
      raw: false
    }) as unknown[][];
    return rowsFromMatrix(sheetName, matrix);
  }).filter(Boolean) as ParsedSheet[];
}
