import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
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
import { getPendingBookingRequests } from "@/lib/public-catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isExpenseTransaction, isRevenueTransaction } from "@/lib/transaction-options";
import { groupVehiclesByKind } from "@/lib/vehicle-groups";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-09-27" -> "27 Sep". */
function shortDate(value: string) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]}`;
}

/** "2026-09-30" -> "Tue 30 Sep". */
function dayLabel(value: string) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const weekday = WEEKDAYS[new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()];
  return `${weekday} ${shortDate(value)}`;
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

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
};

const TONE_CLASSES: Record<Tone, string> = {
  red: "bg-[var(--danger-light)] text-[var(--danger)]",
  amber: "bg-[var(--warning-light)] text-[var(--warning)]",
  teal: "bg-[var(--primary-light)] text-[var(--primary)]",
  blue: "bg-[#eef2fb] text-[#2f6fdb]",
  neutral: "bg-[#f1efeb] text-[#6b675f]"
};

function AgendaRow({ item }: { item: AgendaItem }) {
  return (
    <li>
      <Link className="group flex items-center gap-3 px-4 py-3 transition hover:bg-[#fbfaf8]" href={item.href as Route}>
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
  const [userEmail, organization, dashboardData, supabase] = await Promise.all([
    getCurrentUserEmail(),
    getDefaultOrganization(),
    getDashboardData(),
    createSupabaseServerClient()
  ]);
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
  const [receiptsWaiting, bookingRequests] = await Promise.all([getReceiptsWaiting(organization.id), getPendingBookingRequests(organization.id)]);

  const now = new Date();
  const today = businessToday();
  const weekAhead = addDays(today, 7);
  const bangkokHour = (now.getUTCHours() + 7) % 24;
  const greeting = bangkokHour < 12 ? "Good morning" : bangkokHour < 18 ? "Good afternoon" : "Good evening";
  const headerDate = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" });

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
    return { key, label: MONTHS[month.getUTCMonth()], amount: revenueByMonth.get(key) || 0 };
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
  const upcomingItems: Array<AgendaItem & { sort: string }> = [];
  for (const r of rentals) {
    const who = r.customer || "Walk-in customer";
    if (r.status === "Booked") {
      if (r.start < today) {
        todayItems.push({ key: `late-out-${r.id}`, tone: "red", icon: <KeyRound size={17} />, title: `Handover late · ${r.vehicle}`, detail: `${who} · was due ${shortDate(r.start)}`, href: `/inspections/delivery/${r.id}`, action: "Hand over" });
      } else if (r.start === today) {
        todayItems.push({ key: `out-${r.id}`, tone: "teal", icon: <KeyRound size={17} />, title: `Hand over ${r.vehicle}`, detail: who, href: `/inspections/delivery/${r.id}`, action: "Hand over" });
      } else if (r.start <= weekAhead) {
        upcomingItems.push({ key: `soon-out-${r.id}`, sort: r.start, tone: "teal", icon: <KeyRound size={17} />, title: `Hand over ${r.vehicle}`, detail: who, when: dayLabel(r.start), href: `/bookings/${r.id}`, action: "View" });
      }
    } else if (r.end && r.end !== "Indefinite") {
      if (r.end < today) {
        todayItems.push({ key: `late-in-${r.id}`, tone: "red", icon: <RotateCcw size={17} />, title: `Return late · ${r.vehicle}`, detail: `${who} · was due back ${shortDate(r.end)}`, href: `/inspections/return/${r.id}`, action: "Check in" });
      } else if (r.end === today) {
        todayItems.push({ key: `in-${r.id}`, tone: "blue", icon: <RotateCcw size={17} />, title: `${r.vehicle} coming back`, detail: who, href: `/inspections/return/${r.id}`, action: "Check in" });
      } else if (r.end <= weekAhead) {
        upcomingItems.push({ key: `soon-in-${r.id}`, sort: r.end, tone: "blue", icon: <RotateCcw size={17} />, title: `${r.vehicle} due back`, detail: who, when: dayLabel(r.end), href: `/bookings/${r.id}`, action: "View" });
      }
    }
  }
  for (const r of overdueRentals) {
    const since = r.overdueSince ? daysBetween(r.overdueSince, today) : 0;
    todayItems.push({
      key: `pay-${r.id}`,
      tone: since > 7 ? "red" : "amber",
      icon: <Wallet size={17} />,
      title: `${money(r.overdue || 0)} overdue`,
      detail: `${r.customer} · ${r.vehicle}${since > 0 ? ` · ${plural(since, "day")} late` : ""}`,
      href: `/bookings/${r.id}`,
      action: "Collect"
    });
  }
  for (const request of bookingRequests) {
    todayItems.push({
      key: `request-${request.id}`,
      tone: "teal",
      icon: <CalendarClock size={17} />,
      title: `Booking request · ${request.vehicleName}`,
      detail: `${request.customerName} · ${request.endDate ? `${shortDate(request.startDate)} to ${shortDate(request.endDate)}` : `from ${shortDate(request.startDate)}`}`,
      href: "/bookings",
      action: "Answer"
    });
  }
  for (const r of receiptsWaiting) {
    todayItems.push({
      key: `receipt-${r.id}`,
      tone: "teal",
      icon: <ReceiptText size={17} />,
      title: `Receipt to check · ${money(r.amount)}`,
      detail: [r.customer, r.vehicle].filter(Boolean).join(" · ") || "Customer says they have paid",
      href: "/tasks",
      action: "Check"
    });
  }
  for (const v of vehicles) {
    for (const item of v.compliance || []) {
      const name = `${v.make} ${v.model}`;
      if (item.daysLeft <= 7) {
        const lapsed = item.label === "Service" ? "overdue" : "expired";
        paperwork.push({
          key: `doc-${v.id}-${item.key}`,
          tone: item.daysLeft < 0 ? "red" : "amber",
          icon: <FileWarning size={17} />,
          title: item.daysLeft < 0 ? `${item.label} ${lapsed} · ${name}` : `${item.label} due · ${name}`,
          detail: `${v.plate} · ${item.daysLeft < 0 ? `${lapsed} since ${shortDate(item.date)}` : item.daysLeft === 0 ? "today" : `${dayLabel(item.date)}`}`,
          href: `/fleet/${v.id}`,
          action: "Update"
        });
      } else if (item.daysLeft <= 30) {
        upcomingItems.push({ key: `soon-doc-${v.id}-${item.key}`, sort: item.date, tone: "neutral", icon: <FileWarning size={17} />, title: `${item.label} renewal · ${name}`, detail: v.plate, when: dayLabel(item.date), href: `/fleet/${v.id}`, action: "View" });
      }
    }
  }
  // A handful of paperwork items are listed one by one; more than that folds
  // into one row so renewals don't bury today's handovers and payments.
  if (paperwork.length <= 2) {
    todayItems.push(...paperwork);
  } else {
    const expired = paperwork.filter((item) => item.tone === "red").length;
    const names = Array.from(new Set(paperwork.map((item) => item.title.split(" · ")[1])));
    todayItems.push({
      key: "paperwork",
      tone: expired > 0 ? "red" : "amber",
      icon: <FileWarning size={17} />,
      title: `${plural(paperwork.length, "document")} to renew`,
      detail: `${expired > 0 ? `${expired} expired · ` : ""}${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3} more` : ""}`,
      href: "/fleet",
      action: "Review"
    });
  }
  for (const reminder of reminders) {
    if (reminder.due && reminder.due <= today) {
      todayItems.push({ key: `rem-${reminder.id}`, tone: "neutral", icon: <Bell size={17} />, title: reminder.title, detail: reminder.target, href: "/tasks", action: "Open" });
    }
  }
  const toneOrder: Record<Tone, number> = { red: 0, amber: 1, teal: 2, blue: 3, neutral: 4 };
  todayItems.sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone]);
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
              ? "Nothing needs you right now."
              : `${plural(todayItems.length, "thing")} to sort today${urgentCount > 0 ? ` · ${urgentCount} urgent` : ""}.`}
          </p>
        </div>
        <Link className="pressable inline-flex items-center justify-center gap-2 self-start rounded-[9px] bg-[var(--primary)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] sm:self-auto" href="/bookings/new">
          <Plus size={16} />
          New booking
        </Link>
      </div>

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
          <Panel action={<PanelLink href="/calendar">Calendar</PanelLink>} title="Today">
            {todayItems.length === 0 ? (
              <div className="flex items-center gap-3 px-4 pb-5 pt-2 text-sm text-[var(--foreground-secondary)]">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--success-light)] text-[var(--success)]">
                  <CheckCircle2 size={18} />
                </span>
                All clear. No handovers, returns or late payments today.
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {todayItems.map((item) => <AgendaRow item={item} key={item.key} />)}
              </ul>
            )}
          </Panel>

          <Panel action={<PanelLink href="/calendar">See all</PanelLink>} title="Coming up">
            {upcomingItems.length === 0 ? (
              <p className="flex items-center gap-2 px-4 pb-5 pt-2 text-sm text-[var(--muted)]">
                <CalendarClock size={16} />
                Nothing booked in the next 7 days.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {upcomingItems.slice(0, 8).map((item) => <AgendaRow item={item} key={item.key} />)}
              </ul>
            )}
          </Panel>

          <Panel action={<PanelLink href="/bookings">All bookings</PanelLink>} title={`On rent now · ${onRent.length}`}>
            {onRent.length === 0 ? (
              <p className="px-4 pb-5 pt-2 text-sm text-[var(--muted)]">Nothing is out on rent right now.</p>
            ) : (
              <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {onRent.slice(0, 8).map((r) => {
                  const late = r.end !== "Indefinite" && r.end < today;
                  return (
                    <li key={r.id}>
                      <Link className="flex items-center gap-3 px-4 py-3 transition hover:bg-[#fbfaf8]" href={`/bookings/${r.id}` as Route}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-[var(--foreground)]">{r.vehicle}</span>
                          <span className="block truncate text-[13px] text-[var(--muted)]">{r.customer}</span>
                        </span>
                        <span className="flex-shrink-0 text-right text-[13px]">
                          <span className={`block ${late ? "font-semibold text-[var(--danger)]" : "text-[var(--foreground-secondary)]"}`}>
                            {r.end === "Indefinite" ? "Open-ended" : late ? `Was due ${shortDate(r.end)}` : `Until ${shortDate(r.end)}`}
                          </span>
                          {(r.overdue || 0) > 0 ? (
                            <span className="block font-semibold text-[var(--danger)]">{money(r.overdue || 0)} owed</span>
                          ) : (
                            <span className="block text-[var(--muted)]">Paid up</span>
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
                <PanelLink href="/bookings">{plural(onRent.length - 8, "more rental")}</PanelLink>
              </div>
            ) : null}
          </Panel>
        </div>

        <div className="min-w-0 space-y-5">
          <Panel action={<PanelLink href="/fleet">Fleet</PanelLink>} title="Your fleet">
            {groups.length === 0 ? (
              <p className="px-4 pb-5 pt-2 text-sm text-[var(--muted)]">
                No vehicles yet. <Link className="font-semibold text-[var(--primary)]" href="/fleet/new">Add your first one</Link>.
              </p>
            ) : (
              <div className="space-y-1 px-2 pb-3">
                {groups.map((group) => (
                  <Link className="flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition hover:bg-[#fbfaf8]" href={`/fleet#${group.kind}` as Route} key={group.kind}>
                    <VehicleKindIcon kind={group.kind} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[14px] font-semibold text-[var(--foreground)]">{group.label}</span>
                        <span className="font-mono-data text-[14px] font-semibold text-[var(--foreground)]">{group.vehicles.length}</span>
                      </span>
                      <span className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-[#eeece7]">
                        <span className="bg-[#2f6fdb]" style={{ width: `${(group.out / group.vehicles.length) * 100}%` }} />
                        <span className="bg-[#16a34a]" style={{ width: `${(group.free / group.vehicles.length) * 100}%` }} />
                        <span className="bg-[#d4a017]" style={{ width: `${(group.other / group.vehicles.length) * 100}%` }} />
                      </span>
                      <span className="mt-1 block"><OutFreeSummary free={group.free} other={group.other} out={group.out} /></span>
                    </span>
                  </Link>
                ))}
                <p className="px-2 pt-2 text-[13px] text-[var(--muted)]">{utilization}% of your fleet is earning right now.</p>
              </div>
            )}
          </Panel>

          <Panel action={<PanelLink href="/reports">Reports</PanelLink>} title="Money this month">
            <div className="px-4 pb-4">
              <p className="text-[28px] font-semibold tabular-nums tracking-[-0.02em] text-[var(--foreground)]">{money(metrics.monthlyRevenue)}</p>
              <p className="text-[13px] text-[var(--muted)]">
                taken in · {money(monthlyExpenses)} costs ·{" "}
                <span className={monthlyProfit < 0 ? "font-semibold text-[var(--danger)]" : "font-semibold text-[var(--success)]"}>{money(monthlyProfit)} profit</span>
              </p>
              <div aria-hidden="true" className="mt-4 flex h-20 items-end gap-2">
                {lastSixMonths.map((month) => (
                  <div className="flex flex-1 flex-col items-center gap-1" key={month.key}>
                    <div
                      className={`w-full rounded-t-[5px] ${month.key === thisMonth ? "bg-[var(--primary)]" : "bg-[#d9ebe8]"}`}
                      style={{ height: `${Math.max(4, Math.round((month.amount / maxMonth) * 64))}px` }}
                      title={`${month.label}: ${money(month.amount)}`}
                    />
                    <span className="text-[11px] text-[var(--muted)]">{month.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <dl className="grid grid-cols-2 border-t border-[var(--border)]">
              <Link className="border-r border-[var(--border)] px-4 py-3 transition hover:bg-[#fbfaf8]" href="/tasks">
                <dt className="text-[12px] text-[var(--muted)]">Overdue</dt>
                <dd className={`font-mono-data text-[16px] font-semibold ${overdueTotal > 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{money(overdueTotal)}</dd>
                <dd className="text-[12px] text-[var(--muted)]">{overdueRentals.length === 0 ? "All paid" : plural(overdueRentals.length, "rental")}</dd>
              </Link>
              <Link className="px-4 py-3 transition hover:bg-[#fbfaf8]" href="/bookings">
                <dt className="text-[12px] text-[var(--muted)]">Deposits held</dt>
                <dd className="font-mono-data text-[16px] font-semibold text-[var(--foreground)]">{money(depositsHeld)}</dd>
                <dd className="text-[12px] text-[var(--muted)]">{plural(depositsHeldCount, "customer")}</dd>
              </Link>
            </dl>
          </Panel>
        </div>
      </div>

      <details className="group mt-6 rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-[15px] font-semibold text-[var(--foreground)]">
          More insights
          <span className="text-[13px] font-normal text-[var(--muted)] group-open:hidden">Fleet value, profit per vehicle, activity</span>
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
