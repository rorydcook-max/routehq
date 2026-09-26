import { MapPin } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { businessToday } from "@/lib/business-time";
import { ComplianceAlertsCard } from "@/components/dashboard/compliance-alerts-card";
import { DepositsHeldCard } from "@/components/dashboard/deposits-held-card";
import { FleetIntelligencePanel } from "@/components/dashboard/fleet-intelligence-panel";
import { FleetPnLCard } from "@/components/dashboard/fleet-pnl-card";
import { FleetStatusCard } from "@/components/dashboard/fleet-status-card";
import { FleetValueCard } from "@/components/dashboard/fleet-value-card";
import { OverduePaymentsCard } from "@/components/dashboard/overdue-payments-card";
import { ProfitCard } from "@/components/dashboard/profit-card";
import { RevenueCard } from "@/components/dashboard/revenue-card";
import { RouteHQValueWidget } from "@/components/dashboard/routehq-value-widget";
import { TodayScheduleSection } from "@/components/dashboard/today-schedule-section";
import { VehicleTimelinePanel } from "@/components/dashboard/vehicle-timeline-panel";
import { RentalAdjustmentButton } from "@/components/rental-adjustment-modal";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDashboardData, money } from "@/lib/dashboard";
import { getDefaultOrganization } from "@/lib/organization";
import { getValueTrackerData } from "@/lib/value-tracker";
import { getOnboardingStatus } from "@/lib/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isExpenseTransaction, isRawDepositTransaction, isRevenueTransaction } from "@/lib/transaction-options";

const statusTone = {
  Rented: "blue",
  Available: "green",
  Maintenance: "red",
  Reserved: "amber",
  Active: "green",
  Booked: "blue",
  Overdue: "red",
  "Due Soon": "amber"
} as const;

