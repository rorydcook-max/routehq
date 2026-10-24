"use client";

import { ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { HistorySignal } from "@/lib/customer-history-kinds";

/**
 * What other RouteHQ businesses have reported about this person (shared customer history): one line per kind of
 * problem, with the amount, the latest month and how many businesses. Nothing about who reported it. A signal to
 * ask about, not proof, and the wording says so.
 */
export function SharedHistory({ signals, compact = false }: { signals: HistorySignal[]; compact?: boolean }) {
  const t = useTranslations("history") as unknown as (key: string, values?: Record<string, string | number>) => string;
  const locale = useLocale();
  if (!signals.length) return null;
  const month = (iso: string) => new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const businesses = Math.max(...signals.map((signal) => signal.reporters));
  return (
    <div className={`${compact ? "mt-2" : "mt-3"} rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-light)] p-3`} role="alert">
      <p className="flex items-start gap-2 font-bold text-[var(--warning)]">
        <ShieldAlert className="mt-0.5 shrink-0" size={18} />
        <span>{t("title", { count: businesses })}</span>
      </p>
      <ul className="mt-1.5 space-y-0.5 pl-[26px] text-sm font-semibold text-[var(--foreground)]">
        {signals.map((signal) => (
          <li key={signal.kind}>
            {t(`kind_${signal.kind}`)}
            {signal.amount ? ` · ฿${Math.round(signal.amount).toLocaleString(locale)}` : ""}
            {` · ${month(signal.latest)}`}
            {signal.reports > 1 ? ` · ${t("times", { count: signal.reports })}` : ""}
          </li>
        ))}
      </ul>
      {compact ? null : <p className="mt-1.5 pl-[26px] text-xs text-[var(--foreground-secondary)]">{t("hint")}</p>}
    </div>
  );
}
