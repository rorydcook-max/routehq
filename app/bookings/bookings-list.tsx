"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CalendarDays, Car, Clock, Search, Trash2, UserRound } from "lucide-react";
import { deleteBooking } from "@/app/actions/bookings";
import { RentalAdjustmentButton } from "@/components/rental-adjustment-modal";
import { Badge } from "@/components/ui";
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
  if (status === "completed") return "green";
  if (status === "active" || status === "due_soon" || status === "extended") return "blue";
  if (status === "overdue" || status === "cancelled") return "red";
  if (status === "booked") return "amber";
  return "neutral";
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
  if (filter === "due_soon") return booking.status === "due_soon" || isDueSoon(booking);
  if (filter === "overdue") return booking.status === "overdue" || (booking.end_date && new Date(booking.end_date) < new Date() && !["completed", "cancelled"].includes(booking.status));
  return booking.status === filter;
}

function canExtend(booking: any) {
  return ["active", "overdue", "due_soon"].includes(String(booking.status || "").toLowerCase());
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
      <div className="content-section">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" size={16} />
            <input
              className="input-with-leading-icon h-9 w-full rounded-lg border border-[var(--border)] bg-white pr-3 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer, plate, or booking reference"
              value={search}
            />
          </label>
          <div className="scrollbar-none flex flex-wrap gap-2 lg:justify-end">
            {filters.map((entry) => (
              <button
                className={`pressable min-h-9 min-w-fit rounded-lg border px-3 py-2 text-xs font-bold capitalize ${filter === entry ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
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
        <div className="empty-state">
          <p className="text-lg font-black text-[#10252b]">No bookings found</p>
          <p className="mt-2 text-sm text-[#667085]">Try another filter, or create a booking from the button above.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((booking) => (
            <article className="sub-surface p-4 transition hover:border-[var(--primary)] hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]" key={booking.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(booking.status)}>{String(booking.status).replace(/_/g, " ")}</Badge>
                    <Badge tone={booking.booking_link?.status === "completed" ? "green" : booking.booking_link?.status === "viewed" ? "blue" : "amber"}>{linkLabel(booking.booking_link?.status)}</Badge>
                    {!booking.customers ? (
                      <Badge tone="amber">Awaiting details</Badge>
                    ) : booking.booking_link?.status === "completed" ? (
                      <Badge tone="green">Details received</Badge>
                    ) : null}
                    <span className="font-mono-data text-xs font-black uppercase text-[#667085]">{bookingReference(booking)}</span>
                  </div>
                  <Link className="mt-3 inline-flex text-xl font-black text-[#10252b] hover:text-[var(--primary)]" href={`/bookings/${booking.id}`}>
                    {booking.customers
                      ? <>{flagForNationality(booking.customers.nationality)} {booking.customers.full_name}</>
                      : <span className="flex items-center gap-1.5 text-[#92400e]"><Clock size={16} /> Awaiting customer details</span>
                    }
                  </Link>
                  <div className="mt-2 grid gap-2 text-sm text-[#667085] sm:grid-cols-2">
                    <span className="flex items-center gap-2">
                      <Car size={16} className="text-[#0f766e]" />
                      <strong className="text-[#344054]">{vehicleTitle(booking.vehicles) || "Vehicle"}</strong> <span className="font-mono-data">{booking.vehicles?.registration_number}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-[#0f766e]" />
                      {formatDate(booking.start_date)} to {formatDate(booking.end_date)}
                    </span>
                    <span className="flex items-center gap-2">
                      <UserRound size={16} className="text-[#0f766e]" />
                      {booking.customers?.phone || "No phone"}
                    </span>
                    <span>
                      Rate <strong className="font-mono-data text-[#10252b]">{money(booking.rental_rate, booking.currency)}</strong> / {booking.pricing_model}, deposit <strong className="font-mono-data text-[#10252b]">{money(booking.deposit_amount, booking.currency)}</strong>
                    </span>
                  </div>
                </div>
                <div className="sub-surface grid min-w-[160px] gap-2 p-3 text-sm">
                  <span className="font-bold text-[#667085]">Paid</span>
                  <span className="font-mono-data text-lg font-black text-[#0f766e]">{money(booking.total_paid, booking.currency)}</span>
                  <span className="font-mono-data text-xs text-[#667085]">Balance {money(booking.balance_due, booking.currency)}</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Link className="pressable inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-black text-white" href={`/bookings/${booking.id}`}>
                      View
                    </Link>
                    <Link className="pressable inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-black text-[var(--foreground-secondary)]" href={`/bookings/${booking.id}/edit`}>
                      Edit
                    </Link>
                    {canExtend(booking) ? (
                      <RentalAdjustmentButton
                        currentEndDate={booking.end_date}
                        currentRate={Number(booking.rental_rate || 0)}
                        currentStartDate={booking.start_date}
                        customerName={booking.customers?.full_name || "Awaiting customer"}
                        label="Adjust"
                        rentalId={booking.id}
                        vehicleLabel={vehicleTitle(booking.vehicles)}
                      />
                    ) : null}
                    {confirmDeleteId === booking.id ? (
                      <div className="mt-1 w-full rounded-lg border border-[#fecaca] bg-[#fef2f2] p-2">
                        <p className="mb-2 text-xs font-semibold text-[#dc2626]">Delete this booking? This cannot be undone.</p>
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
                        className="pressable inline-flex min-h-9 items-center justify-center rounded-lg border border-[#fecaca] bg-[#fef2f2] px-2 text-[#dc2626]"
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
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
