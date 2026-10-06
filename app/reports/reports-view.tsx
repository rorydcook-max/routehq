"use client";

import { niceDate } from "@/lib/nice-date";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Download,
  Lightbulb,
  Loader2,
  Minus,
  TrendingUp
} from "lucide-react";
import type { DatePreset, ReportsData, VehicleMetrics } from "@/lib/reports";

const PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "last_6_months", label: "Last 6 months" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "custom", label: "Custom" }
];

const CHART_COLORS = ["#0f766e", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#65a30d", "#c026d3"];

function money(value: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value);
}

/** "2026-10-01" -> "1 Oct 2026". */
function plainDate(iso: string) {
  const date = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function pct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

/**
 * `change` is the % change against the previous period; null when there is
 * nothing to compare with (the previous period was zero), and `sub` then
 * describes the figure instead. `upIsBad` flips the colours for costs.
 */
function KpiCard({ label, value, change, sub, upIsBad = false }: { label: string; value: string; change: number | null; sub?: string; upIsBad?: boolean }) {
  if (change === null || !Number.isFinite(change) || change <= -99.95) {
    return (
      <div className="content-section">
        <p className="text-[12px] text-[var(--muted)]">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{sub || (change !== null && change <= -99.95 ? "Nothing recorded yet this period" : "Nothing to compare with last period")}</p>
      </div>
    );
  }
  const isUp = change > 0;
  const isFlat = Math.abs(change) < 0.1;
  const good = upIsBad ? !isUp : isUp;
  return (
    <div className="content-section">
      <p className="text-[12px] text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
      <div className="mt-1 flex items-center gap-1">
        {isFlat ? (
          <Minus size={14} className="text-[var(--muted)]" />
        ) : isUp ? (
          <ArrowUpRight size={14} className={good ? "text-emerald-600" : "text-red-500"} />
        ) : (
          <ArrowDownRight size={14} className={good ? "text-emerald-600" : "text-red-500"} />
        )}
        <span className={`text-xs font-semibold ${isFlat ? "text-[var(--muted)]" : good ? "text-emerald-600" : "text-red-500"}`}>
          {isFlat ? "No change" : pct(change)}
        </span>
        <span className="text-xs text-[var(--muted)]">vs prev. period</span>
      </div>
    </div>
  );
}

function DepositsCard({ data }: { data: ReportsData["depositSummary"] }) {
  const rows = [
    { label: "Holding now", value: money(data.totalDepositsCurrentlyHeld), valueClass: "text-amber-600" },
    { label: "Taken in", value: money(data.totalDepositsReceivedInPeriod), valueClass: "text-[var(--foreground)]" },
    { label: "Given back", value: money(data.totalDepositsReturnedInPeriod), valueClass: "text-[var(--foreground)]" },
    { label: "Kept for damage or unpaid rent", value: money(data.totalDepositsForfeitedInPeriod), valueClass: "text-[var(--primary)]" }
  ];

  return (
    <div className="content-section border-amber-200 bg-amber-50/50">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-amber-700">Deposits</p>
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">Customers' money you are holding until their rental ends.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl border border-amber-100 bg-white/80 p-3">
            <p className="text-xs font-semibold text-[var(--muted)]">{row.label}</p>
            <p className={`mt-1 text-lg font-semibold ${row.valueClass}`}>{row.value}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 rounded-lg border border-amber-100 bg-white/70 px-3 py-2 text-xs text-[var(--foreground-secondary)]">
        Deposits are not counted as income. Only the part you keep is.
      </p>
    </div>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────────────────

function DonutChart({ title, data }: { title: string; data: Array<{ label: string; amount: number }> }) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (data.length === 0) {
    return (
      <div className="content-section">
        <p className="text-sm font-bold text-[var(--foreground)]">{title}</p>
        <p className="mt-6 text-center text-sm text-[var(--muted)]">No data</p>
      </div>
    );
  }
  return (
    <div className="content-section">
      <p className="text-sm font-bold text-[var(--foreground)]">{title}</p>
      <div className="mt-3 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="label"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              onMouseEnter={(_, index) => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.label}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  opacity={active === null || active === index ? 1 : 0.4}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value) => money(Number(value))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-1">
        {data.map((entry, index) => (
          <div className="flex items-center justify-between text-xs" key={entry.label}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
              <span className="text-[var(--foreground-secondary)]">{entry.label}</span>
            </div>
            <div className="text-right">
              <span className="font-semibold text-[var(--foreground)]">{money(entry.amount)}</span>
              <span className="ml-1 text-[var(--muted)]">{total > 0 ? `${((entry.amount / total) * 100).toFixed(0)}%` : ""}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Vehicle Row (expandable) ──────────────────────────────────────────────────

type SortKey = "profit" | "income" | "expenses" | "utilization" | "roi" | "rentals";

function VehicleTableRow({
  vehicle,
  isCompareMode,
  isSelected,
  onToggleSelect,
  sortKey
}: {
  vehicle: VehicleMetrics;
  isCompareMode: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  sortKey: SortKey;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-secondary)]/40 transition-colors">
        {isCompareMode ? (
          <td className="py-3 pl-3 pr-2">
            <input
              aria-label={`Compare ${vehicle.make} ${vehicle.model}`}
              className="flex-shrink-0"
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(vehicle.id)}
            />
          </td>
        ) : null}
        <td className="py-3 pr-3">
          <button
            className="flex items-center gap-1 text-left"
            onClick={() => setExpanded((e) => !e)}
            type="button"
          >
            {expanded ? <ChevronDown size={14} className="shrink-0 text-[var(--muted)]" /> : <ChevronRight size={14} className="shrink-0 text-[var(--muted)]" />}
            <div>
              <p className="font-semibold text-[var(--foreground)]">{vehicle.plate || vehicle.label}</p>
              <p className="text-xs text-[var(--muted)]">
                {vehicle.make} {vehicle.model}
              </p>
            </div>
          </button>
        </td>
        <td className="px-3 py-3 text-right font-semibold text-emerald-600">{money(vehicle.income)}</td>
        <td className="px-3 py-3 text-right text-[var(--foreground-secondary)]">{money(vehicle.expenses)}</td>
        <td className={`px-3 py-3 text-right font-semibold ${vehicle.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>{money(vehicle.profit)}</td>
        <td className="px-3 py-3 text-right text-[var(--foreground-secondary)]">{vehicle.rentalCount}</td>
        <td className="px-3 py-3 text-right text-[var(--foreground-secondary)]">{vehicle.utilizationRate.toFixed(0)}%</td>
        <td className="px-3 py-3 text-right text-[var(--foreground-secondary)]">{money(vehicle.avgDailyRate)}/d</td>
        <td className={`px-3 py-3 text-right font-semibold ${vehicle.roi >= 0 ? "text-[var(--primary)]" : "text-red-500"}`}>{vehicle.roi.toFixed(1)}%</td>
        <td className="px-3 py-3 text-right">
          <Link href={`/reports/vehicle/${vehicle.id}` as any} className="text-xs font-semibold text-[var(--primary)] hover:underline">
            Details
          </Link>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-[var(--border)] bg-[var(--panel-secondary)]/40">
          <td colSpan={isCompareMode ? 10 : 9} className="px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Where the money went</p>
                {vehicle.expenseBreakdown.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">No expenses recorded</p>
                ) : (
                  <div className="space-y-1">
                    {vehicle.expenseBreakdown.map((exp) => (
                      <div className="flex items-center justify-between text-sm" key={exp.type}>
                        <span className="text-[var(--foreground-secondary)]">{exp.label}</span>
                        <span className="font-semibold text-[var(--foreground)]">{money(exp.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">At a glance</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-secondary)]">Rentals in period</span>
                    <span className="font-semibold">{vehicle.rentalCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-secondary)]">Average price per day</span>
                    <span className="font-semibold">{money(vehicle.avgDailyRate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground-secondary)]">Transactions</span>
                    <span className="font-semibold">{vehicle.transactionCount}</span>
                  </div>
                  {vehicle.purchasePrice > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-[var(--foreground-secondary)]">Purchase price</span>
                      <span className="font-semibold">{money(vehicle.purchasePrice)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

// ── Comparison Panel ──────────────────────────────────────────────────────────

function ComparisonPanel({ vehicles }: { vehicles: VehicleMetrics[] }) {
  const barData = vehicles.map((v) => ({
    name: v.plate || v.label.split(" ")[0],
    "Money in": v.income,
    "Money out": v.expenses,
    Profit: Math.max(0, v.profit)
  }));

  const maxRevenue = Math.max(...vehicles.map((v) => v.income), 1);
  const radarData = [
    { metric: "Money in", ...Object.fromEntries(vehicles.map((v) => [v.plate || v.label.split(" ")[0], Math.round((v.income / maxRevenue) * 100)])) },
    { metric: "Time rented", ...Object.fromEntries(vehicles.map((v) => [v.plate || v.label.split(" ")[0], Math.round(v.utilizationRate)])) },
    { metric: "Return on cost", ...Object.fromEntries(vehicles.map((v) => [v.plate || v.label.split(" ")[0], Math.max(0, Math.min(100, v.roi))])) },
    {
      metric: "Margin",
      ...Object.fromEntries(vehicles.map((v) => [v.plate || v.label.split(" ")[0], v.income > 0 ? Math.round((v.profit / v.income) * 100) : 0]))
    }
  ];

  return (
    <div className="mt-4 content-section space-y-6">
      <p className="text-sm font-bold text-[var(--foreground)]">Vehicle Comparison — {vehicles.map((v) => v.plate || v.make).join(" vs ")}</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Money in, money out, profit</p>
          <div className="overflow-x-auto">
            <div className="min-w-[300px] h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Legend />
                  <Bar dataKey="Money in" fill="#0f766e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Money out" fill="#dc2626" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Profit" fill="#2563eb" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Compared side by side</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} />
                {vehicles.map((v, i) => (
                  <Radar
                    key={v.id}
                    name={v.plate || v.make}
                    dataKey={v.plate || v.label.split(" ")[0]}
                    stroke={CHART_COLORS[i % CHART_COLORS.length]}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    fillOpacity={0.15}
                  />
                ))}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI Insights Panel ─────────────────────────────────────────────────────────

type Insight = { title: string; insight: string; action: string };

function AiInsightsPanel({ data }: { data: ReportsData }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data })
      });
      const json = await res.json();
      setInsights(json.insights || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [data]);

  return (
    <div className="content-section">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={18} className="text-amber-500" />
          <p className="text-sm font-bold text-[var(--foreground)]">What stands out</p>
        </div>
        {!fetched ? (
          <button
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-bold text-white"
            onClick={fetchInsights}
            type="button"
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Generate"}
          </button>
        ) : null}
      </div>
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 size={16} className="animate-spin" /> Analysing your fleet data…
        </div>
      ) : insights.length > 0 ? (
        <div className="mt-4 space-y-3">
          {insights.map((insight, i) => (
            <div className="rounded-xl border border-[var(--border)] bg-amber-50/50 p-3" key={i}>
              <p className="font-semibold text-[var(--foreground)]">{insight.title}</p>
              <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{insight.insight}</p>
              <p className="mt-2 text-xs font-semibold text-[var(--primary)]">→ {insight.action}</p>
            </div>
          ))}
        </div>
      ) : fetched ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No insights generated.</p>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">Click Generate to get AI-powered insights based on your fleet financial data.</p>
      )}
    </div>
  );
}

// ── Main ReportsView ──────────────────────────────────────────────────────────

export function ReportsView({ data }: { data: ReportsData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortAsc, setSortAsc] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExportMenu, setShowExportMenu] = useState(false);

  const preset = data.dateRange.preset;
  const customFrom = data.dateRange.preset === "custom" ? data.dateRange.from : "";
  const customTo = data.dateRange.preset === "custom" ? data.dateRange.to : "";
  const [localFrom, setLocalFrom] = useState(customFrom);
  const [localTo, setLocalTo] = useState(customTo);

  function setPreset(p: DatePreset) {
    const params = new URLSearchParams(searchParams.toString());
    if (p === "custom") {
      params.set("preset", "custom");
      if (localFrom) params.set("from", localFrom);
      if (localTo) params.set("to", localTo);
    } else {
      params.set("preset", p);
      params.delete("from");
      params.delete("to");
      params.delete("month");
    }
    router.push(`/reports?${params.toString()}`);
  }

  function applyCustomRange() {
    if (!localFrom || !localTo) return;
    const params = new URLSearchParams();
    params.set("preset", "custom");
    params.set("from", localFrom);
    params.set("to", localTo);
    router.push(`/reports?${params.toString()}`);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((a) => !a);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      }
      return next;
    });
  }

  function SortTh({ label, field }: { label: string; field: SortKey }) {
    const active = sortKey === field;
    return (
      <th
        className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-right text-xs uppercase text-[var(--muted)] hover:text-[var(--foreground)]"
        onClick={() => toggleSort(field)}
      >
        {label} {active ? (sortAsc ? "↑" : "↓") : ""}
      </th>
    );
  }

  const sortedVehicles = [...data.vehicleMetrics].sort((a, b) => {
    const map: Record<SortKey, number> = {
      profit: b.profit - a.profit,
      income: b.income - a.income,
      expenses: b.expenses - a.expenses,
      utilization: b.utilizationRate - a.utilizationRate,
      roi: b.roi - a.roi,
      rentals: b.rentalCount - a.rentalCount
    };
    const diff = map[sortKey];
    return sortAsc ? -diff : diff;
  });

  const compareVehicles = sortedVehicles.filter((v) => selected.has(v.id));

  const totalOutstanding = data.outstandingBalances.reduce((s, b) => s + b.totalBalance, 0);

  return (
    <div className="space-y-4">
      {/* Date range selector */}
      <div className="content-section">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              type="button"
              className={`rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition ${
                preset === p.value
                  ? "bg-[var(--primary-light)] text-[var(--primary)]"
                  : "text-[var(--muted)] hover:bg-[#f1efeb] hover:text-[var(--foreground)]"
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="ml-auto relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              <Download size={14} /> Export
            </button>
            {showExportMenu ? (
              <div className="absolute right-0 top-full z-10 mt-1 rounded-xl border border-[var(--border)] bg-white shadow-lg">
                <a
                  href={`/api/reports/export?format=csv&preset=${data.dateRange.preset}&from=${data.dateRange.from}&to=${data.dateRange.to}`}
                  className="block px-4 py-2.5 text-sm font-semibold hover:bg-[var(--panel-secondary)]"
                  download
                  onClick={() => setShowExportMenu(false)}
                >
                  Download CSV
                </a>
                <a
                  href={`/api/reports/export?format=pdf&preset=${data.dateRange.preset}&from=${data.dateRange.from}&to=${data.dateRange.to}`}
                  className="block px-4 py-2.5 text-sm font-semibold hover:bg-[var(--panel-secondary)]"
                  download
                  onClick={() => setShowExportMenu(false)}
                >
                  Download PDF
                </a>
              </div>
            ) : null}
          </div>
        </div>
        {preset === "custom" ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--muted)]">From</span>
              <input
                type="date"
                value={localFrom}
                onChange={(e) => setLocalFrom(e.target.value)}
                className="mt-1 block rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--muted)]">To</span>
              <input
                type="date"
                value={localTo}
                onChange={(e) => setLocalTo(e.target.value)}
                className="mt-1 block rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={applyCustomRange}
              type="button"
              className="rounded-lg bg-[var(--primary)] px-4 py-1.5 text-sm font-semibold text-white"
            >
              Apply
            </button>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-[var(--muted)]">
          {plainDate(data.dateRange.from)} – {plainDate(data.dateRange.to)}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Money in" value={money(data.totalRevenue)} change={data.revenueChange} />
        <KpiCard label="Money out" value={money(data.totalExpenses)} change={data.expensesChange} upIsBad />
        <KpiCard label="Profit" value={money(data.netProfit)} change={data.profitChange} />
        <KpiCard
          label="Outstanding"
          value={money(totalOutstanding)}
          change={null}
          sub={
            data.outstandingBalances.length
              ? `Due now from ${data.outstandingBalances.length} customer${data.outstandingBalances.length === 1 ? "" : "s"}`
              : "Nothing due right now"
          }
        />
      </div>

      <DepositsCard data={data.depositSummary} />

      {/* Monthly Chart */}
      {data.monthlyData.length > 0 ? (
        <div className="content-section">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-[var(--primary)]" />
            <p className="text-sm font-bold text-[var(--foreground)]">Money in and out, month by month</p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[480px] h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => money(Number(v))} />
                  <Legend />
                  <Bar dataKey="revenue" name="Money in" fill="#0f766e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="expenses" name="Money out" fill="#fca5a5" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}

      {/* Donut Charts */}
      {(data.revenueByType.length > 0 || data.expensesByType.length > 0) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <DonutChart title="Where the money came from" data={data.revenueByType} />
          <DonutChart title="Where the money went" data={data.expensesByType} />
        </div>
      ) : null}

      {/* Fleet Performance Table */}
      {data.vehicleMetrics.length > 0 ? (
        <div className="content-section">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[var(--foreground)]">How each vehicle is doing</p>
            <button
              onClick={() => {
                setCompareMode((v) => !v);
                setSelected(new Set());
              }}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                compareMode
                  ? "bg-[var(--primary)] text-white"
                  : "border border-[var(--border)] text-[var(--foreground-secondary)]"
              }`}
            >
              {compareMode ? "Exit Compare" : "Compare"}
            </button>
          </div>
          {compareMode ? (
            <p className="mb-2 text-xs text-[var(--muted)]">Select 2–4 vehicles to compare. {selected.size} selected.</p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  {compareMode ? <th className="py-2 pl-3 pr-2 w-8" /> : null}
                  <th className="py-2 pr-3 text-xs uppercase text-[var(--muted)]">Vehicle</th>
                  <SortTh label="Money in" field="income" />
                  <SortTh label="Money out" field="expenses" />
                  <SortTh label="Profit" field="profit" />
                  <SortTh label="Rentals" field="rentals" />
                  <SortTh label="Time rented" field="utilization" />
                  <th className="px-3 py-2 text-right text-xs uppercase text-[var(--muted)]">Avg per day</th>
                  <SortTh label="Return on cost" field="roi" />
                  <th className="px-3 py-2 text-right text-xs uppercase text-[var(--muted)]" />
                </tr>
              </thead>
              <tbody>
                {sortedVehicles.map((vehicle) => (
                  <VehicleTableRow
                    key={vehicle.id}
                    vehicle={vehicle}
                    isCompareMode={compareMode}
                    isSelected={selected.has(vehicle.id)}
                    onToggleSelect={toggleSelect}
                    sortKey={sortKey}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {compareMode && compareVehicles.length >= 2 ? (
            <ComparisonPanel vehicles={compareVehicles} />
          ) : null}
        </div>
      ) : null}

      {/* Outstanding Balances */}
      {data.outstandingBalances.length > 0 ? (
        <div className="content-section">
          <p className="mb-3 text-sm font-bold text-[var(--foreground)]">Who owes you money</p>
          <div className="space-y-2">
            {data.outstandingBalances.map((bal) => (
              <div
                key={bal.customerId}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3"
              >
                <div>
                  <Link href={`/customers/${bal.customerId}`} className="font-semibold text-[var(--foreground)] hover:underline">
                    {bal.customerName}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    {bal.rentalCount} rental{bal.rentalCount === 1 ? "" : "s"}
                    {bal.oldestDue ? ` · due ${niceDate(bal.oldestDue)}` : ""}
                  </p>
                </div>
                <p className="font-semibold text-red-500">{money(bal.totalBalance)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Recent Transactions */}
      {data.recentTransactions.length > 0 ? (
        <div className="content-section">
          <p className="mb-3 text-sm font-bold text-[var(--foreground)]">Latest money in and out</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]">
                  <th className="py-2 pr-3">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Vehicle</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="whitespace-nowrap py-2.5 pr-3 text-[var(--muted)]">{niceDate(tx.date)}</td>
                    <td className="px-3 py-2.5 font-semibold text-[var(--foreground)]">{tx.typeLabel}</td>
                    <td className="px-3 py-2.5 text-[var(--foreground-secondary)]">{tx.vehicleLabel}</td>
                    <td className="px-3 py-2.5 text-[var(--foreground-secondary)]">{tx.customerName || "—"}</td>
                    <td className={`px-3 py-2.5 text-right font-bold ${tx.isIncome ? "text-emerald-600" : tx.type === "deposit_received" ? "text-amber-600" : "text-red-500"}`}>
                      {/* A deposit coming in is money received, held for the customer: not a cost. */}
                        {tx.isIncome || tx.type === "deposit_received" ? "+" : "-"}{money(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* AI Insights */}
      <AiInsightsPanel data={data} />

      {/* Empty state */}
      {data.vehicleMetrics.length === 0 && data.recentTransactions.length === 0 ? (
        <div className="content-section py-12 text-center">
          <p className="text-[var(--muted)]">No transactions recorded for this period.</p>
          <Link href="/transactions/new" className="mt-3 inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
            Add a transaction →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
