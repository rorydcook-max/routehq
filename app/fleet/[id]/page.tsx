import Link from "next/link";
import type { Route } from "next";
import {
  ChevronDown,
  AlertTriangle,
  Archive,
  Banknote,
  CalendarDays,
  Camera,
  Car,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Fuel,
  Gauge,
  MapPin,
  PenLine,
  Plus,
  ReceiptText,
  Settings,
  ShieldCheck,
  Smartphone,
  Upload,
  Wrench
} from "lucide-react";
import { completeTask, createVehicleTask } from "@/app/actions/tasks";
import { logVehicleMaintenance, renewVehicleCompliance } from "@/app/actions/vehicles";
import { VehicleNotesForm } from "@/app/fleet/[id]/vehicle-notes-form";
import { VehiclePhotoManager } from "@/app/fleet/[id]/vehicle-photo-manager";
import { VehicleTimeline, type VehicleTimelineEvent } from "@/app/fleet/[id]/vehicle-timeline";
import { AppShell } from "@/components/app-shell";
import { RentalAdjustmentButton } from "@/components/rental-adjustment-modal";
import { InspectionViewer } from "@/components/inspection-viewer";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, ProgressBar, SectionHeader } from "@/components/ui";
import { amountDueNowByRental } from "@/lib/rental-balances";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { TASK_TYPE_OPTIONS } from "@/lib/tasks";
import { isRevenueTransaction } from "@/lib/transaction-options";
import { getVehicleDetail, type VehicleDetail } from "@/lib/vehicle-detail";
import { isQuietActivityEvent } from "@/lib/activity-noise";
import { businessToday } from "@/lib/business-time";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

const statusClasses: Record<string, string> = {
  available: "bg-[var(--success-light)] text-[var(--success)] ring-1 ring-[#bbf7d0]",
  rented: "bg-[var(--primary-blue-light)] text-[var(--primary-blue)] ring-1 ring-[#bfd1ff]",
  maintenance: "bg-[var(--warning-light)] text-[var(--warning)] ring-1 ring-[#fde68a]",
  reserved: "bg-[var(--purple-light)] text-[var(--purple)] ring-1 ring-[#ddd6fe]",
  inactive: "bg-[var(--panel-secondary)] text-[var(--foreground-secondary)] ring-1 ring-[var(--border)]",
  retired: "bg-[var(--panel-secondary)] text-[var(--foreground-secondary)] ring-1 ring-[var(--border)]"
};

const expenseTypes = new Set(["repair", "servicing", "maintenance", "fuel", "insurance", "tax", "finance", "fine", "accessories", "refund"]);

