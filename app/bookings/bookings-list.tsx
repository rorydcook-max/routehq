"use client";

import { kindFromCategory } from "@/lib/vehicle-groups";

import { businessToday, daysFromToday as businessDaysFromToday } from "@/lib/business-time";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Clock, Search, Trash2, MoreHorizontal } from "lucide-react";
import { deleteBooking, extendBookingHold } from "@/app/actions/bookings";
import { CancelBookingButton } from "@/app/bookings/[id]/cancel-booking-button";
import { UndoCancellationButton } from "@/app/bookings/[id]/undo-cancellation-button";
import { RentalAdjustmentButton } from "@/components/rental-adjustment-modal";
import { Badge, EmptyState } from "@/components/ui";
import { VehicleArt } from "@/components/vehicle-art";
import { flagForNationality } from "@/lib/customer-options";
import { dateFormat, longDate, shortDate } from "@/lib/i18n/dates";

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
// Set from the counts on the band ("4 on rent"), not from the filter row.
const bandFilters = ["on_rent", "starting", "owing"] as const;
type BandFilter = (typeof bandFilters)[number];

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

/** The status pill says where the booking is; the card itself stays plain and readable, cancelled or not. */
function statusCardClasses(_booking: any) {
  return "";
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
  const days = businessDaysFromToday(booking.end_date);
  return days !== null && days >= 0 && days <= 3;
}

function matchesFilter(booking: any, filter: string) {
  if (filter === "all") return true;
  if (isCancelledBooking(booking)) return filter === "cancelled";
  // The three counts on the band.
  if (filter === "on_rent") return ["active", "due_soon", "overdue", "extended"].includes(String(booking.status || ""));
  if (filter === "starting") {
    const start = String(booking.start_date || "").slice(0, 10);
    return booking.status === "booked" && !!start && start >= businessToday() && start <= businessToday(7);
  }
  if (filter === "owing") return Number(booking.balance_due || 0) > 0;
  if (filter === "due_soon") return booking.status === "due_soon" || isDueSoon(booking);
  if (filter === "overdue") return booking.status === "overdue" || (booking.end_date && (businessDaysFromToday(booking.end_date) ?? 0) < 0 && !["completed", "cancelled"].includes(booking.status));
  return booking.status === filter;
}

function canExtend(booking: any) {
  return ["active", "overdue", "due_soon"].includes(String(booking.status || "").toLowerCase());
}

function daysFromToday(iso: string) {
  return businessDaysFromToday(iso) ?? 0;
}

