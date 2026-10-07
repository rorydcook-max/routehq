import Link from "next/link";
import { typedNote } from "@/lib/transaction-notes";
import type { Route } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Banknote, CalendarDays, ClipboardCheck, FileText, Fuel, Gauge, MapPin, PenLine, ReceiptText, ShieldCheck, Smartphone, Wrench } from "lucide-react";
import { completeTask, createVehicleTask } from "@/app/actions/tasks";
import { logVehicleMaintenance, renewVehicleCompliance } from "@/app/actions/vehicles";
import { VehicleNotesForm } from "@/app/fleet/[id]/vehicle-notes-form";
import { VehiclePhotoManager } from "@/app/fleet/[id]/vehicle-photo-manager";
import { VehicleTimeline, type VehicleTimelineEvent } from "@/app/fleet/[id]/vehicle-timeline";
import { AppShell } from "@/components/app-shell";
import { RentalAdjustmentButton } from "@/components/rental-adjustment-modal";
import { InspectionViewer } from "@/components/inspection-viewer";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, Fold, ProgressBar } from "@/components/ui";
import { amountDueNowByRental } from "@/lib/rental-balances";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { TASK_TYPE_OPTIONS } from "@/lib/tasks";
import { isRevenueTransaction } from "@/lib/transaction-options";
import { getVehicleDetail, type VehicleDetail } from "@/lib/vehicle-detail";
import { isQuietActivityEvent } from "@/lib/activity-noise";
import { businessToday, businessNow } from "@/lib/business-time";
import { longDate } from "@/lib/i18n/dates";

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

function money(value: unknown) {
  return `฿${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
}

function percent(value: unknown) {
  return `${Math.round(Number(value || 0))}%`;
}

function formatDate(value: string | null | undefined, tx: Vx) {
  return value ? longDate(String(value).slice(0, 10), tx.locale) : tx.say("notSet");
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

  const items = [
    { key: "tax", name: tx.say("c_tax"), date: compliance.tax_expiry_date, cost: lastCost("tax", "tax_expiry_date"), icon: ShieldCheck },
    { key: "porbor", name: tx.say("c_porbor"), date: compliance.porbor_expiry_date, cost: lastCost("porbor", "porbor_expiry_date"), icon: ShieldCheck },
    { key: "insurance", name: tx.say("c_insurance"), date: compliance.insurance_expiry_date, cost: lastCost("insurance", "insurance_expiry_date"), icon: ShieldCheck },
    { key: "service", name: tx.say("c_service"), date: compliance.next_service_date, cost: lastCost("service", "next_service_date"), icon: Wrench },
    { key: "oil", name: tx.say("c_oil"), date: compliance.oil_change_due_date, cost: lastCost("oil", "oil_change_due_date"), icon: Fuel }
  ];
  if (finance.lender || finance.monthly_payment || finance.outstanding_balance || finance.end_date) {
    items.push({ key: "finance", name: tx.say("c_finance"), date: finance.end_date, cost: finance.monthly_payment || lastCost("finance", "end_date"), icon: Banknote });
  }
  return items;
}

function getSoonestCompliance(detail: VehicleDetail, tx: Vx) {
  return getComplianceItems(detail, tx)
    .filter((item) => item.date)
    .sort((left, right) => Number(daysUntil(left.date) ?? 9999) - Number(daysUntil(right.date) ?? 9999))[0];
}

function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--panel-secondary)] p-4 font-medium text-[var(--foreground-secondary)]">
      {children}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function Plate({ registration, province }: { registration: string; province?: string }) {
  return (
    <div className="thai-plate min-w-48">
      <span className="thai-plate-number font-mono-data">{registration}</span>
      {province ? <span className="thai-plate-province">{province}</span> : null}
    </div>
  );
}

function InfoRow({ label, value, danger = false }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
      <p className="font-semibold text-[var(--muted)]">{label}</p>
      <p className={`mt-0.5 text-[17px] font-bold tabular-nums ${danger ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{value}</p>
    </div>
  );
}

