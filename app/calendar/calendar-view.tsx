"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/lib/calendar";

const toneClasses: Record<CalendarEvent["tone"], string> = {
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  amber: "bg-amber-100 text-amber-900 border-amber-200",
  red: "bg-red-100 text-red-800 border-red-200",
  green: "bg-emerald-100 text-emerald-900 border-emerald-200",
  purple: "bg-purple-100 text-purple-900 border-purple-200"
};

const dotClasses: Record<CalendarEvent["tone"], string> = {
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  green: "bg-emerald-500",
  purple: "bg-purple-500"
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function dayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(year, month - 1, day));
}

export function CalendarView({ events, initialMonth, today }: { events: CalendarEvent[]; initialMonth: string; today: string }) {
  const router = useRouter();
  const month = initialMonth;

  const days = useMemo(() => {
    const [year, monthIndex] = month.split("-").map(Number);
    const first = new Date(year, monthIndex - 1, 1);
    const last = new Date(year, monthIndex, 0);
    const pad = first.getDay();
    const cells: Array<{ date: string | null; label: string }> = [];
    for (let i = 0; i < pad; i++) cells.push({ date: null, label: "" });
    for (let day = 1; day <= last.getDate(); day += 1) {
      const date = `${year}-${String(monthIndex).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ date, label: String(day) });
    }
    return cells;
  }, [month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const list = map.get(event.date) || [];
      list.push(event);
      map.set(event.date, list);
    });
    return map;
  }, [events]);

  function shiftMonth(delta: number) {
    const [year, monthIndex] = month.split("-").map(Number);
    const next = new Date(year, monthIndex - 1 + delta, 1);
    router.push(`/calendar?month=${monthKey(next)}`);
  }

  const isCurrentMonth = today.slice(0, 7) === month;
  const agenda = Array.from(eventsByDate.entries()).sort(([a], [b]) => a.localeCompare(b));

  // This month: lead with today; other months: the whole month in order.
  const earlier = isCurrentMonth ? agenda.filter(([date]) => date < today) : [];
  const comingUp = isCurrentMonth ? agenda.filter(([date]) => date >= today) : agenda;
  const dayGroup = ([date, list]: [string, typeof events]) => (
    <div className="scroll-mt-4" id={`day-${date}`} key={date}>
      <p className={`mb-1 text-xs font-bold uppercase tracking-wide ${date === today ? "text-[var(--primary)]" : "text-[var(--muted)]"}`}>
        {date === today ? "Today · " : ""}
        {dayLabel(date)}
      </p>
      <div className="space-y-1">
        {list.map((event) => (
          <Link className={`block rounded-lg border px-2.5 py-2 text-sm font-medium ${toneClasses[event.tone]}`} href={event.href as any} key={event.id}>
            {event.title}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="content-section flex items-center justify-between gap-2">
        <button aria-label="Previous month" className="secondary-action pressable" onClick={() => shiftMonth(-1)} type="button">
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{monthLabel(month)}</h2>
          {!isCurrentMonth ? (
            <button className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-bold text-[var(--primary)]" onClick={() => router.push(`/calendar?month=${today.slice(0, 7)}`)} type="button">
              Today
            </button>
          ) : null}
        </div>
        <button aria-label="Next month" className="secondary-action pressable" onClick={() => shiftMonth(1)} type="button">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="content-section">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((cell, index) => {
            const dayEvents = cell.date ? eventsByDate.get(cell.date) || [] : [];
            const isToday = cell.date === today;
            return (
              <div
                key={index}
                className={`min-h-[52px] rounded-lg p-1 sm:min-h-[72px] ${
                  cell.date ? `border bg-[var(--panel)] ${isToday ? "border-[var(--primary)] ring-1 ring-[var(--primary)]" : "border-[var(--border)]"}` : ""
                }`}
              >
                {cell.label ? (
                  <span className={`text-xs font-semibold ${isToday ? "rounded-full bg-[var(--primary)] px-1.5 text-white" : "text-[var(--foreground-secondary)]"}`}>
                    {cell.label}
                  </span>
                ) : null}
                {/* Phones: coloured dots; the list below has the details. */}
                <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                  {dayEvents.slice(0, 6).map((event) => (
                    <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[event.tone]}`} key={event.id} />
                  ))}
                </div>
                <div className="mt-1 hidden space-y-0.5 sm:block">
                  {dayEvents.slice(0, 3).map((event) => (
                    <Link
                      key={event.id}
                      href={event.href as any}
                      className={`block truncate rounded border px-1 py-0.5 text-[10px] font-medium ${toneClasses[event.tone]}`}
                      title={event.title}
                    >
                      {event.title}
                    </Link>
                  ))}
                  {dayEvents.length > 3 ? <span className="text-[10px] text-[var(--muted)]">+{dayEvents.length - 3} more</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="content-section">
        <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">{isCurrentMonth ? "Today and coming up" : monthLabel(month)}</p>
        {agenda.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing scheduled in {monthLabel(month)}.</p>
        ) : (
          <div className="space-y-3">
            {comingUp.length === 0 ? <p className="text-sm text-[var(--muted)]">Nothing else scheduled this month.</p> : comingUp.map(dayGroup)}
            {/* What already happened stays one tap away, so today is the first thing on the list. */}
            {earlier.length > 0 ? (
              <details className="group rounded-lg border border-[var(--border)]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold text-[var(--foreground-secondary)] [&::-webkit-details-marker]:hidden">
                  Earlier this month · {earlier.reduce((sum, [, list]) => sum + list.length, 0)}
                  <ChevronRight className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90" size={16} />
                </summary>
                <div className="space-y-3 border-t border-[var(--border)] p-3">{earlier.map(dayGroup)}</div>
              </details>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
