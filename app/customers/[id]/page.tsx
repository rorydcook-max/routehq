import Link from "next/link";
import type { Route } from "next";
import { useLocale, useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { FileText, MessageCircle, PenLine, Phone, Plus } from "lucide-react";
import { updateCustomer, uploadCustomerDocument } from "@/app/actions/customers";
import { CustomerNotesForm } from "@/app/customers/[id]/customer-notes-form";
import { AppShell } from "@/components/app-shell";
import { CommunicationPanel } from "@/components/communication-panel";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, Fold } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { businessToday } from "@/lib/business-time";
import { commonCountries, customerLanguages, flagForNationality } from "@/lib/customer-options";
import { getCustomerDetail, getCustomerDocumentCompleteness, type CustomerDetail } from "@/lib/customer-detail";
import { longDate } from "@/lib/i18n/dates";
import { getDefaultOrganization } from "@/lib/organization";
import { amountDueNowByRental } from "@/lib/rental-balances";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRawDepositTransaction, isRevenueTransaction } from "@/lib/transaction-options";

// The wording for this page is in locales/<language>/common.json under "customerPage".
type Say = (key: string, values?: Record<string, string | number>) => string;
type Cx = { say: Say; locale: string };

/** For the parts of the page that are not async. */
function useCx(): Cx {
  return { say: useTranslations("customerPage") as unknown as Say, locale: useLocale() };
}

const inputClass = "mt-1 w-full";
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

const STATUS_TONE: Record<string, "neutral" | "green" | "amber" | "red" | "blue"> = {
  booked: "amber",
  active: "blue",
  due_soon: "blue",
  extended: "blue",
  overdue: "red",
  completed: "green",
  cancelled: "neutral"
};

function money(value: unknown) {
  return `฿${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
}

function formatDate(value: string | null | undefined, cx: Cx) {
  return value ? longDate(String(value).slice(0, 10), cx.locale) : cx.say("notSet");
}

/** Whole days from today (Thailand) to a date; negative when it has passed. */
function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const target = Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  return Math.round((target - Date.parse(`${businessToday()}T00:00:00Z`)) / 86_400_000);
}

function depositLabel(rental: any, cx: Cx) {
  switch (String(rental?.deposit_status || "")) {
    case "received":
      return cx.say("dep_held", { amount: money(rental.deposit_held) });
    case "fully_returned":
      return cx.say("dep_returned");
    case "partially_returned":
      return cx.say("dep_partReturned", { amount: money(rental.deposit_refunded_amount) });
    case "forfeited":
      return cx.say("dep_kept");
    case "partially_forfeited":
      return cx.say("dep_partKept", { amount: money(rental.deposit_forfeited_amount) });
    default:
      return Number(rental?.deposit_amount || 0) > 0 ? cx.say("dep_notCollected") : cx.say("dep_none");
  }
}

function vehicleName(vehicle: any) {
  return [vehicle?.make, vehicle?.model].filter(Boolean).join(" ");
}

function InfoTile({ label, value, danger = false }: { label: string; value: React.ReactNode; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
      <p className="font-semibold text-[var(--muted)]">{label}</p>
      <p className={`mt-0.5 text-[17px] font-bold leading-tight ${danger ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{value}</p>
    </div>
  );
}

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

function ActiveRentalCard({ rental, customerId, dueNow }: { rental: any; customerId: string; dueNow: number }) {
  const cx = useCx();
  const days = daysUntil(rental.end_date);
  const late = days !== null && days < 0;
  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--muted)]">{rental.status === "booked" ? cx.say("r_booked") : cx.say("r_renting")}</p>
          <p className="text-[20px] font-bold leading-tight text-[var(--foreground)]">{vehicleName(rental.vehicles)}</p>
        </div>
        <p className={`shrink-0 whitespace-nowrap font-bold ${late ? "text-[var(--danger)]" : "text-[var(--foreground-secondary)]"}`}>
          {days === null ? cx.say("r_openEnded") : late ? cx.say("r_daysLate", { count: Math.abs(days) }) : cx.say("r_daysLeft", { count: days })}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <InfoTile
          label={cx.say("r_period")}
          value={rental.end_date ? cx.say("r_range", { from: formatDate(rental.start_date, cx), to: formatDate(rental.end_date, cx) }) : cx.say("r_rangeOpen", { from: formatDate(rental.start_date, cx) })}
        />
        <InfoTile danger={dueNow > 0} label={cx.say("r_dueNow")} value={dueNow > 0 ? money(dueNow) : cx.say("r_nothing")} />
      </div>
      <div className="mt-3 grid gap-2 sm:flex">
        <Link className="primary-action pressable" href={`/bookings/${rental.id}` as Route}>
          {cx.say("r_open")}
        </Link>
        <Link className="secondary-action pressable" href={`/transactions/new?customerId=${customerId}` as Route}>
          {cx.say("r_recordPayment")}
        </Link>
      </div>
    </section>
  );
}

