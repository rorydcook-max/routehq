"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, ChevronRight, X } from "lucide-react";
import { dismissChecklist } from "@/app/actions/onboarding";

type ChecklistItem = {
  step: string;
  label: string;
  href: string;
  completed: boolean;
};

/**
 * What a new business still has to do, in the order it matters, as one
 * numbered list with the next step highlighted.
 */
export function OnboardingChecklist({
  completedCount,
  items,
  organizationId,
  totalCount,
  firstBookingTaken = false
}: {
  completedCount: number;
  items: ChecklistItem[];
  organizationId: string;
  totalCount: number;
  /** Once a booking exists the card is about finishing off, not about getting ready. */
  firstBookingTaken?: boolean;
}) {
  const t = useTranslations("shell");
  const [hidden, setHidden] = useState(false);
  const allComplete = completedCount === totalCount;
  const progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const remaining = items.filter((item) => !item.completed);
  const label = (item: ChecklistItem) => (t.has(`setup_${item.step}`) ? t(`setup_${item.step}`) : item.label);

  useEffect(() => {
    if (!allComplete) return;
    const timeout = window.setTimeout(() => setHidden(true), 2400);
    return () => window.clearTimeout(timeout);
  }, [allComplete]);

  if (hidden) return null;

  if (allComplete) {
    return (
      <section className="card flex items-center gap-3 p-4">
        <CheckCircle2 className="shrink-0 text-[var(--success)]" size={22} />
        <p className="font-medium text-[var(--foreground-secondary)]">{t.rich("setupComplete", { b: (chunks) => <span className="font-bold text-[var(--foreground)]">{chunks}</span> })}</p>
      </section>
    );
  }

  const next = remaining[0];

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t(firstBookingTaken ? "setupTitleLater" : "setupTitle")}</h2>
          <p className="font-medium text-[var(--foreground-secondary)]">{t("setupProgress", { done: completedCount, total: totalCount })}</p>
        </div>
        <form action={dismissChecklist}>
          <input name="organizationId" type="hidden" value={organizationId} />
          <button aria-label={t("setupHide")} className="pressable flex h-11 w-11 items-center justify-center rounded-full text-[var(--foreground-secondary)]" title={t("setupHide")} type="submit">
            <X size={20} />
          </button>
        </form>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--panel-secondary)]">
        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(progress, 4)}%` }} />
      </div>
      {/* One list, one pattern: the steps left, the next one highlighted. Done steps are counted in the bar above. */}
      <ol className="mt-3 space-y-1">
        {remaining.map((item, index) => {
          // Numbered 1, 2, 3 among the steps left: a done step in the middle no longer leaves a gap (3, 4, 5, 7).
          const isNext = item === next;
          return (
            <li key={item.step}>
              <Link
                aria-current={isNext ? "step" : undefined}
                className={`pressable flex min-h-11 items-center gap-3 rounded-xl px-2.5 py-1.5 font-semibold ${
                  isNext
                    ? "bg-[var(--primary-light)] text-[var(--primary)]"
                    : item.completed
                      ? "text-[var(--muted)]"
                      : "text-[var(--foreground)] hover:bg-[var(--panel-secondary)]"
                }`}
                href={item.href as Route}
              >
                {item.completed ? (
                  <CheckCircle2 className="shrink-0 text-[var(--success)]" size={22} />
                ) : (
                  <span
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                      isNext ? "bg-[var(--primary)] text-white" : "border-2 border-[var(--border)] text-[var(--foreground-secondary)]"
                    }`}
                  >
                    {index + 1}
                  </span>
                )}
                <span className={`min-w-0 flex-1 ${item.completed ? "line-through decoration-[var(--border)]" : ""}`}>{label(item)}</span>
                {item.completed ? null : <ChevronRight className={`shrink-0 ${isNext ? "" : "text-[var(--muted)]"}`} size={18} />}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
