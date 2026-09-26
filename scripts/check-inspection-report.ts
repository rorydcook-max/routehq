// Renders a sample return report so the layout can be checked without a real inspection.
// Run: npx tsx scripts/check-inspection-report.ts
import { formatReportTime, renderInspectionReportHtml } from "../lib/inspection-report";

const failures: string[] = [];
const expect = (label: string, condition: boolean) => {
  if (!condition) failures.push(label);
};

const html = renderInspectionReportHtml({
  mode: "return",
  businessName: "Test Rentals",
  reference: "FL-TEST-0001",
  inspectedAt: "2026-09-26T03:46:58.385Z",
  vehicleLabel: "1กก1234 Test Car",
  customerName: "Test Customer",
  odometerReading: 45650,
  fuelLabel: "50%",
  damageItems: [{ location: "front_left", severity: "dent", description: "มีรอยบุบ <b>x</b>" }],
  notes: null,
  signerName: "Test Customer",
  signatureDataUrl: "data:image/png;base64,AAAA",
  translations: { "มีรอยบุบ <b>x</b>": { english: "There is a dent", sourceLanguage: "th" } },
  depositSettlement: { available: 5000, deductions: [{ reason: "Fuel deficit", amount: 500 }, { reason: "Damage", amount: 3000 }], refunded: 1500, retained: 0 }
});

expect("Bangkok time", formatReportTime("2026-09-26T03:46:58.385Z") === "26 Sept 2026, 10:46 (Bangkok time)" || formatReportTime("2026-09-26T03:46:58.385Z") === "26 Sep 2026, 10:46 (Bangkok time)");
expect("area label", html.includes("Front left"));
expect("severity label", html.includes("<strong>Dent</strong>"));
expect("translation shown", html.includes("There is a dent"));
expect("original kept and escaped", html.includes("มีรอยบุบ &lt;b&gt;x&lt;/b&gt;"));
expect("deposit settlement", html.includes("Deposit settlement") && html.includes("Refunded to customer") && html.includes("$1,500") === false && html.includes("1,500"));
expect("deductions listed", html.includes("Deducted: Fuel deficit") && html.includes("Deducted: Damage"));
expect("no raw ISO time", !html.includes("T03:46"));
expect("deterministic", html === renderInspectionReportHtml({
  mode: "return",
  businessName: "Test Rentals",
  reference: "FL-TEST-0001",
  inspectedAt: "2026-09-26T03:46:58.385Z",
  vehicleLabel: "1กก1234 Test Car",
  customerName: "Test Customer",
  odometerReading: 45650,
  fuelLabel: "50%",
  damageItems: [{ location: "front_left", severity: "dent", description: "มีรอยบุบ <b>x</b>" }],
  notes: null,
  signerName: "Test Customer",
  signatureDataUrl: "data:image/png;base64,AAAA",
  translations: { "มีรอยบุบ <b>x</b>": { english: "There is a dent", sourceLanguage: "th" } },
  depositSettlement: { available: 5000, deductions: [{ reason: "Fuel deficit", amount: 500 }, { reason: "Damage", amount: 3000 }], refunded: 1500, retained: 0 }
}));

if (failures.length) {
  console.error("FAILED:", failures.join(", "));
  process.exit(1);
}
console.log("inspection report: all checks passed");
