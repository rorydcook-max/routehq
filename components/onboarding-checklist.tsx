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

/** Slim setup card: progress plus only the steps still to do, each worded as something to do ("Invite a team member"). */
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

  useEffect(() => {
    if (!allComplete) return;
    const timeout = window.setTimeout(() => setHidden(true), 2400);
    return () => window.clearTimeout(timeout);
  }, [allComplete]);

  if (hidden) return null;

  if (allComplete) {
    return (
      <section className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)]">
        <CheckCircle2 className="text-[var(--success)]" size={20} />
        <p className="text-sm text-[var(--foreground-secondary)]">
          {t.rich("setupComplete", { b: (chunks) => <span className="font-semibold text-[var(--foreground)]">{chunks}</span> })}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-[var(--foreground)]">{t("setupTitle")}</h2>
            <span className="text-[13px] text-[var(--muted)]">{t("setupProgress", { done: completedCount, total: totalCount })}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eeece7]">
            <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <form action={dismissChecklist}>
          <input name="organizationId" type="hidden" value={organizationId} />
          <button aria-label={t("setupHide")} className="pressable rounded-lg p-1.5 text-[var(--muted)] hover:bg-[#f1efeb]" title={t("setupHide")} type="submit">
            <X size={16} />
          </button>
        </form>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {remaining.map((item) => (
          <Link className="pressable inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[#fbfaf8] px-3 py-1.5 text-[13px] font-semibold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]" href={item.href as Route} key={item.step}>
            {t.has(`setup_${item.step}`) ? t(`setup_${item.step}`) : item.label}
            <ChevronRight size={14} />
          </Link>
        ))}
      </div>
    </section>
  );
}
