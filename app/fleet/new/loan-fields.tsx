"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MoneyInput } from "@/components/money-input";
import { loanFigures, type VehicleLoan } from "@/lib/vehicle-loan";

/**
 * Loan on the vehicle: four amounts and the months, with the totals worked out as you type (Rory, 31 Oct 2026).
 * Used on the add and edit vehicle forms; the server works the same figures out again on save (lib/vehicle-loan.ts).
 */
export function LoanFields({ currency, loan }: { currency: string; loan?: VehicleLoan | null }) {
  const t = useTranslations("vehicleForm");
  const start = loanFigures(loan);
  const str = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(v));
  const [sale, setSale] = useState(str(loan?.sale_price));
  const [down, setDown] = useState(str(loan?.down_payment));
  const [monthly, setMonthly] = useState(str(loan?.monthly_payment));
  const [term, setTerm] = useState(str(loan?.term_months));
  const [left, setLeft] = useState(str(start.monthsLeftNow ?? ""));

  const f = loanFigures({
    sale_price: sale ? Number(sale) : null,
    down_payment: down ? Number(down) : null,
    monthly_payment: monthly ? Number(monthly) : null,
    term_months: term ? Number(term) : null,
    months_left: left ? Number(left) : term ? Number(term) : null
  });
  const money = (n: number | null) =>
    n === null ? "–" : new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(Math.round(n));
  const label = "font-semibold text-[var(--foreground-secondary)]";
  const monthsInput = (name: string, value: string, set: (v: string) => void, placeholder?: string) => (
    <input
      className="mt-1 w-full"
      inputMode="numeric"
      min="0"
      name={name}
      onChange={(e) => set(e.target.value.replace(/[^0-9]/g, ""))}
      placeholder={placeholder}
      type="text"
      value={value}
    />
  );
  const showSummary = f.totalCost !== null || f.stillToPay !== null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>{t("loanSalePrice")}</span>
          <MoneyInput currency={currency} defaultValue={sale} name="loanSalePrice" onValueChange={setSale} />
        </label>
        <label className="block">
          <span className={label}>{t("loanDownPayment")}</span>
          <MoneyInput currency={currency} defaultValue={down} name="loanDownPayment" onValueChange={setDown} />
        </label>
        <label className="block">
          <span className={label}>{t("loanMonthly")}</span>
          <MoneyInput currency={currency} defaultValue={monthly} name="loanMonthlyPayment" onValueChange={setMonthly} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>{t("loanTermMonths")}</span>
            {monthsInput("loanTermMonths", term, setTerm)}
          </label>
          <label className="block">
            <span className={label}>{t("loanMonthsLeft")}</span>
            {monthsInput("loanMonthsLeft", left, setLeft, term)}
          </label>
        </div>
      </div>

      {showSummary ? (
        <dl className="grid gap-x-4 gap-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted,white)] p-3 text-sm sm:grid-cols-2">
          {f.borrowed !== null ? <Row label={t("loanBorrowed")} value={money(f.borrowed)} /> : null}
          {f.totalCost !== null ? <Row label={t("loanTotalCost")} value={money(f.totalCost)} strong /> : null}
          {f.interest !== null ? (
            <Row
              label={t("loanInterest")}
              value={f.flatRatePerYear !== null && f.interest > 0 ? `${money(f.interest)} · ${t("loanFlatRate", { rate: f.flatRatePerYear.toFixed(1) })}` : money(f.interest)}
            />
          ) : null}
          {f.stillToPay !== null ? <Row label={t("loanStillToPay")} value={money(f.stillToPay)} strong /> : null}
        </dl>
      ) : null}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="text-[var(--foreground-secondary)]">{label}</dt>
      <dd className={strong ? "font-bold" : "font-semibold"}>{value}</dd>
    </div>
  );
}
