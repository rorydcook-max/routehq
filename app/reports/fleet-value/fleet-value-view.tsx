"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { longDate } from "@/lib/i18n/dates";
import type { Valuation } from "@/lib/vehicle-valuation";

type Say = (key: string, values?: Record<string, string | number>) => string;

export type ValueRow = {
  id: string;
  name: string;
  plate: string;
  hasYear: boolean;
  mileage: number | null;
  paid: number | null;
  boughtOn: string | null;
  /** The value used: the owner's figure, or the last estimate. */
  value: number | null;
  ownFigure: boolean;
  sumInsured: number | null;
  valuation: Valuation | null;
};

const MONTH = 30 * 86400000;
const stale = (row: ValueRow) => !row.valuation?.checked_at || Date.now() - new Date(row.valuation.checked_at).getTime() >= MONTH;

export function FleetValueView({ rows: initial, currency, canEstimate }: { rows: ValueRow[]; currency: string; canEstimate: boolean }) {
  const t = useTranslations("fleetValue");
  const say = t as unknown as Say;
  const locale = useLocale();
  const money = useMemo(() => {
    const format = new Intl.NumberFormat(locale === "en" ? "en-GB" : `${locale}-u-nu-latn`, { style: "currency", currency, maximumFractionDigits: 0 });
    return (value: number) => format.format(Math.round(value));
  }, [locale, currency]);
  const [rows, setRows] = useState(initial);
  const [working, setWorking] = useState<{ done: number; total: number; name: string } | null>(null);
  const [failed, setFailed] = useState(0);

  const worth = rows.reduce((sum, row) => sum + (row.value || 0), 0);
  const valued = rows.filter((row) => row.value).length;
  const withPaid = rows.filter((row) => row.paid && row.value);
  const paid = withPaid.reduce((sum, row) => sum + (row.paid || 0), 0);
  const paidWorth = withPaid.reduce((sum, row) => sum + (row.value || 0), 0);
  const toCheck = rows.filter(stale);

  async function estimate(list: ValueRow[]) {
    setFailed(0);
    for (let index = 0; index < list.length; index++) {
      const row = list[index];
      setWorking({ done: index, total: list.length, name: row.name });
      try {
        const response = await fetch("/api/fleet/value", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicleId: row.id }) });
        const reply = await response.json();
        if (reply.valuation) {
          setRows((current) =>
            current.map((item) => (item.id === row.id ? { ...item, valuation: reply.valuation, value: Number(reply.estimatedValue) || item.value, ownFigure: Boolean(reply.ownFigure) } : item))
          );
        } else setFailed((count) => count + 1);
      } catch {
        setFailed((count) => count + 1);
      }
    }
    setWorking(null);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
        <p className="text-sm font-semibold text-[var(--muted)]">{t("worthNow")}</p>
        <p className="mt-1 text-4xl font-bold">{money(worth)}</p>
        <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
          {say("valuedCount", { valued, total: rows.length })}
        </p>
        {paid > 0 ? (
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
            {say(paidWorth >= paid ? "paidUp" : "paidDown", { paid: money(paid), change: money(Math.abs(paidWorth - paid)), count: withPaid.length })}
          </p>
        ) : null}
        {canEstimate ? (
          <div className="mt-4">
            {working ? (
              <div aria-live="polite">
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--panel-secondary,#eef1f4)]">
                  <div className="h-full rounded-full bg-[var(--primary)] transition-all duration-700" style={{ width: `${Math.max(6, Math.round((100 * working.done) / working.total))}%` }} />
                </div>
                <p className="mt-2 text-sm font-semibold">{say("checking", { n: working.done + 1, total: working.total, name: working.name })}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{t("checkingHint")}</p>
              </div>
            ) : toCheck.length ? (
              <button className="btn-primary w-full justify-center py-3 sm:w-auto sm:px-6" onClick={() => estimate(toCheck)} type="button">
                {say("estimate", { count: toCheck.length })}
              </button>
            ) : (
              <p className="text-sm text-[var(--muted)]">{t("allChecked")}</p>
            )}
            {failed > 0 && !working ? <p className="mt-2 text-sm font-semibold text-[var(--warning)]">{say("someFailed", { count: failed })}</p> : null}
          </div>
        ) : null}
      </section>

      <ul className="space-y-3">
        {rows.map((row) => {
          const change = row.paid && row.value ? row.value - row.paid : null;
          const underInsured = row.sumInsured && row.value ? row.sumInsured < row.value * 0.85 : false;
          return (
            <li className="rounded-2xl border border-[var(--border)] bg-white p-4" key={row.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link className="font-bold text-[var(--foreground)] hover:underline" href={`/fleet/${row.id}`}>
                    {row.name}
                  </Link>
                  <p className="text-sm text-[var(--muted)]">{[row.plate, row.mileage ? `${row.mileage.toLocaleString("en-US")} km` : null].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold">{row.value ? money(row.value) : t("notValued")}</p>
                  {row.ownFigure ? <p className="text-xs text-[var(--muted)]">{t("yourFigure")}</p> : null}
                </div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-[var(--foreground-secondary)]">
                {row.valuation ? (
                  <p>
                    {say(row.valuation.count >= 3 ? "estimateFrom" : "estimateRough", {
                      low: money(row.valuation.low),
                      high: money(row.valuation.high),
                      count: row.valuation.count,
                      date: longDate(row.valuation.checked_at.slice(0, 10), locale)
                    })}
                  </p>
                ) : null}
                {!row.hasYear ? <p className="text-[var(--muted)]">{t("addYear")}</p> : null}
                {row.paid ? (
                  <p>
                    {say(row.boughtOn ? "boughtOn" : "bought", { amount: money(row.paid), date: row.boughtOn ? longDate(row.boughtOn, locale) : "" })}
                    {change != null ? (
                      <span className={change >= 0 ? "text-[var(--success)]" : "text-[var(--foreground-secondary)]"}>
                        {" · "}
                        {say(change >= 0 ? "upBy" : "downBy", { amount: money(Math.abs(change)), pct: Math.round((Math.abs(change) / (row.paid || 1)) * 100) })}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {row.sumInsured ? <p className={underInsured ? "font-semibold text-[var(--warning)]" : ""}>{say(underInsured ? "underInsured" : "insuredFor", { amount: money(row.sumInsured) })}</p> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold text-[var(--primary)]">
                <Link href={`/fleet/${row.id}/edit`}>{row.paid ? t("editFigures") : t("addPaid")}</Link>
                {canEstimate && !working ? (
                  <button onClick={() => estimate([row])} type="button">
                    {row.valuation ? t("checkAgain") : t("estimateOne")}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-[var(--muted)]">{t("footnote")}</p>
    </div>
  );
}
