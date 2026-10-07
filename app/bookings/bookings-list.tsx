"use client";

import { businessToday } from "@/lib/business-time";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Car, Clock, Search, Trash2, UserRound, MoreHorizontal } from "lucide-react";
import { deleteBooking, extendBookingHold } from "@/app/actions/bookings";
import { CancelBookingButton } from "@/app/bookings/[id]/cancel-booking-button";
import { UndoCancellationButton } from "@/app/bookings/[id]/undo-cancellation-button";
import { RentalAdjustmentButton } from "@/components/rental-adjustment-modal";
import { Badge, EmptyState } from "@/components/ui";
import { flagForNationality } from "@/lib/customer-options";
import { intlLocale, longDate, shortDate } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;
/** The words for this screen in the reader's language, and the language itself for dates. */
type Tx = { say: Say; rich: (key: string, values: Record<string, any>) => React.ReactNode; has: (key: string) => boolean; locale: string };

function useTx(): Tx {
  const t = useTranslations("bookings");
  const locale = useLocale();
  return { say: t as unknown as Say, rich: (key, values) => (t as any).rich(key, values), has: (key) => (t as any).has(key), locale };
}

function statusLabel(status: string, tx: Tx) {
  return tx.has(`status_${status}`) ? tx.say(`status_${status}`) : status.replace(/_/g, " ");
}

const filters = ["all", "booked", "active", "due_soon", "overdue", "completed", "cancelled"] as const;

function money(value: unknown, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined, tx: Tx) {
  if (!value) return tx.say("open");
  return longDate(String(value).slice(0, 10), tx.locale);
}

/** "27 Sep – 28 Oct 2026"; the year is shown once when both dates share it. */
function formatRange(start: string | null | undefined, end: string | null | undefined, tx: Tx) {
  if (!start) return formatDate(end, tx);
  if (!end) return tx.say("rangeOpenEnded", { date: formatDate(start, tx) });
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const first = sameYear ? shortDate(String(start).slice(0, 10), tx.locale) : formatDate(start, tx);
  return `${first} – ${formatDate(end, tx)}`;
}

function vehicleTitle(vehicle: any) {
  return [vehicle?.make, vehicle?.model, vehicle?.trim].filter(Boolean).join(" ");
}

function bookingReference(booking: any) {
  return booking?.reference || booking?.display_code || booking?.id?.slice(0, 8) || "Booking";
}

function statusTone(status: string): "green" | "amber" | "red" | "blue" | "neutral" {
  // Same as the booking page: the solid pill is for a vehicle that is out right now.
  if (status === "completed") return "green";
  if (status === "active" || status === "extended" || status === "due_soon") return "blue";
  if (status === "overdue" || status === "cancelled") return "red";
  if (status === "booked") return "amber";
  return "neutral";
}

function isCancelledBooking(booking: any) {
  return String(booking.status || "").toLowerCase() === "cancelled" || String(booking.booking_link?.status || "").toLowerCase() === "cancelled";
}

/** The status pill says where the booking is; the card itself stays plain. Cancelled ones fade. */
function statusCardClasses(booking: any) {
  return isCancelledBooking(booking) ? "opacity-70" : "";
}

/** Where the customer is with their booking link. Same wording as the booking page; nothing when there's no live link. */
function linkLabel(status: string | null | undefined, tx: Tx) {
  if (!status || status === "cancelled") return null;
  if (status === "completed" || status === "contract_signed") return tx.say("link_signed");
  if (status === "viewed") return tx.say("link_viewed");
  if (status === "details_submitted") return tx.say("link_details");
  if (status === "sent") return tx.say("link_sent");
  if (status === "expired") return tx.say("link_expired");
  return tx.say("link_notOpened");
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

function rentalTimingLabel(booking: any, tx: Tx) {
  const status = String(booking.status || "").toLowerCase();
  if (["completed", "cancelled"].includes(status)) return null;
  // Not handed over yet: what matters is when it starts.
  if (status === "booked" && booking.start_date) {
    const days = daysFromToday(booking.start_date);
    if (days > 1) return tx.say("startsIn", { days });
    if (days === 1) return tx.say("startsTomorrow");
    if (days === 0) return tx.say("startsToday");
    return tx.say("handoverOverdue", { days: -days });
  }
  if (!booking.end_date) return tx.say("openEnded");
  const days = daysFromToday(booking.end_date);
  if (days < 0) return tx.say("returnLate", { days: -days });
  if (days === 0) return tx.say("dueBackToday");
  if (days === 1) return tx.say("dueBackTomorrow");
  return tx.say("dueBackIn", { days });
}

/** Where an unsigned booking stands: still held, or its hold has ended. */
/** The rental still out on this booking's vehicle past its return date, when this booking starts within a week. */
function lateBefore(booking: any, all: any[]) {
  if (String(booking.status) !== "booked" || !booking.start_date) return null;
  const vehicleId = booking.vehicle_id || booking.vehicles?.id;
  if (!vehicleId) return null;
  const today = businessToday();
  const weekAhead = businessToday(7);
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

function holdState(booking: any, tx: Tx): { ended: boolean; text: string } | null {
  const link = booking.booking_link;
  if (!link || ["completed", "cancelled"].includes(String(link.status))) return null;
  if (link.hold_released_at && booking.status === "draft") return { ended: true, text: tx.say("holdEnded") };
  if (booking.status !== "booked" || !link.hold_until) return null;
  const until = new Date(link.hold_until);
  const when = new Intl.DateTimeFormat(intlLocale(tx.locale), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(until);
  return { ended: false, text: tx.say("heldUntil", { when }) };
}

function ExtendHoldButton({ rentalId, ended }: { rentalId: string; ended: boolean }) {
  const tx = useTx();
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
            if (!result.success) setError(result.error || tx.say("holdError"));
          });
        }}
        type="button"
      >
        {isPending ? tx.say("saving") : ended ? tx.say("holdAgain") : tx.say("extendHold")}
      </button>
      {error ? <span className="ml-2 text-[11px] font-semibold text-[var(--danger)]">{error}</span> : null}
    </>
  );
}

