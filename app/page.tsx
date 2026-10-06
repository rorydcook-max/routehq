import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { dayOfWeekDate, intlLocale, shortDate as shortDateIn } from "@/lib/i18n/dates";
import { ArrowRight, Bell, CalendarClock, CheckCircle2, FileWarning, KeyRound, Plus, ReceiptText, RotateCcw, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { businessToday } from "@/lib/business-time";
import { FleetIntelligencePanel } from "@/components/dashboard/fleet-intelligence-panel";
import { FleetPnLCard } from "@/components/dashboard/fleet-pnl-card";
import { FleetValueCard } from "@/components/dashboard/fleet-value-card";
import { RouteHQValueWidget } from "@/components/dashboard/routehq-value-widget";
import { VehicleTimelinePanel } from "@/components/dashboard/vehicle-timeline-panel";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { OutFreeSummary, VehicleKindIcon } from "@/components/vehicle-kind-icon";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDashboardData, money } from "@/lib/dashboard";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { getValueTrackerData } from "@/lib/value-tracker";
import { getOnboardingStatus } from "@/lib/onboarding";
import { getReceiptsWaiting } from "@/lib/payment-receipts";
import { getTaskList } from "@/lib/tasks";
import { PushToggle } from "@/components/push-toggle";
import { releaseExpiredHolds } from "@/lib/booking-holds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isExpenseTransaction, isRevenueTransaction } from "@/lib/transaction-options";
import { groupVehiclesByKind } from "@/lib/vehicle-groups";

// Dates and counts are worded by the translation files (see lib/i18n/dates.ts and locales/).
function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

// (see locales/<language>/common.json for the wording)
type Tone = "red" | "amber" | "teal" | "blue" | "neutral";

type AgendaItem = {
  key: string;
  tone: Tone;
  icon: ReactNode;
  title: string;
  detail: string;
  href: string;
  action: string;
  when?: string;
  /** What kind of thing it is, most pressing first: 0 a vehicle that should be back, 1 today's handovers and returns, 2 a customer waiting, 3 money, 4 other jobs, 5 paperwork. */
  rank?: number;
};

const TONE_CLASSES: Record<Tone, string> = {
  red: "bg-[var(--danger-light)] text-[var(--danger)]",
  amber: "bg-[var(--warning-light)] text-[var(--warning)]",
  teal: "bg-[var(--primary-light)] text-[var(--primary)]",
  blue: "bg-[var(--info-light)] text-[var(--info)]",
  neutral: "bg-[var(--panel-tertiary)] text-[var(--muted)]"
};

function AgendaRow({ item }: { item: AgendaItem }) {
  return (
    <li>
      <Link className="group flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--panel-secondary)]" href={item.href as Route}>
        <span className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] ${TONE_CLASSES[item.tone]}`}>{item.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-snug text-[var(--foreground)] sm:truncate">{item.title}</span>
          <span className="line-clamp-2 block text-[13px] text-[var(--muted)] sm:truncate">
            {item.detail}
            {item.when ? <span className="sm:hidden"> · {item.when}</span> : null}
          </span>
        </span>
        {item.when ? <span className="hidden flex-shrink-0 text-[13px] text-[var(--muted)] sm:block">{item.when}</span> : null}
        <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-[8px] border border-[var(--border)] bg-white px-2.5 py-1.5 text-[13px] font-semibold text-[var(--foreground-secondary)] transition group-hover:border-[var(--primary)] group-hover:text-[var(--primary)]">
          {item.action}
        </span>
      </Link>
    </li>
  );
}

function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-sm)] ${className}`}>
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--primary)] hover:underline" href={href as Route}>
      {children}
      <ArrowRight size={14} />
    </Link>
  );
}

