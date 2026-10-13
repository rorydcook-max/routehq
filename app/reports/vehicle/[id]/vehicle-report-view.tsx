"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { intlLocale, longDate, shortDate } from "@/lib/i18n/dates";
import type { DatePreset, VehicleReportData } from "@/lib/reports";
import { Dot, Ring } from "@/components/glance";
import { VehicleArt } from "@/components/vehicle-art";
import { kindFromCategory } from "@/lib/vehicle-groups";
import { Breakdown, MonthRows, WeekBars, money } from "../../reports-view";

type Say = (key: string, values?: Record<string, string | number>) => string;

const PRESETS: DatePreset[] = ["this_month", "last_month", "last_3_months", "last_6_months", "this_year", "last_year", "custom"];
const h2 = "text-[17px] font-bold text-[var(--foreground)]";
const soft = "font-medium text-[var(--foreground-secondary)]";
const tile = "rounded-xl bg-[var(--panel-secondary)] p-3.5";

type TimelineRental = VehicleReportData["rentals"][number];

/** The period as one track, each rental a bar on it: solid while out, pale once back, outlined while still to come. */
function RentalTimeline({ rentals, from, to, today, locale, statusLabel }: { rentals: TimelineRental[]; from: string; to: string; today: string; locale: string; statusLabel: (status: string) => string }) {
  const day = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  const start = day(from);
  const end = day(to) + 86400000;
  const span = Math.max(1, end - start);
  const at = (time: number) => Math.max(0, Math.min(100, ((time - start) / span) * 100));
  const showToday = today >= from && today <= to;
  const kinds = new Set<string>();
  const bars = rentals.map((rental) => {
    const left = at(day(rental.startDate));
    const stop = rental.endDate ? day(rental.endDate) + 86400000 : day(today < to ? today : to) + 86400000;
    const kind = rental.status === "booked" ? "booked" : rental.status === "completed" ? "completed" : "active";
    kinds.add(kind);
    return { rental, left, width: Math.max(1.5, at(stop) - left), kind };
  });
  const paint: Record<string, string> = { active: "var(--on-rent)", completed: "color-mix(in srgb, var(--on-rent) 45%, white)", booked: "#fff" };
  return (
    <div>
      <div className={`relative h-9 rounded-full bg-[var(--panel-tertiary)] ${showToday ? "mt-7" : "mt-3"}`}>
        {bars.map(({ rental, left, width, kind }) => (
          <Link
            aria-label={`${rental.customerName || ""} ${shortDate(rental.startDate, locale)}${rental.endDate ? ` - ${shortDate(rental.endDate, locale)}` : ""}`}
            className="grow-x absolute inset-y-1 rounded-full transition hover:brightness-110"
            data-tip={`${rental.customerName || statusLabel(rental.status)} · ${shortDate(rental.startDate, locale)}${rental.endDate ? ` - ${shortDate(rental.endDate, locale)}` : ""}`}
            href={`/bookings/${rental.id}` as never}
            key={rental.id}
            style={{ left: `${left}%`, width: `${width}%`, background: paint[kind], boxShadow: kind === "booked" ? "inset 0 0 0 2px var(--on-rent)" : "0 0 0 2px #fff" }}
          />
        ))}
        {showToday ? (
          <span className="pointer-events-none absolute -top-6 bottom-[-4px] flex -translate-x-1/2 flex-col items-center" style={{ left: `${at(day(today) + 43200000)}%` }}>
            <span className="whitespace-nowrap rounded-full bg-[var(--foreground)] px-2 text-[14px] font-bold leading-5 text-white">{shortDate(today, locale)}</span>
            <span className="w-[3px] flex-1 rounded-full bg-[var(--foreground)]" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 flex justify-between gap-3 font-semibold text-[var(--foreground-secondary)]">
        <span>{shortDate(from, locale)}</span>
        <span>{shortDate(to, locale)}</span>
      </p>
      {kinds.size > 0 ? (
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-semibold text-[var(--foreground-secondary)]">
          {["active", "completed", "booked"].filter((kind) => kinds.has(kind)).map((kind) => (
            <span className="inline-flex items-center gap-1.5" key={kind}>
              <span aria-hidden="true" className="inline-block h-3 w-5 rounded-full" style={{ background: paint[kind], boxShadow: kind === "booked" ? "inset 0 0 0 2px var(--on-rent)" : undefined }} />
              {statusLabel(kind)}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function VehicleReportView({ data }: { data: VehicleReportData }) {
  const say = useTranslations("reportsPage") as unknown as Say;
  const moneyT = useTranslations("money");
  const bookingsT = useTranslations("bookings");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preset = data.dateRange.preset;
  const [customOpen, setCustomOpen] = useState(preset === "custom");
  const [localFrom, setLocalFrom] = useState(preset === "custom" ? data.dateRange.from : "");
  const [localTo, setLocalTo] = useState(preset === "custom" ? data.dateRange.to : "");

  const typeLabel = (type: string, fallback: string) => (moneyT.has(`type_${type}` as never) ? (moneyT as unknown as Say)(`type_${type}`) : fallback);
  const statusLabel = (status: string) => (bookingsT.has(`status_${status}` as never) ? (bookingsT as unknown as Say)(`status_${status}`) : status.replace(/_/g, " "));

  function setPreset(next: DatePreset) {
    if (next === "custom") {
      setCustomOpen(true);
      return;
    }
    router.push(`?preset=${next}`);
  }

  function applyCustomRange() {
    if (!localFrom || !localTo) return;
    const params = new URLSearchParams();
    params.set("preset", "custom");
    params.set("from", localFrom <= localTo ? localFrom : localTo);
    params.set("to", localFrom <= localTo ? localTo : localFrom);
    router.push(`?${params.toString()}`);
  }

  const { vehicle, totalRevenue, totalExpenses, netProfit, utilizationRate, rentalCount, avgDailyRate, roi, rentalDays } = data;
  const lostValue = vehicle.purchasePrice > 0 && vehicle.estimatedValue > 0 ? Math.max(0, vehicle.purchasePrice - vehicle.estimatedValue) : 0;
  const monthFormat = new Intl.DateTimeFormat(intlLocale(locale), { month: "short", year: "numeric", timeZone: "UTC" });
  const monthly = data.monthlyData.map((month) => {
    const match = String(month.key || "").match(/^(\d{4})-(\d{2})$/);
    return { ...month, label: match ? monthFormat.format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))) : month.label };
  });
  void searchParams;
  const weekFormat = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "UTC" });
  const weekly = (data.weeklyData || []).map((week) => ({ ...week, key: String(week.key || week.label), label: weekFormat.format(new Date(`${String(week.key || week.label)}T00:00:00Z`)) }));
  const busyMonths = monthly.filter((month) => month.revenue !== 0 || month.expenses !== 0).length;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const spent = totalRevenue > 0 ? Math.min(100, Math.round((totalExpenses / totalRevenue) * 100)) : totalExpenses > 0 ? 100 : 0;
  const used = Math.round(utilizationRate);
  const earned = Math.max(0, Math.min(100, roi));

  return (
    <div className="space-y-3">
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

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start [&>*]:min-w-0">
      <div className="contents">
      <section className="card p-4">
        <div className="flex items-center gap-4">
          <VehicleArt colour={vehicle.color} kind={kindFromCategory(vehicle.category as never)} model={vehicle.model} size="md" />
          <div className="min-w-0 flex-1">
            <p className={soft}>{say("profit")}</p>
            <p className={`num text-[34px] leading-tight ${netProfit >= 0 ? "text-[var(--foreground)]" : "text-[var(--warning)]"}`}>{money(netProfit)}</p>
          </div>
          <span className="hidden shrink-0 flex-col items-center min-[420px]:flex">
            <Ring color="var(--on-rent)" label={`${used}%`} pct={used} size={72} stroke={8} track="var(--panel-tertiary)" />
            <span className="mt-1 whitespace-nowrap text-[14px] font-semibold text-[var(--foreground-secondary)]">{say("timeRented")}</span>
          </span>
        </div>
        {totalRevenue > 0 || totalExpenses > 0 ? (
          <div className="mt-4">
            <div aria-hidden="true" className="flex h-3.5 overflow-hidden rounded-full bg-[var(--panel-tertiary)]">
              {spent > 0 ? <span className="grow-x block h-full" style={{ background: "var(--chart-out)", width: `${spent}%` }} /> : null}
              {spent < 100 && totalRevenue > 0 ? <span className={`grow-x block h-full flex-1 ${spent > 0 ? "border-l-2 border-white" : ""}`} style={{ background: "var(--success)" }} /> : null}
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-semibold text-[var(--foreground-secondary)]">
              <span className="inline-flex items-center gap-1.5"><Dot color="var(--chart-out)" />{say("spentShare", { percent: spent })}</span>
              <span className="inline-flex items-center gap-1.5"><Dot color="var(--success)" />{say("keptShare", { percent: Math.max(0, 100 - spent) })}</span>
            </p>
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className={tile}>
            <p className={soft}>{say("moneyIn")}</p>
            <p className="num flex items-center gap-1.5 text-[20px] text-[var(--foreground)]"><Dot color="var(--chart-in)" />{money(totalRevenue)}</p>
            <p className={soft}>{say("owedRentals", { count: rentalCount })}</p>
          </div>
          <div className={tile}>
            <p className={soft}>{say("moneyOut")}</p>
            <p className="num flex items-center gap-1.5 text-[20px] text-[var(--foreground)]"><Dot color="var(--chart-out)" />{money(totalExpenses)}</p>
          </div>
          <div className={`${tile} min-[420px]:hidden`}>
            <p className={soft}>{say("timeRented")}</p>
            <p className="num text-[20px] text-[var(--foreground)]">{used}%</p>
            <p className={soft}>{say("vr_daysOut", { count: rentalDays })}</p>
          </div>
          <div className={`${tile} min-[420px]:col-span-2`}>
            <p className={soft}>{say("avgPerDay")}</p>
            <p className="num text-[20px] text-[var(--foreground)]">{avgDailyRate > 0 ? money(avgDailyRate) : "-"}</p>
            {vehicle.dailyRate > 0 ? <p className={soft}>{say("vr_listed", { amount: money(vehicle.dailyRate) })}</p> : null}
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h2 className={h2}>{say("vr_rentalsTitle", { count: data.rentals.length })}</h2>
        <p className={`mt-1 ${soft}`}>{say("vr_daysOut", { count: rentalDays })}</p>
        <RentalTimeline from={data.dateRange.from} locale={locale} rentals={data.rentals} statusLabel={statusLabel} to={data.dateRange.to} today={today} />
        {data.rentals.length === 0 ? (
          <p className={`mt-2 ${soft}`}>{say("vr_noRentals")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.rentals.map((rental) => (
              <Link className={`${tile} pressable flex items-center justify-between gap-3`} href={`/bookings/${rental.id}` as any} key={rental.id}>
                <span className="min-w-0">
                  <span className="block text-[16px] font-bold text-[var(--foreground)]">{rental.customerName || rental.displayCode || say("vr_aRental")}</span>
                  <span className={`block ${soft}`}>
                    {shortDate(rental.startDate, locale)}
                    {rental.endDate ? ` - ${shortDate(rental.endDate, locale)}` : ""} · {statusLabel(rental.status)}
                  </span>
                  {rental.balanceDue > 0 && rental.status !== "cancelled" ? <span className="block font-semibold text-[var(--warning)]">{say("vr_stillOwed", { amount: money(rental.balanceDue) })}</span> : null}
                </span>
                <ChevronRight className="shrink-0 text-[var(--primary)]" size={18} />
              </Link>
            ))}
          </div>
        )}
      </section>
      </div>

      <div className="contents">
      {busyMonths >= 2 ? <MonthRows months={monthly} say={say} /> : <WeekBars say={say} weeks={weekly} />}

      <Breakdown rows={data.expensesByType} say={say} title={say("wentOn")} typeLabel={typeLabel} />

      {vehicle.purchasePrice > 0 ? (
        <section className="card p-4">
          <h2 className={h2}>{say("vr_valueTitle")}</h2>
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className={soft}>{say("boughtFor")}</span>
              <span className="font-bold text-[var(--foreground)]">{money(vehicle.purchasePrice)}</span>
            </div>
            {vehicle.estimatedValue > 0 ? (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <span className={soft}>{say("vr_worthNow")}</span>
                  <span className="font-bold text-[var(--foreground)]">{money(vehicle.estimatedValue)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className={soft}>{say("vr_lostValue")}</span>
                  <span className="font-bold text-[var(--foreground)]">{money(lostValue)}</span>
                </div>
              </>
            ) : null}
            <div className="flex items-baseline justify-between gap-3">
              <span className={soft}>{say("vr_earnedBackPeriod")}</span>
              <span className="font-bold text-[var(--foreground)]">{roi.toFixed(1)}%</span>
            </div>
            <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-[var(--panel-tertiary)]">
              <span className="grow-x block h-full rounded-full bg-[var(--success)]" style={{ width: `${Math.max(earned, earned > 0 ? 2 : 0)}%` }} />
            </div>
          </div>
          <Link className="secondary-action pressable mt-3 w-full" href={`/fleet/${vehicle.id}/edit` as any}>
            {say("vr_editValue")}
          </Link>
        </section>
      ) : null}

      </div>
      </div>

      <details className="card group p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <h2 className={h2}>{say("vr_moneyTitle", { count: data.transactions.length })}</h2>
          <ChevronRight className="shrink-0 text-[var(--primary)] transition group-open:rotate-90" size={20} />
        </summary>
        {data.transactions.length === 0 ? (
          <p className={`mt-1 ${soft}`}>{say("nothingRecorded")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.transactions.map((entry) => {
              // A deposit coming in is held for the customer: money received, but not income.
              const held = entry.type === "deposit_received" || entry.type === "deposit";
              return (
                <div className={`${tile} flex items-center justify-between gap-3`} key={entry.id}>
                  <div className="min-w-0">
                    <p className="text-[16px] font-bold text-[var(--foreground)]">{typeLabel(entry.type, entry.typeLabel)}</p>
                    {entry.notes || entry.supplier ? <p className={soft}>{entry.notes || entry.supplier}</p> : null}
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
        )}
      </details>
    </div>
  );
}
