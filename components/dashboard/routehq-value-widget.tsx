"use client";

import { useState } from "react";
import type { RouteHQSavingsData } from "@/lib/value-tracker";

export type { RouteHQSavingsData };

function thb(n: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(n);
}

function TooltipIcon({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative inline-block shrink-0">
      <button
        aria-label="More information"
        className="ml-1 inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border text-[10px]"
        style={{ borderColor: "#0e7490", color: "#0e7490" }}
        onBlur={() => setVisible(false)}
        onClick={() => setVisible((value) => !value)}
        onFocus={() => setVisible(true)}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        title={text}
        type="button"
      >
        i
      </button>
      {visible ? (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-60 -translate-x-1/2 rounded-xl border border-[#e3e6e8] bg-white p-2.5 text-[10px] leading-4 text-[#717d86] shadow-xl">
          {text}
        </span>
      ) : null}
    </span>
  );
}

function MetricRow({
  icon,
  label,
  value,
  tooltip
}: {
  icon: string;
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-[9px]">
        <span
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "7px",
            background: "#ecfeff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          <i className={`ti ${icon}`} style={{ fontSize: "14px", color: "#0e7490" }} aria-hidden="true" />
        </span>
        <span className="flex min-w-0 items-center text-[12px] text-[#454d54]">
          <span className="truncate">{label}</span>
          {tooltip ? <TooltipIcon text={tooltip} /> : null}
        </span>
      </div>
      <span className="shrink-0 text-[16px] font-medium text-[#1a1d21]">{value}</span>
    </div>
  );
}

export function RouteHQValueWidget({ data, className = "" }: { data: RouteHQSavingsData; className?: string }) {
  const tooltipText =
    "We value owner time at \u0E3F200/hr and staff time at \u0E3F72/hr (based on \u0E3F15,000/month, 208 working hours). Calculated based on your fleet size and activity.";

  if (data.isEmpty) {
    return (
      <div
        className={`flex min-h-[180px] flex-col items-center justify-center text-center ${className}`}
        style={{ background: "#ffffff", border: "0.5px solid #e2e8f0", borderRadius: 10, padding: "13px 14px" }}
      >
        <i className="ti ti-clock text-[22px] text-[#0e7490]" aria-hidden="true" />
        <p className="mt-2 max-w-xs text-[12px] leading-5 text-[#717d86]">
          Start recording transactions and bookings to see your RouteHQ savings.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${className}`}
      style={{ background: "#ffffff", border: "0.5px solid #e2e8f0", borderRadius: 10, padding: "13px 14px" }}
    >
      <p className="m-0 mb-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#0e7490]">RouteHQ is saving you</p>

      <div className="flex flex-1 flex-col gap-2">
        <MetricRow icon="ti-clock" label="Time saved this month" value={`${data.totalHoursSaved.toFixed(1)} hrs`} />
        <MetricRow icon="ti-coins" label="That time is worth" tooltip={tooltipText} value={thb(data.timeValueThb)} />
        <MetricRow icon="ti-receipt" label="Direct costs saved" value={thb(data.hardSavingsThb)} />
      </div>

      <div className="my-2.5 h-px bg-[#e3e6e8]" />

      {data.hasPositiveAhead ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#a5f3fc] bg-[#ecfeff] px-[13px] py-[9px]">
          <span className="text-[12px] font-medium text-[#0e7490]">You&apos;re ahead by</span>
          <span className="text-[20px] font-medium tracking-[-0.02em] text-[#0e7490]">
            {thb(data.aheadByThb)}
            <span className="text-[12px] font-normal">/mo</span>
          </span>
        </div>
      ) : (
        <p className="m-0 text-center text-[11px] text-[#717d86]">Keep recording activity to see your full ROI.</p>
      )}

      <p className="m-0 mt-[7px] text-center text-[10px] text-[#717d86]">
        RouteHQ {thb(data.subscriptionCostThb)} · Total value {thb(data.totalValueThb)}/month
      </p>
    </div>
  );
}
