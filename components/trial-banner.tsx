"use client";

import { clsx } from "clsx";
import Link from "next/link";
import type { Route } from "next";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
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
      className: "border-[#a7edf4] bg-[var(--primary-light)] text-[#087887]",
      dot: "bg-[var(--primary)]",
      button: "bg-[var(--primary)] text-white"
    };
  }

  if (days >= 3) {
    return {
      className: "border-[#fde68a] bg-[var(--warning-light)] text-[#b45309]",
      dot: "bg-[var(--warning)]",
      button: "bg-[var(--warning)] text-white"
    };
  }

  return {
    className: "border-[#fecaca] bg-[var(--danger-light)] text-[var(--danger)]",
    dot: "bg-[var(--danger)] animate-pulse",
    button: "bg-[var(--danger)] text-white"
  };
}

export function TrialBanner() {
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

  // Never over a handover: the inspection form keeps its buttons at the bottom of the screen.
  if (hidden || !payload?.organization || pathname?.startsWith("/inspections")) {
    return null;
  }

  const days = payload.daysRemaining;
  const tone = toneForDays(days);

  return (
    // Floats over the page instead of sitting above it: it loads after the page,
    // and pushing everything down at that moment made people tap the wrong thing.
    <div
      className={clsx(
        "fixed bottom-4 left-1/2 z-40 flex w-[min(560px,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2 rounded-lg border px-3 py-2 shadow-lg sm:min-h-10 sm:flex-row sm:items-center sm:justify-between",
        tone.className
      )}
      role="status"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className={clsx("h-2 w-2 rounded-full", tone.dot)} />
        <div>
          <p className="text-xs font-bold leading-4">
            Your free trial ends in {days === null || days === undefined ? "30 days" : `${days} day${days === 1 ? "" : "s"}`}
          </p>
          <p className="text-[11px] font-medium leading-4 opacity-80">Keep building your fleet data now. Billing can be activated manually when you are ready.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link className={clsx("pressable inline-flex min-h-7 items-center justify-center rounded-lg px-3 text-[11px] font-bold", tone.button)} href={"/settings/billing" as Route}>
          Subscribe now
        </Link>
        <button
          aria-label="Dismiss trial banner"
          className="pressable inline-flex h-7 w-7 items-center justify-center rounded-lg border border-current/15 bg-white/70"
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
