import { releaseExpiredHolds } from "@/lib/booking-holds";
import { jobNameFor } from "@/lib/job-name";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { dateFormat } from "@/lib/i18n/dates";
import type { Route } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { canDecideMoney, getCurrentMembership } from "@/lib/auth/roles";
import { bandTab, PageBand } from "@/components/page-band";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getAvailability, getCalendarEventsBetween } from "@/lib/calendar";
import { taskCalendarEvents } from "@/lib/calendar-tasks";
import { AgendaCalendar, type AgendaView } from "@/components/agenda-calendar";
import { getDefaultOrganization } from "@/lib/organization";
import { getTaskList } from "@/lib/tasks";
import { AvailabilityView } from "./availability-view";
import { businessToday } from "@/lib/business-time";

function shiftMonth(month: string, delta: number) {
  const [year, index] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, index - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastDay(month: string) {
  const [year, index] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(year, index, 0)).getUTCDate()).padStart(2, "0")}`;
}

function monthLabel(month: string, locale: string) {
  const [year, index] = month.split("-").map(Number);
  return dateFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, index - 1, 1)));
}

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; view?: string; v?: string; on?: string; until?: string }>;
}) {
  const params = await searchParams;
  const today = businessToday();
  const month = /^\d{4}-\d{2}$/.test(String(params.month || "")) ? String(params.month) : today.slice(0, 7);
  const byVehicle = params.view === "vehicles";
  const [t, todo, locale] = await Promise.all([getTranslations("calendar"), getTranslations("todo"), getLocale()]);
  const [userEmail, organization, membership] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getCurrentMembership()]);
  await releaseExpiredHolds(createSupabaseAdminClient(), organization.id).catch(() => null);
  const [yearStr, monthStr] = month.split("-");
  const covers = { from: `${shiftMonth(month, -1)}-01`, to: lastDay(shiftMonth(month, 1)) };
  const [events, tasks, availability] = await Promise.all([
    byVehicle ? Promise.resolve([]) : getCalendarEventsBetween(organization.id, covers.from, covers.to),
    byVehicle ? Promise.resolve([]) : getTaskList(organization.id),
    byVehicle ? getAvailability(organization.id, Number(yearStr), Number(monthStr)) : Promise.resolve([])
  ]);

  return (
    <AppShell
      userEmail={userEmail}
      hero={
        <PageBand subtitle={byVehicle ? t("subVehicle") : t("subDay")} title={t("title")}>
          <div className="flex gap-2">
            <Link className={bandTab(!byVehicle)} href={`/calendar?month=${month}` as Route}>
              {t("byDay")}
            </Link>
            <Link className={bandTab(byVehicle)} href={`/calendar?view=vehicles&month=${month}` as Route}>
              {t("byVehicle")}
            </Link>
          </div>
        </PageBand>
      }
    >

      {byVehicle ? (
        <div className="space-y-4">
          <div className="content-section flex items-center justify-between gap-2">
            {/* Same month navigation as the agenda view: 44px round buttons, an 18px title. */}
            <Link aria-label={t("prevMonth")} className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-white text-[var(--foreground)]" href={`/calendar?view=vehicles&month=${shiftMonth(month, -1)}` as Route}>
              <ChevronLeft size={20} />
            </Link>
            <div className="flex min-w-0 flex-col items-center">
              <h2 className="whitespace-nowrap text-[18px] font-bold text-[var(--foreground)]">{monthLabel(month, locale)}</h2>
              {today.slice(0, 7) !== month ? (
                <Link className="font-bold text-[var(--primary)] underline underline-offset-2" href={`/calendar?view=vehicles&month=${today.slice(0, 7)}` as Route}>
                  {t("today")}
                </Link>
              ) : null}
            </div>
            <Link aria-label={t("nextMonth")} className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-white text-[var(--foreground)]" href={`/calendar?view=vehicles&month=${shiftMonth(month, 1)}` as Route}>
              <ChevronRight size={20} />
            </Link>
          </div>
          <AvailabilityView month={month} today={today} vehicles={availability} />
        </div>
      ) : (
        <>
          <div className="content-section">
            <AgendaCalendar
              autoLoad
              roomy
              covers={covers}
              defaultView={(["day", "week", "month", "custom"].includes(String(params.v)) ? params.v : "month") as AgendaView}
              events={[
                ...events,
                ...taskCalendarEvents(tasks, {
                  from: covers.from,
                  to: covers.to,
                  today,
                  canDecide: canDecideMoney(membership?.role),
                  describe: (task) => [jobNameFor(todo as never, task.action, task.title) || task.title.split(" - ")[0], task.customerName, task.vehicleLabel ? task.vehicleLabel.split(" · ")[0] : null].filter(Boolean).join(" · ")
                })
              ].sort((a, b) => a.date.localeCompare(b.date))}
              initialAnchor={/^\d{4}-\d{2}-\d{2}$/.test(String(params.on || "")) ? String(params.on) : month === today.slice(0, 7) ? today : `${month}-01`}
              initialUntil={/^\d{4}-\d{2}-\d{2}$/.test(String(params.until || "")) ? String(params.until) : undefined}
              today={today}
            />
          </div>

        </>
      )}
    </AppShell>
  );
}
