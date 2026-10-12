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
    <div aria-label={label} className={`mt-3 flex h-[108px] items-end ${periods.length > 7 ? "gap-1" : "gap-3"}`} role="img">
      {periods.map((period) => (
        <div className="flex flex-1 flex-col items-center gap-1" key={period.key}>
          <div className="flex h-[82px] w-full items-end justify-center gap-[2px] border-b border-[var(--border)]">
            <span className="w-1/2 max-w-5 rounded-t-[4px] bg-[var(--chart-in)]" style={{ height: `${Math.max(2, Math.round((period.in / max) * 80))}px` }} title={`${period.label}: ${money(period.in)}`} />
            <span className="w-1/2 max-w-5 rounded-t-[4px] bg-[var(--chart-out)]" style={{ height: `${Math.max(2, Math.round((period.out / max) * 80))}px` }} title={`${period.label}: ${money(period.out)}`} />
          </div>
          <span className={`whitespace-nowrap font-semibold text-[var(--muted)] ${periods.length > 7 ? "text-[13px]" : ""}`}>{period.label}</span>
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

/** A rental from start to end: how far it is paid, where today is, and when the next rent falls due. */
export function RentalTrack({
  start,
  end,
  today,
  paidTo,
  dueOn,
  dueOwed,
  labels
}: {
  start: string;
  end: string;
  today: string;
  paidTo: string | null;
  dueOn: string | null;
  dueOwed: boolean;
  labels: { start: string; end: string; today: string; paid: string | null; due: string | null };
}) {
  const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
  const span = Math.max(1, day(end) - day(start));
  const at = (iso: string) => Math.max(0, Math.min(100, ((day(iso) - day(start)) / span) * 100));
  const showToday = today >= start.slice(0, 10) && today <= end.slice(0, 10);
  return (
    <div>
      <div className={`relative mx-1.5 h-3.5 rounded-full bg-[var(--panel-tertiary)] ${showToday ? "mt-7" : "mt-1"}`}>
        {paidTo ? <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--success)]" style={{ width: `${at(paidTo)}%` }} /> : null}
        {dueOn ? (
          <span
            aria-hidden="true"
            className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_3px_#fff] ${dueOwed ? "bg-[var(--danger)]" : "bg-[var(--foreground-secondary)]"}`}
            style={{ left: `${at(dueOn)}%` }}
          />
        ) : null}
        {showToday ? (
          <span className="absolute -top-7 bottom-[-4px] flex -translate-x-1/2 flex-col items-center" style={{ left: `${at(today)}%` }}>
            <span className="whitespace-nowrap rounded-full bg-[var(--foreground)] px-2 text-[13px] font-bold leading-5 text-white">{labels.today}</span>
            <span className="w-[3px] flex-1 rounded-full bg-[var(--foreground)]" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 flex justify-between gap-3 font-semibold text-[var(--foreground-secondary)]">
        <span>{labels.start}</span>
        <span>{labels.end}</span>
      </p>
      {labels.paid || labels.due ? (
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-semibold text-[var(--foreground-secondary)]">
          {labels.paid ? <span className="inline-flex items-center gap-1.5"><Dot color="var(--success)" />{labels.paid}</span> : null}
          {labels.due ? <span className={`inline-flex items-center gap-1.5 ${dueOwed ? "font-bold text-[var(--danger)]" : ""}`}><Dot color={dueOwed ? "var(--danger)" : "var(--foreground-secondary)"} />{labels.due}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

/** Part of a whole, as one bar: rent paid out of rent agreed. */
export function PartBar({ part, whole, color = "var(--success)" }: { part: number; whole: number; color?: string }) {
  const pct = whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0;
  return (
    <span aria-hidden="true" className="mt-2 block h-2.5 overflow-hidden rounded-full bg-[var(--panel-tertiary)]">
      <span className="block h-full rounded-full" style={{ background: color, width: `${pct}%` }} />
    </span>
  );
}

/** Two letters for an avatar. Thai words can start with a vowel sign written first (เ แ โ ใ ไ): the consonant is the letter. */
export function initialsOf(name: string | null | undefined) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => Array.from(word.replace(/^[\u0E40-\u0E44]+/, ""))[0] || Array.from(word)[0] || "").join("").toUpperCase() || "?";
}
