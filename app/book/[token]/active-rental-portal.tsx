"use client";

import { customerDate } from "@/lib/i18n/customer-dates";
import { businessToday } from "@/lib/business-time";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarCheck, CalendarPlus, CheckCircle2, FileText, ImageIcon, MessageCircle } from "lucide-react";
import { submitCustomerPortalAction } from "@/app/actions/public-booking";
import type { PortalBundle, PortalPayment } from "@/lib/payment-receipts";
import { planFor, quoteStay, type Rates } from "@/lib/rental-estimate";
import { PortalPayments } from "./portal-payments";

type OpenEndedOffer = { monthlyRate: number; firstDue: string };
type ActionType = "extension_request" | "return_confirmation" | "problem_report" | "question";

const inputClass = "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function ActiveRentalPortal({
  token,
  organizationName,
  vehicle,
  rental,
  bookingData,
  signedContractUrl,
  certificateUrl,
  deliveryPhotoUrls,
  reports = [],
  receipts = [],
  ownerContact,
  payments = [],
  paymentBundle = null,
  orgPayment = null,
  endNoticeDays = 0,
  extensionRates = null,
  openEndedOffer = null,
  answers = []
}: {
  token: string;
  organizationName: string;
  vehicle: any;
  rental: any;
  bookingData: Record<string, unknown>;
  signedContractUrl?: string | null;
  certificateUrl?: string | null;
  deliveryPhotoUrls: string[];
  /** Signed handover and collection reports. */
  reports?: Array<{ id: string; kind: "handover" | "return"; swap: boolean; url: string }>;
  /** Receipts the business has issued for payments on this rental. */
  receipts?: Array<{ id: string; number: string; url: string }>;
  ownerContact?: string | null;
  payments?: PortalPayment[];
  paymentBundle?: PortalBundle | null;
  /** Days of notice the business asks for before a return. */
  endNoticeDays?: number;
  /** Rates used to price extra days. */
  extensionRates?: Rates | null;
  /** Set when the customer can switch to no end date at the monthly rate. */
  openEndedOffer?: OpenEndedOffer | null;
  orgPayment?: any;
  /** What the business answered to this customer's recent questions, problems and requests. */
  answers?: Array<{ id: string; type: string; declined: boolean; asked: string; reply: string; at: string }>;
}) {
  const t = useTranslations("customer");
  const locale = useLocale();
  const router = useRouter();
  const [openAction, setOpenAction] = useState<ActionType | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();
  const endDate = rental?.end_date || "";
  const minExtensionDate = nextDate(endDate);
  const deliveryLocation = String(bookingData.delivery_location || rental?.delivery_location || "");
  const countdown = returnCountdown(endDate, t);
  const vehicleName = [vehicle?.make, vehicle?.model, vehicle?.trim].filter(Boolean).join(" ");
  const actionCards = useMemo(
    () => [
      // A rental with no end date has nothing to extend.
      ...(endDate ? [{ type: "extension_request" as const, title: t("keepItLonger"), icon: CalendarPlus, description: t("keepItLongerHint") }] : []),
      { type: "return_confirmation" as const, title: t("confirmReturn"), icon: CalendarCheck, description: t("confirmReturnHint") },
      { type: "problem_report" as const, title: t("reportProblem"), icon: AlertTriangle, description: t("reportProblemHint") },
      { type: "question" as const, title: t("askQuestion"), icon: MessageCircle, description: t("askQuestionHint") }
    ],
    [endDate, t]
  );

  function submitAction(formData: FormData, successMessage: string) {
    startTransition(async () => {
      formData.set("token", token);
      const result = await submitCustomerPortalAction(formData);
      const extension = result.extension;
      if (extension?.applied && extension.openEnded) {
        const amount = `${extension.currency === "THB" ? "฿" : `${extension.currency} `}${extension.amount.toLocaleString("en-US")}`;
        setConfirmation(t("nowOpenEnded", { amount, date: niceDate(extension.dueDate, locale) }));
        router.refresh();
      } else if (extension?.applied) {
        const amount = `${extension.currency === "THB" ? "฿" : `${extension.currency} `}${extension.amount.toLocaleString("en-US")}`;
        setConfirmation(`${t("nowRunsUntil", { date: niceDate(extension.newEndDate, locale) })}${extension.amount > 0 ? ` ${t("extraDaysDue", { amount, date: niceDate(extension.dueDate, locale) })}` : ""}`);
        router.refresh();
      } else {
        setConfirmation(successMessage);
      }
      setOpenAction(null);
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="flex gap-4">
          <VehiclePhoto vehicle={vehicle} />
          <div className="min-w-0 flex-1">
            <span className="inline-flex rounded-full bg-[var(--success-light)] px-3 py-1 text-xs font-semibold uppercase text-[var(--success)]">{t("rentalIsActive")}</span>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{vehicleName || t("yourVehicle")}</h2>
            <p className="font-mono-data mt-1 text-sm font-bold text-[var(--muted)]">{vehicle?.registration_number || t("platePending")}</p>
            <p className={`mt-3 text-sm font-semibold ${countdown.overdue ? "text-[var(--danger)]" : countdown.today ? "text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}`}>
              {countdown.label}
            </p>
          </div>
        </div>
      </section>

      <PortalPayments bundle={paymentBundle} orgPayment={orgPayment} organizationName={organizationName} payments={payments} token={token} />

      {answers.length > 0 ? (
        <section className="rounded-2xl border border-[var(--info-line)] bg-[var(--primary-light)] p-4 shadow-sm">
          <p className="text-sm font-semibold text-[var(--foreground)]">{t("answersTitle", { business: organizationName })}</p>
          <ul className="mt-2 space-y-3">
            {answers.map((answer) => (
              <li className="rounded-xl bg-white p-3" key={answer.id}>
                {answer.asked ? <p className="text-xs text-[var(--muted)]"><bdi>{answer.asked}</bdi></p> : null}
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {answer.declined ? `${t("answerDeclined")} ` : ""}
                  <bdi>{answer.reply}</bdi>
                </p>
                {answer.at ? <p className="mt-1 text-xs text-[var(--muted)]">{niceDate(answer.at.slice(0, 10), locale)}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {confirmation ? (
        <p className="rounded-2xl border border-[var(--success-line)] bg-[var(--success-light)] p-4 text-sm font-bold text-[var(--success)]">{confirmation}</p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        {actionCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm" key={card.type}>
              <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpenAction(openAction === card.type ? null : card.type)} type="button">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                  <Icon size={22} />
                </span>
                <span>
                  <span className="block text-base font-semibold text-[var(--foreground)]">{card.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-[var(--muted)]">{card.description}</span>
                </span>
              </button>
              {openAction === card.type ? (
                <ActionForm
                  deliveryLocation={deliveryLocation}
                  endDate={endDate}
                  isPending={isPending}
                  endNoticeDays={endNoticeDays}
                  extensionRates={extensionRates}
                  openEndedOffer={openEndedOffer}
                  minExtensionDate={minExtensionDate}
                  onSubmit={submitAction}
                  organizationName={organizationName}
                  ownerContact={ownerContact}
                  type={card.type}
                />
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase text-[var(--primary)]">{t("yourRentalDocuments")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {signedContractUrl ? (
            <a className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-4 text-sm font-semibold text-[var(--foreground)]" href={signedContractUrl} rel="noreferrer" target="_blank">
              <FileText className="mb-2 text-[var(--primary)]" />
              {t("signedAgreement")}
            </a>
          ) : null}
          {certificateUrl ? (
            <a className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-4 text-sm font-semibold text-[var(--foreground)]" href={certificateUrl} rel="noreferrer" target="_blank">
              <FileText className="mb-2 text-[var(--primary)]" />
              {t("proofOfSigning")}
            </a>
          ) : null}
          {reports.map((report) => (
            <a className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-4 text-sm font-semibold text-[var(--foreground)]" href={report.url} key={report.id} rel="noreferrer" target="_blank">
              <FileText className="mb-2 text-[var(--primary)]" />
              {t(report.kind === "return" ? (report.swap ? "reportCollection" : "reportReturn") : report.swap ? "reportHandoverSwap" : "reportHandover")}
            </a>
          ))}
          {receipts.map((receipt) => (
            <a className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-4 text-sm font-semibold text-[var(--foreground)]" href={receipt.url} key={receipt.id} rel="noreferrer" target="_blank">
              <FileText className="mb-2 text-[var(--primary)]" />
              {t("receiptNumbered", { number: receipt.number })}
            </a>
          ))}
          {deliveryPhotoUrls.length ? (
            deliveryPhotoUrls.map((url, index) => (
              <a className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-4 text-sm font-semibold text-[var(--foreground)]" href={url} key={url} rel="noreferrer" target="_blank">
                <ImageIcon className="mb-2 text-[var(--primary)]" />
                {t("handoverPhoto", { number: index + 1 })}
              </a>
            ))
          ) : null}
          {!signedContractUrl && deliveryPhotoUrls.length === 0 ? <p className="text-sm text-[var(--muted)]">{t("documentsWillAppear")}</p> : null}
        </div>
      </section>
    </div>
  );
}

function ActionForm({
  type,
  endDate,
  minExtensionDate,
  endNoticeDays = 0,
  extensionRates = null,
  openEndedOffer = null,
  deliveryLocation,
  isPending,
  onSubmit,
  organizationName,
  ownerContact
}: {
  type: ActionType;
  endDate: string;
  minExtensionDate: string;
  endNoticeDays?: number;
  extensionRates?: Rates | null;
  openEndedOffer?: OpenEndedOffer | null;
  deliveryLocation: string;
  isPending: boolean;
  organizationName: string;
  ownerContact?: string | null;
  onSubmit: (formData: FormData, successMessage: string) => void;
}) {
  const t = useTranslations("customer");
  const locale = useLocale();
  const [newEnd, setNewEnd] = useState("");
  const [noEnd, setNoEnd] = useState(false);
  const extraDays = endDate && newEnd > endDate ? Math.round((new Date(`${newEnd}T00:00:00Z`).getTime() - new Date(`${String(endDate).slice(0, 10)}T00:00:00Z`).getTime()) / 86_400_000) : 0;
  const extensionQuote = extensionRates && extraDays > 0 ? quoteStay(extensionRates, extraDays) : null;
  if (type === "extension_request") {
    return (
      <form action={(formData) => onSubmit(formData, t("requestSent", { business: organizationName }))} className="mt-4 space-y-3">
        <input name="actionType" type="hidden" value="extension_request" />
        {openEndedOffer ? (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--panel-secondary)] p-1 text-sm font-semibold">
            <button className={`min-h-11 rounded-lg px-2 ${!noEnd ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`} onClick={() => setNoEnd(false)} type="button">
              {t("untilADate")}
            </button>
            <button className={`min-h-11 rounded-lg px-2 ${noEnd ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`} onClick={() => setNoEnd(true)} type="button">
              {t("monthlyOpenEnded")}
            </button>
          </div>
        ) : null}
        {noEnd && openEndedOffer ? (
          <>
            <input name="openEnded" type="hidden" value="true" />
            <p className="rounded-xl bg-[var(--primary-light)] p-3 text-sm leading-6 text-[var(--foreground)]">
              {t.rich(endNoticeDays > 0 ? "openEndedOfferNotice" : "openEndedOffer", { amount: `฿${openEndedOffer.monthlyRate.toLocaleString("en-US")}`, date: niceDate(openEndedOffer.firstDue, locale), days: endNoticeDays, b: (chunks) => <span className="font-semibold">{chunks}</span> })}
            </p>
          </>
        ) : (
          <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
            {t("newReturnDate")}
            <input className={inputClass} min={minExtensionDate} name="newEndDate" onChange={(event) => setNewEnd(event.target.value)} required type="date" value={newEnd} />
          </label>
        )}
        {!noEnd && extensionQuote && extensionRates && planFor(extensionRates, extraDays) ? (
          <p className="rounded-xl bg-[var(--primary-light)] p-3 text-sm text-[var(--foreground)]">
            {t.rich("extensionPrice", { amount: `฿${extensionQuote.amount.toLocaleString("en-US")}`, days: extraDays, b: (chunks) => <span className="font-semibold">{chunks}</span> })}
          </p>
        ) : !noEnd && extraDays > 0 ? (
          // No rate meant for a stay this short (or no rates at all): the business sets the price, so none is promised here.
          <p className="rounded-xl bg-[var(--panel-secondary)] p-3 text-sm text-[var(--foreground-secondary)]">
            {t("priceToBeConfirmed", { business: organizationName, days: extraDays })}
          </p>
        ) : null}
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          {t("noteOptional")}
          <textarea className={inputClass} name="note" />
        </label>
        <SubmitButton isPending={isPending} label={t("sendRequest")} />
      </form>
    );
  }

  if (type === "return_confirmation") {
    // A return date already agreed stays available even inside the notice period.
    const earliestReturn = addDaysLocal(today(), endNoticeDays);
    return (
      <form action={(formData) => onSubmit(formData, t("returnConfirmed", { date: niceDate(String(formData.get("returnDate") || endDate).slice(0, 10), locale), place: String(formData.get("returnLocation") || deliveryLocation || t("theAgreedPlace")) }))} className="mt-4 space-y-3">
        <input name="actionType" type="hidden" value="return_confirmation" />
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          {t("returnDate")}
          <input className={inputClass} defaultValue={endDate && endDate >= earliestReturn ? endDate : earliestReturn} min={endDate && endDate < earliestReturn ? endDate : earliestReturn} name="returnDate" required type="date" />
          {endNoticeDays > 0 ? <span className="mt-1 block text-xs font-normal text-[var(--muted)]">{t("noticeBeforeReturning", { days: endNoticeDays })}</span> : null}
        </label>
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          {t("returnTime")}
          <input className={inputClass} name="returnTime" required type="time" />
        </label>
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          {t("returnPlace")}
          <input className={inputClass} defaultValue={deliveryLocation} name="returnLocation" />
        </label>
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          {t("noteOptional")}
          <textarea className={inputClass} name="note" />
        </label>
        <SubmitButton isPending={isPending} label={t("confirmReturn")} />
      </form>
    );
  }

  if (type === "problem_report") {
    return (
      <form action={(formData) => onSubmit(formData, ownerContact ? t("problemSentUrgent", { business: organizationName, contact: ownerContact }) : t("problemSent", { business: organizationName }))} className="mt-4 space-y-3">
        <input name="actionType" type="hidden" value="problem_report" />
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          {t("whatKindOfProblem")}
          <select className={inputClass} name="category" required>
            {/* The business reads these in English whatever language the customer picked. */}
            <option value="Breakdown">{t("problemBreakdown")}</option>
            <option value="Damage">{t("problemDamage")}</option>
            <option value="Other mechanical issue">{t("problemMechanical")}</option>
            <option value="Other">{t("problemOther")}</option>
          </select>
        </label>
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          {t("whatHappened")}
          <textarea className={inputClass} name="description" required />
        </label>
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          {t("photoOptional")}
          <input accept="image/*" className={inputClass} name="photo" type="file" />
        </label>
        <SubmitButton isPending={isPending} label={t("sendReport")} />
      </form>
    );
  }

  return (
    <form action={(formData) => onSubmit(formData, t("questionSent"))} className="mt-4 space-y-3">
      <input name="actionType" type="hidden" value="question" />
      <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
        {t("yourQuestion")}
        <textarea className={inputClass} name="question" required />
      </label>
      <SubmitButton isPending={isPending} label={t("sendQuestion")} />
    </form>
  );
}

function SubmitButton({ isPending, label }: { isPending: boolean; label: string }) {
  const t = useTranslations("customer");
  return (
    <button className="pressable min-h-12 w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
      {isPending ? t("sending") : label}
    </button>
  );
}

function VehiclePhoto({ vehicle }: { vehicle: any }) {
  const photo = Array.isArray(vehicle?.photos) ? vehicle.photos[0] : vehicle?.photo_url;
  if (photo) {
    return <img alt="Vehicle" className="h-24 w-24 rounded-2xl object-cover" src={typeof photo === "string" ? photo : photo.url} />;
  }
  return (
    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)]">
      <ImageIcon size={32} />
    </span>
  );
}

function returnCountdown(endDate: string | null | undefined, t: ReturnType<typeof useTranslations>) {
  if (!endDate) return { label: t("noReturnDate"), overdue: false, today: false };
  const todayDate = new Date();
  const target = new Date(endDate);
  todayDate.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.ceil((target.getTime() - todayDate.getTime()) / 86_400_000);
  if (days < 0) return { label: t("daysOverdue", { days: Math.abs(days) }), overdue: true, today: false };
  if (days === 0) return { label: t("dueBackToday"), overdue: false, today: true };
  return { label: t("dueBackInDays", { days }), overdue: false, today: false };
}

function today() {
  return businessToday();
}

/** "2026-11-04" -> "4 Nov 2026". */
function niceDate(iso: string, locale = "en") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return customerDate(iso, locale);
}

function addDaysLocal(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
