import Link from "next/link";
import type { Route } from "next";
import type { CSSProperties, ReactNode } from "react";
import { intlLocale } from "@/lib/i18n/dates";

// Small pictures that say one thing at a glance: a ring, a week planner, a pair of bars.
// Colours carry one meaning each (see "Look G" in globals.css).

export function Ring({ pct, label, size = 80, stroke = 10, color = "var(--on-rent)", track = "var(--primary-light)" }: { pct: number; label: string; size?: number; stroke?: number; color?: string; track?: string }) {
  const r = (size - stroke) / 2;
  const shown = Math.max(0, Math.min(100, pct));
  return (
    <span className="relative inline-block flex-shrink-0" style={{ height: size, width: size }}>
      <svg aria-hidden="true" height={size} viewBox={`0 0 ${size} ${size}`} width={size}>
        <circle cx={size / 2} cy={size / 2} fill="none" r={r} stroke={track} strokeWidth={stroke} />
        {shown > 0 ? (
          <circle className="ring-draw" cx={size / 2} cy={size / 2} fill="none" pathLength={100} r={r} stroke={color} strokeDasharray={`${shown} 100`} strokeLinecap="round" strokeWidth={stroke} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
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
        <div className="relative flex border-b border-[var(--border)] pb-2 lg:pb-2.5">
          <span className="w-[var(--lane-name)] flex-shrink-0" />
          {days.map((day, index) => (
            <span className={`flex-1 text-center font-bold leading-tight ${index === 0 ? "text-[var(--primary)]" : "text-[var(--muted)]"}`} key={day.key}>
              {day.name}
              <span className={`num mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[16px] ${index === 0 ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]"}`}>{day.number}</span>
            </span>
          ))}
        </div>
        <ul className="relative">
          {lanes.map((lane, index) => (
            <li className={`flex h-[46px] items-center lg:h-[42px] ${index < lanes.length - 1 ? "border-b border-[var(--border)]" : ""}`} key={lane.id}>
              <Link className="flex w-[var(--lane-name)] min-w-0 flex-shrink-0 items-center gap-1.5 pr-1 hover:underline" href={lane.href as Route}>
                <Dot color={lane.paint} size={9} />
                <span className="truncate font-bold text-[var(--foreground)]">{lane.name}</span>
              </Link>
              <span className="relative h-full flex-1">
                {lane.bars.map((bar) => (
                  <Link
                    className={`planner-bar grow-x absolute top-2 flex h-[30px] items-center whitespace-nowrap rounded-[10px] px-2 font-bold shadow-[0_2px_6px_rgba(19,38,43,0.12)] lg:top-[6px] ${BAR_STYLE[bar.kind]}`}
                    href={bar.href as Route}
                    key={`${bar.href}-${bar.start}`}
                    style={{ left: `calc(${(bar.start / 7) * 100}% + 2px)`, width: `calc(${(bar.length / 7) * 100}% - 4px)`, ["--d" as string]: `${160 + index * 60}ms` } as CSSProperties}
                    data-tip={bar.title}
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
        <div className="chart-col relative flex flex-1 flex-col items-center gap-1 pt-1" data-tip={`${period.label}: ${money(period.in)} in, ${money(period.out)} out`} key={period.key} tabIndex={0}>
          <div className="chart-bars flex h-[82px] w-full items-end justify-center gap-[2px] border-b border-[var(--border)]">
            <span className="grow-y w-1/2 max-w-5 rounded-t-[4px] bg-[var(--chart-in)]" style={{ height: `${Math.max(2, Math.round((period.in / max) * 80))}px` }} />
            <span className="grow-y w-1/2 max-w-5 rounded-t-[4px] bg-[var(--chart-out)]" style={{ height: `${Math.max(2, Math.round((period.out / max) * 80))}px` }} />
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
      <span className="tile-title">{title}</span>
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
        {paidTo ? <span className="grow-x absolute inset-y-0 left-0 rounded-full bg-[var(--success)]" style={{ width: `${at(paidTo)}%` }} /> : null}
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
      <span className="grow-x block h-full rounded-full" style={{ background: color, width: `${pct}%` }} />
    </span>
  );
}

/** Two letters for an avatar. Thai words can start with a vowel sign written first (เ แ โ ใ ไ): the consonant is the letter. */
export function initialsOf(name: string | null | undefined) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => Array.from(word.replace(/^[\u0E40-\u0E44]+/, ""))[0] || Array.from(word)[0] || "").join("").toUpperCase() || "?";
}

export type LotState = "late" | "back" | "rent" | "out" | "free" | "off";
export type LotVehicle = { id: string; name: string; art: ReactNode; state: LotState; tip: string; href: string };

const LOT_COLOUR: Record<LotState, string> = {
  late: "var(--danger)",
  back: "var(--coming-back)",
  rent: "var(--on-rent)",
  out: "var(--going-out)",
  free: "var(--success)",
  off: "var(--border-strong)"
};
const LOT_ORDER: LotState[] = ["late", "back", "out", "rent", "free", "off"];

/** The fleet as a car park: every vehicle drawn in its own colour, with a bar under it saying what it is doing. Point at one for who has it and until when. */
export function FleetLot({ vehicles, labels, title, action, compact = false }: { vehicles: LotVehicle[]; labels: Record<LotState, string>; title: string; action?: ReactNode; compact?: boolean }) {
  const sorted = [...vehicles].sort((a, b) => LOT_ORDER.indexOf(a.state) - LOT_ORDER.indexOf(b.state));
  const counts = LOT_ORDER.map((state) => ({ state, count: vehicles.filter((vehicle) => vehicle.state === state).length })).filter((entry) => entry.count > 0);
  return (
    <section className="card rise p-4 lg:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-[20px] text-[var(--foreground)] lg:text-[22px]">{title}</h2>
        {action}
      </header>
      {/* How the fleet splits, as one bar: the same colours as the cars below. */}
      <div aria-hidden="true" className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[var(--panel-tertiary)]">
        {counts.map((entry, index) => (
          <span className={`grow-x ${index > 0 ? "border-l-2 border-white" : ""}`} key={entry.state} style={{ background: LOT_COLOUR[entry.state], width: `${(entry.count / vehicles.length) * 100}%` }} />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-semibold text-[var(--foreground-secondary)]">
        {counts.map((entry) => (
          <span className="inline-flex items-center gap-1.5" key={entry.state}>
            <Dot color={LOT_COLOUR[entry.state]} />
            <span className="num text-[var(--foreground)]">{entry.count}</span> {labels[entry.state]}
          </span>
        ))}
      </p>
      <ul className={`mt-4 grid grid-cols-4 gap-x-2 gap-y-3 ${compact ? "" : "sm:grid-cols-6 xl:grid-cols-8"}`}>
        {sorted.map((vehicle, index) => (
          <li className="rise" key={vehicle.id} style={{ ["--d" as string]: `${200 + index * 35}ms` } as CSSProperties}>
            <Link aria-label={vehicle.tip} className="lot-spot group relative flex flex-col items-center gap-1.5 rounded-2xl p-1.5 outline-none transition hover:bg-[var(--panel-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" data-tip={vehicle.tip} href={vehicle.href as Route}>
              <span className={`transition duration-200 group-hover:-translate-y-0.5 ${compact ? "" : "lg:scale-110"} ${vehicle.state === "off" ? "opacity-50 grayscale" : ""}`}>{vehicle.art}</span>
              <span className="h-1.5 w-10 rounded-full" style={{ background: LOT_COLOUR[vehicle.state] }} />
              <span className="w-full truncate text-center font-semibold text-[var(--foreground)]">{vehicle.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type StripPayment = { key: string; state: "paid" | "owed" | "today" | "later"; tip: string };
const STRIP_STYLE: Record<StripPayment["state"], string> = {
  paid: "bg-[var(--success)]",
  owed: "bg-[var(--danger)]",
  today: "bg-[var(--going-out)]",
  later: "bg-[var(--panel-tertiary)] shadow-[inset_0_0_0_2px_var(--border-strong)]"
};

/** Every rent payment of a booking as one row of blocks, in date order: paid, owed, due today, still to come. Point at one for its date and amount. */
export function PaymentStrip({ payments, legend }: { payments: StripPayment[]; legend: Record<StripPayment["state"], string> }) {
  if (payments.length === 0) return null;
  const shown = payments.slice(0, 36);
  const present = (["paid", "owed", "today", "later"] as const).filter((state) => payments.some((payment) => payment.state === state));
  return (
    <div>
      <div className="flex gap-[3px]">
        {shown.map((payment, index) => (
          <span
            className={`grow-y relative h-7 min-w-[6px] flex-1 rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${STRIP_STYLE[payment.state]}`}
            data-tip={payment.tip}
            key={payment.key}
            style={{ ["--d" as string]: `${Math.min(index, 20) * 25}ms` } as CSSProperties}
            tabIndex={0}
          />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-semibold text-[var(--foreground-secondary)]">
        {present.map((state) => (
          <span className="inline-flex items-center gap-1.5" key={state}>
            <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-[3px] ${STRIP_STYLE[state]}`} />
            {legend[state]} <span className="num text-[var(--foreground)]">{payments.filter((payment) => payment.state === state).length}</span>
          </span>
        ))}
      </p>
    </div>
  );
}

/** A small line of how a number moved, oldest first. Point at a point for its value. Below zero shows under a dashed line. */
export function Spark({ points, label, color = "var(--chart-in)" }: { points: Array<{ key: string; value: number; tip: string }>; label: string; color?: string }) {
  if (points.length < 2) return null;
  const width = 100;
  const height = 40;
  const values = points.map((point) => point.value);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  const x = (index: number) => (index / (points.length - 1)) * width;
  const y = (value: number) => height - 3 - ((value - min) / span) * (height - 6);
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)} ${y(point.value).toFixed(2)}`).join(" ");
  const step = 100 / (points.length - 1);
  return (
    <span aria-label={label} className="relative mt-3 block h-14" role="img" style={{ color }}>
      <svg aria-hidden="true" className="wipe absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
        <path d={`${line} L${width} ${height} L0 ${height} Z`} fill="currentColor" fillOpacity={0.12} />
        {min < 0 ? <line stroke="var(--border-strong)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" x1={0} x2={width} y1={y(0)} y2={y(0)} /> : null}
        <path d={line} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      </svg>
      {points.map((point, index) => (
        <span className={`spark-hit ${index === points.length - 1 ? "last" : ""}`} data-tip={point.tip} key={point.key} style={{ left: `calc(${index * step}% - ${step / 2}%)`, width: `${step}%` }} tabIndex={0}>
          <span className="spark-dot" style={{ top: `${(y(point.value) / height) * 100}%` }} />
        </span>
      ))}
    </span>
  );
}

/** A date as a calendar leaf: the month on a coloured strip, the day large, the weekday under it. */
export function DateLeaf({ date, locale, tone = "var(--on-rent)" }: { date: string; locale: string; tone?: string }) {
  const day = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return null;
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(locale), { ...options, timeZone: "UTC" }).format(day);
  return (
    <span className="inline-flex w-[50px] flex-shrink-0 flex-col sm:w-[66px] overflow-hidden rounded-xl bg-white text-center shadow-[0_1px_3px_rgba(19,38,43,0.14)]" title={format({ weekday: "long", day: "numeric", month: "long", year: "numeric" })}>
      <span className="py-0.5 text-[14px] font-bold text-white" style={{ background: tone }}>{format({ month: "short" })}</span>
      <span className="num pt-1 text-[20px] leading-none text-[var(--foreground)] sm:text-[24px]">{day.getUTCDate()}</span>
      <span className="pb-1 text-[14px] font-semibold text-[var(--muted)]">{format({ weekday: "short" })}</span>
    </span>
  );
}