function money(value: unknown) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function percent(value: unknown) {
  return `${Math.round(Number(value || 0))}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function daysUntil(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const today = new Date();
  const target = new Date(value);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function urgency(days: number | null) {
  if (days === null) {
    return { label: "No date", className: "bg-[#fbfaf8] text-[var(--foreground-secondary)]", tone: "neutral" as const };
  }
  if (days < 0) {
    return { label: `${Math.abs(days)}d overdue`, className: "compliance-expired", tone: "red" as const };
  }
  if (days < 7) {
    return { label: `${days}d left`, className: "compliance-expired", tone: "red" as const };
  }
  if (days < 15) {
    return { label: `${days}d left`, className: "compliance-urgent", tone: "amber" as const };
  }
  if (days <= 30) {
    return { label: `${days}d left`, className: "compliance-soon", tone: "amber" as const };
  }
  return { label: `${days}d left`, className: "compliance-ok", tone: "green" as const };
}

function taskDueState(value: string | null | undefined) {
  const days = daysUntil(value);
  if (days === null) {
    return { label: "No due date", className: "text-[var(--muted)]" };
  }
  if (days < 0) {
    return { label: `Overdue ${formatDate(value)}`, className: "text-[var(--danger)]" };
  }
  if (days <= 3) {
    return { label: `Due ${formatDate(value)}`, className: "text-[var(--warning)]" };
  }
  return { label: `Due ${formatDate(value)}`, className: "text-[var(--muted)]" };
}

function rentalDaysRemaining(rental: any) {
  const days = daysUntil(rental?.end_date);
  if (days === null) {
    return "Open-ended";
  }
  return days < 0 ? `${Math.abs(days)} days overdue` : `${days} days remaining`;
}

function detailUrl(path: string, vehicleId: string) {
  return `${path}?vehicleId=${vehicleId}` as Route;
}

function getComplianceItems(detail: VehicleDetail) {
  const { vehicle, complianceEvents } = detail;
  const compliance = vehicle.metadata?.compliance || {};
  const finance = vehicle.metadata?.finance || {};
  const lastCost = (type: string, field: string) =>
    compliance[`${field}_last_cost`] ||
    finance[`${field}_last_cost`] ||
    complianceEvents.find((event) => event.compliance_type === type)?.cost ||
    null;

  const items = [
    {
      key: "tax",
      name: "Vehicle Tax ต่อภาษี",
      date: compliance.tax_expiry_date,
      cost: lastCost("tax", "tax_expiry_date"),
      icon: ShieldCheck
    },
    {
      key: "porbor",
      name: "Compulsory Insurance พรบ",
      date: compliance.porbor_expiry_date,
      cost: lastCost("porbor", "porbor_expiry_date"),
      icon: ShieldCheck
    },
    {
      key: "insurance",
      name: "Voluntary Insurance",
      date: compliance.insurance_expiry_date,
      cost: lastCost("insurance", "insurance_expiry_date"),
      icon: ShieldCheck
    },
    {
      key: "service",
      name: "Next Service Due",
      date: compliance.next_service_date,
      cost: lastCost("service", "next_service_date"),
      icon: Wrench
    },
    {
      key: "oil",
      name: "Oil Change Due",
      date: compliance.oil_change_due_date,
      cost: lastCost("oil", "oil_change_due_date"),
      icon: Fuel
    }
  ];

  if (finance.lender || finance.monthly_payment || finance.outstanding_balance || finance.end_date) {
    items.push({
      key: "finance",
      name: "Finance End Date",
      date: finance.end_date,
      cost: finance.monthly_payment || lastCost("finance", "end_date"),
      icon: Banknote
    });
  }

  return items;
}

function getSoonestCompliance(detail: VehicleDetail) {
  return getComplianceItems(detail)
    .filter((item) => item.date)
    .sort((left, right) => Number(daysUntil(left.date) ?? 9999) - Number(daysUntil(right.date) ?? 9999))[0];
}

function Section({
  id,
  title,
  summary,
  children,
  defaultOpen = false
}: {
  id?: string;
  title: string;
  /** Kept so existing callers compile; the heading alone is shown. */
  eyebrow?: string;
  summary?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group scroll-mt-4 overflow-hidden rounded-[10px] border-[0.5px] border-[var(--border)] bg-[var(--panel)]" id={id} open={defaultOpen}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</span>
          {summary ? <span className="mt-0.5 block truncate text-sm text-[var(--muted)]">{summary}</span> : null}
        </span>
        <ChevronDown className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" size={18} />
      </summary>
      <div className="border-t-[0.5px] border-[var(--border)] px-3.5 pb-3.5 pt-3">{children}</div>
    </details>
  );
}

function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-strong)] bg-white/75 p-3 text-sm text-[var(--muted)]">
      {children}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function Gallery({ detail }: { detail: VehicleDetail }) {
  const { photos, vehicle } = detail;

  return (
    <div className="flex snap-x gap-3 overflow-x-auto pb-1">
      {photos.length > 0 ? (
        photos.slice(0, 8).map((photo) => (
          <a className="block min-w-[82%] snap-center overflow-hidden rounded-lg border border-[var(--border)] bg-white sm:min-w-[360px]" href={photo.url || "#"} key={photo.id} target="_blank">
            {photo.url ? <img alt={photo.fileName} className="h-56 w-full object-cover" src={photo.url} /> : null}
          </a>
        ))
      ) : (
        <div className="flex h-56 min-w-full snap-center items-center justify-center rounded-lg border border-[var(--border)] bg-gradient-to-br from-[var(--primary-light)] to-white text-center">
          <div>
            <Car className="mx-auto text-[var(--primary)]" size={46} />
            <p className="mt-3 text-sm font-bold text-[var(--foreground)]">
              {vehicle.make} {vehicle.model}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">No vehicle photos uploaded yet</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Plate({ registration, province }: { registration: string; province?: string }) {
  return (
    <div className="thai-plate min-w-48">
      <span className="thai-plate-number font-mono-data">{registration}</span>
      <span className="thai-plate-province">{province || "Thailand"}</span>
    </div>
  );
}

function QuickActions({ vehicleId, status, rentalId }: { vehicleId: string; status: string; rentalId?: string | null }) {
  // The main button follows what the vehicle is doing: out with a customer, the next thing wanted is that booking.
  const primary = rentalId
    ? { href: `/bookings/${rentalId}`, label: "Open the booking", icon: CalendarDays }
    : status === "available"
      ? { href: detailUrl("/bookings/new", vehicleId), label: "New booking", icon: CalendarDays }
      : { href: detailUrl("/transactions/new", vehicleId), label: "Record money", icon: ReceiptText };
  // The most likely next step comes first and stands out; the rest follow.
  const actions = [
    primary,
    ...[
      { href: detailUrl("/transactions/new", vehicleId), label: "Record money", icon: ReceiptText },
      { href: detailUrl("/bookings/new", vehicleId), label: "New booking", icon: CalendarDays },
      { href: "#maintenance", label: "Log maintenance", icon: Wrench },
      { href: `/inspections/condition/${vehicleId}`, label: "Condition report", icon: ClipboardCheck },
      { href: `/fleet/${vehicleId}/edit`, label: "Edit", icon: PenLine }
    ].filter((action) => action.label !== primary.label)
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-2 py-1 sm:flex sm:flex-wrap">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Link className={`pressable inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${index === 0 ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]" : "border border-[var(--border)] bg-white text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]"}`} href={action.href as Route} key={action.label}>
              <Icon size={17} />
              {action.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}

