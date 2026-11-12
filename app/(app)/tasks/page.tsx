import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BandPills } from "@/components/page-band";
import { canDecideMoney, getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { businessToday } from "@/lib/business-time";
import { getDefaultOrganization } from "@/lib/organization";
import { getDashboardData } from "@/lib/dashboard";
import { getTaskList, type TaskListItem } from "@/lib/tasks";
import { bucketOf, parseShow, type Bucket } from "./buckets";
import { TasksList } from "./tasks-list";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show: rawShow } = await searchParams;
  const show = parseShow(rawShow);
  const [userEmail, organization, membership] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getCurrentMembership()]);
  const [listed, dash] = await Promise.all([getTaskList(organization.id), getDashboardData().catch(() => null)]);
  // To do is the one place for everything that needs doing (Rory, 11 Nov 2026): vehicles due back and paperwork
  // to renew join the payments, handovers and jobs. The same rentals and dates the dashboard reads.
  const horizon = businessToday(30);
  const blank = { dueAt: null, completedAt: null, rentalPaymentId: null, rentalLabel: null, amount: null, receipt: null, coveredBy: null, paymentLabel: null };
  const extra: TaskListItem[] = [];
  for (const rental of ((dash?.rentals || []) as any[])) {
    const end = String(rental.end || "").slice(0, 10);
    if (rental.status === "Booked" || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end > horizon) continue;
    extra.push({ ...blank, id: `return-${rental.id}`, kind: "task", title: "Vehicle due back", taskType: "return", dueDate: end, vehicleId: null, rentalId: rental.id, action: "return", vehicleLabel: rental.vehicle || null, customerName: rental.customer || null });
  }
  for (const vehicle of ((dash?.vehicles || []) as any[])) {
    for (const paper of vehicle.compliance || []) {
      const due = String(paper.date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due > horizon) continue;
      extra.push({ ...blank, id: `paper-${vehicle.id}-${paper.key}`, kind: "task", title: String(paper.label || "Paperwork"), taskType: "compliance", dueDate: due, vehicleId: vehicle.id, rentalId: null, action: "paperwork", vehicleLabel: [vehicle.make, vehicle.model].filter(Boolean).join(" ") || null, customerName: null });
    }
  }
  const tasks = [...listed, ...extra].sort((a, b) => String(a.dueDate || "9999-12-31").localeCompare(String(b.dueDate || "9999-12-31")) || String(a.dueAt || "").localeCompare(String(b.dueAt || "")));
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
          <h1 className="text-[32px] leading-tight text-[var(--foreground)]">{t("title")}</h1>
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
