import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, CalendarDays, Car, CheckCircle2, Clock, CreditCard, FileText, Gauge, MapPin, ReceiptText, UserRound, XCircle } from "lucide-react";
import { CancelBookingButton } from "@/app/bookings/[id]/cancel-booking-button";
import { ChangeVehicleButton } from "@/app/bookings/[id]/change-vehicle-button";
import { UndoCancellationButton } from "@/app/bookings/[id]/undo-cancellation-button";
import { confirmCustomerPayment } from "@/app/actions/deposits";
import { PaymentReminderButton } from "@/app/bookings/[id]/payment-reminder-button";
import { acknowledgePortalAction, approveExtensionRequest, declinePortalAction, replyToPortalQuestion, resolvePortalAction } from "@/app/actions/portal-actions";
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
import { Badge, Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getBookingDetail, getCustomersForSelector } from "@/lib/bookings";
import { flagForNationality } from "@/lib/customer-options";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDeliveryLocation } from "@/lib/delivery-location";
import { toWallTime, businessToday } from "@/lib/business-time";
import { GeneratePaymentScheduleButton } from "@/app/bookings/[id]/generate-payment-schedule-button";
import { RentalDocumentsCard } from "@/app/bookings/[id]/rental-documents-card";
import { businessSignatureOf, getBookingRentalDocuments, renterSignatureOf, type BookingRentalDocument } from "@/lib/booking-rental-documents";

