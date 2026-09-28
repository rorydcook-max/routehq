import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { businessToday } from "@/lib/business-time";
import { getDefaultOrganization } from "@/lib/organization";
import { getTaskList } from "@/lib/tasks";
import { TasksList } from "./tasks-list";

export default async function TasksPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const tasks = await getTaskList(organization.id);

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5">
        <p className="page-eyebrow">Tasks</p>
        <h1 className="page-title">To do</h1>
        <p className="page-subtitle mt-2">Payments to collect and jobs for the team, soonest first.</p>
      </div>

      <TasksList organizationId={organization.id} tasks={tasks} today={businessToday()} />
    </AppShell>
  );
}
