import { releaseExpiredHolds } from "@/lib/booking-holds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { intlLocale } from "@/lib/i18n/dates";
import type { Route } from "next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getAvailability, getCalendarEvents } from "@/lib/calendar";
import { getDefaultOrganization } from "@/lib/organization";
import { getTaskList } from "@/lib/tasks";
import { TasksList } from "@/app/tasks/tasks-list";
import { AvailabilityView } from "./availability-view";
import { CalendarView } from "./calendar-view";
import { businessToday } from "@/lib/business-time";

function shiftMonth(month: string, delta: number) {
  const [year, index] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, index - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string, locale: string) {
  const [year, index] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, index - 1, 1)));
}

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; view?: string }>;
}) {
  const params = await searchParams;
  const today = businessToday();
  const month = /^\d{4}-\d{2}$/.test(String(params.month || "")) ? String(params.month) : today.slice(0, 7);
  const byVehicle = params.view === "vehicles";
  const [t, todo, locale] = await Promise.all([getTranslations("calendar"), getTranslations("todo"), getLocale()]);
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  await releaseExpiredHolds(createSupabaseAdminClient(), organization.id).catch(() => null);
  const [yearStr, monthStr] = month.split("-");
  const [events, tasks, availability] = await Promise.all([
    byVehicle ? Promise.resolve([]) : getCalendarEvents(organization.id, Number(yearStr), Number(monthStr)),
    byVehicle ? Promise.resolve([]) : getTaskList(organization.id),
    byVehicle ? getAvailability(organization.id, Number(yearStr), Number(monthStr)) : Promise.resolve([])
  ]);
  const tab = (active: boolean) =>
    `pressable inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-bold ${active ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground)]"}`;

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5">
        <p className="page-eyebrow">{t("title")}</p>
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-subtitle mt-1">
          {byVehicle ? t("subVehicle") : t("subDay")}
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <Link className={tab(!byVehicle)} href={`/calendar?month=${month}` as Route}>
          {t("byDay")}
        </Link>
        <Link className={tab(byVehicle)} href={`/calendar?view=vehicles&month=${month}` as Route}>
          {t("byVehicle")}
        </Link>
      </div>

      {byVehicle ? (
        <div className="space-y-4">
          <div className="content-section flex items-center justify-between gap-2">
            <Link aria-label={t("prevMonth")} className="secondary-action pressable !w-11 !px-0 shrink-0" href={`/calendar?view=vehicles&month=${shiftMonth(month, -1)}` as Route}>
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
            <Link aria-label={t("nextMonth")} className="secondary-action pressable !w-11 !px-0 shrink-0" href={`/calendar?view=vehicles&month=${shiftMonth(month, 1)}` as Route}>
              <ChevronRight size={20} />
            </Link>
          </div>
          <AvailabilityView month={month} today={today} vehicles={availability} />
        </div>
      ) : (
        <>
          <CalendarView events={events} initialMonth={month} today={today} />

          <div className="my-6 border-t border-[var(--border)]" />

          <section>
            <div className="mb-4">
              <p className="page-eyebrow">{todo("eyebrow")}</p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{todo("title")}</h2>
            </div>
            <TasksList organizationId={organization.id} tasks={tasks} today={today} />
          </section>
        </>
      )}
    </AppShell>
  );
}