function DetailsForm({ customer, organizationId }: { customer: any; organizationId: string }) {
  const cx = useCx();
  const day = (value: unknown) => String(value || "").slice(0, 10);
  return (
    <form action={updateCustomer} className="grid gap-3 sm:grid-cols-2">
      <input name="customerId" type="hidden" value={customer.id} />
      <input name="organizationId" type="hidden" value={organizationId} />
      <datalist id="customer-country-options">
        {commonCountries.map((country) => (
          <option key={country.code} value={country.name}>
            {country.flag} {country.country}
          </option>
        ))}
      </datalist>
      <label className="block sm:col-span-2">
        <span className={labelClass}>{cx.say("f_name")}</span>
        <input className={inputClass} defaultValue={customer.full_name || ""} name="fullName" required />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("f_phone")}</span>
        <input className={inputClass} defaultValue={customer.phone || ""} inputMode="tel" name="phone" placeholder="+66812345678" type="tel" />
        <span className="mt-1 block font-medium text-[var(--muted)]">{cx.say("f_phoneHint")}</span>
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("f_email")}</span>
        <input className={inputClass} defaultValue={customer.email || ""} name="email" type="email" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("f_nationality")}</span>
        <input className={inputClass} defaultValue={customer.nationality || ""} list="customer-country-options" name="nationality" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("f_language")}</span>
        <select className={inputClass} defaultValue={customer.preferred_locale || "en"} name="preferredLocale">
          {customerLanguages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("f_passportNo")}</span>
        <input className={inputClass} defaultValue={customer.passport_number || ""} name="passportNumber" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("f_passportExpiry")}</span>
        <input className={inputClass} defaultValue={day(customer.passport_expiry)} name="passportExpiry" type="date" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("f_licenceNo")}</span>
        <input className={inputClass} defaultValue={customer.driver_license_number || ""} name="driverLicenseNumber" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("f_licenceExpiry")}</span>
        <input className={inputClass} defaultValue={day(customer.driver_license_expiry)} name="driverLicenseExpiry" type="date" />
      </label>
      <label className="block sm:col-span-2">
        <span className={labelClass}>{cx.say("f_licenceCountry")}</span>
        <input className={inputClass} defaultValue={customer.driver_license_country || ""} list="customer-country-options" name="driverLicenseCountry" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("f_emName")}</span>
        <input className={inputClass} defaultValue={customer.emergency_contact_name || ""} name="emergencyContactName" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("f_emPhone")}</span>
        <input className={inputClass} defaultValue={customer.emergency_contact_phone || ""} inputMode="tel" name="emergencyContactPhone" placeholder="+66812345678" type="tel" />
      </label>
      <PendingButton className="primary-action sm:col-span-2" pendingLabel={cx.say("saving")} type="submit">
        {cx.say("save")}
      </PendingButton>
    </form>
  );
}

function ContactChannelsForm({ customer, organizationId }: { customer: any; organizationId: string }) {
  const cx = useCx();
  const methods = ["whatsapp", "messenger", "line", "telegram", "sms", "email", "phone"];
  return (
    <form action={updateCustomer} className="grid gap-3 sm:grid-cols-2">
      <input name="customerId" type="hidden" value={customer.id} />
      <input name="organizationId" type="hidden" value={organizationId} />
      <label className="block">
        <span className={labelClass}>{cx.say("ch_whatsapp")}</span>
        <input className={inputClass} defaultValue={customer.whatsapp_number || ""} name="whatsappNumber" placeholder="+66812345678" type="tel" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("ch_line")}</span>
        <input className={inputClass} defaultValue={customer.line_id || ""} name="lineId" placeholder="@lineid" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("ch_messenger")}</span>
        <input className={inputClass} defaultValue={customer.messenger_id || ""} name="messengerId" placeholder="m.me/username" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("ch_telegram")}</span>
        <input className={inputClass} defaultValue={customer.telegram_username || ""} name="telegramUsername" placeholder="@username" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("ch_instagram")}</span>
        <input className={inputClass} defaultValue={customer.instagram_handle || ""} name="instagramHandle" placeholder="@username" />
      </label>
      <label className="block">
        <span className={labelClass}>{cx.say("ch_preferred")}</span>
        <select className={inputClass} defaultValue={preferredContactMethod(customer)} name="preferredContactMethod">
          {methods.map((method) => (
            <option key={method} value={method}>
              {cx.say(`m_${method}`)}
            </option>
          ))}
        </select>
      </label>
      <PendingButton className="primary-action sm:col-span-2" pendingLabel={cx.say("saving")} type="submit">
        {cx.say("save")}
      </PendingButton>
    </form>
  );
}