function money(value: unknown, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Open";
  return new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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
  if (value === "on_delivery") return "Pay on delivery";
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
    return "Forfeited";
  }

  if (status === "partially_forfeited") {
    return `${money(rental?.deposit_forfeited_amount, currency)} forfeited`;
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

function daysRemaining(value: string | null | undefined, status?: string | null) {
  if (status === "completed") return "Returned";
  if (status === "cancelled") return "Cancelled";
  if (!value) return "Open-ended";
  const today = new Date();
  const target = new Date(value);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  return days < 0 ? `${Math.abs(days)} days overdue` : `${days} days remaining`;
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
  return [
    { label: "Created", complete: Boolean(bookingLink?.created_at), at: bookingLink?.created_at },
    { label: "Sent", complete: Boolean(bookingLink?.sent_at) || ["sent", "viewed", "details_submitted", "contract_signed", "completed"].includes(bookingLink?.status), at: bookingLink?.sent_at },
    { label: "Viewed", complete: Boolean(bookingLink?.viewed_at), at: bookingLink?.viewed_at },
    { label: "Customer form submitted", complete: Boolean(bookingLink?.customer_details_submitted_at), at: bookingLink?.customer_details_submitted_at },
    { label: "Customer signed contract", complete: Boolean(renterSignature || bookingLink?.contract_signed_at), at: renterSignature?.signedAt || bookingLink?.contract_signed_at },
    { label: "Business signed contract", complete: Boolean(businessSignature), at: businessSignature?.signedAt }
  ];
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
  let [detail, allCustomers] = await Promise.all([
    getBookingDetail(id, organization.id),
    getCustomersForSelector(organization.id)
  ]);

  if (!detail) {
    return (
      <AppShell userEmail={userEmail}>
        <Card>
          <SectionHeader eyebrow="Booking not found" title="This rental could not be opened" />
          <p className="mt-3 text-sm text-[#667085]">It may have been cancelled, deleted, or belong to another organisation.</p>
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

  const supabaseForVehicles = (await createSupabaseServerClient()) as any;
  const { data: availableVehicles } = await supabaseForVehicles
    .from("vehicles")
    .select("id, make, model, trim, year, registration_number, monthly_rate")
    .eq("organization_id", organization.id)
    .eq("status", "available")
    .is("deleted_at", null)
    .order("make");
  const rentalDocuments = await getBookingRentalDocuments(supabaseForVehicles, organization.id, detail.rental.id);

  const { rental, bookingLink, payments, transactions, inspections, documents, activityEvents, customerPortalActions, communicationTimeline } = detail;
  const vehicle = rental.vehicles;
  const customer = rental.customers;
  const isRetrospective = Boolean(rental.entered_by_operator) ||
    Boolean(rental.start_date && new Date(String(rental.start_date).slice(0, 10) + "T00:00:00Z") < new Date(Date.now() - 7 * 86_400_000));
  const displayStatus = (
    rental.status === "booked" &&
    rental.start_date &&
    new Date(String(rental.start_date).slice(0, 10) + "T00:00:00Z") < new Date()
  ) ? "active" : rental.status;
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
  const overduePaymentGroup = nonVoidedPayments.filter((p: any) => p.status !== "paid" && p.due_date && p.due_date < today);
  const dueNowPaymentGroup = nonVoidedPayments.filter((p: any) => p.status !== "paid" && (!p.due_date || p.due_date === today));
  const upcomingPaymentGroup = nonVoidedPayments.filter((p: any) => p.status !== "paid" && p.due_date && p.due_date > today);
  const paidPaymentGroup = nonVoidedPayments.filter((p: any) => p.status === "paid");
  const pendingPayment = payments.find((payment: any) => !isVoidedPayment(payment) && ["pending", "overdue"].includes(String(payment.status || "pending")));
  const deliveryInspection = inspections.find((inspection: any) => inspection.type === "delivery" || inspection.inspection_type === "delivery");
  const returnInspection = inspections.find((inspection: any) => inspection.type === "return" || inspection.inspection_type === "return");
  const customerDocuments = documents.filter((document: any) => document.owner_type === "customer");
  const delivery = deliveryDisplay(rental, bookingLink);
  const paymentMethod = bookingLink?.preferred_payment_method || null;
  const paymentTiming = bookingLink?.payment_timing || null;
  const customerReportedPayment = Boolean(bookingLink?.payment_reported_by_customer);
  const paymentConfirmationAmount = Number(rental.deposit_amount || rental.rental_rate || 0);
  const confirmCustomerPaymentAction = confirmCustomerPayment.bind(null, rental.id, paymentConfirmationAmount, paymentMethod);
  const bookingPortalUrl = bookingLink?.public_url || (bookingLink?.token ? `/book/${bookingLink.token}` : null);
  const pendingPortalActions = (customerPortalActions || []).filter((action: any) => action.status === "pending");
  const canAdjustRental = ["active", "booked", "due_soon", "overdue"].includes(String(rental.status || "").toLowerCase());
  const needsExistingRentalPaymentSetup = Boolean(rental.entered_by_operator) && payments.length === 0;
  const activeRentalStatus = ["active", "due_soon", "overdue", "extended"].includes(String(displayStatus || "").toLowerCase());
  // Only what is due today or earlier counts as outstanding; future scheduled rent is not owed yet.
  const pendingPaymentAmount = activePayments
    .filter((payment: any) => ["pending", "overdue", "scheduled"].includes(String(payment.status || "pending")))
    .filter((payment: any) => !payment.due_date || String(payment.due_date).slice(0, 10) <= today)
    .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const customerFormComplete = Boolean(bookingLink?.customer_details_submitted_at || ["details_submitted", "contract_signed", "completed"].includes(String(bookingLink?.status || "")));
  const paymentDueOnDeliveryAmount = Number(rental.first_payment_amount || rental.rental_rate || 0);
  const financialState = (() => {
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
        label: "Payment due on delivery",
        detail: `${money(paymentDueOnDeliveryAmount, rental.currency)} due at delivery.`,
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
    if (activeRentalStatus && pendingPayment) {
      return {
        label: "Outstanding balance",
        detail: "Active rental has unpaid scheduled payments.",
        amount: pendingPaymentAmount || outstandingBalance,
        tone: "red" as const
      };
    }
    if (activePayments.length > 0 && ((totalRentalValue > 0 && totalPaid >= totalRentalValue) || pendingPaymentAmount === 0)) {
      return {
        label: "Paid up to date",
        detail: "Nothing is due right now.",
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
            : "text-[#667085]";

  return (
    <AppShell userEmail={userEmail}>
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

        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#667085]">
          <Link className="text-[#0f766e]" href="/bookings">Bookings</Link>
          <span>/</span>
          <span>{bookingReference(rental)}</span>
        </div>

        <Card>
          <div className="card-section flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(displayStatus)}>{String(displayStatus).replace(/_/g, " ")}</Badge>
                <Badge tone={bookingLink?.status === "completed" ? "green" : bookingLink?.status === "viewed" ? "blue" : "amber"}>{bookingLink?.status ? String(bookingLink.status).replace(/_/g, " ") : "No booking link"}</Badge>
                {!customer ? <Badge tone="amber">Awaiting customer</Badge> : null}
                {rental.entered_by_operator ? <Badge tone="blue">Operator entered</Badge> : null}
                <span className="font-mono-data text-xs font-black uppercase text-[#667085]">{bookingReference(rental)}</span>
              </div>
              <h1 className="mt-2 truncate text-2xl font-black tracking-[-0.02em] text-[#10252b]">
                {customer ? customer.full_name : "Awaiting customer details"}
              </h1>
              <p className="mt-1 truncate text-sm font-bold text-[#475467]">{vehicleTitle(vehicle)}</p>
              <p className="font-mono-data mt-1 text-xs font-bold text-[#667085]">{vehicle?.registration_number}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:max-w-[560px] lg:justify-end">
              <ActionButton href={`/bookings/${rental.id}/edit` as Route} tone="light">
                Edit booking
              </ActionButton>
              {rental.status === "booked" ? (
                <ActionButton href={`/inspections/delivery/${rental.id}` as Route}>
                  Start delivery
                </ActionButton>
              ) : null}
              {["active", "due_soon", "overdue", "extended"].includes(displayStatus) ? (
                <ActionButton href={`/inspections/return/${rental.id}` as Route}>
                  Start return
                </ActionButton>
              ) : null}
              {["active", "due_soon", "overdue", "extended"].includes(displayStatus) ? (
                <ChangeVehicleButton
                  rentalId={rental.id}
                  organizationId={organization.id}
                  currentVehicleId={String(rental.vehicle_id || vehicle?.id || "")}
                  currentVehicleLabel={vehicleTitle(vehicle)}
                  currentRate={Number(rental.rental_rate || 0)}
                  currency={rental.currency || "THB"}
                  availableVehicles={(availableVehicles || []).filter((v: any) => v.id !== (rental.vehicle_id || vehicle?.id))}
                />
              ) : null}
              {canAdjustRental ? (
                <RentalAdjustmentButton
                  currentEndDate={rental.end_date}
                  currentRate={Number(rental.rental_rate || 0)}
                  currentStartDate={rental.start_date}
                  customerName={customer?.full_name || "Awaiting customer"}
                  label="Adjust rental period"
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
              ) : !["completed"].includes(rental.status) ? (
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
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-4">
          <BookingMetricCard icon={<CalendarDays size={18} />} label="Dates">
            <div className="flex flex-wrap items-center gap-1 text-sm font-black leading-5 text-[#10252b]">
              <span>{formatDate(rental.start_date)} to</span>
              <EditableEndDate currentEndDate={rental.end_date} rentalId={rental.id} />
            </div>
            <p className="text-sm text-[#667085]">{daysRemaining(rental.end_date, rental.status)}</p>
          </BookingMetricCard>
          <BookingMetricCard icon={<CreditCard size={18} />} label="Billing">
            <p className="font-mono-data text-sm font-black leading-5 text-[#10252b]">{money(rental.rental_rate, rental.currency)} / {rental.pricing_model}</p>
            <p className={`text-sm font-black ${financialStateClass}`}>{financialState.label}</p>
            {financialState.amount !== null ? (
              <p className={`font-mono-data text-sm ${financialStateClass}`}>{money(financialState.amount, rental.currency)}</p>
            ) : (
              <p className="text-sm text-[#667085]">{financialState.detail}</p>
            )}
            {outstandingBalance > 0 && customer ? (
              <div className="mt-3">
                <PaymentReminderButton rentalId={rental.id} />
              </div>
            ) : null}
          </BookingMetricCard>
          <BookingMetricCard icon={<Gauge size={18} />} label="Mileage">
            <p className="font-mono-data text-sm font-black leading-5 text-[#10252b]">{Number(rental.km_driven || 0).toLocaleString()} km</p>
            <p className="font-mono-data text-sm text-[#667085]">Delivery {Number(rental.mileage_at_delivery || 0).toLocaleString()} / Return {Number(rental.mileage_at_return || 0).toLocaleString()}</p>
          </BookingMetricCard>
          <BookingMetricCard icon={<UserRound size={18} />} label="Customer">
            {customer ? (
              <>
                <p className="truncate text-sm font-black leading-5 text-[#10252b]">{flagForNationality(customer.nationality)} {customer.nationality || "Nationality not set"}</p>
                <p className="text-sm text-[#667085]">{customer.phone || "Phone not set"}</p>
              </>
            ) : (
              <p className="text-sm font-black text-[#b45309]">Awaiting details</p>
            )}
          </BookingMetricCard>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <div className="space-y-3">
            <Card>
              <SectionHeader eyebrow="Booking link" title="Customer completion timeline" />
              <div className="mt-3 space-y-3">
                {timelineSteps(bookingLink, rentalDocuments).map((step) => (
                    <div className="sub-surface flex items-start gap-3 p-3" key={step.label}>
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step.complete ? "bg-[#dcfce7] text-[#166534]" : "bg-[#eef2f6] text-[#667085]"}`}>
                      {step.complete ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                    </span>
                    <div>
                      <p className="font-black text-[#10252b]">{step.label}</p>
                      <p className="text-sm text-[#667085]">{formatDateTime(step.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <BookingShareActions currentUrl={bookingLink?.public_url || null} organizationId={organization.id} rentalId={rental.id} />
              </div>
            </Card>

            <Card>
              <SectionHeader eyebrow="Customer" title="Details and documents" />
              {customer ? (
                <>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Info icon={UserRound} label="Name" value={customer?.full_name || "Not recorded"} />
                    <Info icon={UserRound} label="Phone" value={customer?.phone || "Not recorded"} />
                    <Info icon={UserRound} label="Email" value={customer?.email || "Not recorded"} />
                    <Info icon={FileText} label="Documents" value={documentLabel(customer?.document_status)} danger={customer?.document_status !== "complete"} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {["passport", "driver_license", "selfie"].map((category) => {
                      const found = customerDocuments.some((document: any) => document.category === category);
                      return (
                        <div className="flex items-center gap-2 rounded-lg border border-[#d6e5e2] bg-white p-3" key={category}>
                          {found ? <CheckCircle2 className="text-[#16a34a]" size={18} /> : <AlertTriangle className="text-[#b7791f]" size={18} />}
                          <span className="text-sm font-bold capitalize text-[#10252b]">{category.replace(/_/g, " ")}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-[#99f6e4] bg-[#f0fdfa] p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ccfbf1]">
                        <Clock className="text-[#0f766e]" size={16} />
                      </span>
                      <p className="font-black text-[#0f766e]">Awaiting customer details</p>
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
            </Card>

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
                      outstanding_balance: outstandingBalance,
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
                    organisationId={organization.id}
                    rentalId={rental.id}
                    revalidatePathname={`/bookings/${rental.id}`}
                  />
                </div>
              </Card>
            ) : null}

            <Card>
              <SectionHeader eyebrow="Inspections" title="Delivery and return" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {deliveryInspection ? (
                  <InspectionStatus label="Delivery inspection" inspection={deliveryInspection} href={`/inspections/delivery/${rental.id}` as Route} available={false} />
                ) : isRetrospective && rental.status === "booked" ? (
                  // Retrospective, not yet activated: equal-weight options
                  <div className="sub-surface space-y-3 p-3">
                    <div className="flex items-center gap-2 font-black text-[#10252b]">
                      <AlertTriangle className="text-[#b7791f]" size={18} />
                      Delivery inspection
                    </div>
                    <p className="text-sm text-[#667085]">
                      No inspection on record. This rental started {startedAgoLabel(rental.start_date)}. Inspection is optional for retrospective bookings.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Link
                        className="pressable flex items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-center text-sm font-bold text-[var(--foreground-secondary)]"
                        href={`/inspections/delivery/${rental.id}` as Route}
                      >
                        Complete inspection
                      </Link>
                      <SkipInspectionButton rentalId={rental.id} />
                    </div>
                  </div>
                ) : isRetrospective ? (
                  // Retrospective, already active, no inspection: soft prompt
                  <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
                    <div className="flex items-center gap-2 font-black text-[#92400e]">
                      <AlertTriangle className="text-[#b7791f]" size={18} />
                      No delivery inspection
                    </div>
                    <p className="mt-1 text-sm text-[#b45309]">
                      Started {startedAgoLabel(rental.start_date)}. Inspection is optional for retrospective bookings.
                    </p>
                    <Link
                      className="pressable mt-2 inline-flex items-center rounded-lg border border-[#fde68a] bg-white px-3 py-2 text-xs font-bold text-[#92400e]"
                      href={`/inspections/delivery/${rental.id}` as Route}
                    >
                      Complete inspection (optional)
                    </Link>
                  </div>
                ) : rental.status === "booked" ? (
                  // New booking: prominent start inspection + skip
                  <div className="sub-surface space-y-2 p-3">
                    <div className="flex items-center gap-2 font-black text-[#10252b]">
                      <AlertTriangle className="text-[#b7791f]" size={18} />
                      Delivery inspection
                    </div>
                    <Link className="primary-action pressable block w-full px-3 py-2 text-center" href={`/inspections/delivery/${rental.id}` as Route}>
                      Start delivery inspection
                    </Link>
                    <SkipInspectionButton rentalId={rental.id} />
                  </div>
                ) : (
                  // Active, not retrospective, no inspection
                  <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
                    <div className="flex items-center gap-2 font-black text-[#92400e]">
                      <AlertTriangle className="text-[#b7791f]" size={18} />
                      No delivery inspection
                    </div>
                    <p className="mt-2 text-sm text-[#b45309]">This rental was activated without a delivery inspection on record.</p>
                  </div>
                )}
                <InspectionStatus label="Return inspection" inspection={returnInspection} href={`/inspections/return/${rental.id}` as Route} available={["active", "due_soon", "overdue", "extended"].includes(displayStatus)} />
              </div>
              <div className="mt-3 space-y-3">
                {inspections.length === 0 ? (
                  <SectionEmpty>No inspections completed yet.</SectionEmpty>
                ) : (
                  inspections.map((inspection: any) => <InspectionViewer inspection={inspection} key={inspection.id} />)
                )}
              </div>
            </Card>

            <Card>
              <SectionHeader eyebrow="Communication" title="Messages and customer portal activity" />
              <CommunicationTimeline
                customerId={customer?.id || null}
                entries={communicationTimeline || []}
                organizationId={organization.id}
                pendingActions={pendingPortalActions}
                rentalId={rental.id}
              />
            </Card>

            <Card>
              <SectionHeader eyebrow="Activity" title="Booking timeline" />
              <div className="mt-3 space-y-3">
                {activityEvents.length === 0 ? (
                  <SectionEmpty>No activity recorded yet.</SectionEmpty>
                ) : (
                  activityEvents.map((event: any) => (
                  <div className="sub-surface p-3" key={event.id}>
                      <p className="font-black text-[#10252b]">{event.title}</p>
                      <p className="mt-1 text-sm text-[#667085]">{event.detail || event.event_type}</p>
                      <p className="mt-2 text-xs font-bold uppercase text-[#94a3b8]">{formatDateTime(event.occurred_at)}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <Card>
              <SectionHeader eyebrow="Rental details" title="Summary" />
              <div className="mt-3 space-y-3 text-sm">
                <Info icon={Car} label="Vehicle" value={`${vehicleTitle(vehicle)} / ${vehicle?.registration_number || ""}`} />
                <DeliveryInfo delivery={delivery} />
                <Info
                  icon={MapPin}
                  label="Return"
                  value={
                    returnInspection
                      ? `Returned ${formatDateTime(returnInspection.submitted_at || returnInspection.created_at)}${rental.return_location ? ` · ${rental.return_location}` : ""}`
                      : rental.return_location || "Not arranged yet"
                  }
                />
                <Info icon={CreditCard} label="Deposit" value={formatDepositSummary(rental)} />
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
                />
                <PaymentInfo method={paymentMethod} timing={paymentTiming} />
                {customerReportedPayment ? (
                  <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#d97706]">
                        <i aria-hidden="true" className="ti ti-alert-circle text-base" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-[#92400e]">Customer has reported making payment - awaiting your confirmation</p>
                        <p className="mt-1 text-sm text-[#b45309]">Reported {formatDateTime(bookingLink?.payment_reported_at)}</p>
                        <form action={confirmCustomerPaymentAction} className="mt-3">
                          <PendingButton className="pressable inline-flex w-full items-center justify-center rounded-lg bg-[#d97706] px-3 py-2 text-sm font-black text-white shadow-sm" pendingLabel="Confirming..." type="submit">
                            Confirm payment received
                          </PendingButton>
                        </form>
                      </div>
                    </div>
                  </div>
                ) : null}
                <Info icon={CreditCard} label="Total paid" value={money(totalPaid, rental.currency)} />
              </div>
            </Card>

            <RentalDocumentsCard documents={rentalDocuments} />

            <Card>
              <div id="payment-schedule">
                <SectionHeader eyebrow="Payments" title="Payment schedule" />
              </div>
              <div className="card-section space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Scheduled</p>
                    <p className="font-mono-data mt-1 text-lg font-black text-[#10252b]">{money(totalRentalValue, rental.currency)}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Paid income</p>
                    <p className="font-mono-data mt-1 text-lg font-black text-[#16a34a]">{money(totalPaid, rental.currency)}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border)] bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Balance</p>
                    <p className={`font-mono-data mt-1 text-lg font-black ${outstandingBalance > 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{money(outstandingBalance, rental.currency)}</p>
                  </div>
                </div>
                {outstandingBalance > 0 && activeRentalStatus ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-[#d1fae5] bg-[#f0fdf4] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-[#065f46]">
                        {money(outstandingBalance, rental.currency)} outstanding
                      </p>
                      <p className="mt-0.5 text-xs text-[#059669]">
                        Find the payment row below and click "Record payment received"
                      </p>
                    </div>
                    {pendingPayment ? (
                      <a
                        className="pressable inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#059669] px-4 text-sm font-black text-white"
                        href={`#record-payment-${pendingPayment.id}`}
                      >
                        <i aria-hidden="true" className="ti ti-cash text-[14px]" />
                        Record payment
                      </a>
                    ) : null}
                  </div>
                ) : null}
                <div className={`rounded-lg border p-3 text-sm font-semibold ${
                  financialState.tone === "green"
                    ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                    : financialState.tone === "red"
                      ? "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]"
                      : financialState.tone === "amber"
                        ? "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
                        : financialState.tone === "blue"
                          ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]"
                          : "border-[var(--border)] bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]"
                }`}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span>{financialState.label}</span>
                    {financialState.amount !== null ? <span className="font-mono-data">{money(financialState.amount, rental.currency)}</span> : null}
                  </div>
                  <p className="mt-1 text-xs font-medium opacity-80">{financialState.detail}</p>
                </div>
                {needsExistingRentalPaymentSetup ? (
                  <ExistingRentalPaymentSetupCard
                    currency={rental.currency}
                    depositAmount={Number(rental.deposit_amount || 0)}
                    rentalId={rental.id}
                    rentalRate={Number(rental.rental_rate || 0)}
                    startDate={rental.start_date}
                  />
                ) : null}
                {!needsExistingRentalPaymentSetup && payments.length === 0 && outstandingBalance === 0 && totalPaid === 0 ? (
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
                {payments.length === 0 && transactions.length === 0 ? (
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
                  <div className="pt-1">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Transactions</p>
                    <div className="space-y-3">
                      {transactions.map((transaction: any) => <EditableTransactionRow key={transaction.id} transaction={transaction} />)}
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>

            <ComingUpCard
              currency={rental.currency}
              rentalId={rental.id}
              upcomingPayments={upcomingPayments}
              vehicle={vehicle}
              vehicleEvents={vehicleEvents}
            />

          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Info({ icon: Icon, label, value, danger = false }: { icon: typeof Car; label: string; value: string; danger?: boolean }) {
  return (
    <div className="sub-surface flex items-start gap-3 p-3">
      <Icon className={`mt-0.5 shrink-0 ${danger ? "text-[#be123c]" : "text-[#0f766e]"}`} size={18} />
      <div>
        <p className="text-xs font-bold uppercase text-[#667085]">{label}</p>
        <p className={`font-mono-data mt-1 font-black ${danger ? "text-[#be123c]" : "text-[#10252b]"}`}>{value}</p>
      </div>
    </div>
  );
}

function DeliveryInfo({ delivery }: { delivery: { method: unknown; title: string; detail: string } }) {
  return (
    <div className="sub-surface flex items-start gap-3 p-3">
      <MapPin className="mt-0.5 shrink-0 text-[#0f766e]" size={18} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase text-[#667085]">Delivery</p>
          {delivery.method === "tbd" ? <Badge tone="amber">To be confirmed</Badge> : null}
        </div>
        <p className="mt-1 font-black text-[#10252b]">{delivery.title}</p>
        <p className="mt-1 text-sm font-semibold text-[#667085]">{delivery.detail}</p>
      </div>
    </div>
  );
}

function PaymentInfo({ method, timing }: { method: string | null; timing: string | null }) {
  return (
    <div className="sub-surface flex items-start gap-3 p-3">
      <CreditCard className="mt-0.5 shrink-0 text-[#0f766e]" size={18} />
      <div>
        <p className="text-xs font-bold uppercase text-[#667085]">Payment</p>
        <p className="mt-1 font-black text-[#10252b]">Payment method: {formatPaymentMethod(method)}</p>
        <p className="mt-1 text-sm font-semibold text-[#667085]">Payment timing: {formatPaymentTiming(timing)}</p>
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
  return "border-[#d6e5e2] bg-white text-[#454d54]";
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
    <Card>
      <SectionHeader eyebrow="Upcoming" title="What's coming up" />
      <div className="card-section">
        <div className="grid gap-3 xl:grid-cols-2">
          <div className={nextPayment ? "rounded-[11px] bg-[#141c2b] p-4 text-white" : ""}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">Next payment</p>
                {nextPayment ? (
                  <>
                    <p className="font-mono-data mt-2 text-2xl font-black tracking-[-0.03em] text-white">{money(nextPayment.amount, nextPayment.currency || currency)}</p>
                    <p className="mt-1 text-xs font-semibold text-white/55">
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
              {nextPayment ? <Badge tone={paymentStatusTone(nextPaymentStatus)}>{nextPaymentStatus}</Badge> : null}
            </div>
            {nextPayment ? (
              <div className="mt-4">
                {showRecordPayment ? (
                  <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-lg bg-[#5eead4] px-3 text-xs font-black text-[#083344]" href={`#record-payment-${nextPayment.id}` as Route}>
                    Record payment received
                  </Link>
                ) : (
                  <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-lg border border-white/15 bg-white/8 px-3 text-xs font-black text-[#5eead4]" href={"#payment-schedule" as Route}>
                    View payment schedule
                  </Link>
                )}
              </div>
            ) : null}
            {upcomingPayments.length > 1 ? (
              <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
                {upcomingPayments.slice(1, 4).map((payment: any) => (
                  <div className="flex items-center justify-between gap-3 text-xs" key={payment.id}>
                    <span className="truncate text-white/55">{formatDate(payment.due_date)}</span>
                    <span className="font-mono-data shrink-0 font-black text-white">{money(payment.amount, payment.currency || currency)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[11px] border border-[#e3e6e8] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Vehicle events</p>
                <p className="mt-1 text-sm font-black text-[#10252b]">{vehicle?.registration_number || vehicleTitle(vehicle) || "Assigned vehicle"}</p>
              </div>
              {vehicle?.id ? (
                <Link className="text-xs font-black text-[var(--primary)]" href={`/fleet/${vehicle.id}` as Route}>
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
                        <p className="truncate text-sm font-black">{event.label}</p>
                        <p className="mt-1 text-xs font-semibold opacity-75">{formatDate(event.due_date)}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.04em]">
                        {eventTypeLabel(event.type)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold opacity-80">{daysUntilLabel(event.days_until)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-[#e3e6e8] bg-[#f8f9fa] p-3 text-sm font-semibold text-[var(--muted)]">
                No compliance dates or vehicle tasks due in the next 180 days.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function InspectionStatus({ label, inspection, href, available }: { label: string; inspection: any; href: Route; available: boolean }) {
  if (inspection) {
    return (
      <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3">
        <div className="flex items-center gap-2 font-black text-[#166534]">
          <CheckCircle2 size={18} />
          {label}
        </div>
        <p className="mt-1 text-sm text-[#667085]">{formatDateTime(inspection.submitted_at || inspection.created_at)}</p>
      </div>
    );
  }

  return (
    <div className="sub-surface p-3">
      <div className="flex items-center gap-2 font-black text-[#10252b]">
        <AlertTriangle className="text-[#b7791f]" size={18} />
        {label}
      </div>
      {available ? (
        <Link className="primary-action pressable mt-3 px-3 py-2" href={href}>
          Start now
        </Link>
      ) : (
        <p className="mt-2 text-sm text-[#667085]">Not available for the current booking status.</p>
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
  return new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function communicationTypeBadge(type: string) {
  const labels: Record<string, { label: string; className: string }> = {
    automated_reminder: { label: "Auto reminder", className: "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]" },
    manual_note: { label: "Note", className: "border-[#e3e6e8] bg-[#f8f9fa] text-[#454d54]" },
    customer_portal_action: { label: "Customer action", className: "border-[#99f6e4] bg-[#ecfeff] text-[#0f766e]" },
    booking_link_activity: { label: "Booking link", className: "border-[#ddd6fe] bg-[#f5f3ff] text-[#7c3aed]" },
    operator_message: { label: "Message sent", className: "border-[#cbd5e1] bg-[#1a1d21] text-white" }
  };
  const config = labels[type] || { label: String(type || "Event").replace(/_/g, " "), className: "border-[#e3e6e8] bg-white text-[#454d54]" };
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-black uppercase tracking-[0.04em] ${config.className}`}>{config.label}</span>;
}

function directionIndicator(direction?: string | null) {
  if (direction === "outbound") return <span className="font-mono-data text-sm font-black text-[#0f766e]" title="Outbound">-&gt;</span>;
  if (direction === "inbound") return <span className="font-mono-data text-sm font-black text-[#0f766e]" title="Inbound">&lt;-</span>;
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
  return label ? <span className="rounded-full border border-[#d6e5e2] bg-white px-2 py-1 text-[10px] font-black uppercase text-[#667085]">{label}</span> : null;
}

function communicationStatusBadge(entry: any) {
  if (entry.timeline_type !== "automated_reminder" && entry.type !== "automated_reminder") return null;
  if (entry.status === "failed") return <Badge tone="red">Failed</Badge>;
  return <Badge tone="green">Sent</Badge>;
}

function CommunicationTimeline({
  entries,
  pendingActions,
  organizationId,
  rentalId,
  customerId
}: {
  entries: any[];
  pendingActions: any[];
  organizationId: string;
  rentalId: string;
  customerId: string | null;
}) {
  const pendingIds = new Set((pendingActions || []).map((action: any) => action.id));
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
          <CustomerPortalActionCard action={action} customerId={customerId} organizationId={organizationId} rentalId={rentalId} />
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
            <span className="text-xs font-bold uppercase text-[#94a3b8]">{relativeTime(entry.created_at)}</span>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-[#344054]">{entry.content || "No message content recorded."}</p>
        </div>
      ))}
    </div>
  );
}

function CustomerPortalActionCard({ action, organizationId, rentalId, customerId }: { action: any; organizationId: string; rentalId: string; customerId: string | null }) {
  const content = action.content || {};
  return (
    <div className="rounded-lg border border-[#d6e5e2] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={action.action_type === "problem_report" ? "red" : action.action_type === "extension_request" ? "amber" : "blue"}>
            {String(action.action_type || "").replace(/_/g, " ")}
          </Badge>
          <p className="mt-2 font-black text-[#10252b]">{portalActionSummary(action)}</p>
          <p className="mt-1 text-xs font-bold uppercase text-[#94a3b8]">{formatDateTime(action.created_at)}</p>
        </div>
      </div>
      <div className="mt-3">
        {action.action_type === "extension_request" ? (
          <div className="grid gap-3 md:grid-cols-2">
            <form action={approveExtensionRequest} className="rounded-lg border border-[#d6e5e2] bg-[#fbfefd] p-3">
              <input name="organizationId" type="hidden" value={organizationId} />
              <input name="actionId" type="hidden" value={action.id} />
              <input name="rentalId" type="hidden" value={rentalId} />
              <label className="block text-sm font-bold text-[#344054]">
                Approved end date
                <input className="mt-2 w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-2 text-sm" defaultValue={content.new_end_date || ""} name="newEndDate" required type="date" />
              </label>
              <PendingButton className="primary-action pressable mt-3 w-full justify-center px-3 py-2" pendingLabel="Approving..." type="submit">
                Approve extension
              </PendingButton>
            </form>
            <form action={declinePortalAction} className="rounded-lg border border-[#fecdd3] bg-[#fff1f2] p-3">
              <input name="organizationId" type="hidden" value={organizationId} />
              <input name="actionId" type="hidden" value={action.id} />
              <input name="rentalId" type="hidden" value={rentalId} />
              <label className="block text-sm font-bold text-[#9f1239]">
                Decline note
                <input className="mt-2 w-full rounded-lg border border-[#fecdd3] bg-white px-3 py-2 text-sm" name="note" placeholder="Optional" />
              </label>
              <PendingButton className="pressable mt-3 w-full rounded-lg border border-[#fecdd3] bg-white px-3 py-2 text-sm font-black text-[#be123c]" pendingLabel="Declining..." type="submit">
                Decline
              </PendingButton>
            </form>
          </div>
        ) : action.action_type === "return_confirmation" ? (
          <form action={acknowledgePortalAction}>
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="actionId" type="hidden" value={action.id} />
            <input name="rentalId" type="hidden" value={rentalId} />
            <PendingButton className="primary-action pressable px-3 py-2" pendingLabel="Acknowledging..." type="submit">
              Acknowledge
            </PendingButton>
          </form>
        ) : action.action_type === "problem_report" ? (
          <form action={resolvePortalAction} className="space-y-3">
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="actionId" type="hidden" value={action.id} />
            <input name="rentalId" type="hidden" value={rentalId} />
            <textarea className="w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-2 text-sm" name="notes" placeholder="Resolution notes" />
            <PendingButton className="primary-action pressable px-3 py-2" pendingLabel="Resolving..." type="submit">
              Mark resolved
            </PendingButton>
          </form>
        ) : (
          <form action={replyToPortalQuestion} className="space-y-3">
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="actionId" type="hidden" value={action.id} />
            <input name="rentalId" type="hidden" value={rentalId} />
            {customerId ? <input name="customerId" type="hidden" value={customerId} /> : null}
            <textarea className="w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-2 text-sm" name="reply" placeholder="Reply to customer" required />
            <PendingButton className="primary-action pressable px-3 py-2" pendingLabel="Sending..." type="submit">
              Reply
            </PendingButton>
          </form>
        )}
      </div>
    </div>
  );
}

function portalActionSummary(action: any) {
  const content = action.content || {};
  if (action.action_type === "extension_request") return `Requested new return date: ${content.new_end_date || "not specified"}${content.note ? ` - ${content.note}` : ""}`;
  if (action.action_type === "return_confirmation") return `Return ${content.return_date || ""} ${content.return_time || ""}${content.return_location ? ` at ${content.return_location}` : ""}`.trim();
  if (action.action_type === "problem_report") return `${content.category || "Problem"}: ${content.description || "No description"}`;
  if (action.action_type === "question") return content.question || "Customer question";
  return "Customer portal request";
}
