"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Mail, X } from "lucide-react";
import { dismissChecklist } from "@/app/actions/onboarding";
import { sendEmailCheck } from "@/app/actions/auth";

type ChecklistItem = {
  step: string;
  label: string;
  href: string;
  completed: boolean;
};

const PAGE = 3;

/**
 * What a new business still has to do, three steps at a time (Rory, 2 Nov 2026): finish one and the next moves in,
 * or flick to the next three. "Verify your email" sends the link right here.
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
  const [page, setPage] = useState(0);
  const [emailSent, setEmailSent] = useState<"" | "sent" | "failed">("");
  const [sending, startSending] = useTransition();
  const allComplete = completedCount === totalCount;
  const progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const remaining = items.filter((item) => !item.completed);
  const pages = Math.max(1, Math.ceil(remaining.length / PAGE));
  const shown = remaining.slice(page * PAGE, page * PAGE + PAGE);
  const label = (item: ChecklistItem) => (t.has(`setup_${item.step}`) ? t(`setup_${item.step}`) : item.label);

  useEffect(() => {
    if (!allComplete) return;
    const timeout = window.setTimeout(() => setHidden(true), 2400);
    return () => window.clearTimeout(timeout);
  }, [allComplete]);
  useEffect(() => {
    if (page > pages - 1) setPage(pages - 1);
  }, [page, pages]);

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
  const rowClass = (isNext: boolean) =>
    `pressable flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left font-semibold ${isNext ? "bg-[var(--primary-light)] text-[var(--primary)]" : "text-[var(--foreground)] hover:bg-[var(--panel-secondary)]"}`;

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="card-title">{t(firstBookingTaken ? "setupTitleLater" : "setupTitle")}</h2>
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
        <div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500" style={{ width: `${Math.max(progress, 4)}%` }} />
      </div>
      <ol className="mt-3 space-y-1">
        {shown.map((item, index) => {
          const isNext = item === next;
          const number = page * PAGE + index + 1;
          const badge = (
            <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${isNext ? "bg-[var(--primary)] text-white" : "border-2 border-[var(--border)] text-[var(--foreground-secondary)]"}`}>{number}</span>
          );
          if (item.step === "verify_email") {
            return (
              <li key={item.step}>
                <button
                  aria-current={isNext ? "step" : undefined}
                  className={rowClass(isNext)}
                  disabled={sending || emailSent === "sent"}
                  onClick={() =>
                    startSending(async () => {
                      const result = await sendEmailCheck().catch(() => ({ ok: false }));
                      setEmailSent(result.ok ? "sent" : "failed");
                    })
                  }
                  type="button"
                >
                  {badge}
                  <span className="min-w-0 flex-1">
                    {label(item)}
                    <span className="block text-[14px] font-medium text-[var(--foreground-secondary)]">
                      {emailSent === "sent" ? t("setupEmailSent") : emailSent === "failed" ? t("setupEmailFailed") : t("setupEmailHint")}
                    </span>
                  </span>
                  {sending ? <Loader2 className="shrink-0 animate-spin" size={18} /> : <Mail className="shrink-0" size={18} />}
                </button>
              </li>
            );
          }
          return (
            <li key={item.step}>
              <Link aria-current={isNext ? "step" : undefined} className={rowClass(isNext)} href={item.href as Route}>
                {badge}
                <span className="min-w-0 flex-1">{label(item)}</span>
                <ChevronRight className={`shrink-0 ${isNext ? "" : "text-[var(--muted)]"}`} size={18} />
              </Link>
            </li>
          );
        })}
      </ol>
      {pages > 1 ? (
        <div className="mt-2 flex items-center justify-between">
          <button aria-label={t("setupPrev")} className="pressable flex h-10 w-10 items-center justify-center rounded-full text-[var(--foreground-secondary)] disabled:opacity-30" disabled={page === 0} onClick={() => setPage((value) => value - 1)} type="button">
            <ChevronLeft size={20} />
          </button>
          <div aria-hidden="true" className="flex gap-1.5">
            {Array.from({ length: pages }, (_, index) => (
              <span className={`h-2 w-2 rounded-full ${index === page ? "bg-[var(--primary)]" : "bg-[var(--border-strong)]"}`} key={index} />
            ))}
          </div>
          <button aria-label={t("setupNext")} className="pressable flex h-10 w-10 items-center justify-center rounded-full text-[var(--foreground-secondary)] disabled:opacity-30" disabled={page >= pages - 1} onClick={() => setPage((value) => value + 1)} type="button">
            <ChevronRight size={20} />
          </button>
        </div>
      ) : null}
    </section>
  );
}
