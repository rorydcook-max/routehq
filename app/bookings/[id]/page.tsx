import Link from "next/link";
import { canDecideMoney, getCurrentMembership } from "@/lib/auth/roles";
import type { Route } from "next";
import { AlertTriangle, ArrowRight, Car, CheckCircle2, Clock, CreditCard, FileText, Gauge, MapPin, UserRound, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { CancelBookingButton } from "@/app/bookings/[id]/cancel-booking-button";
import { VehicleChangeButton } from "@/app/bookings/[id]/vehicle-change-button";
import { UnsentMessages } from "@/app/bookings/[id]/unsent-messages";
import { activityTitle, tidyDetail, visibleActivity } from "@/lib/activity-display";
import { UndoCancellationButton } from "@/app/bookings/[id]/undo-cancellation-button";
import { confirmCustomerPayment } from "@/app/actions/deposits";
import { PaymentReminderButton } from "@/app/bookings/[id]/payment-reminder-button";
import { acknowledgePortalAction, declinePortalAction, replyToPortalQuestion, resolvePortalAction } from "@/app/actions/portal-actions";
import { ExtensionRequestAnswer } from "@/app/bookings/[id]/extension-request-answer";
import { extensionPicture } from "@/lib/extension-picture";
import { getLocale, getTranslations } from "next-intl/server";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale, longDate, shortDate } from "@/lib/i18n/dates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AssignCustomerModal } from "@/app/bookings/[id]/assign-customer-modal";
import { SkipInspectionButton } from "@/app/bookings/[id]/skip-inspection-button";
import { earlyStartFor } from "@/lib/early-start";
import { lateStartFor } from "@/lib/late-start";
import { BookingShareActions } from "@/app/bookings/[id]/booking-share-actions";
import { RefundDepositPanel } from "@/app/bookings/[id]/refund-deposit-panel";
import { ExtrasPanel } from "@/app/bookings/[id]/extras-panel";
import { EarlyReturnOwedPanel } from "@/app/bookings/[id]/early-return-owed";
import { activeExtrasLines, extrasLines, extrasSummary } from "@/lib/extras";
import { AppShell } from "@/components/app-shell";
import { VehicleArt } from "@/components/vehicle-art";
import { DateLeaf, PartBar, PaymentStrip, RentalTrack, initialsOf } from "@/components/glance";
import { kindFromCategory } from "@/lib/vehicle-groups";
import { AddRentalPaymentInlineForm, EditableEndDate, EditableRentalPaymentRow, EditableTransactionRow, ExistingRentalPaymentSetupCard } from "@/components/booking-correction-controls";
import { CommunicationPanel } from "@/components/communication-panel";
import { BookingDatesButton, RentalAdjustmentButton } from "@/components/rental-adjustment-modal";
import { InspectionViewer } from "@/components/inspection-viewer";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, Pane, SectionHeader } from "@/components/ui";
import { PageTabs } from "@/components/page-tabs";
import { OpenOnHash } from "@/components/open-on-hash";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getBookingDetail, getCustomersForSelector } from "@/lib/bookings";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDeliveryLocation } from "@/lib/delivery-location";
import { toWallTime, wallTimeToIso, businessToday, BUSINESS_TIME_ZONE } from "@/lib/business-time";
import { signedReceiptUrls } from "@/lib/payment-receipts";
import { GeneratePaymentScheduleButton } from "@/app/bookings/[id]/generate-payment-schedule-button";
import { RentalDocumentsCard } from "@/app/bookings/[id]/rental-documents-card";
import { PendingAmendmentCard } from "@/app/bookings/[id]/pending-amendment-card";
import { businessSignatureOf, getBookingRentalDocuments, renterSignatureOf, type BookingRentalDocument } from "@/lib/booking-rental-documents";