type CustomerFile = CustomerDetail["documentsWithUrls"][number];

function fileKind(category: string) {
  const value = category.toLowerCase().replace(/[\s-]+/g, "_");
  if (value.includes("passport")) return "passport";
  if (value.includes("license") || value.includes("licence")) return "driver_license";
  if (value.includes("selfie") || value.includes("photo")) return "selfie";
  return "other";
}

function FileThumb({ file }: { file: CustomerFile }) {
  const cx = useCx();
  return (
    <a className="block w-24 shrink-0" href={file.url || "#"} rel="noopener noreferrer" target="_blank" title={cx.say("doc_added", { date: formatDate(file.createdAt, cx) })}>
      {file.mimeType?.startsWith("image/") && file.url ? (
        <img alt={file.fileName} className="h-24 w-24 rounded-xl object-cover" src={file.url} />
      ) : (
        <span className="flex h-24 w-24 items-center justify-center rounded-xl bg-white text-[var(--primary)]">
          <FileText size={26} />
        </span>
      )}
    </a>
  );
}

function DocumentRow({ kind, files, customerId, organizationId }: { kind: "passport" | "driver_license" | "selfie"; files: CustomerFile[]; customerId: string; organizationId: string }) {
  const cx = useCx();
  const have = files.length > 0;
  return (
    <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{cx.say(`doc_${kind}`)}</p>
        <span className={`font-bold ${have ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{have ? cx.say("doc_have") : cx.say("doc_need")}</span>
      </div>
      {have ? (
        <div className="mt-2.5 flex gap-2 overflow-x-auto">
          {files.map((file) => (
            <FileThumb file={file} key={file.id} />
          ))}
        </div>
      ) : null}
      <details className="mt-2.5">
        <summary className="cursor-pointer font-bold text-[var(--primary)]">{have ? cx.say("doc_addAnother") : cx.say("doc_add")}</summary>
        <form action={uploadCustomerDocument} className="mt-3 grid gap-3">
          <input name="customerId" type="hidden" value={customerId} />
          <input name="organizationId" type="hidden" value={organizationId} />
          <input name="category" type="hidden" value={kind} />
          <input accept={kind === "selfie" ? "image/*" : "image/*,application/pdf"} className="w-full" name="documentFile" required type="file" />
          <PendingButton className="primary-action" pendingLabel={cx.say("doc_uploading")} type="submit">
            {cx.say("doc_upload")}
          </PendingButton>
        </form>
      </details>
    </div>
  );
}

function RentalsSection({ detail }: { detail: CustomerDetail }) {
  const cx = useCx();
  const bookingWords = useTranslations("bookings");
  const statusName = (status: string) => (bookingWords.has(`status_${status}` as never) ? (bookingWords as unknown as Say)(`status_${status}`) : status.replace(/_/g, " "));
  return (
    <Fold summary={cx.say("h_summary", { count: detail.rentals.length })} title={cx.say("h_title")}>
      {detail.rentals.length === 0 ? (
        <p className="font-medium text-[var(--foreground-secondary)]">{cx.say("h_none")}</p>
      ) : (
        <div className="grid gap-2.5">
          <div className="grid grid-cols-3 gap-2.5">
            <InfoTile label={cx.say("h_days")} value={detail.totalRentalDays} />
            <InfoTile label={cx.say("h_paid")} value={money(detail.lifetimeRevenue)} />
            <InfoTile label={cx.say("h_usual")} value={cx.say("h_usualDays", { count: detail.averageRentalDuration })} />
          </div>
          {detail.rentals.map((rental) => (
            <Link className="pressable block rounded-xl bg-[var(--panel-secondary)] p-3.5" href={`/bookings/${rental.id}` as Route} key={rental.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{vehicleName(rental.vehicles)}</p>
                <Badge tone={STATUS_TONE[String(rental.status)] || "neutral"}>{statusName(String(rental.status || ""))}</Badge>
              </div>
              <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">
                {rental.end_date ? cx.say("r_range", { from: formatDate(rental.start_date, cx), to: formatDate(rental.end_date, cx) }) : cx.say("h_from", { date: formatDate(rental.start_date, cx) })}
                {` · ${depositLabel(rental, cx)}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </Fold>
  );
}

function PaymentsSection({ detail, totalIncome }: { detail: CustomerDetail; totalIncome: number }) {
  const cx = useCx();
  const moneyWords = useTranslations("money");
  const typeName = (type: string) => (moneyWords.has(`type_${type}` as never) ? (moneyWords as unknown as Say)(`type_${type}`) : type.replace(/_/g, " "));
  return (
    <Fold summary={detail.transactions.length === 0 ? cx.say("n_none") : cx.say("p_summary", { amount: money(totalIncome) })} title={cx.say("p_title")}>
      {detail.transactions.length === 0 ? (
        <p className="font-medium text-[var(--foreground-secondary)]">{cx.say("p_none")}</p>
      ) : (
        <div className="grid gap-2.5">
          {detail.transactions.map((transaction) => (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5" key={transaction.id}>
              <div className="min-w-0">
                <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{typeName(String(transaction.type))}</p>
                <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">
                  {formatDate(transaction.transaction_date, cx)}
                  {transaction.vehicles ? ` · ${vehicleName(transaction.vehicles) || transaction.vehicles.registration_number || ""}` : ""}
                </p>
              </div>
              <span className={`shrink-0 text-[17px] font-bold ${isRawDepositTransaction({ isDeposit: Boolean((transaction as any).is_deposit), type: transaction.type }) ? "text-[var(--foreground-secondary)]" : "text-[var(--foreground)]"}`}>
                {money(transaction.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Fold>
  );
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const detail = await getCustomerDetail(id, organization.id);
  const cx: Cx = { say: (await getTranslations("customerPage")) as unknown as Say, locale: await getLocale() };

  if (!detail) {
    return (
      <AppShell userEmail={userEmail}>
        <div className="mx-auto max-w-2xl">
          <Card className="p-5">
            <h1 className="text-[22px] font-bold text-[var(--foreground)]">{cx.say("notFoundTitle")}</h1>
            <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{cx.say("notFoundBody")}</p>
            <Link className="primary-action pressable mt-4" href="/customers">
              {cx.say("backToList")}
            </Link>
          </Card>
        </div>
      </AppShell>
    );
  }

  const { customer } = detail;
  const completeness = getCustomerDocumentCompleteness(detail.documents);
  // Everything they have on the go, what is out on the road first.
  const currentRentals = [...detail.activeRentals].sort((left, right) => Number(left.status === "booked") - Number(right.status === "booked"));
  const activeRental = currentRentals[0] || detail.activeRental;
  // Income only: deposits are held and returned, so they are not income.
  const totalIncome = detail.transactions
    .filter((transaction: any) => !transaction.voided && isRevenueTransaction({ amount: Math.abs(Number(transaction.amount || 0)), isDeposit: Boolean(transaction.is_deposit), type: transaction.type }))
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const dueByRental = currentRentals.length > 0 ? await amountDueNowByRental(await createSupabaseServerClient(), currentRentals.map((rental) => rental.id)) : new Map<string, number>();
  const dueNow = activeRental ? dueByRental.get(activeRental.id) || 0 : 0;

  const phoneDigits = String(customer.whatsapp_number || customer.phone || "").replace(/\D/g, "");
  const filesByKind = { passport: [] as CustomerFile[], driver_license: [] as CustomerFile[], selfie: [] as CustomerFile[], other: [] as CustomerFile[] };
  for (const file of detail.documentsWithUrls) filesByKind[fileKind(file.category) as keyof typeof filesByKind].push(file);
  const missingDocs = [
    completeness.hasPassport ? null : cx.say("doc_passport"),
    completeness.hasLicense ? null : cx.say("doc_driver_license"),
    completeness.hasSelfie ? null : cx.say("doc_selfie")
  ].filter(Boolean) as string[];
  const missingDetails = [customer.phone, customer.nationality, customer.passport_number, customer.driver_license_number, customer.emergency_contact_name].filter((value) => !value).length;
  const licenceDays = daysUntil(customer.driver_license_expiry);
  const passportDays = daysUntil(customer.passport_expiry);
  const docsTone = completeness.status === "complete" ? "green" : completeness.status === "none" ? "red" : "amber";

  return (
    <AppShell userEmail={userEmail}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 font-bold text-[var(--muted)]">
          <Link className="text-[var(--primary)]" href="/customers">
            {cx.say("back")}
          </Link>
          <span>/</span>
          <span>{customer.full_name}</span>
        </div>

        <Card className="p-4">
          <Badge tone={docsTone}>{completeness.status === "complete" ? cx.say("docsOk") : completeness.status === "none" ? cx.say("docsNone") : cx.say("docsMissing")}</Badge>
          <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.01em] text-[var(--foreground)]">{customer.full_name}</h1>
          <p className="mt-1 text-[17px] font-semibold text-[var(--foreground-secondary)]">
            {customer.nationality ? `${flagForNationality(customer.nationality)} ${customer.nationality}` : cx.say("noNationality")}
            {customer.phone ? ` · ${customer.phone}` : ""}
          </p>
          {licenceDays !== null && licenceDays < 0 ? <p className="mt-1 font-bold text-[var(--danger)]">{cx.say("warnLicence", { date: formatDate(customer.driver_license_expiry, cx) })}</p> : null}
          {passportDays !== null && passportDays < 0 ? <p className="mt-1 font-bold text-[var(--danger)]">{cx.say("warnPassport", { date: formatDate(customer.passport_expiry, cx) })}</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link className="primary-action pressable col-span-2" href={`/bookings/new?customerId=${customer.id}` as Route}>
              <Plus size={18} />
              {cx.say("newBooking")}
            </Link>
            {customer.phone ? (
              <a className="secondary-action pressable" href={`tel:${customer.phone}`}>
                <Phone size={17} />
                {cx.say("call")}
              </a>
            ) : null}
            {phoneDigits.length >= 8 ? (
              <a className="secondary-action pressable" href={`https://wa.me/${phoneDigits}`} rel="noopener noreferrer" target="_blank">
                <MessageCircle size={17} />
                {cx.say("whatsapp")}
              </a>
            ) : null}
            <a className="secondary-action pressable" href="#details">
              <PenLine size={17} />
              {cx.say("editDetails")}
            </a>
          </div>
        </Card>

        {currentRentals.map((rental) => (
          <ActiveRentalCard customerId={customer.id} dueNow={dueByRental.get(rental.id) || 0} key={rental.id} rental={rental} />
        ))}

        <div className="grid items-start gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <Fold
              open={completeness.status !== "complete"}
              summary={completeness.status === "complete" ? cx.say("docs_ok") : cx.say("docs_missing", { list: missingDocs.join(", ") })}
              title={cx.say("docs_title")}
              tone={completeness.status === "complete" ? "green" : "amber"}
            >
              <div className="grid gap-2.5">
                <DocumentRow customerId={customer.id} files={filesByKind.passport} kind="passport" organizationId={organization.id} />
                <DocumentRow customerId={customer.id} files={filesByKind.driver_license} kind="driver_license" organizationId={organization.id} />
                <DocumentRow customerId={customer.id} files={filesByKind.selfie} kind="selfie" organizationId={organization.id} />
                {filesByKind.other.length > 0 ? (
                  <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
                    <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{cx.say("doc_other")}</p>
                    <div className="mt-2.5 flex gap-2 overflow-x-auto">
                      {filesByKind.other.map((file) => (
                        <FileThumb file={file} key={file.id} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Fold>

            <Fold id="details" summary={missingDetails > 0 ? cx.say("d_missing", { count: missingDetails }) : cx.say("d_ok")} title={cx.say("d_title")}>
              <DetailsForm customer={customer} organizationId={organization.id} />
            </Fold>

            <Fold summary={cx.say("ch_summary")} title={cx.say("ch_title")}>
              <ContactChannelsForm customer={customer} organizationId={organization.id} />
            </Fold>
          </div>

          <div className="space-y-3">
            <Fold summary={cx.say("msg_summary")} title={cx.say("msg_title")}>
              <CommunicationPanel
                booking={{
                  vehicle_id: activeRental?.vehicle_id || activeRental?.vehicles?.id || null,
                  vehicle_make_model: activeRental?.vehicles ? vehicleName(activeRental.vehicles) : cx.say("msg_noRental"),
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
            </Fold>

            <RentalsSection detail={detail} />
            <PaymentsSection detail={detail} totalIncome={totalIncome} />

            <Fold id="notes" open={Boolean(customer.notes)} summary={customer.notes ? undefined : cx.say("n_none")} title={cx.say("n_title")}>
              <CustomerNotesForm customerId={customer.id} notes={customer.notes || ""} organizationId={organization.id} />
            </Fold>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
