"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
import { ArrowDownRight, ArrowUpRight, Check, ChevronDown, ChevronRight, Download, Lightbulb, Loader2 } from "lucide-react";
import { intlLocale, longDate } from "@/lib/i18n/dates";
import type { DatePreset, ReportsData, VehicleMetrics } from "@/lib/reports";

type Say = (key: string, values?: Record<string, string | number>) => string;

const PRESETS: DatePreset[] = ["this_month", "last_month", "last_3_months", "last_6_months", "this_year", "last_year", "custom"];
const CHART_COLORS = ["#24456b", "#2f6b45", "#b8742a", "#a04b36", "#6b4c8a", "#5b7f9e", "#8a9a5b", "#b07fa0"];
const BAHT = "฿";

export function money(value: number) {
  const rounded = Math.round(Number(value) || 0);
  return `${rounded < 0 ? "-" : ""}${BAHT}${Math.abs(rounded).toLocaleString("en-US")}`;
}

const h2 = "text-[17px] font-bold text-[var(--foreground)]";
const soft = "font-medium text-[var(--foreground-secondary)]";
const tile = "rounded-xl bg-[var(--panel-secondary)] p-3.5";

/** How a figure moved against the period before. Nothing shown when there is nothing to compare with. */
function Change({ change, upIsBad = false, say }: { change: number | null; upIsBad?: boolean; say: Say }) {
  if (change === null || !Number.isFinite(change) || change <= -99.95) return null;
  if (Math.abs(change) < 0.1) return <p className={soft}>{say("sameAsBefore")}</p>;
  const up = change > 0;
  const good = upIsBad ? !up : up;
  return (
    <p className={`flex items-center gap-1 font-semibold ${good ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
      {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
      {say(up ? "upOnBefore" : "downOnBefore", { percent: Math.abs(change).toFixed(0) })}
    </p>
  );
}

/** Where money came from or went: one bar per kind, biggest first. */
export function Breakdown({ title, rows, typeLabel, say }: { title: string; rows: Array<{ type: string; label: string; amount: number; extras?: number }>; typeLabel: (type: string, fallback: string) => string; say: Say }) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <section className="card p-4">
      <h2 className={h2}>{title}</h2>
      {rows.length === 0 ? (
        <p className={`mt-1 ${soft}`}>{say("nothingRecorded")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <div key={row.type}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold text-[var(--foreground)]">{typeLabel(row.type, row.label)}</span>
                <span className="whitespace-nowrap font-bold text-[var(--foreground)]">
                  {money(row.amount)}
                  {total > 0 ? <span className={`ml-2 ${soft}`}>{Math.round((row.amount / total) * 100)}%</span> : null}
                </span>
              </div>
              {Number(row.extras || 0) > 0 ? <p className={soft}>{say("extrasPart", { amount: money(Number(row.extras)) })}</p> : null}
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--panel-secondary)]">
                <div className="h-full rounded-full" style={{ width: `${total > 0 ? Math.max(2, (row.amount / total) * 100) : 0}%`, background: CHART_COLORS[index % CHART_COLORS.length] }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Month by month as plain rows: readable on a phone, where a wide chart had to be scrolled sideways. Quiet months are left out. */
export function MonthRows({ months, say }: { months: Array<{ label: string; revenue: number; expenses: number; profit: number }>; say: Say }) {
  const busy = months.filter((month) => month.revenue !== 0 || month.expenses !== 0);
  const biggest = Math.max(1, ...busy.map((month) => Math.max(month.revenue, month.expenses)));
  if (busy.length < 2) return null;
  return (
    <section className="card p-4">
      <h2 className={h2}>{say("monthsTitle")}</h2>
      <div className="mt-3 space-y-2">
        {busy.map((month) => (
          <div className={tile} key={month.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[16px] font-bold text-[var(--foreground)]">{month.label}</span>
              <span className={`whitespace-nowrap font-bold ${month.profit >= 0 ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
                {say("monthProfit", { amount: money(month.profit) })}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${(month.revenue / biggest) * 100}%` }} />
              </div>
              <span className={`w-28 shrink-0 text-right ${soft}`}>{say("monthIn", { amount: money(month.revenue) })}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[#d99a86]" style={{ width: `${(month.expenses / biggest) * 100}%` }} />
              </div>
              <span className={`w-28 shrink-0 text-right ${soft}`}>{say("monthOut", { amount: money(month.expenses) })}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type SortKey = "profit" | "income" | "expenses" | "utilization" | "roi" | "rentals";
const SORTS: SortKey[] = ["profit", "income", "expenses", "utilization", "rentals", "roi"];

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={soft}>{label}</span>
      <span className="whitespace-nowrap font-bold text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function VehicleRow({ vehicle, comparing, selected, onSelect, typeLabel, say }: { vehicle: VehicleMetrics; comparing: boolean; selected: boolean; onSelect: (id: string) => void; typeLabel: (type: string, fallback: string) => string; say: Say }) {
  const [open, setOpen] = useState(false);
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  return (
    <div className={`${tile} ${comparing && selected ? "outline outline-2 outline-[var(--primary)]" : ""}`}>
      <button aria-expanded={comparing ? undefined : open} aria-pressed={comparing ? selected : undefined} className="pressable flex w-full items-center gap-3 text-left" onClick={() => (comparing ? onSelect(vehicle.id) : setOpen((value) => !value))} type="button">
        {comparing ? (
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${selected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong,var(--border))] bg-white"}`}>
            {selected ? <Check size={16} /> : null}
          </span>
        ) : open ? (
          <ChevronDown className="shrink-0 text-[var(--primary)]" size={20} />
        ) : (
          <ChevronRight className="shrink-0 text-[var(--primary)]" size={20} />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold text-[var(--foreground)]">{vehicle.plate || vehicle.label}</span>
          <span className={`block ${soft}`}>{name || vehicle.label}</span>
          <span className={`block ${soft}`}>{say("vehicleLine", { percent: Math.round(vehicle.utilizationRate), count: vehicle.rentalCount })}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block text-[17px] font-bold ${vehicle.profit >= 0 ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{money(vehicle.profit)}</span>
          <span className={`block ${soft}`}>{say("profit")}</span>
        </span>
      </button>
      {open && !comparing ? (
        <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
          <Fact label={say("moneyIn")} value={money(vehicle.income)} />
          <Fact label={say("moneyOut")} value={money(vehicle.expenses)} />
          {vehicle.expenseBreakdown.map((expense) => (
            <div className="flex items-baseline justify-between gap-3 pl-4" key={expense.type}>
              <span className={soft}>{typeLabel(expense.type, expense.label)}</span>
              <span className="whitespace-nowrap font-semibold text-[var(--foreground-secondary)]">{money(expense.amount)}</span>
            </div>
          ))}
          <Fact label={say("avgPerDay")} value={money(vehicle.avgDailyRate)} />
          {vehicle.purchasePrice > 0 ? (
            <>
              <Fact label={say("boughtFor")} value={money(vehicle.purchasePrice)} />
              <Fact label={say("earnedBack")} value={`${vehicle.roi.toFixed(1)}%`} />
            </>
          ) : null}
          <Link className="secondary-action pressable !mt-3 w-full" href={`/reports/vehicle/${vehicle.id}` as any}>
            {say("fullReport")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ComparisonPanel({ vehicles, say }: { vehicles: VehicleMetrics[]; say: Say }) {
  const nameOf = (vehicle: VehicleMetrics) => vehicle.plate || vehicle.label.split(" ")[0];
  const inKey = say("moneyIn");
  const outKey = say("moneyOut");
  const profitKey = say("profit");
  const barData = vehicles.map((vehicle) => ({ name: nameOf(vehicle), [inKey]: vehicle.income, [outKey]: vehicle.expenses, [profitKey]: Math.max(0, vehicle.profit) }));
  const maxIncome = Math.max(...vehicles.map((vehicle) => vehicle.income), 1);
  const radarRow = (metric: string, value: (vehicle: VehicleMetrics) => number) => ({ metric, ...Object.fromEntries(vehicles.map((vehicle) => [nameOf(vehicle), Math.max(0, Math.min(100, Math.round(value(vehicle))))])) });
  const radarData = [
    radarRow(inKey, (vehicle) => (vehicle.income / maxIncome) * 100),
    radarRow(say("timeRented"), (vehicle) => vehicle.utilizationRate),
    radarRow(say("earnedBackShort"), (vehicle) => vehicle.roi),
    radarRow(say("keptOfIncome"), (vehicle) => (vehicle.income > 0 ? (vehicle.profit / vehicle.income) * 100 : 0))
  ];

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="font-bold text-[var(--foreground)]">{say("compareMoney")}</p>
        <div className="mt-2 h-56">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={barData}>
              <CartesianGrid stroke="#dce3eb" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `${BAHT}${(value / 1000).toFixed(0)}k`} width={48} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Legend />
              <Bar isAnimationActive={false} dataKey={inKey} fill="#24456b" radius={[2, 2, 0, 0]} />
              <Bar isAnimationActive={false} dataKey={outKey} fill="#ebc8bc" radius={[2, 2, 0, 0]} />
              <Bar isAnimationActive={false} dataKey={profitKey} fill="#2f6b45" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <p className="font-bold text-[var(--foreground)]">{say("compareShape")}</p>
        <div className="mt-2 h-60">
          <ResponsiveContainer height="100%" width="100%">
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} />
              {vehicles.map((vehicle, index) => (
                <Radar isAnimationActive={false} dataKey={nameOf(vehicle)} fill={CHART_COLORS[index % CHART_COLORS.length]} fillOpacity={0.15} key={vehicle.id} name={nameOf(vehicle)} stroke={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

type Insight = { title: string; insight: string; action: string };

function InsightsPanel({ data, say, locale }: { data: ReportsData; say: Say; locale: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/reports/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, locale }) });
      const json = await response.json();
      setInsights(json.insights || []);
    } catch {
      setInsights([]);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [data, locale]);

  return (
    <section className="card p-4">
      <h2 className={`flex items-center gap-2 ${h2}`}>
        <Lightbulb className="text-[var(--warning)]" size={20} />
        {say("insightsTitle")}
      </h2>
      {loading ? (
        <p className={`mt-2 flex items-center gap-2 ${soft}`}>
          <Loader2 className="animate-spin" size={18} /> {say("insightsLoading")}
        </p>
      ) : insights.length > 0 ? (
        <div className="mt-3 space-y-2">
          {insights.map((insight, index) => (
            <div className={tile} key={index}>
              <p className="text-[16px] font-bold text-[var(--foreground)]">{insight.title}</p>
              <p className={`mt-1 ${soft}`}>{insight.insight}</p>
              <p className="mt-2 font-semibold text-[var(--primary)]">{insight.action}</p>
            </div>
          ))}
        </div>
      ) : fetched ? (
        <p className={`mt-1 ${soft}`}>{say("insightsNone")}</p>
      ) : (
        <>
          <p className={`mt-1 ${soft}`}>{say("insightsBody")}</p>
          <button className="secondary-action pressable mt-3 w-full sm:w-auto" onClick={fetchInsights} type="button">
            {say("insightsButton")}
          </button>
        </>
      )}
    </section>
  );
}

export function ReportsView({ data }: { data: ReportsData }) {
  const say = useTranslations("reportsPage") as unknown as Say;
  const moneyT = useTranslations("money");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const preset = data.dateRange.preset;
  const [localFrom, setLocalFrom] = useState(preset === "custom" ? data.dateRange.from : "");
  const [localTo, setLocalTo] = useState(preset === "custom" ? data.dateRange.to : "");
  const [customOpen, setCustomOpen] = useState(preset === "custom");

  const typeLabel = (type: string, fallback: string) => (moneyT.has(`type_${type}` as never) ? (moneyT as unknown as Say)(`type_${type}`) : fallback);

  function setPreset(next: DatePreset) {
    if (next === "custom") {
      setCustomOpen(true);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("preset", next);
    params.delete("from");
    params.delete("to");
    params.delete("month");
    router.push(`/reports?${params.toString()}`);
  }

  function applyCustomRange() {
    if (!localFrom || !localTo) return;
    const params = new URLSearchParams();
    params.set("preset", "custom");
    params.set("from", localFrom <= localTo ? localFrom : localTo);
    params.set("to", localFrom <= localTo ? localTo : localFrom);
    router.push(`/reports?${params.toString()}`);
  }

  function toggleSelect(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  }

  const sortedVehicles = [...data.vehicleMetrics].sort((a, b) => {
    const by: Record<SortKey, number> = {
      profit: b.profit - a.profit,
      income: b.income - a.income,
      expenses: b.expenses - a.expenses,
      utilization: b.utilizationRate - a.utilizationRate,
      roi: b.roi - a.roi,
      rentals: b.rentalCount - a.rentalCount
    };
    return by[sortKey];
  });
  const compareVehicles = sortedVehicles.filter((vehicle) => selected.has(vehicle.id));
  const totalOutstanding = data.outstandingBalances.reduce((sum, balance) => sum + balance.totalBalance, 0);
  const deposits = data.depositSummary;

  const monthFormat = new Intl.DateTimeFormat(intlLocale(locale), { month: "short", year: "numeric", timeZone: "UTC" });
  const monthly = data.monthlyData.map((month) => {
    const key = String(month.key || "");
    const match = key.match(/^(\d{4})-(\d{2})$/);
    return { ...month, label: match ? monthFormat.format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))) : month.label };
  });
  const exportHref = (format: string) => `/api/reports/export?format=${format}&preset=${data.dateRange.preset}&from=${data.dateRange.from}&to=${data.dateRange.to}`;
  const nothingAtAll = data.vehicleMetrics.length === 0 && data.recentTransactions.length === 0;

  return (
    <div className="space-y-3">
      {/* Which period */}
      <div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
          {PRESETS.map((value) => {
            const active = value === "custom" ? customOpen : preset === value && !customOpen;
            return (
              <button aria-pressed={active} className={`pressable min-h-11 shrink-0 rounded-full px-4 font-bold ${active ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--foreground)]"}`} key={value} onClick={() => setPreset(value)} type="button">
                {say(`preset_${value}`)}
              </button>
            );
          })}
        </div>
        {customOpen ? (
          <div className="card mt-2 p-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="font-semibold text-[var(--foreground-secondary)]">{say("from")}</span>
                <input className="mt-1 w-full" onChange={(event) => setLocalFrom(event.target.value)} type="date" value={localFrom} />
              </label>
              <label className="block">
                <span className="font-semibold text-[var(--foreground-secondary)]">{say("to")}</span>
                <input className="mt-1 w-full" onChange={(event) => setLocalTo(event.target.value)} type="date" value={localTo} />
              </label>
            </div>
            <button className="primary-action pressable mt-3 w-full" disabled={!localFrom || !localTo} onClick={applyCustomRange} type="button">
              {say("showDates")}
            </button>
          </div>
        ) : null}
        <p className={`mt-2 ${soft}`}>{say("range", { from: longDate(data.dateRange.from, locale), to: longDate(data.dateRange.to, locale) })}</p>
      </div>

      {/* The headline */}
      <section className="card p-4">
        <p className={soft}>{say("profit")}</p>
        <p className={`text-[32px] font-bold leading-tight ${data.netProfit >= 0 ? "text-[var(--foreground)]" : "text-[var(--warning)]"}`}>{money(data.netProfit)}</p>
        <Change change={data.profitChange} say={say} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className={tile}>
            <p className={soft}>{say("moneyIn")}</p>
            <p className="text-[20px] font-bold text-[var(--foreground)]">{money(data.totalRevenue)}</p>
            <Change change={data.revenueChange} say={say} />
          </div>
          <div className={tile}>
            <p className={soft}>{say("moneyOut")}</p>
            <p className="text-[20px] font-bold text-[var(--foreground)]">{money(data.totalExpenses)}</p>
            <Change change={data.expensesChange} say={say} upIsBad />
          </div>
        </div>
        <p className={`mt-3 ${soft}`}>{say("profitNote")}</p>
      </section>

      <Link className="card pressable flex items-center justify-between gap-3 p-4" href={"/reports/fleet-value" as any}>
        <span>
          <span className="block font-bold text-[var(--foreground)]">{say("fleetValueLink")}</span>
          <span className={soft}>{say("fleetValueLinkHint")}</span>
        </span>
        <span aria-hidden className="text-xl text-[var(--muted)]">›</span>
      </Link>
      <Link className="card pressable flex items-center justify-between gap-3 p-4" href={"/reports/owners" as any}>
        <span>
          <span className="block font-bold text-[var(--foreground)]">{say("ownersLink")}</span>
          <span className={soft}>{say("ownersLinkHint")}</span>
        </span>
        <span aria-hidden className="text-xl text-[var(--muted)]">›</span>
      </Link>

      {/* Who owes money */}
      <section className="card p-4">
        <h2 className={h2}>{say("owedTitle")}</h2>
        {data.outstandingBalances.length === 0 ? (
          <p className={`mt-1 ${soft}`}>{say("owedNone")}</p>
        ) : (
          <>
            <p className={`mt-1 ${soft}`}>{say("owedTotal", { amount: money(totalOutstanding), count: data.outstandingBalances.length })}</p>
            <div className="mt-3 space-y-2">
              {data.outstandingBalances.map((balance) => (
                <Link className={`${tile} pressable flex items-center justify-between gap-3`} href={`/customers/${balance.customerId}`} key={balance.customerId}>
                  <span className="min-w-0">
                    <span className="block text-[16px] font-bold text-[var(--foreground)]">{balance.customerName}</span>
                    <span className={`block ${soft}`}>
                      {say("owedRentals", { count: balance.rentalCount })}
                      {balance.oldestDue ? ` · ${say("owedSince", { date: longDate(balance.oldestDue, locale) })}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[17px] font-bold text-[var(--foreground)]">
                    {money(balance.totalBalance)}
                    <ChevronRight className="text-[var(--primary)]" size={18} />
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Deposits: held for customers, never income until kept */}
      <section className="card p-4">
        <h2 className={h2}>{say("depositsTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("depositsBody")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className={`${tile} col-span-2`}>
            <p className={soft}>{say("depositsHolding")}</p>
            <p className="text-[22px] font-bold text-[var(--foreground)]">{money(deposits.totalDepositsCurrentlyHeld)}</p>
          </div>
          <div className={tile}>
            <p className={soft}>{say("depositsTaken")}</p>
            <p className="text-[17px] font-bold text-[var(--foreground)]">{money(deposits.totalDepositsReceivedInPeriod)}</p>
          </div>
          <div className={tile}>
            <p className={soft}>{say("depositsReturned")}</p>
            <p className="text-[17px] font-bold text-[var(--foreground)]">{money(deposits.totalDepositsReturnedInPeriod)}</p>
          </div>
          <div className={`${tile} col-span-2`}>
            <p className={soft}>{say("depositsKept")}</p>
            <p className="text-[17px] font-bold text-[var(--foreground)]">{money(deposits.totalDepositsForfeitedInPeriod)}</p>
          </div>
        </div>
      </section>

      <MonthRows months={monthly} say={say} />

      {data.revenueByType.length > 0 || data.expensesByType.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Breakdown rows={data.revenueByType} say={say} title={say("cameFrom")} typeLabel={typeLabel} />
          <Breakdown rows={data.expensesByType} say={say} title={say("wentOn")} typeLabel={typeLabel} />
        </div>
      ) : null}

      {/* Vehicle by vehicle */}
      {sortedVehicles.length > 0 ? (
        <section className="card p-4">
          <h2 className={h2}>{say("vehiclesTitle")}</h2>
          <p className={`mt-1 ${soft}`}>{compareMode ? say("compareHelp", { count: selected.size }) : say("vehiclesBody")}</p>
          <div className="mt-3 flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{say("sortBy")}</span>
              <select aria-label={say("sortBy")} className="w-full" onChange={(event) => setSortKey(event.target.value as SortKey)} value={sortKey}>
                {SORTS.map((key) => (
                  <option key={key} value={key}>
                    {say(`sort_${key}`)}
                  </option>
                ))}
              </select>
            </label>
            {sortedVehicles.length > 1 ? (
              <button
                aria-pressed={compareMode}
                className={`pressable min-h-11 shrink-0 rounded-full px-4 font-bold ${compareMode ? "bg-[var(--primary)] text-white" : "bg-[var(--panel-secondary)] text-[var(--primary)]"}`}
                onClick={() => {
                  setCompareMode((value) => !value);
                  setSelected(new Set());
                }}
                type="button"
              >
                {compareMode ? say("compareDone") : say("compare")}
              </button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {sortedVehicles.map((vehicle) => (
              <VehicleRow comparing={compareMode} key={vehicle.id} onSelect={toggleSelect} say={say} selected={selected.has(vehicle.id)} typeLabel={typeLabel} vehicle={vehicle} />
            ))}
          </div>
          {compareMode && compareVehicles.length >= 2 ? <ComparisonPanel say={say} vehicles={compareVehicles} /> : null}
        </section>
      ) : null}

      {/* Latest entries */}
      {data.recentTransactions.length > 0 ? (
        <section className="card p-4">
          <h2 className={h2}>{say("latestTitle")}</h2>
          <div className="mt-3 space-y-2">
            {data.recentTransactions.map((entry) => {
              // A deposit coming in is money received and held for the customer: not income, not a cost.
              const held = entry.type === "deposit_received";
              return (
                <div className={`${tile} flex items-center justify-between gap-3`} key={entry.id}>
                  <div className="min-w-0">
                    <p className="text-[16px] font-bold text-[var(--foreground)]">
                      {typeLabel(entry.type, entry.typeLabel)}
                      {entry.extras > 0 ? (
                        <span className={`ml-2 font-medium ${soft}`}>{Math.abs(entry.extras - entry.amount) < 1 ? say("extrasTag") : say("extrasPart", { amount: money(entry.extras) })}</span>
                      ) : null}
                    </p>
                    <p className={soft}>{[entry.vehicleLabel, entry.customerName].filter(Boolean).join(" · ")}</p>
                    <p className={soft}>{longDate(entry.date, locale)}</p>
                  </div>
                  <p className={`shrink-0 text-[17px] font-bold ${entry.isIncome ? "text-[var(--success)]" : "text-[var(--foreground)]"}`}>
                    {entry.isIncome || held ? "+" : "-"}
                    {money(entry.amount)}
                  </p>
                </div>
              );
            })}
          </div>
          <Link className="secondary-action pressable mt-3 w-full" href="/transactions">
            {say("allMoney")}
          </Link>
        </section>
      ) : null}

      {nothingAtAll ? (
        <section className="card p-4">
          <h2 className={h2}>{say("emptyTitle")}</h2>
          <p className={`mt-1 ${soft}`}>{say("emptyBody")}</p>
          <Link className="primary-action pressable mt-3 w-full" href="/transactions/new">
            {say("emptyButton")}
          </Link>
        </section>
      ) : (
        <InsightsPanel data={data} locale={locale} say={say} />
      )}

      <section className="card p-4">
        <h2 className={h2}>{say("exportTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("exportBody")}</p>
        <div className="mt-3 flex gap-2 [&>*]:flex-1">
          <a className="secondary-action pressable" download href={exportHref("pdf")}>
            <Download size={18} /> {say("exportPdf")}
          </a>
          <a className="secondary-action pressable" download href={exportHref("csv")}>
            <Download size={18} /> {say("exportCsv")}
          </a>
        </div>
      </section>
    </div>
  );
}
