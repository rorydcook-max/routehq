"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, Car, Clock, Search, Trash2, UserRound } from "lucide-react";
import { deleteBooking, extendBookingHold } from "@/app/actions/bookings";
import { CancelBookingButton } from "@/app/bookings/[id]/cancel-booking-button";
import { UndoCancellationButton } from "@/app/bookings/[id]/undo-cancellation-button";
import { RentalAdjustmentButton } from "@/components/rental-adjustment-modal";
import { Badge, EmptyState } from "@/components/ui";
import { flagForNationality } from "@/lib/customer-options";

const filters = ["all", "booked", "active", "due_soon", "overdue", "completed", "cancelled"] as const;

function money(value: unknown, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Open";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

/** "27 Sep – 28 Oct 2026"; the year is shown once when both dates share it. */
function formatRange(start: string | null | undefined, end: string | null | undefined) {
  if (!start) return formatDate(end);
  if (!end) return `From ${formatDate(start)} · open-ended`;
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const first = sameYear
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(start))
    : formatDate(start);
  return `${first} – ${formatDate(end)}`;
}

function vehicleTitle(vehicle: any) {
  return [vehicle?.make, vehicle?.model, vehicle?.trim].filter(Boolean).join(" ");
}

function bookingReference(booking: any) {
  return booking?.reference || booking?.display_code || booking?.id?.slice(0, 8) || "Booking";
}

function statusTone(status: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "completed") return "blue";
  if (status === "active" || status === "extended") return "green";
  if (status === "overdue" || status === "cancelled") return "red";
  if (status === "booked" || status === "due_soon") return "amber";
  return "neutral";
}

function isCancelledBooking(booking: any) {
  return String(booking.status || "").toLowerCase() === "cancelled" || String(booking.booking_link?.status || "").toLowerCase() === "cancelled";
}

function statusCardClasses(booking: any) {
  const status = String(booking.status || "").toLowerCase();
  // White cards with a thin coloured edge: status reads at a glance without
  // washing the whole list in colour.
  const base = "border-[var(--border)] bg-white shadow-[var(--shadow-sm)] border-l-[3px]";
  if (isCancelledBooking(booking)) return `${base} border-l-[#d9d6d0] opacity-80`;
  if (status === "completed") return `${base} border-l-[#b9c7e6]`;
  if (status === "active" || status === "extended") return `${base} border-l-[#16a34a]`;
  if (status === "due_soon") return `${base} border-l-[#d4a017]`;
  if (status === "overdue") return `${base} border-l-[var(--danger)]`;
  if (status === "booked") return `${base} border-l-[var(--primary)]`;
  return base;
}

/** Where the customer is with their booking link. Same wording as the booking page; nothing when there's no live link. */
function linkLabel(status?: string | null) {
  if (!status || status === "cancelled") return null;
  if (status === "completed" || status === "contract_signed") return "Customer signed";
  if (status === "viewed") return "Customer opened link";
  if (status === "details_submitted") return "Customer details received";
  if (status === "sent") return "Link sent";
  if (status === "expired") return "Link expired";
  return "Link not opened yet";
}

function isDueSoon(booking: any) {
  if (!booking.end_date || !["active", "booked", "extended", "due_soon"].includes(booking.status)) return false;
  const today = new Date();
  const target = new Date(booking.end_date);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  return days >= 0 && days <= 3;
}

function matchesFilter(booking: any, filter: string) {
  if (filter === "all") return true;
  if (isCancelledBooking(booking)) return filter === "cancelled";
  if (filter === "due_soon") return booking.status === "due_soon" || isDueSoon(booking);
  if (filter === "overdue") return booking.status === "overdue" || (booking.end_date && new Date(booking.end_date) < new Date() && !["completed", "cancelled"].includes(booking.status));
  return booking.status === filter;
}

function canExtend(booking: any) {
  return ["active", "overdue", "due_soon"].includes(String(booking.status || "").toLowerCase());
}

