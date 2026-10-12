import Link from "next/link";
import type { Route } from "next";
import type { CSSProperties, ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { dayOfWeekDate, intlLocale, shortDate as shortDateIn } from "@/lib/i18n/dates";
import { ArrowRight, Bell, CheckCircle2, Clock3, FileWarning, KeyRound, Lock, Plus, ReceiptText, RotateCcw, Wallet, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { businessToday } from "@/lib/business-time";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDashboardData, money } from "@/lib/dashboard";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { canDecideMoney, getCurrentMembership } from "@/lib/auth/roles";
import { getOnboardingStatus } from "@/lib/onboarding";
import { getReceiptsWaiting } from "@/lib/payment-receipts";
import { getTaskList } from "@/lib/tasks";
import { PushToggle } from "@/components/push-toggle";
import { holdsEndingSoon, releaseExpiredHolds } from "@/lib/booking-holds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isExpenseTransaction, isRevenueTransaction } from "@/lib/transaction-options";
import { kindFromCategory } from "@/lib/vehicle-groups";
import { VehicleArt, paintOf } from "@/components/vehicle-art";
import { Dot, FleetLot, InOutBars, TileHead, WeekPlanner, type LotState, type LotVehicle, type PlannerBar, type PlannerLane } from "@/components/glance";

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

function AgendaRow({ item, art, card = false, delay }: { item: AgendaItem; art?: ReactNode; card?: boolean; delay?: number }) {
  // The pressing ones get a solid button; the rest are outlined so a list of eight is not a wall of colour.
  const solid = item.tone === "red" || item.tone === "teal";
  return (
    <li className={delay === undefined ? undefined : "rise"} style={delay === undefined ? undefined : ({ ["--d" as string]: `${delay}ms` } as CSSProperties)}>
      <Link className={`group flex items-center gap-3.5 transition ${card ? "card pressable p-3" : "px-4 py-3.5 hover:bg-[var(--panel-secondary)]"}`} href={item.href as Route}>
        {art || <span className={`inline-flex flex-shrink-0 items-center justify-center ${card ? "h-11 w-14 rounded-xl" : "h-10 w-10 rounded-xl"} ${TONE_CLASSES[item.tone]}`}>{item.icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold leading-tight text-[var(--foreground)]">{item.title}</span>
          <span className="line-clamp-2 block font-medium text-[var(--foreground-secondary)]">
            {item.detail}
            {item.when ? <span className={item.tone === "red" ? "font-bold text-[var(--danger)]" : ""}> · {item.when}</span> : null}
          </span>
        </span>
        <span className={`inline-flex min-h-10 flex-shrink-0 items-center justify-center rounded-full px-4 font-bold ${solid ? "bg-[var(--primary)] text-white" : "border-2 border-[var(--border-strong)] bg-white text-[var(--foreground)]"}`}>
          {item.action}
        </span>
      </Link>
    </li>
  );
}

function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <h2 className="text-[18px] font-bold tracking-[-0.01em] text-[var(--foreground)]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="inline-flex items-center gap-1 font-bold text-[var(--primary)] hover:underline" href={href as Route}>
      {children}
      <ArrowRight size={16} />
    </Link>
  );
}

export default async function Home({ searchParams }: { searchParams?: Promise<{ notice?: string }> }) {
  const notice = (searchParams ? await searchParams : {}).notice;
  // A teammate sees the day's work and what customers owe, not how the business is doing or its set-up.
  const membership = await getCurrentMembership();
  const isOwner = membership?.role === "owner";
  // Refunds and free days are the owner's or a manager's call: a teammate's day does not list them.
  const canDecide = canDecideMoney(membership?.role);
  // Holds that ran out without a signature give their dates back before anything is counted.
  await getDefaultOrganization().then((org) => releaseExpiredHolds(createSupabaseAdminClient(), org.id)).catch(() => null);
  const endingHolds = await getDefaultOrganization().then((org) => holdsEndingSoon(createSupabaseAdminClient(), org.id)).catch(() => []);
  const [userEmail, organization, dashboardData, supabase, t, c, locale] = await Promise.all([
    getCurrentUserEmail(),
    getDefaultOrganization(),
    getDashboardData(),
    createSupabaseServerClient(),
    getTranslations("dashboard"),
    getTranslations("common"),
    getLocale()
  ]);
  const todo = await getTranslations("todo");
  // Jobs the app raises are saved as English sentences; the kinds it knows are named in the reader's language, as on To do.
  const jobName = (action: string | null | undefined) => (action && todo.has(`job_${action}` as never) ? todo(`job_${action}` as never) : null);
  const shortDate = (value: string) => shortDateIn(value, locale);
  const dayLabel = (value: string) => dayOfWeekDate(value, locale);
  const [onboardingStatus, categories] = await Promise.all([getOnboardingStatus(supabase as any, organization.id), getVehicleCategories(organization.id)]);
  const { metrics, reminders, rentals, transactions, vehicles } = dashboardData;
  const [receiptsWaiting, taskList, unsentResult] = await Promise.all([
    getReceiptsWaiting(organization.id),
    getTaskList(organization.id).catch(() => []),
    // Customer messages the app wrote but could not deliver itself: the owner sends them in a tap.
    (supabase as any)
      .from("communication_log")
      .select("id, rental_id, metadata, customers(full_name)")
      .eq("organisation_id", organization.id)
      .eq("type", "automated_reminder")
      .in("status", ["pending", "failed"])
      .not("rental_id", "is", null)
      .gte("created_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(50)
      .then((result: any) => ({ ...result, data: (result?.data || []).filter((row: any) => !row.metadata?.superseded) }), () => ({ data: [] }))
  ]);
  const unsentByRental = new Map<string, { count: number; who: string }>();
  for (const row of ((unsentResult?.data || []) as any[]).filter((entry) => entry.metadata?.handoff_label)) {
    const found = unsentByRental.get(row.rental_id) || { count: 0, who: String(row.customers?.full_name || "") };
    unsentByRental.set(row.rental_id, { count: found.count + 1, who: found.who });
  }

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

  // Only payments past their due date count as overdue.
  const overdueRentals = [...rentals, ...(dashboardData.closedOverdue || [])].filter((r) => (r.overdue || 0) > 0).sort((a, b) => String(a.overdueSince).localeCompare(String(b.overdueSince)));
  const overdueTotal = overdueRentals.reduce((sum, r) => sum + (r.overdue || 0), 0);
  const depositsHeld = metrics.depositsHeld ?? rentals.reduce((sum, r) => sum + (r.depositHeld || 0), 0);

  // ── Fleet at a glance ────────────────────────────────────────────────────
  const rentedCount = vehicles.filter((v) => v.status === "Rented").length;
  const utilization = vehicles.length > 0 ? Math.round((rentedCount / vehicles.length) * 100) : 0;

  // ── Today: everything that needs doing now, most urgent first ───────────
  const todayItems: AgendaItem[] = [];
  const paperwork: AgendaItem[] = [];
  // Plates stay on the booking and vehicle pages; here the name is enough.
  const noPlate = (label: string | null | undefined) => (label ? label.split(" · ")[0].replace(/\s*\([^)]*\)\s*$/, "") : "");
  const paperworkVehicle = new Map<string, string>();
  const upcomingItems: Array<AgendaItem & { sort: string }> = [];
  // A vehicle that is late back puts the next booking for it at risk.
  const sameVehicle = (a: (typeof rentals)[number], b: (typeof rentals)[number]) => (a.vehicleId && b.vehicleId ? a.vehicleId === b.vehicleId : !!a.plate && a.plate === b.plate);
  const lateBack = rentals.filter((r) => r.status !== "Booked" && r.end && r.end !== "Indefinite" && r.end < today);
  const nextBookingFor = (late: (typeof rentals)[number]) =>
    rentals.filter((r) => r.status === "Booked" && r.id !== late.id && sameVehicle(r, late) && r.start <= weekAhead).sort((a, b) => a.start.localeCompare(b.start))[0] || null;
  const blockedBy = (booking: (typeof rentals)[number]) => lateBack.find((late) => late.id !== booking.id && sameVehicle(late, booking)) || null;
  // A handover on the day the same vehicle comes back from someone else leaves no slack: say so on the handover.
  const sameDayReturn = (booking: (typeof rentals)[number]) => rentals.find((other) => other.id !== booking.id && other.status !== "Booked" && other.end === booking.start && sameVehicle(other, booking)) || null;
  const tight = (booking: (typeof rentals)[number], who: string) => (sameDayReturn(booking) ? `${who} · ${t("backSameDay", { who: sameDayReturn(booking)!.customer || t("aCustomer") })}` : who);
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
        todayItems.push({ key: `out-${r.id}`, rank: 1, tone: "teal", icon: <KeyRound size={17} />, title: t("handOverVehicle", { vehicle: r.vehicle }), detail: tight(r, who), href: `/inspections/delivery/${r.id}`, action: t("handOver") });
      } else if (r.start <= weekAhead) {
        upcomingItems.push({ key: `soon-out-${r.id}`, sort: r.start, tone: "teal", icon: <KeyRound size={17} />, title: t("handOverVehicle", { vehicle: r.vehicle }), detail: tight(r, who), when: dayLabel(r.start), href: `/bookings/${r.id}`, action: t("view") });
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
      detail: `${r.customer} · ${noPlate(r.vehicle)}`,
      when: since > 0 ? t("daysLate", { days: since }) : undefined,
      href: `/bookings/${r.id}`,
      action: t("collect")
    });
  }
  for (const hold of endingHolds) {
    todayItems.push({
      key: `hold-${hold.rentalId}`,
      rank: 3,
      tone: "amber",
      icon: <Bell size={17} />,
      title: t("holdEnding", { vehicle: hold.vehicle, time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date(hold.holdUntil)) }),
      detail: hold.who ? t("holdEndingDetail", { who: hold.who }) : t("waitingForCustomer"),
      href: `/bookings/${hold.rentalId}`,
      action: t("open")
    });
  }
  // At most two rows: these are reminders to pass on, not the day's work.
  for (const [rentalId, unsent] of [...unsentByRental].slice(0, 2)) {
    todayItems.push({
      key: `unsent-${rentalId}`,
      rank: 5,
      tone: "neutral",
      icon: <MessageCircle size={17} />,
      title: t("messagesToSend", { count: unsent.count, who: unsent.who || t("aCustomer") }),
      detail: t("messagesToSendDetail"),
      href: `/bookings/${rentalId}#unsent-messages`,
      action: t("open")
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
          detail: item.daysLeft < 0 ? t(service ? "overdueSince" : "expiredSince", { date: shortDate(item.date) }) : item.daysLeft === 0 ? t("today") : `${dayLabel(item.date)}`,
          href: `/fleet/${v.id}`,
          action: t("update")
        });
      } else if (item.daysLeft <= 30) {
        upcomingItems.push({ key: `soon-doc-${v.id}-${item.key}`, sort: item.date, tone: "neutral", icon: <FileWarning size={17} />, title: t("paperRenewal", { label, name }), detail: dayLabel(item.date), href: `/fleet/${v.id}`, action: t("view") });
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
    .filter((task) => canDecide || !["refund", "waive_early", "owed_early"].includes(String(task.action || "")))
    .sort((a, b) => Number(b.action === "request") - Number(a.action === "request") || String(a.dueDate).localeCompare(String(b.dueDate)));
  // Two requests on one booking are answered on the same screen, so they are one row here, not two identical ones.
  const requestsOn = (rentalId?: string | null) => jobsDue.filter((other) => other.action === "request" && !!rentalId && other.rentalId === rentalId).length;
  const jobRows = jobsDue.filter((job, index) => !(job.action === "request" && job.rentalId && jobsDue.findIndex((other) => other.action === "request" && other.rentalId === job.rentalId) !== index));
  for (const job of jobRows.slice(0, 3)) {
    const waiting = job.action === "request";
    const asks = waiting ? requestsOn(job.rentalId) : 0;
    // A breakdown or damage report is not "a question": it says what it is, and it goes to the very top.
    const problem = waiting && jobsDue.some((other) => other.action === "request" && other.taskType === "maintenance" && (other.id === job.id || (!!job.rentalId && other.rentalId === job.rentalId)));
    todayItems.push({
      key: `job-${job.id}`,
      rank: problem ? 0 : waiting ? 2 : 4,
      tone: waiting ? "red" : job.dueDate && job.dueDate < today ? "amber" : "neutral",
      icon: <Bell size={17} />,
      title: problem ? t("reportsProblem", { who: job.customerName || t("aCustomer") }) : waiting ? (asks > 1 ? t("waitingForAnswers", { who: job.customerName || t("aCustomer"), count: asks }) : t("waitingForAnswer", { who: job.customerName || t("aCustomer") })) : jobName(job.action) || noPlate(job.action === "swap_handover" || job.action === "swap_collection" ? job.title.split(" to ")[0].split(" from ")[0] : job.title.split(" - ")[0]),
      detail: [waiting ? null : job.customerName, noPlate(job.vehicleLabel)].filter(Boolean).join(" · ") || t("onToDo"),
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

  const urgentCount = todayItems.filter((item) => item.tone === "red").length;

  // ── Pictures: each job about a vehicle shows it ─────────────────────────
  const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
  const rentalById = new Map([...rentals, ...(dashboardData.closedOverdue || [])].map((r) => [r.id, r]));
  const jobById = new Map(taskList.map((task) => [task.id, task]));
  const vehicleOf = (item: AgendaItem) => {
    const match = item.key.match(/^(?:at-risk|link-waiting|late-out|out|soon-out|late-in|in|soon-in|pay)-(.+)$/);
    if (match) return vehicleById.get(String(rentalById.get(match[1])?.vehicleId || "")) || null;
    const doc = item.key.match(/^(?:soon-)?doc-([0-9a-f-]{36})-/);
    if (doc) return vehicleById.get(doc[1]) || null;
    const job = item.key.match(/^job-(.+)$/);
    if (job) {
      const task = jobById.get(job[1]);
      return vehicleById.get(String(task?.vehicleId || rentalById.get(String(task?.rentalId || ""))?.vehicleId || "")) || null;
    }
    return null;
  };
  const artFor = (item: AgendaItem) => {
    const vehicle = vehicleOf(item);
    if (!vehicle) return null;
    const category = categories.find((entry: any) => entry.id === vehicle.categoryId) || null;
    return <VehicleArt colour={vehicle.color} kind={kindFromCategory(category as any)} model={vehicle.model} size="sm" />;
  };

  // ── The week ahead, for the band: what goes out and comes back each day ──
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index);
    const date = new Date(`${day}T00:00:00Z`);
    return {
      day,
      out: rentals.filter((r) => r.status === "Booked" && String(r.start || "").slice(0, 10) === day).length,
      back: rentals.filter((r) => r.status !== "Booked" && r.end !== "Indefinite" && String(r.end || "").slice(0, 10) === day).length,
      name: ((short) => (short.replace(/\.$/, "").length > 4 ? new Intl.DateTimeFormat(intlLocale(locale), { weekday: "narrow", timeZone: "UTC" }).format(date) : short))(new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: "UTC" }).format(date)),
      number: date.getUTCDate()
    };
  });
  // ── The week planner: one lane per vehicle, who has it and when it changes hands ──
  const weekEnd = addDays(today, 6);
  const firstName = (name: string | null | undefined) => String(name || "").trim().split(/\s+/)[0] || t("walkIn");
  const lanesAll = vehicles.map((v) => {
    const bars: PlannerBar[] = [];
    for (const r of rentals.filter((entry) => entry.vehicleId === v.id)) {
      const startDay = String(r.start || "").slice(0, 10);
      const onRoad = r.status !== "Booked";
      const lateBackHere = onRoad && r.end !== "Indefinite" && r.end < today;
      const endDay = r.end === "Indefinite" || lateBackHere ? weekEnd : String(r.end || "").slice(0, 10);
      if (!startDay || startDay > weekEnd || endDay < today) continue;
      const from = Math.max(0, daysBetween(today, startDay));
      const to = Math.min(6, daysBetween(today, endDay));
      const lateOut = !onRoad && startDay < today;
      bars.push({
        start: from,
        length: Math.max(1, to - from + 1),
        label: firstName(r.customer),
        kind: lateBackHere || lateOut ? "late" : onRoad ? "rent" : "next",
        back: onRoad && !lateBackHere && r.end !== "Indefinite" && r.end <= weekEnd,
        href: `/bookings/${r.id}`,
        title: `${r.customer || t("walkIn")} · ${shortDate(startDay)} – ${r.end === "Indefinite" ? t("openEnded") : shortDate(String(r.end))}`
      });
    }
    // A return and the next handover on the same day share it: the first bar stops where the next one starts.
    bars.sort((a, b) => a.start - b.start);
    for (let index = 0; index < bars.length - 1; index++) {
      if (bars[index].start + bars[index].length > bars[index + 1].start && bars[index + 1].start > bars[index].start) bars[index].length = bars[index + 1].start - bars[index].start;
    }
    return { id: v.id, name: v.model || v.make, paint: paintOf(v.color) || "var(--primary)", href: `/fleet/${v.id}`, bars } as PlannerLane;
  });
  const lanes = [...lanesAll.filter((lane) => lane.bars.length > 0), ...lanesAll.filter((lane) => lane.bars.length === 0)].slice(0, 8);
  const moreLanes = lanesAll.length - lanes.length;

  // ── Tiles: one thing each, readable at a glance ──
  const monthName = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", timeZone: "UTC" }).format(new Date(`${today}T00:00:00Z`));
  const lastMonthDate = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1));
  const lastMonth = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
  // Compared with the same point last month, so the 5th is not measured against a whole month.
  const sameDayLastMonth = `${lastMonth}-${today.slice(8, 10)}`;
  const isIn = (x: (typeof transactions)[number]) => isRevenueTransaction({ amount: x.amount, isDeposit: x.isDeposit, type: x.rawType || x.type });
  const isOut = (x: (typeof transactions)[number]) => isExpenseTransaction({ isDeposit: x.isDeposit, type: x.rawType || x.type });
  const lastMonthSoFar = transactions.filter((x) => String(x.date || "").slice(0, 7) === lastMonth && String(x.date || "") <= sameDayLastMonth);
  const lastMonthProfit = lastMonthSoFar.filter(isIn).reduce((sum, x) => sum + x.amount, 0) - lastMonthSoFar.filter(isOut).reduce((sum, x) => sum + Math.abs(x.amount), 0);
  const profitChange = monthlyProfit - lastMonthProfit;
  // Five weeks, Monday to Sunday, the last one being this week.
  const mondayOffset = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weeks = Array.from({ length: 5 }, (_, index) => {
    const from = addDays(today, -mondayOffset - (4 - index) * 7);
    const to = addDays(from, 6);
    const inWeek = transactions.filter((x) => String(x.date || "").slice(0, 10) >= from && String(x.date || "").slice(0, 10) <= to);
    return { key: from, label: shortDate(from), in: inWeek.filter(isIn).reduce((sum, x) => sum + x.amount, 0), out: inWeek.filter(isOut).reduce((sum, x) => sum + Math.abs(x.amount), 0) };
  });
  const nextBack = rentals.filter((r) => r.status !== "Booked" && r.end !== "Indefinite" && r.end >= today).sort((a, b) => String(a.end).localeCompare(String(b.end)))[0] || null;
  const nextOut = rentals.filter((r) => r.status === "Booked" && String(r.start || "") >= today).sort((a, b) => String(a.start).localeCompare(String(b.start)))[0] || null;
  const unsentTotal = [...unsentByRental.values()].reduce((sum, entry) => sum + entry.count, 0);
  const firstUnsent = [...unsentByRental.keys()][0];
  const vehicleArtFor = (vehicleId: string | null | undefined) => {
    const vehicle = vehicleById.get(String(vehicleId || ""));
    if (!vehicle) return null;
    const category = categories.find((entry: any) => entry.id === vehicle.categoryId) || null;
    return <VehicleArt colour={vehicle.color} kind={kindFromCategory(category as any)} model={vehicle.model} size="md" />;
  };

  const lot: LotVehicle[] = vehicles.map((v) => {
    const current = rentals.find((r) => r.vehicleId === v.id && r.status !== "Booked") || null;
    const next = rentals.filter((r) => r.vehicleId === v.id && r.status === "Booked").sort((a, b) => String(a.start).localeCompare(String(b.start)))[0] || null;
    const who = (r: (typeof rentals)[number]) => r.customer || t("walkIn");
    let state: LotState = "free";
    let tip = `${v.make} ${v.model} · ${t("lotFree")}`;
    if (current && current.end !== "Indefinite" && current.end < today) {
      state = "late";
      tip = t("lotTipLate", { who: who(current), date: shortDate(String(current.end)) });
    } else if (current && current.end === today) {
      state = "back";
      tip = t("lotTipBack", { who: who(current) });
    } else if (next && String(next.start).slice(0, 10) <= today) {
      state = "out";
      tip = t("lotTipOut", { who: who(next) });
    } else if (current) {
      state = "rent";
      tip = current.end === "Indefinite" ? t("lotTipOpen", { who: who(current) }) : t("lotTipUntil", { who: who(current), date: shortDate(String(current.end)) });
    } else if (String(v.status) === "Maintenance") {
      state = "off";
      tip = `${v.make} ${v.model} · ${t("lotOff")}`;
    } else if (next) {
      tip = t("lotTipFreeUntil", { date: shortDate(String(next.start).slice(0, 10)) });
    }
    const category = categories.find((entry: any) => entry.id === v.categoryId) || null;
    return {
      id: v.id,
      name: v.model || v.make,
      art: <VehicleArt colour={v.color} kind={kindFromCategory(category as any)} model={v.model} size="sm" />,
      state,
      tip: `${v.model || v.make}: ${tip}`,
      href: current ? `/bookings/${current.id}` : next ? `/bookings/${next.id}` : `/fleet/${v.id}`
    };
  });
  const pill = (count: number, label: string, dot?: string) => (
    <span className="inline-flex items-center gap-1.5 rounded-2xl bg-[var(--band-soft)] px-3 py-2 text-white">
      {dot ? <Dot color={dot} /> : null}
      <span className="num text-[22px] leading-none">{count}</span>
      <span className="font-semibold">{label}</span>
    </span>
  );
  const hero = (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6 lg:pb-2">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white/90">{headerDate}</p>
        <h1 className="mt-0.5 text-[34px] leading-[1.05] tracking-[-0.025em] text-white lg:text-[44px]">{greeting}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {urgentCount > 0 ? pill(urgentCount, t("pillUrgent"), "#f6b7a3") : null}
          {pill(todayItems.length, t("pillToDo"))}
          {pill(weekDays[0].out, t("pillOut"), "var(--going-out)")}
          {pill(weekDays[0].back, t("pillBack"), "var(--coming-back)")}
        </div>
      </div>
      {/* On a phone the + in the bar does this. */}
      <Link className="pressable hidden min-h-11 items-center gap-2 rounded-full bg-[var(--band-action)] px-5 font-bold text-[var(--band-action-ink)] lg:inline-flex" href="/bookings/new">
        <Plus size={18} />
        {t("newBooking")}
      </Link>
    </div>
  );

  const firstOverdue = overdueRentals[0];
  const smallTiles: Array<{ key: string; node: ReactNode }> = [];
  smallTiles.push({
    key: "owed",
    node:
      overdueTotal > 0 ? (
        <Link className="card pressable tile p-4 tile-brick" href={(overdueRentals.length === 1 ? `/bookings/${firstOverdue.id}` : "/tasks") as Route}>
          <TileHead icon={<Clock3 size={22} />} title={t("overdue")} />
          <span>
            <span className="num block text-[28px] leading-tight">{money(overdueTotal)}</span>
            <span className="font-semibold">{overdueRentals.length === 1 ? firstName(firstOverdue.customer) : t("customersCount", { count: overdueRentals.length })}</span>
          </span>
        </Link>
      ) : (
        <Link className="card pressable tile p-4 tile-green" href="/bookings">
          <TileHead title={t("allPaid")} />
          <span className="flex items-center gap-3">
            <span className="inline-flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white shadow-[0_6px_16px_rgba(43,107,71,0.28)]">
              <CheckCircle2 size={28} strokeWidth={2.4} />
            </span>
            <span className="font-semibold">{t("nobodyOwes")}</span>
          </span>
        </Link>
      )
  });
  const backOrOut = nextBack || nextOut;
  if (backOrOut) {
    const back = backOrOut === nextBack;
    const day = back ? String(backOrOut.end) : String(backOrOut.start).slice(0, 10);
    smallTiles.push({
      key: "next",
      node: (
        <Link className={`card pressable tile p-4 ${back ? "tile-sky" : "tile-mango"}`} href={`/bookings/${backOrOut.id}` as Route}>
          <span className="flex items-center gap-2 text-[15px] font-bold"><Dot color={back ? "var(--coming-back)" : "var(--going-out)"} />{day === today ? t(back ? "backToday" : "outToday") : t(back ? "backOn" : "outOn", { day: dayLabel(day) })}</span>
          <span className="flex justify-center">{vehicleArtFor(backOrOut.vehicleId)}</span>
          <span className="line-clamp-2 font-semibold">{t(back ? "vehicleFrom" : "vehicleTo", { vehicle: noPlate(backOrOut.vehicle), who: firstName(backOrOut.customer) })}</span>
        </Link>
      )
    });
  }
  if (unsentTotal > 0 && firstUnsent) {
    smallTiles.push({
      key: "messages",
      node: (
        <Link className="card pressable tile p-4 tile-plum" href={`/bookings/${firstUnsent}#unsent-messages` as Route}>
          <TileHead icon={<MessageCircle size={22} />} title={t("messagesTile")} />
          <span>
            <span className="num block text-[36px] leading-none">{unsentTotal}</span>
            <span className="font-semibold">{t("messagesReady")}</span>
          </span>
        </Link>
      )
    });
  }
  if (depositsHeld > 0) {
    smallTiles.push({
      key: "deposits",
      node: (
        <Link className="card pressable tile p-4 tile-sky" href="/bookings">
          <TileHead icon={<Lock size={22} />} title={t("depositsHeld")} />
          <span>
            <span className="num block text-[26px] leading-tight">{money(depositsHeld)}</span>
            <span className="font-semibold">{t("depositsNote")}</span>
          </span>
        </Link>
      )
    });
  }
  const moneyTile = isOwner ? (
    <Link className="card pressable rise col-span-2 block p-4 text-[var(--foreground)]" href="/reports" key="money" style={{ ["--d" as string]: "260ms" } as CSSProperties}>
      <span className="block text-[15px] font-bold">{t("monthSoFar", { month: monthName })}</span>
      <span className={`num mt-1 block text-[32px] leading-tight ${monthlyProfit < 0 ? "text-[var(--danger)]" : ""}`}>{money(monthlyProfit)}</span>
      {lastMonthSoFar.length > 0 ? (
        <span className={`block font-bold ${profitChange < 0 ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
          {profitChange < 0 ? t("profitDown", { amount: money(Math.abs(profitChange)) }) : t("profitUp", { amount: money(profitChange) })}
        </span>
      ) : (
        <span className="block font-bold text-[var(--foreground-secondary)]">{t("profitLabel")}</span>
      )}
      <span className="mt-2.5 flex gap-4 font-semibold text-[var(--foreground-secondary)]">
        <span className="inline-flex items-center gap-1.5"><Dot color="var(--chart-in)" />{t("moneyIn")} {money(metrics.monthlyRevenue)}</span>
        <span className="inline-flex items-center gap-1.5"><Dot color="var(--chart-out)" />{t("moneyOut")} {money(monthlyExpenses)}</span>
      </span>
      <InOutBars label={t("inOutWeeks")} money={money} periods={weeks} />
    </Link>
  ) : null;
  // Two to a row; an odd one out takes the whole row rather than leave a gap.
  const tiles = [
    ...smallTiles.slice(0, 2).map((tile, index) => <div className="rise min-w-0 [&>a]:h-full [&>div]:h-full [&>span]:h-full" key={tile.key} style={{ ["--d" as string]: `${120 + index * 70}ms` } as CSSProperties}>{tile.node}</div>),
    moneyTile,
    ...smallTiles.slice(2).map((tile, index, rest) => (
      <div className={`rise min-w-0 [&>a]:h-full ${index === rest.length - 1 && rest.length % 2 === 1 ? "col-span-2" : ""}`} key={tile.key} style={{ ["--d" as string]: `${330 + index * 70}ms` } as CSSProperties}>{tile.node}</div>
    ))
  ];

  return (
    <AppShell heroOverlap hero={hero} userEmail={userEmail}>

      {notice === "owner-only" ? (
        <p className="mb-4 rounded-[var(--radius)] border border-[var(--warning-line)] bg-[var(--warning-light)] px-4 py-3 font-semibold text-[var(--warning)]">{t("ownerOnly")}</p>
      ) : null}

      {/* A business that has not taken a booking yet needs its next step more than it needs empty numbers. */}
      {isOwner && !onboardingStatus.hidden && onboardingStatus.counts.rentals === 0 ? (
        <div className="mb-4">
          <OnboardingChecklist completedCount={onboardingStatus.completedCount} items={onboardingStatus.items} organizationId={organization.id} totalCount={onboardingStatus.totalCount} />
        </div>
      ) : null}

      {/* Phones: the week, then the tiles, then the day. Computers: the week and the day on the left, the tiles in a column on the right, both rising over the band. */}
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 space-y-5 lg:col-span-7 2xl:col-span-8">
          {lanes.length > 0 ? (
            <section className="card rise relative -mt-12 p-3 pb-2 lg:-mt-16 lg:p-5 lg:pb-3">
              <header className="flex items-baseline justify-between gap-3 px-1 pb-2">
                <h2 className="text-[20px] text-[var(--foreground)] lg:text-[22px]">{t("thisWeek")}</h2>
                <PanelLink href="/calendar">{t("calendar")}</PanelLink>
              </header>
              <WeekPlanner
                days={weekDays.map((day) => ({ key: day.day, name: day.name, number: day.number }))}
                lanes={lanes}
                legend={[
                  { color: "var(--on-rent)", label: t("legendOnRent") },
                  { color: "var(--going-out)", label: t("weekOut") },
                  { color: "var(--coming-back)", label: t("weekBack") },
                  ...(lanes.some((lane) => lane.bars.some((bar) => bar.kind === "late")) ? [{ color: "var(--danger)", label: t("legendLate") }] : [])
                ]}
              />
              {moreLanes > 0 ? (
                <p className="px-1 pb-1 pt-1"><PanelLink href="/calendar">{t("moreOnCalendar", { count: moreLanes })}</PanelLink></p>
              ) : null}
            </section>
          ) : null}

          {lot.length > 0 ? (
            <FleetLot
              action={<PanelLink href="/fleet">{t("fleet")}</PanelLink>}
              labels={{ late: t("legendLate"), back: t("weekBack"), rent: t("legendOnRent"), out: t("weekOut"), free: t("lotFree"), off: t("lotOff") }}
              title={t("yourFleet")}
              vehicles={lot}
            />
          ) : null}

          {/* On a phone the tiles come straight after the week. */}
          <div className="grid grid-cols-2 gap-3 lg:hidden">{tiles}</div>

          <section>
            <header className="mb-2.5 flex items-center justify-between gap-3 px-1">
              <h2 className="text-[22px] text-[var(--foreground)]">{t("todayTitle")}</h2>
              <PanelLink href="/tasks">{t("allJobs")}</PanelLink>
            </header>
            {todayItems.length === 0 ? (
              <div className="card rise flex items-center gap-3 p-4 text-[var(--foreground-secondary)]">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--success-light)] text-[var(--success)]">
                  <CheckCircle2 size={20} />
                </span>
                {t("allClear")}
              </div>
            ) : (
              <ul className="card rise divide-y divide-[var(--border)] overflow-hidden p-0" style={{ ["--d" as string]: "180ms" } as CSSProperties}>
                {todayItems.map((item) => <AgendaRow art={artFor(item)} item={item} key={item.key} />)}
              </ul>
            )}
          </section>

          {/* An empty week is not news: the card only appears when something is coming. */}
          {upcomingItems.length === 0 ? null : (
            <Panel action={<PanelLink href="/calendar">{t("seeAll")}</PanelLink>} title={t("comingUp")}>
              <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {upcomingItems.slice(0, 8).map((item) => <AgendaRow art={artFor(item)} item={item} key={item.key} />)}
              </ul>
            </Panel>
          )}
        </div>

        {/* On a computer the tiles stand in their own column beside the week. */}
        <aside className="hidden min-w-0 content-start gap-3 lg:col-span-5 lg:-mt-16 lg:grid lg:grid-cols-2 2xl:col-span-4">{tiles}</aside>
      </div>

      <div className="mt-6 space-y-4">
        <PushToggle variant="prompt" />
        {isOwner && !onboardingStatus.hidden && onboardingStatus.counts.rentals > 0 ? (
          <OnboardingChecklist
            firstBookingTaken
            completedCount={onboardingStatus.completedCount}
            items={onboardingStatus.items}
            organizationId={organization.id}
            totalCount={onboardingStatus.totalCount}
          />
        ) : null}
      </div>

    </AppShell>
  );
}
