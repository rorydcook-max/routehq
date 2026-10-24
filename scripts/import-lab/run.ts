/**
 * The importer's test library: realistic operator sheets run through the same steps as the import screen
 * (read the file, work out what each column means, build the preview cards), with no AI and no database, so the
 * built-in rules are measured on their own. Each fixture says what an owner would expect to see.
 *
 *   npm run test:import            all fixtures
 *   npm run test:import -- bike    fixtures whose name contains "bike", with the column mapping printed
 */
import { readFileSync } from "node:fs";
import { normaliseAnalysis } from "@/lib/import/analysis";
import { categorizeCostsWithAi, mapColumnsWithAi } from "@/lib/import/ai-assist";
import { applyCostLearnings } from "@/lib/import/learnings";
import { importQuestions } from "@/lib/import/questions";
import { attachExisting, buildPreview, previewCounts, type ImportPreview } from "@/lib/import/preview";
import { googleSheetToSpreadsheetInput, isGoogleSheetsUrl, parseSpreadsheetFile } from "@/lib/import/spreadsheet";
import { FIXTURES, type Fixture } from "./fixtures";
import { workbookBytes } from "./helpers";

// --ai: the same fixtures through the AI path (column mapping checked by the AI, unplaced costs categorised), to make
// sure the AI only ever improves on the rules. Uses the keys in .env.local.
const withAi = process.argv.includes("--ai");
if (withAi) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

async function run(fixture: Fixture) {
  const input = fixture.csv !== undefined
    ? { bytes: Buffer.from(fixture.csv, "utf8"), filename: fixture.filename || `${fixture.name}.csv`, type: "text/csv" }
    : { bytes: workbookBytes(fixture.tabs || []), filename: `${fixture.name}.xlsx` };
  const sheets = await parseSpreadsheetFile(input);
  const learnedColumns = new Map(Object.entries(fixture.learned?.columns || {}));
  const raw = withAi ? await mapColumnsWithAi(sheets, "mixed", learnedColumns) : null;
  if (withAi && !raw) throw new Error("the AI didn't answer");
  const analysis = normaliseAnalysis(raw, sheets, learnedColumns);
  const preview: ImportPreview = attachExisting(buildPreview(sheets, analysis.sheets), [], [], []);
  applyCostLearnings(preview, { columns: learnedColumns, costs: new Map(Object.entries(fixture.learned?.costs || {})) });
  if (withAi) await categorizeCostsWithAi(preview);
  const counts = previewCounts(preview);
  const failures: string[] = [];
  const expect = (withAi && fixture.expectAi) || fixture.expect;
  for (const key of ["vehicles", "rentals", "customers", "transactions"] as const) {
    if (expect[key] !== undefined && counts[key] !== expect[key]) failures.push(`${key}: ${counts[key]}, expected ${expect[key]}`);
  }
  if (expect.questions) {
    const asked = importQuestions(analysis.sheets, preview).map((question) => question.kind);
    if (JSON.stringify(asked) !== JSON.stringify(expect.questions)) failures.push(`questions: ${JSON.stringify(asked)}, expected ${JSON.stringify(expect.questions)}`);
  }
  for (const check of expect.checks || []) {
    try {
      const problem = check(preview);
      if (problem) failures.push(problem);
    } catch (error) {
      failures.push(`check threw: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { sheets, analysis, preview, counts, failures };
}

/** `--file <path or Google Sheets link>`: what the rules alone make of a real sheet. */
async function inspect(source: string) {
  const input = isGoogleSheetsUrl(source) ? await googleSheetToSpreadsheetInput(source) : { bytes: readFileSync(source), filename: source.split(/[\\/]/).pop() || source };
  const sheets = await parseSpreadsheetFile(input);
  const analysis = normaliseAnalysis(null, sheets);
  const preview = attachExisting(buildPreview(sheets, analysis.sheets), [], [], []);
  for (const sheet of analysis.sheets) {
    console.log(`[${sheet.sheet_name}] ${sheet.primary_data_type} (${sheet.row_count} rows): ${sheet.column_mappings.filter((mapping) => mapping.routehq_field !== "__ignore__").map((mapping) => `${mapping.source_column}→${mapping.routehq_field}`).join(", ")}`);
  }
  console.log("counts", previewCounts(preview));
  const kinds: Record<string, number> = {};
  for (const item of preview.transactions.filter((record) => record.include)) kinds[item.type] = (kinds[item.type] || 0) + 1;
  console.log("money", kinds);
  for (const rental of preview.rentals) console.log(`rental ${rental.plate} ${rental.customerName} ${rental.startDate}→${rental.endDate ?? "open"} ${rental.rate}/${rental.ratePeriod} next ${rental.nextDue} [${rental.problems.join(", ")}]`);
}

async function main() {
  if (process.argv[2] === "--file") return inspect(process.argv[3]);
  // --write <folder>: save every fixture as a real file, to try in the import screen.
  if (process.argv[2] === "--write") {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync(process.argv[3], { recursive: true });
    for (const fixture of FIXTURES) {
      const name = `${process.argv[3]}/${fixture.name}.${fixture.csv !== undefined ? "csv" : "xlsx"}`;
      writeFileSync(name, fixture.csv !== undefined ? fixture.csv : workbookBytes(fixture.tabs || []));
    }
    return console.log(`wrote ${FIXTURES.length} files to ${process.argv[3]}`);
  }
  const filter = process.argv.slice(2).find((arg) => !arg.startsWith("--")) || "";
  const chosen = FIXTURES.filter((fixture) => !filter || fixture.name.includes(filter));
  let passed = 0;
  for (const fixture of chosen) {
    const result = await run(fixture).catch((error) => ({ failures: [`crashed: ${error instanceof Error ? error.stack : String(error)}`] }) as any);
    const ok = result.failures.length === 0;
    if (ok) passed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${fixture.name}  — ${fixture.about}`);
    for (const failure of result.failures) console.log(`        ✗ ${failure}`);
    if ((!ok || filter) && result.analysis) {
      for (const sheet of result.analysis.sheets) {
        const mapped = sheet.column_mappings.map((mapping: any) => `${mapping.source_column}→${mapping.routehq_field === "__ignore__" ? "·" : mapping.routehq_field}`).join(", ");
        console.log(`        [${sheet.sheet_name}] ${sheet.primary_data_type} (${sheet.row_count} rows): ${mapped}`);
      }
      if (filter) console.log(JSON.stringify(result.preview, null, 1).slice(0, 6000));
    }
  }
  console.log(`\n${passed}/${chosen.length} fixtures pass`);
  process.exitCode = passed === chosen.length ? 0 : 1;
}

main();
