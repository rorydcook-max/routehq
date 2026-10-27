"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { longDate, numberLocale } from "@/lib/i18n/dates";
import type { Valuation } from "@/lib/vehicle-valuation";
import { VehicleArt } from "@/components/vehicle-art";
import { VehicleTitle } from "@/components/vehicle-identity";
import type { VehicleKind } from "@/lib/vehicle-groups";

type Say = (key: string, values?: Record<string, string | number>) => string;

export type ValueRow = {
  id: string;
  /** Make, model and version; the year is shown beside it. */
  name: string;
  year: string | number | null;
  colour: string | null;
  model: string | null;
  kind: VehicleKind;
  plate: string;
  hasYear: boolean;
  condition: string | null;
  conditionByDamage: string | null;
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
    const format = new Intl.NumberFormat(numberLocale(locale), { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 });
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
      <section className="card p-5">
        <p className="text-sm font-semibold text-[var(--muted)]">{t("worthNow")}</p>
        {/* Nothing valued yet is not "worth ฿0": say so plainly instead of a zero headline. */}
        {valued > 0 ? (
          <p className="num mt-1 text-4xl leading-tight">{money(worth)}</p>
        ) : (
          <p className="mt-1 text-[26px] font-semibold leading-tight text-[var(--foreground-secondary)]">{t("notEstimatedYet")}</p>
        )}
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
              <button className="btn-primary w-full justify-center sm:w-auto sm:px-6" onClick={() => estimate(toCheck)} type="button">
                {say("estimate", { count: toCheck.length })}
              </button>
            ) : (
              <p className="text-sm text-[var(--muted)]">{t("allChecked")}</p>
            )}
            {failed > 0 && !working ? <p className="mt-2 text-sm font-semibold text-[var(--warning)]">{say("someFailed", { count: failed })}</p> : null}
          </div>
        ) : null}
      </section>

      <ul className="grid gap-3 xl:grid-cols-2">
        {rows.map((row) => {
          const change = row.paid && row.value ? row.value - row.paid : null;
          const underInsured = row.sumInsured && row.value ? row.sumInsured < row.value * 0.85 : false;
          return (
            <li className="card p-4" key={row.id}>
              <div className="flex items-start justify-between gap-3">
                <Link className="group flex min-w-0 items-center gap-3" href={`/fleet/${row.id}`}>
                  <VehicleArt colour={row.colour} kind={row.kind} model={row.model} size="sm" />
                  <span className="min-w-0">
                    <VehicleTitle name={row.name} nameClassName="font-semibold text-[var(--foreground)] group-hover:underline" plate={row.plate} year={row.year} />
                    {row.mileage ? <span className="mt-0.5 block text-sm tabular-nums text-[var(--muted)]">{`${row.mileage.toLocaleString("en-US")} km`}</span> : null}
                  </span>
                </Link>
                <div className="shrink-0 text-right">
                  {row.value ? (
                    <p className="text-[17px] font-semibold tabular-nums">{money(row.value)}</p>
                  ) : (
                    <span className="badge inline-flex items-center bg-[var(--panel-tertiary)] text-[var(--muted)]">{t("notValued")}</span>
                  )}
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
                <p>
                  {row.condition ? say("conditionIs", { condition: t(`cond_${row.condition}`) }) : t("conditionNotSet")}
                  {row.conditionByDamage ? <span className="text-[var(--muted)]"> {say("conditionByDamage", { date: longDate(row.conditionByDamage, locale) })}</span> : null}
                </p>
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
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
                {canEstimate && !working ? (
                  <button className="secondary-action pressable !min-h-9 !px-4 !text-[14px]" onClick={() => estimate([row])} type="button">
                    {row.valuation ? t("checkAgain") : t("estimateOne")}
                  </button>
                ) : null}
                <Link className="text-[var(--primary)] hover:underline" href={`/fleet/${row.id}/edit`}>{row.paid ? t("editFigures") : t("addPaid")}</Link>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="measure text-xs text-[var(--muted)]">{t("footnote")}</p>
    </div>
  );
}
