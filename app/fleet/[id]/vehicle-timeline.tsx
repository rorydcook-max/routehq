"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { longDate } from "@/lib/i18n/dates";

export type VehicleTimelineEvent = {
  id: string;
  title: string;
  detail?: string | null;
  date: string;
  kind: "activity" | "compliance" | "reminder" | "rental";
};

type RangePreset = "year" | "quarter" | "all" | "custom";
type Say = (key: string, values?: Record<string, string | number>) => string;

function toDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function presetStart(preset: Exclude<RangePreset, "custom">, endDate: string) {
  if (preset === "all") return "";
  const start = new Date(`${endDate}T00:00:00`);
  if (preset === "quarter") start.setMonth(start.getMonth() - 3);
  else start.setFullYear(start.getFullYear() - 1);
  return toDateInput(start);
}

/** One colour per kind of event, the same meanings as elsewhere: renewals amber, rentals coming back blue. */
const KIND_COLOUR: Record<VehicleTimelineEvent["kind"], string> = {
  activity: "var(--primary)",
  compliance: "var(--warning)",
  reminder: "var(--going-out)",
  rental: "var(--coming-back)"
};

/** What has happened with this vehicle, newest first. */
export function VehicleTimeline({ events, defaultFrom, defaultTo }: { events: VehicleTimelineEvent[]; defaultFrom: string; defaultTo: string }) {
  const say = useTranslations("vehiclePage") as unknown as Say;
  const locale = useLocale();
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
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
  }, [events, from, to]);

  const days = useMemo(() => {
    const groups: Array<{ key: string; events: VehicleTimelineEvent[] }> = [];
    for (const event of visibleEvents) {
      const key = String(event.date).slice(0, 10);
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.events.push(event);
      else groups.push({ key, events: [event] });
    }
    return groups;
  }, [visibleEvents]);

  function changePreset(nextPreset: RangePreset) {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      setTo(defaultTo);
      setFrom(presetStart(nextPreset, defaultTo));
    }
  }

  const presets: Array<{ key: RangePreset; label: string }> = [
    { key: "quarter", label: say("tl_3m") },
    { key: "year", label: say("tl_12m") },
    { key: "all", label: say("tl_all") },
    { key: "custom", label: say("tl_custom") }
  ];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {presets.map((item) => (
          <button
            aria-pressed={preset === item.key}
            className={`min-h-[40px] rounded-full px-4 font-bold ${preset === item.key ? "bg-[var(--primary)] text-white" : "bg-[var(--panel-secondary)] text-[var(--foreground)]"}`}
            key={item.key}
            onClick={() => changePreset(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {preset === "custom" ? (
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="font-semibold text-[var(--foreground-secondary)]">{say("tl_from")}</span>
            <input className="mt-1 w-full" max={to} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
          </label>
          <label className="block">
            <span className="font-semibold text-[var(--foreground-secondary)]">{say("tl_to")}</span>
            <input className="mt-1 w-full" min={from} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
          </label>
        </div>
      ) : null}

      {visibleEvents.length === 0 ? (
        <p className="py-4 font-medium text-[var(--foreground-secondary)]">{say("tl_empty")}</p>
      ) : (
        <div className="grid gap-4">
          {days.map((day) => (
            <section key={day.key}>
              <h3 className="mb-2 font-bold text-[var(--muted)]">
                <time dateTime={day.key}>{longDate(day.key, locale)}</time>
              </h3>
              <ol className="relative ml-[7px] border-l-2 border-[var(--border)] pl-5">
                {day.events.map((event) => (
                  <li className="relative pb-3 last:pb-0" key={event.id}>
                    <span aria-hidden="true" className="absolute -left-[28px] top-[5px] h-3.5 w-3.5 rounded-full shadow-[0_0_0_3px_#fff]" style={{ background: KIND_COLOUR[event.kind] }} />
                    <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{event.title}</p>
                    {event.detail ? <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{/^\d{4}-\d{2}-\d{2}$/.test(event.detail) ? longDate(event.detail, locale) : event.detail}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
