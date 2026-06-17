"use client";

import Chart from "chart.js/auto";
import { useEffect, useRef, useState } from "react";

const thb = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    const revenueData = months.map((_, i) => {
      const item = monthlyPreview?.[i];
      return item?.amount || 0;
    });

    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          {
            label: "Revenue",
            data: revenueData,
            backgroundColor: "rgba(94,234,212,0.65)",
            borderRadius: 2,
            borderSkipped: false,
            barPercentage: 0.75,
            categoryPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(10,15,25,0.95)",
            titleColor: "rgba(255,255,255,0.5)",
            bodyColor: "#ffffff",
            callbacks: {
              label: (context) => ` ฿${Math.round(Number(context.raw)).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              autoSkip: false,
              color: "rgba(255,255,255,0.25)",
              font: { size: 9 },
              maxRotation: 0
            }
          },
          y: { display: false }
        }
      }
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [monthlyPreview]);

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
      <div style={{ position: "relative", height: "56px", width: "100%" }}>
        <canvas id="revBarChart" ref={canvasRef} role="img" aria-label="12 month revenue and expenses bar chart" />
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
