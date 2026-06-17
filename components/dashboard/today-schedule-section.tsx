"use client";

import Link from "next/link";

type AgendaItem = {
  type: "start" | "end" | "reminder";
  label: string;
  sub: string;
};

function badgeFor(item: AgendaItem) {
  if (item.type === "start") {
    return { label: "Delivery", background: "#ecfeff", color: "#0e7490" };
  }

  if (item.type === "reminder") {
    return { label: "Urgent", background: "#fef2f2", color: "#dc2626" };
  }

  return {
    label: item.sub.toLowerCase().includes("overdue") ? "Overdue" : "Return",
    background: "#fffbeb",
    color: "#d97706"
  };
}

function stripColor(type: AgendaItem["type"]) {
  if (type === "start") return "#0e7490";
  if (type === "end") return "#d97706";
  return "#dc2626";
}

export function TodayScheduleSection({ dateLabel, items }: { dateLabel: string; items: AgendaItem[] }) {
  return (
    <section className="flex flex-col gap-2">
      <div
        style={{
          background:
            "radial-gradient(circle at 78% 12%, rgba(18, 184, 200, 0.25), transparent 32%), linear-gradient(135deg, var(--analytics-panel) 0%, #08264d 100%)",
          borderRadius: "11px",
          padding: "13px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center"
            style={{ background: "rgba(94,234,212,0.12)", borderRadius: 8 }}
          >
            <i className="ti ti-calendar text-[17px]" style={{ color: "#5eead4" }} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[10px] font-medium uppercase tracking-[0.08em] text-white/40">Today&apos;s schedule</p>
            <p className="m-0 truncate text-[15px] font-medium text-white">{dateLabel}</p>
          </div>
        </div>
        <Link className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#5eead4]" href="/calendar">
          Full calendar
          <i className="ti ti-arrow-right text-[11px]" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {items.length === 0 ? (
          <div
            className="col-span-full flex min-h-[66px] items-center justify-center text-center text-[12px] text-[#717d86]"
            style={{ background: "#ffffff", border: "0.5px solid #e2e8f0", borderRadius: "9px", padding: "10px 11px" }}
          >
            Nothing scheduled — clear day.
          </div>
        ) : (
          items.map((item, index) => {
            const badge = badgeFor(item);
            return (
              <div
                className="flex min-w-0 items-center gap-2"
                key={`${item.type}-${item.label}-${index}`}
                style={{ background: "#ffffff", border: "0.5px solid #e2e8f0", borderRadius: "9px", padding: "10px 11px" }}
              >
                <span className="h-9 w-[3px] shrink-0 rounded-sm" style={{ background: stripColor(item.type) }} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[12px] font-medium text-[#1a1d21]">{item.label}</p>
                  <p className="mb-[3px] mt-0.5 truncate text-[11px] text-[#717d86]">{item.sub}</p>
                  <span
                    className="inline-block rounded-full px-[7px] py-px text-[10px] font-medium"
                    style={{ background: badge.background, color: badge.color }}
                  >
                    {badge.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
