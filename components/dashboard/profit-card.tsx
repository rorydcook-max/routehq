"use client";

import { useState } from "react";

const thb = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);

export function ProfitCard({
  monthlyProfit,
  dailyProfit,
  bestMonthProfit = 0,
  avgMonthProfit = 0
}: {
  monthlyProfit: number;
  dailyProfit: number;
  bestMonthProfit?: number;
  avgMonthProfit?: number;
}) {
  const [mode, setMode] = useState<"monthly" | "daily">("monthly");
  const isMonthly = mode === "monthly";
  const value = isMonthly ? monthlyProfit : dailyProfit;
  const isNegative = value < 0;

  return (
    <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: 11, padding: "15px 16px" }}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="m-0 text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
          {isMonthly ? "Profit this month" : "Profit today (avg)"}
        </p>
        <button
          className="flex cursor-pointer items-center gap-1 rounded-md border px-2 py-[3px] text-[10px] font-medium text-[#5eead4]"
          onClick={() => setMode(isMonthly ? "daily" : "monthly")}
          style={{ background: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" }}
          type="button"
        >
          <i className="ti ti-refresh text-[10px]" aria-hidden="true" />
          {isMonthly ? "Daily" : "Monthly"}
        </button>
      </div>
      <p className="m-0 text-[26px] font-medium tracking-[-0.03em]" style={{ color: isNegative ? "#f09595" : "#5eead4" }}>
        {thb(value)}
      </p>
      <p className="m-0 mb-2.5 text-[11px] text-white/35">
        {isMonthly ? "Revenue minus all costs" : "Average profit per day this month"}
      </p>
      <div
        className="flex items-center gap-2 rounded-[7px] px-2.5 py-[7px]"
        style={{
          background: isNegative ? "rgba(226,75,74,0.1)" : "rgba(94,234,212,0.1)",
          border: `0.5px solid ${isNegative ? "rgba(226,75,74,0.2)" : "rgba(94,234,212,0.2)"}`
        }}
      >
        <i className={`ti ${isNegative ? "ti-alert-triangle" : "ti-trending-up"} text-[12px]`} style={{ color: isNegative ? "#f09595" : "#5eead4" }} aria-hidden="true" />
        <span className="text-[11px]" style={{ color: isNegative ? "#f09595" : "#5eead4" }}>
          {isNegative ? "Expenses exceed revenue" : "Fleet is profitable this month"}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-[7px] bg-white/[0.05] px-2.5 py-[7px] text-center">
          <p className="m-0 text-[10px] text-white/30">Best month</p>
          <p className="m-0 text-[13px] font-medium text-[#5eead4]">{thb(bestMonthProfit)}</p>
        </div>
        <div className="rounded-[7px] bg-white/[0.05] px-2.5 py-[7px] text-center">
          <p className="m-0 text-[10px] text-white/30">12-mo avg</p>
          <p className="m-0 text-[13px] font-medium text-white/60">{thb(avgMonthProfit)}</p>
        </div>
      </div>
    </div>
  );
}
