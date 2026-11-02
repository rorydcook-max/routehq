// node scripts/peek-sheet.mjs <google sheet url> : what the importer's spreadsheet reader sees, cell by cell.
import * as xlsx from "xlsx";
const id = process.argv[2].match(/\/d\/([a-zA-Z0-9-_]+)/)[1];
const response = await fetch(`https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`);
const workbook = xlsx.read(Buffer.from(await response.arrayBuffer()), { cellDates: false, type: "buffer" });
for (const name of workbook.SheetNames) {
  const matrix = xlsx.utils.sheet_to_json(workbook.Sheets[name], { blankrows: false, defval: "", header: 1, raw: false });
  console.log(`\n## ${name}: ${matrix.length} rows`);
  for (const row of matrix.slice(0, Number(process.env.ROWS || 6))) console.log(JSON.stringify(row).slice(0, Number(process.env.WIDTH || 700)));
}
