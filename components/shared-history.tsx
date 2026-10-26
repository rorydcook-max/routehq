"use client";

import { MessageSquareQuote, ShieldAlert, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { HistoryReport } from "@/lib/customer-history-kinds";
import { dateFormat } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * What other RouteHQ businesses have reported about this person (shared customer history), with what is needed to
 * judge it: each report in the reporter's own words, who reported it and their track record (how long on RouteHQ,
 * how many rentals, how many customers they have reported), whether it was settled, and the customer's side. A
 * warning to ask about, not a verdict, and the wording says so.
 */
export function SharedHistory({ reports, compact = false }: { reports: HistoryReport[]; compact?: boolean }) {
  const t = useTranslations("history") as unknown as Say;
  const locale = useLocale();
  if (!reports.length) return null;
  const month = (iso: string) => dateFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
  // "28 May 2026", as dates read everywhere else in the app (not the American "May 28").
  const day = (iso: string) => dateFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(iso));
  const live = reports.filter((report) => !report.settledAt);
  const businesses = new Set(live.map((report) => report.business)).size;
  const warn = live.length > 0;

  const list = (
    <ul className="mt-2 space-y-2">
      {reports.map((report) => (
        <li className="rounded-lg border border-[var(--border)] bg-white p-3" key={report.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-bold text-[var(--foreground)]">
              {t(`kind_${report.kind}`)}
              {report.amount ? ` · ฿${Math.round(report.amount).toLocaleString(locale)}` : ""} · {month(report.occurredOn)}
            </p>
            {report.settledAt ? (
              <span className="rounded-full bg-[var(--success-light)] px-2 py-0.5 text-xs font-bold text-[var(--success)]">{t("settled")}</span>
            ) : report.disputed ? (
              <span className="rounded-full bg-[var(--panel-secondary)] px-2 py-0.5 text-xs font-bold text-[var(--foreground-secondary)]">{t("disputed")}</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {t("byBusiness", { business: report.business })}
            {report.businessSince ? ` · ${t("onSince", { date: month(report.businessSince) })}` : ""}
            {` · ${t("rentalsRun", { count: report.businessRentals })}`}
            {` · ${t("customersReported", { count: report.businessReports })}`}
          </p>
          <p className={`mt-1.5 text-sm ${report.summary ? "text-[var(--foreground)]" : "italic text-[var(--muted)]"}`}>{report.summary ? `“${report.summary}”` : t("noSummary")}</p>
          {report.settledAt ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-[var(--success)]">
              <ShieldCheck className="mt-0.5 shrink-0" size={15} />
              <span>
                {t("settledOn", { date: day(report.settledAt) })}
                {report.settledNote ? `: ${report.settledNote}` : ""}
              </span>
            </p>
          ) : null}
          {report.customerResponse ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-[var(--foreground-secondary)]">
              <MessageSquareQuote className="mt-0.5 shrink-0" size={15} />
              <span>
                <span className="font-semibold">{t("customerSide")}</span> “{report.customerResponse}”
              </span>
            </p>
          ) : report.disputed ? (
            <p className="mt-1.5 text-sm font-semibold text-[var(--foreground-secondary)]">{t("disputedHint")}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`${compact ? "mt-2" : "mt-3"} rounded-xl border p-3 ${warn ? "border-[var(--warning)]/40 bg-[var(--warning-light)]" : "border-[var(--border)] bg-[var(--panel-secondary)]"}`} role={warn ? "alert" : undefined}>
      <p className={`flex items-start gap-2 font-bold ${warn ? "text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}`}>
        {warn ? <ShieldAlert className="mt-0.5 shrink-0" size={18} /> : <ShieldCheck className="mt-0.5 shrink-0" size={18} />}
        <span>{warn ? t("title", { count: businesses }) : t("titleSettled", { count: reports.length })}</span>
      </p>
      {compact ? (
        <details className="pl-[26px]">
          <summary className="cursor-pointer text-sm font-bold text-[var(--primary)]">{t("seeWhat")}</summary>
          {list}
        </details>
      ) : (
        list
      )}
      <p className="mt-2 text-xs text-[var(--foreground-secondary)]">{t("hint")}</p>
    </div>
  );
}