function customerLabel(booking: any, tx: Tx) {
  if (!booking.customers) return tx.say("awaitingCustomer");
  return `${flagForNationality(booking.customers.nationality)} ${booking.customers.full_name}`;
}

export function BookingsList({ bookings }: { bookings: any[] }) {
  const tx = useTx();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // "/bookings?status=overdue" opens on that filter, so other pages can link straight to "late returns" and the like.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("status");
    if (wanted && (filters as readonly string[]).includes(wanted)) setFilter(wanted as (typeof filters)[number]);
  }, []);

  function handleDelete(bookingId: string) {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteBooking(bookingId);
      if (!result.success) {
        setDeleteError(result.error || tx.say("deleteFailed"));
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

  // Only the filters that would show something, and none at all while there is nothing to choose between.
  const usefulFilters = filters.filter((entry) => entry === "all" || entry === filter || bookings.some((booking) => matchesFilter(booking, entry)));
  const showFilters = usefulFilters.length > 2 || filter !== "all";

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <label className={`relative min-w-0 flex-1 ${bookings.length > 5 || search ? "block" : "hidden"}`}>
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
            <input
              className="input-with-leading-icon w-full rounded-full border-0 bg-white pr-4 font-medium text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tx.say("searchPlaceholder")}
              value={search}
            />
          </label>
          {/* Wraps onto a second row on a phone: scrolling sideways hid half the filters with no sign they were there. */}
          <div className={`flex-wrap gap-2 xl:justify-end ${showFilters ? "flex" : "hidden"}`}>
            {usefulFilters.map((entry) => (
              <button
                className={`pressable min-h-10 min-w-fit rounded-full px-4 font-bold ${filter === entry ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--foreground)]"}`}
                key={entry}
                onClick={() => setFilter(entry)}
                type="button"
              >
                {entry === "all" ? tx.say("filterAll") : statusLabel(entry, tx)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {deleteError ? (
        <p className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-3 text-sm font-semibold text-[var(--danger)]">{deleteError}</p>
      ) : null}
      {filtered.length === 0 ? (
        <EmptyState
          title={tx.say("emptyTitle")}
          description={tx.say("emptyBody")}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((booking) => {
            const timingLabel = rentalTimingLabel(booking, tx);
            const hold = holdState(booking, tx);
            const waitingOn = lateBefore(booking, bookings);
            const photoUrl = booking.vehicles?.primary_photo_url;
            const effectiveStatus = isCancelledBooking(booking) ? "cancelled" : String(booking.status || "");
            return (
            <article className={`card relative p-4 transition ${statusCardClasses(booking)}`} key={booking.id}>
              {/* Photo beside the details from tablet width up. On phones a photo squeezed into a strip showed a slice of bonnet, so it is left out there. */}
              <div className="grid gap-3 md:grid-cols-[104px_minmax(0,1fr)_auto] md:items-center">
                <Link className={`group relative h-[72px] overflow-hidden hidden md:block rounded-xl bg-[var(--panel-secondary)]`} href={`/bookings/${booking.id}`}>
                  {photoUrl ? (
                    <img
                      alt={tx.say("photoAlt", { vehicle: vehicleTitle(booking.vehicles) || tx.say("vehicle") })}
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
                  {/* One badge for where the booking is, and one more only while it waits on the customer's link. The dots stay in the corner however the badges wrap. */}
                  <div className="flex items-start gap-1.5">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone(effectiveStatus)}>{statusLabel(effectiveStatus, tx)}</Badge>
                    {["booked", "draft"].includes(effectiveStatus) && linkLabel(booking.booking_link?.status, tx) ? (
                    <Badge tone={["completed", "contract_signed"].includes(String(booking.booking_link?.status)) ? "green" : booking.booking_link?.status === "viewed" ? "blue" : "amber"}>
                      {linkLabel(booking.booking_link?.status, tx)}
                    </Badge>
                  ) : null}
                  </div>
                    {/* Edit, extend, cancel and delete stay one tap away without crowding every card. */}
                    <details className="relative z-10 ml-auto shrink-0">
                      <summary aria-label={tx.say("moreOptions")} className="pressable flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-secondary)] [&::-webkit-details-marker]:hidden">
                        <MoreHorizontal size={18} />
                      </summary>
                      <div className="absolute right-0 top-full z-20 mt-1 flex min-w-[150px] flex-col items-stretch gap-1.5 rounded-lg border border-[var(--border)] bg-white p-2 text-left shadow-lg">
                <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground-secondary)]" href={`/bookings/${booking.id}/edit`}>
                  {tx.say("edit")}
                </Link>
                {canExtend(booking) ? (
                  <RentalAdjustmentButton
                    className="pressable inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--foreground-secondary)]"
                    currentEndDate={booking.end_date}
                    currentRate={Number(booking.rental_rate || 0)}
                    currentStartDate={booking.start_date}
                    customerName={booking.customers?.full_name || tx.say("awaitingCustomerShort")}
                    label={tx.say("extend")}
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
                    label={tx.say("undo")}
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
                    label={tx.say("cancel")}
                  />
                ) : null}
                {confirmDeleteId === booking.id ? null : (
                  <button
                    className="pressable inline-flex min-h-8 items-center justify-center rounded-md border border-[var(--danger-line)] bg-[var(--danger-light)] px-2 text-[var(--danger)]"
                    onClick={() => { setConfirmDeleteId(booking.id); setDeleteError(null); }}
                    title={tx.say("deleteBooking")}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
                    </details>
                  </div>

                  <Link className="mt-2 block text-[19px] font-bold leading-tight text-[var(--foreground)] after:absolute after:inset-0 after:content-[''] hover:text-[var(--primary)]" href={`/bookings/${booking.id}`}>
                    {booking.customers ? customerLabel(booking, tx) : <span className="inline-flex items-center gap-1.5 text-[var(--warning)]"><Clock size={18} /> {tx.say("awaitingCustomer")}</span>}
                  </Link>

                  {/* One line: the vehicle and the dates. The plate and the phone are on the booking. */}
                  <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">
                    {vehicleTitle(booking.vehicles) || tx.say("vehicle")} · {formatRange(booking.start_date, booking.end_date, tx)}
                  </p>
                  {timingLabel ? <p className="mt-1 font-bold text-[var(--foreground)]">{timingLabel}</p> : null}
                  {waitingOn ? (
                    <p className="mt-1 font-bold text-[var(--danger)]">
                      {tx.say("notBack", { name: waitingOn.customers?.full_name || tx.say("currentCustomer"), date: shortDate(String(waitingOn.end_date).slice(0, 10), tx.locale) })}{" "}
                      <Link className="relative z-10 underline underline-offset-2" href={`/bookings/${waitingOn.id}`}>
                        {tx.say("openThatRental")}
                      </Link>
                    </p>
                  ) : null}
                  {hold ? (
                    <p className={`relative z-10 mt-1 w-fit font-semibold ${hold.ended ? "text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}`}>
                      {hold.text}
                      <ExtendHoldButton ended={hold.ended} rentalId={booking.id} />
                    </p>
                  ) : null}
                </div>

                {/* Money only when there is something to say: what is due now in brick, otherwise what has been paid. */}
                {Number(booking.balance_due) > 0 ? (
                  <p className="text-[17px] font-bold tabular-nums text-[var(--danger)] md:text-right">{tx.say("dueNow", { amount: money(booking.balance_due, booking.currency) })}</p>
                ) : Number(booking.total_paid) > 0 ? (
                  <p className="font-bold tabular-nums text-[var(--success)] md:text-right">{tx.say("paid")} {money(booking.total_paid, booking.currency)}</p>
                ) : null}
              </div>
              {confirmDeleteId === booking.id ? (
                <div className="relative z-10 mt-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-2">
                  <p className="mb-2 text-xs font-semibold text-[var(--danger)]">
                    {tx.rich("deleteConfirm", { b: (chunks: React.ReactNode) => <strong>{chunks}</strong> })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="pressable inline-flex min-h-7 items-center rounded-lg bg-[var(--danger)] px-3 text-xs font-bold text-white disabled:opacity-60"
                      disabled={isPending}
                      onClick={() => handleDelete(booking.id)}
                      type="button"
                    >
                      {isPending ? tx.say("deleting") : tx.say("confirmDelete")}
                    </button>
                    <button
                      className="pressable inline-flex min-h-7 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-bold text-[var(--foreground-secondary)]"
                      disabled={isPending}
                      onClick={() => setConfirmDeleteId(null)}
                      type="button"
                    >
                      {tx.say("back")}
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
