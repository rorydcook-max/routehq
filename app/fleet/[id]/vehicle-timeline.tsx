"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Clock, History, ShieldCheck } from "lucide-react";

export type VehicleTimelineEvent = {
  id: string;
  title: string;
  detail?: string | null;
  date: string;
  kind: "activity" | "compliance" | "reminder" | "rental";
};

type RangePreset = "year" | "quarter" | "all" | "custom";

const iconByKind = {
  activity: History,
  compliance: ShieldCheck,
  reminder: Clock,
  rental: CalendarDays
};

function formatTimelineDate(value: string) {
  return new Intl.DateTimeFormat("en-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function toDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function presetStart(preset: Exclude<RangePreset, "custom">, endDate: string) {
  if (preset === "all") {
    return "";
  }

  const start = new Date(`${endDate}T00:00:00`);
  if (preset === "quarter") {
    start.setMonth(start.getMonth() - 3);
  } else {
    start.setFullYear(start.getFullYear() - 1);
  }
  return toDateInput(start);
}

export function VehicleTimeline({
  events,
  defaultFrom,
  defaultTo
}: {
  events: VehicleTimelineEvent[];
  defaultFrom: string;
  defaultTo: string;
}) {
  const [preset, setPreset] = useState<RangePreset>("year");
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const visibleEvents = useMemo(() => {
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;

    return events
      .filter((event) => {
        const eventTime = new Date(event.date).getTime();
        return Number.isFinite(eventTime) && eventTime >= fromTime && eventTime <= toTime;
      })
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  }, [events, from, to]);

  function changePreset(nextPreset: RangePreset) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      setTo(defaultTo);
      setFrom(presetStart(nextPreset, defaultTo));
    }
  }

  return (
    <section className="surface-panel overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="card-header-label">Vehicle timeline</p>
          <h2 className="card-header-title">Operational history</h2>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            {visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"} from {from ? formatTimelineDate(from) : "the beginning"} to {formatTimelineDate(to)}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-40">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Period</span>
            <select className="mt-1 w-full" onChange={(event) => changePreset(event.target.value as RangePreset)} value={preset}>
              <option value="year">Previous 12 months</option>
              <option value="quarter">Previous 3 months</option>
              <option value="all">All events</option>
              <option value="custom">Custom period</option>
            </select>
          </label>

          {preset === "custom" ? (
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">From</span>
                <input className="mt-1 w-full" max={to} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
              </label>
              <label>
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">To</span>
                <input className="mt-1 w-full" min={from} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
              </label>
            </div>
          ) : null}
        </div>
      </div>

      {visibleEvents.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
          No events fall within this period. Choose a wider or custom date range to see more history.
        </div>
      ) : (
        <div className="overflow-x-auto px-3 pb-3 pt-4">
          <ol className="relative flex min-w-max pb-2">
            <span aria-hidden="true" className="absolute left-8 right-8 top-[49px] h-px bg-[var(--border-strong)]" />
            {visibleEvents.map((event) => {
              const Icon = iconByKind[event.kind];
              return (
                <li className="relative w-64 shrink-0 px-2" key={event.id}>
                  <time className="block h-8 text-center text-[11px] font-semibold text-[var(--muted)]">
                    {formatTimelineDate(event.date)}
                  </time>
                  <span className="relative z-10 mx-auto flex h-7 w-7 items-center justify-center rounded-full border-4 border-white bg-[var(--primary)] text-white shadow-sm">
                    <Icon aria-hidden="true" size={12} />
                  </span>
                  <article className="mt-3 min-h-28 rounded-lg border border-[var(--border)] bg-white p-3">
                    <p className="line-clamp-2 text-[13px] font-semibold text-[var(--foreground)]">{event.title}</p>
                    {event.detail ? <p className="mt-2 line-clamp-3 text-[12px] leading-5 text-[var(--foreground-secondary)]">{event.detail}</p> : null}
                  </article>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
