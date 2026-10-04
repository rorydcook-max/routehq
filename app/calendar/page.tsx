import { releaseExpiredHolds } from "@/lib/booking-holds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
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

function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, index - 1, 1)));
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
        <p className="page-eyebrow">Calendar</p>
        <h1 className="page-title">Calendar</h1>
        <p className="page-subtitle mt-1">
          {byVehicle ? "Which vehicles are out, booked or free, day by day." : "Handovers, returns, payments and renewals by day."}
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <Link className={tab(!byVehicle)} href={`/calendar?month=${month}` as Route}>
          By day
        </Link>
        <Link className={tab(byVehicle)} href={`/calendar?view=vehicles&month=${month}` as Route}>
          By vehicle
        </Link>
      </div>

      {byVehicle ? (
        <div className="space-y-4">
          <div className="content-section flex items-center justify-between gap-2">
            <Link aria-label="Previous month" className="secondary-action pressable" href={`/calendar?view=vehicles&month=${shiftMonth(month, -1)}` as Route}>
              <ChevronLeft size={18} />
            </Link>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">{monthLabel(month)}</h2>
              {today.slice(0, 7) !== month ? (
                <Link className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-bold text-[var(--primary)]" href={`/calendar?view=vehicles&month=${today.slice(0, 7)}` as Route}>
                  Today
                </Link>
              ) : null}
            </div>
            <Link aria-label="Next month" className="secondary-action pressable" href={`/calendar?view=vehicles&month=${shiftMonth(month, 1)}` as Route}>
              <ChevronRight size={18} />
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
              <p className="page-eyebrow">Tasks</p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">To do</h2>
            </div>
            <TasksList organizationId={organization.id} tasks={tasks} today={today} />
          </section>
        </>
      )}
    </AppShell>
  );
}
