"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, Car, Clock, Search, Trash2, UserRound } from "lucide-react";
import { deleteBooking } from "@/app/actions/bookings";
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
  return new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
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
  if (isCancelledBooking(booking)) return "border-[#fecaca] bg-[#fff7f7]";
  if (status === "completed") return "border-[#bfdbfe] bg-[#eff6ff]";
  if (status === "active" || status === "extended") return "border-[#bbf7d0] bg-[#f0fdf4]";
  if (status === "due_soon") return "border-[#fde68a] bg-[#fffbeb]";
  if (status === "overdue") return "border-[#fecaca] bg-[#fff7f7]";
  if (status === "booked") {
    return booking.customers ? "border-[#fde68a] bg-[#fffbeb]" : "border-[#fed7aa] bg-[#fff7ed]";
  }
  return "border-[var(--border)] bg-white";
}

function linkLabel(status?: string | null) {
  if (!status) return "No link";
  if (status === "completed" || status === "contract_signed") return "Completed";
  if (status === "viewed") return "Viewed";
  if (status === "details_submitted") return "Details submitted";
  if (status === "sent") return "Sent";
  if (status === "cancelled") return "Cancelled";
  if (status === "expired") return "Expired";
  return "Pending";
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

function rentalTimingLabel(booking: any) {
  if (!booking.end_date || ["completed", "cancelled"].includes(String(booking.status || "").toLowerCase())) return null;
  const today = new Date();
  const end = new Date(booking.end_date);
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const days = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  return `${days} days remaining`;
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
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" size={16} />
            <input
              className="input-with-leading-icon h-9 w-full rounded-lg border border-[var(--border)] bg-white pr-3 text-[13px] font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, plate, or booking reference"
              value={search}
            />
          </label>
          <div className="scrollbar-none flex flex-wrap gap-1.5 xl:justify-end">
            {filters.map((entry) => (
              <button
                className={`pressable min-h-8 min-w-fit rounded-md border px-3 py-1.5 text-[12px] font-semibold capitalize ${filter === entry ? "border-[#0e7490] bg-[#0e7490] text-white" : "border-[var(--border)] bg-[#f8fafc] text-[#475569]"}`}
                key={entry}
                onClick={() => setFilter(entry)}
                type="button"
              >
                {entry.replace(/_/g, " ")}
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
            const photoUrl = booking.vehicles?.primary_photo_url;
            const effectiveStatus = isCancelledBooking(booking) ? "cancelled" : String(booking.status || "");
            return (
            <article className={`rounded-[10px] border p-2 transition hover:border-[#0e7490] hover:shadow-[0_16px_30px_rgba(15,23,42,0.06)] ${statusCardClasses(booking)}`} key={booking.id}>
              <div className="grid gap-2.5 lg:grid-cols-[104px_minmax(0,1fr)_136px] lg:items-center">
                <Link className="group relative block h-[68px] overflow-hidden rounded-lg border border-[var(--border)] bg-[#f1f5f9]" href={`/bookings/${booking.id}`}>
                  {photoUrl ? (
                    <img
                      alt={`${vehicleTitle(booking.vehicles) || "Vehicle"} booking`}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
                      src={photoUrl}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#0e7490]">
                      <Car size={28} strokeWidth={1.8} />
                    </div>
                  )}
                </Link>

                <div className="min-w-0 py-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone(effectiveStatus)}>{effectiveStatus.replace(/_/g, " ")}</Badge>
                    <Badge tone={booking.booking_link?.status === "completed" ? "green" : booking.booking_link?.status === "viewed" ? "blue" : "amber"}>{linkLabel(booking.booking_link?.status)}</Badge>
                    {!booking.customers ? <Badge tone="amber">Awaiting details</Badge> : null}
                    <span className="font-mono-data ml-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748b]">{bookingReference(booking)}</span>
                  </div>

                  <Link className="mt-1 block truncate text-[15px] font-semibold leading-tight text-[#0f172a] hover:text-[#0e7490]" href={`/bookings/${booking.id}`}>
                    {booking.customers ? customerLabel(booking) : <span className="inline-flex items-center gap-1.5 text-[#92400e]"><Clock size={15} /> Awaiting customer details</span>}
                  </Link>

                  <div className="mt-1 grid gap-1 text-[12px] text-[#475569] sm:grid-cols-2 xl:grid-cols-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Car size={15} className="shrink-0 text-[#0e7490]" />
                      <span className="truncate">
                        <strong className="font-semibold text-[#334155]">{vehicleTitle(booking.vehicles) || "Vehicle"}</strong>
                        {booking.vehicles?.registration_number ? <span className="font-mono-data ml-2 text-[#64748b]">{booking.vehicles.registration_number}</span> : null}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <CalendarDays size={15} className="shrink-0 text-[#0e7490]" />
                      <span className="truncate">{formatDate(booking.start_date)} to {formatDate(booking.end_date)}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <UserRound size={15} className="shrink-0 text-[#0e7490]" />
                      <span className="truncate">{booking.customers?.phone || "No phone"}</span>
                    </span>
                  </div>
                  {timingLabel ? <p className="mt-1 text-[12px] font-medium text-[#64748b]">{timingLabel}</p> : null}
                </div>

                <div className="lg:justify-self-end">
                  <div className="w-full rounded-lg border border-[var(--border)] bg-white/80 px-3 py-1.5 lg:w-[136px]">
                    <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Paid</span>
                      <span className="font-mono-data block text-[16px] font-semibold text-[#0e7490]">{money(booking.total_paid, booking.currency)}</span>
                    </div>
                    <span className="font-mono-data mt-0.5 block text-[11px] text-[#64748b] lg:text-right">Balance {money(booking.balance_due, booking.currency)}</span>
                  </div>
                  <div className="hidden">
                    <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-md bg-[#0e7490] px-3 py-1.5 text-[12px] font-semibold text-white" href={`/bookings/${booking.id}`}>
                      View
                    </Link>
                    <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569]" href={`/bookings/${booking.id}/edit`}>
                      Edit
                    </Link>
                    {canExtend(booking) ? (
                      <RentalAdjustmentButton
                        className="pressable inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569]"
                        currentEndDate={booking.end_date}
                        currentRate={Number(booking.rental_rate || 0)}
                        currentStartDate={booking.start_date}
                        customerName={booking.customers?.full_name || "Awaiting customer"}
                        label="Period"
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
                <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-md bg-[#0e7490] px-3 py-1.5 text-[12px] font-semibold text-white" href={`/bookings/${booking.id}`}>
                  View
                </Link>
                <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569]" href={`/bookings/${booking.id}/edit`}>
                  Edit
                </Link>
                {canExtend(booking) ? (
                  <RentalAdjustmentButton
                    className="pressable inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569]"
                    currentEndDate={booking.end_date}
                    currentRate={Number(booking.rental_rate || 0)}
                    currentStartDate={booking.start_date}
                    customerName={booking.customers?.full_name || "Awaiting customer"}
                    label="Period"
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
