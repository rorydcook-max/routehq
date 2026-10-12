import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

// Small pictures that say one thing at a glance: a ring, a week planner, a pair of bars.
// Colours carry one meaning each (see "Look G" in globals.css).

export function Ring({ pct, label, size = 80, stroke = 10, color = "var(--on-rent)", track = "var(--primary-light)" }: { pct: number; label: string; size?: number; stroke?: number; color?: string; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, pct));
  return (
    <span className="relative inline-block flex-shrink-0" style={{ height: size, width: size }}>
      <svg aria-hidden="true" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle cx={size / 2} cy={size / 2} fill="none" r={r} stroke={track} strokeWidth={stroke} />
        {shown > 0 ? (
          <circle cx={size / 2} cy={size / 2} fill="none" r={r} stroke={color} strokeDasharray={`${((c * shown) / 100).toFixed(1)} ${c.toFixed(1)}`} strokeLinecap="round" strokeWidth={stroke} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null}
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-[18px] text-[var(--foreground)]">{label}</span>
    </span>
  );
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <span aria-hidden="true" className="inline-block flex-shrink-0 rounded-full" style={{ background: color, height: size, width: size }} />;
}

export type PlannerBar = { start: number; length: number; label: string; kind: "rent" | "next" | "late"; back?: boolean; href: string; title: string };
export type PlannerLane = { id: string; name: string; paint: string; href: string; bars: PlannerBar[] };

const BAR_STYLE: Record<PlannerBar["kind"], string> = {
  rent: "bg-[var(--on-rent)] text-white",
  next: "bg-[var(--going-out)] text-[#13262b]",
  late: "bg-[var(--danger)] text-white"
};

/** Seven days across, one lane per vehicle: who has it, and when it changes hands. */
export function WeekPlanner({ days, lanes, legend }: { days: Array<{ key: string; name: string; number: number }>; lanes: PlannerLane[]; legend: Array<{ color: string; label: string }> }) {
  return (
    <div>
      <div className="relative [--lane-name:84px] sm:[--lane-name:132px]">
        {/* Today's column, so the eye starts in the right place. */}
        <span aria-hidden="true" className="absolute bottom-0 top-0 rounded-xl bg-[var(--panel-secondary)]" style={{ left: "var(--lane-name)", width: "calc((100% - var(--lane-name)) / 7)" }} />
        <div className="relative flex border-b border-[var(--border)] pb-2">
          <span className="w-[var(--lane-name)] flex-shrink-0" />
          {days.map((day, index) => (
            <span className={`flex-1 text-center font-bold leading-tight ${index === 0 ? "text-[var(--primary)]" : "text-[var(--muted)]"}`} key={day.key}>
              {day.name}
              <span className={`num block text-[16px] ${index === 0 ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>{day.number}</span>
            </span>
          ))}
        </div>
        <ul className="relative">
          {lanes.map((lane, index) => (
            <li className={`flex h-[46px] items-center ${index < lanes.length - 1 ? "border-b border-[var(--border)]" : ""}`} key={lane.id}>
              <Link className="flex w-[var(--lane-name)] min-w-0 flex-shrink-0 items-center gap-1.5 pr-1 hover:underline" href={lane.href as Route}>
                <Dot color={lane.paint} size={9} />
                <span className="truncate font-bold text-[var(--foreground)]">{lane.name}</span>
              </Link>
              <span className="relative h-full flex-1">
                {lane.bars.map((bar) => (
                  <Link
                    className={`absolute top-2 flex h-[30px] items-center overflow-hidden whitespace-nowrap rounded-[10px] px-2 font-bold ${BAR_STYLE[bar.kind]}`}
                    href={bar.href as Route}
                    key={`${bar.href}-${bar.start}`}
                    style={{ left: `calc(${(bar.start / 7) * 100}% + 2px)`, width: `calc(${(bar.length / 7) * 100}% - 4px)` }}
                    title={bar.title}
                  >
                    <span className="truncate">{bar.label}</span>
                    {bar.back ? <span aria-hidden="true" className="absolute right-1 top-[9px] h-3 w-3 rounded-full bg-[var(--coming-back)] shadow-[0_0_0_2px_#fff]" /> : null}
                  </Link>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 pt-2.5 font-semibold text-[var(--foreground-secondary)]">
        {legend.map((item) => (
          <span className="inline-flex items-center gap-1.5" key={item.label}><Dot color={item.color} />{item.label}</span>
        ))}
      </p>
    </div>
  );
}

/** Money in against money out, a pair of bars per period. */
export function InOutBars({ periods, label, money }: { periods: Array<{ key: string; label: string; in: number; out: number }>; label: string; money: (value: number) => string }) {
  const max = Math.max(1, ...periods.flatMap((period) => [period.in, period.out]));
  return (
    <div aria-label={label} className="mt-3 flex h-[108px] items-end gap-3" role="img">
      {periods.map((period) => (
        <div className="flex flex-1 flex-col items-center gap-1" key={period.key}>
          <div className="flex h-[82px] w-full items-end justify-center gap-[2px] border-b border-[var(--border)]">
            <span className="w-1/2 max-w-5 rounded-t-[4px] bg-[var(--chart-in)]" style={{ height: `${Math.max(2, Math.round((period.in / max) * 80))}px` }} title={`${period.label}: ${money(period.in)}`} />
            <span className="w-1/2 max-w-5 rounded-t-[4px] bg-[var(--chart-out)]" style={{ height: `${Math.max(2, Math.round((period.out / max) * 80))}px` }} title={`${period.label}: ${money(period.out)}`} />
          </div>
          <span className="whitespace-nowrap font-semibold text-[var(--muted)]">{period.label}</span>
        </div>
      ))}
    </div>
  );
}

export function TileHead({ title, icon }: { title: string; icon?: ReactNode }) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span className="text-[15px] font-bold">{title}</span>
      {icon}
    </span>
  );
}
