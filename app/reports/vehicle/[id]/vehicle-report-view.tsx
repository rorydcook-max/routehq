"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { intlLocale, longDate, shortDate } from "@/lib/i18n/dates";
import type { DatePreset, VehicleReportData } from "@/lib/reports";
import { Breakdown, MonthRows, money } from "../../reports-view";

type Say = (key: string, values?: Record<string, string | number>) => string;

const PRESETS: DatePreset[] = ["this_month", "last_month", "last_3_months", "last_6_months", "this_year", "last_year", "custom"];
const BAHT = "฿";
const h2 = "text-[17px] font-bold text-[var(--foreground)]";
const soft = "font-medium text-[var(--foreground-secondary)]";
const tile = "rounded-xl bg-[var(--panel-secondary)] p-3.5";

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

      <section className="card p-4">
        <p className={soft}>{say("profit")}</p>
        <p className={`text-[32px] font-bold leading-tight ${netProfit >= 0 ? "text-[var(--foreground)]" : "text-[var(--warning)]"}`}>{money(netProfit)}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className={tile}>
            <p className={soft}>{say("moneyIn")}</p>
            <p className="text-[20px] font-bold text-[var(--foreground)]">{money(totalRevenue)}</p>
            <p className={soft}>{say("owedRentals", { count: rentalCount })}</p>
          </div>
          <div className={tile}>
            <p className={soft}>{say("moneyOut")}</p>
            <p className="text-[20px] font-bold text-[var(--foreground)]">{money(totalExpenses)}</p>
          </div>
          <div className={tile}>
            <p className={soft}>{say("timeRented")}</p>
            <p className="text-[20px] font-bold text-[var(--foreground)]">{Math.round(utilizationRate)}%</p>
            <p className={soft}>{say("vr_daysOut", { count: rentalDays })}</p>
          </div>
          <div className={tile}>
            <p className={soft}>{say("avgPerDay")}</p>
            <p className="text-[20px] font-bold text-[var(--foreground)]">{avgDailyRate > 0 ? money(avgDailyRate) : "-"}</p>
            {vehicle.dailyRate > 0 ? <p className={soft}>{say("vr_listed", { amount: money(vehicle.dailyRate) })}</p> : null}
          </div>
        </div>
      </section>

      <MonthRows months={monthly} say={say} />

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
          </div>
          <Link className="secondary-action pressable mt-3 w-full" href={`/fleet/${vehicle.id}/edit` as any}>
            {say("vr_editValue")}
          </Link>
        </section>
      ) : null}

      <section className="card p-4">
        <h2 className={h2}>{say("vr_rentalsTitle", { count: data.rentals.length })}</h2>
        {data.rentals.length === 0 ? (
          <p className={`mt-1 ${soft}`}>{say("vr_noRentals")}</p>
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

      <section className="card p-4">
        <h2 className={h2}>{say("vr_moneyTitle", { count: data.transactions.length })}</h2>
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
      </section>
    </div>
  );
}
