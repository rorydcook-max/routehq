"use client";

import { useCallback, useEffect, useState } from "react";
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
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Check, CheckCircle2, ChevronRight, Download, Handshake, LayoutGrid, Lightbulb, List, Loader2, TrendingUp } from "lucide-react";
import { intlLocale, longDate } from "@/lib/i18n/dates";
import { Dot, InOutBars, Ring } from "@/components/glance";
import { VehicleArt } from "@/components/vehicle-art";
import { kindFromCategory } from "@/lib/vehicle-groups";
import type { DatePreset, ReportsData, VehicleMetrics } from "@/lib/reports";

type Say = (key: string, values?: Record<string, string | number>) => string;

const PRESETS: DatePreset[] = ["this_month", "last_month", "last_3_months", "last_6_months", "this_year", "last_year", "custom"];
const CHART_COLORS = ["#008fa3", "#c9711c", "#2f6fb8", "#a0522d", "#6b4c8a", "#c0457a", "#5f8a1e"];
/** The same seven, warm first, for where money went. Also checked with the validator. */
const OUT_COLORS = ["#c9711c", "#6b4c8a", "#a0522d", "#2f6fb8", "#c0457a", "#008fa3", "#5f8a1e"];
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

type Slice = { type: string; label: string; amount: number; extras?: number };