function daysFromToday(iso: string) {
  const today = new Date();
  const target = new Date(iso);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function rentalTimingLabel(booking: any) {
  const status = String(booking.status || "").toLowerCase();
  if (["completed", "cancelled"].includes(status)) return null;
  // Not handed over yet: what matters is when it starts.
  if (status === "booked" && booking.start_date) {
    const days = daysFromToday(booking.start_date);
    if (days > 1) return `Starts in ${plural(days, "day")}`;
    if (days === 1) return "Starts tomorrow";
    if (days === 0) return "Starts today";
    return `Handover overdue by ${plural(-days, "day")}`;
  }
  if (!booking.end_date) return "Open-ended";
  const days = daysFromToday(booking.end_date);
  if (days < 0) return `Return ${plural(-days, "day")} late`;
  if (days === 0) return "Due back today";
  if (days === 1) return "Due back tomorrow";
  return `Due back in ${plural(days, "day")}`;
}

const STATUS_LABELS: Record<string, string> = {
  booked: "Booked",
  active: "On rent",
  due_soon: "Due back soon",
  overdue: "Late return",
  extended: "Extended",
  completed: "Completed",
  cancelled: "Cancelled",
  draft: "Not confirmed"
};

/** Where an unsigned booking stands: still held, or its hold has ended. */
/** The rental still out on this booking's vehicle past its return date, when this booking starts within a week. */
function lateBefore(booking: any, all: any[]) {
  if (String(booking.status) !== "booked" || !booking.start_date) return null;
  const vehicleId = booking.vehicle_id || booking.vehicles?.id;
  if (!vehicleId) return null;
  const today = new Date().toISOString().slice(0, 10);
  const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  if (String(booking.start_date).slice(0, 10) > weekAhead) return null;
  return (
    all.find(
      (other) =>
        other.id !== booking.id &&
        (other.vehicle_id || other.vehicles?.id) === vehicleId &&
        ["active", "due_soon", "overdue", "extended"].includes(String(other.status)) &&
        other.end_date &&
        String(other.end_date).slice(0, 10) < today
    ) || null
  );
}

function holdState(booking: any): { ended: boolean; text: string } | null {
  const link = booking.booking_link;
  if (!link || ["completed", "cancelled"].includes(String(link.status))) return null;
  if (link.hold_released_at && booking.status === "draft") return { ended: true, text: "Hold ended · dates are open to others. The customer's link still works if the vehicle is free." };
  if (booking.status !== "booked" || !link.hold_until) return null;
  const until = new Date(link.hold_until);
  const when = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(until);
  return { ended: false, text: `Held for the customer until ${when}` };
}

function ExtendHoldButton({ rentalId, ended }: { rentalId: string; ended: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="pressable ml-2 rounded-md border border-[var(--border)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)] disabled:opacity-60"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await extendBookingHold(rentalId);
            if (!result.success) setError(result.error || "Couldn't update the hold.");
          });
        }}
        type="button"
      >
        {isPending ? "Saving…" : ended ? "Hold again" : "Extend hold"}
      </button>
      {error ? <span className="ml-2 text-[11px] font-semibold text-[var(--danger)]">{error}</span> : null}
    </>
  );
}

function customerLabel(booking: any) {
  if (!booking.customers) return "Awaiting customer details";
  return `${flagForNationality(booking.customers.nationality)} ${booking.customers.full_name}`;
}

