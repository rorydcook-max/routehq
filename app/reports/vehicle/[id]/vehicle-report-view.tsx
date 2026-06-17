"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { VehicleReportData } from "@/lib/reports";

const PRESETS = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "3 Months" },
  { value: "last_6_months", label: "6 Months" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" }
];

const CHART_COLORS = ["#0d9488", "#dc2626", "#7c3aed", "#ea580c", "#0284c7", "#ca8a04", "#16a34a", "#db2777"];

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  booked: "bg-blue-100 text-blue-800",
  due_soon: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-800",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-slate-100 text-slate-400",
  extended: "bg-purple-100 text-purple-800"
};

function money(value: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value);
}

function fmtDate(value: string) {
  return new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="content-section">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-black text-[var(--foreground)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

export function VehicleReportView({ data }: { data: VehicleReportData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPreset = searchParams.get("preset") || "this_month";
  const isCustom = currentPreset === "custom";

  function applyPreset(preset: string) {
    const params = new URLSearchParams();
    params.set("preset", preset);
    router.push(`?${params.toString()}`);
  }

  function applyCustom(from: string, to: string) {
    const params = new URLSearchParams();
    params.set("preset", "custom");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`?${params.toString()}`);
  }

  const { vehicle, dateRange, totalRevenue, totalExpenses, netProfit, utilizationRate, rentalCount, avgDailyRate, roi, rentalDays } = data;
  const depreciation = Math.max(0, vehicle.purchasePrice - vehicle.estimatedValue);

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="content-section">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              className={`pressable min-h-9 rounded-xl border px-3 py-1.5 text-sm font-black ${currentPreset === p.value && !isCustom ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
              key={p.value}
              onClick={() => applyPreset(p.value)}
              type="button"
            >
              {p.label}
            </button>
          ))}
          <button
            className={`pressable min-h-9 rounded-xl border px-3 py-1.5 text-sm font-black ${isCustom ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
            onClick={() => applyPreset("custom")}
            type="button"
          >
            Custom
          </button>
        </div>
        {isCustom && (
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={searchParams.get("from") || ""}
              id="from-date"
              type="date"
            />
            <input
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
              defaultValue={searchParams.get("to") || ""}
              id="to-date"
              type="date"
            />
            <button
              className="pressable rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-black text-white"
              onClick={() => {
                const f = (document.getElementById("from-date") as HTMLInputElement)?.value;
                const t = (document.getElementById("to-date") as HTMLInputElement)?.value;
                if (f && t) applyCustom(f, t);
              }}
              type="button"
            >
              Apply
            </button>
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">
          {dateRange.label} &middot; {dateRange.from} to {dateRange.to}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Revenue" value={money(totalRevenue)} sub={`${rentalCount} rental${rentalCount !== 1 ? "s" : ""}`} />
        <KpiCard label="Expenses" value={money(totalExpenses)} />
        <KpiCard label="Net Profit" value={money(netProfit)} sub={`ROI ${roi.toFixed(1)}%`} />
        <KpiCard label="Utilization" value={`${utilizationRate.toFixed(0)}%`} sub={`${rentalDays} days out`} />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Monthly revenue vs expenses */}
        <div className="content-section">
          <p className="mb-4 text-sm font-bold text-[var(--foreground)]">Monthly Revenue vs Expenses</p>
          {data.monthlyData.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">No data for this period</p>
          ) : (
            <ResponsiveContainer height={220} width="100%">
              <ComposedChart data={data.monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={52} />
                <Tooltip formatter={(v) => money(Number(v))} />
                <Bar dataKey="revenue" fill="#0d9488" name="Revenue" radius={[2, 2, 0, 0]} />
                <Bar dataKey="expenses" fill="#dc2626" name="Expenses" radius={[2, 2, 0, 0]} />
                <Line dataKey="profit" dot={false} name="Profit" stroke="#7c3aed" strokeWidth={2} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expense breakdown */}
        <div className="content-section">
          <p className="mb-3 text-sm font-bold text-[var(--foreground)]">Expense Breakdown</p>
          {data.expensesByType.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">No expenses recorded</p>
          ) : (
            <>
              <ResponsiveContainer height={140} width="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={data.expensesByType.map((e) => ({ name: e.label, value: e.amount }))}
                    dataKey="value"
                    innerRadius="55%"
                    outerRadius="80%"
                    paddingAngle={2}
                  >
                    {data.expensesByType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {data.expensesByType.map((e, i) => (
                  <div className="flex items-center justify-between text-xs" key={e.type}>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-[var(--foreground-secondary)]">{e.label}</span>
                    </div>
                    <span className="font-semibold text-[var(--foreground)]">{money(e.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Vehicle info & depreciation */}
      <div className="content-section">
        <p className="mb-4 text-sm font-bold text-[var(--foreground)]">Vehicle Details &amp; Depreciation</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Daily Rate</p>
            <p className="mt-1 font-black text-[var(--foreground)]">{vehicle.dailyRate > 0 ? money(vehicle.dailyRate) : "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Purchase Price</p>
            <p className="mt-1 font-black text-[var(--foreground)]">{vehicle.purchasePrice > 0 ? money(vehicle.purchasePrice) : "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Est. Current Value</p>
            <p className="mt-1 font-black text-[var(--foreground)]">{vehicle.estimatedValue > 0 ? money(vehicle.estimatedValue) : "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Depreciation</p>
            <p className={`mt-1 font-black ${depreciation > 0 ? "text-red-600" : "text-[var(--foreground)]"}`}>
              {depreciation > 0 ? `-${money(depreciation)}` : "—"}
            </p>
          </div>
        </div>
        {vehicle.purchasePrice > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
              <span>Value retained</span>
              <span>{vehicle.estimatedValue > 0 ? `${((vehicle.estimatedValue / vehicle.purchasePrice) * 100).toFixed(0)}%` : "—"}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--panel-secondary)]">
              <div
                className="h-2 rounded-full bg-[var(--primary)]"
                style={{ width: `${Math.min(100, (vehicle.estimatedValue / vehicle.purchasePrice) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Avg daily rate vs avg market rate bar */}
      {avgDailyRate > 0 && vehicle.dailyRate > 0 && (
        <div className="content-section">
          <p className="mb-3 text-sm font-bold text-[var(--foreground)]">Avg Daily Rate vs Listed Rate</p>
          <ResponsiveContainer height={100} width="100%">
            <BarChart
              data={[
                { name: "Achieved", value: avgDailyRate },
                { name: "Listed", value: vehicle.dailyRate }
              ]}
              layout="vertical"
              margin={{ top: 0, right: 8, bottom: 0, left: 48 }}
            >
              <XAxis type="number" tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={48} />
              <Tooltip formatter={(v) => money(Number(v))} />
              <Bar dataKey="value" fill="#0d9488" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Rentals table */}
      <div className="content-section">
        <p className="mb-4 text-sm font-bold text-[var(--foreground)]">Rentals in Period ({data.rentals.length})</p>
        {data.rentals.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted)]">No rentals in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="pb-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Ref</th>
                  <th className="pb-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Customer</th>
                  <th className="pb-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Start</th>
                  <th className="pb-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">End</th>
                  <th className="pb-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Status</th>
                  <th className="pb-2 text-right text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {data.rentals.map((rental) => (
                  <tr className="border-b border-[var(--border)] last:border-0" key={rental.id}>
                    <td className="py-2.5 pr-3 font-semibold text-[var(--foreground)]">
                      <Link className="text-[var(--primary)] hover:underline" href={`/bookings/${rental.id}` as any}>
                        {rental.displayCode || rental.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--foreground-secondary)]">{rental.customerName || "—"}</td>
                    <td className="py-2.5 pr-3 text-[var(--foreground-secondary)]">{fmtDate(rental.startDate)}</td>
                    <td className="py-2.5 pr-3 text-[var(--foreground-secondary)]">{rental.endDate ? fmtDate(rental.endDate) : "—"}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_TONE[rental.status] || "bg-slate-100 text-slate-600"}`}>
                        {rental.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className={`py-2.5 text-right font-semibold ${rental.balanceDue > 0 ? "text-red-600" : "text-[var(--foreground-secondary)]"}`}>
                      {rental.balanceDue > 0 ? money(rental.balanceDue) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transactions table */}
      <div className="content-section">
        <p className="mb-4 text-sm font-bold text-[var(--foreground)]">Transactions in Period ({data.transactions.length})</p>
        {data.transactions.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted)]">No transactions in this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="pb-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Date</th>
                  <th className="pb-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Type</th>
                  <th className="pb-2 text-left text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Notes / Supplier</th>
                  <th className="pb-2 text-right text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((tx) => (
                  <tr className="border-b border-[var(--border)] last:border-0" key={tx.id}>
                    <td className="py-2.5 pr-3 text-[var(--foreground-secondary)]">{fmtDate(tx.date)}</td>
                    <td className="py-2.5 pr-3 font-semibold text-[var(--foreground)]">{tx.typeLabel}</td>
                    <td className="py-2.5 pr-3 text-[var(--foreground-secondary)]">{tx.notes || tx.supplier || "—"}</td>
                    <td className={`py-2.5 text-right font-black tabular-nums ${tx.isIncome ? "text-emerald-600" : "text-[var(--foreground)]"}`}>
                      {tx.isIncome ? "+" : "-"}
                      {money(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