/** A ring cut into slices, one per kind. Pointing at a slice (or its line in the key) lights it up and names it in the middle. */
function Donut({ slices, active, onActive, total, say }: { slices: Array<Slice & { color: string; name: string }>; active: number | null; onActive: (index: number | null) => void; total: number; say: Say }) {
  const size = 144;
  const stroke = 20;
  const r = (size - stroke - 8) / 2;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 2.5 : 0;
  let offset = 0;
  const shown = active !== null ? slices[active] : null;
  return (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <svg aria-hidden="true" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle cx={size / 2} cy={size / 2} fill="none" r={r} stroke="var(--panel-tertiary)" strokeWidth={stroke} />
        {slices.map((slice, index) => {
          const length = total > 0 ? (slice.amount / total) * c : 0;
          const drawn = Math.max(0.5, length - gap);
          const start = offset;
          offset += length;
          return (
            <circle
              className="ring-draw cursor-pointer"
              cx={size / 2}
              cy={size / 2}
              fill="none"
              key={slice.type}
              onMouseEnter={() => onActive(index)}
              onMouseLeave={() => onActive(null)}
              opacity={active === null || active === index ? 1 : 0.3}
              r={r}
              stroke={slice.color}
              strokeDasharray={`${drawn} ${c - drawn}`}
              strokeDashoffset={-start}
              strokeWidth={active === index ? stroke + 6 : stroke}
              style={{ transition: "opacity 150ms, stroke-width 150ms" }}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        {shown ? (
          <>
            <span className="num text-[22px] leading-none text-[var(--foreground)]">{total > 0 ? Math.round((shown.amount / total) * 100) : 0}%</span>
            <span className="mt-1 line-clamp-2 text-[14px] font-semibold leading-tight text-[var(--foreground-secondary)]">{shown.name}</span>
          </>
        ) : (
          <>
            <span className="num text-[17px] leading-none text-[var(--foreground)]">{money(total)}</span>
            <span className="mt-1 text-[14px] font-semibold text-[var(--foreground-secondary)]">{say("donutTotal")}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** Where money came from or went: a ring of slices with a key beside it. Past six kinds, the smallest share one slice. */
export function Breakdown({ title, rows, typeLabel, say, palette = CHART_COLORS }: { title: string; rows: Slice[]; typeLabel: (type: string, fallback: string) => string; say: Say; palette?: string[] }) {
  const [active, setActive] = useState<number | null>(null);
  const sorted = [...rows].sort((a, b) => b.amount - a.amount);
  const kept = sorted.length > 7 ? sorted.slice(0, 6) : sorted;
  const rest = sorted.length > 7 ? sorted.slice(6) : [];
  const grouped: Slice[] = rest.length ? [...kept, { type: "__rest", label: say("otherKinds"), amount: rest.reduce((sum, row) => sum + row.amount, 0) }] : kept;
  const slices = grouped.map((row, index) => ({ ...row, color: palette[index % palette.length], name: row.type === "__rest" ? row.label : typeLabel(row.type, row.label) }));
  const total = slices.reduce((sum, row) => sum + row.amount, 0);
  return (
    <section className="card p-4">
      <h2 className={h2}>{title}</h2>
      {slices.length === 0 ? (
        <p className={`mt-1 ${soft}`}>{say("nothingRecorded")}</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4 min-[420px]:flex-row min-[420px]:items-center">
          <Donut active={active} onActive={setActive} say={say} slices={slices} total={total} />
          <ul className="w-full min-w-0 flex-1 space-y-1">
            {slices.map((slice, index) => (
              <li
                className={`cursor-default rounded-xl px-2.5 py-1.5 transition ${active === index ? "bg-[var(--panel-secondary)]" : ""}`}
                key={slice.type}
                onBlur={() => setActive(null)}
                onClick={() => setActive((value) => (value === index ? null : index))}
                onFocus={() => setActive(index)}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                tabIndex={0}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-[var(--foreground)]"><Dot color={slice.color} />{slice.name}</span>
                  <span className="whitespace-nowrap">
                    <span className="num text-[16px] text-[var(--foreground)]">{money(slice.amount)}</span>
                    {total > 0 ? <span className={`ml-1.5 ${soft}`}>{Math.round((slice.amount / total) * 100)}%</span> : null}
                  </span>
                </span>
                {Number(slice.extras || 0) > 0 ? <span className={`block pl-[18px] ${soft}`}>{say("extrasPart", { amount: money(Number(slice.extras)) })}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Month by month as plain rows: readable on a phone, where a wide chart had to be scrolled sideways. Quiet months are left out. */
export function MonthRows({ months, say }: { months: Array<{ key?: string; label: string; short?: string; revenue: number; expenses: number; profit: number }>; say: Say }) {
  const busy = months.filter((month) => month.revenue !== 0 || month.expenses !== 0);
  const biggest = Math.max(1, ...busy.map((month) => Math.max(month.revenue, month.expenses)));
  if (busy.length < 2) return null;
  const best = [...busy].sort((a, b) => b.profit - a.profit)[0];
  return (
    <section className="card p-4">
      <h2 className={h2}>{say("monthsTitle")}</h2>
      <p className="mt-2 flex gap-4 font-semibold text-[var(--foreground-secondary)]">
        <span className="inline-flex items-center gap-1.5"><Dot color="var(--chart-in)" />{say("moneyIn")}</span>
        <span className="inline-flex items-center gap-1.5"><Dot color="var(--chart-out)" />{say("moneyOut")}</span>
      </p>
      <InOutBars inWord={say("moneyIn")} label={say("monthsTitle")} money={money} outWord={say("moneyOut")} periods={months.map((month) => ({ key: month.key || month.label, label: month.short || month.label, in: month.revenue, out: month.expenses }))} />
      {best && best.profit > 0 ? <p className="mt-2 font-bold text-[var(--success)]">{say("bestMonth", { month: best.label, amount: money(best.profit) })}</p> : null}
      <details className="mt-3">
        <summary className="cursor-pointer font-bold text-[var(--primary)]">{say("monthByMonth")}</summary>
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
                <div className="h-full rounded-full bg-[var(--chart-in)]" style={{ width: `${(month.revenue / biggest) * 100}%` }} />
              </div>
              <span className={`w-28 shrink-0 text-right ${soft}`}>{say("monthIn", { amount: money(month.revenue) })}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[var(--chart-out)]" style={{ width: `${(month.expenses / biggest) * 100}%` }} />
              </div>
              <span className={`w-28 shrink-0 text-right ${soft}`}>{say("monthOut", { amount: money(month.expenses) })}</span>
            </div>
          </div>
        ))}
      </div>
      </details>
    </section>
  );
}

/** Week by week: the same pair of bars as month by month, for a period of a few weeks. */
export function WeekBars({ weeks, say }: { weeks: Array<{ key: string; label: string; revenue: number; expenses: number; profit: number }>; say: Say }) {
  const busy = weeks.filter((week) => week.revenue !== 0 || week.expenses !== 0);
  if (busy.length < 2 || weeks.length > 16) return null;
  const best = [...busy].sort((a, b) => b.profit - a.profit)[0];
  return (
    <section className="card p-4">
      <h2 className={h2}>{say("weeksTitle")}</h2>
      <p className="mt-2 flex gap-4 font-semibold text-[var(--foreground-secondary)]">
        <span className="inline-flex items-center gap-1.5"><Dot color="var(--chart-in)" />{say("moneyIn")}</span>
        <span className="inline-flex items-center gap-1.5"><Dot color="var(--chart-out)" />{say("moneyOut")}</span>
      </p>
      <InOutBars inWord={say("moneyIn")} label={say("weeksTitle")} money={money} outWord={say("moneyOut")} periods={weeks.map((week) => ({ key: week.key, label: week.label, in: week.revenue, out: week.expenses }))} />
      {best && best.profit > 0 ? <p className="mt-2 font-bold text-[var(--success)]">{say("bestWeek", { week: best.label, amount: money(best.profit) })}</p> : null}
    </section>
  );
}

type SortKey = "profit" | "income" | "expenses" | "utilization" | "roi" | "rentals";
const SORTS: SortKey[] = ["profit", "income", "expenses", "utilization", "rentals", "roi"];

function VehicleTile({ vehicle, comparing, selected, onSelect, href, say }: { vehicle: VehicleMetrics; comparing: boolean; selected: boolean; onSelect: (id: string) => void; href: string; say: Say }) {
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const spent = vehicle.income > 0 ? Math.min(100, Math.round((vehicle.expenses / vehicle.income) * 100)) : vehicle.expenses > 0 ? 100 : 0;
  const used = Math.round(vehicle.utilizationRate);
  const body = (
    <>
      <span className="flex items-center gap-3">
        <VehicleArt colour={vehicle.color} kind={kindFromCategory(vehicle.category as never)} model={vehicle.model} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold text-[var(--foreground)]">{vehicle.plate || vehicle.label}</span>
          <span className={`block truncate ${soft}`}>{name || vehicle.label}</span>
        </span>
        {comparing ? (
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${selected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white"}`}>
            {selected ? <Check size={16} /> : null}
          </span>
        ) : (
          <ChevronRight className="shrink-0 text-[var(--primary)]" size={20} />
        )}
      </span>
      <span className="mt-3 flex items-end justify-between gap-3">
        <span className="min-w-0">
          <span className={`block ${soft}`}>{say("profit")}</span>
          <span className={`num block text-[26px] leading-tight ${vehicle.profit >= 0 ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{money(vehicle.profit)}</span>
          <span className={`block ${soft}`}>{say("tileRentals", { count: vehicle.rentalCount })}</span>
        </span>
        <span className="flex shrink-0 flex-col items-center">
          <Ring color="var(--on-rent)" label={`${used}%`} pct={used} size={64} stroke={7} track="var(--panel-tertiary)" />
          <span className="mt-1 whitespace-nowrap text-[14px] font-semibold text-[var(--foreground-secondary)]">{say("timeRented")}</span>
        </span>
      </span>
      <span aria-hidden="true" className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[var(--panel-tertiary)]">
        {spent > 0 ? <span className="grow-x block h-full" style={{ background: "var(--chart-out)", width: `${spent}%` }} /> : null}
        {spent < 100 && vehicle.income > 0 ? <span className={`grow-x block h-full flex-1 ${spent > 0 ? "border-l-2 border-white" : ""}`} style={{ background: "var(--success)" }} /> : null}
      </span>
      <span className="mt-1.5 flex flex-wrap justify-between gap-x-3 font-semibold text-[var(--foreground-secondary)]">
        <span>{say("moneyIn")} {money(vehicle.income)}</span>
        <span className="inline-flex items-center gap-1.5"><Dot color="var(--chart-out)" />{say("moneyOut")} {money(vehicle.expenses)}</span>
      </span>
    </>
  );
  const shell = `pressable block rounded-2xl bg-[var(--panel-secondary)] p-3.5 text-left transition hover:bg-[var(--panel-tertiary)] ${comparing && selected ? "outline outline-2 outline-[var(--primary)]" : ""}`;
  return comparing ? (
    <button aria-pressed={selected} className={`${shell} w-full`} onClick={() => onSelect(vehicle.id)} type="button">
      {body}
    </button>
  ) : (
    <Link className={shell} href={href as never}>
      {body}
    </Link>
  );
}

function VehicleListRow({ vehicle, best, comparing, selected, onSelect, href, say }: { vehicle: VehicleMetrics; best: number; comparing: boolean; selected: boolean; onSelect: (id: string) => void; href: string; say: Say }) {
  const name = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const share = best > 0 ? Math.min(100, (Math.abs(vehicle.profit) / best) * 100) : 0;
  const body = (
    <>
      <VehicleArt colour={vehicle.color} kind={kindFromCategory(vehicle.category as never)} model={vehicle.model} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[16px] font-bold text-[var(--foreground)]">{vehicle.plate || vehicle.label}</span>
          <span className={`num shrink-0 text-[17px] ${vehicle.profit >= 0 ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{money(vehicle.profit)}</span>
        </span>
        <span className="flex items-baseline justify-between gap-3">
          <span className={`truncate ${soft}`}>{name || vehicle.label}</span>
          <span className={`shrink-0 whitespace-nowrap ${soft}`}>{say("rowRented", { percent: Math.round(vehicle.utilizationRate) })}</span>
        </span>
        <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[var(--panel-tertiary)]">
          <span className="grow-x block h-full rounded-full" style={{ width: `${Math.max(share, vehicle.profit !== 0 ? 2 : 0)}%`, background: vehicle.profit >= 0 ? "var(--success)" : "var(--warning)" }} />
        </span>
      </span>
      {comparing ? (
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${selected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white"}`}>
          {selected ? <Check size={16} /> : null}
        </span>
      ) : (
        <ChevronRight className="shrink-0 text-[var(--primary)]" size={20} />
      )}
    </>
  );
  const shell = `pressable flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[var(--panel-secondary)] ${comparing && selected ? "bg-[var(--primary-light)]" : ""}`;
  return comparing ? (
    <button aria-pressed={selected} className={shell} onClick={() => onSelect(vehicle.id)} type="button">
      {body}
    </button>
  ) : (
    <Link className={shell} href={href as never}>
      {body}
    </Link>
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
              <XAxis dataKey="name" tick={{ fontSize: 14 }} />
              <YAxis tick={{ fontSize: 14 }} tickFormatter={(value) => `${BAHT}${(value / 1000).toFixed(0)}k`} width={48} />
              <Tooltip formatter={(value) => money(Number(value))} />
              <Legend />
              <Bar isAnimationActive={false} dataKey={inKey} fill="#0e5e6f" radius={[2, 2, 0, 0]} />
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
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 14 }} />
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
  // A list by default: tiles for a big fleet make a very long page. The choice is remembered on this device.
  const [vehicleView, setVehicleView] = useState<"list" | "grid">("list");
  useEffect(() => {
    try {
      if (window.localStorage.getItem("routehq.reports.vehicleView") === "grid") setVehicleView("grid");
    } catch {}
  }, []);
  function chooseView(next: "list" | "grid") {
    setVehicleView(next);
    try {
      window.localStorage.setItem("routehq.reports.vehicleView", next);
    } catch {}
  }
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
  const monthShort = new Intl.DateTimeFormat(intlLocale(locale), { month: "short", timeZone: "UTC" });
  const monthly = data.monthlyData.map((month) => {
    const key = String(month.key || "");
    const match = key.match(/^(\d{4})-(\d{2})$/);
    const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : null;
    return { ...month, label: date ? monthFormat.format(date) : month.label, short: date ? monthShort.format(date) : month.label };
  });
  const weekFormat = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" });
  const weekly = (data.weeklyData || []).map((week) => ({ ...week, key: String(week.key || week.label), label: weekFormat.format(new Date(`${String(week.key || week.label)}T00:00:00Z`)) }));
  const busyMonths = monthly.filter((month) => month.revenue !== 0 || month.expenses !== 0).length;
  const periodQuery = `preset=${data.dateRange.preset}&from=${data.dateRange.from}&to=${data.dateRange.to}`;
  const exportHref = (format: string) => `/api/reports/export?format=${format}&preset=${data.dateRange.preset}&from=${data.dateRange.from}&to=${data.dateRange.to}`;
  const nothingAtAll = data.vehicleMetrics.length === 0 && data.recentTransactions.length === 0;

  return (
    <div className="grid gap-3 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
      {/* Which period */}
      <div className="lg:col-span-2">
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
        <p className={`num text-[36px] leading-tight ${data.netProfit >= 0 ? "text-[var(--foreground)]" : "text-[var(--warning)]"}`}>{money(data.netProfit)}</p>
        <Change change={data.profitChange} say={say} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className={tile}>
            <p className={soft}>{say("moneyIn")}</p>
            <p className="num flex items-center gap-1.5 text-[22px] text-[var(--foreground)]"><Dot color="var(--chart-in)" />{money(data.totalRevenue)}</p>
            <Change change={data.revenueChange} say={say} />
          </div>
          <div className={tile}>
            <p className={soft}>{say("moneyOut")}</p>
            <p className="num flex items-center gap-1.5 text-[22px] text-[var(--foreground)]"><Dot color="var(--chart-out)" />{money(data.totalExpenses)}</p>
            <Change change={data.expensesChange} say={say} upIsBad />
          </div>
        </div>
        {data.totalRevenue > 0 ? (
          (() => {
            const spent = Math.min(100, Math.round((data.totalExpenses / data.totalRevenue) * 100));
            return (
              <div className="mt-4" title={say("profitNote")}>
                <div aria-hidden="true" className="flex h-3.5 overflow-hidden rounded-full bg-[var(--panel-tertiary)]">
                  {spent > 0 ? <span className="grow-x block h-full" style={{ background: "var(--chart-out)", width: `${spent}%` }} /> : null}
                  {spent < 100 ? <span className={`grow-x block h-full flex-1 ${spent > 0 ? "border-l-2 border-white" : ""}`} style={{ background: "var(--success)" }} /> : null}
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-semibold text-[var(--foreground-secondary)]">
                  <span className="inline-flex items-center gap-1.5"><Dot color="var(--chart-out)" />{say("spentShare", { percent: spent })}</span>
                  <span className="inline-flex items-center gap-1.5"><Dot color="var(--success)" />{say("keptShare", { percent: 100 - spent })}</span>
                </p>
              </div>
            );
          })()
        ) : (
          <p className={`mt-3 ${soft}`}>{say("profitNote")}</p>
        )}
      </section>

      <div className="grid content-start gap-3">
      <Link className="card pressable flex items-center justify-between gap-3 p-4" href={"/reports/fleet-value" as any}>
        <span aria-hidden="true" className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)]"><TrendingUp size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-[var(--foreground)]">{say("fleetValueLink")}</span>
          <span className={soft}>{say("fleetValueLinkHint")}</span>
        </span>
        <span aria-hidden className="text-xl text-[var(--muted)]">›</span>
      </Link>
      <Link className="card pressable flex items-center justify-between gap-3 p-4" href={"/reports/owners" as any}>
        <span aria-hidden="true" className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-light)] text-[#5c3a0c]"><Handshake size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-[var(--foreground)]">{say("ownersLink")}</span>
          <span className={soft}>{say("ownersLinkHint")}</span>
        </span>
        <span aria-hidden className="text-xl text-[var(--muted)]">›</span>
      </Link>
      <Link className="card pressable flex items-center justify-between gap-3 p-4" href="/transactions">
        <span aria-hidden="true" className="inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]"><ArrowLeftRight size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-[var(--foreground)]">{say("allMoney")}</span>
          <span className={soft}>{say("allMoneyHint", { count: data.recentTransactions.length })}</span>
        </span>
        <span aria-hidden className="text-xl text-[var(--muted)]">›</span>
      </Link>
      </div>

      <div className="grid content-start gap-3 [&>*]:min-w-0">
      {/* Who owes money */}
      <section className="card p-4">
        <h2 className={h2}>{say("owedTitle")}</h2>
        {data.outstandingBalances.length === 0 ? (
          <p className="mt-3 flex items-center gap-3 font-semibold text-[var(--foreground-secondary)]">
            <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white"><CheckCircle2 size={22} strokeWidth={2.4} /></span>
            {say("owedNone")}
          </p>
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

      <div className="hidden empty:hidden lg:block">
        {busyMonths >= 2 ? <MonthRows months={monthly} say={say} /> : <WeekBars say={say} weeks={weekly} />}
      </div>
      </div>

      {/* Deposits: held for customers, never income until kept */}
      <section className="card p-4">
        <h2 className={h2}>{say("depositsTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("depositsBody")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="tile-sky col-span-2 rounded-xl p-3.5">
            <p className="font-semibold">{say("depositsHolding")}</p>
            <p className="num text-[26px] leading-tight">{money(deposits.totalDepositsCurrentlyHeld)}</p>
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

      <div className="empty:hidden lg:hidden">
        {busyMonths >= 2 ? <MonthRows months={monthly} say={say} /> : <WeekBars say={say} weeks={weekly} />}
      </div>

      {data.revenueByType.length > 0 || data.expensesByType.length > 0 ? (
        <div className="grid gap-3 lg:col-span-2 lg:grid-cols-2 [&>*]:min-w-0">
          <Breakdown rows={data.revenueByType} say={say} title={say("cameFrom")} typeLabel={typeLabel} />
          <Breakdown palette={OUT_COLORS} rows={data.expensesByType} say={say} title={say("wentOn")} typeLabel={typeLabel} />
        </div>
      ) : null}

      {/* Vehicle by vehicle */}
      {sortedVehicles.length > 0 ? (
        <section className="card p-4 lg:col-span-2">
          <h2 className={h2}>{say("vehiclesTitle")}</h2>
          <p className={`mt-1 ${soft}`}>{compareMode ? say("compareHelp", { count: selected.size }) : say("vehiclesBody")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="min-w-0 basis-full sm:basis-auto sm:flex-1">
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
            <div className="ml-auto flex shrink-0 rounded-full bg-[var(--panel-secondary)] p-1" role="group">
              {(["list", "grid"] as const).map((view) => (
                <button
                  aria-label={say(view === "list" ? "viewList" : "viewGrid")}
                  aria-pressed={vehicleView === view}
                  className={`pressable flex h-9 w-10 items-center justify-center rounded-full ${vehicleView === view ? "bg-white text-[var(--primary)] shadow-sm" : "text-[var(--foreground-secondary)]"}`}
                  key={view}
                  onClick={() => chooseView(view)}
                  title={say(view === "list" ? "viewList" : "viewGrid")}
                  type="button"
                >
                  {view === "list" ? <List size={18} /> : <LayoutGrid size={18} />}
                </button>
              ))}
            </div>
          </div>
          {vehicleView === "list" ? (
            <div className="mt-2 divide-y divide-[var(--border)]">
              {sortedVehicles.map((vehicle) => (
                <VehicleListRow best={Math.max(1, ...sortedVehicles.map((item) => Math.abs(item.profit)))} comparing={compareMode} href={`/reports/vehicle/${vehicle.id}?${periodQuery}`} key={vehicle.id} onSelect={toggleSelect} say={say} selected={selected.has(vehicle.id)} vehicle={vehicle} />
              ))}
            </div>
          ) : (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {sortedVehicles.map((vehicle) => (
                <VehicleTile comparing={compareMode} href={`/reports/vehicle/${vehicle.id}?${periodQuery}`} key={vehicle.id} onSelect={toggleSelect} say={say} selected={selected.has(vehicle.id)} vehicle={vehicle} />
              ))}
            </div>
          )}
          {compareMode && compareVehicles.length >= 2 ? <ComparisonPanel say={say} vehicles={compareVehicles} /> : null}
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