export default async function Home() {
  const [userEmail, organization, dashboardData, supabase] = await Promise.all([
    getCurrentUserEmail(),
    getDefaultOrganization(),
    getDashboardData(),
    createSupabaseServerClient()
  ]);
  const onboardingStatus = await getOnboardingStatus(supabase as any, organization.id);
  const { metrics: dashboardMetrics, reminders, rentals, timeline, transactions, vehicles } = dashboardData;

  const now = new Date();
  const today = businessToday();
  const daysElapsed = Number(today.slice(8, 10)) || 1;
  const totalVehicles = vehicles.length;
  const rentedCount = vehicles.filter((vehicle) => ["rented", "active"].includes(String(vehicle.status).toLowerCase())).length;
  const availableCount = vehicles.filter((vehicle) => String(vehicle.status).toLowerCase() === "available").length;
  const maintenanceCount = vehicles.filter((vehicle) => String(vehicle.status).toLowerCase() === "maintenance").length;
  const fleetUtilization = totalVehicles > 0 ? Math.round((rentedCount / totalVehicles) * 100) : 0;

  // ── Revenue / profit ──────────────────────────────────────────────────────
  // Expenses are stored as positive amounts, so they're recognised by type (the old `amount < 0` test never matched).
  const monthlyExpenses = transactions
    .filter((t) => String(t.date || "").slice(0, 7) === today.slice(0, 7))
    .filter((t) => isExpenseTransaction({ isDeposit: t.isDeposit, type: t.rawType || t.type }))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const monthlyNetProfit = dashboardMetrics.monthlyRevenue - monthlyExpenses;
  const dailyRevenue = Math.round(dashboardMetrics.monthlyRevenue / daysElapsed);
  const dailyProfit = Math.round(monthlyNetProfit / daysElapsed);
  const monthlyRevenueByKey = new Map<string, number>();
  transactions.forEach((transaction) => {
    if (!transaction.date || !isRevenueTransaction({ amount: transaction.amount, isDeposit: transaction.isDeposit, type: transaction.rawType || transaction.type })) return;
    const key = transaction.date.slice(0, 7);
    monthlyRevenueByKey.set(key, (monthlyRevenueByKey.get(key) || 0) + transaction.amount);
  });
  // Profit per month (revenue minus costs) for the best-month and 12-month-average figures.
  const monthlyProfitByKey = new Map<string, number>(monthlyRevenueByKey);
  transactions.forEach((transaction) => {
    if (!transaction.date || !isExpenseTransaction({ isDeposit: transaction.isDeposit, type: transaction.rawType || transaction.type })) return;
    const key = transaction.date.slice(0, 7);
    monthlyProfitByKey.set(key, (monthlyProfitByKey.get(key) || 0) - Math.abs(transaction.amount));
  });
  const lastTwelveMonthKeys = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 12 + index, 1));
    return `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const lastTwelveProfits = lastTwelveMonthKeys.map((key) => monthlyProfitByKey.get(key) || 0);
  const bestMonthProfit = Math.max(0, ...lastTwelveProfits);
  const avgMonthProfit = Math.round(lastTwelveProfits.reduce((sum, value) => sum + value, 0) / 12);
  const monthlyRevenuePreview = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    return {
      label: month.toLocaleDateString("en-TH", { month: "short" }),
      amount: monthlyRevenueByKey.get(key) || 0
    };
  });

  // ── Overdue payments ──────────────────────────────────────────────────────
  const overdueRentals = rentals.filter((r) => r.balance > 0);
  const overdueTotal = overdueRentals.reduce((sum, r) => sum + r.balance, 0);
  const overduePreviewRows = overdueRentals.slice(0, 3).map((rental) => {
    const dueDate = rental.end !== "Indefinite" ? rental.end : rental.start;
    const ms = new Date(today).setHours(0, 0, 0, 0) - new Date(dueDate).setHours(0, 0, 0, 0);
    const daysOverdue = Math.max(0, Math.ceil(ms / 86_400_000));
    return { ...rental, daysOverdue };
  });

  // ── Deposits held ────────────────────────────────────────────────────────
  const depositsHeld = dashboardMetrics.depositsHeld ?? rentals.reduce((sum, rental) => sum + (rental.deposit || 0), 0);
  const depositsHeldCount = dashboardMetrics.depositsHeldCount ?? rentals.filter((rental) => (rental.deposit || 0) > 0).length;
  const depositsByVehicle = rentals
    .filter((rental) => (rental.deposit || 0) > 0)
    .slice(0, 3)
    .map((rental) => ({ vehicle: rental.vehicle, amount: rental.deposit || 0 }));

  // ── Alerts reclassified by days-to-due ───────────────────────────────────
  const alertCounts = reminders.reduce(
    (acc, r) => {
      const ms = new Date(r.due).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0);
      const days = Math.ceil(ms / 86_400_000);
      if (days <= 7) acc.high++;
      else if (days <= 14) acc.medium++;
      else if (days <= 28) acc.low++;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
  const alertBuckets = reminders.reduce(
    (acc, reminder) => {
      const ms = new Date(reminder.due).setHours(0, 0, 0, 0) - new Date(today).setHours(0, 0, 0, 0);
      const days = Math.ceil(ms / 86_400_000);
      if (days <= 7) acc.high.push(reminder);
      else if (days <= 14) acc.medium.push(reminder);
      else if (days <= 28) acc.low.push(reminder);
      return acc;
    },
    { high: [] as typeof reminders, medium: [] as typeof reminders, low: [] as typeof reminders }
  );

  // ── Fleet value & P&L ─────────────────────────────────────────────────────
  const totalFleetValue = vehicles.reduce((sum, v) => sum + v.estimatedValue, 0);
  const totalPurchasePrice = vehicles.reduce((sum, v) => sum + v.purchasePrice, 0);
  const totalDepreciation = totalPurchasePrice - totalFleetValue;
  const totalOperatingProfit = vehicles.reduce((sum, v) => sum + v.profit, 0);
  // Net fleet P&L: (current value - purchase price) + operating profit
  const fleetNetPnL = (totalFleetValue - totalPurchasePrice) + totalOperatingProfit;

  // ── Today's agenda ────────────────────────────────────────────────────────
  const todayAgenda = [
    ...rentals
      .filter((r) => r.start === today)
      .map((r) => ({ type: "start" as const, label: `${r.vehicle} — starts`, sub: r.customer })),
    ...rentals
      .filter((r) => r.end !== "Indefinite" && r.end === today)
      .map((r) => ({ type: "end" as const, label: `${r.vehicle} — due back`, sub: r.customer })),
    ...reminders
      .filter((r) => r.due === today)
      .map((r) => ({ type: "reminder" as const, label: r.title, sub: r.target })),
  ].slice(0, 6);

  // Dates on the dashboard are shown in Thai time. Without a time zone they would
  // use the server clock - UTC once deployed - and be a day behind until 07:00.
  const dateLabel = now.toLocaleDateString("en-TH", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" });
  const headerDateLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Bangkok" });

  // ── RouteHQ Value Tracker (real DB counts) ───────────────────────────────
  const valueTrackerData = await getValueTrackerData({
    organizationId: organization.id,
    subscriptionTier: organization.subscription_tier,
    createdAt: organization.created_at,
    supabase: supabase as any
  });

  return (
    <AppShell userEmail={userEmail}>
      {/* Header — compact */}
      <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-[0_16px_38px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-[var(--primary)]">{headerDateLabel}</p>
          <h1 className="text-xl font-black tracking-[-0.03em] text-[var(--foreground)] sm:text-2xl">Operations command center</h1>
          <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">Fleet movement, payments, renewals, and operational risk.</p>
        </div>
      </div>

      {!onboardingStatus.hidden ? (
        <OnboardingChecklist
          completedCount={onboardingStatus.completedCount}
          items={onboardingStatus.items}
          organizationId={organization.id}
          totalCount={onboardingStatus.totalCount}
        />
      ) : null}

      <div className="mt-4 mb-1 h-px bg-[var(--border)]" />

      {/* Today's schedule */}
      <div className="mt-4 flex flex-col gap-2">
        <TodayScheduleSection dateLabel={dateLabel} items={todayAgenda} />
      </div>

      {/* Revenue and Profit */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <RevenueCard
          dailyRevenue={dailyRevenue}
          monthlyExpenses={monthlyExpenses}
          monthlyPreview={monthlyRevenuePreview}
          monthlyRevenue={dashboardMetrics.monthlyRevenue}
        />
        <ProfitCard
          avgMonthProfit={avgMonthProfit}
          bestMonthProfit={bestMonthProfit}
          dailyProfit={dailyProfit}
          monthlyProfit={monthlyNetProfit}
        />
      </div>

      {/* Fleet status */}
      <div className="mt-3">
        <FleetStatusCard
          availableCount={availableCount}
          fleetUtilization={fleetUtilization}
          maintenanceCount={maintenanceCount}
          rentedCount={rentedCount}
          totalVehicles={totalVehicles}
        />
      </div>

      {/* Four KPI cards */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <OverduePaymentsCard
          overdueCount={overdueRentals.length}
          overdueRows={overduePreviewRows.map((r) => ({ customer: r.customer, balance: r.balance, vehicle: r.vehicle, daysOverdue: r.daysOverdue }))}
          overdueTotal={overdueTotal}
        />
        <DepositsHeldCard
          depositsByVehicle={depositsByVehicle}
          depositsHeld={depositsHeld}
          depositsHeldCount={depositsHeldCount}
        />
        <FleetValueCard
          totalDepreciation={totalDepreciation}
          totalFleetValue={totalFleetValue}
          totalPurchasePrice={totalPurchasePrice}
          vehicleCount={vehicles.length}
        />
        <FleetPnLCard
          fleetNetPnL={fleetNetPnL}
          totalDepreciation={totalDepreciation}
          totalOperatingProfit={totalOperatingProfit}
        />
      </div>

      {/* Compliance and Value */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ComplianceAlertsCard
          alertBuckets={alertBuckets}
          alertCounts={alertCounts}
        />
        <RouteHQValueWidget data={valueTrackerData} />
      </div>
      {/* Fleet Intelligence */}
      <div className="mt-3">
        <FleetIntelligencePanel averageUtilization={dashboardMetrics.averageUtilization} vehicles={vehicles} />
      </div>

      {/* Active Rentals */}
      <div className="mt-3">
        <Card>
          <SectionHeader eyebrow="Rentals" title="Active bookings and returns" />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {rentals.map((rental) => (
              <article className="rounded-lg border border-[#dfe4ea] p-3" key={rental.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#172026]">{rental.customer}</p>
                    <p className="text-sm text-[#667085]">{rental.vehicle}</p>
                  </div>
                  <Badge tone={statusTone[rental.status]}>{rental.status}</Badge>
                </div>
                <div className="mt-3 space-y-2 text-sm text-[#344054]">
                  <p>
                    {rental.start} to {rental.end}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin size={15} />
                    {rental.location}
                  </p>
                  <p className="font-semibold">Balance {money(rental.balance)}</p>
                </div>
                {["Booked", "Active", "Due Soon", "Overdue"].includes(rental.status) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      className="pressable inline-flex min-h-10 items-center justify-center rounded-lg bg-[#0f766e] px-3 py-2 text-xs font-black text-white shadow"
                      href={(rental.status === "Booked" ? `/inspections/delivery/${rental.id}` : `/inspections/return/${rental.id}`) as Route}
                    >
                      {rental.status === "Booked" ? "Start Delivery" : "Start Return"}
                    </Link>
                    <RentalAdjustmentButton
                      currentEndDate={rental.end === "Indefinite" ? null : rental.end}
                      currentRate={rental.rentalRate}
                      currentStartDate={rental.start}
                      customerName={rental.customer}
                      label="Adjust"
                      rentalId={rental.id}
                      vehicleLabel={rental.vehicle}
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </Card>
      </div>

      {/* Transactions */}
      <div className="mt-3">
        <Card>
          <SectionHeader eyebrow="Accounting" title="Recent universal transactions" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#dfe4ea] text-xs uppercase text-[#667085]">
                  <th className="w-24 py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="px-3 py-2">Vehicle</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 10).map((transaction) => {
                  const rawType = transaction.rawType || transaction.type;
                  const isDeposit = isRawDepositTransaction({ isDeposit: transaction.isDeposit, type: rawType });
                  const isIncome = !isDeposit && isRevenueTransaction({ amount: Math.abs(transaction.amount), isDeposit: transaction.isDeposit, type: rawType });
                  const category = isDeposit ? "liability" : isIncome ? "income" : "expense";
                  const rowBg = category === "income" ? "bg-[#f0fdf4]" : category === "liability" ? "bg-[#fffbeb]" : "bg-[#fef2f2]";
                  const pillClass = category === "income"
                    ? "bg-[#dcfce7] text-[#16a34a] ring-[#bbf7d0]"
                    : category === "liability"
                      ? "bg-[#fef3c7] text-[#d97706] ring-[#fde68a]"
                      : "bg-[#fee2e2] text-[#dc2626] ring-[#fecaca]";
                  const pillLabel = category === "income" ? "Income" : category === "liability" ? "Liability" : "Expense";
                  const amountClass = category === "income" ? "text-[#16a34a]" : category === "liability" ? "text-[#d97706]" : "text-[#dc2626]";
                  return (
                    <tr className={`group relative border-b border-[#eef2f6] last:border-0 ${rowBg} cursor-pointer`} key={transaction.id}>
                      <td className="py-3 pr-3">
                        <Link aria-label="View transactions" className="absolute inset-0 z-0" href="/transactions" />
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${pillClass}`}>{pillLabel}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold group-hover:text-[var(--primary)] transition-colors">{transaction.type}</p>
                        <p className="text-[#667085]">{transaction.note}</p>
                      </td>
                      <td className="px-3 py-3">{transaction.vehicle}</td>
                      <td className="px-3 py-3">{transaction.date}</td>
                      <td className={`px-3 py-3 text-right font-bold ${amountClass}`}>
                        {money(transaction.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {transactions.length > 0 ? (
            <div className="card-section flex justify-center border-t border-[var(--border)] pt-3">
              <Link className="pressable inline-flex min-h-8 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-bold text-[var(--foreground-secondary)]" href="/transactions">
                View all transactions
                {transactions.length > 10 ? <span className="rounded-full bg-[var(--panel-secondary)] px-1.5 py-0.5 text-[10px] font-bold">{transactions.length}</span> : null}
              </Link>
            </div>
          ) : null}
        </Card>
      </div>

      {/* Timeline */}
      <div className="mt-3">
        <VehicleTimelinePanel timeline={timeline} />
      </div>
    </AppShell>
  );
}
