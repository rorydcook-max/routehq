import { InfoTip } from "@/components/info-tip";
import Link from "next/link";
import { typedNote } from "@/lib/transaction-notes";
import type { Route } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Banknote, CalendarDays, ClipboardCheck, FileText, Fuel, MapPin, PenLine, ReceiptText, ShieldCheck, Wrench } from "lucide-react";
import { createVehicleTask } from "@/app/actions/tasks";
import { logVehicleMaintenance, setVehicleInShop, unarchiveVehicle } from "@/app/actions/vehicles";
import { OpenFoldsOnHash } from "@/components/open-folds-on-hash";
import { ShowMoreList } from "@/components/show-more-list";
import { serviceKmLeft } from "@/lib/vehicle-service";
import { HashLink } from "@/components/hash-link";
import { MoneyInput } from "@/components/money-input";
import { VehicleNotesForm } from "@/app/(app)/fleet/[id]/vehicle-notes-form";
import { VehiclePhotoManager } from "@/app/(app)/fleet/[id]/vehicle-photo-manager";
import { VehicleTimeline, type VehicleTimelineEvent } from "@/app/(app)/fleet/[id]/vehicle-timeline";
import { VehicleYear, type YearMark, type YearRental } from "@/app/(app)/fleet/[id]/vehicle-year";
import { AppShell } from "@/components/app-shell";
import { VehicleArt } from "@/components/vehicle-art";
import { Dot, ElapsedBar, InOutBars, PartBar, Ring } from "@/components/glance";
import { PageTabs, type PageTab } from "@/components/page-tabs";
import { isTwoWheeler, kindFromCategory } from "@/lib/vehicle-groups";
import { RenewalForm, RenewalHelp } from "./renewal";
import { VehicleReviews } from "./vehicle-reviews";
import { partnerQuote } from "@/lib/insurance-partners";
import { countryCode, paperApplies, paperField, paperworkFor } from "@/lib/country-paperwork";
import { RentalAdjustmentButton } from "@/components/rental-adjustment-modal";
import { InspectionViewer } from "@/components/inspection-viewer";
import { PendingButton } from "@/components/pending-button";
import { BackLink, Badge, Card, Pane, ProgressBar, Fold } from "@/components/ui";
import { VehicleTitle, vehicleName } from "@/components/vehicle-identity";
import { amountDueNowByRental } from "@/lib/rental-balances";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getDefaultOrganization } from "@/lib/organization";
import { TASK_TYPE_OPTIONS } from "@/lib/tasks";
import { getVehicleDetail, type VehicleDetail } from "@/lib/vehicle-detail";
import { VehicleJobs } from "@/app/(app)/tasks/tasks-list";
import { isQuietActivityEvent } from "@/lib/activity-noise";
import { activityTitle, tidyDetail, visibleActivity } from "@/lib/activity-display";
import { businessToday, businessNow, toWallTime } from "@/lib/business-time";
import { longDate, dateFormat } from "@/lib/i18n/dates";
import { hasLoan, loanFigures } from "@/lib/vehicle-loan";
import { businessCurrency, distanceKey } from "@/lib/business-units";
import { formatMoney } from "@/lib/regional";
import { ActionForm } from "@/components/action-form";

// The wording for this page is in locales/<language>/common.json under "vehiclePage".
type Say = (key: string, values?: Record<string, string | number>) => string;
type Vx = { say: Say; has: (key: string) => boolean; locale: string };

/** For the parts of the page that are not async. */
function useVx(): Vx {
  const t = useTranslations("vehiclePage");
  return { say: t as unknown as Say, has: (key) => t.has(key as never), locale: useLocale() };
}

const inputClass = "mt-1 w-full";
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

const expenseTypes = new Set(["repair", "servicing", "maintenance", "fuel", "insurance", "tax", "finance", "fine", "accessories", "refund"]);

// In the business's own currency (was always baht).
function money(value: unknown) {
  // Not rounded first: a ฿1,200.50 day rate read "฿1,201 a day" here and "฿1,200.50" on the edit page.
  return formatMoney(Number(value || 0), businessCurrency(), "en-US");
}

function percent(value: unknown) {
  return `${Math.round(Number(value || 0))}%`;
}

/** "Thu 22 Oct": a booking's start or end on one short line. */
function shortDay(value: string, locale: string) {
  return dateFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${toWallTime(value).slice(0, 10)}T00:00:00Z`));
}

/** Short month names: en-GB says "Sept" beside "Nov" and "Dec"; three letters for all of them. */
function shortMonth(date: Date, locale: string) {
  const name = dateFormat(locale, { month: "short" }).format(date);
  return locale.startsWith("en") ? name.slice(0, 3) : name;
}

function formatDate(value: string | null | undefined, tx: Vx) {
  return value ? longDate(toWallTime(value).slice(0, 10), tx.locale) : tx.say("notSet");
}

/** Whole days from today (Thailand) to a date; negative when it has passed. */
function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const target = Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  return Math.round((target - Date.parse(`${businessToday()}T00:00:00Z`)) / 86_400_000);
}

function urgency(days: number | null, tx: Vx) {
  if (days === null) return { label: tx.say("notSet"), tone: "neutral" as const };
  if (days < 0) return { label: tx.say("daysOverdue", { count: Math.abs(days) }), tone: "red" as const };
  if (days === 0) return { label: tx.say("dueToday"), tone: "red" as const };
  if (days < 7) return { label: tx.say("daysLeft", { count: days }), tone: "red" as const };
  if (days <= 30) return { label: tx.say("daysLeft", { count: days }), tone: "amber" as const };
  return { label: tx.say("daysLeft", { count: days }), tone: "green" as const };
}

function detailUrl(path: string, vehicleId: string) {
  return `${path}?vehicleId=${vehicleId}` as Route;
}

function getComplianceItems(detail: VehicleDetail, tx: Vx) {
  const { vehicle, complianceEvents } = detail;
  const compliance = vehicle.metadata?.compliance || {};
  const finance = vehicle.metadata?.finance || {};
  const lastCost = (type: string, field: string) =>
    compliance[`${field}_last_cost`] || finance[`${field}_last_cost`] || complianceEvents.find((event) => event.compliance_type === type)?.cost || null;

  // The paperwork the business's country asks for (local names after the plain one), then upkeep.
  const twoWheeler = isTwoWheeler(kindFromCategory(detail.category));
  const age = vehicleAgeOf(vehicle);
  const items: Array<{ key: string; name: string; date: any; cost: any; monthly?: boolean; paperwork?: boolean; inspection?: string; howTo?: { key: string; url?: string }; icon: typeof ShieldCheck }> = paperworkFor(detail.country)
    .filter((item) => paperApplies(item, age, twoWheeler, compliance[paperField(item.key)]))
    .map((item) => {
      const field = paperField(item.key);
      return {
        key: item.key,
        name: item.local ? `${tx.say(item.nameKey)} (${item.local})` : tx.say(item.nameKey),
        date: compliance[field],
        cost: lastCost(item.key, field),
        monthly: Boolean(compliance[`${field}_monthly`]),
        paperwork: true,
        // Thailand: an older vehicle's inspection is done with the road tax; its cost is asked for in the same renewal.
        inspection: item.inspectionWith && (age === null || age > (twoWheeler ? item.inspectionWith.bike : item.inspectionWith.car)) ? item.inspectionWith.local : undefined,
        howTo: item.howTo,
        icon: ShieldCheck
      };
    });
  items.push(
    { key: "service", name: tx.say("c_service"), date: compliance.next_service_date, cost: lastCost("service", "next_service_date"), icon: Wrench },
    { key: "oil", name: tx.say("c_oil"), date: compliance.oil_change_due_date, cost: lastCost("oil", "oil_change_due_date"), icon: Fuel }
  );
  if (hasLoan(finance)) {
    items.push({ key: "finance", name: tx.say("c_finance"), date: loanFigures(finance).endDate || finance.end_date, cost: finance.monthly_payment || lastCost("finance", "end_date"), icon: Banknote });
  }
  return items;
}

/** Whole years since the vehicle was built (Thai Buddhist years accepted); null when the year isn't saved. */
function vehicleAgeOf(vehicle: any) {
  const builtYear = Number(vehicle.year || 0) > 2400 ? Number(vehicle.year) - 543 : Number(vehicle.year || 0);
  return builtYear > 1950 ? Number(businessToday().slice(0, 4)) - builtYear : null;
}

function getSoonestCompliance(detail: VehicleDetail, tx: Vx) {
  return getComplianceItems(detail, tx)
    .filter((item) => item.date)
    .sort((left, right) => Number(daysUntil(left.date) ?? 9999) - Number(daysUntil(right.date) ?? 9999))[0];
}

function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      {children}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function InfoRow({ label, value, danger = false }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className="rounded-2xl bg-[var(--panel-secondary)] p-3.5">
      <p className="font-semibold text-[var(--muted)]">{label}</p>
      <p className={`mt-0.5 text-[17px] font-semibold tabular-nums ${danger ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{value}</p>
    </div>
  );
}

