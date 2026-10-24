"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Megaphone } from "lucide-react";
import { fileCustomerReport, settleCustomerReport, withdrawCustomerReport } from "@/app/actions/customer-reports";
import { REPORT_KINDS } from "@/lib/customer-history-kinds";

export type OwnReport = {
  id: string;
  kind: string;
  amount: number | null;
  occurred_on: string;
  rental_label: string;
  summary: string | null;
  settled_at: string | null;
  settled_note: string | null;
  customer_response: string | null;
  disputed: boolean;
};
export type ReportableRental = { id: string; label: string };
type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * "Warn other RouteHQ businesses" about a rental that ended badly, and the reports this business has already filed
 * about the customer. A report carries the business's name and its own account of what happened, so other businesses
 * can judge it; it can be marked settled when the customer puts it right, or withdrawn if it was a mistake.
 */
export function ReportToOthers({ customerId, reports, rentals, canReport }: { customerId: string; reports: OwnReport[]; rentals: ReportableRental[]; canReport: boolean }) {
  const t = useTranslations("history") as unknown as Say;
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [rentalId, setRentalId] = useState(rentals[0]?.id || "");
  const [kind, setKind] = useState<string>("unpaid_rent");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [settling, setSettling] = useState<string | null>(null);
  const [settleNote, setSettleNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const month = (iso: string) => new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

  const submit = () =>
    start(async () => {
      setError("");
      const data = new FormData();
      Object.entries({ customerId, rentalId, kind, amount, occurredOn, summary, notes, confirm: confirm ? "yes" : "" }).forEach(([key, value]) => data.set(key, value));
      const result = await fileCustomerReport(data);
      if (!result.ok) return setError(result.error);
      setOpen(false);
      setAmount("");
      setSummary("");
      setNotes("");
      setConfirm(false);
    });

  const withdraw = (reportId: string) =>
    start(async () => {
      const data = new FormData();
      data.set("reportId", reportId);
      const result = await withdrawCustomerReport(data);
      if (!result.ok) setError(result.error);
    });

  const settle = (reportId: string) =>
    start(async () => {
      const data = new FormData();
      data.set("reportId", reportId);
      data.set("note", settleNote);
      const result = await settleCustomerReport(data);
      if (!result.ok) return setError(result.error);
      setSettling(null);
      setSettleNote("");
    });

  return (
    <div>
      {reports.length ? (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
          <p className="text-sm font-bold text-[var(--foreground)]">{t("ownTitle")}</p>
          <ul className="mt-2 space-y-2">
            {reports.map((report) => (
              <li className="rounded-lg bg-white p-2.5 text-sm" key={report.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-bold text-[var(--foreground)]">
                    {t(`kind_${report.kind}`)}
                    {report.amount ? ` · ฿${Math.round(report.amount).toLocaleString(locale)}` : ""} · {month(report.occurred_on)}
                  </span>
                  {report.settled_at ? <span className="text-xs font-bold text-[var(--success)]">{t("settled")}</span> : report.disputed ? <span className="text-xs font-bold text-[var(--foreground-secondary)]">{t("disputed")}</span> : null}
                </div>
                {report.rental_label ? <p className="text-[var(--muted)]">{report.rental_label}</p> : null}
                <p className={`mt-1 ${report.summary ? "text-[var(--foreground-secondary)]" : "italic text-[var(--muted)]"}`}>{report.summary ? `“${report.summary}”` : t("ownNoSummary")}</p>
                {report.settled_at && report.settled_note ? <p className="mt-1 font-semibold text-[var(--success)]">{report.settled_note}</p> : null}
                {report.customer_response ? (
                  <p className="mt-1 text-[var(--foreground-secondary)]">
                    <span className="font-semibold">{t("customerSide")}</span> “{report.customer_response}”
                  </p>
                ) : null}
                {canReport && !report.settled_at ? (
                  settling === report.id ? (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input className="w-full flex-1" maxLength={300} onChange={(event) => setSettleNote(event.target.value)} placeholder={t("settlePlaceholder")} value={settleNote} />
                      <button className="pressable min-h-10 rounded-full bg-[var(--success)] px-4 font-bold text-white disabled:opacity-60" disabled={pending} onClick={() => settle(report.id)} type="button">
                        {t("settleSave")}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-x-4">
                      <button className="tap-target font-bold text-[var(--primary)] underline" disabled={pending} onClick={() => setSettling(report.id)} type="button">
                        {t("settle")}
                      </button>
                      <button className="tap-target font-bold text-[var(--muted)] underline" disabled={pending} onClick={() => withdraw(report.id)} type="button">
                        {t("withdraw")}
                      </button>
                    </div>
                  )
                ) : null}
              </li>
            ))}
          </ul>
          {!open && error ? <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
        </div>
      ) : null}

      {!canReport || !rentals.length ? null : !open ? (
        <button className="tap-target mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--warning)]" onClick={() => setOpen(true)} type="button">
          <Megaphone size={15} />
          {t("add")}
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
          <p className="font-bold text-[var(--foreground)]">{t("formTitle")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{t("formHint")}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("what")}</span>
              <select className="mt-1 w-full" onChange={(event) => setKind(event.target.value)} value={kind}>
                {REPORT_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {t(`kind_${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("rental")}</span>
              <select className="mt-1 w-full" onChange={(event) => setRentalId(event.target.value)} value={rentalId}>
                {rentals.map((rental) => (
                  <option key={rental.id} value={rental.id}>
                    {rental.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("amount")}</span>
              <input className="mt-1 w-full" inputMode="numeric" onChange={(event) => setAmount(event.target.value)} placeholder="0" value={amount} />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("when")}</span>
              <input className="mt-1 w-full" onChange={(event) => setOccurredOn(event.target.value)} type="date" value={occurredOn} />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("summary")}</span>
            <textarea className="mt-1 w-full" maxLength={600} onChange={(event) => setSummary(event.target.value)} placeholder={t("summaryPlaceholder")} rows={3} value={summary} />
            <span className="mt-0.5 block text-xs text-[var(--muted)]">{t("summaryHint")}</span>
          </label>
          <label className="mt-3 block">
            <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("notes")}</span>
            <input className="mt-1 w-full" maxLength={1000} onChange={(event) => setNotes(event.target.value)} placeholder={t("notesPlaceholder")} value={notes} />
          </label>
          <label className="mt-3 flex items-start gap-2.5 text-sm font-semibold text-[var(--foreground)]">
            <input checked={confirm} className="mt-0.5 h-5 w-5 shrink-0" onChange={(event) => setConfirm(event.target.checked)} type="checkbox" />
            <span>{t("confirm")}</span>
          </label>
          {error ? <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button className="pressable min-h-11 flex-1 rounded-full bg-[var(--warning)] px-3 font-bold text-white disabled:opacity-60" disabled={pending || !rentalId || !confirm || summary.trim().length < 20} onClick={submit} type="button">
              {t("send")}
            </button>
            <button className="secondary-action pressable flex-1" onClick={() => setOpen(false)} type="button">
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
