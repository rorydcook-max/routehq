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

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-TH", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function CalendarView({ events, initialMonth }: { events: CalendarEvent[]; initialMonth: string }) {
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

  return (
    <div className="space-y-4">
      <div className="content-section flex items-center justify-between">
        <button className="secondary-action pressable" onClick={() => shiftMonth(-1)} type="button">
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-lg font-black text-[var(--foreground)]">{monthLabel(month)}</h2>
        <button className="secondary-action pressable" onClick={() => shiftMonth(1)} type="button">
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
            return (
              <div
                key={index}
                className={`min-h-[64px] rounded-lg p-1 ${cell.date ? "bg-[var(--panel)] border border-[var(--border)]" : ""}`}
              >
                {cell.label && (
                  <span className="text-xs font-semibold text-[var(--foreground-secondary)]">{cell.label}</span>
                )}
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map((event) => (
                    <Link
                      key={event.id}
                      href={event.href as any}
                      className={`block truncate rounded border px-1 py-0.5 text-[10px] font-medium ${toneClasses[event.tone]}`}
                    >
                      {event.title}
                    </Link>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-[var(--muted)]">+{dayEvents.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