function AtAGlance({ detail }: { detail: VehicleDetail }) {
  const soonest = getSoonestCompliance(detail);
  const soonestDays = daysUntil(soonest?.date);
  const soonestUrgency = urgency(soonestDays);
  const latestInspection = detail.inspections[0];
  const gps = detail.gpsDevice;
  const activeRental = detail.activeRental;

  const tiles = [
    {
      label: "Paperwork due next",
      value: soonest ? soonest.name : "No dates set",
      sub: soonest ? soonestUrgency.label : "Add renewal dates",
      className: soonestUrgency.className,
      icon: ShieldCheck
    },
    {
      label: "Mileage",
      value: `${Number(detail.vehicle.mileage || 0).toLocaleString()} km`,
      sub: latestInspection?.inspected_at ? `Recorded ${formatDate(latestInspection.inspected_at)}` : "As entered on the vehicle",
      className: "bg-[var(--primary-light)] text-[var(--primary)]",
      icon: Gauge
    },
    ...(gps
      ? [
          {
            label: "GPS status",
            value: gps.last_seen_at ? "Online" : "Offline",
            sub: gps.last_seen_at ? `Last seen ${formatDate(gps.last_seen_at)}` : "Not seen yet",
            className: gps.last_seen_at ? "bg-[#dcfce7] text-[#166534]" : "bg-[#ffe4e6] text-[#be123c]",
            icon: Smartphone
          }
        ]
      : []),
    {
      label: activeRental ? "On rent to" : "Right now",
      value: activeRental?.customers?.full_name || "Free",
      sub: activeRental?.end_date ? `Due back ${formatDate(activeRental.end_date)}` : activeRental ? "No end date" : "Nobody is renting it",
      className: activeRental ? "bg-[#dbeafe] text-[#1d4ed8]" : "bg-[#dcfce7] text-[#166534]",
      icon: CalendarDays
    }
  ];

  const rateCard: Array<[string, number]> = [
    ["day", Number(detail.vehicle.daily_rate || 0)],
    ["week", Number(detail.vehicle.weekly_rate || 0)],
    ["month", Number(detail.vehicle.monthly_rate || 0)]
  ];
  const ratesSet = rateCard.filter(([, value]) => value > 0).length;

  return (
    <div className="space-y-3">
    <div className={`grid grid-cols-2 gap-3 ${tiles.length === 3 ? "lg:grid-cols-3 max-lg:[&>*:last-child]:col-span-2" : "lg:grid-cols-4"}`}>
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div className="soft-panel p-3" key={tile.label}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-[var(--muted)]">{tile.label}</p>
                <p className={`mt-1 text-base font-semibold text-[var(--foreground)] ${tile.label === "Mileage" ? "font-mono-data" : ""}`}>{tile.value}</p>
                <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tile.className}`}>{tile.sub}</span>
              </div>
              <Icon className="text-[var(--primary)]" size={20} />
            </div>
          </div>
        );
      })}
    </div>
    <div className="soft-panel flex flex-wrap items-center gap-x-6 gap-y-2 p-3">
      <p className="text-xs font-bold uppercase text-[var(--muted)]">Rental rates</p>
      {rateCard.map(([period, value]) => (
        <p className="text-sm text-[var(--foreground-secondary)]" key={period}>
          <span className={`font-mono-data text-base font-semibold ${value > 0 ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{value > 0 ? money(value) : "Not set"}</span> / {period}
        </p>
      ))}
      <p className="text-sm text-[var(--foreground-secondary)]">
        Deposit{" "}
        <span className="font-mono-data text-base font-semibold text-[var(--foreground)]">
          {(detail.vehicle as any).deposit_amount === null || (detail.vehicle as any).deposit_amount === undefined ? "your usual" : money(Number((detail.vehicle as any).deposit_amount))}
        </span>
      </p>
      <Link className="ml-auto text-sm font-semibold text-[var(--primary)] hover:underline" href={`/fleet/${detail.vehicle.id}/edit` as Route}>
        {ratesSet === 3 ? "Edit rates" : ratesSet === 0 ? "Add rates" : "Add the missing rates"}
      </Link>
      {ratesSet < 3 ? (
        <p className="basis-full text-xs text-[var(--muted)]">
          Daily, weekly and monthly rates are used to price bookings and short extensions. A missing rate is worked out from the nearest one you have set.
        </p>
      ) : null}
    </div>
    </div>
  );
}