export default async function Home() {
  // Holds that ran out without a signature give their dates back before anything is counted.
  await getDefaultOrganization().then((org) => releaseExpiredHolds(createSupabaseAdminClient(), org.id)).catch(() => null);
  const [userEmail, organization, dashboardData, supabase, t, c, locale] = await Promise.all([
    getCurrentUserEmail(),
    getDefaultOrganization(),
    getDashboardData(),
    createSupabaseServerClient(),
    getTranslations("dashboard"),
    getTranslations("common"),
    getLocale()
  ]);
  const shortDate = (value: string) => shortDateIn(value, locale);
  const dayLabel = (value: string) => dayOfWeekDate(value, locale);
  const [onboardingStatus, categories, valueTrackerData] = await Promise.all([
    getOnboardingStatus(supabase as any, organization.id),
    getVehicleCategories(organization.id),
    getValueTrackerData({
      organizationId: organization.id,
      subscriptionTier: organization.subscription_tier,
      createdAt: organization.created_at,
      supabase: supabase as any
    })
  ]);
  const { metrics, reminders, rentals, timeline, transactions, vehicles } = dashboardData;
  const [receiptsWaiting, taskList] = await Promise.all([getReceiptsWaiting(organization.id), getTaskList(organization.id).catch(() => [])]);

  const now = new Date();
  const today = businessToday();
  const weekAhead = addDays(today, 7);
  const bangkokHour = (now.getUTCHours() + 7) % 24;
  const greeting = bangkokHour < 12 ? t("goodMorning") : bangkokHour < 18 ? t("goodAfternoon") : t("goodEvening");
  const headerDate = now.toLocaleDateString(intlLocale(locale), { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" });

  // ── Money ────────────────────────────────────────────────────────────────
  // Expenses are stored as positive amounts, so they're recognised by type.
  const thisMonth = today.slice(0, 7);
  const monthlyExpenses = transactions
    .filter((t) => String(t.date || "").slice(0, 7) === thisMonth)
    .filter((t) => isExpenseTransaction({ isDeposit: t.isDeposit, type: t.rawType || t.type }))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const monthlyProfit = metrics.monthlyRevenue - monthlyExpenses;
  const revenueByMonth = new Map<string, number>();
  transactions.forEach((t) => {
    if (!t.date || !isRevenueTransaction({ amount: t.amount, isDeposit: t.isDeposit, type: t.rawType || t.type })) return;
    const key = t.date.slice(0, 7);
    revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + t.amount);
  });
  const lastSixMonths = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 6 + index, 1));
    const key = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
    return { key, label: new Intl.DateTimeFormat(intlLocale(locale), { month: "short", timeZone: "UTC" }).format(month), amount: revenueByMonth.get(key) || 0 };
  });
  const maxMonth = Math.max(1, ...lastSixMonths.map((month) => month.amount));

  // Only payments past their due date count as overdue.
  const overdueRentals = rentals.filter((r) => (r.overdue || 0) > 0).sort((a, b) => String(a.overdueSince).localeCompare(String(b.overdueSince)));
  const overdueTotal = overdueRentals.reduce((sum, r) => sum + (r.overdue || 0), 0);
  const depositsHeld = metrics.depositsHeld ?? rentals.reduce((sum, r) => sum + (r.depositHeld || 0), 0);
  const depositsHeldCount = metrics.depositsHeldCount ?? rentals.filter((r) => (r.depositHeld || 0) > 0).length;

  // ── Fleet value (kept for the insights section) ─────────────────────────
  const valuedVehicles = vehicles.filter((v) => v.estimatedValue > 0 && v.purchasePrice > 0);
  const totalFleetValue = vehicles.reduce((sum, v) => sum + (v.estimatedValue > 0 ? v.estimatedValue : v.purchasePrice), 0);
  const totalPurchasePrice = vehicles.reduce((sum, v) => sum + v.purchasePrice, 0);
  const totalDepreciation = valuedVehicles.reduce((sum, v) => sum + (v.purchasePrice - v.estimatedValue), 0);
  const totalOperatingProfit = vehicles.reduce((sum, v) => sum + v.profit, 0);

  // ── Fleet at a glance ────────────────────────────────────────────────────
  const groups = groupVehiclesByKind(vehicles, categories);
  const rentedCount = vehicles.filter((v) => v.status === "Rented").length;
  const utilization = vehicles.length > 0 ? Math.round((rentedCount / vehicles.length) * 100) : 0;

  // ── Today: everything that needs doing now, most urgent first ───────────
  const todayItems: AgendaItem[] = [];
  const paperwork: AgendaItem[] = [];
  const paperworkVehicle = new Map<string, string>();
  const upcomingItems: Array<AgendaItem & { sort: string }> = [];
  // A vehicle that is late back puts the next booking for it at risk.
  const sameVehicle = (a: (typeof rentals)[number], b: (typeof rentals)[number]) => (a.vehicleId && b.vehicleId ? a.vehicleId === b.vehicleId : !!a.plate && a.plate === b.plate);
  const lateBack = rentals.filter((r) => r.status !== "Booked" && r.end && r.end !== "Indefinite" && r.end < today);
  const nextBookingFor = (late: (typeof rentals)[number]) =>
    rentals.filter((r) => r.status === "Booked" && r.id !== late.id && sameVehicle(r, late) && r.start <= weekAhead).sort((a, b) => a.start.localeCompare(b.start))[0] || null;
  const blockedBy = (booking: (typeof rentals)[number]) => lateBack.find((late) => late.id !== booking.id && sameVehicle(late, booking)) || null;
  for (const r of rentals) {
    const who = r.customer || t("walkIn");
    if (r.status === "Booked" && r.start <= weekAhead && blockedBy(r)) {
      const late = blockedBy(r)!;
      todayItems.push({
        key: `at-risk-${r.id}`,
        rank: 0,
        tone: "red",
        icon: <KeyRound size={17} />,
        title: t("notBackTitle", { who }),
        detail: `${r.vehicle} · ${r.start === today ? t("handoverDueToday") : r.start < today ? t("handoverWasDueOn", { date: shortDate(r.start) }) : t("handoverOn", { date: shortDate(r.start) })} · ${t("whoWasDueBack", { who: late.customer, date: shortDate(late.end) })}`,
        href: `/bookings/${r.id}`,
        action: t("view")
      });
    } else if (r.status === "Booked" && r.hasCustomer === false) {
      // The link is out but nobody has filled it in: there is no one to hand over to yet.
      if (r.start <= weekAhead) {
        const item = { rank: 3, tone: (r.start <= today ? "red" : "amber") as "red" | "amber", icon: <KeyRound size={17} />, title: t("linkNotFilled", { vehicle: r.vehicle }), href: `/bookings/${r.id}`, action: t("open") };
        if (r.start <= today) todayItems.push({ ...item, key: `link-waiting-${r.id}`, detail: r.start === today ? t("linkStartsToday") : t("linkWasDueToStart", { date: shortDate(r.start) }) });
        else upcomingItems.push({ ...item, key: `link-waiting-${r.id}`, sort: r.start, detail: t("waitingForCustomer"), when: dayLabel(r.start) });
      }
    } else if (r.status === "Booked") {
      if (r.start < today) {
        todayItems.push({ key: `late-out-${r.id}`, rank: 1, tone: "red", icon: <KeyRound size={17} />, title: t("handoverLate", { vehicle: r.vehicle }), detail: t("whoWasDue", { who, date: shortDate(r.start) }), href: `/inspections/delivery/${r.id}`, action: t("handOver") });
      } else if (r.start === today) {
        todayItems.push({ key: `out-${r.id}`, rank: 1, tone: "teal", icon: <KeyRound size={17} />, title: t("handOverVehicle", { vehicle: r.vehicle }), detail: who, href: `/inspections/delivery/${r.id}`, action: t("handOver") });
      } else if (r.start <= weekAhead) {
        upcomingItems.push({ key: `soon-out-${r.id}`, sort: r.start, tone: "teal", icon: <KeyRound size={17} />, title: t("handOverVehicle", { vehicle: r.vehicle }), detail: who, when: dayLabel(r.start), href: `/bookings/${r.id}`, action: t("view") });
      }
    } else if (r.end && r.end !== "Indefinite") {
      if (r.end < today) {
        todayItems.push({ key: `late-in-${r.id}`, rank: 0, tone: "red", icon: <RotateCcw size={17} />, title: t("returnLate", { vehicle: r.vehicle }), detail: `${t("whoWasDueBackDot", { who, date: shortDate(r.end) })}${nextBookingFor(r) ? ` · ${t("bookedFrom", { who: nextBookingFor(r)!.customer, date: shortDate(nextBookingFor(r)!.start) })}` : ""}`, href: `/inspections/return/${r.id}`, action: t("checkIn") });
      } else if (r.end === today) {
        todayItems.push({ key: `in-${r.id}`, rank: 1, tone: "blue", icon: <RotateCcw size={17} />, title: t("comingBack", { vehicle: r.vehicle }), detail: who, href: `/inspections/return/${r.id}`, action: t("checkIn") });
      } else if (r.end <= weekAhead) {
        upcomingItems.push({ key: `soon-in-${r.id}`, sort: r.end, tone: "blue", icon: <RotateCcw size={17} />, title: t("dueBack", { vehicle: r.vehicle }), detail: who, when: dayLabel(r.end), href: `/bookings/${r.id}`, action: t("view") });
      }
    }
  }
  for (const r of overdueRentals) {
    const since = r.overdueSince ? daysBetween(r.overdueSince, today) : 0;
    todayItems.push({
      key: `pay-${r.id}`,
      rank: 3,
      tone: since > 7 ? "red" : "amber",
      icon: <Wallet size={17} />,
      title: t("amountOverdue", { amount: money(r.overdue || 0) }),
      detail: `${r.customer} · ${r.vehicle}${since > 0 ? ` · ${t("daysLate", { days: since })}` : ""}`,
      href: `/bookings/${r.id}`,
      action: t("collect")
    });
  }
  for (const r of receiptsWaiting) {
    todayItems.push({
      key: `receipt-${r.id}`,
      rank: 3,
      tone: "teal",
      icon: <ReceiptText size={17} />,
      title: t("receiptToCheck", { amount: money(r.amount) }),
      detail: [r.customer, r.vehicle].filter(Boolean).join(" · ") || t("customerSaysPaid"),
      href: "/tasks",
      action: t("check")
    });
  }
  for (const v of vehicles) {
    for (const item of v.compliance || []) {
      const name = `${v.make} ${v.model}`;
      const label = c.has(`paper_${item.key}`) ? c(`paper_${item.key}`) : item.label;
      paperworkVehicle.set(`doc-${v.id}-${item.key}`, name);
      if (item.daysLeft <= 7) {
        const service = item.key === "next_service_date";
        paperwork.push({
          key: `doc-${v.id}-${item.key}`,
          rank: 5,
          tone: item.daysLeft < 0 ? "red" : "amber",
          icon: <FileWarning size={17} />,
          title: item.daysLeft < 0 ? t(service ? "paperOverdue" : "paperExpired", { label, name }) : t("paperDue", { label, name }),
          detail: `${v.plate} · ${item.daysLeft < 0 ? t(service ? "overdueSince" : "expiredSince", { date: shortDate(item.date) }) : item.daysLeft === 0 ? t("today") : `${dayLabel(item.date)}`}`,
          href: `/fleet/${v.id}`,
          action: t("update")
        });
      } else if (item.daysLeft <= 30) {
        upcomingItems.push({ key: `soon-doc-${v.id}-${item.key}`, sort: item.date, tone: "neutral", icon: <FileWarning size={17} />, title: t("paperRenewal", { label, name }), detail: v.plate, when: dayLabel(item.date), href: `/fleet/${v.id}`, action: t("view") });
      }
    }
  }
  // A handful of paperwork items are listed one by one; more than that folds
  // into one row so renewals don't bury today's handovers and payments.
  if (paperwork.length <= 2) {
    todayItems.push(...paperwork);
  } else {
    const expired = paperwork.filter((item) => item.tone === "red").length;
    const names = paperwork.map((item) => paperworkVehicle.get(item.key) || "").filter((name, index, all) => name && all.indexOf(name) === index);
    todayItems.push({
      key: "paperwork",
      rank: 5,
      tone: expired > 0 ? "red" : "amber",
      icon: <FileWarning size={17} />,
      title: t("documentsToRenew", { count: paperwork.length }),
      detail: `${expired > 0 ? `${t("expiredCount", { count: expired })} · ` : ""}${names.slice(0, 3).join(", ")}${names.length > 3 ? ` ${t("plusMore", { count: names.length - 3 })}` : ""}`,
      href: "/fleet",
      action: t("review")
    });
  }
  // Jobs from To do that are due now: a customer waiting for an answer, a refund to decide, forms to complete.
  // The first few are listed; the rest are one row, so the dashboard and To do never tell different stories.
  const jobsDue = taskList
    .filter((task) => task.kind === "task" && !task.completedAt && !task.coveredBy && !!task.dueDate && task.dueDate <= today)
    .sort((a, b) => Number(b.action === "request") - Number(a.action === "request") || String(a.dueDate).localeCompare(String(b.dueDate)));
  // Two requests on one booking are answered on the same screen, so they are one row here, not two identical ones.
  const requestsOn = (rentalId?: string | null) => jobsDue.filter((other) => other.action === "request" && !!rentalId && other.rentalId === rentalId).length;
  const jobRows = jobsDue.filter((job, index) => !(job.action === "request" && job.rentalId && jobsDue.findIndex((other) => other.action === "request" && other.rentalId === job.rentalId) !== index));
  for (const job of jobRows.slice(0, 3)) {
    const waiting = job.action === "request";
    const asks = waiting ? requestsOn(job.rentalId) : 0;
    todayItems.push({
      key: `job-${job.id}`,
      rank: waiting ? 2 : 4,
      tone: waiting ? "red" : job.dueDate && job.dueDate < today ? "amber" : "neutral",
      icon: <Bell size={17} />,
      title: waiting ? (asks > 1 ? t("waitingForAnswers", { who: job.customerName || t("aCustomer"), count: asks }) : t("waitingForAnswer", { who: job.customerName || t("aCustomer") })) : job.action === "swap_handover" || job.action === "swap_collection" ? job.title.split(" to ")[0].split(" from ")[0] : job.title.split(" - ")[0],
      detail: [job.customerName, job.vehicleLabel].filter(Boolean).join(" · ") || t("onToDo"),
      href: waiting && job.rentalId ? `/bookings/${job.rentalId}#customer-requests` : "/tasks",
      action: waiting ? t("answer") : t("open")
    });
  }
  if (jobRows.length > 3) {
    todayItems.push({ key: "jobs-more", rank: 6, tone: "neutral", icon: <Bell size={17} />, title: t("moreJobs", { count: jobRows.length - 3 }), detail: t("moreJobsDetail"), href: "/tasks", action: t("open") });
  }
  for (const reminder of reminders) {
    if (reminder.due && reminder.due <= today) {
      todayItems.push({ key: `rem-${reminder.id}`, rank: 5, tone: "neutral", icon: <Bell size={17} />, title: reminder.title, detail: reminder.target, href: "/tasks", action: t("open") });
    }
  }
  const toneOrder: Record<Tone, number> = { red: 0, amber: 1, teal: 2, blue: 3, neutral: 4 };
  // By kind first (a late return and today's handovers before admin jobs, however overdue those are), then by urgency.
  todayItems.sort((a, b) => (a.rank ?? 4) - (b.rank ?? 4) || toneOrder[a.tone] - toneOrder[b.tone]);
  upcomingItems.sort((a, b) => a.sort.localeCompare(b.sort));

  const onRent = rentals.filter((r) => r.status !== "Booked").sort((a, b) => String(a.end).localeCompare(String(b.end)));
  const urgentCount = todayItems.filter((item) => item.tone === "red").length;

  return (
    <AppShell userEmail={userEmail}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-medium text-[var(--muted)]">{headerDate}</p>
          <h1 className="mt-0.5 text-[26px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">{greeting}</h1>
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
            {todayItems.length === 0
              ? t("nothingNeedsYou")
              : urgentCount > 0
                ? t("thingsTodayUrgent", { count: todayItems.length, urgent: urgentCount })
                : t("thingsToday", { count: todayItems.length })}
          </p>
        </div>
        <Link className="pressable inline-flex items-center justify-center gap-2 self-start rounded-[9px] bg-[var(--primary)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] sm:self-auto" href="/bookings/new">
          <Plus size={16} />
          {t("newBooking")}
        </Link>
      </div>

      <PushToggle variant="prompt" />
      {!onboardingStatus.hidden ? (
        <div className="mb-5">
          <OnboardingChecklist
            completedCount={onboardingStatus.completedCount}
            items={onboardingStatus.items}
            organizationId={organization.id}
            totalCount={onboardingStatus.totalCount}
          />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Panel action={<PanelLink href="/calendar">{t("calendar")}</PanelLink>} title={t("todayTitle")}>
            {todayItems.length === 0 ? (
              <div className="flex items-center gap-3 px-4 pb-5 pt-2 text-sm text-[var(--foreground-secondary)]">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--success-light)] text-[var(--success)]">
                  <CheckCircle2 size={18} />
                </span>
                {t("allClear")}
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {todayItems.map((item) => <AgendaRow item={item} key={item.key} />)}
              </ul>
            )}
          </Panel>

          <Panel action={<PanelLink href="/calendar">{t("seeAll")}</PanelLink>} title={t("comingUp")}>
            {upcomingItems.length === 0 ? (
              <p className="flex items-center gap-2 px-4 pb-5 pt-2 text-sm text-[var(--muted)]">
                <CalendarClock size={16} />
                {t("nothingBooked")}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {upcomingItems.slice(0, 8).map((item) => <AgendaRow item={item} key={item.key} />)}
              </ul>
            )}
          </Panel>

          <Panel action={<PanelLink href="/bookings">{t("allBookings")}</PanelLink>} title={t("onRentNow", { count: onRent.length })}>
            {onRent.length === 0 ? (
              <p className="px-4 pb-5 pt-2 text-sm text-[var(--muted)]">{t("nothingOut")}</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {onRent.slice(0, 8).map((r) => {
                  const late = r.end !== "Indefinite" && r.end < today;
                  return (
                    <li key={r.id}>
                      <Link className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--panel-secondary)]" href={`/bookings/${r.id}` as Route}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-[var(--foreground)]">{r.vehicle}</span>
                          <span className="block truncate text-[13px] text-[var(--muted)]">{r.customer}</span>
                        </span>
                        <span className="flex-shrink-0 text-right text-[13px]">
                          <span className={`block ${late ? "font-semibold text-[var(--danger)]" : "text-[var(--foreground-secondary)]"}`}>
                            {r.end === "Indefinite" ? t("openEnded") : late ? t("wasDue", { date: shortDate(r.end) }) : t("until", { date: shortDate(r.end) })}
                          </span>
                          {(r.overdue || 0) > 0 ? (
                            <span className="block font-semibold text-[var(--danger)]">{t("owed", { amount: money(r.overdue || 0) })}</span>
                          ) : (
                            <span className="block text-[var(--muted)]">{t("paidUp")}</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            {onRent.length > 8 ? (
              <div className="border-t border-[var(--border)] px-4 py-2.5 text-center">
                <PanelLink href="/bookings">{t("moreRentals", { count: onRent.length - 8 })}</PanelLink>
              </div>
            ) : null}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel action={<PanelLink href="/fleet">{t("fleet")}</PanelLink>} title={t("yourFleet")}>
            {groups.length === 0 ? (
              <p className="px-4 pb-5 pt-2 text-sm text-[var(--muted)]">
                {t.rich("noVehiclesYet", { link: (chunks) => <Link className="font-semibold text-[var(--primary)]" href="/fleet/new">{chunks}</Link> })}
              </p>
            ) : (
              <div className="space-y-1 px-2 pb-3">
                {groups.map((group) => (
                  <Link className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition hover:bg-[var(--panel-secondary)]" href={`/fleet#${group.kind}` as Route} key={group.kind}>
                    <VehicleKindIcon kind={group.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[14px] font-semibold text-[var(--foreground)]">{c(`kinds_${group.kind}`)}</span>
                        <span className="font-mono-data text-[14px] font-semibold text-[var(--foreground)]">{group.vehicles.length}</span>
                      </span>
                      <span className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-[var(--panel-secondary)]">
                        <span className="bg-[var(--info)]" style={{ width: `${(group.out / group.vehicles.length) * 100}%` }} />
                        <span className="bg-[var(--success)]" style={{ width: `${(group.free / group.vehicles.length) * 100}%` }} />
                        <span className="bg-[var(--warning)]" style={{ width: `${(group.other / group.vehicles.length) * 100}%` }} />
                      </span>
                      <span className="mt-1 block"><OutFreeSummary free={group.free} other={group.other} out={group.out} /></span>
                    </span>
                  </Link>
                ))}
                <p className="px-2 pt-2 text-[13px] text-[var(--muted)]">{t("earning", { percent: utilization })}</p>
              </div>
            )}
          </Panel>

          <Panel action={<PanelLink href="/reports">{t("reports")}</PanelLink>} title={t("moneyThisMonth")}>
            <div className="px-4 pb-4">
              <p className="text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--foreground)]">{money(metrics.monthlyRevenue)}</p>
              <p className="text-[13px] text-[var(--muted)]">
                {t.rich("takenIn", { costs: money(monthlyExpenses), profit: money(monthlyProfit), b: (chunks) => <span className={monthlyProfit < 0 ? "font-semibold text-[var(--danger)]" : "font-semibold text-[var(--success)]"}>{chunks}</span> })}
              </p>
              <div aria-hidden="true" className="mt-4 flex h-20 items-end gap-2">
                {lastSixMonths.map((month) => (
                  <div className="flex flex-1 flex-col items-center gap-1" key={month.key}>
                    <div
                      className={`w-full rounded-t-[5px] ${month.key === thisMonth ? "bg-[var(--primary)]" : "bg-[var(--info-line)]"}`}
                      style={{ height: `${Math.max(4, Math.round((month.amount / maxMonth) * 64))}px` }}
                      title={`${month.label}: ${money(month.amount)}`}
                    />
                    <span className="text-[11px] text-[var(--muted)]">{month.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <dl className="grid grid-cols-2 border-t border-[var(--border)]">
              <Link className="border-r border-[var(--border)] px-4 py-3 transition hover:bg-[var(--panel-secondary)]" href="/tasks">
                <dt className="text-[12px] text-[var(--muted)]">{t("overdue")}</dt>
                <dd className={`font-mono-data text-[16px] font-semibold ${overdueTotal > 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{money(overdueTotal)}</dd>
                <dd className="text-[12px] text-[var(--muted)]">{overdueRentals.length === 0 ? t("allPaid") : t("rentalsCount", { count: overdueRentals.length })}</dd>
              </Link>
              <Link className="px-4 py-3 transition hover:bg-[var(--panel-secondary)]" href="/bookings">
                <dt className="text-[12px] text-[var(--muted)]">{t("depositsHeld")}</dt>
                <dd className="font-mono-data text-[16px] font-semibold text-[var(--foreground)]">{money(depositsHeld)}</dd>
                <dd className="text-[12px] text-[var(--muted)]">{t("customersCount", { count: depositsHeldCount })}</dd>
              </Link>
            </dl>
          </Panel>
        </div>
      </div>

      <details className="group mt-6 rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-[15px] font-semibold text-[var(--foreground)]">
          {t("moreInsights")}
          <span className="text-[13px] font-normal text-[var(--muted)] group-open:hidden">{t("moreInsightsHint")}</span>
        </summary>
        <div className="space-y-4 border-t border-[var(--border)] p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FleetValueCard
              totalDepreciation={totalDepreciation}
              totalFleetValue={totalFleetValue}
              totalPurchasePrice={totalPurchasePrice}
              valuedCount={valuedVehicles.length}
              vehicleCount={vehicles.length}
            />
            <FleetPnLCard fleetNetPnL={-totalDepreciation + totalOperatingProfit} totalDepreciation={totalDepreciation} totalOperatingProfit={totalOperatingProfit} />
          </div>
          <FleetIntelligencePanel averageUtilization={metrics.averageUtilization} vehicles={vehicles} />
          <RouteHQValueWidget data={valueTrackerData} />
          <VehicleTimelinePanel timeline={timeline} />
        </div>
      </details>
    </AppShell>
  );
}
