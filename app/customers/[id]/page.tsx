import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, BadgeCheck, CalendarDays, FileText, Mail, MessageCircle, PenLine, Phone, Plus, Upload, UserRound } from "lucide-react";
import { updateCustomer, uploadCustomerDocument } from "@/app/actions/customers";
import { CustomerNotesForm } from "@/app/customers/[id]/customer-notes-form";
import { AppShell } from "@/components/app-shell";
import { CommunicationPanel } from "@/components/communication-panel";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, Fold, ProgressBar, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { flagForNationality } from "@/lib/customer-options";
import { getCustomerDetail, getCustomerDocumentCompleteness } from "@/lib/customer-detail";
import { getDefaultOrganization } from "@/lib/organization";
import { amountDueNowByRental } from "@/lib/rental-balances";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TRANSACTION_TYPE_OPTIONS, isRawDepositTransaction, isRevenueTransaction } from "@/lib/transaction-options";

// The words owners see everywhere else, not the database's.
const RENTAL_STATUS: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "red" | "blue" }> = {
  booked: { label: "Booked", tone: "amber" },
  active: { label: "On rent", tone: "blue" },
  due_soon: { label: "Due back soon", tone: "blue" },
  extended: { label: "On rent", tone: "blue" },
  overdue: { label: "Late return", tone: "red" },
  completed: { label: "Completed", tone: "green" },
  cancelled: { label: "Cancelled", tone: "neutral" }
};

function transactionName(type: string) {
  return TRANSACTION_TYPE_OPTIONS.find((option) => option.value === type)?.label || type.replace(/_/g, " ");
}

function money(value: unknown) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function depositLabel(rental: any) {
  switch (String(rental?.deposit_status || "")) {
    case "received":
      return `Deposit held ${money(rental.deposit_held)}`;
    case "fully_returned":
      return "Deposit returned";
    case "partially_returned":
      return `Deposit ${money(rental.deposit_refunded_amount)} returned`;
    case "forfeited":
      return "Deposit kept";
    case "partially_forfeited":
      return `Deposit ${money(rental.deposit_forfeited_amount)} kept`;
    default:
      return Number(rental?.deposit_amount || 0) > 0 ? "Deposit not collected" : "No deposit";
  }
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

function statusBadge(status: string) {
  if (status === "complete") {
    return <Badge tone="green">Complete</Badge>;
  }
  if (status === "none") {
    return <Badge tone="red">No Documents</Badge>;
  }
  return <Badge tone="amber">Missing Documents</Badge>;
}

function rentalLabel(rental: any) {
  const days = daysUntil(rental?.end_date);
  if (days === null) {
    return "Open-ended";
  }
  return days < 0 ? `${Math.abs(days)} days overdue` : `${days} days remaining`;
}

function InfoTile({ label, value, danger = false }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className="sub-surface p-3">
      <p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p>
      <p className={`font-mono-data mt-1 font-semibold ${danger ? "text-[#be123c]" : "text-[var(--foreground)]"}`}>{value}</p>
    </div>
  );
}

const contactMethodOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger" },
  { value: "line", label: "LINE" },
  { value: "telegram", label: "Telegram" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" }
];

function preferredContactMethod(customer: any) {
  if (customer.preferred_contact_method) return customer.preferred_contact_method;
  if (customer.whatsapp_number) return "whatsapp";
  if (customer.messenger_id) return "messenger";
  if (customer.line_id) return "line";
  if (customer.telegram_username) return "telegram";
  if (customer.email) return "email";
  if (customer.phone) return "phone";
  return "whatsapp";
}