function ActiveRentalCard({ detail, dueNow }: { detail: VehicleDetail; dueNow: number }) {
  const rental = detail.activeRental;

  if (!rental || !["rented", "reserved"].includes(detail.vehicle.status)) {
    return null;
  }

  const customer = rental.customers || {};
  const overdue = (daysUntil(rental.end_date) || 0) < 0;
  const inspectionAction =
    rental.status === "booked"
      ? { href: `/inspections/delivery/${rental.id}`, label: "Start handover" }
      : ["active", "due_soon", "overdue", "extended"].includes(rental.status)
        ? { href: `/inspections/return/${rental.id}`, label: "Start return" }
        : null;

  return (
    <Section defaultOpen eyebrow="Active rental" title={rental.status === "booked" ? "Booked by" : "On rent to"}>
      <div className="space-y-3">
        <div className="rounded-lg border border-[#bfd1ff] bg-[var(--primary-blue-light)] p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xl font-semibold text-[var(--foreground)]">{customer.full_name || "Customer not added yet"}</p>
              {customer.nationality ? <p className="text-sm text-[var(--muted)]">{customer.nationality}</p> : null}
              {customer.phone ? (
                <a className="mt-2 inline-flex font-bold text-[var(--primary)]" href={`tel:${customer.phone}`}>
                  {customer.phone}
                </a>
              ) : null}
            </div>
            <Badge tone={overdue ? "red" : "blue"}>{rentalDaysRemaining(rental)}</Badge>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <InfoRow label="Rental period" value={`${formatDate(rental.start_date)} to ${rental.end_date ? formatDate(rental.end_date) : "no end date"}`} />
            <InfoRow label="Price" value={`${money(rental.rental_rate)} ${({ daily: "a day", weekly: "a week", monthly: "a month" } as Record<string, string>)[String(rental.pricing_model)] || "for the rental"}`} />
            <InfoRow label="Deposit held" value={money(rental.deposit_amount)} />
            <InfoRow label="Due now" value={dueNow > 0 ? money(dueNow) : "Nothing"} danger={dueNow > 0} />
          </div>
        </div>
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          <Link className="pressable min-w-fit rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white" href={`/bookings/${rental.id}` as Route}>
            Open booking
          </Link>
          <Link className="pressable min-w-fit rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)]" href={`/bookings/${rental.id}/edit` as Route}>
            Edit
          </Link>
          <Link className="pressable min-w-fit rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)]" href={detailUrl("/transactions/new", detail.vehicle.id)}>
            Record payment
          </Link>
          <RentalAdjustmentButton
            currentEndDate={rental.end_date}
            currentRate={Number(rental.rental_rate || 0)}
            currentStartDate={rental.start_date}
            customerName={customer.full_name || "Unknown customer"}
            label="Extend or end early"
            rentalId={rental.id}
            vehicleLabel={[detail.vehicle.make, detail.vehicle.model, detail.vehicle.trim].filter(Boolean).join(" ")}
            className="pressable inline-flex min-w-fit items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)]"
          />
          {inspectionAction ? (
            <Link className="pressable min-w-fit rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)]" href={inspectionAction.href as Route}>
              {inspectionAction.label}
            </Link>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function InfoRow({ label, value, danger = false }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3">
      <p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p>
      <p className={`font-mono-data mt-1 font-semibold ${danger ? "text-[#be123c]" : "text-[var(--foreground)]"}`}>{value}</p>
    </div>
  );
}

function ComplianceSection({ detail, organizationId }: { detail: VehicleDetail; organizationId: string }) {
  return (
    <Section
      defaultOpen={getComplianceItems(detail).some((item) => item.date && (daysUntil(item.date) ?? 999) <= 30)}
      summary={(() => {
        const items = getComplianceItems(detail);
        const saved = items.filter((item) => item.date).length;
        const soonest = getSoonestCompliance(detail);
        if (!saved) return "No dates saved yet. Add them to be reminded before they run out";
        return `${saved} of ${items.length} dates saved${soonest ? ` · next: ${soonest.name} ${formatDate(soonest.date)}` : ""}`;
      })()}
      title="Tax, insurance and service dates"
    >
      <div className="grid gap-3">
        {getComplianceItems(detail).map((item) => {
          const Icon = item.icon;
          const state = urgency(daysUntil(item.date));
          return (
            <div className="rounded-lg border border-[var(--border)] bg-white p-3" key={item.key}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
                    <Icon size={19} />
                  </span>
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{item.name}</p>
                    {item.date ? <p className="mt-1 text-sm text-[var(--muted)]">Runs out {formatDate(item.date)}{item.cost ? ` · last cost ${money(item.cost)}` : ""}</p> : <p className="mt-1 text-sm text-[var(--muted)]">No date saved yet</p>}
                  </div>
                </div>
                {item.date ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${state.className}`}>{state.label}</span> : null}
              </div>
              <details className="mt-3 rounded-lg bg-[var(--primary-light)] p-3">
                <summary className="cursor-pointer text-sm font-bold text-[var(--primary)]">{item.date ? "Renewed it? Enter the new date" : "Add the date"}</summary>
                <form action={renewVehicleCompliance} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input name="vehicleId" type="hidden" value={detail.vehicle.id} />
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input name="complianceType" type="hidden" value={item.key} />
                  <label className="block">
                    <span className="text-xs font-bold uppercase text-[var(--muted)]">Runs out on</span>
                    <input className={inputClass} name="newExpiryDate" required type="date" />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase text-[var(--muted)]">Cost</span>
                    <input className={inputClass} min="0" name="cost" step="0.01" type="number" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-bold uppercase text-[var(--muted)]">Photo of the document (optional)</span>
                    <input className={inputClass} name="documentFile" type="file" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs font-bold uppercase text-[var(--muted)]">Notes</span>
                    <input className={inputClass} name="notes" />
                  </label>
                  <PendingButton className="inline-flex justify-center rounded-lg bg-[var(--primary)] px-3 py-2.5 text-sm font-bold text-white sm:col-span-2" pendingLabel="Saving..." type="submit">
                    Save
                  </PendingButton>
                </form>
              </details>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function TimelineSection({ detail }: { detail: VehicleDetail }) {
  const complianceEvents = getComplianceItems(detail)
    .filter((item) => item.date)
    .map((item) => ({
      id: `future-${item.key}`,
      title: `${item.name} due`,
      detail: formatDate(item.date),
      date: item.date!,
      kind: "compliance" as const
    }));
  const reminderEvents = detail.reminders.map((reminder) => ({
    id: `reminder-${reminder.id}`,
    title: reminder.title,
    detail: reminder.type,
    date: reminder.due_date,
    kind: "reminder" as const
  }));
  // Bookkeeping steps behind a signed document ("document created", "version
  // created") are noise on a vehicle's history; the signing itself stays.
  const activityEvents = detail.activityEvents.filter((event: any) => !isQuietActivityEvent(event.event_type)).map((event) => ({
    id: event.id,
    title: event.title,
    detail: event.detail,
    date: event.occurred_at || event.created_at,
    kind: "activity" as const
  }));
  const rentalReturns = detail.rentals
    .filter((rental) => rental.end_date)
    .map((rental) => ({
      id: `return-${rental.id}`,
      title: `Scheduled return: ${rental.customers?.full_name || "Customer"}`,
      detail: rental.status,
      date: rental.end_date!,
      kind: "rental" as const
    }));
  const events: VehicleTimelineEvent[] = [...complianceEvents, ...reminderEvents, ...rentalReturns, ...activityEvents]
    .filter((event) => Boolean(event.date))
    .map((event) => ({
      id: String(event.id),
      title: String(event.title),
      detail: event.detail ? String(event.detail) : null,
      date: String(event.date),
      kind: event.kind
    }));
  // Thai calendar dates: the server clock is UTC.
  const todayIso = businessToday();
  const oneYearAgo = `${Number(todayIso.slice(0, 4)) - 1}${todayIso.slice(4)}`;

  return <VehicleTimeline defaultFrom={oneYearAgo} defaultTo={todayIso} events={events} />;
}

function InspectionsSection({ detail }: { detail: VehicleDetail }) {
  const [latest, ...older] = detail.inspections;

  return (
    <Section eyebrow="Inspections" id="inspections" title="Handovers and returns">
      {!latest ? (
        <EmptyState action={<Link className="font-bold text-[var(--primary)]" href={`/inspections/condition/${detail.vehicle.id}` as Route}>Start a condition report</Link>}>
          No handover or return forms yet.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          <InspectionViewer inspection={latest} />
          {older.map((inspection) => (
            <details className="rounded-lg border border-[var(--border)] bg-white p-3" key={inspection.id}>
              <summary className="cursor-pointer font-bold text-[var(--foreground)]">
                {(inspection.type || inspection.inspection_type).toUpperCase()} · {formatDate(inspection.inspected_at)} · {Number(inspection.odometer_reading || inspection.mileage || 0).toLocaleString()} km
              </summary>
              <div className="mt-3">
                <InspectionViewer inspection={inspection} />
              </div>
            </details>
          ))}
        </div>
      )}
    </Section>
  );
}

function InspectionCard({ inspection, expanded = false }: { inspection: any; expanded?: boolean }) {
  const fuel = Number(String(inspection.fuel_level || "").replace(/[^0-9.]/g, "")) || 0;
  const isReturn = inspection.inspection_type === "return";

  return (
    <article className="rounded-lg border border-[var(--border)] bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge tone={isReturn ? "red" : "green"}>{inspection.inspection_type.toUpperCase()}</Badge>
          <p className="mt-2 font-semibold text-[var(--foreground)]">{inspection.customers?.full_name || "Customer not linked"}</p>
          <p className="text-sm text-[var(--muted)]">{formatDate(inspection.inspected_at)}</p>
        </div>
        <Gauge className="text-[var(--primary)]" size={22} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <InfoRow label="Odometer" value={`${Number(inspection.mileage || 0).toLocaleString()} km`} />
        <div className="rounded-lg border border-[var(--border)] bg-white p-3">
          <p className="text-xs font-bold uppercase text-[var(--muted)]">Fuel level</p>
          <p className="mt-1 font-semibold text-[var(--foreground)]">{inspection.fuel_level || "Not recorded"}</p>
          <div className="mt-2">
            <ProgressBar tone={fuel < 25 ? "red" : fuel < 50 ? "amber" : "green"} value={fuel} />
          </div>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <MediaPlaceholder icon={Camera} label={`${inspection.photo_document_ids?.length || 0} photos`} />
          <MediaPlaceholder icon={Smartphone} label={`${inspection.video_document_ids?.length || 0} videos`} />
          <MediaPlaceholder icon={PenLine} label="Signature pending" />
        </div>
      ) : null}
      {inspection.notes ? <p className="mt-3 rounded-lg bg-[#fbfaf8] p-3 text-sm text-[var(--foreground-secondary)]">{inspection.notes}</p> : null}
    </article>
  );
}

function MediaPlaceholder({ icon: Icon, label }: { icon: typeof Camera; label: string }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[#fbfaf8] text-center text-sm font-bold text-[var(--muted)]">
      <div>
        <Icon className="mx-auto text-[var(--primary)]" size={20} />
        <p className="mt-1">{label}</p>
      </div>
    </div>
  );
}

function FinancialSection({ detail }: { detail: VehicleDetail }) {
  const chartMax = Math.max(1, ...detail.financials.monthlyChart.flatMap((month) => [month.revenue, month.expenses]));

  return (
    <Section eyebrow="Financial summary" title="What it earns and costs">
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoRow label="Monthly revenue" value={money(detail.financials.currentMonthRevenue)} />
        <InfoRow label="Total revenue" value={money(detail.financials.lifetimeRevenue)} />
        <InfoRow label="Total expenses" value={money(detail.financials.lifetimeExpenses)} danger={detail.financials.lifetimeExpenses > 0} />
        <InfoRow label="Net profit" value={money(detail.financials.lifetimeProfit)} danger={detail.financials.lifetimeProfit < 0} />
        <InfoRow label="Purchase price" value={money(detail.financials.purchasePrice)} />
        <InfoRow label="Estimated value" value={money(detail.financials.estimatedValue)} />
        <InfoRow label="Depreciation" value={money(detail.financials.depreciation)} />
        <InfoRow label="ROI" value={percent(detail.financials.roi)} danger={detail.financials.roi < 0} />
      </div>
      <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
        <p className="text-sm font-semibold text-[var(--foreground)]">Last 12 months revenue vs expenses</p>
        <div className="mt-3 flex h-44 items-end gap-2 overflow-x-auto">
          {detail.financials.monthlyChart.map((month) => (
            <div className="flex min-w-10 flex-1 flex-col items-center justify-end gap-1" key={month.label}>
              <div className="flex h-32 items-end gap-1">
                <div className="w-3 rounded-t bg-[var(--primary)]" style={{ height: `${Math.max(4, (month.revenue / chartMax) * 128)}px` }} title={`Revenue ${money(month.revenue)}`} />
                <div className="w-3 rounded-t bg-[#be123c]" style={{ height: `${Math.max(4, (month.expenses / chartMax) * 128)}px` }} title={`Expenses ${money(month.expenses)}`} />
              </div>
              <span className="text-[10px] font-bold text-[var(--muted)]">{month.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">Teal = revenue, red = expenses.</p>
      </div>
    </Section>
  );
}

function UtilizationSection({ detail }: { detail: VehicleDetail }) {
  return (
    <Section eyebrow="Utilization" title="How often it is rented">
      <div className="space-y-3">
        <MetricBar label="12-month utilization" value={detail.utilization.twelveMonth} />
        <MetricBar label="Lifecycle utilization" value={detail.utilization.lifecycle} tone="blue" />
        <MetricBar label="Fleet comparison" value={detail.utilization.twelveMonth} compare={detail.utilization.fleetAverage} />
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Days rented this year" value={detail.utilization.daysRentedThisYear} />
          <InfoRow label="Days available this year" value={detail.utilization.daysAvailableThisYear} />
          <InfoRow label="Days in maintenance" value={detail.utilization.daysMaintenanceThisYear} />
          <InfoRow label="Average rate achieved" value={money(detail.utilization.averageDailyRate)} />
          <InfoRow label="Desired daily equivalent" value={money(detail.utilization.desiredDailyRate)} />
        </div>
      </div>
    </Section>
  );
}

function MetricBar({ label, value, compare, tone = "green" }: { label: string; value: number; compare?: number; tone?: "green" | "blue" }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm font-bold text-[var(--foreground-secondary)]">
        <span>{label}</span>
        <span>{percent(value)}</span>
      </div>
      <ProgressBar tone={tone} value={value} />
      {compare !== undefined ? <p className="mt-1 text-xs text-[var(--muted)]">Fleet average: {percent(compare)}</p> : null}
    </div>
  );
}

function MaintenanceSection({ detail, organizationId }: { detail: VehicleDetail; organizationId: string }) {
  const compliance = detail.vehicle.metadata?.compliance || {};

  return (
    <Section eyebrow="Maintenance" id="maintenance" title="Services and repairs">
      <div className="rounded-lg border border-[var(--border)] bg-white p-3">
        <p className="text-sm font-bold text-[var(--foreground)]">Next service: {formatDate(compliance.next_service_date)}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">Estimated km: {compliance.next_service_mileage ? `${Number(compliance.next_service_mileage).toLocaleString()} km` : "Not set"}</p>
      </div>
      <details className="mt-3 rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3">
        <summary className="cursor-pointer font-bold text-[var(--primary)]">Log maintenance</summary>
        <form action={logVehicleMaintenance} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="vehicleId" type="hidden" value={detail.vehicle.id} />
          <input name="organizationId" type="hidden" value={organizationId} />
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--muted)]">Type</span>
            <select className={inputClass} name="eventType" required>
              <option value="service">Service</option>
              <option value="oil_change">Oil change</option>
              <option value="repair">Repair</option>
              <option value="tyres">Tyres</option>
              <option value="battery">Battery</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--muted)]">Date</span>
            <input className={inputClass} name="serviceDate" required type="date" />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--muted)]">Cost</span>
            <input className={inputClass} min="0" name="cost" step="0.01" type="number" />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--muted)]">Odometer</span>
            <input className={inputClass} min="0" name="mileage" type="number" />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--muted)]">Garage / mechanic</span>
            <input className={inputClass} name="supplier" />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--muted)]">Next due date</span>
            <input className={inputClass} name="nextDueDate" type="date" />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--muted)]">Next due km</span>
            <input className={inputClass} min="0" name="nextDueMileage" type="number" />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-[var(--muted)]">Receipt photo</span>
            <input className={inputClass} name="receiptFile" type="file" />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-bold uppercase text-[var(--muted)]">Notes</span>
            <textarea className={inputClass} name="notes" />
          </label>
          <PendingButton className="inline-flex justify-center rounded-lg bg-[var(--primary)] px-3 py-2.5 text-sm font-bold text-white sm:col-span-2" pendingLabel="Logging..." type="submit">
            Save maintenance
          </PendingButton>
        </form>
      </details>
      <div className="mt-3 space-y-2">
        {detail.maintenanceEvents.length === 0 ? (
          <EmptyState>No maintenance events yet.</EmptyState>
        ) : (
          detail.maintenanceEvents.map((event) => (
            <div className="rounded-lg border border-[var(--border)] bg-white p-3" key={event.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{event.event_type}</p>
                  <p className="text-sm text-[var(--muted)]">{formatDate(event.service_date)} · {event.mileage ? `${Number(event.mileage).toLocaleString()} km` : "Mileage not set"}</p>
                  <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{event.supplier || "Garage not recorded"}</p>
                </div>
                <span className="font-mono-data font-semibold text-[#be123c]">{event.cost ? money(event.cost) : ""}</span>
              </div>
              {event.notes ? <p className="mt-2 text-sm text-[var(--muted)]">{event.notes}</p> : null}
            </div>
          ))
        )}
      </div>
    </Section>
  );
}

function TasksSection({ detail, organizationId }: { detail: VehicleDetail; organizationId: string }) {
  const visibleTasks = detail.vehicleTasks.slice(0, 5);
  const extraCount = Math.max(0, detail.vehicleTasks.length - visibleTasks.length);

  return (
    <Section eyebrow="Tasks" title="Jobs to do">
      <div className="mb-3 rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3">
        <details>
          <summary className="inline-flex cursor-pointer rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--primary)]">
            + Add task
          </summary>
          <form action={createVehicleTask} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="vehicleId" type="hidden" value={detail.vehicle.id} />
            <input name="organizationId" type="hidden" value={organizationId} />
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase text-[var(--muted)]">Task title</span>
              <input className={inputClass} name="title" placeholder="Chase payment, inspect tyres, renew tax..." required />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--muted)]">Due date</span>
              <input className={inputClass} name="dueDate" type="date" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase text-[var(--muted)]">Task type</span>
              <select className={inputClass} name="taskType">
                {TASK_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <PendingButton className="inline-flex justify-center rounded-lg bg-[var(--primary)] px-3 py-2.5 text-sm font-bold text-white sm:col-span-2" pendingLabel="Adding..." type="submit">
              Add task
            </PendingButton>
          </form>
        </details>
      </div>

      {visibleTasks.length === 0 ? (
        <EmptyState>No open tasks for this vehicle</EmptyState>
      ) : (
        <div className="space-y-2">
          {visibleTasks.map((task) => {
            const due = taskDueState(task.dueAt);
            return (
              <div className="rounded-lg border border-[var(--border)] bg-white p-3" key={task.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-[var(--foreground)]">{task.title}</p>
                      <Badge tone="neutral">{task.taskType.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className={`mt-1 text-xs font-bold ${due.className}`}>{due.label}</p>
                  </div>
                  <form action={completeTask} className="shrink-0">
                    <input name="organizationId" type="hidden" value={organizationId} />
                    <input name="taskId" type="hidden" value={task.id} />
                    <input name="vehicleId" type="hidden" value={detail.vehicle.id} />
                    <PendingButton className="inline-flex rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]" pendingLabel="Saving..." type="submit">
                      Mark complete
                    </PendingButton>
                  </form>
                </div>
              </div>
            );
          })}
          {extraCount > 0 ? (
            <Link className="inline-flex text-sm font-semibold text-[var(--primary)]" href="/calendar">
              View all {detail.vehicleTasks.length} tasks →
            </Link>
          ) : null}
        </div>
      )}
    </Section>
  );
}

function TransactionsSection({ detail }: { detail: VehicleDetail }) {
  const totalIncome = detail.transactions
    .filter((transaction) =>
      isRevenueTransaction({
        amount: Number(transaction.amount || 0),
        isDeposit: transaction.is_deposit,
        type: transaction.type
      })
    )
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const totalExpense = detail.transactions.filter((transaction) => expenseTypes.has(transaction.type)).reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);

  return (
    <Section eyebrow="Transactions" title="Money in and out">
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {["All", "Income", "Expense", "Date range"].map((item) => (
          <button className="min-w-fit rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)]" key={item} type="button">
            {item}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <InfoRow label="Income" value={money(totalIncome)} />
        <InfoRow label="Expense" value={money(totalExpense)} danger={totalExpense > 0} />
        <InfoRow label="Net" value={money(totalIncome - totalExpense)} danger={totalIncome - totalExpense < 0} />
      </div>
      <div className="mt-3 space-y-2">
        {detail.transactions.length === 0 ? (
          <EmptyState action={<Link className="font-bold text-[var(--primary)]" href={detailUrl("/transactions/new", detail.vehicle.id)}>Add your first transaction</Link>}>
            No transactions yet.
          </EmptyState>
        ) : (
          detail.transactions.map((transaction) => {
            const expense = expenseTypes.has(transaction.type);
            return (
              <details className="rounded-lg border border-[var(--border)] bg-white p-3" key={transaction.id}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span>
                    <span className="font-semibold text-[var(--foreground)]">{transaction.type.replace(/_/g, " ")}</span>
                    <span className="block text-sm text-[var(--muted)]">{formatDate(transaction.transaction_date)} · {transaction.notes || "No description"}</span>
                  </span>
                  <span className={`font-mono-data font-semibold ${expense ? "text-[#be123c]" : "text-[var(--primary)]"}`}>{expense ? "-" : "+"}{money(transaction.amount)}</span>
                </summary>
                <div className="mt-3 text-sm text-[var(--muted)]">
                  <p>Supplier: {transaction.supplier || "Not recorded"}</p>
                  <p>Mileage: {transaction.mileage ? `${Number(transaction.mileage).toLocaleString()} km` : "Not recorded"}</p>
                  <p>Receipt: {transaction.receipt_document_id ? "Attached" : "No receipt"}</p>
                </div>
              </details>
            );
          })
        )}
      </div>
    </Section>
  );
}

function RentalHistorySection({ detail }: { detail: VehicleDetail }) {
  const totalRentalDays = detail.rentals.reduce((sum, rental) => sum + Math.max(1, daysBetween(rental.start_date, rental.end_date || new Date().toISOString())), 0);

  return (
    <Section eyebrow="Rentals" title="Past rentals">
      <div className="grid gap-3 sm:grid-cols-4">
        <InfoRow label="Total rentals" value={detail.rentals.length} />
        <InfoRow label="Rental days" value={totalRentalDays} />
        <InfoRow label="Avg duration" value={detail.rentals.length ? `${Math.round(totalRentalDays / detail.rentals.length)} days` : "0 days"} />
        <InfoRow label="Avg rate" value={money(detail.utilization.averageDailyRate)} />
      </div>
      <div className="mt-3 space-y-2">
        {detail.rentals.length === 0 ? (
          <EmptyState>No rentals recorded for this vehicle yet.</EmptyState>
        ) : (
          detail.rentals.map((rental) => (
            <Link className="block rounded-lg border border-[var(--border)] bg-white p-3 hover:border-[var(--primary)]" href={`/bookings/${rental.id}` as Route} key={rental.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{rental.customers?.full_name || "Unknown customer"}</p>
                  <p className="text-sm text-[var(--muted)]">{rental.customers?.nationality || "Nationality not set"} · {formatDate(rental.start_date)} → {rental.end_date ? formatDate(rental.end_date) : "Ongoing"}</p>
                  <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{rental.km_driven ? `${Number(rental.km_driven).toLocaleString()} km driven` : "Km not calculated"} · Deposit pending</p>
                </div>
                <Badge tone={rental.status === "active" ? "blue" : rental.status === "completed" ? "green" : "amber"}>{rental.status}</Badge>
              </div>
            </Link>
          ))
        )}
      </div>
    </Section>
  );
}

function DocumentsSection({ detail }: { detail: VehicleDetail }) {
  return (
    <Section eyebrow="Documents" title="Files and documents">
      <div className="grid gap-3 sm:grid-cols-2">
        {detail.documents.length === 0 ? (
          <EmptyState action={<span className="font-bold text-[var(--primary)]">Upload support will open from this card.</span>}>No documents uploaded yet.</EmptyState>
        ) : (
          detail.documents.map((document) => (
            <a className="rounded-lg border border-[var(--border)] bg-white p-3 hover:border-[var(--primary)]" href={document.url || "#"} key={document.id} target="_blank">
              <FileText className="text-[var(--primary)]" size={20} />
              <p className="mt-2 font-semibold text-[var(--foreground)]">{document.fileName}</p>
              <p className="text-sm text-[var(--muted)]">{document.category.replace(/_/g, " ")}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Uploaded {formatDate(document.createdAt)}</p>
            </a>
          ))
        )}
      </div>
      <button className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)]" type="button">
        <Upload size={16} />
        Upload Document
      </button>
    </Section>
  );
}

function GpsSection({ detail }: { detail: VehicleDetail }) {
  if (!detail.gpsDevice) return null;

  const offline = !detail.gpsDevice.last_seen_at;

  return (
    <Section eyebrow="GPS & tracking" title="Tracker">
      <div className="rounded-lg border border-[var(--border)] bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-[var(--foreground)]">{detail.gpsDevice.provider}</p>
            <p className="text-sm text-[var(--muted)]">IMEI {detail.gpsDevice.imei || "Not recorded"} · SIM {detail.gpsDevice.phone_number || "Not recorded"}</p>
          </div>
          <Badge tone={offline ? "red" : "green"}>{offline ? "Offline" : "Online"}</Badge>
        </div>
        <div className="mt-3 flex h-36 items-center justify-center rounded-lg bg-[var(--primary-light)] text-center text-sm font-bold text-[var(--primary)]">
          <div>
            <MapPin className="mx-auto" />
            {detail.latestLocation ? (
              <p className="mt-2">{detail.latestLocation.latitude}, {detail.latestLocation.longitude}</p>
            ) : (
              <p className="mt-2">No location ping yet</p>
            )}
          </div>
        </div>
        <p className={`mt-2 text-sm font-semibold ${offline ? "text-[#be123c]" : "text-[var(--muted)]"}`}>Last seen {detail.gpsDevice.last_seen_at ? formatDate(detail.gpsDevice.last_seen_at) : "never"}</p>
        <Link className="mt-3 inline-flex font-bold text-[var(--primary)]" href="#gps">
          View trip history
        </Link>
      </div>
    </Section>
  );
}

function SpecsSection({ detail }: { detail: VehicleDetail }) {
  const specs = detail.vehicle.specifications || {};
  const rows = [
    ["Make", detail.vehicle.make],
    ["Model", detail.vehicle.model],
    ["Trim", detail.vehicle.trim],
    ["Year", detail.vehicle.year],
    ["Colour", detail.vehicle.color],
    ["Body Type", specs.body_class],
    ["Engine CC", specs.engine_cc],
    ["Transmission", specs.transmission],
    ["Fuel Type", specs.fuel_type],
    ["Seating", specs.seating_capacity],
    ["Drivetrain", specs.drivetrain],
    ["VIN", detail.vehicle.vin],
    ["Purchase date", formatDate(detail.vehicle.purchase_date)],
    ["Purchase price", money(detail.vehicle.purchase_price)],
    ["Estimated value", money(detail.vehicle.estimated_value)]
  ];

  return (
    <Section eyebrow="Specifications" title="Vehicle details">
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <Link className="rounded-lg border border-[var(--border)] bg-white p-3 hover:border-[var(--primary)]" href={`/fleet/${detail.vehicle.id}/edit`} key={label}>
            <p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p>
            <p className={`mt-1 font-semibold text-[var(--foreground)] ${["VIN", "Engine CC", "Purchase price", "Estimated value"].includes(String(label)) ? "font-mono-data" : ""}`}>{value || "Not set"}</p>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function FinanceSection({ detail }: { detail: VehicleDetail }) {
  const finance = detail.vehicle.metadata?.finance || {};
  if (!finance.lender && !finance.monthly_payment && !finance.outstanding_balance && !finance.end_date) {
    return null;
  }
  const totalPaid = detail.transactions.filter((transaction) => transaction.type === "finance").reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);

  return (
    <Section eyebrow="Finance" title="Loan details">
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoRow label="Lender" value={finance.lender || "Not recorded"} />
        <InfoRow label="Monthly payment" value={money(finance.monthly_payment)} />
        <InfoRow label="Outstanding balance" value={money(finance.outstanding_balance)} />
        <InfoRow label="Finance end date" value={formatDate(finance.end_date)} />
        <InfoRow label="Total paid to date" value={money(totalPaid)} />
        <InfoRow label="Total remaining" value={money(finance.outstanding_balance)} />
      </div>
    </Section>
  );
}

function daysBetween(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const detail = await getVehicleDetail(id, organization.id);

  if (!detail) {
    return (
      <AppShell userEmail={userEmail}>
        <div className="mx-auto max-w-2xl">
          <Card>
            <SectionHeader eyebrow="Vehicle not found" title="This vehicle could not be opened" />
            <p className="mt-3 text-sm text-[var(--muted)]">It may have been deleted, archived, or belong to another organisation.</p>
            <Link className="mt-3 inline-flex rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white" href="/fleet">
              Back to Fleet
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  const { vehicle } = detail;
  const title = [vehicle.make, vehicle.model, vehicle.trim, vehicle.year].filter(Boolean).join(" ");
  const statusClass = statusClasses[vehicle.status] || statusClasses.inactive;
  // Only what has fallen due, the same figure the booking page shows.
  const dueNow = detail.activeRental ? (await amountDueNowByRental(await createSupabaseServerClient(), [detail.activeRental.id])).get(detail.activeRental.id) || 0 : 0;

  return (
    <AppShell userEmail={userEmail}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--muted)]">
          <Link className="text-[var(--primary)]" href="/fleet">Fleet</Link>
          <span>/</span>
          <span>{title}</span>
        </div>

        <Card>
          <div className="card-section">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.9fr)] lg:items-stretch">
              <VehiclePhotoManager
                organizationId={organization.id}
                photos={detail.photos}
                vehicleId={vehicle.id}
                vehicleLabel={[vehicle.make, vehicle.model].filter(Boolean).join(" ")}
              />
              <div className="flex min-w-0 flex-col justify-between gap-4 rounded-lg bg-[var(--panel-secondary)] p-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{({ rented: "On rent", reserved: "Booked", maintenance: "In the shop", available: "Free", inactive: "Not in use" } as Record<string, string>)[String(vehicle.status).toLowerCase()] || vehicle.status}</span>
                    {detail.category ? <Badge tone="neutral">{detail.category.name}</Badge> : null}
                  </div>
                  <h1 className="max-w-full text-2xl font-semibold leading-tight tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">{title}</h1>
                  <div className="mt-4">
                    <Plate registration={vehicle.registration_number} province={vehicle.metadata?.registration_province} />
                  </div>
                </div>
                <div>
                  <QuickActions rentalId={detail.activeRental?.id || null} status={vehicle.status} vehicleId={vehicle.id} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <AtAGlance detail={detail} />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] lg:items-start">
          <div className="space-y-3">
            <ActiveRentalCard detail={detail} dueNow={dueNow} />
            <ComplianceSection detail={detail} organizationId={organization.id} />
            <InspectionsSection detail={detail} />
          </div>

          <div className="space-y-3">
            <FinancialSection detail={detail} />
            <UtilizationSection detail={detail} />
            <MaintenanceSection detail={detail} organizationId={organization.id} />
            <TasksSection detail={detail} organizationId={organization.id} />
            <TransactionsSection detail={detail} />
            <RentalHistorySection detail={detail} />
            <DocumentsSection detail={detail} />
            <GpsSection detail={detail} />
            <SpecsSection detail={detail} />
            <FinanceSection detail={detail} />
            <Section eyebrow="Notes" title="Notes">
              <VehicleNotesForm organizationId={organization.id} notes={vehicle.metadata?.notes || ""} updatedAt={vehicle.metadata?.notes_updated_at} vehicleId={vehicle.id} />
            </Section>
          </div>
        </div>

        {/* The full history comes last: who has it now and what is due matter more day to day. */}
        <TimelineSection detail={detail} />
      </div>
    </AppShell>
  );
}
