"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell, ChevronLeft, ChevronRight, FileWarning, KeyRound, RotateCcw, Wallet, Wrench } from "lucide-react";
import { intlLocale } from "@/lib/i18n/dates";
import type { CalendarEvent } from "@/lib/calendar";

export type AgendaView = "day" | "week" | "month" | "custom";

/** Colour says what kind of thing it is; red is only for something late. */
const TONE: Record<CalendarEvent["tone"], { chip: string; dot: string; icon: string }> = {
  blue: { chip: "border-l-[var(--going-out)]", dot: "bg-[var(--going-out)]", icon: "bg-[var(--accent-light)] text-[#8a5a12]" },
  amber: { chip: "border-l-[var(--coming-back)]", dot: "bg-[var(--coming-back)]", icon: "bg-[var(--coming-back-light)] text-[var(--coming-back-ink)]" },
  red: { chip: "border-l-[var(--danger)]", dot: "bg-[var(--danger)]", icon: "bg-[var(--danger-light)] text-[var(--danger)]" },
  green: { chip: "border-l-[var(--success)]", dot: "bg-[var(--success)]", icon: "bg-[var(--success-light)] text-[var(--success)]" },
  purple: { chip: "border-l-[var(--foreground-secondary)]", dot: "bg-[var(--foreground-secondary)]", icon: "bg-[var(--panel-tertiary)] text-[var(--foreground)]" }
};