function ContactChannelsForm({ customer, organizationId }: { customer: any; organizationId: string }) {
  const inputClass = "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

  return (
    <form action={updateCustomer} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input name="customerId" type="hidden" value={customer.id} />
      <input name="organizationId" type="hidden" value={organizationId} />
      <label className="block">
        <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">WhatsApp number</span>
        <input className={inputClass} defaultValue={customer.whatsapp_number || ""} name="whatsappNumber" placeholder="+66812345678 or your number with country code" type="tel" />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Facebook Messenger</span>
        <input className={inputClass} defaultValue={customer.messenger_id || ""} name="messengerId" placeholder="messenger.com/username or full profile URL" />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">LINE ID</span>
        <input className={inputClass} defaultValue={customer.line_id || ""} name="lineId" placeholder="@lineusername" />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Telegram</span>
        <input className={inputClass} defaultValue={customer.telegram_username || ""} name="telegramUsername" placeholder="@telegramusername" />
      </label>
      <label className="block opacity-85">
        <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Instagram</span>
        <input className={inputClass} defaultValue={customer.instagram_handle || ""} name="instagramHandle" placeholder="@instagramhandle" />
        <span className="mt-1 block text-xs text-[var(--muted)]">Optional</span>
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Preferred contact method</span>
        <select className={inputClass} defaultValue={preferredContactMethod(customer)} name="preferredContactMethod">
          {contactMethodOptions.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2">
        <PendingButton className="primary-action pressable px-3 py-2" pendingLabel="Saving..." type="submit">
          Save contact channels
        </PendingButton>
      </div>
    </form>
  );
}

function DocumentCheck({
  label,
  detail,
  uploaded
}: {
  label: string;
  detail: React.ReactNode;
  uploaded: boolean;
}) {
  return (
    <div className="sub-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--foreground)]">{label}</p>
          <div className="mt-1 text-sm text-[var(--muted)]">{detail}</div>
        </div>
        {uploaded ? <BadgeCheck className="text-[#16a34a]" size={21} /> : <AlertTriangle className="text-[#be123c]" size={21} />}
      </div>
    </div>
  );
}

function UploadDocumentForm({
  customerId,
  organizationId,
  category,
  label
}: {
  customerId: string;
  organizationId: string;
  category: string;
  label: string;
}) {
  return (
    <details className="sub-surface p-3">
      <summary className="cursor-pointer text-sm font-bold text-[var(--primary)]">Upload {label}</summary>
      <form action={uploadCustomerDocument} className="mt-3 space-y-3">
        <input name="customerId" type="hidden" value={customerId} />
        <input name="organizationId" type="hidden" value={organizationId} />
        <input name="category" type="hidden" value={category} />
        <input accept={category === "selfie" ? "image/*" : "image/*,application/pdf"} className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" name="documentFile" required type="file" />
        <PendingButton className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white" pendingLabel="Uploading..." type="submit">
          <Upload size={16} />
          Upload
        </PendingButton>
      </form>
    </details>
  );
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const detail = await getCustomerDetail(id, organization.id);

  if (!detail) {
    return (
      <AppShell userEmail={userEmail}>
        <div className="mx-auto max-w-2xl">
          <Card>
            <SectionHeader eyebrow="Customer not found" title="This customer could not be opened" />
            <p className="mt-3 text-sm text-[var(--muted)]">They may have been deleted or belong to another organisation.</p>
            <Link className="primary-action pressable mt-3" href="/customers">
              Back to Customers
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  const { customer } = detail;
  const completeness = getCustomerDocumentCompleteness(detail.documents);
  const activeRental = detail.activeRental;
  // Income only: deposits are held and returned, so they are not income.
  const totalIncome = detail.transactions
    .filter((transaction: any) => !transaction.voided && isRevenueTransaction({ amount: Math.abs(Number(transaction.amount || 0)), isDeposit: Boolean(transaction.is_deposit), type: transaction.type }))
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const dueNow = activeRental ? (await amountDueNowByRental(await createSupabaseServerClient(), [activeRental.id])).get(activeRental.id) || 0 : 0;
  const passportDoc = completeness.hasPassport;
  const licenseDoc = completeness.hasLicense;
  const selfieDoc = completeness.hasSelfie;

  return (
    <AppShell userEmail={userEmail}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--muted)]">
          <Link className="text-[var(--primary)]" href="/customers">Customers</Link>
          <span>/</span>
          <span>{customer.full_name}</span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <div className="space-y-3">
            <Card className="page-hero">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-light)] text-3xl">
                    {flagForNationality(customer.nationality)}
                  </div>
                  <h1 className="text-3xl font-semibold text-[var(--foreground)]">{customer.full_name}</h1>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
                    {flagForNationality(customer.nationality)} {customer.nationality || "Nationality not set"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
                    {customer.phone ? (
                      <a className="inline-flex items-center gap-2 text-[var(--primary)]" href={`tel:${customer.phone}`}>
                        <Phone size={16} />
                        {customer.phone}
                      </a>
                    ) : null}
                    {customer.email ? (
                      <a className="inline-flex items-center gap-2 text-[var(--primary)]" href={`mailto:${customer.email}`}>
                        <Mail size={16} />
                        {customer.email}
                      </a>
                    ) : null}
                  </div>
                </div>
                {statusBadge(detail.documentStatus)}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className="primary-action pressable min-w-fit px-3 py-2" href={`/bookings/new?customerId=${customer.id}` as Route}>
                  <Plus size={16} />
                  New booking
                </Link>
                {String(customer.phone || "").replace(/\D/g, "").length >= 8 ? (
                  <a
                    className="secondary-action pressable min-w-fit px-3 py-2"
                    href={`https://wa.me/${String(customer.phone).replace(/\D/g, "")}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <MessageCircle size={16} />
                    WhatsApp
                  </a>
                ) : null}
                <Link className="secondary-action pressable min-w-fit px-3 py-2" href="#notes">
                  <PenLine size={16} />
                  Notes
                </Link>
              </div>
            </Card>

            {activeRental ? (
              <Card>
                <SectionHeader eyebrow="Active rental" title="Currently renting" />
                <div className="mt-3 rounded-lg border border-[#dbeafe] bg-[#fbfaf8] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">
                        {activeRental.vehicles?.make} {activeRental.vehicles?.model}
                      </p>
                      <p className="font-mono-data text-sm text-[var(--muted)]">{activeRental.vehicles?.registration_number}</p>
                    </div>
                    <Badge tone={(daysUntil(activeRental.end_date) || 0) < 0 ? "red" : "blue"}>{rentalLabel(activeRental)}</Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <InfoTile label="Rental period" value={`${formatDate(activeRental.start_date)} to ${activeRental.end_date ? formatDate(activeRental.end_date) : "no end date"}`} />
                    <InfoTile label="Due now" value={dueNow > 0 ? money(dueNow) : "Nothing due"} danger={dueNow > 0} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                <Link className="primary-action pressable px-3 py-2" href={`/bookings/${activeRental.id}` as Route}>Open booking</Link>
                    <Link className="secondary-action pressable px-3 py-2" href={`/transactions/new?customerId=${customer.id}` as Route}>Record payment</Link>
                  </div>
                </div>
              </Card>
            ) : null}

            <Fold open={completeness.status !== "complete"} summary={completeness.status === "complete" ? "All here" : `${completeness.percentage}% complete. Something is missing`} title="Passport, licence and photo" tone={completeness.status === "complete" ? "green" : "amber"}>
              <div className="space-y-3">
                <DocumentCheck
                  detail={
                    <>
                      <p>Number: {customer.passport_number || "Not recorded"}</p>
                      <p>Expiry: {formatDate(customer.passport_expiry)}</p>
                    </>
                  }
                  label="Passport"
                  uploaded={passportDoc}
                />
                <DocumentCheck
                  detail={
                    <>
                      <p>Number: {customer.driver_license_number || "Not recorded"}</p>
                      <p>Expiry: {formatDate(customer.driver_license_expiry)}</p>
                      <p>Country: {customer.driver_license_country || "Not recorded"}</p>
                    </>
                  }
                  label="Driving licence"
                  uploaded={licenseDoc}
                />
                <DocumentCheck detail={<p>{selfieDoc ? "Customer photo is uploaded" : "No customer photo uploaded"}</p>} label="Selfie" uploaded={selfieDoc} />
                <div>
                  <div className="mb-1 flex justify-between text-xs font-bold text-[var(--muted)]">
                    <span>Overall completeness</span>
                    <span className="font-mono-data">{completeness.percentage}%</span>
                  </div>
                  <ProgressBar tone={completeness.status === "complete" ? "green" : completeness.status === "missing" ? "amber" : "red"} value={completeness.percentage} />
                </div>
              </div>
            </Fold>

            <Fold summary="WhatsApp, LINE, Messenger, Telegram, Instagram" title="Other ways to reach them">
              <ContactChannelsForm customer={customer} organizationId={organization.id} />
            </Fold>

            <Fold summary={customer.emergency_contact_name || "Not recorded"} title="Emergency contact">
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoTile label="Name" value={customer.emergency_contact_name || "Not recorded"} />
                <InfoTile
                  label="Phone"
                  value={customer.emergency_contact_phone ? <a className="text-[var(--primary)]" href={`tel:${customer.emergency_contact_phone}`}>{customer.emergency_contact_phone}</a> : "Not recorded"}
                />
              </div>
            </Fold>
          </div>

          <div className="space-y-3">
            <Fold summary={detail.documentsWithUrls.length === 0 ? "Nothing uploaded yet" : `${detail.documentsWithUrls.length} ${detail.documentsWithUrls.length === 1 ? "file" : "files"}. Tap to see or add`} title="Photos of their documents">
              <div className="grid gap-3 sm:grid-cols-2">
                {detail.documentsWithUrls.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-white/70 p-3 text-sm text-[var(--muted)] sm:col-span-2">
                    No documents uploaded yet.
                  </div>
                ) : (
                  detail.documentsWithUrls.map((document) => (
                    <a className="rounded-lg border border-[var(--border)] bg-white p-3 hover:border-[var(--primary)]" href={document.url || "#"} key={document.id} target="_blank">
                      {document.mimeType?.startsWith("image/") && document.url ? (
                        <img alt={document.fileName} className="h-28 w-full rounded-md object-cover" src={document.url} />
                      ) : (
                        <div className="flex h-28 items-center justify-center rounded-md bg-[var(--primary-light)] text-[var(--primary)]">
                          <FileText size={28} />
                        </div>
                      )}
                      <p className="mt-2 font-semibold text-[var(--foreground)]">{document.fileName}</p>
                      <p className="text-sm text-[var(--muted)]">{document.category.replace(/_/g, " ")}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Uploaded {formatDate(document.createdAt)}</p>
                    </a>
                  ))
                )}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <UploadDocumentForm category="passport" customerId={customer.id} label="passport" organizationId={organization.id} />
                <UploadDocumentForm category="driver_license" customerId={customer.id} label="licence" organizationId={organization.id} />
                <UploadDocumentForm category="selfie" customerId={customer.id} label="selfie" organizationId={organization.id} />
              </div>
            </Fold>

            <Card>
              <SectionHeader eyebrow="Communication" title="Contact and notes" />
              <div className="mt-3">
                <CommunicationPanel
                  booking={{
                    vehicle_id: activeRental?.vehicle_id || activeRental?.vehicles?.id || null,
                    vehicle_make_model: activeRental?.vehicles ? `${activeRental.vehicles.make || ""} ${activeRental.vehicles.model || ""}`.trim() : "No active rental",
                    vehicle_plate: activeRental?.vehicles?.registration_number || null,
                    rental_status: activeRental?.status || null,
                    end_date: activeRental?.end_date || null,
                    outstanding_balance: dueNow,
                    deposit_held: Number(activeRental?.deposit_held || 0)
                  }}
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
                  rentalId={activeRental?.id || ""}
                  revalidatePathname={`/customers/${customer.id}`}
                />
              </div>
            </Card>

            <Card>
              <SectionHeader eyebrow="Rental history" title="All rentals" />
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoTile label="Rentals" value={detail.rentals.length} />
                <InfoTile label="Days rented" value={detail.totalRentalDays} />
                <InfoTile label="Rent paid" value={money(detail.lifetimeRevenue)} />
                <InfoTile label="Usual length" value={`${detail.averageRentalDuration} days`} />
              </div>
              <div className="mt-3 space-y-2">
                {detail.rentals.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-white/70 p-3 text-sm text-[var(--muted)]">No rentals yet.</div>
                ) : (
                  detail.rentals.map((rental) => (
                    <Link className="block rounded-lg border border-[var(--border)] bg-white p-3 hover:border-[var(--primary)]" href={`/bookings/${rental.id}` as Route} key={rental.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">
                            {rental.vehicles?.make} {rental.vehicles?.model} · <span className="font-mono-data">{rental.vehicles?.registration_number}</span>
                          </p>
                          <p className="font-mono-data text-sm text-[var(--muted)]">{formatDate(rental.start_date)} {rental.end_date ? `to ${formatDate(rental.end_date)}` : "- no end date"} · {money(rental.rental_rate)}</p>
                          <p className="font-mono-data mt-1 text-sm text-[var(--foreground-secondary)]">{rental.km_driven ? `${Number(rental.km_driven).toLocaleString()} km driven · ` : ""}{depositLabel(rental)}</p>
                        </div>
                        <Badge tone={RENTAL_STATUS[String(rental.status)]?.tone || "neutral"}>{RENTAL_STATUS[String(rental.status)]?.label || String(rental.status || "").replace(/_/g, " ")}</Badge>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <SectionHeader eyebrow="Transactions" title="What they have paid" />
              <div className="mt-3">
                <InfoTile label="Rent and charges paid so far" value={money(totalIncome)} />
              </div>
              <div className="mt-3 space-y-2">
                {detail.transactions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--border)] bg-white/70 p-3 text-sm text-[var(--muted)]">No payments recorded for this customer yet.</div>
                ) : (
                  detail.transactions.map((transaction) => (
                    <div className="rounded-lg border border-[var(--border)] bg-white p-3" key={transaction.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">{transactionName(transaction.type)}</p>
                          <p className="font-mono-data text-sm text-[var(--muted)]">{formatDate(transaction.transaction_date)} · {transaction.vehicles?.registration_number || "No vehicle"}</p>
                        </div>
                        <span
                          className={`font-mono-data font-semibold ${
                            isRawDepositTransaction({ isDeposit: Boolean((transaction as any).is_deposit), type: transaction.type }) ? "text-[#d97706]" : "text-[var(--primary)]"
                          }`}
                        >
                          {money(transaction.amount)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <div id="notes">
                <SectionHeader eyebrow="Notes" title="Internal notes" />
                <div className="mt-3">
                  <CustomerNotesForm customerId={customer.id} notes={customer.notes || ""} organizationId={organization.id} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
