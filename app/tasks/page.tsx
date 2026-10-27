import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BandPills } from "@/components/page-band";
import { canDecideMoney, getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { businessToday } from "@/lib/business-time";
import { getDefaultOrganization } from "@/lib/organization";
import { getTaskList } from "@/lib/tasks";
import { bucketOf, parseShow, type Bucket } from "./buckets";
import { TasksList } from "./tasks-list";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show: rawShow } = await searchParams;
  const show = parseShow(rawShow);
  const [userEmail, organization, membership] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getCurrentMembership()]);
  const tasks = await getTaskList(organization.id);
  const t = await getTranslations("todo");
  const today = businessToday();
  // Counted as the list shows them: a payment covered by another job (one receipt, or same-day pieces) isn't its own job.
  const open = tasks.filter((task: any) => !task.completedAt && !task.coveredBy);
  const count = (bucket: Bucket) => open.filter((task: any) => bucketOf(task, today) === bucket).length;
  // Each pill is a filter, as on Bookings: tap it to see just those jobs, tap the chosen one again for all.
  const pill = (bucket: Bucket, label: string, alert = false) => ({
    count: count(bucket),
    label,
    alert,
    href: show === bucket ? "/tasks" : `/tasks?show=${bucket}`,
    active: show === bucket
  });

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
                pill("overdue", t("bandOverdue"), true),
                pill("next3", t("band_next3")),
                pill("next7", t("band_next7")),
                pill("next30", t("band_next30"))
              ]}
            />
          </div>
        </div>
      }
    >
      <TasksList canDecide={canDecideMoney(membership?.role)} key={show || "all"} organizationId={organization.id} show={show} tasks={tasks} today={today} />
    </AppShell>
  );
}
