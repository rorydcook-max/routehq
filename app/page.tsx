import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { dayOfWeekDate, intlLocale, shortDate as shortDateIn } from "@/lib/i18n/dates";
import { ArrowRight, Bell, CalendarClock, CheckCircle2, FileWarning, KeyRound, Plus, ReceiptText, RotateCcw, Wallet, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { businessToday } from "@/lib/business-time";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { OutFreeSummary, VehicleKindIcon } from "@/components/vehicle-kind-icon";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDashboardData, money } from "@/lib/dashboard";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getOnboardingStatus } from "@/lib/onboarding";
import { getReceiptsWaiting } from "@/lib/payment-receipts";
import { getTaskList } from "@/lib/tasks";
import { PushToggle } from "@/components/push-toggle";
import { holdsEndingSoon, releaseExpiredHolds } from "@/lib/booking-holds";
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
  // The pressing ones get a solid button; the rest are outlined so a list of eight is not a wall of blue.
  const solid = item.tone === "red" || item.tone === "teal";
  return (
    <li>
      <Link className="group flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-[var(--panel-secondary)]" href={item.href as Route}>
        <span className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${TONE_CLASSES[item.tone]}`}>{item.icon}</span>
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
  const isOwner = (await getCurrentMembership())?.role !== "teammate";
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
      .then((result: any) => result, () => ({ data: [] }))
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

  // ── Fleet at a glance ────────────────────────────────────────────────────
  const groups = groupVehiclesByKind(vehicles, categories);
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
      title: waiting ? (asks > 1 ? t("waitingForAnswers", { who: job.customerName || t("aCustomer"), count: asks }) : t("waitingForAnswer", { who: job.customerName || t("aCustomer") })) : jobName(job.action) || noPlate(job.action === "swap_handover" || job.action === "swap_collection" ? job.title.split(" to ")[0].split(" from ")[0] : job.title.split(" - ")[0]),
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

  const onRent = rentals.filter((r) => r.status !== "Booked").sort((a, b) => String(a.end).localeCompare(String(b.end)));
  const urgentCount = todayItems.filter((item) => item.tone === "red").length;

  return (
    <AppShell userEmail={userEmail}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--muted)]">{headerDate}</p>
          <h1 className="page-title mt-0.5">{greeting}</h1>
        </div>
        {/* On a phone the + in the bar does this. */}
        <div className="hidden lg:block">
          <Link className="primary-action pressable" href="/bookings/new">
            <Plus size={18} />
            {t("newBooking")}
          </Link>
        </div>
      </div>

      {notice === "owner-only" ? (
        <p className="mb-4 rounded-[var(--radius)] border border-[var(--warning-line)] bg-[var(--warning-light)] px-4 py-3 font-semibold text-[var(--warning)]">{t("ownerOnly")}</p>
      ) : null}

      {/* A business that has not taken a booking yet needs its next step more than it needs empty numbers. */}
      {isOwner && !onboardingStatus.hidden && onboardingStatus.counts.rentals === 0 ? (
        <div className="mb-4">
          <OnboardingChecklist completedCount={onboardingStatus.completedCount} items={onboardingStatus.items} organizationId={organization.id} totalCount={onboardingStatus.totalCount} />
        </div>
      ) : null}

      {/* The two numbers that decide the day, then the money. Nothing below 14px, nothing faded. */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link className={`pressable flex flex-col gap-0.5 rounded-[var(--radius)] p-4 text-white ${urgentCount > 0 ? "bg-[var(--danger)]" : "bg-[var(--success)]"}`} href="/tasks">
          <span className="text-[34px] font-bold leading-none tabular-nums">{urgentCount}</span>
          <span className="font-semibold">{t("tileUrgent")}</span>
        </Link>
        <Link className="pressable flex flex-col gap-0.5 rounded-[var(--radius)] bg-[var(--primary)] p-4 text-white" href="/tasks">
          <span className="text-[34px] font-bold leading-none tabular-nums">{todayItems.length}</span>
          <span className="font-semibold">{t("tileToday")}</span>
        </Link>
      <div className="card col-span-2 flex items-center justify-between gap-4 px-4 py-3.5">
        <Link className="min-w-0" href="/tasks">
          <span className="block font-semibold text-[var(--muted)]">{t("overdue")}</span>
          <span className={`block text-[24px] font-bold leading-tight tabular-nums ${overdueTotal > 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{money(overdueTotal)}</span>
        </Link>
        {isOwner ? (
          <Link className="min-w-0 text-right" href="/reports">
            <span className="block font-semibold text-[var(--muted)]">{t("moneyThisMonth")}</span>
            <span className="block text-[24px] font-bold leading-tight tabular-nums text-[var(--success)]">{money(metrics.monthlyRevenue)}</span>
          </Link>
        ) : (
          <Link className="min-w-0 text-right" href="/bookings">
            <span className="block font-semibold text-[var(--muted)]">{t("depositsHeld")}</span>
            <span className="block text-[24px] font-bold leading-tight tabular-nums text-[var(--foreground)]">{money(depositsHeld)}</span>
          </Link>
        )}
      </div>
      </div>

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

          {/* An empty week is not news: the card only appears when something is coming. */}
          {upcomingItems.length === 0 ? null : (
            <Panel action={<PanelLink href="/calendar">{t("seeAll")}</PanelLink>} title={t("comingUp")}>
              <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {upcomingItems.slice(0, 8).map((item) => <AgendaRow item={item} key={item.key} />)}
              </ul>
            </Panel>
          )}

          <Panel action={<PanelLink href="/bookings">{t("allBookings")}</PanelLink>} title={t("onRentNow", { count: onRent.length })}>
            {onRent.length === 0 ? (
              <p className="px-4 pb-5 pt-2 text-sm text-[var(--muted)]">{t("nothingOut")}</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {onRent.slice(0, 8).map((r) => {
                  const late = r.end !== "Indefinite" && r.end < today;
                  return (
                    <li key={r.id}>
                      <Link className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[var(--panel-secondary)]" href={`/bookings/${r.id}` as Route}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-bold text-[var(--foreground)]">{r.vehicle}</span>
                          <span className="block truncate font-medium text-[var(--foreground-secondary)]">{r.customer}</span>
                        </span>
                        <span className="flex-shrink-0 text-right">
                          <span className={`block font-bold ${late ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
                            {r.end === "Indefinite" ? t("openEnded") : late ? t("wasDue", { date: shortDate(r.end) }) : t("until", { date: shortDate(r.end) })}
                          </span>
                          {(r.overdue || 0) > 0 ? (
                            <span className="block font-bold text-[var(--danger)]">{t("owed", { amount: money(r.overdue || 0) })}</span>
                          ) : null}
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
                <p className="px-2 pt-2 font-medium text-[var(--foreground-secondary)]">{t("earning", { percent: utilization })}</p>
              </div>
            )}
          </Panel>

          {isOwner ? (
          <Panel action={<PanelLink href="/reports">{t("reports")}</PanelLink>} title={t("moneyThisMonth")}>
            <div className="px-4 pb-4">
              <p className="text-[28px] font-bold tabular-nums tracking-[-0.02em] text-[var(--foreground)]">{money(metrics.monthlyRevenue)}</p>
              <p className="font-medium text-[var(--foreground-secondary)]">
                {t.rich("takenIn", { costs: money(monthlyExpenses), profit: money(monthlyProfit), b: (chunks) => <span className={monthlyProfit < 0 ? "font-bold text-[var(--danger)]" : "font-bold text-[var(--success)]"}>{chunks}</span> })}
              </p>
              <div aria-hidden="true" className="mt-4 flex h-20 items-end gap-2">
                {lastSixMonths.map((month) => (
                  <div className="flex flex-1 flex-col items-center gap-1" key={month.key}>
                    <div
                      className={`w-full rounded-t-[5px] ${month.key === thisMonth ? "bg-[var(--primary)]" : "bg-[var(--info-line)]"}`}
                      style={{ height: `${Math.max(4, Math.round((month.amount / maxMonth) * 64))}px` }}
                      title={`${month.label}: ${money(month.amount)}`}
                    />
                    <span className="font-medium text-[var(--muted)]">{month.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <Link className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3.5 transition hover:bg-[var(--panel-secondary)]" href="/bookings">
              <span className="font-semibold text-[var(--foreground-secondary)]">{t("depositsHeld")} · {t("customersCount", { count: depositsHeldCount })}</span>
              <span className="text-[16px] font-bold tabular-nums text-[var(--foreground)]">{money(depositsHeld)}</span>
            </Link>
          </Panel>
          ) : null}
        </div>
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