function QuickActions({ vehicleId, status, rentalId }: { vehicleId: string; status: string; rentalId?: string | null }) {
  const tx = useVx();
  // The main button follows what the vehicle is doing. Out with a customer, the card just below already opens the booking, so recording money is the main thing here.
  const primary = rentalId
    ? { href: detailUrl("/transactions/new", vehicleId), label: tx.say("a_recordMoney"), icon: ReceiptText }
    : status === "available"
      ? { href: detailUrl("/bookings/new", vehicleId), label: tx.say("a_newBooking"), icon: CalendarDays }
      : { href: detailUrl("/transactions/new", vehicleId), label: tx.say("a_recordMoney"), icon: ReceiptText };
  // One main button, the two things done most, and the rest one tap away: six buttons in a block was a wall.
  const recordMoney = { href: detailUrl("/transactions/new", vehicleId), label: tx.say("a_recordMoney"), icon: ReceiptText };
  const edit = { href: `/fleet/${vehicleId}/edit`, label: tx.say("a_edit"), icon: PenLine };
  const shown = [recordMoney, edit].filter((action) => action.label !== primary.label);
  const more = [
    { href: detailUrl("/bookings/new", vehicleId), label: tx.say("a_newBooking"), icon: CalendarDays },
    // Opens Paperwork & service with the service form already open (Rory, 1 Nov 2026: it went to a folded card and seemed to do nothing).
    { href: "#log-service", label: tx.say("a_logMaintenance"), icon: Wrench },
    { href: `/inspections/condition/${vehicleId}`, label: tx.say("a_condition"), icon: ClipboardCheck },
    { href: `/transactions/new?fine=1&vehicleId=${vehicleId}`, label: tx.say("a_fine"), icon: ReceiptText }
  ].filter((action) => action.label !== primary.label);
  const PrimaryIcon = primary.icon;

  return (
    <div className="space-y-2">
      <Link className="pressable primary-action w-full !px-3 text-center leading-tight" href={primary.href as Route}>
        <PrimaryIcon className="shrink-0" size={18} />
        {primary.label}
      </Link>
      <div className={`grid gap-2 ${shown.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {shown.map((action) => {
          const Icon = action.icon;
          return (
            <Link className="pressable secondary-action whitespace-nowrap !px-3 text-center leading-tight" href={action.href as Route} key={action.label}>
              <Icon className="hidden shrink-0 sm:block" size={18} />
              {action.label}
            </Link>
          );
        })}
      </div>
      <details>
        <summary className="cursor-pointer list-none py-1 text-center font-semibold text-[var(--primary)]">{tx.say("a_more")}</summary>
        <div className="mt-2 grid gap-2">
          {more.map((action) => {
            const Icon = action.icon;
            if (action.href.startsWith("#")) {
              return (
                <HashLink className="pressable secondary-action !px-3 text-center leading-tight" hash={action.href.slice(1)} key={action.label}>
                  <Icon className="shrink-0" size={18} />
                  {action.label}
                </HashLink>
              );
            }
            return (
              <Link className="pressable secondary-action !px-3 text-center leading-tight" href={action.href as Route} key={action.label}>
                <Icon className="shrink-0" size={18} />
                {action.label}
              </Link>
            );
          })}
          {/* Free cars can be taken off the road while they're being fixed; booked and rented ones follow their booking. */}
          {status === "available" ? (
            <ActionForm action={setVehicleInShop}>
              <input name="vehicleId" type="hidden" value={vehicleId} />
              <input name="inShop" type="hidden" value="true" />
              <PendingButton className="pressable secondary-action w-full !px-3 text-center leading-tight" pendingLabel={tx.say("saving")} type="submit">
                <Wrench className="shrink-0" size={18} />
                {tx.say("sh_in")}
              </PendingButton>
            </ActionForm>
          ) : null}
        </div>
      </details>
    </div>
  );
}

/** Four tiles, each a picture and one answer, each opening the tab with the detail. */
function Glance({ detail, isOwner }: { detail: VehicleDetail; isOwner: boolean }) {
  const tx = useVx();
  const soonest = getSoonestCompliance(detail, tx);
  const soonestDays = daysUntil(soonest?.date);
  const soonestUrgency = urgency(soonestDays, tx);
  const toneText = { red: "text-[var(--danger)]", amber: "text-[var(--warning)]", green: "text-[var(--success)]", neutral: "text-[var(--foreground-secondary)]" };
  const f = detail.financials;
  const u = detail.utilization;
  const months = f.monthlyChart.slice(-6);
  const top = Math.max(1, ...months.flatMap((month) => [month.revenue, month.expenses]));
  const condition = (detail.vehicle as any).metadata?.condition;
  const byDamage = condition?.by === "damage";
  const latestInspection = detail.inspections[0];
  // Title at the top, one value, one caption at the bottom: every tile's value in the same face and size.
  const tile = "card pressable flex min-h-[132px] flex-col justify-start gap-2.5 p-4";
  const value = "num text-[22px] leading-tight";

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <a className={tile} href="#money">
        <span className="tile-title">{isOwner ? tx.say("gl_profit") : tx.say("gl_monthIn")}</span>
        <span className={`${value} ${isOwner && f.lifetimeProfit < 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{money(isOwner ? f.lifetimeProfit : f.currentMonthRevenue)}</span>
        {/* One bar is not a trend: the little chart waits for two months with money. */}
        {months.filter((month) => month.revenue > 0 || month.expenses > 0).length < 2 ? null : (
        <span aria-hidden="true" className="flex h-[30px] items-end justify-between border-b-2 border-[var(--border)]">
          {months.map((month) => (
            <span className="flex items-end gap-[2px]" key={month.label}>
              <span className="grow-y block w-[6px] rounded-t-[2px] bg-[var(--chart-in)]" style={{ height: month.revenue > 0 ? Math.max(4, Math.round((month.revenue / top) * 28)) : 0 }} />
              <span className="grow-y block w-[6px] rounded-t-[2px] bg-[var(--chart-out)]" style={{ height: month.expenses > 0 ? Math.max(4, Math.round((month.expenses / top) * 28)) : 0 }} />
            </span>
          ))}
        </span>
        )}
        <span className="mt-auto font-semibold text-[var(--foreground-secondary)]">{isOwner ? tx.say("gl_allTime") : tx.say("gl_thisMonth")}</span>
      </a>
      <a className={tile} href="#rentals">
        <span className="tile-title">{tx.say("gl_rented")}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Ring label={percent(u.twelveMonth)} labelSize={13} pct={u.twelveMonth} size={66} stroke={7} />
          <span className="font-semibold leading-snug text-[var(--foreground-secondary)]">{tx.say("gl_fleetAvg", { percent: percent(u.fleetAverage) })}</span>
        </span>
      </a>
      <a className={tile} href="#upkeep">
        <span className="tile-title">{tx.say("g_paper")}</span>
        <span className={`${value} text-[var(--foreground)]`}>{soonest ? soonest.name : tx.say("gl_notSetUp")}</span>
        <span className={`mt-auto font-semibold ${soonest ? toneText[soonestUrgency.tone] : "text-[var(--primary)]"}`}>{soonest ? soonestUrgency.label : tx.say("g_addDates")}</span>
      </a>
      <a className={tile} href="#checks">
        <span className="tile-title">{tx.say("g_mileage")}</span>
        {/* A mileage nobody has entered yet isn't "0 km" (as on the fleet list). */}
        <span className={`${value} text-[var(--foreground)]`}>{Number(detail.vehicle.mileage || 0) > 0 ? tx.say(distanceKey("km"), { km: Number(detail.vehicle.mileage).toLocaleString("en-US") }) : "—"}</span>
        <span className={`mt-auto font-semibold ${byDamage ? toneText.amber : toneText.neutral}`}>
          {/* "Good · checked 3 Oct 2026", or just "Last checked 3 Oct 2026"; never "Condition not set · 3 Oct". */}
          {condition?.value
            ? `${tx.say(`cond_${condition.value}`)}${latestInspection?.inspected_at ? ` · ${tx.say("gl_checked", { date: formatDate(latestInspection.inspected_at, tx) })}` : ""}`
            : latestInspection?.inspected_at
              ? tx.say("gl_lastChecked", { date: formatDate(latestInspection.inspected_at, tx) })
              : tx.say("gl_condNotSet")}
        </span>
      </a>
    </div>
  );
}

/** Day, week and month prices, with the deposit. Lives under Details; the top of the page shows them in one line. */
function RatesPane({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const rates: Array<["day" | "week" | "month", number]> = [
    ["day", Number(detail.vehicle.daily_rate || 0)],
    ["week", Number(detail.vehicle.weekly_rate || 0)],
    ["month", Number(detail.vehicle.monthly_rate || 0)]
  ];
  const ratesSet = rates.filter(([, value]) => value > 0).length;
  const deposit = (detail.vehicle as any).deposit_amount;
  return (
    <Pane title={tx.say("r_title")}>
      <div className="grid grid-cols-3 gap-2.5">
        {rates.map(([period, value]) => (
          <div className="rounded-xl bg-[var(--panel-secondary)] p-3" key={period}>
            <p className="font-semibold text-[var(--muted)]">{tx.say(`rp_${period}`)}</p>
            <p className={`num mt-0.5 text-[18px] ${value > 0 ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{value > 0 ? money(value) : "—"}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 font-medium text-[var(--foreground-secondary)]">
        {deposit === null || deposit === undefined ? tx.say("r_depositUsual") : tx.say("r_deposit", { amount: money(Number(deposit)) })}
        {ratesSet > 0 && ratesSet < 3 ? <> <InfoTip text={tx.say("r_hint")} /></> : null}
      </p>
      <Link className="mt-2 inline-flex font-bold text-[var(--primary)]" href={`/fleet/${detail.vehicle.id}/edit` as Route}>
        {ratesSet === 3 ? tx.say("r_edit") : ratesSet === 0 ? tx.say("r_add") : tx.say("r_addMissing")}
      </Link>
    </Pane>
  );
}

function ActiveRentalCard({ detail, dueNow }: { detail: VehicleDetail; dueNow: number }) {
  const tx = useVx();
  const rental = detail.activeRental;
  if (!rental || !["rented", "reserved"].includes(detail.vehicle.status)) return null;

  const customer = rental.customers || {};
  const days = daysUntil(rental.end_date);
  const late = days !== null && days < 0 && rental.status !== "booked";
  const inspectionAction =
    rental.status === "booked"
      ? { href: `/inspections/delivery/${rental.id}`, label: tx.say("ar_startHandover") }
      : ["active", "due_soon", "overdue", "extended"].includes(rental.status)
        ? { href: `/inspections/return/${rental.id}`, label: tx.say("ar_startReturn") }
        : null;
  const priceKey = ["daily", "weekly", "monthly"].includes(String(rental.pricing_model)) ? String(rental.pricing_model) : "other";

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--muted)]">{rental.status === "booked" ? tx.say("ar_booked") : tx.say("ar_onRent")}</p>
          <p className="text-[22px] font-bold leading-tight text-[var(--foreground)]">{customer.full_name || tx.say("ar_noCustomer")}</p>
          {customer.phone ? (
            <a className="mt-1 inline-flex font-bold text-[var(--primary)]" href={`tel:${customer.phone}`}>
              {customer.phone}
            </a>
          ) : null}
        </div>
        <p className={`shrink-0 whitespace-nowrap font-bold ${late ? "text-[var(--danger)]" : "text-[var(--foreground-secondary)]"}`}>
          {days === null ? tx.say("ar_openEnded") : days < 0 ? tx.say("daysOverdue", { count: Math.abs(days) }) : tx.say("daysLeft", { count: days })}
        </p>
      </div>
      {rental.status !== "booked" && rental.start_date && rental.end_date ? <ElapsedBar end={toWallTime(rental.end_date)} late={late} start={toWallTime(rental.start_date)} /> : null}
      <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <InfoRow
          label={tx.say("ar_period")}
          value={rental.end_date && rental.start_date ? (
            // One line ("Thu 22 Oct → Mon 4 Jan") so all four tiles stay the same short height.
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              <span className="whitespace-nowrap">{shortDay(rental.start_date, tx.locale)}</span>
              <ArrowRight aria-hidden="true" className="text-[var(--muted)]" size={15} />
              <span className="whitespace-nowrap">{shortDay(rental.end_date, tx.locale)}</span>
              <span className="sr-only">{tx.say("ar_range", { from: formatDate(rental.start_date, tx), to: formatDate(rental.end_date, tx) })}</span>
            </span>
          ) : tx.say("ar_rangeOpen", { from: formatDate(rental.start_date, tx) })}
        />
        <InfoRow label={tx.say("ar_price")} value={tx.say(`ar_${priceKey}`, { amount: money(rental.rental_rate) })} />
        <InfoRow label={tx.say("ar_deposit")} value={money(rental.deposit_amount)} />
        <InfoRow danger={dueNow > 0} label={tx.say("ar_dueNow")} value={dueNow > 0 ? money(dueNow) : tx.say("ar_nothing")} />
      </div>
      <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap [&>*]:min-w-0 [&>*]:whitespace-nowrap">
        <Link className="primary-action pressable" href={`/bookings/${rental.id}` as Route}>
          {tx.say("ar_open")}
        </Link>
        {inspectionAction ? (
          <Link className="secondary-action pressable" href={inspectionAction.href as Route}>
            {inspectionAction.label}
          </Link>
        ) : null}
        <RentalAdjustmentButton
          className="secondary-action pressable"
          currentEndDate={rental.end_date}
          currentRate={Number(rental.rental_rate || 0)}
          currentStartDate={rental.start_date}
          customerName={customer.full_name || tx.say("customer")}
          label={tx.say("ar_extend")}
          rentalId={rental.id}
          vehicleLabel={[detail.vehicle.make, detail.vehicle.model, detail.vehicle.trim].filter(Boolean).join(" ")}
        />
      </div>
    </section>
  );
}

function ComplianceSection({ detail, organizationId }: { detail: VehicleDetail; organizationId: string }) {
  const tx = useVx();
  const items = getComplianceItems(detail, tx);
  const saved = items.filter((item) => item.date).length;
  const soonest = getSoonestCompliance(detail, tx);
  const soonestDays = daysUntil(soonest?.date);
  const needsLook = soonestDays !== null && soonestDays <= 30;
  const toneText = { red: "text-[var(--danger)]", amber: "text-[var(--warning)]", green: "text-[var(--success)]", neutral: "text-[var(--foreground-secondary)]" };
  // For "how to renew": the vehicle's age decides online road tax or an inspection first; Por Ror Bor's date decides the order.
  const vehicle = detail.vehicle;
  const builtYear = Number(vehicle.year || 0) > 2400 ? Number(vehicle.year) - 543 : Number(vehicle.year || 0);
  const vehicleAge = vehicleAgeOf(vehicle);
  // The renewal steps, DLT link and Por Ror Bor order are Thailand's.
  const thai = countryCode(detail.country) === "TH" || !detail.country;
  const twoWheeler = isTwoWheeler(kindFromCategory(detail.category));
  const porborDaysLeft = daysUntil(vehicle.metadata?.compliance?.porbor_expiry_date);
  const specs = (vehicle.specifications || {}) as Record<string, unknown>;
  const paperDetails = [
    [vehicle.registration_number, vehicle.metadata?.registration_province].filter(Boolean).join(" "),
    [vehicle.make, vehicle.model, vehicle.trim, vehicle.year].filter(Boolean).join(" "),
    vehicle.color,
    vehicle.vin ? `VIN: ${vehicle.vin}` : "",
    specs.engine_number || vehicle.metadata?.engine_number ? `Engine: ${specs.engine_number || vehicle.metadata?.engine_number}` : "",
    specs.engine_cc || vehicle.metadata?.engine_cc ? `${specs.engine_cc || vehicle.metadata?.engine_cc} cc` : ""
  ].filter(Boolean).join("\n");
  // A signed broker partner's quote page for this vehicle (off until one is set up): vehicle details only.
  const quoteVehicle = { plate: vehicle.registration_number, province: vehicle.metadata?.registration_province, make: vehicle.make, model: vehicle.model, year: builtYear || null, vin: vehicle.vin, cc: (specs.engine_cc || vehicle.metadata?.engine_cc) as string | number | null };
  const partners = { insurance: partnerQuote("insurance", quoteVehicle), porbor: partnerQuote("porbor", quoteVehicle) };

  return (
    <Fold
      open={needsLook}
      summary={!saved ? tx.say("cs_none") : `${tx.say("cs_saved", { saved, total: items.length })}${soonest ? ` · ${tx.say("cs_next", { name: soonest.name, date: formatDate(soonest.date, tx) })}` : ""}`}
      title={tx.say("cs_title")}
      tone={needsLook ? (soonestDays! < 7 ? "red" : "amber") : "neutral"}
    >
      <div className="grid gap-2.5">
        {items.map((item) => {
          const state = urgency(daysUntil(item.date), tx);
          return (
            <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5" key={item.key}>
              <div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{item.name}</p>
                    {item.date ? <span className={`font-bold ${toneText[state.tone]}`}>{state.label}</span> : null}
                  </div>
                  <p className="font-medium text-[var(--foreground-secondary)]">
                    {item.date ? `${tx.say(state.tone === "red" && (daysUntil(item.date) ?? 0) < 0 ? "cs_ranOut" : "cs_runsOut", { date: formatDate(item.date, tx) })}${item.cost ? ` · ${tx.say(item.monthly ? "cs_monthly" : "cs_lastCost", { amount: money(item.cost) })}` : ""}` : tx.say("cs_noDate")}
                  </p>
                </div>
              </div>
              {thai && (item.key === "tax" || item.key === "porbor" || item.key === "insurance") && item.date && (daysUntil(item.date) ?? 999) <= 90 ? (
                <RenewalHelp details={paperDetails} kind={item.key} partner={item.key === "tax" ? null : partners[item.key]} porborDaysLeft={porborDaysLeft} twoWheeler={twoWheeler} vehicleAge={vehicleAge} />
              ) : null}
              {/* Outside Thailand: the usual interval and the official page (lib/country-paperwork.ts). */}
              {!thai && item.howTo && (!item.date || (daysUntil(item.date) ?? 999) <= 90) ? (
                <details className="mt-2.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2">
                  <summary className="cursor-pointer font-bold text-[var(--primary)]">{tx.say("rn_how")}</summary>
                  <p className="mt-2 text-[15px] font-medium text-[var(--foreground-secondary)]">{tx.say(item.howTo.key)}</p>
                  {item.howTo.url ? (
                    <a className="secondary-action pressable mt-2 min-h-9 px-3 text-[14px]" href={item.howTo.url} rel="noreferrer" target="_blank">
                      {tx.say("rn_official")}
                    </a>
                  ) : null}
                </details>
              ) : null}
              <details className="mt-2.5">
                <summary className="cursor-pointer font-bold text-[var(--primary)]">{item.date ? tx.say("cs_renewed") : tx.say("cs_addDate")}</summary>
                <RenewalForm
                  complianceType={item.key}
                  currency={detail.currency || "THB"}
                  currentExpiry={item.date ? String(item.date).slice(0, 10) : null}
                  inspection={item.inspection}
                  organizationId={organizationId}
                  paperwork={Boolean(item.paperwork)}
                  readable={Boolean(item.paperwork)}
                  today={businessToday()}
                  vehicleId={detail.vehicle.id}
                />
              </details>
            </div>
          );
        })}
      </div>
    </Fold>
  );
}

/** The year at a glance, on the page itself (Rory, 1 Nov 2026): rentals, services, checks and paperwork as one picture. */
function YearSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const rentals: YearRental[] = detail.rentals
    .filter((rental: any) => rental.start_date && !["cancelled"].includes(String(rental.status || "")) && !rental.deleted_at)
    .map((rental: any) => ({
      id: String(rental.id),
      start: String(rental.start_date).slice(0, 10),
      end: rental.end_date ? String(rental.end_date).slice(0, 10) : null,
      name: String(rental.customers?.full_name || tx.say("customer")).split(" ")[0],
      upcoming: rental.status === "booked"
    }));
  const marks: YearMark[] = [
    ...detail.maintenanceEvents
      .filter((event: any) => event.service_date)
      .map((event: any) => ({ id: `m-${event.id}`, date: String(event.service_date).slice(0, 10), kind: "service" as const, label: String(event.title || event.description || event.service_type || "") })),
    ...detail.inspections
      .filter((inspection: any) => inspection.completed_at || inspection.created_at)
      .map((inspection: any) => ({ id: `i-${inspection.id}`, date: String(inspection.completed_at || inspection.created_at).slice(0, 10), kind: "check" as const, label: String(inspection.inspection_type || "") })),
    ...getComplianceItems(detail, tx)
      .filter((item) => item.date)
      .map((item) => ({ id: `c-${item.key}`, date: String(item.date).slice(0, 10), kind: "paper" as const, label: tx.say("tl_due", { name: item.name }) }))
  ];
  return (
    <Pane title={tx.say("yr_title")}>
      <VehicleYear
        labels={{ rentals: tx.say("yr_rentals"), upkeep: tx.say("yr_upkeep"), today: tx.say("yr_today"), service: tx.say("yr_service"), paper: tx.say("yr_paper"), check: tx.say("yr_check"), nothing: tx.say("yr_nothing") }}
        locale={tx.locale}
        marks={marks}
        rentals={rentals}
        today={businessToday()}
      />
    </Pane>
  );
}

function TimelineSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const complianceEvents = getComplianceItems(detail, tx)
    .filter((item) => item.date)
    .map((item) => ({ id: `future-${item.key}`, title: tx.say("tl_due", { name: item.name }), detail: formatDate(item.date, tx), date: item.date!, kind: "compliance" as const }));
  const reminderEvents = detail.reminders.map((reminder) => ({ id: `reminder-${reminder.id}`, title: reminder.title, detail: reminder.type, date: reminder.due_date, kind: "reminder" as const }));
  // Bookkeeping steps behind a signed document ("document created", "version
  // created") are noise on a vehicle's history; the signing itself stays.
  // The same rule as a booking's history: the app's own record-keeping is left out, and what is left is named
  // in the reader's language (the stored titles and details are English sentences).
  const histNames = useTranslations("booking");
  const activityEvents = visibleActivity(detail.activityEvents as any[])
    // Services and repairs come from their own records below (with the cost), not from the activity line.
    .filter((event: any) => !isQuietActivityEvent(event.event_type) && event.event_type !== "maintenance_completed")
    .map((event) => ({ id: event.id, title: activityTitle(event, histNames as any), detail: tx.locale === "en" ? tidyDetail(event.detail, event.title) : null, date: event.occurred_at || event.created_at, kind: "activity" as const }));
  const rentalReturns = detail.rentals
    .filter((rental) => rental.end_date && rental.status !== "cancelled" && rental.status !== "draft")
    .map((rental) => ({
      id: `return-${rental.id}-${rental.start_date}`,
      // Moved on to another vehicle on this day (lib/rental-vehicle-periods.ts).
      title:
        rental.vehicle_period?.toVehicleId && rental.moved_to_label
          ? tx.say("h_changedTo", { vehicle: rental.moved_to_label })
          : tx.say("tl_return", { name: rental.customers?.full_name || tx.say("customer") }),
      detail: rental.vehicle_period?.toVehicleId ? rental.customers?.full_name || null : null,
      date: rental.end_date!,
      kind: "rental" as const
    }));
  // The vehicle's lifecycle: each rental going out, each service or repair with its cost, and damage found on return.
  // A handover already has its own line ("Vehicle handed over"); this fills in rentals that went out without one (imports, old data).
  const handedOver = new Set((detail.activityEvents as any[]).filter((event) => ["delivery_inspection_completed", "handed_over_without_form"].includes(String(event.event_type))).map((event) => event.rental_id));
  const rentalStarts = detail.rentals
    .filter((rental) => rental.start_date && !handedOver.has(rental.id) && ["active", "due_soon", "overdue", "extended", "completed"].includes(String(rental.status)))
    .map((rental) => ({
      id: `out-${rental.id}-${rental.start_date}`,
      title: tx.say("tl_out", { name: rental.customers?.full_name || tx.say("customer") }),
      detail: rental.end_date ? tx.say("h_range", { from: formatDate(rental.start_date, tx), to: formatDate(rental.end_date, tx) }) : null,
      date: String(rental.start_date),
      kind: "rental" as const
    }));
  const serviceEvents = detail.maintenanceEvents
    .filter((event: any) => event.service_date)
    .map((event: any) => ({
      id: `svc-${event.id}`,
      title: tx.say(event.event_type === "repair" ? "tl_repair" : "tl_service"),
      detail: [Number(event.cost) > 0 ? money(event.cost) : "", event.supplier || "", event.notes || ""].filter(Boolean).join(" · ") || null,
      date: String(event.service_date).slice(0, 10),
      kind: "service" as const
    }));
  const damageEvents = detail.inspections
    .filter((inspection: any) => (inspection.type || inspection.inspection_type) === "return")
    .map((inspection: any) => ({ inspection, fresh: (Array.isArray(inspection.damage_items) ? inspection.damage_items : []).filter((item: any) => item?.is_pre_existing !== true).length }))
    .filter(({ fresh }) => fresh > 0)
    .map(({ inspection, fresh }) => ({
      id: `dmg-${inspection.id}`,
      title: tx.say("tl_damage", { count: fresh }),
      detail: inspection.customers?.full_name || null,
      date: String(inspection.submitted_at || inspection.created_at),
      kind: "damage" as const
    }));
  const events: VehicleTimelineEvent[] = [...complianceEvents, ...reminderEvents, ...rentalStarts, ...rentalReturns, ...serviceEvents, ...damageEvents, ...activityEvents]
    .filter((event) => Boolean(event.date))
    .map((event) => ({ id: String(event.id), title: String(event.title), detail: event.detail ? String(event.detail) : null, date: String(event.date), kind: event.kind }));
  // Thai calendar dates: the server clock is UTC.
  const todayIso = businessToday();
  const oneYearAgo = `${Number(todayIso.slice(0, 4)) - 1}${todayIso.slice(4)}`;

  return (
    <Pane summary={tx.say("tl_summary", { count: events.filter((event) => event.date.slice(0, 10) <= todayIso).length })} title={tx.say("tl_title")}>
      <VehicleTimeline defaultFrom={oneYearAgo} defaultTo={todayIso} events={events} />
    </Pane>
  );
}

function InspectionsSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const [latest, ...older] = detail.inspections;
  const kindName = (inspection: any) => {
    const kind = String(inspection.type || inspection.inspection_type || "");
    return tx.has(`in_${kind}`) ? tx.say(`in_${kind}`) : kind;
  };

  return (
    <Pane id="inspections" title={tx.say("in_title")}>
      {!latest ? (
        <EmptyState action={<Link className="font-bold text-[var(--primary)]" href={`/inspections/condition/${detail.vehicle.id}` as Route}>{tx.say("in_start")}</Link>}>
          {tx.say("in_none")}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <InspectionViewer inspection={latest} />
          {older.map((inspection) => (
            <details className="rounded-xl bg-[var(--panel-secondary)] p-3.5" key={inspection.id}>
              <summary className="cursor-pointer font-bold text-[var(--foreground)]">
                {kindName(inspection)} · {formatDate(inspection.inspected_at, tx)} · {tx.say(distanceKey("km"), { km: Number(inspection.odometer_reading || inspection.mileage || 0).toLocaleString("en-US") })}
              </summary>
              <div className="mt-3">
                <InspectionViewer inspection={inspection} />
              </div>
            </details>
          ))}
        </div>
      )}
    </Pane>
  );
}

function FinancialSection({ detail, isOwner }: { detail: VehicleDetail; isOwner: boolean }) {
  const tx = useVx();
  const f = detail.financials;
  const chartMonths = f.monthlyChart.map((month, index) => ({
    key: String(index),
    label: shortMonth(new Date(businessNow().getFullYear(), businessNow().getMonth() - (f.monthlyChart.length - 1 - index), 1), tx.locale),
    in: month.revenue,
    out: month.expenses
  }));
  // A year of empty stubs with one bar says nothing: the chart waits for two months with money in or out.
  const monthsWithMoney = chartMonths.filter((month) => month.in > 0 || month.out > 0).length;

  return (
    // No summary line: it only repeated a figure shown in the tile above and in the rows below.
    <Pane
      title={tx.say("fi_title")}
      tone={isOwner && f.lifetimeProfit < 0 ? "red" : "neutral"}
    >
      {/* Three figures: this month, money in all time, costs all time. Profit is already the first tile above the tabs.
          What was paid and what it is worth are the owner's; a teammate sees the money in and out. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <InfoRow label={tx.say("fi_month")} value={money(f.currentMonthRevenue)} />
        <InfoRow label={tx.say("fi_totalIn")} value={money(f.lifetimeRevenue)} />
        <InfoRow label={tx.say("fi_totalOut")} value={money(f.lifetimeExpenses)} />
        {isOwner && f.purchasePrice > 0 ? <InfoRow label={tx.say("fi_purchase")} value={money(f.purchasePrice)} /> : null}
        {isOwner && f.estimatedValue > 0 ? <InfoRow label={tx.say("fi_value")} value={money(f.estimatedValue)} /> : null}
        {isOwner && f.purchasePrice > 0 && f.estimatedValue > 0 ? <InfoRow label={tx.say("fi_depreciation")} value={money(f.depreciation)} /> : null}
        {isOwner && f.purchasePrice > 0 ? <InfoRow danger={f.roi < 0} label={tx.say("fi_roi")} value={percent(f.roi)} /> : null}
      </div>
      {monthsWithMoney < 2 ? null : (
      <div className="mt-3 rounded-2xl bg-[var(--panel-secondary)] p-3.5">
        <p className="font-bold text-[var(--foreground)]">{tx.say("fi_chart")}</p>
        {[
          { months: chartMonths, className: "hidden sm:block" },
          { months: chartMonths.slice(-6), className: "sm:hidden" }
        ].map((view) => (
          <div className={view.className} key={view.className}>
            <InOutBars inWord={tx.say("fi_inWord")} label={tx.say("fi_chart")} money={money} outWord={tx.say("fi_outWord")} periods={view.months} />
          </div>
        ))}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-semibold text-[var(--foreground-secondary)]">
          <span className="inline-flex items-center gap-1.5"><Dot color="var(--chart-in)" />{tx.say("fi_inWord")}</span>
          <span className="inline-flex items-center gap-1.5"><Dot color="var(--chart-out)" />{tx.say("fi_outWord")}</span>
        </p>
      </div>
      )}
      {/* Every payment in and out for this vehicle sits under its totals: one subject, one row on the page. */}
      <TransactionsSection detail={detail} />
    </Pane>
  );
}

function MetricBar({ label, value, note, tone = "green" }: { label: string; value: number; note?: string; tone?: "green" | "blue" }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-bold text-[var(--foreground)]">
        <span>{label}</span>
        <span className="tabular-nums">{percent(value)}</span>
      </div>
      <ProgressBar tone={tone} value={value} />
      {note ? <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{note}</p> : null}
    </div>
  );
}

/**
 * The vehicle's life so far, in one compact block (Rory, 7 Nov 2026: understand the lifecycle of each vehicle).
 * Money figures are the owner's, as elsewhere on this page; a teammate sees the rental side only.
 */
function LifecycleSummary({ detail, isOwner }: { detail: VehicleDetail; isOwner: boolean }) {
  const tx = useVx();
  const u = detail.utilization;
  const f = detail.financials;
  const lastService = detail.maintenanceEvents.find((event: any) => event.service_date && event.event_type !== "repair") || detail.maintenanceEvents.find((event: any) => event.service_date);
  const facts: Array<[string, string]> = [
    [tx.say("lc_since"), longDate(u.ownedSince, tx.locale)],
    [tx.say("lc_rentals"), String(u.rentalsCount)],
    [tx.say("lc_daysRented"), tx.say("lc_daysOf", { days: u.daysRentedAll, owned: u.daysOwned })],
    [tx.say("lc_lastService"), lastService ? longDate(String(lastService.service_date).slice(0, 10), tx.locale) : tx.say("lc_none")]
  ];
  if (isOwner) {
    facts.push(
      [tx.say("lc_revenue"), money(f.lifetimeRevenue)],
      [tx.say("lc_costs"), money(f.lifetimeExpenses)],
      [tx.say("lc_net"), money(f.lifetimeProfit)],
      [tx.say("lc_perDay"), money(u.daysOwned > 0 ? f.lifetimeRevenue / u.daysOwned : 0)]
    );
  }
  return (
    <div className="mb-4 rounded-2xl bg-[var(--panel-secondary)] p-3.5">
      <p className="font-bold text-[var(--foreground)]">{tx.say("lc_title")}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div className="min-w-0" key={label}>
            <dt className="text-sm font-semibold text-[var(--muted)]">{label}</dt>
            <dd className={`num mt-0.5 truncate text-[17px] ${label === tx.say("lc_net") && f.lifetimeProfit < 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{value}</dd>
          </div>
        ))}
      </dl>
      {/* Rented share of the last 30, 90 and 365 days: three small bars rather than three more numbers. */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {([["lc_30", u.last30], ["lc_90", u.last90], ["lc_365", u.last365]] as Array<[string, number]>).map(([key, value]) => (
          <div key={key}>
            <p className="flex items-baseline justify-between gap-1 text-sm font-semibold text-[var(--muted)]">
              <span className="truncate">{tx.say(key)}</span>
              <span className="num text-[15px] text-[var(--foreground)]">{percent(value)}</span>
            </p>
            <PartBar part={value} whole={100} color="var(--on-rent)" />
          </div>
        ))}
      </div>
    </div>
  );
}

function UtilizationSection({ detail, isOwner }: { detail: VehicleDetail; isOwner: boolean }) {
  const tx = useVx();
  const u = detail.utilization;
  return (
    <Pane summary={tx.say("u_summary", { percent: percent(u.twelveMonth) })} title={tx.say("u_title")}>
      <LifecycleSummary detail={detail} isOwner={isOwner} />
      <div className="space-y-3">
        <MetricBar label={tx.say("u_12")} note={tx.say("u_fleetAvg", { percent: percent(u.fleetAverage) })} value={u.twelveMonth} />
        <MetricBar label={tx.say("u_life")} tone="blue" value={u.lifecycle} />
        <div className="grid grid-cols-2 gap-2.5">
          <InfoRow label={tx.say("u_daysRented")} value={u.daysRentedThisYear} />
          <InfoRow label={tx.say("u_daysFree")} value={u.daysAvailableThisYear} />
          <InfoRow label={tx.say("u_daysShop")} value={u.daysMaintenanceThisYear} />
          <InfoRow label={tx.say("u_avgRate")} value={money(u.averageDailyRate)} />
        </div>
      </div>
      <RentalHistorySection detail={detail} />
    </Pane>
  );
}

function MaintenanceSection({ detail, organizationId, currency }: { detail: VehicleDetail; organizationId: string; currency: string }) {
  const tx = useVx();
  const compliance = detail.vehicle.metadata?.compliance || {};
  const typeName = (type: string) => (tx.has(`mt_${type}`) ? tx.say(`mt_${type}`) : type.replace(/_/g, " "));
  const km = (value: unknown) => Number(value || 0).toLocaleString("en-US");
  const nextKm = Number(compliance.next_service_mileage || 0) || null;
  const kmLeft = serviceKmLeft(compliance, detail.vehicle.mileage);

  return (
    <Fold
      id="maintenance"
      summary={
        compliance.next_service_date
          ? tx.say("m_summaryNext", { date: nextKm ? tx.say(distanceKey("sv_nextBoth"), { date: formatDate(compliance.next_service_date, tx), km: km(nextKm) }) : formatDate(compliance.next_service_date, tx) })
          : nextKm
            ? tx.say("m_summaryNext", { date: tx.say(distanceKey("sv_kmOnly"), { km: km(nextKm) }) })
            : tx.say("m_summaryNone")
      }
      title={tx.say("m_title")}
    >
      {/* Next service by date, km or both (whichever comes first), and when it was last serviced and the oil last changed. */}
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
          <p className="font-semibold text-[var(--muted)]">{tx.say("m_nextLabel")}</p>
          <p className="mt-0.5 font-bold text-[var(--foreground)]">
            {compliance.next_service_date && nextKm
              ? tx.say(distanceKey("sv_nextBoth"), { date: formatDate(compliance.next_service_date, tx), km: km(nextKm) })
              : compliance.next_service_date
                ? formatDate(compliance.next_service_date, tx)
                : nextKm
                  ? tx.say(distanceKey("m_atKm"), { km: km(nextKm) })
                  : tx.say("m_notYet")}
          </p>
          {kmLeft !== null ? <p className={`font-medium ${kmLeft < 0 ? "text-[var(--danger)]" : kmLeft <= 500 ? "text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}`}>{kmLeft < 0 ? tx.say(distanceKey("sv_kmOver"), { km: km(-kmLeft) }) : tx.say(distanceKey("sv_kmLeft"), { km: km(kmLeft) })}</p> : null}
        </div>
        <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
          <p className="font-semibold text-[var(--muted)]">{tx.say("m_last")}</p>
          <p className="mt-0.5 font-bold text-[var(--foreground)]">{compliance.last_service_date ? formatDate(compliance.last_service_date, tx) : tx.say("m_notYet")}</p>
          {compliance.last_service_mileage ? <p className="font-medium text-[var(--foreground-secondary)]">{tx.say(distanceKey("km"), { km: km(compliance.last_service_mileage) })}</p> : null}
        </div>
        <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
          <p className="font-semibold text-[var(--muted)]">{tx.say("m_lastOil")}</p>
          <p className="mt-0.5 font-bold text-[var(--foreground)]">{compliance.last_oil_change_date ? formatDate(compliance.last_oil_change_date, tx) : tx.say("m_notYet")}</p>
          {compliance.last_oil_change_mileage ? <p className="font-medium text-[var(--foreground-secondary)]">{tx.say(distanceKey("km"), { km: km(compliance.last_oil_change_mileage) })}</p> : null}
        </div>
      </div>
      <details className="mt-3 scroll-mt-4" id="log-service">
        <summary className="secondary-action pressable inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <Wrench size={17} />
          {tx.say("m_log")}
        </summary>
        <ActionForm action={logVehicleMaintenance} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="vehicleId" type="hidden" value={detail.vehicle.id} />
          <input name="organizationId" type="hidden" value={organizationId} />
          <label className="block">
            <span className={labelClass}>{tx.say("m_type")}</span>
            <select className={inputClass} name="eventType" required>
              {["service", "oil_change", "repair", "tyres", "battery"].map((type) => (
                <option key={type} value={type}>{typeName(type)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>{tx.say("m_date")}</span>
            <input className={inputClass} defaultValue={businessToday()} name="serviceDate" required type="date" />
          </label>
          <label className="block">
            <span className={labelClass}>{tx.say("f_cost")}</span>
            <MoneyInput currency={currency} name="cost" />
          </label>
          <label className="block">
            <span className={labelClass}>{tx.say("m_odometer")}</span>
            <input className={inputClass} inputMode="numeric" min="0" name="mileage" type="number" />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>{tx.say("m_garage")}</span>
            <input className={inputClass} name="supplier" />
          </label>
          {/* Some services include an oil change and some don't; when the oil was last changed is tracked on its own. */}
          <label className="flex items-center gap-3 font-semibold text-[var(--foreground)] sm:col-span-2">
            <input className="h-5 w-5 shrink-0" name="oilChanged" type="checkbox" value="true" />
            {tx.say("m_oil")}
          </label>
          <label className="block">
            <span className={labelClass}>{tx.say("m_nextDate")}</span>
            {/* A year on, as most services are yearly; change or clear it. Ignored for repairs, tyres and batteries. */}
            <input className={inputClass} defaultValue={`${Number(businessToday().slice(0, 4)) + 1}${businessToday().slice(4)}`.replace(/-02-29$/, "-02-28")} name="nextDueDate" type="date" />
          </label>
          <label className="block">
            <span className={labelClass}>{tx.say(distanceKey("m_nextKm"))}</span>
            <input className={inputClass} inputMode="numeric" min="0" name="nextDueMileage" type="number" />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>{tx.say("m_receipt")}</span>
            <input className="mt-1 w-full" name="receiptFile" type="file" />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>{tx.say("f_notes")}</span>
            <textarea className={inputClass} name="notes" />
          </label>
          <PendingButton className="primary-action sm:col-span-2" pendingLabel={tx.say("saving")} type="submit">
            {tx.say("m_save")}
          </PendingButton>
        </ActionForm>
      </details>
      <div className="mt-3 space-y-2">
        {detail.maintenanceEvents.length === 0 ? (
          <EmptyState>{tx.say("m_none")}</EmptyState>
        ) : (
          detail.maintenanceEvents.map((event) => (
            <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5" key={event.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[16px] font-bold text-[var(--foreground)]">
                    {typeName(String(event.event_type || ""))}
                    {(event as any).oil_changed && event.event_type !== "oil_change" ? <span className="ml-2 rounded-full bg-[var(--primary-light)] px-2 py-0.5 text-[13px] font-bold text-[var(--primary)]">{tx.say("m_oil")}</span> : null}
                  </p>
                  <p className="font-medium text-[var(--foreground-secondary)]">
                    {[formatDate(event.service_date, tx), event.mileage ? tx.say(distanceKey("km"), { km: Number(event.mileage).toLocaleString("en-US") }) : null, event.supplier || null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {event.cost ? <span className="shrink-0 text-[16px] font-bold tabular-nums text-[var(--foreground)]">{money(event.cost)}</span> : null}
              </div>
              {event.notes ? <p className="mt-1.5 font-medium text-[var(--foreground-secondary)]">{event.notes}</p> : null}
            </div>
          ))
        )}
      </div>
    </Fold>
  );
}

function TasksSection({ detail, organizationId }: { detail: VehicleDetail; organizationId: string }) {
  const tx = useVx();
  const todo = useTranslations("todo");
  const typeName = (type: string, fallback: string) => (todo.has(`type_${type}` as never) ? (todo as unknown as Say)(`type_${type}`) : fallback);
  const visibleTasks = detail.vehicleTasks.slice(0, 5);
  const extraCount = Math.max(0, detail.vehicleTasks.length - visibleTasks.length);

  return (
    <Pane open={detail.vehicleTasks.length > 0} summary={tx.say("t_summary", { count: detail.vehicleTasks.length })} title={tx.say("t_title")}>
      {visibleTasks.length === 0 ? (
        <EmptyState>{tx.say("t_none")}</EmptyState>
      ) : (
        <div className="space-y-2">
          <VehicleJobs items={visibleTasks} organizationId={organizationId} today={businessToday()} vehicleId={detail.vehicle.id} />
          {extraCount > 0 ? (
            <Link className="inline-flex font-bold text-[var(--primary)]" href="/tasks">
              {tx.say("t_all", { count: detail.vehicleTasks.length })}
            </Link>
          ) : null}
        </div>
      )}
      <details className="mt-3">
        <summary className="secondary-action pressable inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">{tx.say("t_add")}</summary>
        <ActionForm action={createVehicleTask} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="vehicleId" type="hidden" value={detail.vehicle.id} />
          <input name="organizationId" type="hidden" value={organizationId} />
          <label className="block sm:col-span-2">
            <span className={labelClass}>{tx.say("t_name")}</span>
            <input className={inputClass} name="title" placeholder={tx.say("t_placeholder")} required />
          </label>
          <label className="block">
            <span className={labelClass}>{tx.say("t_due")}</span>
            <input className={inputClass} name="dueDate" type="date" />
          </label>
          <label className="block">
            <span className={labelClass}>{tx.say("t_type")}</span>
            <select className={inputClass} name="taskType">
              {TASK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{typeName(option.value, option.label)}</option>
              ))}
            </select>
          </label>
          <PendingButton className="primary-action sm:col-span-2" pendingLabel={tx.say("t_adding")} type="submit">
            {tx.say("t_add")}
          </PendingButton>
        </ActionForm>
      </details>
    </Pane>
  );
}

/** A list that lives inside another section: a heading and the rows, with no row of its own on the page. */
function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="font-bold text-[var(--foreground)]">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TransactionsSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const moneyWords = useTranslations("money");
  const typeName = (type: string) => (moneyWords.has(`type_${type}` as never) ? (moneyWords as unknown as Say)(`type_${type}`) : type.replace(/_/g, " "));

  return (
    <Part title={tx.say("x_title")}>
      {detail.transactions.length === 0 ? (
        <EmptyState action={<Link className="font-bold text-[var(--primary)]" href={detailUrl("/transactions/new", detail.vehicle.id)}>{tx.say("x_first")}</Link>}>
          {tx.say("x_none")}
        </EmptyState>
      ) : (
        // Eight at first, ten more each tap: a car's whole history scrolled forever on a phone (Rory, 2 Nov 2026).
        <ShowMoreList className="space-y-2">
          {detail.transactions.map((transaction) => {
            const expense = expenseTypes.has(transaction.type);
            // A deposit taken or handed back is not income or a cost: shown plainly, without a plus or minus.
            const held = transaction.type === "deposit_received" || transaction.type === "deposit_refunded";
            // Notes the app wrote for its own records are English sentences; only notes a person typed are shown.
            const note = typedNote(transaction.notes);
            const extra = [
              transaction.supplier ? tx.say("x_paidTo", { name: transaction.supplier }) : null,
              transaction.mileage ? tx.say(distanceKey("x_mileage"), { km: Number(transaction.mileage).toLocaleString("en-US") }) : null,
              transaction.receipt_document_id ? tx.say("x_receipt") : null
            ].filter(Boolean);
            return (
              <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5" key={transaction.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[16px] font-bold text-[var(--foreground)]">{typeName(transaction.type)}</p>
                    <p className="font-medium text-[var(--foreground-secondary)]">{[formatDate(transaction.transaction_date, tx), note].filter(Boolean).join(" · ")}</p>
                    {extra.length ? <p className="font-medium text-[var(--muted)]">{extra.join(" · ")}</p> : null}
                  </div>
                  <span className={`shrink-0 text-[16px] font-bold tabular-nums ${expense || held ? "text-[var(--foreground)]" : "text-[var(--success)]"}`}>
                    {held ? "" : expense ? "−" : "+"}
                    {money(Math.abs(Number(transaction.amount || 0)))}
                  </span>
                </div>
              </div>
            );
          })}
        </ShowMoreList>
      )}
    </Part>
  );
}

function daysBetween(start: string, end: string) {
  const from = Date.parse(`${String(start).slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${String(end).slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round((to - from) / 86_400_000) + 1);
}

function RentalHistorySection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const bookings = useTranslations("bookings");
  const statusName = (status: string) => (bookings.has(`status_${status}` as never) ? (bookings as unknown as Say)(`status_${status}`) : status.replace(/_/g, " "));
  const totalRentalDays = detail.rentals.reduce((sum, rental) => sum + Math.max(1, daysBetween(rental.start_date, rental.end_date || businessToday())), 0);

  return (
    <Part title={`${tx.say("h_title")} · ${detail.rentals.length}`}>
      {detail.rentals.length === 0 ? (
        <EmptyState>{tx.say("h_none")}</EmptyState>
      ) : (
        <>
          <p className="font-medium text-[var(--foreground-secondary)]">{tx.say("h_avg")}: {tx.say("h_avgDays", { count: Math.round(totalRentalDays / detail.rentals.length) })}</p>
          <div className="mt-2 space-y-2">
            {detail.rentals.map((rental) => {
              // Changed vehicle part-way: on this vehicle for these dates only (lib/rental-vehicle-periods.ts).
              const movedOn = Boolean(rental.vehicle_period?.toVehicleId);
              const status = movedOn ? "completed" : rental.status;
              const swapLine = movedOn
                ? rental.moved_to_label && tx.say("h_changedTo", { vehicle: rental.moved_to_label })
                : rental.vehicle_period?.fromVehicleId && rental.moved_from_label && tx.say("h_changedFrom", { vehicle: rental.moved_from_label });
              return (
                <Link className="block rounded-xl bg-[var(--panel-secondary)] p-3.5" href={`/bookings/${rental.id}` as Route} key={`${rental.id}-${rental.start_date}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[16px] font-bold text-[var(--foreground)]">{rental.customers?.full_name || tx.say("customer")}</p>
                      <p className="font-medium text-[var(--foreground-secondary)]">
                        {rental.end_date ? tx.say("h_range", { from: formatDate(rental.start_date, tx), to: formatDate(rental.end_date, tx) }) : tx.say("h_ongoing", { from: formatDate(rental.start_date, tx) })}
                        {rental.km_driven && !rental.vehicle_period ? ` · ${tx.say(distanceKey("h_km"), { km: Number(rental.km_driven).toLocaleString("en-US") })}` : ""}
                      </p>
                      {swapLine ? <p className="font-medium text-[var(--foreground-secondary)]">{swapLine}</p> : null}
                    </div>
                    <Badge tone={["active", "due_soon", "extended"].includes(status) ? "blue" : status === "completed" ? "green" : status === "overdue" || status === "cancelled" ? "red" : "amber"}>{statusName(status)}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </Part>
  );
}

function DocumentsSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  return (
    // id="files": Settings › Files links here (opens Paperwork & service and scrolls to this).
    <Fold id="files" summary={tx.say("d_summary", { count: detail.documents.length })} title={tx.say("d_title")}>
      {detail.documents.length === 0 ? (
        <EmptyState>{tx.say("d_none")}</EmptyState>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {detail.documents.map((document) => (
            <a className="flex items-start gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5" href={document.url || "#"} key={document.id} rel="noreferrer" target="_blank">
              <FileText className="mt-0.5 shrink-0 text-[var(--foreground-secondary)]" size={20} />
              <span className="min-w-0">
                <span className="block truncate font-bold text-[var(--foreground)]">{document.fileName}</span>
                <span className="block font-medium text-[var(--foreground-secondary)]">{tx.say("d_added", { date: formatDate(document.createdAt, tx) })}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </Fold>
  );
}

function GpsSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  if (!detail.gpsDevice) return null;
  const offline = !detail.gpsDevice.last_seen_at;

  return (
    <Pane
      summary={offline ? tx.say("gp_never") : tx.say("g_lastSeen", { date: formatDate(detail.gpsDevice.last_seen_at, tx) })}
      title={tx.say("gp_title")}
      tone={offline ? "red" : "neutral"}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold text-[var(--foreground)]">{[detail.gpsDevice.provider, detail.gpsDevice.imei ? `IMEI ${detail.gpsDevice.imei}` : null].filter(Boolean).join(" · ")}</p>
        <Badge tone={offline ? "red" : "green"}>{offline ? tx.say("g_offline") : tx.say("g_online")}</Badge>
      </div>
      <p className="mt-2 flex items-center gap-2 font-medium text-[var(--foreground-secondary)]">
        <MapPin size={17} />
        {detail.latestLocation ? `${detail.latestLocation.latitude}, ${detail.latestLocation.longitude}` : tx.say("gp_noPing")}
      </p>
    </Pane>
  );
}

function SpecsSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const specs = detail.vehicle.specifications || {};
  // Only what has been filled in: a wall of "Not set" told nobody anything.
  const rows = (
    [
      ["s_make", detail.vehicle.make],
      ["s_model", detail.vehicle.model],
      ["s_trim", detail.vehicle.trim],
      ["s_year", detail.vehicle.year],
      ["s_colour", detail.vehicle.color],
      ["s_body", specs.body_class ? (String(specs.body_class).length <= 3 ? String(specs.body_class).toUpperCase() : String(specs.body_class).charAt(0).toUpperCase() + String(specs.body_class).slice(1)) : null],
      ["s_engine", specs.engine_cc],
      ["s_gearbox", specs.transmission],
      ["s_fuel", specs.fuel_type],
      ["s_seats", specs.seating_capacity],
      ["s_drive", specs.drivetrain],
      ["s_vin", detail.vehicle.vin],
      ["s_bought", detail.vehicle.purchase_date ? formatDate(detail.vehicle.purchase_date, tx) : null]
    ] as Array<[string, unknown]>
  ).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "");

  return (
    <Pane summary={[detail.vehicle.year, detail.vehicle.color, specs.transmission].filter(Boolean).join(" · ") || undefined} title={tx.say("s_title")}>
      <div className="grid grid-cols-2 gap-2.5">
        {rows.map(([key, value]) => (
          <InfoRow key={key} label={tx.say(key)} value={String(value)} />
        ))}
      </div>
      <Link className="secondary-action pressable mt-3 inline-flex" href={`/fleet/${detail.vehicle.id}/edit` as Route}>
        <PenLine size={17} />
        {tx.say("a_edit")}
      </Link>
    </Pane>
  );
}

function FinanceSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const finance = detail.vehicle.metadata?.finance || {};
  if (!hasLoan(finance)) return null;
  const totalPaid = detail.transactions.filter((transaction) => transaction.type === "finance").reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  // Worked out from the sale price, down payment, monthly payment, loan length and months left (lib/vehicle-loan.ts).
  const f = loanFigures(finance);

  return (
    <Fold summary={f.stillToPay ? `${tx.say("l_balance")} ${money(f.stillToPay)}` : undefined} title={tx.say("l_title")}>
      <div className="grid grid-cols-2 gap-2.5">
        {finance.lender ? <InfoRow label={tx.say("l_lender")} value={finance.lender} /> : null}
        <InfoRow label={tx.say("l_monthly")} value={money(finance.monthly_payment)} />
        <InfoRow label={tx.say("l_balance")} value={money(f.stillToPay)} />
        {f.monthsLeftNow !== null ? <InfoRow label={tx.say("l_monthsLeft")} value={String(f.monthsLeftNow)} /> : null}
        <InfoRow label={tx.say("l_end")} value={formatDate(f.endDate || finance.end_date, tx)} />
        {f.totalCost !== null ? <InfoRow label={tx.say("l_totalCost")} value={money(f.totalCost)} /> : null}
        {f.interest !== null ? (
          <InfoRow
            label={tx.say("l_interest")}
            value={f.flatRatePerYear !== null && f.interest > 0 ? `${money(f.interest)} · ${tx.say("l_flatRate", { rate: f.flatRatePerYear.toFixed(1) })}` : money(f.interest)}
          />
        ) : null}
        <InfoRow label={tx.say("l_paid")} value={money(totalPaid)} />
      </div>
    </Fold>
  );
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [userEmail, organization, t, locale] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getTranslations("vehiclePage"), getLocale()]);
  const tx: Vx = { say: t as unknown as Say, has: (key) => t.has(key as never), locale };
  const [detail, membership] = await Promise.all([getVehicleDetail(id, organization.id), getCurrentMembership()]);
  const isOwner = membership?.role === "owner";

  if (!detail) {
    return (
      <AppShell userEmail={userEmail}>
        <div className="mx-auto max-w-2xl">
          <Card className="p-5">
            <h1 className="text-[22px] font-bold text-[var(--foreground)]">{tx.say("nf_title")}</h1>
            <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{tx.say("nf_body")}</p>
            <Link className="primary-action pressable mt-4 inline-flex" href="/fleet">
              {tx.say("nf_back")}
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  detail.country = String((organization as any).country_code || (organization as any).settings?.main_location?.country || "");
  detail.currency = organization.currency || "THB";
  const { vehicle } = detail;
  const status = String(vehicle.status || "").toLowerCase();
  const statusTone = status === "rented" ? "blue" : status === "available" ? "green" : status === "reserved" || status === "maintenance" ? "amber" : "neutral";
  // Bookings still to come (or under way) on an archived vehicle.
  const todayIso = businessToday();
  const archivedBookings =
    status === "inactive"
      ? (detail.rentals || []).filter(
          (rental: any) => ["booked", "active", "due_soon", "overdue", "extended"].includes(String(rental.status || "")) && !rental.deleted_at && (!rental.end_date || String(rental.end_date).slice(0, 10) >= todayIso)
        )
      : [];
  // Only what has fallen due, the same figure the booking page shows.
  const dueNow = detail.activeRental ? (await amountDueNowByRental(await createSupabaseServerClient(), [detail.activeRental.id])).get(detail.activeRental.id) || 0 : 0;
  const rateLine = (
    [
      ["r_day", Number(vehicle.daily_rate || 0)],
      ["r_week", Number(vehicle.weekly_rate || 0)],
      ["r_month", Number(vehicle.monthly_rate || 0)]
    ] as Array<[string, number]>
  )
    .filter(([, value]) => value > 0)
    .map(([key, value]) => tx.say(key, { amount: money(value) }))
    .join(" · ");
  // The facts beside the photo on desktop: only the ones filled in.
  const specs = ((vehicle as any).specifications || {}) as Record<string, any>;
  const compliance = ((vehicle as any).metadata?.compliance || {}) as Record<string, any>;
  const gearbox = String(specs.transmission || "").trim();
  const nextService = [
    compliance.next_service_date ? longDate(String(compliance.next_service_date).slice(0, 10), tx.locale) : "",
    Number(compliance.next_service_mileage) > 0 ? tx.say(distanceKey("km"), { km: Number(compliance.next_service_mileage).toLocaleString("en-US") }) : ""
  ]
    .filter(Boolean)
    .join(" · ");
  const headerFacts = (
    [
      [tx.say("hf_mileage"), Number(vehicle.mileage) > 0 ? tx.say(distanceKey("km"), { km: Number(vehicle.mileage).toLocaleString("en-US") }) : ""],
      [tx.say("hf_nextService"), nextService],
      [tx.say("hf_deposit"), Number((vehicle as any).deposit_amount) > 0 ? money((vehicle as any).deposit_amount) : ""],
      [tx.say("hf_gearbox"), /^(at|auto)/i.test(gearbox) ? tx.say("hf_auto") : /^(mt|man)/i.test(gearbox) ? tx.say("hf_manual") : gearbox],
      [tx.say("hf_fuel"), String(specs.fuel_type || "")],
      [tx.say("hf_colour"), String(vehicle.color || "")],
      [tx.say("hf_body"), String(specs.body_type || specs.body_class || "")],
      [tx.say("hf_seats"), Number(specs.seating_capacity || specs.seats) > 0 ? String(specs.seating_capacity || specs.seats) : ""],
      [tx.say("hf_engine"), Number(specs.engine_cc) > 0 ? `${Number(specs.engine_cc).toLocaleString("en-US")} cc` : ""],
      // What it cost and what it's worth: the owner's figures, never shown to staff.
      [tx.say("hf_bought"), isOwner && Number(vehicle.purchase_price) > 0 ? [money(vehicle.purchase_price), vehicle.purchase_date ? dateFormat(tx.locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${String(vehicle.purchase_date).slice(0, 10)}T00:00:00Z`)) : ""].filter(Boolean).join(" · ") : ""],
      [tx.say("hf_worth"), isOwner && Number((vehicle as any).estimated_value) > 0 ? money((vehicle as any).estimated_value) : ""]
    ] as Array<[string, string]>
  ).filter(([, value]) => value);

  // The tab that opens first is the one that needs a look: paperwork about to run out, then open jobs, then the money.
  const soonestDays = daysUntil(getSoonestCompliance(detail, tx)?.date);
  const paperUrgent = soonestDays !== null && soonestDays <= 7;
  const firstTab = paperUrgent ? "upkeep" : detail.vehicleTasks.length > 0 ? "todo" : isOwner ? "money" : "rentals";
  const tabs: PageTab[] = [
    { id: "todo", label: tx.say("tab_todo"), count: detail.vehicleTasks.length, content: <TasksSection detail={detail} organizationId={organization.id} /> },
    { id: "money", label: tx.say("tab_money"), content: <FinancialSection detail={detail} isOwner={isOwner} /> },
    {
      id: "upkeep",
      label: tx.say("tab_upkeep"),
      alert: paperUrgent,
      content: (
        <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
          <ComplianceSection detail={detail} organizationId={organization.id} />
          <div className="grid gap-3">
            <MaintenanceSection currency={organization.currency || "THB"} detail={detail} organizationId={organization.id} />
            <DocumentsSection detail={detail} />
            <FinanceSection detail={detail} />
          </div>
        </div>
      )
    },
    {
      id: "rentals",
      label: tx.say("tab_rentals"),
      content: (
        <>
          <UtilizationSection detail={detail} isOwner={isOwner} />
          <VehicleReviews organizationId={organization.id} vehicleId={vehicle.id} />
        </>
      )
    },
    { id: "checks", label: tx.say("tab_checks"), content: <InspectionsSection detail={detail} /> },
    {
      id: "details",
      label: tx.say("tab_details"),
      content: (
        <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
          <SpecsSection detail={detail} />
          <div className="grid gap-3">
            <RatesPane detail={detail} />
            <GpsSection detail={detail} />
            <Fold title={tx.say("notes")}>
              <VehicleNotesForm notes={vehicle.metadata?.notes || ""} organizationId={organization.id} updatedAt={vehicle.metadata?.notes_updated_at} vehicleId={vehicle.id} />
            </Fold>
          </div>
        </div>
      )
    },
    { id: "history", label: tx.say("tab_history"), content: <TimelineSection detail={detail} /> }
  ];

  return (
    <AppShell userEmail={userEmail}>
      <div className="space-y-3">
        <BackLink className="!mb-0" href="/fleet" label={tx.say("fleet")} />

        <Card>
          <div className="card-section">
            {/* The photo takes about two fifths; the name, plate and actions get the room. */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(340px,1.3fr)] lg:items-stretch">
              <VehiclePhotoManager art={<VehicleArt colour={vehicle.color} kind={kindFromCategory(detail.category)} model={vehicle.model} size="xl" />} organizationId={organization.id} photos={detail.photos} vehicleId={vehicle.id} vehicleLabel={[vehicle.make, vehicle.model].filter(Boolean).join(" ")} />
              <div className="flex min-w-0 flex-col justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {statusTone === "blue" ? (
                      <span className="badge inline-flex items-center bg-[var(--primary-light)] text-[var(--primary)]">{tx.has(`vs_${status}`) ? tx.say(`vs_${status}`) : vehicle.status}</span>
                    ) : (
                      <Badge tone={statusTone}>{tx.has(`vs_${status}`) ? tx.say(`vs_${status}`) : vehicle.status}</Badge>
                    )}
                    {/* Archived: one tap puts it back in the fleet (real-user test, 8 Nov 2026). */}
                    {status === "inactive" ? (
                      <ActionForm action={unarchiveVehicle}>
                        <input name="vehicleId" type="hidden" value={vehicle.id} />
                        <PendingButton className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--primary)] px-3.5 text-sm font-bold text-white" pendingLabel={tx.say("saving")} type="submit">
                          {tx.say("unarchive")}
                        </PendingButton>
                      </ActionForm>
                    ) : null}
                    {/* In the shop: one tap puts it back on the road (Rory, 1 Nov 2026). */}
                    {status === "maintenance" ? (
                      <ActionForm action={setVehicleInShop}>
                        <input name="vehicleId" type="hidden" value={vehicle.id} />
                        <input name="inShop" type="hidden" value="false" />
                        <PendingButton className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--success)] px-3.5 text-sm font-bold text-white" pendingLabel={tx.say("saving")} type="submit">
                          {tx.say("sh_back")}
                        </PendingButton>
                      </ActionForm>
                    ) : null}
                  </div>
                  {/* The one vehicle header: name, year, plate chip. */}
                  <VehicleTitle
                    as="h1"
                    className="gap-x-3"
                    name={vehicleName(vehicle)}
                    nameClassName="max-w-full text-[26px] font-semibold leading-tight tracking-[-0.01em] text-[var(--foreground)]"
                    plate={vehicle.registration_number}
                    plateClassName="!px-2 !py-1 !text-[15px]"
                    province={vehicle.metadata?.registration_province}
                    year={vehicle.year}
                  />
                  {rateLine ? <p className="mt-3 text-[17px] font-semibold tabular-nums text-[var(--foreground)]">{rateLine}</p> : null}
                  {/* Desktop: the photo is tall, so the vehicle's facts fill the space beside it (Rory, 2 Nov 2026: a big empty gap). */}
                  {headerFacts.length ? (
                    <dl className="mt-5 hidden grid-cols-2 gap-x-6 gap-y-3 border-t border-[var(--border)] pt-4 lg:grid xl:grid-cols-3">
                      {headerFacts.map(([label, value]) => (
                        <div className="min-w-0" key={label}>
                          <dt className="text-xs font-semibold text-[var(--muted)]">{label}</dt>
                          <dd className="mt-0.5 truncate font-semibold text-[var(--foreground)]">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
                <QuickActions rentalId={detail.activeRental?.id || null} status={vehicle.status} vehicleId={vehicle.id} />
              </div>
            </div>
          </div>
        </Card>

        {/* No plate: the agreement can't be signed and the vehicle isn't offered online until one is added (final pre-release test, 8 Nov 2026). */}
        {!String(vehicle.registration_number || "").trim() ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3" role="alert">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[var(--foreground)]">{tx.say("noPlateTitle")}</p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--foreground-secondary)]">{tx.say("noPlateBody")}</p>
            </div>
            <Link className="pressable inline-flex min-h-11 items-center rounded-full bg-[var(--primary)] px-4 text-sm font-bold text-white" href={`/fleet/${vehicle.id}/edit` as Route}>
              {tx.say("noPlateAdd")}
            </Link>
          </div>
        ) : null}
        {/* Archived before archiving was blocked for vehicles with bookings: those bookings still need a car. */}
        {status === "inactive" && archivedBookings.length ? (
          <div className="rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3" role="alert">
            <p className="font-bold text-[var(--foreground)]">{tx.say("archivedBookingsTitle", { count: archivedBookings.length })}</p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--foreground-secondary)]">{tx.say("archivedBookingsBody")}</p>
            <ul className="mt-2 space-y-1">
              {archivedBookings.map((rental: any) => (
                <li key={rental.id}>
                  <Link className="text-sm font-bold text-[var(--primary)] underline" href={`/bookings/${rental.id}` as Route}>
                    {[rental.customers?.full_name, `${longDate(String(rental.start_date).slice(0, 10), tx.locale)}${rental.end_date ? ` – ${longDate(String(rental.end_date).slice(0, 10), tx.locale)}` : ""}`].filter(Boolean).join(" · ")}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionForm action={unarchiveVehicle}>
                <input name="vehicleId" type="hidden" value={vehicle.id} />
                <PendingButton className="pressable inline-flex min-h-11 items-center rounded-full bg-[var(--primary)] px-4 text-sm font-bold text-white" pendingLabel={tx.say("saving")} type="submit">
                  {tx.say("unarchive")}
                </PendingButton>
              </ActionForm>
              <Link className="pressable inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 text-sm font-bold text-[var(--foreground)]" href={`/bookings/${archivedBookings[0].id}` as Route}>
                {tx.say("archivedMove")}
              </Link>
            </div>
          </div>
        ) : null}

        <ActiveRentalCard detail={detail} dueNow={dueNow} />
        <Glance detail={detail} isOwner={isOwner} />
        <YearSection detail={detail} />
        <OpenFoldsOnHash hash="log-service" ids={["maintenance", "log-service"]} />
        <PageTabs aliases={{ maintenance: "upkeep", inspections: "checks", "log-service": "upkeep" }} initial={firstTab} label={tx.say("tab_label")} tabs={tabs} />
      </div>
    </AppShell>
  );
}
