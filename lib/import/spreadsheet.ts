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

function rowsFromMatrix(sheetName: string, matrix: unknown[][]): ParsedSheet | null {
  const usefulRows = matrix.filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (usefulRows.length === 0) {
    return null;
  }

  const headerIndex = usefulRows.findIndex((row) => row.filter((cell) => String(cell ?? "").trim()).length >= 2);
  const headers = (usefulRows[Math.max(headerIndex, 0)] || []).map((cell, index) => String(cell || `Column ${index + 1}`).trim());
  const dataRows = usefulRows.slice(Math.max(headerIndex, 0) + 1);
  const rows = dataRows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()]))
  );

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
