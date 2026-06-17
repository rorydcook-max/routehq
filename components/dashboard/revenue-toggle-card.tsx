"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { ArrowRight, CalendarDays, TrendingUp } from "lucide-react";

function fmt(n: number) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(n);
}

export function RevenueToggleCard({
  monthlyRevenue,
  dailyRevenue,
  monthlyExpenses,
  monthlyPreview,
  label = "Revenue",
  sub = "Rental income and deposits",
  dailySub = "Average per day this month",
  href = "/reports" as Route,
  className = ""
}: {
  monthlyRevenue: number;
  dailyRevenue: number;
  monthlyExpenses?: number;
  monthlyPreview?: Array<{ label: string; amount: number }>;
  label?: string;
  sub?: string;
  dailySub?: string;
  href?: Route;
  className?: string;
}) {
  const [showDaily, setShowDaily] = useState(false);
  const chartMax = Math.max(1, ...(monthlyPreview || []).map((point) => point.amount));
  const chartPoints = monthlyPreview && monthlyPreview.length > 1
    ? monthlyPreview.map((point, index) => {
        const x = (index / (monthlyPreview.length - 1)) * 100;
        const y = 44 - (point.amount / chartMax) * 36;
        return `${x},${y}`;
      }).join(" ")
    : "";

  return (
    <Link className={`kpi-card group relative block overflow-hidden ${className}`} href={href}>
      {/* Toggle button */}
      <button
        aria-label={showDaily ? "Show monthly" : "Show daily"}
        className="pressable absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
        onClick={(e) => { e.preventDefault(); setShowDaily((v) => !v); }}
        title={showDaily ? "Switch to monthly" : "Switch to daily average"}
        type="button"
      >
        {showDaily ? <CalendarDays size={13} /> : <TrendingUp size={13} />}
      </button>

      <div className={monthlyPreview?.length ? "max-w-[58%] pr-3" : "pr-8"}>
        <p className="text-xs font-semibold text-[var(--muted)]">
          {showDaily ? `Daily ${label.toLowerCase()}` : `Monthly ${label.toLowerCase()}`}
        </p>
        <p className="mt-1 text-xl font-black text-[var(--foreground)]">
          {fmt(showDaily ? dailyRevenue : monthlyRevenue)}
        </p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{showDaily ? dailySub : sub}</p>
        {monthlyExpenses !== undefined && !showDaily ? (
          <p className="mt-0.5 text-xs text-[var(--muted)]">Expenses: {fmt(monthlyExpenses)}</p>
        ) : null}
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)] opacity-0 transition-opacity group-hover:opacity-100">
          View reports <ArrowRight size={11} />
        </span>
      </div>

      {monthlyPreview?.length ? (
        <div aria-label="Last 12 months revenue preview" className="pointer-events-none absolute bottom-4 right-4 top-12 w-[36%]">
          <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 48">
            <defs>
              <linearGradient id="revenuePreviewFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
              </linearGradient>
            </defs>
            <polyline
              fill="none"
              points={chartPoints}
              stroke="rgba(255,255,255,0.9)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
            <polygon
              fill="url(#revenuePreviewFill)"
              points={`0,48 ${chartPoints} 100,48`}
            />
            {monthlyPreview.map((point, index) => {
              const x = monthlyPreview.length === 1 ? 100 : (index / (monthlyPreview.length - 1)) * 100;
              const height = Math.max(4, (point.amount / chartMax) * 34);
              return (
                <rect
                  fill="rgba(255,255,255,0.24)"
                  height={height}
                  key={`${point.label}-${index}`}
                  rx="1.6"
                  width="3"
                  x={x - 1.5}
                  y={46 - height}
                />
              );
            })}
          </svg>
        </div>
      ) : null}
    </Link>
  );
}
