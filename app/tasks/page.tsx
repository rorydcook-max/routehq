import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { canDecideMoney, getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { businessToday } from "@/lib/business-time";
import { getDefaultOrganization } from "@/lib/organization";
import { getTaskList } from "@/lib/tasks";
import { TasksList } from "./tasks-list";

export default async function TasksPage() {
  const [userEmail, organization, membership] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getCurrentMembership()]);
  const tasks = await getTaskList(organization.id);
  const t = await getTranslations("todo");
  const today = businessToday();
  const weekEnd = businessToday(7);
  const open = tasks.filter((task: any) => !task.completedAt);
  const overdue = open.filter((task: any) => task.dueDate && task.dueDate < today).length;
  const dueToday = open.filter((task: any) => task.dueDate === today).length;
  const thisWeek = open.filter((task: any) => task.dueDate && task.dueDate > today && task.dueDate <= weekEnd).length;

  return (
    <AppShell
      userEmail={userEmail}
      hero={
        <div>
          <h1 className="text-[30px] font-bold leading-tight text-white">{t("title")}</h1>
          <div className="mt-4 grid max-w-xl grid-cols-3 gap-2">
            {/* Late work is the one to act on: white, and brick when it is not zero. */}
            <span className="rounded-2xl bg-white px-3 py-2.5 text-[var(--foreground)]">
              <span className={`block text-[24px] font-bold leading-none tabular-nums ${overdue > 0 ? "text-[var(--danger)]" : ""}`}>{overdue}</span>
              <span className="mt-1 block font-semibold text-[var(--muted)]">{t("bandOverdue")}</span>
            </span>
            <span className="rounded-2xl bg-[var(--band-soft)] px-3 py-2.5 text-white">
              <span className="block text-[24px] font-bold leading-none tabular-nums">{dueToday}</span>
              <span className="mt-1 block font-semibold text-white/85">{t("bandToday")}</span>
            </span>
            <span className="rounded-2xl bg-[var(--band-soft)] px-3 py-2.5 text-white">
              <span className="block text-[24px] font-bold leading-none tabular-nums">{thisWeek}</span>
              <span className="mt-1 block font-semibold text-white/85">{t("bandWeek")}</span>
            </span>
          </div>
        </div>
      }
    >
      <TasksList canDecide={canDecideMoney(membership?.role)} organizationId={organization.id} tasks={tasks} today={today} />
    </AppShell>
  );
}
