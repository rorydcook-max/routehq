/**
 * Renders a small multilingual document to PDF to check that PDF generation
 * works and that non-Latin scripts get fonts. Writes tmp/check-pdf.pdf.
 *   npx tsx scripts/check-pdf.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { htmlToPdf } from "../lib/html-to-pdf";

async function main() {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>h1{font-size:20px}</style></head><body>
    <h1>RouteHQ PDF check</h1>
    <p>English: The renter agrees to return the vehicle.</p>
    <p>Thai: ผู้เช่าตกลงที่จะคืนรถ</p>
    <p>Burmese: ငှားရမ်းသူသည် ယာဉ်ကို ပြန်အပ်ရန် သဘောတူသည်။</p>
    <p>Chinese: 承租人同意归还车辆。</p>
    <p>Russian: Арендатор обязуется вернуть автомобиль.</p>
    <p>Hebrew: השוכר מסכים להחזיר את הרכב.</p>
  </body></html>`;
  const started = Date.now();
  const pdf = await htmlToPdf(html);
  mkdirSync("tmp", { recursive: true });
  writeFileSync("tmp/check-pdf.pdf", pdf);
  console.log(`PDF ok: ${pdf.length} bytes in ${Date.now() - started} ms -> tmp/check-pdf.pdf`);
}

main().catch((error) => {
  console.error("PDF check failed:", error);
  process.exit(1);
});