function QuickActions({ vehicleId, status, rentalId }: { vehicleId: string; status: string; rentalId?: string | null }) {
  const tx = useVx();
  // The main button follows what the vehicle is doing: out with a customer, the next thing wanted is that booking.
  const primary = rentalId
    ? { href: `/bookings/${rentalId}`, label: tx.say("a_openBooking"), icon: CalendarDays }
    : status === "available"
      ? { href: detailUrl("/bookings/new", vehicleId), label: tx.say("a_newBooking"), icon: CalendarDays }
      : { href: detailUrl("/transactions/new", vehicleId), label: tx.say("a_recordMoney"), icon: ReceiptText };
  // One main button, the two things done most, and the rest one tap away: six buttons in a block was a wall.
  const recordMoney = { href: detailUrl("/transactions/new", vehicleId), label: tx.say("a_recordMoney"), icon: ReceiptText };
  const edit = { href: `/fleet/${vehicleId}/edit`, label: tx.say("a_edit"), icon: PenLine };
  const shown = [recordMoney, edit].filter((action) => action.label !== primary.label);
  const more = [
    { href: detailUrl("/bookings/new", vehicleId), label: tx.say("a_newBooking"), icon: CalendarDays },
    { href: "#maintenance", label: tx.say("a_logMaintenance"), icon: Wrench },
    { href: `/inspections/condition/${vehicleId}`, label: tx.say("a_condition"), icon: ClipboardCheck }
  ].filter((action) => action.label !== primary.label);
  const PrimaryIcon = primary.icon;

  return (
    <div className="space-y-2">
      {/* Out with a customer: the card just below already opens the booking, so it is not offered twice. */}
      {rentalId ? null : (
        <Link className="pressable primary-action w-full !px-3 text-center leading-tight" href={primary.href as Route}>
          <PrimaryIcon className="shrink-0" size={18} />
          {primary.label}
        </Link>
      )}
      <div className="grid grid-cols-2 gap-2">
        {shown.map((action) => {
          const Icon = action.icon;
          return (
            <Link className="pressable secondary-action !px-3 text-center leading-tight" href={action.href as Route} key={action.label}>
              <Icon className="shrink-0" size={18} />
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
            return (
              <Link className="pressable secondary-action !px-3 text-center leading-tight" href={action.href as Route} key={action.label}>
                <Icon className="shrink-0" size={18} />
                {action.label}
              </Link>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function AtAGlance({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const soonest = getSoonestCompliance(detail, tx);
  const soonestUrgency = urgency(daysUntil(soonest?.date), tx);
  const latestInspection = detail.inspections[0];
  const gps = detail.gpsDevice;
  const activeRental = detail.activeRental;
  const toneText = { red: "text-[var(--danger)]", amber: "text-[var(--warning)]", green: "text-[var(--success)]", neutral: "text-[var(--foreground-secondary)]" };

  // Each tile: a label, the answer in bold, and one line under it. Colour only where something is wrong.
  const tiles = [
    {
      label: tx.say("g_paper"),
      value: soonest ? soonest.name : tx.say("g_noDates"),
      sub: soonest ? soonestUrgency.label : tx.say("g_addDates"),
      subClass: soonest ? toneText[soonestUrgency.tone] : toneText.neutral,
      icon: ShieldCheck
    },
    {
      label: activeRental ? tx.say("g_onRentTo") : tx.say("g_rightNow"),
      value: activeRental?.customers?.full_name || tx.say("g_free"),
      sub: activeRental?.end_date ? tx.say("g_dueBack", { date: formatDate(activeRental.end_date, tx) }) : activeRental ? tx.say("g_noEnd") : tx.say("g_nobody"),
      subClass: toneText.neutral,
      icon: CalendarDays
    },
    {
      label: tx.say("g_mileage"),
      value: tx.say("km", { km: Number(detail.vehicle.mileage || 0).toLocaleString("en-US") }),
      sub: latestInspection?.inspected_at ? tx.say("g_recorded", { date: formatDate(latestInspection.inspected_at, tx) }) : tx.say("g_asEntered"),
      subClass: toneText.neutral,
      icon: Gauge
    },
    ...(gps
      ? [
          {
            label: tx.say("g_gps"),
            value: gps.last_seen_at ? tx.say("g_online") : tx.say("g_offline"),
            sub: gps.last_seen_at ? tx.say("g_lastSeen", { date: formatDate(gps.last_seen_at, tx) }) : tx.say("g_notSeen"),
            subClass: gps.last_seen_at ? toneText.neutral : toneText.red,
            icon: Smartphone
          }
        ]
      : [])
  ];

  // The rental card above already says who has it and until when.
  const rentalCardShown = Boolean(activeRental) && ["rented", "reserved"].includes(detail.vehicle.status);
  const shownTiles = rentalCardShown ? tiles.filter((tile) => tile.icon !== CalendarDays) : tiles;

  const rates: Array<["day" | "week" | "month", number]> = [
    ["day", Number(detail.vehicle.daily_rate || 0)],
    ["week", Number(detail.vehicle.weekly_rate || 0)],
    ["month", Number(detail.vehicle.monthly_rate || 0)]
  ];
  const ratesSet = rates.filter(([, value]) => value > 0).length;
  const deposit = (detail.vehicle as any).deposit_amount;

  return (
    <div className="space-y-3">
      <div className={`grid grid-cols-2 gap-3 ${shownTiles.length === 3 ? "lg:grid-cols-3 max-lg:[&>*:last-child]:col-span-2" : shownTiles.length === 2 ? "" : "lg:grid-cols-4"}`}>
        {shownTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div className="card p-4" key={tile.label}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[var(--muted)]">{tile.label}</p>
                <Icon className="shrink-0 text-[var(--muted)]" size={18} />
              </div>
              <p className="mt-1 text-[18px] font-bold leading-tight text-[var(--foreground)]">{tile.value}</p>
              <p className={`mt-0.5 font-semibold ${tile.subClass}`}>{tile.sub}</p>
            </div>
          );
        })}
      </div>
      <div className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-[var(--muted)]">{tx.say("r_title")}</p>
          <Link className="font-bold text-[var(--primary)]" href={`/fleet/${detail.vehicle.id}/edit` as Route}>
            {ratesSet === 3 ? tx.say("r_edit") : ratesSet === 0 ? tx.say("r_add") : tx.say("r_addMissing")}
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
          {rates.map(([period, value]) => (
            <p className={`text-[17px] font-bold tabular-nums ${value > 0 ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`} key={period}>
              {value > 0 ? tx.say(`r_${period}`, { amount: money(value) }) : tx.say(`r_${period}NotSet`)}
            </p>
          ))}
        </div>
        <p className="mt-1 font-medium text-[var(--foreground-secondary)]">
          {deposit === null || deposit === undefined ? tx.say("r_depositUsual") : tx.say("r_deposit", { amount: money(Number(deposit)) })}
          {ratesSet > 0 && ratesSet < 3 ? ` · ${tx.say("r_hint")}` : ""}
        </p>
      </div>
    </div>
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
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <InfoRow
          label={tx.say("ar_period")}
          value={rental.end_date ? tx.say("ar_range", { from: formatDate(rental.start_date, tx), to: formatDate(rental.end_date, tx) }) : tx.say("ar_rangeOpen", { from: formatDate(rental.start_date, tx) })}
        />
        <InfoRow label={tx.say("ar_price")} value={tx.say(`ar_${priceKey}`, { amount: money(rental.rental_rate) })} />
        <InfoRow label={tx.say("ar_deposit")} value={money(rental.deposit_amount)} />
        <InfoRow danger={dueNow > 0} label={tx.say("ar_dueNow")} value={dueNow > 0 ? money(dueNow) : tx.say("ar_nothing")} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&>*]:min-w-0">
        <Link className="primary-action pressable col-span-2" href={`/bookings/${rental.id}` as Route}>
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
                    {item.date ? `${tx.say(state.tone === "red" && (daysUntil(item.date) ?? 0) < 0 ? "cs_ranOut" : "cs_runsOut", { date: formatDate(item.date, tx) })}${item.cost ? ` · ${tx.say("cs_lastCost", { amount: money(item.cost) })}` : ""}` : tx.say("cs_noDate")}
                  </p>
                </div>
              </div>
              <details className="mt-2.5">
                <summary className="cursor-pointer font-bold text-[var(--primary)]">{item.date ? tx.say("cs_renewed") : tx.say("cs_addDate")}</summary>
                <form action={renewVehicleCompliance} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input name="vehicleId" type="hidden" value={detail.vehicle.id} />
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input name="complianceType" type="hidden" value={item.key} />
                  <label className="block">
                    <span className={labelClass}>{tx.say("f_runsOutOn")}</span>
                    <input className={inputClass} name="newExpiryDate" required type="date" />
                  </label>
                  <label className="block">
                    <span className={labelClass}>{tx.say("f_cost")}</span>
                    <input className={inputClass} inputMode="decimal" min="0" name="cost" step="0.01" type="number" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>{tx.say("f_docPhoto")}</span>
                    <input className="mt-1 w-full" name="documentFile" type="file" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className={labelClass}>{tx.say("f_notes")}</span>
                    <input className={inputClass} name="notes" />
                  </label>
                  <PendingButton className="primary-action sm:col-span-2" pendingLabel={tx.say("saving")} type="submit">
                    {tx.say("save")}
                  </PendingButton>
                </form>
              </details>
            </div>
          );
        })}
      </div>
    </Fold>
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
  const activityEvents = detail.activityEvents
    .filter((event: any) => !isQuietActivityEvent(event.event_type))
    .map((event) => ({ id: event.id, title: event.title, detail: event.detail, date: event.occurred_at || event.created_at, kind: "activity" as const }));
  const rentalReturns = detail.rentals
    .filter((rental) => rental.end_date)
    .map((rental) => ({ id: `return-${rental.id}`, title: tx.say("tl_return", { name: rental.customers?.full_name || tx.say("customer") }), detail: null, date: rental.end_date!, kind: "rental" as const }));
  const events: VehicleTimelineEvent[] = [...complianceEvents, ...reminderEvents, ...rentalReturns, ...activityEvents]
    .filter((event) => Boolean(event.date))
    .map((event) => ({ id: String(event.id), title: String(event.title), detail: event.detail ? String(event.detail) : null, date: String(event.date), kind: event.kind }));
  // Thai calendar dates: the server clock is UTC.
  const todayIso = businessToday();
  const oneYearAgo = `${Number(todayIso.slice(0, 4)) - 1}${todayIso.slice(4)}`;

  return (
    <Fold summary={tx.say("tl_summary", { count: events.filter((event) => event.date.slice(0, 10) <= todayIso).length })} title={tx.say("tl_title")}>
      <VehicleTimeline defaultFrom={oneYearAgo} defaultTo={todayIso} events={events} />
    </Fold>
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
    <Fold id="inspections" title={tx.say("in_title")}>
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
                {kindName(inspection)} · {formatDate(inspection.inspected_at, tx)} · {tx.say("km", { km: Number(inspection.odometer_reading || inspection.mileage || 0).toLocaleString("en-US") })}
              </summary>
              <div className="mt-3">
                <InspectionViewer inspection={inspection} />
              </div>
            </details>
          ))}
        </div>
      )}
    </Fold>
  );
}

function FinancialSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const f = detail.financials;
  const chartMax = Math.max(1, ...f.monthlyChart.flatMap((month) => [month.revenue, month.expenses]));

  return (
    <Fold summary={tx.say("fi_summary", { profit: money(f.lifetimeProfit) })} title={tx.say("fi_title")} tone={f.lifetimeProfit < 0 ? "red" : "neutral"}>
      <div className="grid grid-cols-2 gap-2.5">
        <InfoRow label={tx.say("fi_month")} value={money(f.currentMonthRevenue)} />
        <InfoRow danger={f.lifetimeProfit < 0} label={tx.say("fi_profit")} value={money(f.lifetimeProfit)} />
        <InfoRow label={tx.say("fi_totalIn")} value={money(f.lifetimeRevenue)} />
        <InfoRow label={tx.say("fi_totalOut")} value={money(f.lifetimeExpenses)} />
        {f.purchasePrice > 0 ? <InfoRow label={tx.say("fi_purchase")} value={money(f.purchasePrice)} /> : null}
        {f.estimatedValue > 0 ? <InfoRow label={tx.say("fi_value")} value={money(f.estimatedValue)} /> : null}
        {f.purchasePrice > 0 && f.estimatedValue > 0 ? <InfoRow label={tx.say("fi_depreciation")} value={money(f.depreciation)} /> : null}
        {f.purchasePrice > 0 ? <InfoRow danger={f.roi < 0} label={tx.say("fi_roi")} value={percent(f.roi)} /> : null}
      </div>
      <div className="mt-3 rounded-xl bg-[var(--panel-secondary)] p-3.5">
        <p className="font-bold text-[var(--foreground)]">{tx.say("fi_chart")}</p>
        <div className="mt-3 flex h-40 items-end gap-2 overflow-x-auto">
          {f.monthlyChart.map((month, index) => (
            <div className="flex min-w-8 flex-1 flex-col items-center justify-end gap-1" key={month.label}>
              <div className="flex h-28 items-end gap-1">
                <div className="w-3 rounded-t bg-[var(--primary)]" style={{ height: `${Math.max(3, (month.revenue / chartMax) * 112)}px` }} title={tx.say("fi_in", { amount: money(month.revenue) })} />
                <div className="w-3 rounded-t bg-[var(--danger)]" style={{ height: `${Math.max(3, (month.expenses / chartMax) * 112)}px` }} title={tx.say("fi_out", { amount: money(month.expenses) })} />
              </div>
              <span className="font-medium text-[var(--muted)]" style={{ fontSize: 12 }}>{new Intl.DateTimeFormat(tx.locale === "en" ? "en-GB" : `${tx.locale}-u-ca-gregory-nu-latn`, { month: "short" }).format(new Date(businessNow().getFullYear(), businessNow().getMonth() - (f.monthlyChart.length - 1 - index), 1))}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{tx.say("fi_legend")}</p>
      </div>
      {/* Every payment in and out for this vehicle sits under its totals: one subject, one row on the page. */}
      <TransactionsSection detail={detail} />
    </Fold>
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

function UtilizationSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const u = detail.utilization;
  return (
    <Fold summary={tx.say("u_summary", { percent: percent(u.twelveMonth) })} title={tx.say("u_title")}>
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
    </Fold>
  );
}

function MaintenanceSection({ detail, organizationId }: { detail: VehicleDetail; organizationId: string }) {
  const tx = useVx();
  const compliance = detail.vehicle.metadata?.compliance || {};
  const typeName = (type: string) => (tx.has(`mt_${type}`) ? tx.say(`mt_${type}`) : type.replace(/_/g, " "));

  return (
    <Fold
      id="maintenance"
      summary={compliance.next_service_date ? tx.say("m_summaryNext", { date: formatDate(compliance.next_service_date, tx) }) : tx.say("m_summaryNone")}
      title={tx.say("m_title")}
    >
      {compliance.next_service_date || compliance.next_service_mileage ? (
        <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
          <p className="font-bold text-[var(--foreground)]">{tx.say("m_next", { date: formatDate(compliance.next_service_date, tx) })}</p>
          {compliance.next_service_mileage ? <p className="font-medium text-[var(--foreground-secondary)]">{tx.say("m_atKm", { km: Number(compliance.next_service_mileage).toLocaleString("en-US") })}</p> : null}
        </div>
      ) : null}
      <details className="mt-3">
        <summary className="secondary-action pressable inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <Wrench size={17} />
          {tx.say("m_log")}
        </summary>
        <form action={logVehicleMaintenance} className="mt-3 grid gap-3 sm:grid-cols-2">
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
            <input className={inputClass} inputMode="decimal" min="0" name="cost" step="0.01" type="number" />
          </label>
          <label className="block">
            <span className={labelClass}>{tx.say("m_odometer")}</span>
            <input className={inputClass} inputMode="numeric" min="0" name="mileage" type="number" />
          </label>
          <label className="block sm:col-span-2">
            <span className={labelClass}>{tx.say("m_garage")}</span>
            <input className={inputClass} name="supplier" />
          </label>
          <label className="block">
            <span className={labelClass}>{tx.say("m_nextDate")}</span>
            <input className={inputClass} name="nextDueDate" type="date" />
          </label>
          <label className="block">
            <span className={labelClass}>{tx.say("m_nextKm")}</span>
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
        </form>
      </details>
      <div className="mt-3 space-y-2">
        {detail.maintenanceEvents.length === 0 ? (
          <EmptyState>{tx.say("m_none")}</EmptyState>
        ) : (
          detail.maintenanceEvents.map((event) => (
            <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5" key={event.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[16px] font-bold text-[var(--foreground)]">{typeName(String(event.event_type || ""))}</p>
                  <p className="font-medium text-[var(--foreground-secondary)]">
                    {[formatDate(event.service_date, tx), event.mileage ? tx.say("km", { km: Number(event.mileage).toLocaleString("en-US") }) : null, event.supplier || null].filter(Boolean).join(" · ")}
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
    <Fold open={detail.vehicleTasks.length > 0} summary={tx.say("t_summary", { count: detail.vehicleTasks.length })} title={tx.say("t_title")}>
      {visibleTasks.length === 0 ? (
        <EmptyState>{tx.say("t_none")}</EmptyState>
      ) : (
        <div className="space-y-2">
          {visibleTasks.map((task) => {
            const days = daysUntil(task.dueAt);
            return (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5" key={task.id}>
                <div className="min-w-0">
                  <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{task.title}</p>
                  <p className={`font-semibold ${days !== null && days < 0 ? "text-[var(--danger)]" : "text-[var(--foreground-secondary)]"}`}>
                    {days === null ? tx.say("t_noDue") : days < 0 ? tx.say("t_overdue", { date: formatDate(task.dueAt, tx) }) : tx.say("t_dueOn", { date: formatDate(task.dueAt, tx) })}
                  </p>
                </div>
                <form action={completeTask} className="shrink-0">
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input name="taskId" type="hidden" value={task.id} />
                  <input name="vehicleId" type="hidden" value={detail.vehicle.id} />
                  <PendingButton className="secondary-action" pendingLabel={tx.say("saving")} type="submit">
                    {tx.say("t_done")}
                  </PendingButton>
                </form>
              </div>
            );
          })}
          {extraCount > 0 ? (
            <Link className="inline-flex font-bold text-[var(--primary)]" href="/tasks">
              {tx.say("t_all", { count: detail.vehicleTasks.length })}
            </Link>
          ) : null}
        </div>
      )}
      <details className="mt-3">
        <summary className="secondary-action pressable inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden">{tx.say("t_add")}</summary>
        <form action={createVehicleTask} className="mt-3 grid gap-3 sm:grid-cols-2">
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
        </form>
      </details>
    </Fold>
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
  const totalIncome = detail.transactions
    .filter((transaction) => isRevenueTransaction({ amount: Number(transaction.amount || 0), isDeposit: transaction.is_deposit, type: transaction.type }))
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const totalExpense = detail.transactions.filter((transaction) => expenseTypes.has(transaction.type)).reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);

  return (
    <Part title={tx.say("x_title")}>
      <div className="space-y-2">
        {detail.transactions.length === 0 ? (
          <EmptyState action={<Link className="font-bold text-[var(--primary)]" href={detailUrl("/transactions/new", detail.vehicle.id)}>{tx.say("x_first")}</Link>}>
            {tx.say("x_none")}
          </EmptyState>
        ) : (
          detail.transactions.map((transaction) => {
            const expense = expenseTypes.has(transaction.type);
            // A deposit taken or handed back is not income or a cost: shown plainly, without a plus or minus.
            const held = transaction.type === "deposit_received" || transaction.type === "deposit_refunded";
            // Notes the app wrote for its own records are English sentences; only notes a person typed are shown.
            const note = typedNote(transaction.notes);
            const extra = [
              transaction.supplier ? tx.say("x_paidTo", { name: transaction.supplier }) : null,
              transaction.mileage ? tx.say("x_mileage", { km: Number(transaction.mileage).toLocaleString("en-US") }) : null,
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
          })
        )}
      </div>
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
            {detail.rentals.map((rental) => (
              <Link className="block rounded-xl bg-[var(--panel-secondary)] p-3.5" href={`/bookings/${rental.id}` as Route} key={rental.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[16px] font-bold text-[var(--foreground)]">{rental.customers?.full_name || tx.say("customer")}</p>
                    <p className="font-medium text-[var(--foreground-secondary)]">
                      {rental.end_date ? tx.say("h_range", { from: formatDate(rental.start_date, tx), to: formatDate(rental.end_date, tx) }) : tx.say("h_ongoing", { from: formatDate(rental.start_date, tx) })}
                      {rental.km_driven ? ` · ${tx.say("h_km", { km: Number(rental.km_driven).toLocaleString("en-US") })}` : ""}
                    </p>
                  </div>
                  <Badge tone={["active", "due_soon", "extended"].includes(rental.status) ? "blue" : rental.status === "completed" ? "green" : rental.status === "overdue" || rental.status === "cancelled" ? "red" : "amber"}>{statusName(rental.status)}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </Part>
  );
}

function DocumentsSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  return (
    <Fold summary={tx.say("d_summary", { count: detail.documents.length })} title={tx.say("d_title")}>
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
    <Fold
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
    </Fold>
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
      ["s_body", specs.body_class],
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
    <Fold summary={[detail.vehicle.year, detail.vehicle.color, specs.transmission].filter(Boolean).join(" · ") || undefined} title={tx.say("s_title")}>
      <div className="grid grid-cols-2 gap-2.5">
        {rows.map(([key, value]) => (
          <InfoRow key={key} label={tx.say(key)} value={String(value)} />
        ))}
      </div>
      <Link className="secondary-action pressable mt-3 inline-flex" href={`/fleet/${detail.vehicle.id}/edit` as Route}>
        <PenLine size={17} />
        {tx.say("a_edit")}
      </Link>
    </Fold>
  );
}

function FinanceSection({ detail }: { detail: VehicleDetail }) {
  const tx = useVx();
  const finance = detail.vehicle.metadata?.finance || {};
  if (!finance.lender && !finance.monthly_payment && !finance.outstanding_balance && !finance.end_date) return null;
  const totalPaid = detail.transactions.filter((transaction) => transaction.type === "finance").reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);

  return (
    <Fold summary={finance.outstanding_balance ? `${tx.say("l_balance")} ${money(finance.outstanding_balance)}` : undefined} title={tx.say("l_title")}>
      <div className="grid grid-cols-2 gap-2.5">
        {finance.lender ? <InfoRow label={tx.say("l_lender")} value={finance.lender} /> : null}
        <InfoRow label={tx.say("l_monthly")} value={money(finance.monthly_payment)} />
        <InfoRow label={tx.say("l_balance")} value={money(finance.outstanding_balance)} />
        <InfoRow label={tx.say("l_end")} value={formatDate(finance.end_date, tx)} />
        <InfoRow label={tx.say("l_paid")} value={money(totalPaid)} />
      </div>
    </Fold>
  );
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [userEmail, organization, t, locale] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getTranslations("vehiclePage"), getLocale()]);
  const tx: Vx = { say: t as unknown as Say, has: (key) => t.has(key as never), locale };
  const detail = await getVehicleDetail(id, organization.id);

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

  const { vehicle } = detail;
  const title = [vehicle.make, vehicle.model, vehicle.trim, vehicle.year].filter(Boolean).join(" ");
  const status = String(vehicle.status || "").toLowerCase();
  const statusTone = status === "rented" ? "blue" : status === "available" ? "green" : status === "reserved" || status === "maintenance" ? "amber" : "neutral";
  // Only what has fallen due, the same figure the booking page shows.
  const dueNow = detail.activeRental ? (await amountDueNowByRental(await createSupabaseServerClient(), [detail.activeRental.id])).get(detail.activeRental.id) || 0 : 0;

  return (
    <AppShell userEmail={userEmail}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 font-bold text-[var(--muted)]">
          <Link className="text-[var(--primary)]" href="/fleet">{tx.say("fleet")}</Link>
          <span>/</span>
          <span>{[vehicle.make, vehicle.model].filter(Boolean).join(" ")}</span>
        </div>

        <Card>
          <div className="card-section">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)] lg:items-stretch">
              <VehiclePhotoManager organizationId={organization.id} photos={detail.photos} vehicleId={vehicle.id} vehicleLabel={[vehicle.make, vehicle.model].filter(Boolean).join(" ")} />
              <div className="flex min-w-0 flex-col justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone}>{tx.has(`vs_${status}`) ? tx.say(`vs_${status}`) : vehicle.status}</Badge>
                  </div>
                  <h1 className="max-w-full text-[26px] font-bold leading-tight tracking-[-0.01em] text-[var(--foreground)]">{title}</h1>
                  <div className="mt-3">
                    <Plate province={vehicle.metadata?.registration_province} registration={vehicle.registration_number} />
                  </div>
                </div>
                <QuickActions rentalId={detail.activeRental?.id || null} status={vehicle.status} vehicleId={vehicle.id} />
              </div>
            </div>
          </div>
        </Card>

        <ActiveRentalCard detail={detail} dueNow={dueNow} />
        <AtAGlance detail={detail} />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] lg:items-start">
          <div className="space-y-3">
            <ComplianceSection detail={detail} organizationId={organization.id} />
            <TasksSection detail={detail} organizationId={organization.id} />
            <MaintenanceSection detail={detail} organizationId={organization.id} />
            <InspectionsSection detail={detail} />
          </div>

          <div className="space-y-3">
            <FinancialSection detail={detail} />
              <UtilizationSection detail={detail} />
              <DocumentsSection detail={detail} />
            <GpsSection detail={detail} />
            <SpecsSection detail={detail} />
            <FinanceSection detail={detail} />
            <Fold title={tx.say("notes")}>
              <VehicleNotesForm notes={vehicle.metadata?.notes || ""} organizationId={organization.id} updatedAt={vehicle.metadata?.notes_updated_at} vehicleId={vehicle.id} />
            </Fold>
          </div>
        </div>

        {/* The full history comes last: who has it now and what is due matter more day to day. */}
        <TimelineSection detail={detail} />
      </div>
    </AppShell>
  );
}
