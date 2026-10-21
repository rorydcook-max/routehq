"use client";

import { clsx } from "clsx";
import Link from "next/link";
import type { Route } from "next";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type SubscriptionPayload = {
  organization?: {
    subscription_status?: string | null;
    trial_ends_at?: string | null;
  } | null;
  daysRemaining?: number | null;
};

const dismissKey = "routehq_trial_banner_dismissed_until";

function toneForDays(days: number | null | undefined) {
  if (days === null || days === undefined || days > 7) {
    return {
      className: "border-[var(--info-line)] bg-[var(--primary-light)] text-[var(--primary)]",
      dot: "bg-[var(--primary)]",
      button: "bg-[var(--primary)] text-white"
    };
  }

  if (days >= 3) {
    return {
      className: "border-[var(--warning-line)] bg-[var(--warning-light)] text-[var(--warning)]",
      dot: "bg-[var(--warning)]",
      button: "bg-[var(--warning)] text-white"
    };
  }

  return {
    className: "border-[var(--danger-line)] bg-[var(--danger-light)] text-[var(--danger)]",
    dot: "bg-[var(--danger)] animate-pulse",
    button: "bg-[var(--danger)] text-white"
  };
}

export function TrialBanner({ placement = "floating" }: { placement?: "floating" | "sidebar" | "inline" }) {
  const t = useTranslations("shell");
  const [payload, setPayload] = useState<SubscriptionPayload | null>(null);
  const [hidden, setHidden] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    const dismissedUntil = Number(window.localStorage.getItem(dismissKey) || 0);
    if (dismissedUntil > Date.now()) {
      return;
    }

    fetch("/api/subscription/status", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.organization?.subscription_status === "trial") {
          setPayload(data);
          setHidden(false);
        }
      })
      .catch(() => null);
  }, []);

  // Never over a form: handovers and the create/edit screens keep their
  // buttons at the bottom of the screen, where the banner floats on phones.
  const onForm = !!pathname && (pathname.startsWith("/inspections") || /\/(new|edit)(\/|$)/.test(pathname));
  const days = payload?.daysRemaining;
  // Phones have no room to spare: the reminder stays on the dashboard until the last week.
  const lastWeek = days !== null && days !== undefined && days <= 7;
  // While it floats, the page gets extra room at the end so the last row and its buttons can scroll
  // up from underneath it (globals.css reads this flag).
  const floating = placement === "floating" && !hidden && !!payload?.organization && !onForm && lastWeek;
  useEffect(() => {
    if (!floating) return;
    document.body.dataset.trialBanner = "1";
    return () => {
      delete document.body.dataset.trialBanner;
    };
  }, [floating]);

  // The sidebar copy sits in the page flow, so it never covers anything.
  if (hidden || !payload?.organization || (onForm && placement === "floating")) {
    return null;
  }
  // Phones: floating (and on every page) only in the last week; before that it is a quiet line at the end of the dashboard.
  if (placement === "floating" && !lastWeek) return null;
  if (placement === "inline" && (lastWeek || pathname !== "/")) return null;
  const tone = toneForDays(days);

  return (
    // Floats over the page instead of sitting above it: it loads after the page,
    // and pushing everything down at that moment made people tap the wrong thing.
    <div
      className={clsx(
        placement === "inline"
          ? "mt-4 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 lg:hidden"
          : placement === "sidebar"
          ? // Desktop: one line in the sidebar, above the account card; the line is the link.
            "mt-3 hidden items-center justify-between gap-2 rounded-lg border px-2.5 py-2 lg:flex"
          : // Phones: a slim tab docked on top of the bottom menu (one strip, not a floating card), so it
            // reads as part of the menu and covers as little of the page as possible.
            "fixed bottom-[calc(86px+env(safe-area-inset-bottom))] left-6 right-6 z-[29] flex items-center justify-between gap-2 rounded-t-xl border border-b-0 px-3 py-1 lg:hidden",
        tone.className
      )}
      role="status"
    >
      {placement === "sidebar" ? (
        <Link className="flex min-w-0 items-center gap-2 hover:underline" href={"/settings/billing" as Route}>
          <span aria-hidden="true" className={clsx("h-2 w-2 shrink-0 rounded-full", tone.dot)} />
          <span className="whitespace-nowrap text-xs font-bold leading-4">{t("trialLeft", { days: days === null || days === undefined ? 30 : days })}</span>
        </Link>
      ) : (
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={clsx("h-2 w-2 shrink-0 rounded-full", tone.dot)} />
          <p className="whitespace-nowrap text-xs font-bold leading-4">
            {t("trialLeft", { days: days === null || days === undefined ? 30 : days })}
          </p>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-2">
        {placement === "sidebar" ? null : (
          <Link className={clsx("pressable inline-flex items-center justify-center rounded-lg px-3 text-[11px] font-bold", placement === "floating" ? "min-h-8" : "min-h-8", tone.button)} href={"/settings/billing" as Route}>
            {t("subscribeNow")}
          </Link>
        )}
        <button
          aria-label={t("close")}
          className={clsx("pressable inline-flex items-center justify-center rounded-lg border border-current/15 bg-white/70", "h-8 w-8")}
          onClick={() => {
            window.localStorage.setItem(dismissKey, String(Date.now() + 24 * 60 * 60 * 1000));
            setHidden(true);
          }}
          type="button"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
