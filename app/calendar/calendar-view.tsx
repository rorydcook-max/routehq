"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/lib/i18n/dates";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "@/lib/calendar";

const toneClasses: Record<CalendarEvent["tone"], string> = {
  blue: "bg-[var(--info-light)] text-[var(--info)] border-[var(--info-line)]",
  amber: "bg-[var(--warning-light)] text-[var(--warning)] border-[var(--warning-line)]",
  red: "bg-[var(--danger-light)] text-[var(--danger)] border-[var(--danger-line)]",
  green: "bg-[var(--success-light)] text-[var(--success)] border-[var(--success-line)]",
  purple: "bg-[var(--purple-light)] text-[var(--purple)] border-[var(--purple-line)]"
};

const dotClasses: Record<CalendarEvent["tone"], string> = {
  blue: "bg-[var(--info)]",
  amber: "bg-[var(--warning)]",
  red: "bg-[var(--danger)]",
  green: "bg-[var(--success)]",
  purple: "bg-[var(--purple)]"
};

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string, locale: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function dayLabel(date: string, locale: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", day: "numeric", month: "short" }).format(new Date(year, month - 1, day));
}

/** Sunday to Saturday, as short names in the reader's language. */
function weekdayNames(locale: string) {
  // 4 January 1970 was a Sunday.
  const names = (weekday: "short" | "narrow") => {
    const format = new Intl.DateTimeFormat(intlLocale(locale), { weekday, timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, index) => format.format(new Date(Date.UTC(1970, 0, 4 + index))));
  };
  const short = names("short");
  // Seven columns on a phone leave room for about four letters; some languages' short names are longer.
  return short.some((name) => name.length > 4) ? names("narrow") : short;
}

export function CalendarView({ events, initialMonth, today }: { events: CalendarEvent[]; initialMonth: string; today: string }) {
  const router = useRouter();
  const t = useTranslations("calendar");
  const papers = useTranslations("common");
  const locale = useLocale();
  const month = initialMonth;
  /** An event in the reader's language. Older or unknown kinds keep the title they came with. */
  const titleOf = (event: CalendarEvent) => {
    const words = event.say;
    if (!words || !t.has(`ev_${words.key}`)) return event.title;
    const paper = words.paper ? (papers.has(`paper_${words.paper}`) ? papers(`paper_${words.paper}`) : words.paper) : "";
    return t(`ev_${words.key}`, { subject: words.subject, amount: words.amount || "", paper });
  };

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
        {date === today ? `${t("today")} · ` : ""}
        {dayLabel(date, locale)}
      </p>
      <div className="space-y-1">
        {list.map((event) => (
          <Link className={`block rounded-lg border px-2.5 py-2 text-sm font-medium ${toneClasses[event.tone]}`} href={event.href as any} key={event.id}>
            {titleOf(event)}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="content-section flex items-center justify-between gap-2 lg:justify-center lg:gap-8">
        <button aria-label={t("prevMonth")} className="secondary-action pressable !w-11 !px-0 shrink-0" onClick={() => shiftMonth(-1)} type="button">
          <ChevronLeft size={20} />
        </button>
        <div className="flex min-w-0 flex-col items-center">
          <h2 className="whitespace-nowrap text-[18px] font-bold text-[var(--foreground)]">{monthLabel(month, locale)}</h2>
          {!isCurrentMonth ? (
            <button className="font-bold text-[var(--primary)] underline underline-offset-2" onClick={() => router.push(`/calendar?month=${today.slice(0, 7)}`)} type="button">
              {t("today")}
            </button>
          ) : null}
        </div>
        <button aria-label={t("nextMonth")} className="secondary-action pressable !w-11 !px-0 shrink-0" onClick={() => shiftMonth(1)} type="button">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="content-section">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
          {weekdayNames(locale).map((day) => (
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
                      title={titleOf(event)}
                    >
                      {titleOf(event)}
                    </Link>
                  ))}
                  {dayEvents.length > 3 ? <span className="text-[10px] text-[var(--muted)]">{t("more", { count: dayEvents.length - 3 })}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
        {/* What the dots mean, for phones where a day only has room for dots. */}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)] sm:hidden">
          {([
            ["blue", t("leg_blue")],
            ["amber", t("leg_amber")],
            ["purple", t("leg_purple")],
            ["red", t("leg_red")],
            ["green", t("leg_green")]
          ] as Array<[CalendarEvent["tone"], string]>).map(([tone, label]) => (
            <span className="inline-flex items-center gap-1" key={tone}>
              <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[tone]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="content-section">
        <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">{isCurrentMonth ? t("comingUp") : monthLabel(month, locale)}</p>
        {agenda.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("nothingIn", { month: monthLabel(month, locale) })}</p>
        ) : (
          <div className="space-y-3">
            {comingUp.length === 0 ? <p className="text-sm text-[var(--muted)]">{t("nothingElse")}</p> : comingUp.map(dayGroup)}
            {/* What already happened stays one tap away, so today is the first thing on the list. */}
            {earlier.length > 0 ? (
              <details className="group rounded-lg border border-[var(--border)]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-sm font-semibold text-[var(--foreground-secondary)] [&::-webkit-details-marker]:hidden">
                  {t("earlier", { count: earlier.reduce((sum, [, list]) => sum + list.length, 0) })}
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
