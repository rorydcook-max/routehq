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
import { niceDate } from "@/lib/nice-date";
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Open";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatPaymentMethod(value: string | null | undefined) {
  const labels: Record<string, string> = {
    cash: "Cash",
    promptpay: "PromptPay / QR",
    bank_transfer: "Thai Bank Transfer",
    wise: "Wise",
    revolut: "Revolut"
  };
  return value ? labels[value] || String(value).replace(/_/g, " ") : "Not yet selected";
}

function formatPaymentTiming(value: string | null | undefined) {
  if (value === "now") return "Pay now";
  if (value === "on_delivery") return "Pays at handover";
  return "—";
}

function formatDepositSummary(rental: any) {
  const status = String(rental?.deposit_status || "pending");
  const currency = rental?.currency || "THB";

  if (status === "received") {
    return money(rental?.deposit_held, currency);
  }

  if (status === "fully_returned") {
    return "Returned";
  }

  if (status === "forfeited") {
    return "Kept in full";
  }

  if (status === "partially_forfeited") {
    return Number(rental?.deposit_refunded_amount || 0) > 0
      ? `${money(rental?.deposit_refunded_amount, currency)} returned, ${money(rental?.deposit_forfeited_amount, currency)} kept`
      : `${money(rental?.deposit_forfeited_amount, currency)} kept`;
  }

  if (status === "partially_returned") {
    return `${money(rental?.deposit_refunded_amount, currency)} returned`;
  }

  return `${money(rental?.deposit_amount, currency)} - not yet collected`;
}

function startedAgoLabel(startDate: string | null | undefined): string {
  if (!startDate) return "recently";
  const start = new Date(String(startDate).slice(0, 10) + "T00:00:00Z");
  const diffDays = Math.round((Date.now() - start.getTime()) / 86_400_000);
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  const months = Math.round(diffDays / 30);
  return `${months} month${months !== 1 ? "s" : ""} ago`;
}

/** Where the customer is with their booking link, in plain words. Nothing when there is no live link. */
function bookingLinkBadge(status: string | null | undefined): { label: string; tone: "green" | "blue" | "amber" } | null {
  switch (status) {
    case "pending":
      return { label: "Link not opened yet", tone: "amber" };
    case "sent":
      return { label: "Link sent", tone: "amber" };
    case "viewed":
      return { label: "Customer opened link", tone: "blue" };
    case "details_submitted":
      return { label: "Customer details received", tone: "blue" };
    case "contract_signed":
    case "completed":
      return { label: "Customer signed", tone: "green" };
    case "expired":
      return { label: "Link expired", tone: "amber" };
    default:
      return null;
  }
}

