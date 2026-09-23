"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useState } from "react";

const thb = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function RevenueTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value?: number }> }) {
  if (!active || !payload?.length) return null;
  const value = Math.round(Number(payload[0]?.value ?? 0));
  return (
    <div
      style={{
        background: "rgba(10,15,25,0.95)",
        color: "#ffffff",
        borderRadius: 6,
        padding: "4px 8px",
        fontSize: 11
      }}
    >
      {`\u0e3f${value.toLocaleString()}`}
    </div>
  );
}

export function RevenueCard({
  monthlyRevenue,
  dailyRevenue,
  monthlyExpenses,
  monthlyPreview
}: {
  monthlyRevenue: number;
  dailyRevenue: number;
  monthlyExpenses: number;
  monthlyPreview: Array<{ label: string; amount: number }>;
}) {
  const [mode, setMode] = useState<"monthly" | "daily">("monthly");

  const chartData = MONTH_LABELS.map((month, i) => ({
    month,
    amount: monthlyPreview?.[i]?.amount || 0
  }));

  const isMonthly = mode === "monthly";

  return (
    <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #002B66 0%, #1F6BFF 100%)', borderRadius: 11, padding: "15px 16px" }}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="m-0 text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">
          {isMonthly ? "Revenue this month" : "Revenue today (avg)"}
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
      <p className="m-0 mb-px text-[26px] font-medium tracking-[-0.03em] text-white">{thb(isMonthly ? monthlyRevenue : dailyRevenue)}</p>
      <p className="m-0 mb-2 text-[11px] text-white/35">
        {isMonthly ? `Expenses ${thb(monthlyExpenses)} this month` : "Average revenue per day this month"}
      </p>
      <div style={{ position: "relative", height: "56px", width: "100%" }} role="img" aria-label="12 month revenue and expenses bar chart">
        <ResponsiveContainer width="100%" height={56} minWidth={0} initialDimension={{ width: 320, height: 56 }}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barCategoryGap="20%">
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 9 }}
            />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip cursor={false} content={<RevenueTooltip />} />
            <Bar dataKey="amount" fill="rgba(94,234,212,0.65)" radius={[2, 2, 2, 2]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1.5 flex gap-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-white/35">
          <span className="h-1.5 w-1.5 rounded-[1px] bg-[#5eead4]" />
          Revenue
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-white/35">
          <span className="h-1.5 w-1.5 rounded-[1px] bg-[rgba(226,75,74,0.8)]" />
          Expenses
        </span>
      </div>
    </div>
  );
}