function rentalTimingLabel(booking: any, tx: Tx) {
  const status = String(booking.status || "").toLowerCase();
  if (["completed", "cancelled"].includes(status)) return null;
  // Not handed over yet: what matters is when it starts.
  const onRent = ["active", "due_soon", "overdue", "extended"].includes(status);
  if (!onRent && booking.start_date) {
    const days = daysFromToday(booking.start_date);
    if (days > 1) return tx.say("startsIn", { days });
    if (days === 1) return tx.say("startsTomorrow");
    if (days === 0) return tx.say("startsToday");
    // Not confirmed and its start has passed: the hold note says what matters.
    if (status !== "booked") return null;
    return tx.say("handoverOverdue", { days: -days });
  }
  // The dates line already says "open-ended"; this line says how long it has been out.
  if (!booking.end_date) return booking.start_date ? tx.say("daysSoFar", { days: Math.max(1, -daysFromToday(booking.start_date)) }) : tx.say("openEnded");
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

function holdState(booking: any, tx: Tx): { ended: boolean; past?: boolean; text: string } | null {
  const link = booking.booking_link;
  if (!link || ["completed", "cancelled"].includes(String(link.status))) return null;
  // A draft is a booking whose hold ran out (or was never confirmed): its dates are open to others.
  if (booking.status === "draft") {
    // Dates already gone by: holding them again makes no sense; the booking wants new dates or cancelling.
    const last = String(booking.end_date || booking.start_date || "").slice(0, 10);
    if (last && last < businessToday()) return { ended: true, past: true, text: tx.say("datesPassed") };
    return { ended: true, text: tx.say("holdEnded") };
  }
  if (booking.status !== "booked" || !link.hold_until) return null;
  const until = new Date(link.hold_until);
  const when = dateFormat(tx.locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(until);
  return { ended: false, text: tx.say("heldUntil", { when }) };
}

function ExtendHoldButton({ rentalId, ended }: { rentalId: string; ended: boolean }) {
  const tx = useTx();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="pressable ml-2 inline-flex min-h-9 items-center whitespace-nowrap rounded-full border border-[var(--border)] bg-white px-3 text-[14px] font-bold text-[var(--primary)] disabled:opacity-60"
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
      {error ? <span className="ml-2 text-[14px] font-semibold text-[var(--danger)]">{error}</span> : null}
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
  const [filter, setFilter] = useState<(typeof filters)[number] | BandFilter>("all");
  const router = useRouter();
  // The row filters work on the spot. While a count on the band is chosen the page's address says so,
  // so a row filter then goes through the address to turn that count off as well.
  function chooseFilter(entry: (typeof filters)[number]) {
    if ((bandFilters as readonly string[]).includes(filter)) {
      router.replace((entry === "all" ? "/bookings" : `/bookings?status=${entry}`) as never, { scroll: false });
      return;
    }
    setFilter(entry);
  }
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteErrorId, setDeleteErrorId] = useState<string | null>(null);
  const [confirmRecords, setConfirmRecords] = useState<{ id: string; signed: boolean; payments: number; inspections: number } | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  // "/bookings?status=overdue" opens on that filter, so other pages can link straight to "late returns" and the like.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("status");
    if (wanted && ([...filters, ...bandFilters] as readonly string[]).includes(wanted)) setFilter(wanted as (typeof filters)[number] | BandFilter);
  }, []);

  function handleDelete(bookingId: string, confirmed = false) {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteBooking(bookingId, confirmed);
      // Real records on it (payments, inspections, a signed agreement): ask once more, saying what will go.
      if (result.needsConfirm) {
        setConfirmDeleteId(null);
        setConfirmRecords({ id: bookingId, ...result.needsConfirm });
        return;
      }
      setConfirmRecords(null);
      if (!result.success) {
        setDeleteErrorId(bookingId);
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

  // "All" reads in three parts: what is out now, what is coming, what is finished. A filter or a search is one list.
  const sections = useMemo(() => {
    if (filter !== "all" || search.trim()) return [{ key: "list", title: null as string | null, items: filtered }];
    const today = businessToday();
    const part = (booking: any) => {
      const status = isCancelledBooking(booking) ? "cancelled" : String(booking.status || "");
      if (status === "cancelled" || status === "completed") return "done";
      if (["booked", "draft", "pending", "confirmed"].includes(status)) {
        // Not "coming up" any more: its start date has passed with no handover, or the hold ran out
        // unsigned. These want a decision (hand over late, move the dates, or cancel), so they sit first.
        const stale = !!booking.start_date && String(booking.start_date).slice(0, 10) < today;
        if (stale || holdState(booking, tx)?.ended) return "decide";
        return "upcoming";
      }
      return "now";
    };
    return (["decide", "now", "upcoming", "done"] as const)
      .map((key) => {
        const day = (booking: any, field: "start_date" | "end_date") => String(booking[field] || (field === "end_date" ? "9999" : "")).slice(0, 10);
        const items = filtered.filter((booking) => part(booking) === key);
        items.sort((a, b) => (key === "upcoming" || key === "decide" ? day(a, "start_date").localeCompare(day(b, "start_date")) : key === "now" ? day(a, "end_date").localeCompare(day(b, "end_date")) : day(b, "end_date").localeCompare(day(a, "end_date"))));
        return { key, title: tx.say(key === "decide" ? "secDecide" : key === "now" ? "secNow" : key === "upcoming" ? "secUpcoming" : "secDone") as string | null, items };
      })
      .filter((section) => section.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, filter, search, tx.locale]);

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
              className="input-with-leading-icon min-h-11 w-full rounded-full border border-[var(--border)] bg-white pr-4 text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tx.say("searchPlaceholder")}
              value={search}
            />
          </label>
          {/* One scrolling line on a phone (with a fade at the edge), a normal row on desktop. */}
          <div className={`chip-row flex-wrap gap-2 xl:justify-end ${showFilters ? "flex" : "hidden"}`}>
            {usefulFilters.map((entry) => (
              <button
                className={`pressable min-h-11 min-w-fit rounded-full border px-4 font-bold ${filter === entry ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-white text-[var(--foreground)]"}`}
                key={entry}
                onClick={() => chooseFilter(entry)}
                type="button"
              >
                {entry === "all" ? tx.say("filterAll") : statusLabel(entry, tx)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {deleteError && !deleteErrorId ? (
        <p className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-3 text-sm font-semibold text-[var(--danger)]">{deleteError}</p>
      ) : null}
      {filtered.length === 0 ? (
        <EmptyState
          title={tx.say("emptyTitle")}
          description={tx.say("emptyBody")}
        />
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
          <section key={section.key}>
            {section.title ? (
              <h2 className="mb-2.5 flex items-center gap-2 px-1 text-[19px] text-[var(--foreground)]">
                {section.title}
                <span className="num inline-flex min-w-7 items-center justify-center rounded-full bg-white px-2 py-0.5 text-[14px] text-[var(--foreground-secondary)]">{section.items.length}</span>
              </h2>
            ) : null}
            {/* Cards in a row share one height (content anchored to the top), so a row never looks ragged. */}
            <div className="grid gap-3 xl:grid-cols-2">
          {(section.key === "done" && !allDone ? section.items.slice(0, 4) : section.items).map((booking) => {
            const timingLabel = rentalTimingLabel(booking, tx);
            const hold = holdState(booking, tx);
            const waitingOn = lateBefore(booking, bookings);
            const photoUrl = booking.vehicles?.primary_photo_url;
            const effectiveStatus = isCancelledBooking(booking) ? "cancelled" : String(booking.status || "");
            // Badges only for the exception. Under "Coming up" every card is booked, so "Booked" says nothing;
            // a signed link is the normal case, so only an unsigned one gets a badge.
            const showStatusBadge = !(section.key === "upcoming" && effectiveStatus === "booked");
            const linkSigned = ["completed", "contract_signed"].includes(String(booking.booking_link?.status));
            const showLinkBadge = ["booked", "draft"].includes(effectiveStatus) && !linkSigned && Boolean(linkLabel(booking.booking_link?.status, tx));
            const hasBadges = showStatusBadge || showLinkBadge;
            return (
            <article className={`card relative !overflow-visible p-4 transition has-[details[open]]:z-30 ${statusCardClasses(booking)}`} key={booking.id}>
              {/* overflow-visible: the ⋯ menu opens past the card's edge (it was cut off at Edit); an open menu sits above the next card. */}
              {/* The vehicle's picture beside the details: its photo, or a drawing in its own colour (Lagoon look). Small on phones so the words keep their room. */}
              {/* Phones drop the picture so the customer, vehicle and dates get the whole width (as on the dashboard's Today list). */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[56px_minmax(0,1fr)] md:grid-cols-[104px_minmax(0,1fr)_auto] md:items-center">
                <Link aria-label={tx.say("photoAlt", { vehicle: vehicleTitle(booking.vehicles) || tx.say("vehicle") })} className="relative z-10 mt-1 hidden self-start sm:block md:mt-0 md:self-center" href={`/bookings/${booking.id}`}>
                  <span className="block md:hidden"><VehicleArt colour={(booking.vehicles as any)?.color} kind={kindFromCategory((booking.vehicles as any)?.vehicle_categories)} model={booking.vehicles?.model} photoUrl={photoUrl} size="sm" /></span>
                  <span className="hidden md:block"><VehicleArt colour={(booking.vehicles as any)?.color} kind={kindFromCategory((booking.vehicles as any)?.vehicle_categories)} model={booking.vehicles?.model} photoUrl={photoUrl} size="md" /></span>
                </Link>

                <div className="min-w-0 py-0.5">
                  {/* One badge for where the booking is, and one more only while it waits on the customer's link. The dots stay in the corner however the badges wrap. */}
                  <div className="flex items-start gap-1.5 pr-8">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {showStatusBadge ? <Badge tone={statusTone(effectiveStatus)}>{statusLabel(effectiveStatus, tx)}</Badge> : null}
                    {showLinkBadge ? <Badge tone="amber">{linkLabel(booking.booking_link?.status, tx)}</Badge> : null}
                  </div>
                    {/* Edit, extend, cancel and delete stay one tap away without crowding every card. */}
                    {/* z-20: above the card's own tappable lines (z-10), which painted over the open menu. */}
                    <details className="absolute right-2.5 top-2.5 z-20">
                      <summary aria-label={tx.say("moreOptions")} className="pressable flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-secondary)] [&::-webkit-details-marker]:hidden">
                        <MoreHorizontal size={18} />
                      </summary>
                      <div className="absolute right-0 top-full z-20 mt-1 flex min-w-[170px] flex-col items-stretch gap-1.5 whitespace-nowrap rounded-lg border border-[var(--border)] bg-white p-2 text-left shadow-lg">
                <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[14px] font-semibold text-[var(--foreground-secondary)]" href={`/bookings/${booking.id}/edit`}>
                  {tx.say("edit")}
                </Link>
                {canExtend(booking) ? (
                  <RentalAdjustmentButton
                    className="pressable inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[14px] font-semibold text-[var(--foreground-secondary)]"
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
                    className="pressable inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-[var(--danger-line)] bg-[var(--danger-light)] px-3 py-1.5 text-[14px] font-semibold text-[var(--danger)]"
                    onClick={(event) => {
                      // Close the menu so the confirm box below the card is what's in view (it opened hidden behind it).
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      setConfirmDeleteId(booking.id);
                      setDeleteError(null);
                    }}
                    type="button"
                  >
                    <Trash2 size={14} />
                    {tx.say("deleteBooking")}
                  </button>
                )}
              </div>
                    </details>
                  </div>

                  <Link className={`${hasBadges ? "mt-2" : ""} block pr-8 text-[19px] font-bold leading-tight text-[var(--foreground)] after:absolute after:inset-0 after:content-[''] hover:text-[var(--primary)]`} href={`/bookings/${booking.id}`}>
                    {booking.customers ? (
                      customerLabel(booking, tx)
                    ) : booking.status === "cancelled" ? (
                      // Nothing is awaited on a cancelled booking: the link was never filled in (said on the line below).
                      <span className="text-[var(--foreground-secondary)]">{tx.say("noCustomer")}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[var(--warning)]"><Clock size={18} /> {tx.say("awaitingCustomer")}</span>
                    )}
                  </Link>

                  {/* One line: the vehicle and the dates. The plate and the phone are on the booking. */}
                  <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">
                    {vehicleTitle(booking.vehicles) || tx.say("vehicle")} · {formatRange(booking.start_date, booking.end_date, tx)}
                  </p>
                  {!booking.customers && booking.status === "cancelled" ? <p className="mt-0.5 font-medium text-[var(--muted)]">{tx.say("linkNotCompleted")}</p> : null}
                  {timingLabel ? <p className="mt-1 font-bold text-[var(--foreground)]">{timingLabel}</p> : null}
          {(() => {
            // Only a rental that is out and has an end: the bar runs from handover to return, filled up to today.
            const start = String(booking.start_date || "").slice(0, 10);
            const end = String(booking.end_date || "").slice(0, 10);
            const onRoad = ["active", "due_soon", "overdue", "extended"].includes(String(booking.status || ""));
            if (!onRoad || !start || !end || end <= start) return null;
            const day = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();
            const done = Math.max(0, Math.min(100, ((day(businessToday()) - day(start)) / (day(end) - day(start))) * 100));
            const late = businessToday() > end;
            return (
              <span aria-hidden="true" className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-[var(--panel-tertiary)]">
                <span className="grow-x block h-full rounded-full" style={{ width: `${late ? 100 : done}%`, background: late ? "var(--danger)" : "var(--on-rent)" }} />
              </span>
            );
          })()}
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
                      {hold.past ? (
                        <Link className="ml-2 inline-flex min-h-9 items-center whitespace-nowrap rounded-full border border-[var(--border)] bg-white px-3 text-[14px] font-bold text-[var(--primary)]" href={`/bookings/${booking.id}`}>
                          {tx.say("changeDates")}
                        </Link>
                      ) : (
                        <ExtendHoldButton ended={hold.ended} rentalId={booking.id} />
                      )}
                    </p>
                  ) : null}
                </div>

                {/* Money only when there is something to say: what is due now in brick, otherwise what has been paid. */}
                {Number(booking.balance_due) > 0 ? (
                  <p className="sm:col-start-2 text-[17px] font-bold tabular-nums text-[var(--danger)] md:col-start-auto md:text-right">{tx.say("dueNow", { amount: money(booking.balance_due, booking.currency) })}</p>
                ) : Number(booking.total_paid) > 0 ? (
                  <p className="sm:col-start-2 font-bold tabular-nums text-[var(--success)] md:col-start-auto md:text-right">{tx.say("paid")} {money(booking.total_paid, booking.currency)}</p>
                ) : null}
              </div>
              {deleteError && deleteErrorId === booking.id ? (
                // Said on the card that was tapped: at the top of the list it was off-screen, so delete seemed to do nothing.
                <p className="relative z-10 mt-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-2 text-sm font-semibold text-[var(--danger)]" ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })} role="alert">
                  {deleteError}
                </p>
              ) : null}
              {confirmRecords && confirmRecords.id === booking.id ? (
                <div className="relative z-10 mt-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-3 text-[var(--danger)]" ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })} role="alertdialog">
                  <p className="text-sm font-bold">{tx.say("deleteRecordsTitle")}</p>
                  <ul className="mt-1.5 space-y-1 text-sm">
                    {[
                      confirmRecords.payments > 0 ? tx.say("deleteRecordsPayments", { count: String(confirmRecords.payments) }) : null,
                      confirmRecords.inspections > 0 ? tx.say("deleteRecordsInspections", { count: String(confirmRecords.inspections) }) : null,
                      confirmRecords.signed ? tx.say("deleteRecordsSigned") : null
                    ]
                      .filter(Boolean)
                      .map((line) => (
                        <li className="flex items-start gap-2 leading-snug" key={String(line)}>
                          <span aria-hidden="true" className="flex h-[1.375em] shrink-0 items-center"><span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" /></span>
                          <span>{line}</span>
                        </li>
                      ))}
                  </ul>
                  {confirmRecords.payments > 0 || confirmRecords.inspections > 0 ? <p className="mt-2 text-xs font-semibold">{tx.say("deleteRecordsBody")}</p> : null}
                  <div className="mt-2.5 flex gap-2">
                    <button
                      className="pressable inline-flex min-h-8 items-center rounded-full bg-[var(--danger)] px-3 text-xs font-bold text-white disabled:opacity-60"
                      disabled={isPending}
                      onClick={() => handleDelete(booking.id, true)}
                      type="button"
                    >
                      {isPending ? tx.say("deleting") : tx.say("deleteAnyway")}
                    </button>
                    <button
                      className="pressable inline-flex min-h-8 items-center rounded-full border border-[var(--border)] bg-white px-3 text-xs font-bold text-[var(--foreground-secondary)]"
                      disabled={isPending}
                      onClick={() => setConfirmRecords(null)}
                      type="button"
                    >
                      {tx.say("back")}
                    </button>
                  </div>
                </div>
              ) : null}
              {confirmDeleteId === booking.id ? (
                <div className="relative z-10 mt-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-2" ref={(el) => el?.scrollIntoView({ block: "nearest", behavior: "smooth" })}>
                  <p className="mb-2 text-xs font-semibold text-[var(--danger)]">
                    {tx.rich("deleteConfirm", { b: (chunks: React.ReactNode) => <strong>{chunks}</strong> })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="pressable inline-flex min-h-7 items-center rounded-full bg-[var(--danger)] px-3 text-xs font-bold text-white disabled:opacity-60"
                      disabled={isPending}
                      onClick={() => handleDelete(booking.id)}
                      type="button"
                    >
                      {isPending ? tx.say("deleting") : tx.say("confirmDelete")}
                    </button>
                    <button
                      className="pressable inline-flex min-h-7 items-center rounded-full border border-[var(--border)] bg-white px-3 text-xs font-bold text-[var(--foreground-secondary)]"
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
            {section.key === "done" && !allDone && section.items.length > 4 ? (
              <button className="pressable mt-3 inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-[var(--border)] bg-white px-5 font-bold text-[var(--foreground)]" onClick={() => setAllDone(true)} type="button">
                {tx.say("showAllDone", { count: String(section.items.length) })}
              </button>
            ) : null}
          </section>
          ))}
        </div>
      )}
    </div>
  );
}
