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
 * What a new business still has to do, in the order it matters. The first
 * step left is the big button; the rest are a short list under it.
 */
export function OnboardingChecklist({
  completedCount,
  items,
  organizationId,
  totalCount
}: {
  completedCount: number;
  items: ChecklistItem[];
  organizationId: string;
  totalCount: number;
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

  const [next, ...later] = remaining;

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t("setupTitle")}</h2>
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
      {next ? (
        <Link className="primary-action pressable mt-3 w-full" href={next.href as Route}>
          {label(next)}
          <ChevronRight size={18} />
        </Link>
      ) : null}
      {later.length ? (
        <div className="mt-2 space-y-1">
          {later.map((item) => (
            <Link className="pressable flex min-h-11 items-center justify-between gap-3 rounded-xl px-1 font-semibold text-[var(--foreground)]" href={item.href as Route} key={item.step}>
              {label(item)}
              <ChevronRight className="shrink-0 text-[var(--primary)]" size={18} />
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