function daysRemaining(value: string | null | undefined, status?: string | null, startDate?: string | null) {
  if (status === "completed") return "Returned";
  if (status === "cancelled") return "Cancelled";
  const today = businessToday();
  const daysFromToday = (date: string) =>
    Math.round((new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000);
  if (status === "booked" && startDate) {
    const untilStart = daysFromToday(startDate);
    if (untilStart > 0) return untilStart === 1 ? "Starts tomorrow" : `Starts in ${untilStart} days`;
    if (untilStart === 0) return "Starts today";
    return `Handover overdue by ${-untilStart} day${untilStart === -1 ? "" : "s"}`;
  }
  if (!value) {
    // The dates line already says open-ended; say how long it has been out instead.
    if (!startDate) return "";
    const out = -daysFromToday(startDate);
    return out > 0 ? `${out} day${out === 1 ? "" : "s"} so far` : "Started today";
  }
  const days = daysFromToday(value);
  if (days === 0) return "Due back today";
  if (days < 0) return `Return ${Math.abs(days)} day${days === -1 ? "" : "s"} late`;
  return `Due back in ${days} day${days === 1 ? "" : "s"}`;
}

const RENTAL_STATUS_LABELS: Record<string, string> = {
  booked: "Booked",
  active: "On rent",
  due_soon: "Due back soon",
  overdue: "Late return",
  extended: "Extended",
  completed: "Completed",
  cancelled: "Cancelled",
  draft: "Not confirmed"
};

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

function documentLabel(status?: string | null) {
  if (status === "complete") return "Documents complete";
  if (status === "no_documents") return "No documents";
  return "Missing documents";
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

function deliveryDisplay(rental: any, bookingLink: any) {
  const bookingData = (bookingLink?.booking_data || {}) as Record<string, unknown>;
  const method = normalizedDeliveryMethod(rental?.delivery_method || bookingData.delivery_method);
  const location = formatDeliveryLocation(String(bookingData.delivery_location || rental?.delivery_location || "").trim());
  const dateTime = toWallTime(bookingData.delivery_datetime || rental?.delivery_datetime || "");

  if (method === "tbd") {
    return {
      method,
      title: "Delivery method TBD",
      detail: location ? `${location} · ${dateTime ? formatDateTime(dateTime) : "Time TBD"}` : "Location and time TBD"
    };
  }

  return {
    method,
    title: method === "collection" ? "Customer collection" : "Delivery by operator",
    detail: location ? `${location} · ${dateTime ? formatDateTime(dateTime) : "Time TBD"}` : "Location and time TBD"
  };
}

function timelineSteps(bookingLink: any, rentalDocuments: BookingRentalDocument[]) {
  const renterSignature = renterSignatureOf(rentalDocuments);
  const businessSignature = businessSignatureOf(rentalDocuments);
  const steps = [
    { label: "Created", complete: Boolean(bookingLink?.created_at), at: bookingLink?.created_at },
    { label: "Sent", complete: Boolean(bookingLink?.sent_at) || ["sent", "viewed", "details_submitted", "contract_signed", "completed"].includes(bookingLink?.status), at: bookingLink?.sent_at },
    { label: "Viewed", complete: Boolean(bookingLink?.viewed_at), at: bookingLink?.viewed_at },
    { label: "Customer form submitted", complete: Boolean(bookingLink?.customer_details_submitted_at), at: bookingLink?.customer_details_submitted_at },
    { label: "Customer signed contract", complete: Boolean(renterSignature || bookingLink?.contract_signed_at), at: renterSignature?.signedAt || bookingLink?.contract_signed_at },
    { label: "Business signed contract", complete: Boolean(businessSignature), at: businessSignature?.signedAt }
  ];
  // A customer who booked online, or opened the link without it being sent from here, never had a "Sent" step.
  const bookedOnline = (bookingLink?.booking_data as any)?.source === "public_page";
  const shown = steps.filter((step) => step.label !== "Sent" || (!bookedOnline && (step.complete || !bookingLink?.viewed_at)));
  if (bookedOnline) shown[0] = { ...shown[0], label: "Booked online by the customer" };
  // Finished steps in the order they happened, then what is still to come.
  const done = shown.filter((step) => step.complete && step.at).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  return [...done, ...shown.filter((step) => !(step.complete && step.at))];
}

function ActionButton({ href, children, tone = "primary" }: { href: Route; children: React.ReactNode; tone?: "primary" | "light" }) {
  return (
    <Link
      className={`pressable inline-flex min-h-9 min-w-fit items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold shadow-sm ${
        tone === "primary" ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white text-[var(--foreground-secondary)]"
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
          <SectionHeader eyebrow="Booking not found" title="This rental could not be opened" />
          <p className="mt-3 text-sm text-[var(--muted)]">It may have been cancelled, deleted, or belong to another organisation.</p>
          <Link className="primary-action pressable mt-3" href="/bookings">
            Back to bookings
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
  const upcomingPaymentGroup = nonVoidedPayments.filter((p: any) => isOpenPayment(p) && p.due_date && p.due_date > today);
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
  const delivery = deliveryDisplay(rental, bookingLink);
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
        label: "Booking cancelled",
        detail: paidInAll > 0 ? `${money(paidInAll, rental.currency)} was paid before it was cancelled. Record any refund under Refunds & deposit.` : "Nothing was paid and nothing is owed.",
        amount: null as number | null,
        tone: paidInAll > 0 ? ("amber" as const) : ("neutral" as const)
      };
    }
    if (needsExistingRentalPaymentSetup) {
      return {
        label: "Payment setup needed",
        detail: "Set up payment records for this operator-entered rental.",
        amount: null as number | null,
        tone: "amber" as const
      };
    }
    if (String(rental.status || "").toLowerCase() === "booked" && activePayments.length === 0 && !customerFormComplete) {
      return {
        label: "Awaiting customer - no payment due yet",
        detail: "The customer has not completed the booking form.",
        amount: null as number | null,
        tone: "neutral" as const
      };
    }
    if (paymentTiming === "on_delivery" && !activeRentalStatus && activePayments.length === 0) {
      return {
        label: "To collect at handover",
        detail: `${money(paymentDueOnDeliveryAmount, rental.currency)} due when you hand the vehicle over.`,
        amount: paymentDueOnDeliveryAmount,
        tone: "blue" as const
      };
    }
    if (pendingPayment && paymentTiming === "now" && !activeRentalStatus) {
      return {
        label: "Payment due",
        detail: "Customer selected pay now. Record payment when received.",
        amount: pendingPaymentAmount || outstandingBalance,
        tone: "amber" as const
      };
    }
    // Only what is due by today is outstanding: a payment agreed for later
    // (an extension due at the end of the month, say) is not owed yet.
    if (activeRentalStatus && pendingPaymentAmount > 0) {
      return {
        label: "Outstanding balance",
        detail: "Active rental has unpaid scheduled payments.",
        amount: pendingPaymentAmount,
        tone: "red" as const
      };
    }
    // Booked and payments have fallen due (rent and deposit on the first day, say):
    // show the same total the payment list and the bookings list show.
    if (!activeRentalStatus && pendingPaymentAmount > 0) {
      return {
        label: "Due now",
        detail: "Record each payment as you receive it.",
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
        label: paidInAll > 0 ? "Paid so far - more to come" : "Nothing paid yet",
        detail: `${money(dueThen, rental.currency)} due ${new Date(`${firstDue}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`,
        amount: null as number | null,
        tone: "neutral" as const
      };
    }
    if (activePayments.length > 0 && ((totalRentalValue > 0 && totalPaid >= totalRentalValue) || pendingPaymentAmount === 0)) {
      return {
        label: "Paid up to date",
        detail: (() => {
          // Say what comes next, so "nothing due" never hides a payment a few days away.
          if (upcomingUnpaid.length === 0) return "Nothing is due right now.";
          const nextDue = upcomingUnpaid.map((payment: any) => String(payment.due_date).slice(0, 10)).sort()[0];
          const nextAmount = upcomingUnpaid
            .filter((payment: any) => String(payment.due_date).slice(0, 10) === nextDue)
            .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
          return `Next: ${money(nextAmount, rental.currency)} due ${new Date(`${nextDue}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`;
        })(),
        amount: null as number | null,
        tone: "green" as const
      };
    }
    return {
      label: outstandingBalance > 0 ? "Outstanding balance" : "No payment schedule yet",
      detail: outstandingBalance > 0 ? "Payment remains outstanding." : "Add a payment row when this rental should have a balance due.",
      amount: outstandingBalance > 0 ? outstandingBalance : null,
      tone: outstandingBalance > 0 ? ("red" as const) : ("neutral" as const)
    };
  })();
  const financialStateClass =
    financialState.tone === "green"
      ? "text-[#16a34a]"
      : financialState.tone === "red"
        ? "text-[#dc2626]"
        : financialState.tone === "amber"
          ? "text-[#d97706]"
          : financialState.tone === "blue"
            ? "text-[#2563eb]"
            : "text-[var(--muted)]";

  return (
    <AppShell userEmail={userEmail}>
      <OpenOnHash />
      <div className="space-y-3">
        {resolvedSearchParams.updated === "1" ? (
          <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm font-bold text-[#166534]">
            Booking changes saved.
          </div>
        ) : null}
        {resolvedSearchParams.success === "walk-in" ? (
          <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm font-bold text-[#166534]">
            Walk-in rental recorded. Payment of {money(totalPaid || rental.rental_rate, rental.currency)} collected.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--muted)]">
          <Link className="text-[var(--primary)]" href="/bookings">Bookings</Link>
          <span>/</span>
          <span>{bookingReference(rental)}</span>
        </div>

        <Card>
          <div className="card-section flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(displayStatus)}>{RENTAL_STATUS_LABELS[String(displayStatus)] || String(displayStatus).replace(/_/g, " ")}</Badge>
                {bookingLinkBadge(bookingLink?.status) ? (
                  <Badge tone={bookingLinkBadge(bookingLink?.status)!.tone}>{bookingLinkBadge(bookingLink?.status)!.label}</Badge>
                ) : null}
                {!customer ? <Badge tone="amber">Awaiting customer</Badge> : null}
                {rental.entered_by_operator ? <Badge tone="blue">Operator entered</Badge> : null}
                <span className="font-mono-data text-xs font-semibold uppercase text-[var(--muted)]">{bookingReference(rental)}</span>
              </div>
              <h1 className="mt-2 truncate text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                {customer ? customer.full_name : "Awaiting customer details"}
              </h1>
              <p className="mt-1 truncate text-sm font-bold text-[var(--foreground-secondary)]">{vehicleTitle(vehicle)}</p>
              <p className="font-mono-data mt-1 text-xs font-bold text-[var(--muted)]">{vehicle?.registration_number}</p>
              {awaitingSignature ? (
                <p className="mt-2 text-sm text-[var(--foreground-secondary)]">
                  Waiting for the customer to fill in the form and sign.{" "}
                  {holdUntil
                    ? new Date(holdUntil).getTime() > Date.now()
                      ? `The vehicle is held for them until ${formatDateTime(holdUntil)}; after that the dates open up, and the link still works if the vehicle is free.`
                      : `The hold ended ${formatDateTime(holdUntil)}, so the dates are open to others.`
                    : ""}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:max-w-[560px] lg:justify-end">
              {awaitingSignature ? (
                <a className="pressable inline-flex min-h-9 min-w-fit items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white shadow-sm" href="#send-link">
                  Send the link
                </a>
              ) : null}
              {rental.status === "booked" ? (
                <ActionButton href={`/inspections/delivery/${rental.id}` as Route} tone={awaitingSignature ? "light" : "primary"}>
                  Start handover
                </ActionButton>
              ) : null}
              {["active", "due_soon", "overdue", "extended"].includes(displayStatus) ? (
                <ActionButton href={`/inspections/return/${rental.id}` as Route}>
                  Start return
                </ActionButton>
              ) : null}
              {canAdjustRental ? (
                <RentalAdjustmentButton
                  currentEndDate={rental.end_date}
                  currentRate={Number(rental.rental_rate || 0)}
                  currentStartDate={rental.start_date}
                  customerName={customer?.full_name || "Awaiting customer"}
                  label="Extend / change terms"
                  rentalId={rental.id}
                  vehicleLabel={vehicleTitle(vehicle)}
                  className="pressable inline-flex min-h-9 min-w-fit items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)] shadow-sm"
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
              <details className="text-right">
                <summary className="pressable inline-flex min-h-9 cursor-pointer list-none items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)] shadow-sm">
                  More
                </summary>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
              <ActionButton href={`/bookings/${rental.id}/edit` as Route} tone="light">
                Edit booking
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
          <div className="scroll-mt-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3" id="vehicle-change-forms">
            <p className="text-sm font-semibold text-[#92400e]">The vehicle has changed. Complete these with {customer?.full_name || "the customer"}:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(swapForms || []).map((form: any) => (
                <Link
                  className="pressable inline-flex min-h-9 items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white shadow-sm"
                  href={(form.action === "swap_handover" ? `/inspections/delivery/${rental.id}?swap=1` : `/inspections/return/${rental.id}?swap=1&vehicle=${form.vehicle_id}`) as Route}
                  key={form.id}
                >
                  {form.title.split(" to ")[0].split(" from ")[0]}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {waitingExchange ? (
          <div className="rounded-xl border border-[var(--border)] bg-white p-3 text-sm text-[var(--foreground-secondary)]">
            {customer?.full_name || "The customer"} has signed the exchange for the {waitingExchange.changes?.new_vehicle_label || "other vehicle"}. It happens once the other customer has signed too.
          </div>
        ) : null}

        {pendingPortalActions.length > 0 ? (
          <div className="scroll-mt-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3" id="customer-requests">
            <p className="text-sm font-semibold text-[#92400e]">
              {customer?.full_name || "The customer"} is waiting for your answer
            </p>
            <div className="mt-3 space-y-3">
              {pendingPortalActions.map((action: any) => (
                <CustomerPortalActionCard action={action} customerId={customer?.id || null} key={action.id} organizationId={organization.id} rentalId={rental.id} />
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <BookingMetricCard icon={<CalendarDays size={18} />} label="Dates">
            <div className="flex flex-wrap items-center gap-1 text-sm font-semibold leading-5 text-[var(--foreground)]">
              <span>{rental.end_date ? `${formatDate(rental.start_date)} to` : `From ${formatDate(rental.start_date)}, open-ended`}</span>
              <EditableEndDate currentEndDate={rental.end_date} rentalId={rental.id} />
            </div>
            <p className="text-sm text-[var(--muted)]">{daysRemaining(rental.end_date, rental.status, rental.start_date)}</p>
          </BookingMetricCard>
          <BookingMetricCard icon={<CreditCard size={18} />} label="Billing">
            <p className="font-mono-data text-sm font-semibold leading-5 text-[var(--foreground)]">{money(rental.rental_rate, rental.currency)} / {({ daily: "day", weekly: "week", monthly: "month" } as Record<string, string>)[String(rental.pricing_model)] || "period"}</p>
            <p className={`text-sm font-semibold ${financialStateClass}`}>{financialState.label}</p>
            {financialState.amount !== null ? (
              <p className={`font-mono-data text-sm ${financialStateClass}`}>{money(financialState.amount, rental.currency)}</p>
            ) : (
              <p className="text-sm text-[var(--muted)]">{financialState.detail}</p>
            )}
            {pendingPaymentAmount > 0 && customer ? (
              <div className="mt-3">
                <PaymentReminderButton rentalId={rental.id} />
              </div>
            ) : null}
          </BookingMetricCard>
          <BookingMetricCard icon={<Gauge size={18} />} label="Mileage">
            {rental.mileage_at_delivery == null && rental.mileage_at_return != null ? (
              <>
                <p className="font-mono-data text-sm font-semibold leading-5 text-[var(--foreground)]">{Number(rental.mileage_at_return).toLocaleString()} km at return</p>
                <p className="text-sm text-[var(--muted)]">No reading was taken at handover</p>
              </>
            ) : rental.mileage_at_delivery == null ? (
              <>
                <p className="text-sm font-semibold leading-5 text-[var(--foreground)]">{isCancelled ? "Never handed over" : isClosed ? "Not recorded" : "Not recorded yet"}</p>
                <p className="text-sm text-[var(--muted)]">{isCancelled ? "No mileage to record" : isClosed ? "No handover form was completed" : "Recorded at handover"}</p>
              </>
            ) : rental.mileage_at_return == null ? (
              <>
                <p className="font-mono-data text-sm font-semibold leading-5 text-[var(--foreground)]">{Number(rental.mileage_at_delivery).toLocaleString()} km at handover</p>
                <p className="text-sm text-[var(--muted)]">Distance driven is worked out at return</p>
              </>
            ) : (
              <>
                <p className="font-mono-data text-sm font-semibold leading-5 text-[var(--foreground)]">{Number(rental.km_driven ?? Number(rental.mileage_at_return) - Number(rental.mileage_at_delivery)).toLocaleString()} km driven</p>
                <p className="font-mono-data text-sm text-[var(--muted)]">{Number(rental.mileage_at_delivery).toLocaleString()} → {Number(rental.mileage_at_return).toLocaleString()} km</p>
              </>
            )}
          </BookingMetricCard>
          <BookingMetricCard icon={<UserRound size={18} />} label="Customer">
            {customer ? (
              <>
                <p className="truncate text-sm font-semibold leading-5 text-[var(--foreground)]">{flagForNationality(customer.nationality)} {customer.nationality || "Nationality not set"}</p>
                <p className="text-sm text-[var(--muted)]">{customer.phone || "Phone not set"}</p>
              </>
            ) : (
              <p className="text-sm font-semibold text-[#b45309]">Awaiting details</p>
            )}
          </BookingMetricCard>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <div className="space-y-3">
            <Fold
              id="booking-link"
              open={Boolean(bookingLink) && String(bookingLink?.status || "") !== "completed" && !isClosed}
              summary={!bookingLink ? "Not created: this booking was entered by your team" : String(bookingLink.status || "") === "completed" ? "The customer has finished and signed" : "Waiting for the customer"}
              title="Customer's link"
              tone={bookingLink && String(bookingLink.status || "") !== "completed" && !isClosed ? "amber" : "neutral"}
            >
              {!bookingLink ? (
                <p className="text-sm text-[var(--muted)]">
                  This booking was entered by your team. Create a link if you want the customer to add their details and sign the agreement online.
                </p>
              ) : null}
              {(() => {
                const steps = bookingLink ? timelineSteps(bookingLink, rentalDocuments) : [];
                if (steps.length === 0) return null;
                const allDone = steps.every((step) => step.complete);
                const list = (
                  <div className="mt-3 space-y-3">
                    {steps.map((step) => (
                      <div className="sub-surface flex items-start gap-3 p-3" key={step.label}>
                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step.complete ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fbfaf8] text-[var(--muted)]"}`}>
                          {step.complete ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                        </span>
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{step.label}</p>
                          <p className="text-sm text-[var(--muted)]">{step.at ? formatDateTime(step.at) : "Not yet"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
                // Once the customer has done everything, the steps are history: one line, open on request.
                return allDone ? (
                  <details className="mt-3">
                    <summary className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-sm font-semibold text-[#166534]">
                      <CheckCircle2 size={16} />
                      The customer finished everything on {formatDate(String(steps[steps.length - 1].at || ""))}. Show the steps
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
              summary={customer ? `${customer.full_name} · ${documentLabel(customer.document_status)}` : "Awaiting customer details"}
              title="Customer and documents"
              tone={!customer || customer.document_status !== "complete" ? "amber" : "neutral"}
            >
              {customer ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info icon={UserRound} label="Name" value={customer?.full_name || "Not recorded"} />
                    <Info icon={UserRound} label="Phone" value={customer?.phone || "Not recorded"} />
                    <Info icon={UserRound} label="Email" value={customer?.email || "Not recorded"} />
                    <Info icon={FileText} label="Documents" value={documentLabel(customer?.document_status)} danger={customer?.document_status !== "complete"} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {["passport", "driver_license", "selfie"].map((category) => {
                      const found = customerDocuments.some((document: any) => document.category === category);
                      return (
                        <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white p-3" key={category}>
                          {found ? <CheckCircle2 className="text-[#16a34a]" size={18} /> : <AlertTriangle className="text-[#b7791f]" size={18} />}
                          <span className="text-sm font-bold capitalize text-[var(--foreground)]">{category.replace(/_/g, " ")}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-[#bfe0db] bg-[#fbfaf8] p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)]">
                        <Clock className="text-[var(--primary)]" size={16} />
                      </span>
                      <p className="font-semibold text-[var(--primary)]">Awaiting customer details</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#134e4a]">
                      The booking link will ask your customer to fill in their personal details, upload their passport and driving licence, and sign the rental contract. Use the share options above to send or copy the link.
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
                <SectionHeader eyebrow="Communication" title="Customer messaging" />
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
              <SectionHeader eyebrow="Inspections" title="Handover and return" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {deliveryInspection ? (
                  <InspectionStatus label="Handover form" inspection={deliveryInspection} href={`/inspections/delivery/${rental.id}` as Route} available={false} />
                ) : isRetrospective && rental.status === "booked" ? (
                  // Retrospective, not yet activated: equal-weight options
                  <div className="sub-surface space-y-3 p-3">
                    <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                      <AlertTriangle className="text-[#b7791f]" size={18} />
                      Handover form
                    </div>
                    <p className="text-sm text-[var(--muted)]">
                      No handover form on record. This rental started {startedAgoLabel(rental.start_date)}, so the form is optional.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Link
                        className="pressable flex items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-center text-sm font-bold text-[var(--foreground-secondary)]"
                        href={`/inspections/delivery/${rental.id}` as Route}
                      >
                        Fill in the handover form
                      </Link>
                      <SkipInspectionButton rentalId={rental.id} />
                    </div>
                  </div>
                ) : isRetrospective ? (
                  // Retrospective, already active, no inspection: soft prompt
                  <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
                    <div className="flex items-center gap-2 font-semibold text-[#92400e]">
                      <AlertTriangle className="text-[#b7791f]" size={18} />
                      No handover form
                    </div>
                    <p className="mt-1 text-sm text-[#b45309]">
                      Started {startedAgoLabel(rental.start_date)}. The form is optional for a rental that was already out.
                    </p>
                    <Link
                      className="pressable mt-2 inline-flex items-center rounded-lg border border-[#fde68a] bg-white px-3 py-2 text-xs font-bold text-[#92400e]"
                      href={`/inspections/delivery/${rental.id}` as Route}
                    >
                      Fill in the handover form (optional)
                    </Link>
                  </div>
                ) : rental.status === "booked" ? (
                  // New booking: prominent start inspection + skip
                  <div className="sub-surface space-y-2 p-3">
                    <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                      <AlertTriangle className="text-[#b7791f]" size={18} />
                      Handover form
                    </div>
                    <Link className="primary-action pressable block w-full px-3 py-2 text-center" href={`/inspections/delivery/${rental.id}` as Route}>
                      Start handover
                    </Link>
                    <SkipInspectionButton rentalId={rental.id} />
                  </div>
                ) : isCancelled ? (
                  <div className="sub-surface p-3">
                    <p className="font-semibold text-[var(--foreground)]">Never handed over</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">The booking was cancelled before the vehicle went out.</p>
                  </div>
                ) : (
                  // Active, not retrospective, no inspection
                  <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
                    <div className="flex items-center gap-2 font-semibold text-[#92400e]">
                      <AlertTriangle className="text-[#b7791f]" size={18} />
                      No handover form
                    </div>
                    <p className="mt-2 text-sm text-[#b45309]">The vehicle went out without a handover form.</p>
                  </div>
                )}
                {isCancelled && !deliveryInspection ? null : (
                  <InspectionStatus label="Return form" inspection={returnInspection} href={`/inspections/return/${rental.id}` as Route} available={["active", "due_soon", "overdue", "extended"].includes(displayStatus)} />
                )}
              </div>
              {inspections.length === 0 ? (
                isCancelled ? null : (
                  <div className="mt-3">
                    <SectionEmpty>No forms completed yet.</SectionEmpty>
                  </div>
                )
              ) : (
                <details className="mt-3">
                  <summary className="cursor-pointer py-1 text-sm font-semibold text-[var(--primary)]">
                    Show the {inspections.length === 1 ? "completed form" : `${inspections.length} completed forms`} (photos, fuel, signatures)
                  </summary>
                  <div className="mt-3 space-y-3">
                    {inspections.map((inspection: any) => <InspectionViewer inspection={inspection} key={inspection.id} />)}
                  </div>
                </details>
              )}
            </Card>

            <Fold
              summary={(communicationTimeline || []).length === 0 ? "Nothing yet" : `${(communicationTimeline || []).length} ${(communicationTimeline || []).length === 1 ? "entry" : "entries"}`}
              title="Messages and customer activity"
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

            <Fold summary={`${activityEvents.length} ${activityEvents.length === 1 ? "entry" : "entries"}`} title="Full history">
              <div className="space-y-3">
                {activityEvents.length === 0 ? (
                  <SectionEmpty>No activity recorded yet.</SectionEmpty>
                ) : (
                  activityEvents.map((event: any) => (
                  <div className="sub-surface p-3" key={event.id}>
                      <p className="font-semibold text-[var(--foreground)]">{event.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{event.detail || event.event_type}</p>
                      <p className="mt-2 text-xs font-bold uppercase text-[var(--muted)]">{formatDateTime(event.occurred_at)}</p>
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
              summary={`${vehicleTitle(vehicle)} · Deposit: ${formatDepositSummary(rental)}`}
              title="Vehicle, handover and deposit"
            >
              <div className="space-y-3 text-sm">
                <Info icon={Car} label="Vehicle" value={`${vehicleTitle(vehicle)} / ${vehicle?.registration_number || ""}`} />
                {deliveryInspection ? (
                  <Info icon={MapPin} label="Handover" value={`Handed over ${formatDateTime(deliveryInspection.submitted_at || deliveryInspection.created_at)}`} />
                ) : isCancelled || (rental.entered_by_operator && /TBD$/.test(delivery.detail)) ? null : (
                  <DeliveryInfo delivery={delivery} />
                )}
                {isCancelled && !deliveryInspection ? null : (
                  <Info
                    icon={MapPin}
                    label="Return"
                    value={
                      returnInspection
                        ? `Returned ${formatDateTime(returnInspection.submitted_at || returnInspection.created_at)}${rental.return_location ? ` · ${rental.return_location}` : ""}`
                        : rental.return_location || (rental.end_date ? "Not arranged yet" : "No return date: monthly, open-ended")
                    }
                  />
                )}
                <Info icon={CreditCard} label="Deposit" value={formatDepositSummary(rental)} />
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
                  <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#d97706]">
                        <i aria-hidden="true" className="ti ti-alert-circle text-base" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#92400e]">Customer has reported making payment - awaiting your confirmation</p>
                        <p className="mt-1 text-sm text-[#b45309]">Reported {formatDateTime(bookingLink?.payment_reported_at)}</p>
                        <form action={confirmCustomerPaymentAction} className="mt-3">
                          <PendingButton className="pressable inline-flex w-full items-center justify-center rounded-lg bg-[#d97706] px-3 py-2 text-sm font-semibold text-white shadow-sm" pendingLabel="Confirming..." type="submit">
                            Confirm payment received
                          </PendingButton>
                        </form>
                      </div>
                    </div>
                  </div>
                ) : null}
                <Info icon={CreditCard} label="Rent paid" value={money(totalPaid, rental.currency)} />
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
              title="Payments"
              tone={financialState.tone === "red" ? "red" : financialState.tone === "green" ? "green" : financialState.tone === "amber" ? "amber" : "neutral"}
            >
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  <span className="font-semibold text-[var(--foreground)]">{money(totalPaid, rental.currency)}</span> paid so far. {financialState.detail}
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
                  <p className="text-sm text-[var(--muted)]">The payments are set up automatically when the customer signs.</p>
                ) : null}
                {!isClosed && !awaitingSignature && !needsExistingRentalPaymentSetup && payments.length === 0 && outstandingBalance === 0 && totalPaid === 0 ? (
                  <div className="space-y-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-sm font-semibold text-[#92400e]">
                    <p>No payment schedule exists yet for this booking. Generate one from the rental rate and dates, or add a single charge.</p>
                    <GeneratePaymentScheduleButton rentalId={rental.id} />
                  </div>
                ) : null}
                {!needsExistingRentalPaymentSetup &&
                payments.length > 0 &&
                ["active", "due_soon", "overdue", "extended", "booked"].includes(String(displayStatus || "").toLowerCase()) &&
                overduePaymentGroup.length + dueNowPaymentGroup.length + upcomingPaymentGroup.length === 0 &&
                (!rental.end_date || String(rental.end_date).slice(0, 10) > today) ? (
                  <div className="space-y-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-sm font-semibold text-[#92400e]">
                    <p>No future rent is scheduled for this rental. Generate the rest of the schedule from the rental rate - payments already made are kept.</p>
                    <GeneratePaymentScheduleButton rentalId={rental.id} />
                  </div>
                ) : null}
                {payments.length === 0 && transactions.length === 0 && !awaitingSignature ? (
                  <SectionEmpty>No payments or transactions recorded yet.</SectionEmpty>
                ) : null}
                {overduePaymentGroup.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#dc2626]">Overdue — {overduePaymentGroup.length} payment{overduePaymentGroup.length !== 1 ? "s" : ""}</p>
                    {overduePaymentGroup.map((payment: any) => <EditableRentalPaymentRow key={payment.id} payment={payment} />)}
                  </div>
                ) : null}
                {dueNowPaymentGroup.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#92400e]">Due now / pending — {dueNowPaymentGroup.length} payment{dueNowPaymentGroup.length !== 1 ? "s" : ""}</p>
                    {dueNowPaymentGroup.map((payment: any) => <EditableRentalPaymentRow key={payment.id} payment={payment} />)}
                  </div>
                ) : null}
                {upcomingPaymentGroup.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--foreground)]">
                      Upcoming — {upcomingPaymentGroup.length} scheduled payment{upcomingPaymentGroup.length !== 1 ? "s" : ""}
                    </summary>
                    <div className="mt-2 space-y-1">
                      {upcomingPaymentGroup.map((payment: any) => <EditableRentalPaymentRow key={payment.id} payment={payment} />)}
                    </div>
                  </details>
                ) : null}
                {cancelledPaymentGroup.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)] hover:text-[var(--foreground)]">
                      Cancelled — {cancelledPaymentGroup.length} payment{cancelledPaymentGroup.length !== 1 ? "s" : ""} no longer due
                    </summary>
                    <div className="mt-2 space-y-1">
                      {cancelledPaymentGroup.map((payment: any) => <EditableRentalPaymentRow key={payment.id} payment={payment} />)}
                    </div>
                  </details>
                ) : null}
                {paidPaymentGroup.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.08em] text-[#16a34a] hover:text-[#166534]">
                      Paid — {paidPaymentGroup.length} payment{paidPaymentGroup.length !== 1 ? "s" : ""}
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
                      Money in and out — {transactions.length} {transactions.length === 1 ? "entry" : "entries"}
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
      <Icon className={`mt-0.5 shrink-0 ${danger ? "text-[#be123c]" : "text-[var(--primary)]"}`} size={18} />
      <div>
        <p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p>
        <p className={`font-mono-data mt-1 font-semibold ${danger ? "text-[#be123c]" : "text-[var(--foreground)]"}`}>{value}</p>
      </div>
    </div>
  );
}

function DeliveryInfo({ delivery }: { delivery: { method: unknown; title: string; detail: string } }) {
  return (
    <div className="sub-surface flex items-start gap-3 p-3">
      <MapPin className="mt-0.5 shrink-0 text-[var(--primary)]" size={18} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase text-[var(--muted)]">Delivery</p>
          {delivery.method === "tbd" ? <Badge tone="amber">To be confirmed</Badge> : null}
        </div>
        <p className="mt-1 font-semibold text-[var(--foreground)]">{delivery.title}</p>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{delivery.detail}</p>
      </div>
    </div>
  );
}

function PaymentInfo({ method, timing }: { method: string | null; timing: string | null }) {
  return (
    <div className="sub-surface flex items-start gap-3 p-3">
      <CreditCard className="mt-0.5 shrink-0 text-[var(--primary)]" size={18} />
      <div>
        <p className="text-xs font-bold uppercase text-[var(--muted)]">Payment</p>
        <p className="mt-1 font-semibold text-[var(--foreground)]">Payment method: {formatPaymentMethod(method)}</p>
        <p className="mt-1 text-sm font-semibold text-[var(--muted)]">Payment timing: {formatPaymentTiming(timing)}</p>
      </div>
    </div>
  );
}

function daysUntilLabel(days: number | null | undefined) {
  if (days === null || days === undefined) return "Date not set";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

function comingUpTone(severity?: string) {
  if (severity === "high") return "border-[#fecaca] bg-[#fef2f2] text-[#dc2626]";
  if (severity === "medium") return "border-[#fde68a] bg-[#fffbeb] text-[#d97706]";
  return "border-[var(--border)] bg-white text-[var(--foreground-secondary)]";
}

function paymentStatusTone(status?: string): "green" | "amber" | "red" | "blue" | "neutral" {
  if (status === "overdue") return "red";
  if (status === "pending") return "amber";
  if (status === "scheduled") return "blue";
  return "neutral";
}

function eventTypeLabel(type?: string) {
  const labels: Record<string, string> = {
    tax: "Tax",
    insurance: "Insurance",
    porbor: "Compulsory insurance",
    service: "Service",
    task: "Task"
  };
  return labels[String(type || "")] || "Event";
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

  return (
    <Fold
      summary={nextPayment ? `Next payment ${money(nextPayment.amount, nextPayment.currency || currency)} · ${formatDate(nextPayment.due_date)}` : "No payment scheduled"}
      title="What's coming up"
    >
      <div>
        <div className="grid gap-3 xl:grid-cols-2">
          <div className={nextPayment ? "rounded-[11px] border border-[var(--border)] bg-[var(--primary-light)] p-4" : ""}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold text-[var(--primary)]">Next payment</p>
                {nextPayment ? (
                  <>
                    <p className="font-mono-data mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">{money(nextPayment.amount, nextPayment.currency || currency)}</p>
                    <p className="mt-1 text-xs font-semibold text-[var(--foreground-secondary)]">
                      {formatDate(nextPayment.due_date)} · {daysUntilLabel(nextPayment.days_until)}
                    </p>
                  </>
                ) : (
                  <div
                    className="w-full"
                    style={{
                      background: "#fffbeb",
                      border: "0.5px solid #fde68a",
                      borderRadius: 10,
                      padding: "14px 16px"
                    }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#92400e", margin: "0 0 4px" }}>
                      No payment schedule found
                    </p>
                    <p style={{ fontSize: 12, color: "#b45309", margin: 0 }}>
                      Use &ldquo;Generate payment schedule&rdquo; in the Payment schedule section to set one up.
                    </p>
                  </div>
                )}
              </div>
              {nextPayment ? <Badge tone={paymentStatusTone(nextPaymentStatus)}>{({ scheduled: "Not due yet", pending: "Waiting to be paid", overdue: "Overdue" } as Record<string, string>)[nextPaymentStatus] || nextPaymentStatus}</Badge> : null}
            </div>
            {nextPayment ? (
              <div className="mt-4">
                {showRecordPayment ? (
                  <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-white" href={`#record-payment-${nextPayment.id}` as Route}>
                    Record payment received
                  </Link>
                ) : (
                  <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-semibold text-[var(--primary)]" href={"#payment-schedule" as Route}>
                    View payment schedule
                  </Link>
                )}
              </div>
            ) : null}
            {upcomingPayments.length > 1 ? (
              <div className="mt-4 space-y-2 border-t border-[#cfe5e1] pt-3">
                {upcomingPayments.slice(1, 4).map((payment: any) => (
                  <div className="flex items-center justify-between gap-3 text-xs" key={payment.id}>
                    <span className="truncate text-[var(--foreground-secondary)]">{formatDate(payment.due_date)}</span>
                    <span className="font-mono-data shrink-0 font-semibold text-[var(--foreground)]">{money(payment.amount, payment.currency || currency)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[11px] border border-[var(--border)] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Vehicle events</p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{vehicle?.registration_number || vehicleTitle(vehicle) || "Assigned vehicle"}</p>
              </div>
              {vehicle?.id ? (
                <Link className="text-xs font-semibold text-[var(--primary)]" href={`/fleet/${vehicle.id}` as Route}>
                  View vehicle
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
                        <p className="mt-1 text-xs font-semibold opacity-75">{formatDate(event.due_date)}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.04em]">
                        {eventTypeLabel(event.type)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold opacity-80">{daysUntilLabel(event.days_until)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3 text-sm font-semibold text-[var(--muted)]">
                No compliance dates or vehicle tasks due in the next 180 days.
              </p>
            )}
          </div>
        </div>
      </div>
    </Fold>
  );
}

function InspectionStatus({ label, inspection, href, available }: { label: string; inspection: any; href: Route; available: boolean }) {
  if (inspection) {
    return (
      <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3">
        <div className="flex items-center gap-2 font-semibold text-[#166534]">
          <CheckCircle2 size={18} />
          {label}
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">{formatDateTime(inspection.submitted_at || inspection.created_at)}</p>
      </div>
    );
  }

  return (
    <div className="sub-surface p-3">
      <div className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
        <AlertTriangle className="text-[#b7791f]" size={18} />
        {label}
      </div>
      {available ? (
        <Link className="primary-action pressable mt-3 px-3 py-2" href={href}>
          Start now
        </Link>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">Opens once the vehicle has been handed over.</p>
      )}
    </div>
  );
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffHours < 48) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function communicationTypeBadge(type: string) {
  const labels: Record<string, { label: string; className: string }> = {
    automated_reminder: { label: "Message to customer", className: "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]" },
    manual_note: { label: "Note", className: "border-[var(--border)] bg-[#fbfaf8] text-[var(--foreground-secondary)]" },
    customer_portal_action: { label: "Customer action", className: "border-[#bfe0db] bg-[var(--primary-light)] text-[var(--primary)]" },
    booking_link_activity: { label: "Booking link", className: "border-[#ddd6fe] bg-[#f5f3ff] text-[#7c3aed]" },
    operator_message: { label: "Message sent", className: "border-[var(--border)] bg-[#f1efeb] text-[var(--foreground-secondary)]" }
  };
  const config = labels[type] || { label: String(type || "Event").replace(/_/g, " "), className: "border-[var(--border)] bg-white text-[var(--foreground-secondary)]" };
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] ${config.className}`}>{config.label}</span>;
}

function directionIndicator(direction?: string | null) {
  if (direction === "outbound") return <span className="font-mono-data text-sm font-semibold text-[var(--primary)]" title="Outbound">-&gt;</span>;
  if (direction === "inbound") return <span className="font-mono-data text-sm font-semibold text-[var(--primary)]" title="Inbound">&lt;-</span>;
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

function communicationStatusBadge(entry: any) {
  if (entry.timeline_type !== "automated_reminder" && entry.type !== "automated_reminder") return null;
  if (entry.status === "failed") return <Badge tone="red">Not delivered</Badge>;
  // No chat with this customer yet: the text is here to copy and send yourself.
  if (entry.status === "pending") return <Badge tone="amber">Not sent yet: no chat with this customer</Badge>;
  return <Badge tone="green">Sent</Badge>;
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
  const pendingIds = new Set([...(pendingActions || []).map((action: any) => action.id), ...hiddenActionIds]);
  const historyEntries = (entries || []).filter((entry: any) => !(entry.source === "customer_portal_action" && pendingIds.has(entry.id)));
  const hasHistory = pendingActions.length > 0 || historyEntries.length > 0;

  if (!hasHistory) {
    return (
      <p className="empty-state mt-3 text-sm">
        No communication history yet. Messages sent via RouteHQ and customer portal activity will appear here.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {pendingActions.map((action: any) => (
        <div key={`pending-${action.id}`} className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {communicationTypeBadge("customer_portal_action")}
              <Badge tone="amber">Awaiting response</Badge>
            </div>
            <span className="text-xs font-bold uppercase text-[#b45309]">{relativeTime(action.created_at)}</span>
          </div>
          <p className="text-sm font-semibold text-[var(--foreground)]">{portalActionSummary(action)}</p>
          <a className="mt-1 inline-block text-sm font-semibold text-[var(--primary)]" href="#customer-requests">Answer it at the top of this page</a>
        </div>
      ))}

      {historyEntries.map((entry: any) => (
        <div className="sub-surface p-3" key={entry.timeline_id || entry.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {communicationTypeBadge(entry.timeline_type || entry.type)}
              {directionIndicator(entry.direction)}
              {channelIcon(entry.channel)}
              {communicationStatusBadge(entry)}
            </div>
            <span className="text-xs font-bold uppercase text-[var(--muted)]">{relativeTime(entry.created_at)}</span>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-[var(--foreground-secondary)]">{entry.content || "No message content recorded."}</p>
          {(entry.status === "pending" || entry.status === "failed") && entry.metadata?.handoff_label ? (
            entry.metadata?.handoff_url ? (
              <a className="pressable mt-2 inline-flex min-h-9 items-center rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-white" href={entry.metadata.handoff_url} rel="noreferrer" target="_blank">
                {entry.metadata.handoff_label}
              </a>
            ) : (
              <p className="mt-2 text-xs font-semibold text-[#92400e]">{entry.metadata.handoff_label}</p>
            )
          ) : null}
        </div>
      ))}
    </div>
  );
}

async function CustomerPortalActionCard({ action, organizationId, rentalId, customerId }: { action: any; organizationId: string; rentalId: string; customerId: string | null }) {
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
            {({ extension_request: "Wants to keep it longer", return_confirmation: "Return arranged", problem_report: "Problem reported", question: "Question" } as Record<string, string>)[String(action.action_type)] || String(action.action_type || "").replace(/_/g, " ")}
          </Badge>
          <p className="mt-2 font-semibold text-[var(--foreground)]">{portalActionSummary(action)}</p>
          <p className="mt-1 text-xs font-bold uppercase text-[var(--muted)]">{formatDateTime(action.created_at)}</p>
        </div>
      </div>
      <div className="mt-3">
        {alreadyCovered ? (
          // An older request the rental has since outgrown: nothing to approve, and no need to message the customer.
          <form action={resolvePortalAction} className="rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3">
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="actionId" type="hidden" value={action.id} />
            <input name="rentalId" type="hidden" value={rentalId} />
            <input name="notes" type="hidden" value="Already covered: the rental was extended past this date." />
            <p className="text-sm text-[var(--foreground-secondary)]">The rental already runs to {niceDate(String(picture?.currentEnd))}, so there is nothing left to approve.</p>
            <PendingButton className="secondary-action pressable mt-3 px-3 py-2" pendingLabel="Clearing..." type="submit">
              Clear this request
            </PendingButton>
          </form>
        ) : action.action_type === "extension_request" ? (
          <div className="grid items-start gap-3 md:grid-cols-[1.6fr_1fr]">
            <ExtensionRequestAnswer actionId={action.id} picture={picture} rentalId={rentalId} requestedEnd={content.new_end_date || null} openEnded={!!content.open_ended} />
            <form action={declinePortalAction} className="rounded-lg border border-[#fecdd3] bg-[#fff1f2] p-3">
              <input name="organizationId" type="hidden" value={organizationId} />
              <input name="actionId" type="hidden" value={action.id} />
              <input name="rentalId" type="hidden" value={rentalId} />
              <label className="block text-sm font-bold text-[#9f1239]">
                Reason for the customer
                <input className="mt-2 w-full rounded-lg border border-[#fecdd3] bg-white px-3 py-2 text-sm" name="note" placeholder="Optional. Sent to the customer with the answer." />
              </label>
              <PendingButton className="pressable mt-3 w-full rounded-lg border border-[#fecdd3] bg-white px-3 py-2 text-sm font-semibold text-[#be123c]" pendingLabel="Declining..." type="submit">
                Decline
              </PendingButton>
            </form>
          </div>
        ) : action.action_type === "return_confirmation" ? (
          <form action={acknowledgePortalAction}>
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="actionId" type="hidden" value={action.id} />
            <input name="rentalId" type="hidden" value={rentalId} />
            <PendingButton className="primary-action pressable px-3 py-2" pendingLabel="Confirming..." type="submit">
              Confirm to the customer
            </PendingButton>
          </form>
        ) : action.action_type === "problem_report" ? (
          <form action={resolvePortalAction} className="space-y-3">
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="actionId" type="hidden" value={action.id} />
            <input name="rentalId" type="hidden" value={rentalId} />
            <textarea className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" name="notes" placeholder="What you did about it (only you and your team see this)" />
            <PendingButton className="primary-action pressable px-3 py-2" pendingLabel="Saving..." type="submit">
              Mark as sorted
            </PendingButton>
          </form>
        ) : (
          <form action={replyToPortalQuestion} className="space-y-3">
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="actionId" type="hidden" value={action.id} />
            <input name="rentalId" type="hidden" value={rentalId} />
            {customerId ? <input name="customerId" type="hidden" value={customerId} /> : null}
            <textarea className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" name="reply" placeholder="Your answer, sent to the customer" required />
            <PendingButton className="primary-action pressable px-3 py-2" pendingLabel="Sending..." type="submit">
              Send answer
            </PendingButton>
          </form>
        )}
      </div>
    </div>
  );
}

function portalActionSummary(action: any) {
  const content = action.content || {};
  if (action.action_type === "extension_request") return `${content.open_ended ? "Asked to switch to monthly, open-ended" : `Asked to keep it until ${content.new_end_date ? niceDate(content.new_end_date) : "a later date"}`}${content.note ? ` - ${content.note}` : ""}`;
  if (action.action_type === "return_confirmation") return `Return ${content.return_date || ""} ${content.return_time || ""}${content.return_location ? ` at ${content.return_location}` : ""}`.trim();
  if (action.action_type === "problem_report") return `${content.category || "Problem"}: ${content.description || "No description"}`;
  if (action.action_type === "question") return content.question || "Customer question";
  return "Request from the customer";
}