const ICON: Record<CalendarEvent["type"], (size: number) => ReactNode> = {
  rental_start: (size) => <KeyRound size={size} />,
  rental_end: (size) => <RotateCcw size={size} />,
  rental_due: (size) => <RotateCcw size={size} />,
  payment: (size) => <Wallet size={size} />,
  compliance: (size) => <FileWarning size={size} />,
  maintenance: (size) => <Wrench size={size} />,
  custom: (size) => <Bell size={size} />,
  task: (size) => <Bell size={size} />
};

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const fmt = (locale: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", ...options });
const asDate = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * What is happening, by day: handovers, returns, payments, renewals and jobs.
 * Day, week (the next seven days), month, or any stretch of days. Used on the
 * dashboard (a week) and on the calendar page (a month).
 */
export function AgendaCalendar({
  events,
  today,
  covers,
  defaultView = "week",
  initialAnchor,
  initialUntil,
  fullCalendarHref = "/calendar",
  storageKey,
  autoLoad = false,
  roomy = false,
  carryLate = true,
  action
}: {
  events: CalendarEvent[];
  /** Late items (an overdue return, an unpaid payment) listed under today as well as on their own day. The dashboard has its own Today list, so it turns this off. */
  carryLate?: boolean;
  today: string;
  /** The days the events were loaded for; anything outside is fetched by opening the calendar there. */
  covers: { from: string; to: string };
  defaultView?: AgendaView;
  initialAnchor?: string;
  /** With the custom view: the last day of the stretch. */
  initialUntil?: string;
  fullCalendarHref?: string;
  storageKey?: string;
  /** On the calendar page: days outside what was loaded are fetched straight away instead of offering a button. */
  autoLoad?: boolean;
  /** The calendar page has the room to write entries into the month grid on a computer; the dashboard shows dots. */
  roomy?: boolean;
  action?: ReactNode;
}) {
  const t = useTranslations("calendar");
  const papers = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [view, setView] = useState<AgendaView>(defaultView);
  const [anchor, setAnchor] = useState(initialAnchor || today);
  const [selected, setSelected] = useState(initialAnchor || today);
  const [range, setRange] = useState({ from: initialAnchor || today, to: initialUntil && initialUntil >= (initialAnchor || today) ? initialUntil : addDays(initialAnchor || today, 13) });

  // The view someone last picked here comes back next time (this browser only).
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "day" || saved === "week" || saved === "month" || saved === "custom") setView(saved);
    } catch {}
  }, [storageKey]);
  const pick = (next: AgendaView) => {
    setView(next);
    try {
      if (storageKey) window.localStorage.setItem(storageKey, next);
    } catch {}
  };

  const titleOf = (event: CalendarEvent) => {
    const words = event.say;
    if (!words || !t.has(`ev_${words.key}`)) return event.title;
    const paper = words.paper ? (papers.has(`paper_${words.paper}`) ? papers(`paper_${words.paper}`) : words.paper) : "";
    return t(`ev_${words.key}`, { subject: words.subject, amount: words.amount || "", paper });
  };

  // The month chip is a few characters wide, so it says what kind of thing it is as well as which vehicle:
  // "↗ Fortuner" going out, "↙ Fortuner" coming back, "Insurance · Yaris", "฿9,000".
  const chipOf = (event: CalendarEvent) => {
    const words = event.say;
    const subject = String(words?.subject || "").split(" · ")[0].trim();
    const parts = subject.split(" ");
    const model = parts.length > 1 ? parts.slice(1).join(" ") : subject;
    // A payment says whose it is: "฿9,000 · Somchai" (a bare amount meant opening it to find out).
    if (words?.amount) {
      const firstName = String(words.subject || "").trim().split(/\s+/)[0];
      return firstName && firstName !== "Customer" ? `${words.amount} · ${firstName}` : words.amount;
    }
    if (words?.paper) {
      const paper = papers.has(`paper_${words.paper}`) ? papers(`paper_${words.paper}`) : words.paper;
      return model ? `${paper} · ${model}` : paper;
    }
    if (!subject) return titleOf(event);
    if (event.type === "rental_start") return `↗ ${model}`;
    if (event.type === "rental_end" || event.type === "rental_due") return `↙ ${model}`;
    return model;
  };

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) map.set(event.date, [...(map.get(event.date) || []), event]);
    return map;
  }, [events]);
  // Something late (a handover, a return, a payment) is still today's job, so today lists it too.
  const carried = useMemo(() => (carryLate ? events.filter((event) => event.date < today && event.tone === "red" && event.type !== "compliance" && event.type !== "task") : []), [carryLate, events, today]);
  const on = (date: string) => [...(date === today ? carried : []), ...(byDate.get(date) || [])];

  // The days on screen for each view.
  const monthStart = `${anchor.slice(0, 7)}-01`;
  const monthEnd = addDays(`${addDays(monthStart, 32).slice(0, 7)}-01`, -1);
  const span =
    view === "day" ? { from: anchor, to: anchor } : view === "week" ? { from: anchor, to: addDays(anchor, 6) } : view === "month" ? { from: monthStart, to: monthEnd } : range;
  const outside = span.from < covers.from || span.to > covers.to;
  const chosen = selected >= span.from && selected <= span.to ? selected : today >= span.from && today <= span.to ? today : span.from;
  const loadHref = `${fullCalendarHref}?month=${span.from.slice(0, 7)}&v=${view}&on=${view === "custom" ? range.from : anchor}${view === "custom" ? `&until=${range.to}` : ""}`;
  useEffect(() => {
    if (autoLoad && outside) router.replace(loadHref as any, { scroll: false });
  }, [autoLoad, outside, loadHref, router]);

  const step = (direction: 1 | -1) => {
    const next = view === "day" ? addDays(anchor, direction) : view === "week" ? addDays(anchor, 7 * direction) : direction > 0 ? addDays(monthEnd, 1) : `${addDays(monthStart, -1).slice(0, 7)}-01`;
    setAnchor(next);
  };

  const label =
    view === "day"
      ? fmt(locale, { weekday: "long", day: "numeric", month: "long" }).format(asDate(anchor))
      : view === "month"
        ? fmt(locale, { month: "long", year: "numeric" }).format(asDate(monthStart))
        : span.from.slice(0, 7) === span.to.slice(0, 7)
          ? `${asDate(span.from).getUTCDate()} – ${fmt(locale, { day: "numeric", month: "short" }).format(asDate(span.to))}`
          : `${fmt(locale, { day: "numeric", month: "short" }).format(asDate(span.from))} – ${fmt(locale, { day: "numeric", month: "short" }).format(asDate(span.to))}`;
  const atToday = view === "month" ? anchor.slice(0, 7) === today.slice(0, 7) : anchor === today;

  const row = (event: CalendarEvent, late: boolean) => (
    <Link className="pressable flex min-h-12 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-[var(--panel-secondary)]" href={event.href as any} key={`${event.id}${late ? "-late" : ""}`}>
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE[event.tone].icon}`}>{ICON[event.type](17)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-[var(--foreground)]">{titleOf(event)}</span>
        {late ? <span className="block text-sm font-semibold text-[var(--danger)]">{t("lateSince", { date: fmt(locale, { day: "numeric", month: "short" }).format(asDate(event.date)) })}</span> : null}
      </span>
      <ChevronRight className="shrink-0 text-[var(--muted)]" size={16} />
    </Link>
  );
  const dayHeading = (date: string) => (
    <p className={`px-2 pb-1 pt-2 text-[15px] font-bold ${date === today ? "text-[var(--primary)]" : "text-[var(--foreground-secondary)]"}`}>
      {date === today ? `${t("today")} · ` : ""}
      {fmt(locale, { weekday: "long", day: "numeric", month: "short" }).format(asDate(date))}
    </p>
  );
  const listFor = (from: string, to: string, skipEmpty: boolean) => {
    const days = Array.from({ length: daysBetween(from, to) + 1 }, (_, index) => addDays(from, index));
    const shown = days.filter((date) => !skipEmpty || on(date).length > 0);
    if (shown.length === 0) return <p className="px-2 py-6 text-center font-semibold text-[var(--muted)]">{t("nothingInRange")}</p>;
    return (
      <div className="divide-y divide-[var(--border)]">
        {shown.map((date) => {
          const list = on(date);
          return (
            <div className="py-1" key={date}>
              {dayHeading(date)}
              {list.length === 0 ? <p className="px-2 pb-2 text-[15px] text-[var(--muted)]">{t("nothingThisDay")}</p> : list.map((event) => row(event, event.date < date))}
            </div>
          );
        })}
      </div>
    );
  };

  // The week as one strip: each day with a dot per entry. Tap a day to list it underneath.
  const weekStrip = (
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 7 }, (_, index) => addDays(anchor, index)).map((date) => {
        const list = on(date);
        const isChosen = date === chosen;
        const isToday = date === today;
        return (
          <button
            aria-pressed={isChosen}
            className={`pressable flex min-h-[68px] min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 ${isChosen ? "bg-[var(--primary-light)] ring-2 ring-[var(--primary)]" : "bg-[var(--panel-secondary)]"}`}
            key={date}
            onClick={() => setSelected(date)}
            type="button"
          >
            <span className={`text-[14px] font-bold ${isToday ? "text-[var(--primary)]" : "text-[var(--foreground-secondary)]"}`}>{fmt(locale, { weekday: "short" }).format(asDate(date))}</span>
            <span className={`num text-[18px] leading-none ${isToday ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>{asDate(date).getUTCDate()}</span>
            <span className="flex min-h-2 flex-wrap justify-center gap-0.5">
              {list.slice(0, 4).map((event) => <span className={`h-2 w-2 rounded-full ${TONE[event.tone].dot}`} key={event.id} />)}
              {list.length > 4 ? <span className="text-[12px] font-bold leading-[8px] text-[var(--muted)]">+</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );

  const monthGrid = (() => {
    const pad = asDate(monthStart).getUTCDay();
    const count = daysBetween(monthStart, monthEnd) + 1;
    const cells = [...Array.from({ length: pad }, () => null), ...Array.from({ length: count }, (_, index) => addDays(monthStart, index))];
    const names = Array.from({ length: 7 }, (_, index) => fmt(locale, { weekday: "short" }).format(new Date(Date.UTC(1970, 0, 4 + index))));
    const short = names.some((name) => name.length > 4) ? Array.from({ length: 7 }, (_, index) => fmt(locale, { weekday: "narrow" }).format(new Date(Date.UTC(1970, 0, 4 + index)))) : names;
    return (
      <div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[14px] font-bold text-[var(--muted)]">
          {short.map((name, index) => <span key={index}>{name}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, index) => {
            if (!date) return <span key={`pad-${index}`} />;
            const list = on(date);
            const isToday = date === today;
            return (
              <button
                className={`pressable flex min-h-[52px] min-w-0 flex-col items-stretch rounded-xl p-1 text-left ${roomy ? "lg:min-h-[104px]" : ""} ${date === chosen ? "bg-[var(--primary-light)] ring-2 ring-[var(--primary)]" : isToday ? "bg-white ring-2 ring-[var(--border-strong)]" : date < today ? "bg-[var(--panel-secondary)]" : "bg-white shadow-[0_1px_3px_rgba(19,38,43,0.08)]"}`}
                key={date}
                onClick={() => setSelected(date)}
                type="button"
              >
                <span className={`num inline-flex h-7 min-w-7 items-center justify-center self-center rounded-full px-1 text-[15px] ${roomy ? "lg:self-start" : ""} ${isToday ? "bg-[var(--primary)] text-white" : date < today ? "text-[var(--muted)]" : "text-[var(--foreground)]"}`}>
                  {asDate(date).getUTCDate()}
                </span>
                <span className={`mt-1 flex flex-wrap justify-center gap-0.5 ${roomy ? "lg:hidden" : ""}`}>
                  {list.slice(0, 6).map((event) => <span className={`h-2 w-2 rounded-full ${TONE[event.tone].dot}`} key={event.id} />)}
                </span>
                <span className={`mt-1 hidden space-y-0.5 ${roomy ? "lg:block" : ""}`}>
                  {list.slice(0, 3).map((event) => (
                    <span className={`block truncate rounded-md border-l-[3px] bg-[var(--panel-secondary)] px-1.5 py-0.5 text-[14px] font-semibold ${event.tone === "green" ? "text-[var(--muted)]" : "text-[var(--foreground)]"} ${TONE[event.tone].chip}`} key={event.id} title={titleOf(event)}>
                      {chipOf(event)}
                    </span>
                  ))}
                  {list.length > 3 ? <span className="block px-1 text-[14px] font-semibold text-[var(--muted)]">{t("more", { count: list.length - 3 })}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-semibold text-[var(--foreground-secondary)]">
          {(["blue", "amber", "purple", "red", "green"] as const).map((tone) => (
            <span className="inline-flex items-center gap-1.5" key={tone}>
              <span className={`h-2.5 w-2.5 rounded-full ${TONE[tone].dot}`} />
              {t(`leg_${tone}`)}
            </span>
          ))}
        </div>
      </div>
    );
  })();

  const tabs: Array<[AgendaView, string]> = [
    ["day", t("viewDay")],
    ["week", t("viewWeek")],
    ["month", t("viewMonth")],
    ["custom", t("viewCustom")]
  ];
  const dateInput = "min-h-11 w-full rounded-xl border border-[var(--border-strong)] bg-white px-3 text-[15px] font-semibold text-[var(--foreground)]";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-[var(--panel-secondary)] p-1" role="tablist">
          {tabs.map(([key, text]) => (
            <button
              aria-selected={view === key}
              className={`pressable min-h-9 whitespace-nowrap rounded-full px-3 text-[14px] font-bold ${view === key ? "bg-white text-[var(--foreground)] shadow-[0_1px_3px_rgba(19,38,43,0.12)]" : "text-[var(--foreground-secondary)]"}`}
              key={key}
              onClick={() => pick(key)}
              role="tab"
              type="button"
            >
              {text}
            </button>
          ))}
        </div>
        {action}
      </div>

      {view === "custom" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("from")}</span>
            <input className={dateInput} onChange={(event) => event.target.value && setRange((current) => ({ from: event.target.value, to: current.to < event.target.value ? event.target.value : current.to }))} type="date" value={range.from} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("to")}</span>
            <input className={dateInput} min={range.from} onChange={(event) => event.target.value && setRange((current) => ({ ...current, to: event.target.value }))} type="date" value={range.to} />
          </label>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <button aria-label={t("previous")} className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground)]" onClick={() => step(-1)} type="button">
            <ChevronLeft size={18} />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-[17px] font-bold text-[var(--foreground)]">{label}</p>
          {!atToday ? (
            <button className="pressable min-h-10 shrink-0 whitespace-nowrap rounded-full border border-[var(--border)] bg-white px-3 text-[14px] font-bold text-[var(--primary)]" onClick={() => setAnchor(view === "month" ? `${today.slice(0, 7)}-01` : today)} type="button">
              {t("today")}
            </button>
          ) : null}
          <button aria-label={t("next")} className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground)]" onClick={() => step(1)} type="button">
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      <div className="mt-3">
        {outside && autoLoad ? (
          <div className="flex justify-center py-10" aria-busy="true"><span aria-hidden="true" className="spinner" /></div>
        ) : outside ? (
          <div className="rounded-xl bg-[var(--panel-secondary)] p-4 text-center">
            <p className="font-semibold text-[var(--foreground-secondary)]">{t("outsideLoaded")}</p>
            <button
              className="pressable mt-2 min-h-11 whitespace-nowrap rounded-full bg-[var(--primary)] px-5 font-bold text-white"
              onClick={() => router.push(loadHref as any)}
              type="button"
            >
              {t("openThere")}
            </button>
          </div>
        ) : view === "month" || view === "week" ? (
          <>
            {view === "month" ? monthGrid : weekStrip}
            <div className="mt-2">{listFor(chosen, chosen, false)}</div>
          </>
        ) : (
          listFor(span.from, span.to, view === "custom")
        )}
      </div>
    </div>
  );
}
