import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReportsData, type DatePreset } from "@/lib/reports";
import { getDefaultOrganization } from "@/lib/organization";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function money(value: number): string {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value);
}

export async function GET(request: NextRequest) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format") || "csv";
  const preset = (searchParams.get("preset") || "this_month") as DatePreset;
  const customFrom = searchParams.get("from") || undefined;
  const customTo = searchParams.get("to") || undefined;

  let organization: { id: string };
  try {
    organization = await getDefaultOrganization();
  } catch {
    return NextResponse.json({ error: "Organization not found" }, { status: 400 });
  }

  const data = await getReportsData(organization.id, preset, customFrom, customTo);

  if (format === "csv") {
    const rows: string[] = [
      // Summary header
      ["Period", "Revenue", "Expenses", "Net Profit", "Revenue Change %", "Profit Change %"].map(csvCell).join(","),
      [
        data.dateRange.label,
        data.totalRevenue,
        data.totalExpenses,
        data.netProfit,
        data.revenueChange.toFixed(1),
        data.profitChange.toFixed(1)
      ]
        .map(csvCell)
        .join(","),
      "",
      // Monthly breakdown
      ["Month", "Revenue", "Expenses", "Profit"].map(csvCell).join(","),
      ...data.monthlyData.map((m) => [m.label, m.revenue, m.expenses, m.profit].map(csvCell).join(",")),
      "",
      // Per-vehicle
      ["Vehicle", "Plate", "Revenue", "Expenses", "Profit", "Rentals", "Utilization %", "ROI %"].map(csvCell).join(","),
      ...data.vehicleMetrics.map((v) =>
        [v.label, v.plate, v.income, v.expenses, v.profit, v.rentalCount, v.utilizationRate.toFixed(1), v.roi.toFixed(1)]
          .map(csvCell)
          .join(",")
      ),
      "",
      // Transactions
      ["Date", "Type", "Vehicle", "Customer", "Amount", "Notes"].map(csvCell).join(","),
      ...data.recentTransactions.map((tx) =>
        [tx.date, tx.typeLabel, tx.vehicleLabel, tx.customerName || "", tx.amount, tx.notes || ""].map(csvCell).join(",")
      )
    ];

    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="financial-report-${data.dateRange.from}-to-${data.dateRange.to}.csv"`
      }
    });
  }

  // PDF: return print-ready HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Financial Report &mdash; ${data.dateRange.label}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; padding: 32px; }
  h1 { font-size: 22px; font-weight: 900; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: 700; margin: 24px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  p { color: #6b7280; margin-bottom: 16px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 8px; }
  .kpi { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
  .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; }
  .kpi-value { font-size: 20px; font-weight: 900; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; padding: 6px 8px; background: #f3f4f6; font-weight: 700; border-bottom: 1px solid #e5e7eb; }
  td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; }
  .right { text-align: right; }
  .green { color: #059669; }
  .red { color: #dc2626; }
  @media print { body { padding: 16px; } @page { margin: 16mm; } }
</style>
</head>
<body>
<h1>Financial Report</h1>
<p>Period: ${data.dateRange.label} &bull; ${data.dateRange.from} to ${data.dateRange.to}</p>

<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-label">Total Revenue</div>
    <div class="kpi-value">${money(data.totalRevenue)}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Total Expenses</div>
    <div class="kpi-value">${money(data.totalExpenses)}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Net Profit</div>
    <div class="kpi-value ${data.netProfit >= 0 ? "green" : "red"}">${money(data.netProfit)}</div>
  </div>
</div>

<h2>Monthly Breakdown</h2>
<table>
  <thead><tr><th>Month</th><th class="right">Revenue</th><th class="right">Expenses</th><th class="right">Profit</th></tr></thead>
  <tbody>
    ${data.monthlyData.map((m) => `<tr><td>${m.label}</td><td class="right">${money(m.revenue)}</td><td class="right">${money(m.expenses)}</td><td class="right ${m.profit >= 0 ? "green" : "red"}">${money(m.profit)}</td></tr>`).join("")}
  </tbody>
</table>

<h2>Fleet Performance</h2>
<table>
  <thead><tr><th>Vehicle</th><th class="right">Revenue</th><th class="right">Expenses</th><th class="right">Profit</th><th class="right">Rentals</th><th class="right">Utilization</th><th class="right">ROI</th></tr></thead>
  <tbody>
    ${data.vehicleMetrics.map((v) => `<tr><td>${v.label}</td><td class="right">${money(v.income)}</td><td class="right">${money(v.expenses)}</td><td class="right ${v.profit >= 0 ? "green" : "red"}">${money(v.profit)}</td><td class="right">${v.rentalCount}</td><td class="right">${v.utilizationRate.toFixed(0)}%</td><td class="right ${v.roi >= 0 ? "green" : "red"}">${v.roi.toFixed(1)}%</td></tr>`).join("")}
  </tbody>
</table>

<h2>Recent Transactions</h2>
<table>
  <thead><tr><th>Date</th><th>Type</th><th>Vehicle</th><th>Customer</th><th class="right">Amount</th></tr></thead>
  <tbody>
    ${data.recentTransactions.map((tx) => `<tr><td>${tx.date}</td><td>${tx.typeLabel}</td><td>${tx.vehicleLabel}</td><td>${tx.customerName || "—"}</td><td class="right ${tx.isIncome ? "green" : ""}">${tx.isIncome ? "+" : "-"}${money(tx.amount)}</td></tr>`).join("")}
  </tbody>
</table>

<script>window.addEventListener("load", () => window.print());</script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
