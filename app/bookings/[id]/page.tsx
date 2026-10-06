import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, CalendarDays, Car, CheckCircle2, Clock, CreditCard, FileText, Gauge, MapPin, ReceiptText, UserRound, XCircle } from "lucide-react";
import { CancelBookingButton } from "@/app/bookings/[id]/cancel-booking-button";
import { VehicleChangeButton } from "@/app/bookings/[id]/vehicle-change-button";
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
import { BookingShareActions } from "@/app/bookings/[id]/booking-share-actions";
import { RefundDepositPanel } from "@/app/bookings/[id]/refund-deposit-panel";
import { AppShell } from "@/components/app-shell";
import { AddRentalPaymentInlineForm, EditableEndDate, EditableRentalPaymentRow, EditableTransactionRow, ExistingRentalPaymentSetupCard } from "@/components/booking-correction-controls";
import { CommunicationPanel } from "@/components/communication-panel";
import { RentalAdjustmentButton } from "@/components/rental-adjustment-modal";
import { InspectionViewer } from "@/components/inspection-viewer";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, Fold, SectionHeader } from "@/components/ui";
import { OpenOnHash } from "@/components/open-on-hash";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getBookingDetail, getCustomersForSelector } from "@/lib/bookings";
import { flagForNationality } from "@/lib/customer-options";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDeliveryLocation } from "@/lib/delivery-location";
import { toWallTime, businessToday } from "@/lib/business-time";
import { signedReceiptUrls } from "@/lib/payment-receipts";
import { GeneratePaymentScheduleButton } from "@/app/bookings/[id]/generate-payment-schedule-button";
import { RentalDocumentsCard } from "@/app/bookings/[id]/rental-documents-card";
import { PendingAmendmentCard } from "@/app/bookings/[id]/pending-amendment-card";
import { amendmentRows } from "@/lib/rental-amendments";
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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return longDate(iso, tx.locale);
}