export function BookingsList({ bookings }: { bookings: any[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(bookingId: string) {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteBooking(bookingId);
      if (!result.success) {
        setDeleteError(result.error || "Failed to delete booking.");
        setConfirmDeleteId(null);
      }
    });
  }

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return bookings.filter((booking) => {
      const haystack = [
        booking.reference,
        booking.display_code,
        booking.customers?.full_name,
        booking.customers?.phone,
        booking.vehicles?.registration_number,
        booking.vehicles?.make,
        booking.vehicles?.model
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesFilter(booking, filter) && (!needle || haystack.includes(needle));
    });
  }, [bookings, filter, search]);

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-[var(--border)] bg-white p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <input
              className="input-with-leading-icon h-9 w-full rounded-lg border border-[var(--border)] bg-white pr-3 text-[13px] font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, plate, or booking reference"
              value={search}
            />
          </label>
          <div className="scrollbar-none -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0 xl:justify-end">
            {filters.map((entry) => (
              <button
                className={`pressable min-h-8 min-w-fit rounded-md border px-3 py-1.5 text-[12px] font-semibold ${filter === entry ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[#fbfaf8] text-[var(--foreground-secondary)]"}`}
                key={entry}
                onClick={() => setFilter(entry)}
                type="button"
              >
                {entry === "all" ? "All" : STATUS_LABELS[entry] || entry.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {deleteError ? (
        <p className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm font-semibold text-[#dc2626]">{deleteError}</p>
      ) : null}
      {filtered.length === 0 ? (
        <EmptyState
          title="No bookings found"
          description="Try another filter, or create a booking from the button above."
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((booking) => {
            const timingLabel = rentalTimingLabel(booking);
            const hold = holdState(booking);
            const waitingOn = lateBefore(booking, bookings);
            const photoUrl = booking.vehicles?.primary_photo_url;
            const effectiveStatus = isCancelledBooking(booking) ? "cancelled" : String(booking.status || "");
            return (
            <article className={`rounded-[10px] border p-2 transition hover:border-[var(--primary)] hover:shadow-[0_16px_30px_rgba(15,23,42,0.06)] ${statusCardClasses(booking)}`} key={booking.id}>
              <div className="grid gap-2.5 lg:grid-cols-[104px_minmax(0,1fr)_136px] lg:items-center">
                <Link className={`group relative h-[68px] overflow-hidden ${photoUrl ? "block" : "hidden lg:block"} rounded-lg border border-[var(--border)] bg-[#fbfaf8]`} href={`/bookings/${booking.id}`}>
                  {photoUrl ? (
                    <img
                      alt={`${vehicleTitle(booking.vehicles) || "Vehicle"} booking`}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                      src={photoUrl}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[var(--primary)]">
                      <Car size={28} strokeWidth={1.8} />
                    </div>
                  )}
                </Link>

                <div className="min-w-0 py-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone(effectiveStatus)}>{STATUS_LABELS[effectiveStatus] || effectiveStatus.replace(/_/g, " ")}</Badge>
                    {linkLabel(booking.booking_link?.status) ? (
                    <Badge tone={["completed", "contract_signed"].includes(String(booking.booking_link?.status)) ? "green" : booking.booking_link?.status === "viewed" ? "blue" : "amber"}>
                      {linkLabel(booking.booking_link?.status)}
                    </Badge>
                  ) : null}
                    {!booking.customers ? <Badge tone="amber">Awaiting details</Badge> : null}
                    <span className="font-mono-data ml-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--muted)]">{bookingReference(booking)}</span>
                  </div>

                  <Link className="mt-1 block truncate text-[15px] font-semibold leading-tight text-[var(--foreground)] hover:text-[var(--primary)]" href={`/bookings/${booking.id}`}>
                    {booking.customers ? customerLabel(booking) : <span className="inline-flex items-center gap-1.5 text-[#92400e]"><Clock size={15} /> Awaiting customer details</span>}
                  </Link>

                  <div className="mt-1 grid gap-1 text-[12px] text-[var(--foreground-secondary)] sm:grid-cols-2 xl:grid-cols-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Car size={15} className="shrink-0 text-[var(--primary)]" />
                      <span className="truncate">
                        <strong className="font-semibold text-[var(--foreground-secondary)]">{vehicleTitle(booking.vehicles) || "Vehicle"}</strong>
                        {booking.vehicles?.registration_number ? <span className="font-mono-data ml-2 text-[var(--muted)]">{booking.vehicles.registration_number}</span> : null}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <CalendarDays size={15} className="shrink-0 text-[var(--primary)]" />
                      <span className="truncate">{formatRange(booking.start_date, booking.end_date)}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <UserRound size={15} className="shrink-0 text-[var(--primary)]" />
                      <span className="truncate">{booking.customers?.phone || "No phone"}</span>
                    </span>
                  </div>
                  {timingLabel ? <p className="mt-1 text-[12px] font-medium text-[var(--muted)]">{timingLabel}</p> : null}
                  {waitingOn ? (
                    <p className="mt-1 text-[12px] font-semibold text-[#dc2626]">
                      Vehicle not back yet: {waitingOn.customers?.full_name || "the current customer"} was due to return it {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${String(waitingOn.end_date).slice(0, 10)}T00:00:00Z`))}.{" "}
                      <Link className="underline underline-offset-2" href={`/bookings/${waitingOn.id}`}>
                        Open that rental
                      </Link>
                    </p>
                  ) : null}
                  {hold ? (
                    <p className={`mt-1 text-[12px] font-medium ${hold.ended ? "text-[#b45309]" : "text-[var(--primary)]"}`}>
                      {hold.text}
                      <ExtendHoldButton ended={hold.ended} rentalId={booking.id} />
                    </p>
                  ) : null}
                </div>

                <div className="lg:justify-self-end">
                  <div className="w-full rounded-lg border border-[var(--border)] bg-white/80 px-3 py-1.5 lg:w-[136px]">
                    <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Paid</span>
                      <span className="font-mono-data block text-[16px] font-semibold text-[var(--primary)]">{money(booking.total_paid, booking.currency)}</span>
                    </div>
                    <span className={`font-mono-data mt-0.5 block text-[11px] lg:text-right ${Number(booking.balance_due) > 0 ? "font-semibold text-[#b45309]" : "text-[var(--muted)]"}`}>
                      {Number(booking.balance_due) > 0 ? `Due now ${money(booking.balance_due, booking.currency)}` : "Nothing due now"}
                    </span>
                  </div>
                  <div className="hidden">
                    <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-md bg-[var(--primary)] px-3 py-1.5 text-[12px] font-semibold text-white" href={`/bookings/${booking.id}`}>
                      View
                    </Link>
                    <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground-secondary)]" href={`/bookings/${booking.id}/edit`}>
                      Edit
                    </Link>
                    {canExtend(booking) ? (
                      <RentalAdjustmentButton
                        className="pressable inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground-secondary)]"
                        currentEndDate={booking.end_date}
                        currentRate={Number(booking.rental_rate || 0)}
                        currentStartDate={booking.start_date}
                        customerName={booking.customers?.full_name || "Awaiting customer"}
                        label="Extend"
                        rentalId={booking.id}
                        vehicleLabel={vehicleTitle(booking.vehicles)}
                      />
                    ) : null}
                    {String(booking.status || "").toLowerCase() === "cancelled" || booking.booking_link?.status === "cancelled" ? (
                      <UndoCancellationButton
                        rentalId={booking.id}
                        organizationId={booking.organization_id}
                        vehicleId={String(booking.vehicle_id || booking.vehicles?.id || "")}
                        customerName={booking.customers?.full_name || null}
                        compact
                      />
                    ) : !["completed", "cancelled"].includes(String(booking.status || "").toLowerCase()) ? (
                      <CancelBookingButton
                        rentalId={booking.id}
                        organizationId={booking.organization_id}
                        vehicleId={String(booking.vehicle_id || booking.vehicles?.id || "")}
                        totalPaid={Number(booking.total_paid || 0)}
                        depositHeld={Number(booking.deposit_held || 0)}
                        currency={booking.currency || "THB"}
                        rentalRate={Number(booking.rental_rate || 0)}
                        rentalStatus={booking.status}
                        customerName={booking.customers?.full_name || null}
                        compact
                      />
                    ) : null}
                    {confirmDeleteId === booking.id ? (
                      <div className="mt-1 w-full rounded-lg border border-[#fecaca] bg-[#fef2f2] p-2">
                        <p className="mb-2 text-xs font-semibold text-[#dc2626]">
                          Delete this booking permanently? Only bookings entered by mistake can be deleted - once there is a signed agreement, a payment or an inspection, use <strong>Cancel booking</strong> instead so the records are kept.
                        </p>
                        <div className="flex gap-2">
                          <button
                            className="pressable inline-flex min-h-7 items-center rounded-lg bg-[#dc2626] px-3 text-xs font-bold text-white disabled:opacity-60"
                            disabled={isPending}
                            onClick={() => handleDelete(booking.id)}
                            type="button"
                          >
                            {isPending ? "Deleting…" : "Confirm delete"}
                          </button>
                          <button
                            className="pressable inline-flex min-h-7 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-bold text-[var(--foreground-secondary)]"
                            disabled={isPending}
                            onClick={() => setConfirmDeleteId(null)}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="pressable inline-flex min-h-8 items-center justify-center rounded-md border border-[#fecaca] bg-[#fff7f7] px-2 text-[#dc2626]"
                        onClick={() => { setConfirmDeleteId(booking.id); setDeleteError(null); }}
                        title="Delete booking"
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5 border-t border-[rgba(15,23,42,0.08)] pt-2">
                <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-md bg-[var(--primary)] px-3 py-1.5 text-[12px] font-semibold text-white" href={`/bookings/${booking.id}`}>
                  View
                </Link>
                <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground-secondary)]" href={`/bookings/${booking.id}/edit`}>
                  Edit
                </Link>
                {canExtend(booking) ? (
                  <RentalAdjustmentButton
                    className="pressable inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground-secondary)]"
                    currentEndDate={booking.end_date}
                    currentRate={Number(booking.rental_rate || 0)}
                    currentStartDate={booking.start_date}
                    customerName={booking.customers?.full_name || "Awaiting customer"}
                    label="Extend"
                    rentalId={booking.id}
                    vehicleLabel={vehicleTitle(booking.vehicles)}
                  />
                ) : null}
                {isCancelledBooking(booking) ? (
                  <UndoCancellationButton
                    rentalId={booking.id}
                    organizationId={booking.organization_id}
                    vehicleId={String(booking.vehicle_id || booking.vehicles?.id || "")}
                    customerName={booking.customers?.full_name || null}
                    compact
                    label="Undo"
                  />
                ) : !["completed", "cancelled"].includes(String(booking.status || "").toLowerCase()) ? (
                  <CancelBookingButton
                    rentalId={booking.id}
                    organizationId={booking.organization_id}
                    vehicleId={String(booking.vehicle_id || booking.vehicles?.id || "")}
                    totalPaid={Number(booking.total_paid || 0)}
                    depositHeld={Number(booking.deposit_held || 0)}
                    currency={booking.currency || "THB"}
                    rentalRate={Number(booking.rental_rate || 0)}
                    rentalStatus={booking.status}
                    customerName={booking.customers?.full_name || null}
                    compact
                    label="Cancel"
                  />
                ) : null}
                {confirmDeleteId === booking.id ? null : (
                  <button
                    className="pressable inline-flex min-h-8 items-center justify-center rounded-md border border-[#fecaca] bg-[#fff7f7] px-2 text-[#dc2626]"
                    onClick={() => { setConfirmDeleteId(booking.id); setDeleteError(null); }}
                    title="Delete booking"
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {confirmDeleteId === booking.id ? (
                <div className="mt-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-2">
                  <p className="mb-2 text-xs font-semibold text-[#dc2626]">
                    Delete this booking permanently? Only bookings entered by mistake can be deleted - once there is a signed agreement, a payment or an inspection, use <strong>Cancel booking</strong> instead so the records are kept.
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="pressable inline-flex min-h-7 items-center rounded-lg bg-[#dc2626] px-3 text-xs font-bold text-white disabled:opacity-60"
                      disabled={isPending}
                      onClick={() => handleDelete(booking.id)}
                      type="button"
                    >
                      {isPending ? "Deleting..." : "Confirm delete"}
                    </button>
                    <button
                      className="pressable inline-flex min-h-7 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-bold text-[var(--foreground-secondary)]"
                      disabled={isPending}
                      onClick={() => setConfirmDeleteId(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
