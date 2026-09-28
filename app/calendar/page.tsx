import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getCalendarEvents } from "@/lib/calendar";
import { getDefaultOrganization } from "@/lib/organization";
import { getTaskList } from "@/lib/tasks";
import { TasksList } from "@/app/tasks/tasks-list";
import { CalendarView } from "./calendar-view";
import { businessToday } from "@/lib/business-time";

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const today = businessToday();
  const month = /^\d{4}-\d{2}$/.test(String(params.month || "")) ? String(params.month) : today.slice(0, 7);
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const [yearStr, monthStr] = month.split("-");
  const [events, tasks] = await Promise.all([
    getCalendarEvents(organization.id, Number(yearStr), Number(monthStr)),
    getTaskList(organization.id)
  ]);

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5">
        <p className="page-eyebrow">Calendar</p>
        <h1 className="page-title">Calendar</h1>
        <p className="page-subtitle mt-1">Handovers, returns, payments and renewals by day.</p>
      </div>

      <CalendarView events={events} initialMonth={month} today={today} />

      <div className="my-6 border-t border-[var(--border)]" />

      <section>
        <div className="mb-4">
          <p className="page-eyebrow">Tasks</p>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">To do</h2>
        </div>
        <TasksList organizationId={organization.id} tasks={tasks} today={today} />
      </section>
    </AppShell>
  );
}