function formatDateTime(value: string | null | undefined, tx: Tx) {
  if (!value) return tx.say("notYet");
  return new Intl.DateTimeFormat(intlLocale(tx.locale), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
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

  return tx.say("dep_notCollected", { amount: money(rental?.deposit_amount, currency) });
}

function startedAgoLabel(startDate: string | null | undefined, tx: Tx): string {
  if (!startDate) return tx.say("ago_recently");
  const start = new Date(String(startDate).slice(0, 10) + "T00:00:00Z");
  const diffDays = Math.round((Date.now() - start.getTime()) / 86_400_000);
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

function documentTone(status?: string | null): "green" | "amber" | "red" {
  if (status === "complete") return "green";
  if (status === "no_documents") return "red";
  return "amber";
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
  const bookedOnline = (bookingLink?.booking_data as any)?.source === "public_page";
  const shown = steps.filter((step) => step.key !== "sent" || (!bookedOnline && (step.complete || !bookingLink?.viewed_at)));
  if (bookedOnline) shown[0] = { ...shown[0], key: "bookedOnline" };
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

function BookingMetricCard({
  icon,
  label,
  children
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="card-section flex min-h-[118px] flex-col">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
            {icon}
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
        </div>
        <div className="min-w-0 flex-1 space-y-1">{children}</div>
      </div>
    </Card>
  );
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
  const vehicle = rental.vehicles;
  const customer = rental.customers;
  // Receipts customers sent stay with their payment; staff open them from the schedule.
  const receiptUrls = await signedReceiptUrls(payments.map((payment: any) => payment.metadata?.receipt?.path).filter(Boolean));
  for (const payment of payments as any[]) {
    const path = payment.metadata?.receipt?.path;
    if (path) payment.receipt_url = receiptUrls.get(path) || null;
  }
  const isRetrospective = Boolean(rental.entered_by_operator) ||
    Boolean(rental.start_date && new Date(String(rental.start_date).slice(0, 10) + "T00:00:00Z") < new Date(Date.now() - 7 * 86_400_000));
  // A booking stays "booked" until the vehicle is handed over; showing it as
  // active on its start date offered "Start return" before any delivery.
  const displayStatus = rental.status;
  const upcomingPayments = detail.upcoming_payments || rental.upcoming_payments || [];
  const vehicleEvents = detail.vehicle_events || rental.vehicle_events || [];
  const activePayments = payments.filter((payment: any) => !isVoidedPayment(payment));
  const activeTransactions = transactions.filter((transaction: any) => !isVoidedTransaction(transaction));
  const fallbackTotalRentalValue = activePayments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const fallbackTotalPaid = activeTransactions.filter((transaction: any) => transaction.type === "rental_income").reduce((sum: number, transaction: any) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const totalRentalValue = Number(rental.total_scheduled ?? fallbackTotalRentalValue);
  const totalPaid = Number(rental.total_paid_income ?? fallbackTotalPaid);
  const outstandingBalance = Number(rental.balance_due ?? Math.max(0, totalRentalValue - totalPaid));
  const today = businessToday();
  const nonVoidedPayments = payments.filter((p: any) => !isVoidedPayment(p));
  // Payments that were cancelled or waived are history, not money to collect.
  const isOpenPayment = (p: any) => !["paid", "cancelled", "waived", "refunded"].includes(String(p.status || ""));
  const overduePaymentGroup = nonVoidedPayments.filter((p: any) => isOpenPayment(p) && p.due_date && p.due_date < today);
  const dueNowPaymentGroup = nonVoidedPayments.filter((p: any) => isOpenPayment(p) && (!p.due_date || p.due_date === today));
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
  const paymentMethod = bookingLink?.preferred_payment_method || null;
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
  const financialState = (() => {
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
    // Booked and payments have fallen due (rent and deposit on the first day, say):
    // show the same total the payment list and the bookings list show.
    if (!activeRentalStatus && pendingPaymentAmount > 0) {
      return {
        label: tx.say("fin_dueNow"),
        detail: tx.say("fin_dueNowDetail"),
        amount: pendingPaymentAmount,
        tone: "amber" as const
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
    return {
      label: outstandingBalance > 0 ? tx.say("fin_outstanding") : tx.say("fin_noSchedule"),
      detail: outstandingBalance > 0 ? tx.say("fin_remains") : tx.say("fin_addRow"),
      amount: outstandingBalance > 0 ? outstandingBalance : null,
      tone: outstandingBalance > 0 ? ("red" as const) : ("neutral" as const)
    };
  })();
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

        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--muted)]">
          <Link className="text-[var(--primary)]" href="/bookings">{tx.list("title")}</Link>
          <span>/</span>
          <span>{bookingReference(rental)}</span>
        </div>

        <Card>
          <div className="card-section flex flex-col gap-4">
            <div className="min-w-0">
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
              <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.01em] text-[var(--foreground)]">
                {customer ? customer.full_name : tx.list("awaitingCustomer")}
              </h1>
              <p className="mt-1 text-[17px] font-semibold text-[var(--foreground-secondary)]">{vehicleTitle(vehicle)}</p>
              {awaitingSignature && holdUntil ? (
                <p className="mt-2 font-semibold text-[var(--warning)]">
                  {new Date(holdUntil).getTime() > Date.now()
                    ? tx.say("heldUntil", { when: formatDateTime(holdUntil, tx) })
                    : tx.say("holdEnded", { when: formatDateTime(holdUntil, tx) })}
                </p>
              ) : null}
            </div>
            {/* The two numbers you check first. */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-[var(--background)] px-3.5 py-3">
                <p className="font-semibold text-[var(--muted)]">{tx.say("dates")}</p>
                <p className="mt-0.5 text-[20px] font-bold leading-tight text-[var(--foreground)]">{daysRemaining(rental.end_date, rental.status, rental.start_date, tx)}</p>
                <p className="flex flex-wrap items-center gap-1 font-medium text-[var(--foreground-secondary)]">
                  <span>{rental.end_date ? tx.say("dateTo", { date: formatDate(rental.start_date, tx) }) : tx.say("fromOpenEnded", { date: formatDate(rental.start_date, tx) })}</span>
                  <EditableEndDate currentEndDate={rental.end_date} rentalId={rental.id} />
                </p>
              </div>
              <div className="rounded-xl bg-[var(--background)] px-3.5 py-3">
                <p className="font-semibold text-[var(--muted)]">{tx.say("billing")}</p>
                <p className={`mt-0.5 text-[20px] font-bold leading-tight tabular-nums ${financialState.amount !== null ? financialStateClass : "text-[var(--foreground)]"}`}>
                  {financialState.amount !== null ? money(financialState.amount, rental.currency) : tx.say(`ratePer_${["daily", "weekly", "monthly"].includes(String(rental.pricing_model)) ? rental.pricing_model : "other"}`, { amount: money(rental.rental_rate, rental.currency) })}
                </p>
                <p className="font-medium text-[var(--foreground-secondary)]">{financialState.amount !== null ? tx.say(`ratePer_${["daily", "weekly", "monthly"].includes(String(rental.pricing_model)) ? rental.pricing_model : "other"}`, { amount: money(rental.rental_rate, rental.currency) }) : financialState.detail}</p>
                {pendingPaymentAmount > 0 && customer ? (
                  <div className="mt-2">
                    <PaymentReminderButton rentalId={rental.id} />
                  </div>
                ) : null}
              </div>
            </div>
            {/* Two main actions side by side, More underneath: nothing wraps onto a second line. */}
            <div className="grid grid-cols-2 gap-2 [&>*]:min-w-0 [&>a]:flex [&>a]:w-full [&>details]:col-span-2 [&_button]:w-full">
              {awaitingSignature ? (
                <a className="pressable inline-flex min-h-9 min-w-fit items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white shadow-sm" href="#send-link">
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
              <details className="basis-full">
                <summary className="pressable inline-flex min-h-11 w-full cursor-pointer list-none items-center justify-center gap-1 rounded-full bg-[var(--background)] px-4 py-2 font-bold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
                  {tx.say("more")}
                </summary>
                <div className="mt-2 flex flex-wrap gap-2 [&>*]:flex-1 [&_a]:w-full [&_button]:w-full">
              <ActionButton href={`/bookings/${rental.id}/edit` as Route} tone="light">
                {tx.say("editBooking")}
              </ActionButton>
              {!["completed", "cancelled", "draft"].includes(rental.status) ? <VehicleChangeButton rentalId={rental.id} /> : null}
              {!["completed", "cancelled"].includes(rental.status) ? (
                <CancelBookingButton
                  rentalId={rental.id}
                  organizationId={organization.id}
                  vehicleId={String(rental.vehicle_id || vehicle?.id || "")}
                  totalPaid={totalPaid}
                  depositHeld={Number(rental.deposit_held || rental.deposit_amount || 0)}
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

        {(swapForms || []).length > 0 ? (
          <div className="scroll-mt-4 rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3" id="vehicle-change-forms">
            <p className="text-sm font-semibold text-[var(--warning)]">{tx.say("vehicleChanged", { name: customer?.full_name || tx.say("theCustomer") })}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(swapForms || []).map((form: any) => (
                <Link
                  className="pressable inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white shadow-sm"
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
            <div className="mt-3 space-y-3">
              {pendingPortalActions.map((action: any) => (
                <CustomerPortalActionCard action={action} customerId={customer?.id || null} key={action.id} organizationId={organization.id} rentalId={rental.id} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Mileage moved under Vehicle and the customer's details under Customer; the header carries the two numbers that matter. */}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <div className="space-y-3">
            <Fold
              id="booking-link"
              open={Boolean(bookingLink) && String(bookingLink?.status || "") !== "completed" && !isClosed}
              summary={!bookingLink ? tx.say("link_notCreated") : String(bookingLink.status || "") === "completed" ? tx.say("link_finished") : tx.say("link_waiting")}
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
                      {tx.say("allDone", { date: formatDate(String(steps[steps.length - 1].at || ""), tx) })}
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
            </Fold>

            <Fold
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
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)]">
                        <Clock className="text-[var(--primary)]" size={16} />
                      </span>
                      <p className="font-semibold text-[var(--primary)]">{tx.list("awaitingCustomer")}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--primary)]">
                      {tx.say("awaitingBody")}
                    </p>
                  </div>
                  <AssignCustomerModal
                    customers={allCustomers}
                    organizationId={organization.id}
                    rentalId={rental.id}
                  />
                </div>
              )}
            </Fold>

            {customer ? (
              <Card>
                <SectionHeader eyebrow={tx.say("commEyebrow")} title={tx.say("commTitle")} />
                <div className="mt-3">
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
              </Card>
            ) : null}

            <Card>
              <SectionHeader eyebrow={tx.say("inspEyebrow")} title={tx.say("inspTitle")} />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                      <SkipInspectionButton rentalId={rental.id} />
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
                      className="pressable mt-2 inline-flex items-center rounded-lg border border-[var(--warning-line)] bg-white px-3 py-2 text-xs font-bold text-[var(--warning)]"
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
                    <SkipInspectionButton rentalId={rental.id} />
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
                    <p className="mt-2 text-sm text-[var(--warning)]">{tx.say("wentOutWithout")}</p>
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
            </Card>

            <Fold
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
            </Fold>

            <Fold summary={tx.say("entries", { count: activityEvents.length })} title={tx.say("historyTitle")}>
              <div className="space-y-3">
                {activityEvents.length === 0 ? (
                  <SectionEmpty>{tx.say("noActivity")}</SectionEmpty>
                ) : (
                  activityEvents.map((event: any) => (
                  <div className="sub-surface p-3" key={event.id}>
                      <p className="font-semibold text-[var(--foreground)]">{event.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{event.detail || event.event_type}</p>
                      <p className="mt-2 text-xs font-bold uppercase text-[var(--muted)]">{formatDateTime(event.occurred_at, tx)}</p>
                    </div>
                  ))
                )}
              </div>
            </Fold>
          </div>

          {/* Phones read top to bottom: money and deposit come before the paperwork. */}
          <div className="order-first space-y-3 lg:order-none">
            <Fold
              open={Boolean(customerReportedPayment) || (isClosed && !isCancelled && Number(rental.deposit_held || 0) - Number(rental.deposit_refunded_amount || 0) - Number(rental.deposit_forfeited_amount || 0) > 0) || (payments as any[]).some((payment) => payment.metadata?.early_return && !payment.metadata.early_return.settled)}
              summary={tx.say("vehDepSummary", { vehicle: vehicleTitle(vehicle), deposit: formatDepositSummary(rental, tx) })}
              title={tx.say("vehDepTitle")}
            >
              <div className="space-y-3 text-sm">
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
                          : `${tx.say("kmDriven", { km: Number(rental.km_driven ?? Number(rental.mileage_at_return) - Number(rental.mileage_at_delivery)).toLocaleString("en-US") })} · ${Number(rental.mileage_at_delivery).toLocaleString()} → ${Number(rental.mileage_at_return).toLocaleString()} km`
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
                <Info icon={CreditCard} label={tx.say("deposit")} value={formatDepositSummary(rental, tx)} />
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
                <Info icon={CreditCard} label={tx.say("rentPaid")} value={money(totalPaid, rental.currency)} />
              </div>
            </Fold>

            {pendingAmendment ? (
          <div className="scroll-mt-4" id="amendment" />
        ) : null}
        {pendingAmendment ? (
              <PendingAmendmentCard changedAlready={Boolean(pendingAmendment.changes?.applied_before_signature)} id={pendingAmendment.id} rows={amendmentRows(pendingAmendment.changes)} token={pendingAmendment.token} />
            ) : null}

            <RentalDocumentsCard documents={rentalDocuments} />

            <Fold
              id="payment-schedule"
              open={overduePaymentGroup.length + dueNowPaymentGroup.length > 0 || (payments.length === 0 && !isClosed && !awaitingSignature)}
              summary={`${financialState.label}${financialState.amount !== null ? ` · ${money(financialState.amount, rental.currency)}` : ""}`}
              title={tx.say("payTitle")}
              tone={financialState.tone === "red" ? "red" : financialState.tone === "green" ? "green" : financialState.tone === "amber" ? "amber" : "neutral"}
            >
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  {/* Rent and deposit are said separately: "฿0 paid so far" beside a paid deposit read as a mistake. */}
                  {t.rich(paidInAll - totalPaid > 0 ? "paidLineDeposit" : "paidLine", {
                    rent: money(totalPaid, rental.currency),
                    deposit: money(paidInAll - totalPaid, rental.currency),
                    b: (chunks: React.ReactNode) => <span className="font-semibold text-[var(--foreground)]">{chunks}</span>
                  })}{" "}
                  {financialState.detail}
                </p>
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
                overduePaymentGroup.length + dueNowPaymentGroup.length + upcomingPaymentGroup.length === 0 &&
                (!rental.end_date || String(rental.end_date).slice(0, 10) > today) ? (
                  <div className="space-y-3 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3 text-sm font-semibold text-[var(--warning)]">
                    <p>{tx.say("noFuture")}</p>
                    <GeneratePaymentScheduleButton rentalId={rental.id} />
                  </div>
                ) : null}
                {payments.length === 0 && transactions.length === 0 && !awaitingSignature ? (
                  <SectionEmpty>{tx.say("noPayments")}</SectionEmpty>
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
            </Fold>

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
      </div>
    </AppShell>
  );
}

function Info({ icon: Icon, label, value, danger = false }: { icon: typeof Car; label: string; value: string; danger?: boolean }) {
  return (
    <div className="sub-surface flex items-start gap-3 p-3">
      <Icon className={`mt-0.5 shrink-0 ${danger ? "text-[var(--danger)]" : "text-[var(--primary)]"}`} size={18} />
      <div>
        <p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p>
        <p className={`font-mono-data mt-1 font-semibold ${danger ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{value}</p>
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

  return (
    <Fold
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
                    <p style={{ fontSize: 13, fontWeight: 500, color: "var(--warning)", margin: "0 0 4px" }}>
                      {tx.say("noScheduleFound")}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--warning)", margin: 0 }}>
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
                  <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-white" href={`#record-payment-${nextPayment.id}` as Route}>
                    {tx.say("recordReceived")}
                  </Link>
                ) : (
                  <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-[var(--primary)]" href={"#payment-schedule" as Route}>
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
    </Fold>
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
    <div className="sub-surface p-3">
      <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
        <AlertTriangle className="text-[var(--warning)]" size={18} />
        {label}
      </div>
      {available ? (
        <Link className="primary-action pressable mt-3 px-3 py-2" href={href}>
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
    operator_message: { label: tx.say("ct_operator_message"), className: "border-[var(--border)] bg-[var(--panel-tertiary)] text-[var(--foreground-secondary)]" }
  };
  const config = labels[type] || { label: String(type || "Event").replace(/_/g, " "), className: "border-[var(--border)] bg-white text-[var(--foreground-secondary)]" };
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] ${config.className}`}>{config.label}</span>;
}

function directionIndicator(direction: string | null | undefined, tx: Tx) {
  if (direction === "outbound") return <span className="font-mono-data text-sm font-semibold text-[var(--primary)]" title={tx.say("dirOut")}>-&gt;</span>;
  if (direction === "inbound") return <span className="font-mono-data text-sm font-semibold text-[var(--primary)]" title={tx.say("dirIn")}>&lt;-</span>;
  return null;
}

function channelIcon(channel?: string | null) {
  const normalized = String(channel || "").toLowerCase();
  const labels: Record<string, string> = {
    whatsapp: "WA",
    line: "LINE",
    messenger: "MSG",
    facebook: "MSG",
    telegram: "TG",
    sms: "SMS",
    email: "MAIL",
    phone: "TEL",
    booking_portal: "PORTAL"
  };
  const label = labels[normalized] || (normalized ? normalized.slice(0, 6).toUpperCase() : "");
  return label ? <span className="rounded-full border border-[var(--border)] bg-white px-2 py-1 text-[10px] font-semibold uppercase text-[var(--muted)]">{label}</span> : null;
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
            <span className="text-xs font-bold uppercase text-[var(--warning)]">{relativeTime(action.created_at, tx)}</span>
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
              {channelIcon(entry.channel)}
              {communicationStatusBadge(entry, tx)}
            </div>
            <span className="text-xs font-bold uppercase text-[var(--muted)]">{relativeTime(entry.created_at, tx)}</span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-[var(--foreground-secondary)]">{entry.content || tx.say("noContent")}</p>
          {(entry.status === "pending" || entry.status === "failed") && entry.metadata?.handoff_label ? (
            entry.metadata?.handoff_url ? (
              <a className="pressable mt-2 inline-flex min-h-9 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-white" href={entry.metadata.handoff_url} rel="noreferrer" target="_blank">
                {entry.metadata.handoff_label}
              </a>
            ) : (
              <p className="mt-2 text-xs font-semibold text-[var(--warning)]">{entry.metadata.handoff_label}</p>
            )
          ) : null}
        </div>
      ))}
    </div>
  );
}

async function CustomerPortalActionCard({ action, organizationId, rentalId, customerId }: { action: any; organizationId: string; rentalId: string; customerId: string | null }) {
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
            <textarea className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" name="notes" placeholder={tx.say("whatYouDid")} />
            <PendingButton className="primary-action pressable px-3 py-2" pendingLabel={tx.say("saving")} type="submit">
              {tx.say("markSorted")}
            </PendingButton>
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
  if (action.action_type === "problem_report") return `${content.category || tx.say("problem")}: ${content.description || tx.say("noDescription")}`;
  if (action.action_type === "question") return content.question || tx.say("sum_question");
  return tx.say("sum_other");
}
