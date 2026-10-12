import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BandPills } from "@/components/page-band";
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
          <h1 className="text-[32px] leading-tight text-white">{t("title")}</h1>
          {/* Late work is the one to act on: white, with a brick number, when it is not zero. */}
          <div className="mt-4">
            <BandPills
              items={[
                { count: overdue, label: t("bandOverdue"), alert: true },
                { count: dueToday, label: t("bandToday") },
                { count: thisWeek, label: t("bandWeek") }
              ]}
            />
          </div>
        </div>
      }
    >
      <TasksList canDecide={canDecideMoney(membership?.role)} organizationId={organization.id} tasks={tasks} today={today} />
    </AppShell>
  );
}