function money(value: unknown, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

type Say = (key: string, values?: Record<string, string | number>) => string;
/** The words for this page (say), the words shared with the bookings list (list), and the language for dates. */
type Tx = { say: Say; list: Say; locale: string };

/** For the parts of this page that are not async. */
function useTx(): Tx {
  return { say: useTranslations("booking") as unknown as Say, list: useTranslations("bookings") as unknown as Say, locale: useLocale() };
}

function formatDate(value: string | null | undefined, tx: Tx) {
  if (!value) return tx.say("open");
  // The day on the business's clock, whatever clock the server keeps.
  const iso = toWallTime(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(value);
  return longDate(iso, tx.locale);
}

function formatDateTime(value: string | null | undefined, tx: Tx) {
  if (!value) return tx.say("notYet");
  // A time without an offset is already Thai time; reading it as UTC showed 09:00 handovers as 16:00.
  const instant = wallTimeToIso(value);
  if (!instant) return tx.say("notYet");
  return new Intl.DateTimeFormat(intlLocale(tx.locale), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: BUSINESS_TIME_ZONE }).format(new Date(instant));
}

function formatPaymentMethod(value: string | null | undefined, tx: Tx) {
  if (!value) return tx.say("pm_none");
  return ["cash", "promptpay", "bank_transfer", "wise", "revolut"].includes(value) ? tx.say(`pm_${value}`) : String(value).replace(/_/g, " ");
}

function formatPaymentTiming(value: string | null | undefined, tx: Tx) {
  if (value === "now") return tx.say("timing_now");
  if (value === "on_delivery") return tx.say("timing_on_delivery");
  return "—";
}

function formatDepositSummary(rental: any, tx: Tx) {
  const status = String(rental?.deposit_status || "pending");
  const currency = rental?.currency || "THB";

  if (status === "received") {
    return money(rental?.deposit_held, currency);
  }

  if (status === "fully_returned") {
    return tx.say("dep_returned");
  }

  if (status === "forfeited") {
    return tx.say("dep_kept");
  }

  if (status === "partially_forfeited") {
    return Number(rental?.deposit_refunded_amount || 0) > 0
      ? tx.say("dep_returnedKept", { returned: money(rental?.deposit_refunded_amount, currency), kept: money(rental?.deposit_forfeited_amount, currency) })
      : tx.say("dep_keptPart", { kept: money(rental?.deposit_forfeited_amount, currency) });
  }

  if (status === "partially_returned") {
    return tx.say("dep_returnedPart", { returned: money(rental?.deposit_refunded_amount, currency) });
  }

  // A booking taken without a deposit was reading "฿0 - not yet collected", as if money were owed.
  if (!(Number(rental?.deposit_amount || 0) > 0)) return tx.say("dep_noneSet");

  return tx.say("dep_notCollected", { amount: money(rental?.deposit_amount, currency) });
}

function startedAgoLabel(startDate: string | null | undefined, tx: Tx): string {
  if (!startDate) return tx.say("ago_recently");
  // Calendar days in Thai time: a rental that started this morning started "today", not "yesterday".
  const start = new Date(String(startDate).slice(0, 10) + "T00:00:00Z");
  const today = new Date(businessToday() + "T00:00:00Z");
  const diffDays = Math.round((today.getTime() - start.getTime()) / 86_400_000);
  if (diffDays < 1) return tx.say("ago_today");
  if (diffDays === 1) return tx.say("ago_yesterday");
  if (diffDays < 30) return tx.say("ago_days", { count: diffDays });
  return tx.say("ago_months", { count: Math.round(diffDays / 30) });
}

/** Where the customer is with their booking link, in plain words. Nothing when there is no live link. */
function bookingLinkBadge(status: string | null | undefined, tx: Tx): { label: string; tone: "green" | "blue" | "amber" } | null {
  switch (status) {
    case "pending":
      return { label: tx.list("link_notOpened"), tone: "amber" };
    case "sent":
      return { label: tx.list("link_sent"), tone: "amber" };
    case "viewed":
      return { label: tx.list("link_viewed"), tone: "blue" };
    case "details_submitted":
      return { label: tx.list("link_details"), tone: "blue" };
    case "contract_signed":
    case "completed":
      return { label: tx.list("link_signed"), tone: "green" };
    case "expired":
      return { label: tx.list("link_expired"), tone: "amber" };
    default:
      return null;
  }
}

function daysRemaining(value: string | null | undefined, status: string | null | undefined, startDate: string | null | undefined, tx: Tx) {
  if (status === "completed") return tx.say("returned");
  if (status === "cancelled") return tx.say("cancelled");
  const today = businessToday();
  const daysFromToday = (date: string) =>
    Math.round((new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
  if (status === "booked" && startDate) {
    const untilStart = daysFromToday(startDate);
    if (untilStart > 0) return untilStart === 1 ? tx.list("startsTomorrow") : tx.list("startsIn", { days: untilStart });
    if (untilStart === 0) return tx.list("startsToday");
    return tx.list("handoverOverdue", { days: -untilStart });
  }
  if (!value) {
    // The dates line already says open-ended; say how long it has been out instead.
    if (!startDate) return "";
    const out = -daysFromToday(startDate);
    return out > 0 ? tx.say("daysSoFar", { days: out }) : tx.say("startedToday");
  }
  const days = daysFromToday(value);
  if (days === 0) return tx.list("dueBackToday");
  if (days < 0) return tx.list("returnLate", { days: -days });
  if (days === 1) return tx.list("dueBackTomorrow");
  return tx.list("dueBackIn", { days });
}

function statusLabel(status: string, tx: Tx) {
  return ["booked", "active", "due_soon", "overdue", "extended", "completed", "cancelled", "draft"].includes(status) ? tx.list(`status_${status}`) : status.replace(/_/g, " ");
}

function statusTone(status: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "completed") return "green";
  if (status === "active" || status === "due_soon" || status === "extended") return "blue";
  if (status === "overdue" || status === "cancelled") return "red";
  if (status === "booked") return "amber";
  return "neutral";
}

function documentLabel(status: string | null | undefined, tx: Tx) {
  if (status === "complete") return tx.say("doc_complete");
  if (status === "no_documents") return tx.say("doc_none");
  return tx.say("doc_missing");
}

function isVoidedPayment(payment: any) {
  return payment?.status === "voided" || Boolean(payment?.metadata?.voided);
}

function isVoidedTransaction(transaction: any) {
  return Boolean(transaction?.voided || transaction?.metadata?.voided);
}

function vehicleTitle(vehicle: any) {
  return [vehicle?.make, vehicle?.model, vehicle?.trim, vehicle?.year].filter(Boolean).join(" ");
}

function bookingReference(rental: any) {
  return rental?.reference || rental?.display_code || rental?.id;
}

function normalizedDeliveryMethod(value: unknown) {
  if (value === "deliver") return "delivery";
  if (value === "collect") return "collection";
  if (value === "collection" || value === "tbd" || value === "delivery") return value;
  return "delivery";
}

function deliveryDisplay(rental: any, bookingLink: any, tx: Tx) {
  const bookingData = (bookingLink?.booking_data || {}) as Record<string, unknown>;
  const method = normalizedDeliveryMethod(rental?.delivery_method || bookingData.delivery_method);
  const location = formatDeliveryLocation(String(bookingData.delivery_location || rental?.delivery_location || "").trim());
  const dateTime = toWallTime(bookingData.delivery_datetime || rental?.delivery_datetime || "");

  return {
    method,
    /** The place or the time has not been agreed yet. */
    undecided: !location || !dateTime,
    title: method === "tbd" ? tx.say("del_tbdTitle") : method === "collection" ? tx.say("del_collection") : tx.say("del_delivery"),
    detail: location ? `${location} · ${dateTime ? formatDateTime(dateTime, tx) : tx.say("timeTbd")}` : tx.say("locTimeTbd")
  };
}

function timelineSteps(bookingLink: any, rentalDocuments: BookingRentalDocument[]) {
  const renterSignature = renterSignatureOf(rentalDocuments);
  const businessSignature = businessSignatureOf(rentalDocuments);
  const steps = [
    { key: "created", complete: Boolean(bookingLink?.created_at), at: bookingLink?.created_at },
    { key: "sent", complete: Boolean(bookingLink?.sent_at) || ["sent", "viewed", "details_submitted", "contract_signed", "completed"].includes(bookingLink?.status), at: bookingLink?.sent_at },
    { key: "viewed", complete: Boolean(bookingLink?.viewed_at), at: bookingLink?.viewed_at },
    { key: "form", complete: Boolean(bookingLink?.customer_details_submitted_at), at: bookingLink?.customer_details_submitted_at },
    { key: "customerSigned", complete: Boolean(renterSignature || bookingLink?.contract_signed_at), at: renterSignature?.signedAt || bookingLink?.contract_signed_at },
    { key: "businessSigned", complete: Boolean(businessSignature), at: businessSignature?.signedAt }
  ];
  // A customer who booked online, or opened the link without it being sent from here, never had a "Sent" step.
  const source = String((bookingLink?.booking_data as any)?.source || "");
  const bookedOnline = source === "public_page" || source === "directory";
  const shown = steps.filter((step) => step.key !== "sent" || (!bookedOnline && (step.complete || !bookingLink?.viewed_at)));
  if (bookedOnline) shown[0] = { ...shown[0], key: source === "directory" ? "bookedDirectory" : "bookedOnline" };
  // Finished steps in the order they happened, then what is still to come.
  const done = shown.filter((step) => step.complete && step.at).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return [...done, ...shown.filter((step) => !(step.complete && step.at))];
}

function ActionButton({ href, children, tone = "primary" }: { href: Route; children: React.ReactNode; tone?: "primary" | "light" }) {
  return (
    <Link
      className={`pressable inline-flex min-h-11 min-w-fit items-center justify-center gap-2 rounded-full px-3 py-2 text-center font-bold leading-tight ${
        tone === "primary" ? "bg-[var(--primary)] text-white" : "border-2 border-[var(--border-strong)] bg-white text-[var(--foreground)]"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}

function SectionEmpty({ children }: { children: React.ReactNode }) {
  return <p className="empty-state text-sm">{children}</p>;
}

export default async function BookingDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ updated?: string; success?: string }> }) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const t = await getTranslations("booking");
  const tx: Tx = { say: t as unknown as Say, list: (await getTranslations("bookings")) as unknown as Say, locale: await getLocale() };
  const supabaseForVehicles = (await createSupabaseServerClient()) as any;
  // Everything this page needs is asked for together. The second group is: the handover and
  // collection forms still to do after a signed change of vehicle, an exchange waiting on the
  // other customer, the agreement and forms, and a change waiting for the customer's signature.
  let [detail, allCustomers, { data: swapForms }, { data: waitingExchange }, rentalDocuments, { data: pendingAmendment }] = await Promise.all([
    getBookingDetail(id, organization.id),
    getCustomersForSelector(organization.id),
    supabaseForVehicles
      .from("tasks")
      .select("id, title, action, vehicle_id")
      .eq("organization_id", organization.id)
      .eq("rental_id", id)
      .in("action", ["swap_handover", "swap_collection"])
      .is("completed_at", null)
      .is("deleted_at", null),
    supabaseForVehicles
      .from("rental_amendments")
      .select("id, changes")
      .eq("organization_id", organization.id)
      .eq("rental_id", id)
      .eq("status", "signed")
      .is("applied_at", null)
      .not("changes->>swap_group", "is", null)
      .limit(1)
      .maybeSingle(),
    getBookingRentalDocuments(supabaseForVehicles, organization.id, id),
    supabaseForVehicles
      .from("rental_amendments")
      .select("id, token, changes")
      .eq("organization_id", organization.id)
      .eq("rental_id", id)
      .eq("status", "awaiting_signature")
      .maybeSingle()
  ]);

  if (!detail) {
    return (
      <AppShell userEmail={userEmail}>
        <Card>
          <SectionHeader eyebrow={tx.say("nf_eyebrow")} title={tx.say("nf_title")} />
          <p className="mt-3 text-sm text-[var(--muted)]">{tx.say("nf_body")}</p>
          <Link className="primary-action pressable mt-3" href="/bookings">
            {tx.say("backToBookings")}
          </Link>
        </Card>
      </AppShell>
    );
  }

  // Opening a booking never changes it. This page used to activate rentals and
  // generate two years of rent the moment anyone viewed (or prefetched) it;
  // activation now only happens through delivery, "Skip inspection and
  // activate", or the payment schedule controls on this page.


  const { rental, bookingLink, payments, transactions, inspections, documents, activityEvents, customerPortalActions, communicationTimeline } = detail;
  // A customer a partner sent: who, and the finder's fee owed to them.
  const { data: referral } = await supabaseForVehicles
    .from("referrals")
    .select("id, fee_pct, fee_amount, fee_paid_at, from_org:organizations!referrals_from_organization_id_fkey(name, trading_name)")
    .eq("rental_id", id)
    .eq("to_organization_id", organization.id)
    .maybeSingle();
  const vehicle = rental.vehicles;
  const customer = rental.customers;
  // Giving money away (refunds, free early days, unpaid rent taken off) is the owner's or a manager's call.
  const isOwner = canDecideMoney((await getCurrentMembership())?.role);
  // Receipts customers sent stay with their payment; staff open them from the schedule.
  const receiptUrls = await signedReceiptUrls(payments.map((payment: any) => payment.metadata?.receipt?.path).filter(Boolean));
  for (const payment of payments as any[]) {
    const path = payment.metadata?.receipt?.path;
    if (path) payment.receipt_url = receiptUrls.get(path) || null;
  }
  // "Already out": recorded by the team for a rental that started before today, or one that started over a week ago.
  // A walk-in handed over today still gets the normal handover prompt.
  const startDay = rental.start_date ? String(rental.start_date).slice(0, 10) : null;
  const isRetrospective =
    Boolean(startDay && rental.entered_by_operator && startDay < businessToday()) ||
    Boolean(startDay && new Date(startDay + "T00:00:00Z") < new Date(Date.now() - 7 * 86_400_000));
  // A booking stays "booked" until the vehicle is handed over; showing it as
  // active on its start date offered "Start return" before any delivery.
  const displayStatus = rental.status;
  const upcomingPayments = detail.upcoming_payments || rental.upcoming_payments || [];
  const vehicleEvents = detail.vehicle_events || rental.vehicle_events || [];
  const activePayments = payments.filter((payment: any) => !isVoidedPayment(payment));
  const activeTransactions = transactions.filter((transaction: any) => !isVoidedTransaction(transaction));
  // Rent given back (an early return, a goodwill refund): the booking shows it beside what was paid.
  const rentGivenBack = activeTransactions
    .filter((transaction: any) => transaction.type === "refund" && !transaction.is_deposit)
    .reduce((sum: number, transaction: any) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const fallbackTotalRentalValue = activePayments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const fallbackTotalPaid = activeTransactions.filter((transaction: any) => transaction.type === "rental_income").reduce((sum: number, transaction: any) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const totalRentalValue = Number(rental.total_scheduled ?? fallbackTotalRentalValue);
  const totalPaid = Number(rental.total_paid_income ?? fallbackTotalPaid);
  const outstandingBalance = Number(rental.balance_due ?? Math.max(0, totalRentalValue - totalPaid));
  const today = businessToday();
  const nonVoidedPayments = payments.filter((p: any) => !isVoidedPayment(p));
  // Payments that were cancelled or waived are history, not money to collect.
  const isOpenPayment = (p: any) => !["paid", "cancelled", "waived", "refunded"].includes(String(p.status || ""));
  // Money is only owed once the vehicle has been handed over. Before that, what has fallen due is taken at the handover.
  const notHandedOver = String(rental.status || "").toLowerCase() === "booked";
  const atHandoverPaymentGroup = notHandedOver ? nonVoidedPayments.filter((p: any) => isOpenPayment(p) && (!p.due_date || p.due_date <= today)) : [];
  const overduePaymentGroup = notHandedOver ? [] : nonVoidedPayments.filter((p: any) => isOpenPayment(p) && p.due_date && p.due_date < today);
  const dueNowPaymentGroup = notHandedOver ? [] : nonVoidedPayments.filter((p: any) => isOpenPayment(p) && (!p.due_date || p.due_date === today));
  const upcomingPaymentGroup = nonVoidedPayments.filter((p: any) => isOpenPayment(p) && p.due_date && p.due_date > today).sort((a: any, b: any) => String(a.due_date).localeCompare(String(b.due_date)));
  // A monthly rental with no end date has rent lined up far ahead: only the next few are worth showing by default.
  const upcomingShown = upcomingPaymentGroup.slice(0, 3);
  const upcomingLater = upcomingPaymentGroup.slice(3);
  const cancelledPaymentGroup = nonVoidedPayments.filter((p: any) => ["cancelled", "waived"].includes(String(p.status || "")));
  const isCancelled = String(rental.status || "") === "cancelled";
  const isClosed = isCancelled || String(rental.status || "") === "completed";
  const paidPaymentGroup = nonVoidedPayments.filter((p: any) => p.status === "paid");
  const pendingPayment = payments.find((payment: any) => !isVoidedPayment(payment) && ["pending", "overdue"].includes(String(payment.status || "pending")));
  // After a change of vehicle a rental has forms for more than one vehicle: the handover that counts is
  // the current vehicle's, and a collection form for a vehicle given up is not the end of the rental.
  const formType = (inspection: any) => inspection.type || inspection.inspection_type;
  const onCurrentVehicle = (inspection: any) => !inspection.vehicle_id || inspection.vehicle_id === rental.vehicle_id;
  const deliveryInspection = inspections.find((inspection: any) => formType(inspection) === "delivery" && onCurrentVehicle(inspection)) || inspections.find((inspection: any) => formType(inspection) === "delivery");
  const returnInspection = inspections.find((inspection: any) => formType(inspection) === "return" && (rental.status === "completed" || onCurrentVehicle(inspection)));
  const customerDocuments = documents.filter((document: any) => document.owner_type === "customer");
  const delivery = deliveryDisplay(rental, bookingLink, tx);
  // What the customer chose on the link; failing that, how they actually paid (cash at handover, say),
  // so a paid booking never says "Payment method: Not yet selected".
  const paymentMethod =
    bookingLink?.preferred_payment_method ||
    [...(activePayments as any[])].filter((payment) => payment.status === "paid" && payment.payment_method).sort((a, b) => String(b.paid_at || b.updated_at || "").localeCompare(String(a.paid_at || a.updated_at || "")))[0]?.payment_method ||
    null;
  const paymentTiming = bookingLink?.payment_timing || null;
  const customerReportedPayment = Boolean(bookingLink?.payment_reported_by_customer);
  const paymentConfirmationAmount = Number(rental.deposit_amount || rental.rental_rate || 0);
  const confirmCustomerPaymentAction = confirmCustomerPayment.bind(null, rental.id, paymentConfirmationAmount, paymentMethod);
  const bookingPortalUrl = bookingLink?.public_url || (bookingLink?.token ? `/book/${bookingLink.token}` : null);
  const pendingPortalActions = (customerPortalActions || []).filter((action: any) => action.status === "pending");
  // A booking link that is out but not signed yet: the next step is the customer's, not a handover.
  const awaitingSignature = rental.status === "booked" && !!bookingLink && !bookingLink.contract_signed_at && !renterSignatureOf(rentalDocuments);
  const holdUntil = awaitingSignature && bookingLink?.hold_until && !bookingLink?.hold_released_at ? String(bookingLink.hold_until) : null;
  const canAdjustRental = !awaitingSignature && ["active", "booked", "due_soon", "overdue"].includes(String(rental.status || "").toLowerCase());
  const needsExistingRentalPaymentSetup = Boolean(rental.entered_by_operator) && payments.length === 0;
  const activeRentalStatus = ["active", "due_soon", "overdue", "extended"].includes(String(displayStatus || "").toLowerCase());
  // Only what is due today or earlier counts as outstanding; future scheduled rent is not owed yet.
  const pendingPaymentAmount = activePayments
    .filter((payment: any) => ["pending", "overdue", "scheduled"].includes(String(payment.status || "pending")))
    .filter((payment: any) => !payment.due_date || String(payment.due_date).slice(0, 10) <= today)
    .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const customerFormComplete = Boolean(bookingLink?.customer_details_submitted_at || ["details_submitted", "contract_signed", "completed"].includes(String(bookingLink?.status || "")));
  const paymentDueOnDeliveryAmount = Number(rental.first_payment_amount || rental.rental_rate || 0);
  const paidInAll = activePayments.filter((payment: any) => payment.status === "paid").reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  // Said apart: rent, the deposit held, and what the customer paid towards costs billed to them.
  const paidOfKind = (test: (payment: any) => boolean) =>
    activePayments.filter((payment: any) => payment.status === "paid" && test(payment)).reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const paidDeposit = paidOfKind((payment) => payment.metadata?.type === "deposit" || payment.metadata?.is_deposit === true);
  const paidCharges = paidOfKind((payment) => payment.metadata?.type === "charge");
  // Paid extras are rent income, followed on their own so the owner can see, refund or move them.
  const extras = extrasSummary(rental, payments, transactions);
  const hasExtras = extrasLines(rental).length > 0 || extras.paid > 0 || extras.open > 0;
  const financialState = (() => {
    // A finished rental with money still to hand back: that is the one thing left to do, so the
    // Billing card says it (it used to say "Paid up to date" with the deposit and unused rent unresolved).
    if (String(rental.status || "") === "completed") {
      const depositStillHeld = Math.max(0, Number(rental.deposit_held || 0) - Number(rental.deposit_refunded_amount || 0) - Number(rental.deposit_forfeited_amount || 0));
      const unsettledEarly = (payments as any[]).map((payment) => payment.metadata?.early_return).find((item) => item && !item.settled) || null;
      const unusedRent = Number(unsettledEarly?.amount || 0);
      if (depositStillHeld > 0 || unusedRent > 0) {
        const parts = [
          depositStillHeld > 0 ? tx.say("fin_backDeposit", { amount: money(depositStillHeld, rental.currency) }) : null,
          unusedRent > 0 ? tx.say("fin_backUnused", { amount: money(unusedRent, rental.currency), days: Number(unsettledEarly?.unusedDays || 0) }) : null
        ].filter(Boolean);
        return {
          label: tx.say("fin_toGiveBack"),
          detail: `${parts.join(" · ")}. ${tx.say("fin_toGiveBackHow")}`,
          amount: null as number | null,
          tone: "amber" as const
        };
      }
    }
    if (isCancelled) {
      return {
        label: tx.say("fin_cancelled"),
        detail: paidInAll > 0 ? tx.say("fin_cancelledPaid", { amount: money(paidInAll, rental.currency) }) : tx.say("fin_cancelledNothing"),
        amount: null as number | null,
        tone: paidInAll > 0 ? ("amber" as const) : ("neutral" as const)
      };
    }
    if (needsExistingRentalPaymentSetup) {
      return {
        label: tx.say("fin_setup"),
        detail: tx.say("fin_setupDetail"),
        amount: null as number | null,
        tone: "amber" as const
      };
    }
    if (String(rental.status || "").toLowerCase() === "booked" && activePayments.length === 0 && !customerFormComplete) {
      return {
        label: tx.say("fin_awaiting"),
        detail: tx.say("fin_awaitingDetail"),
        amount: null as number | null,
        tone: "neutral" as const
      };
    }
    if (paymentTiming === "on_delivery" && !activeRentalStatus && activePayments.length === 0) {
      return {
        label: tx.say("fin_atHandover"),
        detail: tx.say("fin_atHandoverDetail", { amount: money(paymentDueOnDeliveryAmount, rental.currency) }),
        amount: paymentDueOnDeliveryAmount,
        tone: "blue" as const
      };
    }
    if (pendingPayment && paymentTiming === "now" && !activeRentalStatus) {
      return {
        label: tx.say("fin_due"),
        detail: tx.say("fin_dueDetail"),
        amount: pendingPaymentAmount || outstandingBalance,
        tone: "amber" as const
      };
    }
    // Only what is due by today is outstanding: a payment agreed for later
    // (an extension due at the end of the month, say) is not owed yet.
    if (activeRentalStatus && pendingPaymentAmount > 0) {
      return {
        label: tx.say("fin_outstanding"),
        detail: tx.say("fin_outstandingActive"),
        amount: pendingPaymentAmount,
        tone: "red" as const
      };
    }
    // Booked and payments have fallen due (rent and deposit on the first day, say). Nothing is owed until the
    // vehicle goes out: it is what the handover collects. Same total as the payment list and the bookings list.
    if (!activeRentalStatus && pendingPaymentAmount > 0) {
      return {
        label: notHandedOver ? tx.say("fin_collectAtHandover") : tx.say("fin_dueNow"),
        detail: notHandedOver ? tx.say("fin_collectAtHandoverDetail") : tx.say("fin_dueNowDetail"),
        amount: pendingPaymentAmount,
        tone: notHandedOver ? ("blue" as const) : ("amber" as const)
      };
    }
    // Before handover, with money still to come: say what is coming and when,
    // rather than "paid up to date" on a booking nobody has paid for yet.
    const upcomingUnpaid = activePayments
      .filter((payment: any) => ["pending", "scheduled"].includes(String(payment.status || "pending")))
      .filter((payment: any) => payment.due_date && String(payment.due_date).slice(0, 10) > today);
    if (!activeRentalStatus && pendingPaymentAmount === 0 && upcomingUnpaid.length > 0) {
      const firstDue = upcomingUnpaid.map((payment: any) => String(payment.due_date).slice(0, 10)).sort()[0];
      const dueThen = upcomingUnpaid
        .filter((payment: any) => String(payment.due_date).slice(0, 10) === firstDue)
        .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
      return {
        label: paidInAll > 0 ? tx.say("fin_moreToCome") : tx.say("fin_nothingPaid"),
        detail: tx.say("fin_dueThen", { amount: money(dueThen, rental.currency), date: shortDate(firstDue, tx.locale) }),
        amount: null as number | null,
        tone: "neutral" as const
      };
    }
    if (activePayments.length > 0 && ((totalRentalValue > 0 && totalPaid >= totalRentalValue) || pendingPaymentAmount === 0)) {
      return {
        label: tx.say("fin_upToDate"),
        detail: (() => {
          // Say what comes next, so "nothing due" never hides a payment a few days away.
          if (upcomingUnpaid.length === 0) return tx.say("fin_nothingDue");
          const nextDue = upcomingUnpaid.map((payment: any) => String(payment.due_date).slice(0, 10)).sort()[0];
          const nextAmount = upcomingUnpaid
            .filter((payment: any) => String(payment.due_date).slice(0, 10) === nextDue)
            .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
          return tx.say("fin_next", { amount: money(nextAmount, rental.currency), date: shortDate(nextDue, tx.locale) });
        })(),
        amount: null as number | null,
        tone: "green" as const
      };
    }
    // Booked, nothing scheduled yet: the schedule is written at signing, so say what the handover will
    // collect instead of asking the operator to "add a payment row".
    if (!activeRentalStatus && !isClosed && activePayments.length === 0 && outstandingBalance <= 0 && paymentDueOnDeliveryAmount > 0) {
      const depositDue = Number(rental.deposit_amount || 0);
      return {
        label: tx.say("fin_nothingDueYet"),
        detail: depositDue > 0
          ? tx.say("fin_atHandoverWithDeposit", { total: money(paymentDueOnDeliveryAmount + depositDue, rental.currency), rent: money(paymentDueOnDeliveryAmount, rental.currency), deposit: money(depositDue, rental.currency) })
          : tx.say("fin_atHandover", { rent: money(paymentDueOnDeliveryAmount, rental.currency) }),
        amount: null as number | null,
        tone: "neutral" as const
      };
    }
    return {
      label: outstandingBalance > 0 ? tx.say("fin_outstanding") : tx.say("fin_noSchedule"),
      detail: outstandingBalance > 0 ? tx.say("fin_remains") : tx.say("fin_addRow"),
      amount: outstandingBalance > 0 ? outstandingBalance : null,
      tone: outstandingBalance > 0 ? ("red" as const) : ("neutral" as const)
    };
  })();
  // The rental as a track (Look G): rent only, not the deposit or costs billed to the customer.
  const rentPaymentsAll = activePayments.filter(
    (payment: any) => !(payment.metadata?.type === "deposit" || payment.metadata?.is_deposit === true) && payment.metadata?.type !== "charge" && !["cancelled", "waived", "refunded"].includes(String(payment.status || ""))
  );
  const openRent = rentPaymentsAll.filter((payment: any) => payment.status !== "paid" && payment.due_date).sort((a: any, b: any) => String(a.due_date).localeCompare(String(b.due_date)));
  const firstOpenRent = openRent[0] || null;
  const rentAgreed = rentPaymentsAll.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const rentPaid = rentPaymentsAll.filter((payment: any) => payment.status === "paid").reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const trackEnd = rental.end_date ? String(rental.end_date).slice(0, 10) : null;
  const showTrack = !isCancelled && !!startDay && !!trackEnd && trackEnd > startDay && rentPaymentsAll.length > 0;
  const firstOpenDue = firstOpenRent ? String(firstOpenRent.due_date).slice(0, 10) : null;
  const paidTo = firstOpenDue || trackEnd;
  // Rent fallen due on a booking that hasn't gone out is taken at the handover, not owed.
  const dueOwed = !notHandedOver && !!firstOpenDue && firstOpenDue <= today;
  const dueAtHandover = notHandedOver && !!firstOpenDue && firstOpenDue <= today;
  const dueThere = firstOpenDue ? openRent.filter((payment: any) => String(payment.due_date).slice(0, 10) === firstOpenDue).reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0) : 0;
  const depositHeldNow = String(rental.deposit_status || "") === "received" && Number(rental.deposit_held || 0) > 0;
  const financialStateClass =
    financialState.tone === "green"
      ? "text-[var(--success)]"
      : financialState.tone === "red"
        ? "text-[var(--danger)]"
        : financialState.tone === "amber"
          ? "text-[var(--warning)]"
          : financialState.tone === "blue"
            ? "text-[var(--info)]"
            : "text-[var(--muted)]";

  // The tab that opens first is the one that needs a look: the customer still to finish, money owed, a deposit to settle.
  const firstTab =
    !isClosed && (!customer || (Boolean(bookingLink) && String(bookingLink?.status || "") !== "completed"))
      ? "customer"
      : overduePaymentGroup.length + dueNowPaymentGroup.length > 0 || Boolean(customerReportedPayment)
        ? "payments"
        : (payments as any[]).some((payment) => payment.metadata?.early_return && !payment.metadata.early_return.settled) ||
            (isClosed && !isCancelled && Number(rental.deposit_held || 0) - Number(rental.deposit_refunded_amount || 0) - Number(rental.deposit_forfeited_amount || 0) > 0)
          ? "deposit"
          : "overview";

  return (
    <AppShell userEmail={userEmail}>
      <OpenOnHash />
      <div className="space-y-3">
        {resolvedSearchParams.updated === "1" ? (
          <div className="rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] px-3 py-2 text-sm font-bold text-[var(--success)]">
            {tx.say("saved")}
          </div>
        ) : null}
        {resolvedSearchParams.success === "walk-in" ? (
          <div className="rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] px-3 py-2 text-sm font-bold text-[var(--success)]">
            {tx.say("walkIn", { amount: money(totalPaid || rental.rental_rate, rental.currency) })}
          </div>
        ) : null}

        {referral ? (
          <div className="rounded-lg border border-[var(--info-line)] bg-[var(--info-light)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
            {tx.say("referredBy", { partner: String(referral.from_org?.trading_name || referral.from_org?.name || "") })}{" "}
            {referral.fee_amount
              ? tx.say(referral.fee_paid_at ? "referralFeePaid" : "referralFeeOwed", { amount: money(Number(referral.fee_amount), rental.currency) })
              : tx.say("referralFeeLater", { pct: Number(referral.fee_pct || 10) })}{" "}
            <Link className="font-bold text-[var(--primary)]" href="/partners">
              {tx.say("referralOpen")}
            </Link>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--muted)]">
          <Link className="text-[var(--primary)]" href="/bookings">{tx.list("title")}</Link>
          <span>/</span>
          <span>{bookingReference(rental)}</span>
        </div>

        <Card>
          <div className="card-section flex flex-col gap-4">
            <div className="min-w-0 lg:flex lg:flex-row-reverse lg:items-center lg:gap-6">
              {vehicle ? (
                <Link aria-label={vehicleTitle(vehicle)} className="mb-3 block lg:mb-0 lg:w-[320px] lg:shrink-0" href={`/fleet/${vehicle.id}` as Route}>
                  <VehicleArt colour={(vehicle as any).color} kind={kindFromCategory((vehicle as any).vehicle_categories)} model={(vehicle as any).model} size="lg" />
                </Link>
              ) : null}
              <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(displayStatus)}>{statusLabel(String(displayStatus), tx)}</Badge>
                  {/* One badge for where the booking stands, and one more only while it waits on the customer's link. */}
                  {["booked", "draft"].includes(String(displayStatus)) && bookingLinkBadge(bookingLink?.status, tx) ? (
                    <Badge tone={bookingLinkBadge(bookingLink?.status, tx)!.tone}>{bookingLinkBadge(bookingLink?.status, tx)!.label}</Badge>
                  ) : null}
                </span>
                {/* Where the money stands, in one phrase, at the top. The reference is in the breadcrumb and the plate under Vehicle. */}
                {!awaitingSignature ? <span className={`font-bold ${financialStateClass}`}>{financialState.label}</span> : null}
              </div>
              {/* Who has it, and a picture of what they have: the vehicle in its own colour (Lagoon look). */}
              <div className="mt-3 flex items-center gap-3">
                {customer ? (
                  <span aria-hidden="true" className="num inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[18px] text-[var(--primary)]">
                    {initialsOf(customer.full_name)}
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <h1 className="text-[28px] leading-tight tracking-[-0.02em] text-[var(--foreground)] lg:text-[36px]">
                    {customer ? customer.full_name : tx.list("awaitingCustomer")}
                  </h1>
                  <p className="mt-0.5 text-[17px] font-semibold text-[var(--foreground-secondary)]">{vehicleTitle(vehicle)}</p>
                </div>
              </div>
              {awaitingSignature && holdUntil ? (
                <p className="mt-2 font-semibold text-[var(--warning)]">
                  {new Date(holdUntil).getTime() > Date.now()
                    ? tx.say("heldUntil", { when: formatDateTime(holdUntil, tx) })
                    : tx.say("holdEnded", { when: formatDateTime(holdUntil, tx) })}
                </p>
              ) : null}
              </div>
            </div>
            {/* The two numbers you check first. */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-[var(--background)] px-3.5 py-3">
                <p className="font-semibold text-[var(--muted)]">{tx.say("dates")}</p>
                <p className="mt-0.5 text-[20px] font-bold leading-tight text-[var(--foreground)]">{daysRemaining(rental.end_date, rental.status, rental.start_date, tx)}</p>
                {/* Out and back as two calendar leaves; the full dates show on hover. */}
                {rental.end_date && rental.start_date ? (
                  <div className="mt-2.5 flex items-center gap-1.5 sm:gap-2">
                    <DateLeaf date={rental.start_date} locale={tx.locale} tone={isCancelled ? "var(--muted)" : undefined} />
                    <ArrowRight aria-hidden="true" className="hidden text-[var(--muted)] sm:block" size={18} />
                    <DateLeaf date={rental.end_date} locale={tx.locale} tone={isCancelled ? "var(--muted)" : "var(--coming-back)"} />
                    <span className="sr-only">{tx.say("dateTo", { date: formatDate(rental.start_date, tx) })}</span>
                    {isCancelled || rental.status === "completed" ? null : rental.status === "booked" && !bookingLink?.contract_signed_at && !renterSignatureOf(rentalDocuments) ? (
                      <BookingDatesButton billingPeriod={String(rental.billing_interval || rental.pricing_model || "")} currentEndDate={rental.end_date} currentRate={Number(rental.rental_rate || 0)} currentStartDate={rental.start_date} customerName={customer?.full_name || tx.list("awaitingCustomerShort")} rentalId={rental.id} vehicleLabel={vehicleTitle(vehicle)} />
                    ) : (
                      <EditableEndDate currentEndDate={rental.end_date} iconOnly rentalId={rental.id} />
                    )}
                  </div>
                ) : (
                  <p className="flex flex-wrap items-center gap-1 font-medium text-[var(--foreground-secondary)]">
                    <span>{rental.end_date ? tx.say("dateTo", { date: formatDate(rental.start_date, tx) }) : tx.say("fromOpenEnded", { date: formatDate(rental.start_date, tx) })}</span>
                    <EditableEndDate currentEndDate={rental.end_date} rentalId={rental.id} />
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-[var(--background)] px-3.5 py-3">
                {/* When the big number is money owed (it can include the deposit), the tile says so instead of "Rent". */}
                <p className="font-semibold text-[var(--muted)]">{financialState.amount !== null && financialState.label ? financialState.label : tx.say("billing")}</p>
                <p className={`mt-0.5 text-[20px] font-bold leading-tight tabular-nums ${financialState.amount !== null ? financialStateClass : "text-[var(--foreground)]"}`}>
                  {financialState.amount !== null ? money(financialState.amount, rental.currency) : tx.say(`ratePer_${["daily", "weekly", "monthly"].includes(String(rental.pricing_model)) ? rental.pricing_model : "other"}`, { amount: money(rental.rental_rate, rental.currency) })}
                </p>
                <p className="font-medium text-[var(--foreground-secondary)]">{financialState.amount !== null ? tx.say(`ratePer_${["daily", "weekly", "monthly"].includes(String(rental.pricing_model)) ? rental.pricing_model : "other"}`, { amount: money(rental.rental_rate, rental.currency) }) : financialState.detail}</p>
                {!isCancelled && rentAgreed > 0 && !!rental.end_date ? (
                  <>
                    <PartBar part={rentPaid} whole={rentAgreed} />
                    <p className="mt-1 font-semibold text-[var(--foreground-secondary)]">{tx.say("paidOfTotal", { paid: money(rentPaid, rental.currency), total: money(rentAgreed, rental.currency) })}</p>
                    {rentGivenBack > 0 ? <p className="font-semibold text-[var(--foreground-secondary)]">{tx.say("givenBackLine", { amount: money(rentGivenBack, rental.currency) })}</p> : null}
                  </>
                ) : null}
                {Number(rental.extras_total || 0) > 0 ? (
                  <p className="mt-1 text-sm font-semibold text-[var(--foreground-secondary)]">
                    {tx.say("extrasPlus", { amount: money(rental.extras_total, rental.currency), names: activeExtrasLines(rental).map((line) => line.name).join(", ") || "-" })}
                  </p>
                ) : null}
                {pendingPaymentAmount > 0 && customer ? (
                  <div className="mt-2">
                    <PaymentReminderButton rentalId={rental.id} />
                  </div>
                ) : null}
              </div>
            </div>
            {showTrack ? (
              <RentalTrack
                dueOn={firstOpenDue}
                dueOwed={dueOwed}
                end={trackEnd!}
                labels={{
                  start: shortDate(startDay!, tx.locale),
                  end: shortDate(trackEnd!, tx.locale),
                  today: tx.say("track_today"),
                  paid: firstOpenDue ? (firstOpenDue > startDay! ? tx.say("track_paidTo", { date: shortDate(firstOpenDue, tx.locale) }) : null) : tx.say("track_paidAll"),
                  due: firstOpenDue ? tx.say(dueOwed ? "track_owed" : dueAtHandover ? "track_atHandover" : "track_next", { amount: money(dueThere, rental.currency), date: shortDate(firstOpenDue, tx.locale) }) : null
                }}
                paidTo={paidTo}
                start={startDay!}
                today={today}
              />
            ) : null}
            {!isCancelled && Number(rental.deposit_amount || rental.deposit_held || 0) > 0 ? (
              <div className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 ${depositHeldNow ? "bg-[var(--coming-back-light)] text-[var(--coming-back-ink)]" : "bg-[var(--background)] text-[var(--foreground)]"}`}>
                <span className="font-semibold">{tx.say("deposit")}</span>
                <span className="num text-right text-[18px]">{formatDepositSummary(rental, tx)}</span>
              </div>
            ) : null}
            {/* Two main actions side by side, More underneath: nothing wraps onto a second line. */}
            <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0 [&>a]:flex [&>a]:w-full [&>details]:col-span-2 [&>button]:w-full [&>*>button]:w-full lg:flex lg:flex-wrap lg:[&>a]:w-auto lg:[&>details]:w-auto lg:[&>details_summary]:w-auto lg:[&>button]:w-auto lg:[&>*>button]:w-auto">
              {awaitingSignature ? (
                <a className="pressable inline-flex min-h-9 min-w-fit items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white shadow-sm" href="#send-link">
                  {tx.say("sendLink")}
                </a>
              ) : null}
              {rental.status === "booked" ? (
                <ActionButton href={`/inspections/delivery/${rental.id}` as Route} tone={awaitingSignature ? "light" : "primary"}>
                  {tx.say("startHandover")}
                </ActionButton>
              ) : null}
              {["active", "due_soon", "overdue", "extended"].includes(displayStatus) ? (
                <ActionButton href={`/inspections/return/${rental.id}` as Route}>
                  {tx.say("startReturn")}
                </ActionButton>
              ) : null}
              {canAdjustRental ? (
                <RentalAdjustmentButton
                  currentEndDate={rental.end_date}
                  currentRate={Number(rental.rental_rate || 0)}
                  currentStartDate={rental.start_date}
                  customerName={customer?.full_name || tx.list("awaitingCustomerShort")}
                  label={tx.say("extendChange")}
                  rentalId={rental.id}
                  vehicleLabel={vehicleTitle(vehicle)}
                  className="pressable inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border-2 border-[var(--border-strong)] bg-white px-3 py-2 font-bold leading-tight text-[var(--foreground)]"
                />
              ) : null}
              {rental.status === "cancelled" ? (
                <UndoCancellationButton
                  rentalId={rental.id}
                  organizationId={organization.id}
                  vehicleId={String(rental.vehicle_id || vehicle?.id || "")}
                  customerName={customer?.full_name || null}
                />
              ) : null}
              {/* More sits beside the other actions; opened, it takes a row of its own for the extra buttons. */}
              <details className="basis-full lg:basis-auto lg:open:flex lg:open:basis-full lg:open:flex-wrap lg:open:items-center lg:open:gap-2">
                <summary className="pressable inline-flex min-h-11 w-full cursor-pointer list-none items-center justify-center gap-1 rounded-full border-2 border-[var(--border-strong)] bg-[var(--panel)] px-4 py-2 font-bold text-[var(--foreground)] hover:bg-[var(--panel-secondary)] [&::-webkit-details-marker]:hidden">
                  {tx.say("more")}
                </summary>
                {/* Only the buttons in this row are stretched: the cancel and change-vehicle dialogs open from inside it,
                    and stretching every button in them squeezed the dialog's heading into a sliver beside its close button. */}
                <div className="mt-2 flex flex-wrap gap-2 [&>*]:flex-1 [&>a]:w-full [&>button]:w-full [&>*>button]:w-full [&>button]:!min-h-11 [&>button]:!rounded-full [&>button]:!border-2 [&>button]:!px-4 [&>button]:!text-[15px] [&>button]:!font-bold lg:mt-0 lg:[&>*]:flex-none lg:[&>a]:w-auto lg:[&>button]:w-auto">
              <ActionButton href={`/bookings/${rental.id}/edit` as Route} tone="light">
                {tx.say("editBooking")}
              </ActionButton>
              {!["completed", "cancelled", "draft"].includes(rental.status) ? <VehicleChangeButton rentalId={rental.id} /> : null}
              {/* Damage, a fine, fuel: a cost the renter is responsible for, taken from the deposit first and the rest billed. */}
              {rental.customer_id && !["cancelled", "draft"].includes(rental.status) ? (
                <ActionButton href={`/transactions/new?cost=1&rentalId=${rental.id}&vehicleId=${rental.vehicle_id || vehicle?.id || ""}` as Route} tone="light">
                  {tx.say("addCost")}
                </ActionButton>
              ) : null}
              {!["completed", "cancelled"].includes(rental.status) ? (
                <CancelBookingButton
                  rentalId={rental.id}
                  organizationId={organization.id}
                  vehicleId={String(rental.vehicle_id || vehicle?.id || "")}
                  totalPaid={totalPaid}
                  depositHeld={Math.max(0, Number(rental.deposit_held || 0) - Number(rental.deposit_refunded_amount || 0) - Number(rental.deposit_forfeited_amount || 0))}
                  currency={rental.currency || "THB"}
                  rentalRate={Number(rental.rental_rate || 0)}
                  rentalStatus={displayStatus}
                  customerName={customer?.full_name || null}
                />
              ) : null}
                </div>
              </details>
            </div>
          </div>
        </Card>

        {customer?.do_not_rent ? (
          <div className="rounded-xl border border-[var(--danger-line)] bg-[var(--danger-light)] p-3 font-bold text-[var(--danger)]" role="alert">
            {tx.say("doNotRent", { name: customer.full_name })}
            {customer.do_not_rent_reason ? <span className="block font-semibold">{customer.do_not_rent_reason}</span> : null}
          </div>
        ) : null}

        <UnsentMessages
          customerName={customer?.full_name || tx.say("theCustomer")}
          messages={(communicationTimeline || [])
            .filter(
              (entry: any) =>
                entry.source === "communication_log" &&
                entry.type === "automated_reminder" &&
                ["pending", "failed"].includes(String(entry.status)) &&
                !!entry.metadata?.handoff_label &&
                !entry.metadata?.superseded &&
                Date.now() - new Date(entry.created_at).getTime() < 3 * 86_400_000
            )
            .slice(0, 5)
            .map((entry: any) => ({ id: entry.id, content: entry.content, url: entry.metadata?.handoff_url || null }))}
        />
        {(swapForms || []).length > 0 ? (
          <div className="scroll-mt-4 rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3" id="vehicle-change-forms">
            <p className="text-sm font-semibold text-[var(--warning)]">{tx.say("vehicleChanged", { name: customer?.full_name || tx.say("theCustomer") })}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(swapForms || []).map((form: any) => (
                <Link
                  className="pressable inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white shadow-sm"
                  href={(form.action === "swap_handover" ? `/inspections/delivery/${rental.id}?swap=1` : `/inspections/return/${rental.id}?swap=1&vehicle=${form.vehicle_id}`) as Route}
                  key={form.id}
                >
                  {form.action === "swap_handover" ? tx.say("handoverForm") : tx.say("collectionForm")}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {waitingExchange ? (
          <div className="rounded-xl border border-[var(--border)] bg-white p-3 text-sm text-[var(--foreground-secondary)]">
            {tx.say("exchangeSigned", { name: customer?.full_name || tx.say("theCustomerCap"), vehicle: waitingExchange.changes?.new_vehicle_label || tx.say("otherVehicle") })}
          </div>
        ) : null}

        {pendingPortalActions.length > 0 ? (
          <div className="scroll-mt-4 rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3" id="customer-requests">
            <p className="text-sm font-semibold text-[var(--warning)]">
              {tx.say("waitingAnswer", { name: customer?.full_name || tx.say("theCustomerCap") })}
            </p>
            {/* Someone stuck at the roadside wants a phone call, not a typed reply. */}
            {customer?.phone && pendingPortalActions.some((action: any) => action.action_type === "problem_report") ? (
              <a className="pressable mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" href={`tel:${String(customer.phone).replace(/\s+/g, "")}`}>
                {tx.say("cp_call", { number: String(customer.phone) })}
              </a>
            ) : null}
            <div className="mt-3 space-y-3">
              {pendingPortalActions.map((action: any) => (
                <CustomerPortalActionCard action={action} customerId={customer?.id || null} key={action.id} organizationId={organization.id} rentalId={rental.id} vehicleId={rental.vehicle_id || vehicle?.id || null} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Mileage moved under Vehicle and the customer's details under Customer; the header carries the two numbers that matter. */}

        <PageTabs
          aliases={{ "send-link": "customer", "booking-link": "customer", amendment: "overview" }}
          initial={firstTab}
          label={tx.say("tab_label")}
          tabs={[
            {
              id: "overview",
              label: tx.say("tab_overview"),
              content: (
                <div className="grid items-start gap-3 lg:grid-cols-2">
                  <div className="grid gap-3">
            <Pane title={tx.say("inspTitle")}>
              <div className="grid gap-3 sm:grid-cols-2">
                {deliveryInspection ? (
                  <InspectionStatus label={tx.say("handoverForm")} inspection={deliveryInspection} href={`/inspections/delivery/${rental.id}` as Route} available={false} />
                ) : isRetrospective && rental.status === "booked" ? (
                  // Retrospective, not yet activated: equal-weight options
                  <div className="sub-surface space-y-3 p-3">
                    <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                      <AlertTriangle className="text-[var(--warning)]" size={18} />
                      {tx.say("handoverForm")}
                    </div>
                    <p className="text-sm text-[var(--muted)]">
                      {tx.say("noFormOptional", { ago: startedAgoLabel(rental.start_date, tx) })}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Link
                        className="pressable flex items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-center text-sm font-bold text-[var(--foreground-secondary)]"
                        href={`/inspections/delivery/${rental.id}` as Route}
                      >
                        {tx.say("fillHandover")}
                      </Link>
                      <SkipInspectionButton canWaive={isOwner} early={earlyStartFor(rental, vehicle, businessToday())} late={lateStartFor(rental, businessToday())} rentalId={rental.id} />
                    </div>
                  </div>
                ) : isRetrospective ? (
                  // Retrospective, already active, no inspection: soft prompt
                  <div className="rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
                    <div className="flex items-center gap-2 font-semibold text-[var(--warning)]">
                      <AlertTriangle className="text-[var(--warning)]" size={18} />
                      {tx.say("noHandoverForm")}
                    </div>
                    <p className="mt-1 text-sm text-[var(--warning)]">
                      {tx.say("startedOptional", { ago: startedAgoLabel(rental.start_date, tx) })}
                    </p>
                    <Link
                      className="pressable mt-2 inline-flex items-center rounded-full border border-[var(--warning-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--warning)]"
                      href={`/inspections/delivery/${rental.id}` as Route}
                    >
                      {tx.say("fillHandoverOptional")}
                    </Link>
                  </div>
                ) : rental.status === "booked" ? (
                  // New booking: prominent start inspection + skip
                  <div className="sub-surface space-y-2 p-3">
                    <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                      <AlertTriangle className="text-[var(--warning)]" size={18} />
                      {tx.say("handoverForm")}
                    </div>
                    <Link className="primary-action pressable block w-full px-3 py-2 text-center" href={`/inspections/delivery/${rental.id}` as Route}>
                      {tx.say("startHandover")}
                    </Link>
                    <SkipInspectionButton canWaive={isOwner} early={earlyStartFor(rental, vehicle, businessToday())} late={lateStartFor(rental, businessToday())} rentalId={rental.id} />
                  </div>
                ) : rental.status === "completed" ? (
                  <div className="sub-surface p-3">
                    <p className="font-semibold text-[var(--foreground)]">{tx.say("noHandoverDone")}</p>
                  </div>
                ) : isCancelled ? (
                  <div className="sub-surface p-3">
                    <p className="font-semibold text-[var(--foreground)]">{tx.say("neverHandedOver")}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{tx.say("cancelledBefore")}</p>
                  </div>
                ) : (
                  // Active, not retrospective, no inspection
                  <div className="rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
                    <div className="flex items-center gap-2 font-semibold text-[var(--warning)]">
                      <AlertTriangle className="text-[var(--warning)]" size={18} />
                      {tx.say("noHandoverForm")}
                    </div>
                    {startDay === businessToday() ? (
                      <>
                        {/* A walk-in that went out today: the customer is probably still here. */}
                        <p className="mt-1 text-sm text-[var(--warning)]">{tx.say("handoverNowHint")}</p>
                        <Link className="primary-action pressable mt-2 block w-full px-3 py-2 text-center" href={`/inspections/delivery/${rental.id}` as Route}>
                          {tx.say("startHandover")}
                        </Link>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 text-sm text-[var(--warning)]">{tx.say("wentOutWithout")}</p>
                        <Link
                          className="pressable mt-2 inline-flex items-center rounded-full border border-[var(--warning-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--warning)]"
                          href={`/inspections/delivery/${rental.id}` as Route}
                        >
                          {tx.say("fillHandoverOptional")}
                        </Link>
                      </>
                    )}
                  </div>
                )}
                {/* Before the handover there is no return to talk about: a warning sign on a form that can't be opened yet was noise. */}
                {(isCancelled && !deliveryInspection) || (rental.status === "booked" && !returnInspection) ? null : (
                  <InspectionStatus label={tx.say("returnForm")} inspection={returnInspection} href={`/inspections/return/${rental.id}` as Route} available={["active", "due_soon", "overdue", "extended"].includes(displayStatus)} />
                )}
              </div>
              {inspections.length === 0 ? (
                null
              ) : (
                <details className="mt-3">
                  <summary className="cursor-pointer py-1 text-sm font-semibold text-[var(--primary)]">
                    {tx.say("showForms", { count: inspections.length })}
                  </summary>
                  <div className="mt-3 space-y-3">
                    {inspections.map((inspection: any) => <InspectionViewer inspection={inspection} key={inspection.id} />)}
                  </div>
                </details>
              )}
            </Pane>

            {pendingAmendment ? (
          <div className="scroll-mt-4" id="amendment" />
        ) : null}
        {pendingAmendment ? (
              <PendingAmendmentCard changedAlready={Boolean(pendingAmendment.changes?.applied_before_signature)} id={pendingAmendment.id} changes={pendingAmendment.changes || {}} token={pendingAmendment.token} />
            ) : null}

                  </div>
                  <div className="grid gap-3">
            {customer ? (
              <Pane title={tx.say("commTitle")}>
                <div>
                  <CommunicationPanel
                    booking={{
                      vehicle_id: vehicle?.id || null,
                      vehicle_make_model: vehicleTitle(vehicle),
                      vehicle_plate: vehicle?.registration_number || null,
                      rental_status: rental.status,
                      end_date: rental.end_date,
                      outstanding_balance: pendingPaymentAmount,
                      deposit_held: Number(rental.deposit_held || 0)
                    }}
                    bookingPortalUrl={bookingPortalUrl}
                    businessName={organization.name || "RouteHQ"}
                    customer={{
                      id: customer.id,
                      name: customer.full_name,
                      email: customer.email,
                      phone: customer.phone,
                      whatsapp_number: customer.whatsapp_number,
                      messenger_id: customer.messenger_id,
                      line_id: customer.line_id,
                      telegram_username: customer.telegram_username,
                      instagram_handle: customer.instagram_handle,
                      preferred_contact_method: customer.preferred_contact_method
                    }}
                    customerId={customer.id}
                    hideSummary
                    organisationId={organization.id}
                    rentalId={rental.id}
                    revalidatePathname={`/bookings/${rental.id}`}
                  />
                </div>
              </Pane>
            ) : null}

            {isClosed ? null : (
            <ComingUpCard
              currency={rental.currency}
              rentalId={rental.id}
              upcomingPayments={upcomingPayments}
              vehicle={vehicle}
              vehicleEvents={vehicleEvents}
            />
            )}
                  </div>
                </div>
              )
            },
            {
              id: "payments",
              label: tx.say("tab_payments"),
              alert: overduePaymentGroup.length + dueNowPaymentGroup.length > 0 || Boolean(customerReportedPayment),
              content: (
                <div className="grid gap-3">
            <Pane
              id="payment-schedule"
              open={overduePaymentGroup.length + dueNowPaymentGroup.length + atHandoverPaymentGroup.length > 0 || (payments.length === 0 && !isClosed && !awaitingSignature)}
              summary={`${financialState.label}${financialState.amount !== null ? ` · ${money(financialState.amount, rental.currency)}` : ""}`}
              title={tx.say("payTitle")}
              tone={financialState.tone === "red" ? "red" : financialState.tone === "green" ? "green" : financialState.tone === "amber" ? "amber" : "neutral"}
            >
              <div className="space-y-3">
                {/* Every rent payment as a block, in date order: what is paid, owed, due today and still to come. */}
                <PaymentStrip
                  legend={{ paid: tx.say("strip_paid"), owed: tx.say("strip_owed"), today: tx.say(notHandedOver ? "pc_b_atHandover" : "strip_today"), later: tx.say("strip_later") }}
                  payments={[...rentPaymentsAll]
                    .filter((payment: any) => payment.due_date)
                    .sort((a: any, b: any) => String(a.due_date).localeCompare(String(b.due_date)))
                    .map((payment: any) => {
                      const due = String(payment.due_date).slice(0, 10);
                      // Before the handover nothing is owed: rent already due is taken then, so it shows as due now, not owed.
                      const state = payment.status === "paid" ? "paid" : notHandedOver ? (due <= today ? "today" : "later") : due < today ? "owed" : due === today ? "today" : "later";
                      return {
                        key: payment.id,
                        state,
                        tip: `${shortDate(due, tx.locale)} · ${money(payment.amount, rental.currency)} · ${tx.say(notHandedOver && state === "today" ? "pc_b_atHandover" : `strip_${state}`)}`
                      } as const;
                    })}
                />
                {(() => {
                  // Back early with rent unpaid (set at the return): take off the days after, or keep the booking as it was.
                  const rows = (payments as any[]).filter((payment) => payment.metadata?.early_return_owed && !payment.metadata.early_return_owed.decided && ["scheduled", "pending", "failed", "overdue"].includes(String(payment.status)));
                  if (!rows.length) return null;
                  const unused = Math.round(rows.reduce((sum, payment) => sum + Number(payment.metadata.early_return_owed.share || 0), 0) / 10) * 10;
                  return <EarlyReturnOwedPanel canDecide={isOwner} days={Number(rows[0].metadata.early_return_owed.unused_days || 0)} owed={money(pendingPaymentAmount, rental.currency)} rentalId={rental.id} unused={money(unused, rental.currency)} />;
                })()}
                <p className="text-sm text-[var(--muted)]">
                  {/* Rent and deposit are said separately: "฿0 paid so far" beside a paid deposit read as a mistake. */}
                  {t.rich(paidDeposit > 0 ? "paidLineDeposit" : "paidLine", {
                    rent: money(totalPaid, rental.currency),
                    deposit: money(paidDeposit, rental.currency),
                    b: (chunks: React.ReactNode) => <span className="font-semibold text-[var(--foreground)]">{chunks}</span>
                  })}
                  {paidCharges > 0 ? ` · ${tx.say("paidChargesLine", { amount: money(paidCharges, rental.currency) })}` : null}{" "}
                  {financialState.detail}
                </p>
                {hasExtras ? (
                  <ExtrasPanel
                    available={extras.available}
                    credited={extras.credited}
                    currency={rental.currency || "THB"}
                    lines={extrasLines(rental).map((line, index) => ({ name: line.name, amount: line.amount, index, removed: Boolean(line.removed_at) })).filter((line) => !line.removed).map(({ removed: _removed, ...line }) => line)}
                    nextRent={extras.nextRent ? `${shortDate(extras.nextRent.dueDate, tx.locale)} · ${money(extras.nextRent.amount, rental.currency)}` : null}
                    open={extras.open}
                    openOwn={extras.openOwn}
                    organizationId={organization.id}
                    paid={extras.paid}
                    refunded={extras.refunded}
                    removedNames={extras.removedLines.map((line) => line.name)}
                    rentalId={rental.id}
                  />
                ) : null}
                {needsExistingRentalPaymentSetup ? (
                  <ExistingRentalPaymentSetupCard
                    currency={rental.currency}
                    depositAmount={Number(rental.deposit_amount || 0)}
                    rentalId={rental.id}
                    rentalRate={Number(rental.rental_rate || 0)}
                    startDate={rental.start_date}
                  />
                ) : null}
                {awaitingSignature && payments.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">{tx.say("autoSetup")}</p>
                ) : null}
                {!isClosed && !awaitingSignature && !needsExistingRentalPaymentSetup && payments.length === 0 && outstandingBalance === 0 && totalPaid === 0 ? (
                  <div className="space-y-3 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3 text-sm font-semibold text-[var(--warning)]">
                    <p>{tx.say("noSchedule")}</p>
                    <GeneratePaymentScheduleButton rentalId={rental.id} />
                  </div>
                ) : null}
                {!needsExistingRentalPaymentSetup &&
                payments.length > 0 &&
                ["active", "due_soon", "overdue", "extended", "booked"].includes(String(displayStatus || "").toLowerCase()) &&
                overduePaymentGroup.length + dueNowPaymentGroup.length + atHandoverPaymentGroup.length + upcomingPaymentGroup.length === 0 &&
                (!rental.end_date || String(rental.end_date).slice(0, 10) > today) ? (
                  <div className="space-y-3 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3 text-sm font-semibold text-[var(--warning)]">
                    <p>{tx.say("noFuture")}</p>
                    <GeneratePaymentScheduleButton rentalId={rental.id} />
                  </div>
                ) : null}
                {payments.length === 0 && transactions.length === 0 && !awaitingSignature ? (
                  <SectionEmpty>{tx.say("noPayments")}</SectionEmpty>
                ) : null}
                {atHandoverPaymentGroup.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--info)]">{tx.say("grp_atHandover", { count: atHandoverPaymentGroup.length })}</p>
                    {atHandoverPaymentGroup.map((payment: any) => <EditableRentalPaymentRow atHandover key={payment.id} payment={payment} />)}
                  </div>
                ) : null}
                {overduePaymentGroup.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--danger)]">{tx.say("grp_overdue", { count: overduePaymentGroup.length })}</p>
                    {overduePaymentGroup.map((payment: any) => <EditableRentalPaymentRow key={payment.id} payment={payment} />)}
                  </div>
                ) : null}
                {dueNowPaymentGroup.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--warning)]">{tx.say("grp_dueNow", { count: dueNowPaymentGroup.length })}</p>
                    {dueNowPaymentGroup.map((payment: any) => <EditableRentalPaymentRow key={payment.id} payment={payment} />)}
                  </div>
                ) : null}
                {upcomingPaymentGroup.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--foreground)]">
                      {upcomingLater.length > 0
                        ? tx.say("grp_upcomingSome", { shown: upcomingShown.length, total: upcomingPaymentGroup.length })
                        : tx.say("grp_upcoming", { count: upcomingPaymentGroup.length })}
                    </summary>
                    <div className="mt-2 space-y-1">
                      {upcomingShown.map((payment: any) => <EditableRentalPaymentRow key={payment.id} payment={payment} />)}
                      {upcomingLater.length > 0 ? (
                        <details>
                          <summary className="cursor-pointer py-1 text-[13px] font-semibold text-[var(--primary)]">
                            {tx.say("showLater", { count: upcomingLater.length })}
                          </summary>
                          <div className="mt-1 space-y-1">
                            {upcomingLater.map((payment: any) => <EditableRentalPaymentRow key={payment.id} payment={payment} />)}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </details>
                ) : null}
                {cancelledPaymentGroup.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--foreground)]">
                      {tx.say("grp_cancelled", { count: cancelledPaymentGroup.length })}
                    </summary>
                    <div className="mt-2 space-y-1">
                      {cancelledPaymentGroup.map((payment: any) => <EditableRentalPaymentRow key={payment.id} payment={payment} />)}
                    </div>
                  </details>
                ) : null}
                {paidPaymentGroup.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--success)] hover:text-[var(--success)]">
                      {tx.say("grp_paid", { count: paidPaymentGroup.length })}
                    </summary>
                    <div className="mt-2 space-y-1">
                      {paidPaymentGroup.map((payment: any) => <EditableRentalPaymentRow key={payment.id} payment={payment} />)}
                    </div>
                  </details>
                ) : null}
                <AddRentalPaymentInlineForm currency={rental.currency} organizationId={organization.id} rentalId={rental.id} />
                {transactions.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--foreground)]">
                      {tx.say("grp_money", { count: transactions.length })}
                    </summary>
                    <div className="mt-2 space-y-3">
                      {transactions.map((transaction: any) => <EditableTransactionRow key={transaction.id} transaction={transaction} />)}
                    </div>
                  </details>
                ) : null}
              </div>
            </Pane>

                </div>
              )
            },
            {
              id: "deposit",
              label: tx.say("tab_deposit"),
              alert: (payments as any[]).some((payment) => payment.metadata?.early_return && !payment.metadata.early_return.settled),
              content: (
                <div className="grid gap-3">
            <Pane
              open={Boolean(customerReportedPayment) || (isClosed && !isCancelled && Number(rental.deposit_held || 0) - Number(rental.deposit_refunded_amount || 0) - Number(rental.deposit_forfeited_amount || 0) > 0) || (payments as any[]).some((payment) => payment.metadata?.early_return && !payment.metadata.early_return.settled)}
              summary={tx.say("vehDepSummary", { vehicle: vehicleTitle(vehicle), deposit: formatDepositSummary(rental, tx) })}
              title={tx.say("vehDepTitle")}
            >
              <div className="grid gap-2.5 sm:grid-cols-2 sm:[&>:not(.sub-info)]:col-span-2">
                <Info icon={Car} label={tx.say("vehicle")} value={`${vehicleTitle(vehicle)} / ${vehicle?.registration_number || ""}`} />
                <Info
                  icon={Gauge}
                  label={tx.say("mileage")}
                  value={
                    rental.mileage_at_delivery == null && rental.mileage_at_return != null
                      ? tx.say("kmAtReturn", { km: Number(rental.mileage_at_return).toLocaleString("en-US") })
                      : rental.mileage_at_delivery == null
                        ? isCancelled ? tx.say("neverHandedOver") : isClosed ? tx.say("notRecorded") : tx.say("recordedAtHandover")
                        : rental.mileage_at_return == null
                          ? tx.say("kmAtHandover", { km: Number(rental.mileage_at_delivery).toLocaleString("en-US") })
                          : `${tx.say("kmDriven", { km: Number(rental.km_driven ?? Number(rental.mileage_at_return) - Number(rental.mileage_at_delivery)).toLocaleString("en-US") })} · ${Number(rental.mileage_at_delivery).toLocaleString()} → ${Number(rental.mileage_at_return).toLocaleString("en-US")}`
                  }
                />
                {deliveryInspection ? (
                  <Info icon={MapPin} label={tx.say("handover")} value={tx.say("handedOver", { when: formatDateTime(deliveryInspection.submitted_at || deliveryInspection.created_at, tx) })} />
                ) : isCancelled || (rental.entered_by_operator && delivery.undecided) ? null : (
                  <DeliveryInfo delivery={delivery} />
                )}
                {isCancelled && !deliveryInspection ? null : (
                  <Info
                    icon={MapPin}
                    label={tx.say("return")}
                    value={
                      returnInspection
                        ? `${tx.say("returnedAt", { when: formatDateTime(returnInspection.submitted_at || returnInspection.created_at, tx) })}${rental.return_location ? ` · ${rental.return_location}` : ""}`
                        : rental.return_location || (rental.end_date ? tx.say("notArranged") : tx.say("noReturnDate"))
                    }
                  />
                )}
                <Info icon={CreditCard} label={tx.say("deposit")} value={(() => { const text = formatDepositSummary(rental, tx); return text.charAt(0).toUpperCase() + text.slice(1); })()} />
                <Info icon={CreditCard} label={tx.say("rentPaid")} value={rentGivenBack > 0 ? tx.say("paidLessBack", { paid: money(totalPaid, rental.currency), back: money(rentGivenBack, rental.currency) }) : money(totalPaid, rental.currency)} />
                <div className="scroll-mt-4" id="refunds" />
                <RefundDepositPanel
                  rentalId={rental.id}
                  organizationId={organization.id}
                  vehicleId={String(rental.vehicle_id || vehicle?.id || "")}
                  depositHeld={Number(rental.deposit_held || 0)}
                  depositRefunded={Number(rental.deposit_refunded_amount || 0)}
                  depositForfeited={Number(rental.deposit_forfeited_amount || 0)}
                  depositStatus={String(rental.deposit_status || "pending")}
                  totalPaid={totalPaid}
                  currency={rental.currency || "THB"}
                  rentalStatus={displayStatus}
                  canRefund={isOwner}
                  earlyReturn={(payments as any[]).map((payment) => payment.metadata?.early_return).find((item) => item && !item.settled) || null}
                />
                {paymentMethod || paymentTiming ? <PaymentInfo method={paymentMethod} timing={paymentTiming} /> : null}
                {customerReportedPayment ? (
                  <div className="rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[var(--warning)]">
                        <i aria-hidden="true" className="ti ti-alert-circle text-base" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--warning)]">{tx.say("reportedPay")}</p>
                        <p className="mt-1 text-sm text-[var(--warning)]">{tx.say("reportedAt", { when: formatDateTime(bookingLink?.payment_reported_at, tx) })}</p>
                        <form action={confirmCustomerPaymentAction} className="mt-3">
                          <PendingButton className="pressable inline-flex w-full items-center justify-center rounded-lg bg-[var(--warning)] px-3 py-2 text-sm font-semibold text-white shadow-sm" pendingLabel={tx.say("confirming")} type="submit">
                            {tx.say("confirmPay")}
                          </PendingButton>
                        </form>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </Pane>

                </div>
              )
            },
            {
              id: "customer",
              label: tx.say("tab_customer"),
              alert: !customer || customer.document_status !== "complete" || (Boolean(bookingLink) && String(bookingLink?.status || "") !== "completed" && !isClosed),
              content: (
                <div className="grid items-start gap-3 lg:grid-cols-2">
            {isCancelled && !customer ? null : (
            <Pane
              open={!customer || customer.document_status !== "complete"}
              summary={customer ? `${customer.full_name} · ${documentLabel(customer.document_status, tx)}` : tx.list("awaitingCustomer")}
              title={tx.say("custDocsTitle")}
              tone={!customer || customer.document_status !== "complete" ? "amber" : "neutral"}
            >
              {customer ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info icon={UserRound} label={tx.say("name")} value={customer?.full_name || tx.say("notRecorded")} />
                    <Info icon={UserRound} label={tx.say("phone")} value={customer?.phone || tx.say("notRecorded")} />
                    <Info icon={UserRound} label={tx.say("email")} value={customer?.email || tx.say("notRecorded")} />
                    <Info icon={FileText} label={tx.say("documents")} value={documentLabel(customer?.document_status, tx)} danger={customer?.document_status !== "complete"} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {["passport", "driver_license", "selfie"].map((category) => {
                      const found = customerDocuments.some((document: any) => document.category === category);
                      return (
                        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white p-3" key={category}>
                          {found ? <CheckCircle2 className="text-[var(--success)]" size={18} /> : <AlertTriangle className="text-[var(--warning)]" size={18} />}
                          <span className="text-sm font-bold text-[var(--foreground)]">{tx.say(`doc_${category}`)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-[var(--info-line)] bg-[var(--panel-secondary)] p-3">
                    <div className="flex items-start gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)]">
                        <Clock className="text-[var(--primary)]" size={16} />
                      </span>
                      <p className="text-sm leading-6 text-[var(--primary)]">{tx.say("awaitingBody")}</p>
                    </div>
                  </div>
                  <AssignCustomerModal
                    customers={allCustomers}
                    organizationId={organization.id}
                    rentalId={rental.id}
                  />
                </div>
              )}
            </Pane>
            )}

            <Pane
              id="booking-link"
              open={Boolean(bookingLink) && String(bookingLink?.status || "") !== "completed" && !isClosed}
              summary={!bookingLink ? tx.say("link_notCreated") : String(bookingLink.status || "") === "completed" ? tx.say("link_finished") : isCancelled ? tx.say("link_closed") : bookingLink.customer_details_submitted_at ? tx.say("link_waitingSignature") : tx.say("link_waiting")}
              title={tx.say("linkTitle")}
              tone={bookingLink && String(bookingLink.status || "") !== "completed" && !isClosed ? "amber" : "neutral"}
            >
              {!bookingLink ? (
                <p className="text-sm text-[var(--muted)]">
                  {tx.say("link_teamBody")}
                </p>
              ) : null}
              {(() => {
                const steps = bookingLink ? timelineSteps(bookingLink, rentalDocuments) : [];
                if (steps.length === 0) return null;
                const allDone = steps.every((step) => step.complete);
                const list = (
                  <div className="mt-3 space-y-3">
                    {steps.map((step) => (
                      <div className="sub-surface flex items-start gap-3 p-3" key={step.key}>
                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step.complete ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--panel-secondary)] text-[var(--muted)]"}`}>
                          {step.complete ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                        </span>
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{tx.say(`step_${step.key}`)}</p>
                          <p className="text-sm text-[var(--muted)]">{step.at ? formatDateTime(step.at, tx) : tx.say("notYet")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
                // Once the customer has done everything, the steps are history: one line, open on request.
                return allDone ? (
                  <details className="mt-3">
                    <summary className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-3 text-sm font-semibold text-[var(--success)]">
                      <CheckCircle2 size={16} />
                      {(() => {
                        const last = steps.map((step) => step.at).filter(Boolean).map(String).sort().pop();
                        return last ? tx.say("allDone", { date: formatDate(last, tx) }) : tx.say("allDoneUndated");
                      })()}
                    </summary>
                    {list}
                  </details>
                ) : (
                  list
                );
              })()}
              {/* A cancelled booking's link only tells the customer it was cancelled: nothing to send. */}
              {isCancelled ? null : (
                <div className="mt-3">
                  <div className="scroll-mt-4" id="send-link" />
                <BookingShareActions currentUrl={bookingLink?.public_url || null} formDone={String(bookingLink?.status || "") === "completed"} organizationId={organization.id} rentalId={rental.id} />
                </div>
              )}
            </Pane>

                </div>
              )
            },
            {
              id: "paperwork",
              label: tx.say("tab_paperwork"),
              content: (
                <div className="grid gap-3">
            <RentalDocumentsCard documents={rentalDocuments} />

                </div>
              )
            },
            {
              id: "activity",
              label: tx.say("tab_activity"),
              content: (
                <div className="grid gap-3">
            <Pane
              summary={(communicationTimeline || []).length === 0 ? tx.say("nothingYet") : tx.say("entries", { count: (communicationTimeline || []).length })}
              title={tx.say("msgsTitle")}
            >
              <CommunicationTimeline
                customerId={customer?.id || null}
                entries={communicationTimeline || []}
                organizationId={organization.id}
                pendingActions={[]}
                hiddenActionIds={pendingPortalActions.map((action: any) => action.id)}
                rentalId={rental.id}
              />
              {/* The full history lives under the messages: one place for everything that has happened, not two rows on the page. */}
              <details className="mt-4">
                <summary className="cursor-pointer py-1 text-sm font-semibold text-[var(--primary)]">
                  {tx.say("historyTitle")} · {tx.say("entries", { count: visibleActivity(activityEvents).length })}
                </summary>
              <div className="mt-3 space-y-3">
                {visibleActivity(activityEvents).length === 0 ? (
                  <SectionEmpty>{tx.say("noActivity")}</SectionEmpty>
                ) : (
                  visibleActivity(activityEvents as any[]).map((event: any) => (
                  <div className="sub-surface p-3" key={event.id}>
                      <p className="font-semibold text-[var(--foreground)]">{activityTitle(event, tx.say as any)}</p>
                      {/* The stored detail is an English sentence: shown to English readers only. */}
                      {tx.locale === "en" && event.detail ? <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{tidyDetail(event.detail, event.title)}</p> : null}
                      <p className="mt-2 text-xs font-bold uppercase text-[var(--muted)]">{formatDateTime(event.occurred_at, tx)}</p>
                    </div>
                  ))
                )}
              </div>
              </details>
            </Pane>
                </div>
              )
            }
          ]}
        />
      </div>
    </AppShell>
  );
}

function Info({ icon: Icon, label, value, danger = false }: { icon: typeof Car; label: string; value: string; danger?: boolean }) {
  return (
    <div className="sub-info flex items-start gap-3 rounded-xl bg-[var(--panel-secondary)] px-3 py-2.5">
      <Icon className={`mt-0.5 shrink-0 ${danger ? "text-[var(--danger)]" : "text-[var(--primary)]"}`} size={18} />
      <div className="min-w-0">
        <p className="font-semibold text-[var(--muted)]">{label}</p>
        <p className={`mt-0.5 font-bold ${danger ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{value}</p>
      </div>
    </div>
  );
}

function DeliveryInfo({ delivery }: { delivery: { method: unknown; title: string; detail: string } }) {
  const tx = useTx();
  return (
    <div className="sub-surface flex items-start gap-3 p-3">
      <MapPin className="mt-0.5 shrink-0 text-[var(--primary)]" size={18} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase text-[var(--muted)]">{tx.say("delivery")}</p>
          {delivery.method === "tbd" ? <Badge tone="amber">{tx.say("toBeConfirmed")}</Badge> : null}
        </div>
        <p className="mt-1 font-semibold text-[var(--foreground)]">{delivery.title}</p>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{delivery.detail}</p>
      </div>
    </div>
  );
}

function PaymentInfo({ method, timing }: { method: string | null; timing: string | null }) {
  const tx = useTx();
  return (
    <div className="sub-surface flex items-start gap-3 p-3">
      <CreditCard className="mt-0.5 shrink-0 text-[var(--primary)]" size={18} />
      <div>
        <p className="text-xs font-bold uppercase text-[var(--muted)]">{tx.say("payment")}</p>
        <p className="mt-1 font-semibold text-[var(--foreground)]">{tx.say("payMethod", { method: formatPaymentMethod(method, tx) })}</p>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{tx.say("payTiming", { timing: formatPaymentTiming(timing, tx) })}</p>
      </div>
    </div>
  );
}

function daysUntilLabel(days: number | null | undefined, tx: Tx) {
  if (days === null || days === undefined) return tx.say("dateNotSet");
  if (days < 0) return tx.say("daysOverdue", { days: Math.abs(days) });
  if (days === 0) return tx.say("dueToday");
  if (days === 1) return tx.say("dueTomorrow");
  return tx.say("dueInDays", { days });
}

function comingUpTone(severity?: string) {
  if (severity === "high") return "border-[var(--danger-line)] bg-[var(--danger-light)] text-[var(--danger)]";
  if (severity === "medium") return "border-[var(--warning-line)] bg-[var(--warning-light)] text-[var(--warning)]";
  return "border-[var(--border)] bg-white text-[var(--foreground-secondary)]";
}

function paymentStatusTone(status?: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "overdue") return "red";
  if (status === "pending") return "amber";
  if (status === "scheduled") return "blue";
  return "neutral";
}

function eventTypeLabel(type: string | undefined, tx: Tx) {
  return tx.say(["tax", "insurance", "porbor", "service", "task"].includes(String(type || "")) ? `ev_${type}` : "ev_other");
}

function ComingUpCard({
  currency,
  rentalId,
  upcomingPayments,
  vehicle,
  vehicleEvents
}: {
  currency: string;
  rentalId: string;
  upcomingPayments: any[];
  vehicle: any;
  vehicleEvents: any[];
}) {
  const nextPayment = upcomingPayments[0] || null;
  const nextPaymentStatus = String(nextPayment?.status || "scheduled").toLowerCase();
  const showRecordPayment = nextPayment && ["pending", "overdue"].includes(nextPaymentStatus);
  const visibleEvents = vehicleEvents.slice(0, 5);
  const tx = useTx();

  // The next payment is already in Payments, just above. This row earns its place only when the
  // vehicle itself has something coming (tax, insurance, a service) during the rental.
  if (vehicleEvents.length === 0) return null;

  return (
    <Pane
      summary={nextPayment ? tx.say("nextPaySummary", { amount: money(nextPayment.amount, nextPayment.currency || currency), date: formatDate(nextPayment.due_date, tx) }) : tx.say("noPayScheduled")}
      title={tx.say("comingTitle")}
    >
      <div>
        <div className="grid gap-3 xl:grid-cols-2">
          <div className={nextPayment ? "rounded-[11px] border border-[var(--border)] bg-[var(--primary-light)] p-4" : ""}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-[var(--primary)]">{tx.say("nextPayment")}</p>
                {nextPayment ? (
                  <>
                    <p className="font-mono-data mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{money(nextPayment.amount, nextPayment.currency || currency)}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--foreground-secondary)]">
                      {formatDate(nextPayment.due_date, tx)} · {daysUntilLabel(nextPayment.days_until, tx)}
                    </p>
                  </>
                ) : (
                  <div
                    className="w-full"
                    style={{
                      background: "var(--warning-light)",
                      border: "0.5px solid var(--warning-line)",
                      borderRadius: 10,
                      padding: "14px 16px"
                    }}
                  >
                    <p style={{ fontSize: 14, fontWeight: 500, color: "var(--warning)", margin: "0 0 4px" }}>
                      {tx.say("noScheduleFound")}
                    </p>
                    <p style={{ fontSize: 14, color: "var(--warning)", margin: 0 }}>
                      {tx.say("useGenerate")}
                    </p>
                  </div>
                )}
              </div>
              {nextPayment ? <Badge tone={paymentStatusTone(nextPaymentStatus)}>{["scheduled", "pending", "overdue"].includes(nextPaymentStatus) ? tx.say(`ps_${nextPaymentStatus}`) : nextPaymentStatus}</Badge> : null}
            </div>
            {nextPayment ? (
              <div className="mt-4">
                {showRecordPayment ? (
                  <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-full bg-[var(--primary)] px-3 text-xs font-semibold text-white" href={`#record-payment-${nextPayment.id}` as Route}>
                    {tx.say("recordReceived")}
                  </Link>
                ) : (
                  <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-full border border-[var(--border)] bg-white px-3 text-xs font-semibold text-[var(--primary)]" href={"#payment-schedule" as Route}>
                    {tx.say("viewSchedule")}
                  </Link>
                )}
              </div>
            ) : null}
            {upcomingPayments.length > 1 ? (
              <div className="mt-4 space-y-2 border-t border-[var(--info-line)] pt-3">
                {upcomingPayments.slice(1, 4).map((payment: any) => (
                  <div className="flex items-center justify-between gap-3 text-xs" key={payment.id}>
                    <span className="truncate text-[var(--foreground-secondary)]">{formatDate(payment.due_date, tx)}</span>
                    <span className="font-mono-data shrink-0 font-semibold text-[var(--foreground)]">{money(payment.amount, payment.currency || currency)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[11px] border border-[var(--border)] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{tx.say("vehicleEvents")}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{vehicle?.registration_number || vehicleTitle(vehicle) || tx.say("assignedVehicle")}</p>
              </div>
              {vehicle?.id ? (
                <Link className="text-xs font-semibold text-[var(--primary)]" href={`/fleet/${vehicle.id}` as Route}>
                  {tx.say("viewVehicle")}
                </Link>
              ) : null}
            </div>
            {visibleEvents.length > 0 ? (
              <div className="space-y-2">
                {visibleEvents.map((event: any) => (
                  <div className={`rounded-lg border px-3 py-2 ${comingUpTone(event.severity)}`} key={event.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{event.label}</p>
                        <p className="mt-1 text-xs font-semibold opacity-75">{formatDate(event.due_date, tx)}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]">
                        {eventTypeLabel(event.type, tx)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold opacity-80">{daysUntilLabel(event.days_until, tx)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3 text-sm font-semibold text-[var(--muted)]">
                {tx.say("noEvents")}
              </p>
            )}
          </div>
        </div>
      </div>
    </Pane>
  );
}

function InspectionStatus({ label, inspection, href, available }: { label: string; inspection: any; href: Route; available: boolean }) {
  const tx = useTx();
  if (inspection) {
    return (
      <div className="rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-3">
        <div className="flex items-center gap-2 font-semibold text-[var(--success)]">
          <CheckCircle2 size={18} />
          {label}
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">{formatDateTime(inspection.submitted_at || inspection.created_at, tx)}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
      <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
        <Clock className="text-[var(--muted)]" size={18} />
        {label}
      </div>
      {available ? (
        <Link className="secondary-action pressable mt-3 w-full whitespace-nowrap" href={href}>
          {tx.say("startNow")}
        </Link>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">{tx.say("opensAfter")}</p>
      )}
    </div>
  );
}

function relativeTime(value: string | null | undefined, tx: Tx) {
  if (!value) return tx.say("unknownTime");
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return tx.say("justNow");
  if (diffMinutes < 60) return tx.say("minutesAgo", { count: diffMinutes });
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return tx.say("hoursAgo", { count: diffHours });
  if (diffHours < 48) return tx.say("yesterday");
  return formatDate(value, tx);
}

function communicationTypeBadge(type: string, tx: Tx) {
  const labels: Record<string, { label: string; className: string }> = {
    automated_reminder: { label: tx.say("ct_automated_reminder"), className: "border-[var(--info-line)] bg-[var(--info-light)] text-[var(--info)]" },
    manual_note: { label: tx.say("ct_manual_note"), className: "border-[var(--border)] bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]" },
    customer_portal_action: { label: tx.say("ct_customer_portal_action"), className: "border-[var(--info-line)] bg-[var(--primary-light)] text-[var(--primary)]" },
    booking_link_activity: { label: tx.say("ct_booking_link_activity"), className: "border-[var(--purple-line)] bg-[var(--purple-light)] text-[var(--purple)]" },
    operator_message: { label: tx.say("ct_operator_message"), className: "border-[var(--border)] bg-[var(--panel-tertiary)] text-[var(--foreground-secondary)]" },
    system_event: { label: tx.say("ct_system_event"), className: "border-[var(--border)] bg-white text-[var(--foreground-secondary)]" }
  };
  const config = labels[type] || { label: String(type || "Event").replace(/_/g, " "), className: "border-[var(--border)] bg-white text-[var(--foreground-secondary)]" };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[14px] font-bold ${config.className}`}>{config.label}</span>;
}

function directionIndicator(direction: string | null | undefined, tx: Tx) {
  if (direction === "outbound") return <span aria-label={tx.say("dirOut")} className="inline-flex text-[var(--primary)]" title={tx.say("dirOut")}><ArrowUpRight size={17} /></span>;
  if (direction === "inbound") return <span aria-label={tx.say("dirIn")} className="inline-flex text-[var(--primary)]" title={tx.say("dirIn")}><ArrowDownLeft size={17} /></span>;
  return null;
}

function channelIcon(channel: string | null | undefined, tx: Tx) {
  const normalized = String(channel || "").toLowerCase();
  const labels: Record<string, string> = {
    whatsapp: "WhatsApp",
    line: "LINE",
    messenger: "Messenger",
    facebook: "Messenger",
    telegram: "Telegram",
    sms: "SMS",
    email: tx.say("ch_email"),
    phone: tx.say("ch_phone"),
    booking_portal: tx.say("ch_portal")
  };
  const label = labels[normalized] || (normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1).replace(/_/g, " ") : "");
  return label ? <span className="font-semibold text-[var(--foreground-secondary)]">{label}</span> : null;
}

function communicationStatusBadge(entry: any, tx: Tx) {
  if (entry.timeline_type !== "automated_reminder" && entry.type !== "automated_reminder") return null;
  if (entry.status === "failed") return <Badge tone="red">{tx.say("cs_failed")}</Badge>;
  // No chat with this customer yet: the text is here to copy and send yourself.
  if (entry.status === "pending") return <Badge tone="amber">{tx.say("cs_pending")}</Badge>;
  return <Badge tone="green">{tx.say("cs_sent")}</Badge>;
}

function CommunicationTimeline({
  entries,
  pendingActions,
  hiddenActionIds = [],
  organizationId,
  rentalId,
  customerId
}: {
  entries: any[];
  pendingActions: any[];
  /** Requests shown at the top of the page, so not repeated in the history. */
  hiddenActionIds?: string[];
  organizationId: string;
  rentalId: string;
  customerId: string | null;
}) {
  const tx = useTx();
  const pendingIds = new Set([...(pendingActions || []).map((action: any) => action.id), ...hiddenActionIds]);
  const historyEntries = (entries || []).filter((entry: any) => !(entry.source === "customer_portal_action" && pendingIds.has(entry.id)));
  const hasHistory = pendingActions.length > 0 || historyEntries.length > 0;

  if (!hasHistory) {
    return (
      <p className="empty-state mt-3 text-sm">
        {tx.say("noComms")}
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {pendingActions.map((action: any) => (
        <div key={`pending-${action.id}`} className="rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {communicationTypeBadge("customer_portal_action", tx)}
              <Badge tone="amber">{tx.say("awaitingResponse")}</Badge>
            </div>
            <span className="font-semibold text-[var(--warning)]">{relativeTime(action.created_at, tx)}</span>
          </div>
          <p className="text-sm font-semibold text-[var(--foreground)]">{portalActionSummary(action, tx)}</p>
          <a className="mt-1 inline-block text-sm font-semibold text-[var(--primary)]" href="#customer-requests">{tx.say("answerTop")}</a>
        </div>
      ))}

      {historyEntries.map((entry: any) => (
        <div className="sub-surface p-3" key={entry.timeline_id || entry.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {communicationTypeBadge(entry.timeline_type || entry.type, tx)}
              {directionIndicator(entry.direction, tx)}
              {channelIcon(entry.channel, tx)}
              {communicationStatusBadge(entry, tx)}
            </div>
            <span className="font-semibold text-[var(--muted)]">{relativeTime(entry.created_at, tx)}</span>
          </div>
          <p className="mt-2 whitespace-pre-line [overflow-wrap:anywhere] font-semibold leading-6 text-[var(--foreground)]">{timelineText(entry, tx) || tx.say("noContent")}</p>
        </div>
      ))}
    </div>
  );
}

async function CustomerPortalActionCard({ action, organizationId, rentalId, customerId, vehicleId = null }: { action: any; organizationId: string; rentalId: string; vehicleId?: string | null; customerId: string | null }) {
  const tx: Tx = { say: (await getTranslations("booking")) as unknown as Say, list: (await getTranslations("bookings")) as unknown as Say, locale: await getLocale() };
  const content = action.content || {};
  const picture = action.action_type === "extension_request" ? await extensionPicture(createSupabaseAdminClient() as any, organizationId, rentalId, content).catch(() => null) : null;
  const alreadyCovered =
    action.action_type === "extension_request" &&
    !content.open_ended &&
    !!content.new_end_date &&
    !!picture?.currentEnd &&
    String(content.new_end_date).slice(0, 10) <= String(picture.currentEnd).slice(0, 10);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={action.action_type === "problem_report" ? "red" : action.action_type === "extension_request" ? "amber" : "blue"}>
            {["extension_request", "return_confirmation", "problem_report", "question"].includes(String(action.action_type)) ? tx.say(`req_${action.action_type}`) : String(action.action_type || "").replace(/_/g, " ")}
          </Badge>
          <p className="mt-2 font-semibold text-[var(--foreground)]">{portalActionSummary(action, tx)}</p>
          <p className="mt-1 text-xs font-bold uppercase text-[var(--muted)]">{formatDateTime(action.created_at, tx)}</p>
        </div>
      </div>
      <div className="mt-3">
        {alreadyCovered ? (
          // An older request the rental has since outgrown: nothing to approve, and no need to message the customer.
          <form action={resolvePortalAction} className="rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="actionId" type="hidden" value={action.id} />
            <input name="rentalId" type="hidden" value={rentalId} />
            <input name="notes" type="hidden" value="Already covered: the rental was extended past this date." />
            <p className="text-sm text-[var(--foreground-secondary)]">{tx.say("alreadyRuns", { date: longDate(String(picture?.currentEnd).slice(0, 10), tx.locale) })}</p>
            <PendingButton className="secondary-action pressable mt-3 px-3 py-2" pendingLabel={tx.say("clearing")} type="submit">
              {tx.say("clearRequest")}
            </PendingButton>
          </form>
        ) : action.action_type === "extension_request" ? (
          <div className="grid items-start gap-3 md:grid-cols-[1.6fr_1fr]">
            <ExtensionRequestAnswer actionId={action.id} picture={picture} rentalId={rentalId} requestedEnd={content.new_end_date || null} openEnded={!!content.open_ended} />
            <form action={declinePortalAction} className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-3">
              <input name="organizationId" type="hidden" value={organizationId} />
              <input name="actionId" type="hidden" value={action.id} />
              <input name="rentalId" type="hidden" value={rentalId} />
              <label className="block text-sm font-bold text-[var(--danger)]">
                {tx.say("reasonLabel")}
                <input className="mt-2 w-full rounded-lg border border-[var(--danger-line)] bg-white px-3 py-2 text-sm" name="note" placeholder={tx.say("reasonPlaceholder")} />
              </label>
              <PendingButton className="pressable mt-3 w-full rounded-lg border border-[var(--danger-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--danger)]" pendingLabel={tx.say("declining")} type="submit">
                {tx.say("decline")}
              </PendingButton>
            </form>
          </div>
        ) : action.action_type === "return_confirmation" ? (
          <form action={acknowledgePortalAction}>
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="actionId" type="hidden" value={action.id} />
            <input name="rentalId" type="hidden" value={rentalId} />
            <PendingButton className="primary-action pressable px-3 py-2" pendingLabel={tx.say("confirming")} type="submit">
              {tx.say("confirmToCustomer")}
            </PendingButton>
          </form>
        ) : action.action_type === "problem_report" ? (
          <form action={resolvePortalAction} className="space-y-3">
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="actionId" type="hidden" value={action.id} />
            <input name="rentalId" type="hidden" value={rentalId} />
            <textarea className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" name="reply" placeholder={tx.say("tellCustomerOptional")} rows={2} />
            <textarea className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" name="notes" placeholder={tx.say("whatYouDid")} rows={2} />
            <div className="flex flex-wrap items-center gap-2">
              <PendingButton className="primary-action pressable px-3 py-2" pendingLabel={tx.say("saving")} type="submit">
                {tx.say("markSorted")}
              </PendingButton>
              {vehicleId && ["Damage", "Breakdown", "Other mechanical issue"].includes(String(content.category || "")) ? (
                <Link className="secondary-action pressable px-3 py-2" href={`/inspections/condition/${vehicleId}` as Route}>
                  {tx.say("recordOnVehicle")}
                </Link>
              ) : null}
            </div>
          </form>
        ) : (
          <form action={replyToPortalQuestion} className="space-y-3">
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="actionId" type="hidden" value={action.id} />
            <input name="rentalId" type="hidden" value={rentalId} />
            {customerId ? <input name="customerId" type="hidden" value={customerId} /> : null}
            <textarea className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" name="reply" placeholder={tx.say("answerPlaceholder")} required />
            <PendingButton className="primary-action pressable px-3 py-2" pendingLabel={tx.say("sending")} type="submit">
              {tx.say("sendAnswer")}
            </PendingButton>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * What a line in the messages list says. Customer requests are worded from
 * their details; the app's own notes are stored as English sentences, so the
 * ones it writes are named in the reader's language.
 */
function timelineText(entry: any, tx: Tx): string {
  if (entry.source === "customer_portal_action" && entry.action) return portalActionSummary(entry.action, tx);
  const content = String(entry.content || "");
  const type = String(entry.timeline_type || entry.type || "");
  if (type !== "booking_link_activity" && type !== "system_event" && type !== "customer_portal_action") return content;
  // An extension the app applied by itself is stored as an English sentence; its figures are kept beside it.
  const meta = entry.metadata || {};
  if (meta.adjustment_type === "extension" && meta.source === "customer_request_auto") {
    if (meta.open_ended) return tx.say("tl_autoOpenEnded", { amount: money(meta.monthly_rate), date: longDate(String(meta.first_due || "").slice(0, 10), tx.locale) });
    return tx.say("tl_autoExtended", {
      date: longDate(String(meta.new_end_date || "").slice(0, 10), tx.locale),
      amount: money(meta.extension_payment_amount),
      due: longDate(String(meta.previous_end_date || "").slice(0, 10), tx.locale)
    });
  }
  // An extension staff made is stored as an English sentence too; its figures are kept beside it.
  if (meta.adjustment_type === "extension" && meta.new_end_date && meta.previous_end_date) {
    const date = longDate(String(meta.new_end_date).slice(0, 10), tx.locale);
    const was = longDate(String(meta.previous_end_date).slice(0, 10), tx.locale);
    const amount = Number(meta.extension_payment_amount || 0);
    const line = amount > 0
      ? tx.say("tl_extended", { date, was, amount: money(amount), due: longDate(String(meta.extension_payment_due_date || meta.previous_end_date).slice(0, 10), tx.locale) })
      : tx.say("tl_extendedNoPay", { date, was });
    return meta.note ? `${line} ${meta.note}` : line;
  }
  if (/^Customer opened booking link/i.test(content)) return tx.say("tl_opened");
  if (/^Customer signed the rental agreement/i.test(content)) return tx.say("tl_signed");
  if (/^Customer signed an amendment/i.test(content)) return tx.say("tl_signedChange");
  if (/^Customer (submitted|completed) (their )?details/i.test(content)) return tx.say("tl_details");
  const extension = content.match(/^Customer requested (?:an )?extension to (\d{4}-\d{2}-\d{2})/i);
  if (extension) return tx.say("tl_askedUntil", { date: longDate(extension[1], tx.locale) });
  if (/^Customer reported a problem/i.test(content)) return tx.say("tl_problem");
  return content;
}

function portalActionSummary(action: any, tx: Tx) {
  const content = action.content || {};
  if (action.action_type === "extension_request") {
    const asked = content.open_ended
      ? tx.say("sum_openEnded")
      : content.new_end_date
        ? tx.say("sum_until", { date: longDate(String(content.new_end_date).slice(0, 10), tx.locale) })
        : tx.say("sum_later");
    return `${asked}${content.note ? ` - ${content.note}` : ""}`;
  }
  if (action.action_type === "return_confirmation") {
    const day = /^\d{4}-\d{2}-\d{2}/.test(String(content.return_date || "")) ? longDate(String(content.return_date).slice(0, 10), tx.locale) : String(content.return_date || "");
    const when = `${day} ${content.return_time || ""}`.trim();
    return content.return_location ? tx.say("sum_returnAt", { when, place: String(content.return_location) }) : tx.say("sum_return", { when });
  }
  if (action.action_type === "problem_report") {
    // The kind of problem is saved in English; the owner reads it in their own language.
    const kinds: Record<string, string> = { Breakdown: "pcat_breakdown", Damage: "pcat_damage", "Other mechanical issue": "pcat_mechanical", "Query about my rental": "pcat_query", Other: "pcat_other" };
    const kind = kinds[String(content.category || "")];
    return `${kind ? tx.say(kind) : content.category || tx.say("problem")}: ${content.description || tx.say("noDescription")}`;
  }
  if (action.action_type === "question") return content.question || tx.say("sum_question");
  return tx.say("sum_other");
}
