"use client";

import { businessToday } from "@/lib/business-time";
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
  ownerContact,
  payments = [],
  paymentBundle = null,
  orgPayment = null,
  endNoticeDays = 0,
  extensionRates = null,
  openEndedOffer = null
}: {
  token: string;
  organizationName: string;
  vehicle: any;
  rental: any;
  bookingData: Record<string, unknown>;
  signedContractUrl?: string | null;
  certificateUrl?: string | null;
  deliveryPhotoUrls: string[];
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
}) {
  const router = useRouter();
  const [openAction, setOpenAction] = useState<ActionType | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();
  const endDate = rental?.end_date || "";
  const minExtensionDate = nextDate(endDate);
  const deliveryLocation = String(bookingData.delivery_location || rental?.delivery_location || "");
  const countdown = returnCountdown(endDate);
  const vehicleName = [vehicle?.make, vehicle?.model, vehicle?.trim].filter(Boolean).join(" ");
  const actionCards = useMemo(
    () => [
      // A rental with no end date has nothing to extend.
      ...(endDate ? [{ type: "extension_request" as const, title: "Keep it longer", icon: CalendarPlus, description: "Choose a new return date, or switch to a monthly open-ended rental." }] : []),
      { type: "return_confirmation" as const, title: "Confirm return", icon: CalendarCheck, description: "Tell us when and where you will return." },
      { type: "problem_report" as const, title: "Report a problem", icon: AlertTriangle, description: "Breakdown, damage, or a rental issue." },
      { type: "question" as const, title: "Ask a question", icon: MessageCircle, description: "Send a quick question to the operator." }
    ],
    [endDate]
  );

  function submitAction(formData: FormData, successMessage: string) {
    startTransition(async () => {
      formData.set("token", token);
      const result = await submitCustomerPortalAction(formData);
      const extension = result.extension;
      if (extension?.applied && extension.openEnded) {
        const amount = `${extension.currency === "THB" ? "฿" : `${extension.currency} `}${extension.amount.toLocaleString("en-US")}`;
        setConfirmation(`Done. Your rental is now monthly and open-ended. ${amount} is due each month from ${niceDate(extension.dueDate)}; you can pay it from this page.`);
        router.refresh();
      } else if (extension?.applied) {
        const amount = `${extension.currency === "THB" ? "฿" : `${extension.currency} `}${extension.amount.toLocaleString("en-US")}`;
        setConfirmation(`Done. Your rental now runs until ${niceDate(extension.newEndDate)}.${extension.amount > 0 ? ` ${amount} for the extra days is due on ${niceDate(extension.dueDate)}; you can pay it from this page.` : ""}`);
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
            <span className="inline-flex rounded-full bg-[#f0fdf4] px-3 py-1 text-xs font-semibold uppercase text-[#16a34a]">Your rental is active</span>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{vehicleName || "Your vehicle"}</h2>
            <p className="font-mono-data mt-1 text-sm font-bold text-[var(--muted)]">{vehicle?.registration_number || "Plate pending"}</p>
            <p className={`mt-3 text-sm font-semibold ${countdown.overdue ? "text-[#dc2626]" : countdown.today ? "text-[#d97706]" : "text-[var(--foreground-secondary)]"}`}>
              {countdown.label}
            </p>
          </div>
        </div>
      </section>

      <PortalPayments bundle={paymentBundle} orgPayment={orgPayment} organizationName={organizationName} payments={payments} token={token} />

      {confirmation ? (
        <p className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm font-bold text-[#166534]">{confirmation}</p>
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
        <p className="text-xs font-semibold uppercase text-[var(--primary)]">Your rental documents</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {signedContractUrl ? (
            <a className="rounded-xl border border-[var(--border)] bg-[#fbfaf8] p-4 text-sm font-semibold text-[var(--foreground)]" href={signedContractUrl} rel="noreferrer" target="_blank">
              <FileText className="mb-2 text-[var(--primary)]" />
              Signed rental agreement
            </a>
          ) : null}
          {certificateUrl ? (
            <a className="rounded-xl border border-[var(--border)] bg-[#fbfaf8] p-4 text-sm font-semibold text-[var(--foreground)]" href={certificateUrl} rel="noreferrer" target="_blank">
              <FileText className="mb-2 text-[var(--primary)]" />
              Signing certificate
            </a>
          ) : null}
          {deliveryPhotoUrls.length ? (
            deliveryPhotoUrls.map((url, index) => (
              <a className="rounded-xl border border-[var(--border)] bg-[#fbfaf8] p-4 text-sm font-semibold text-[var(--foreground)]" href={url} key={url} rel="noreferrer" target="_blank">
                <ImageIcon className="mb-2 text-[var(--primary)]" />
                Delivery photo {index + 1}
              </a>
            ))
          ) : null}
          {!signedContractUrl && deliveryPhotoUrls.length === 0 ? <p className="text-sm text-[var(--muted)]">Documents will appear here when available.</p> : null}
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
  const [newEnd, setNewEnd] = useState("");
  const [noEnd, setNoEnd] = useState(false);
  const extraDays = endDate && newEnd > endDate ? Math.round((new Date(`${newEnd}T00:00:00Z`).getTime() - new Date(`${String(endDate).slice(0, 10)}T00:00:00Z`).getTime()) / 86_400_000) : 0;
  const extensionQuote = extensionRates && extraDays > 0 ? quoteStay(extensionRates, extraDays) : null;
  if (type === "extension_request") {
    return (
      <form action={(formData) => onSubmit(formData, `Request sent. ${organizationName} will confirm shortly.`)} className="mt-4 space-y-3">
        <input name="actionType" type="hidden" value="extension_request" />
        {openEndedOffer ? (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f5f4f1] p-1 text-sm font-semibold">
            <button className={`min-h-11 rounded-lg px-2 ${!noEnd ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`} onClick={() => setNoEnd(false)} type="button">
              Until a date
            </button>
            <button className={`min-h-11 rounded-lg px-2 ${noEnd ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`} onClick={() => setNoEnd(true)} type="button">
              Monthly, open-ended
            </button>
          </div>
        ) : null}
        {noEnd && openEndedOffer ? (
          <>
            <input name="openEnded" type="hidden" value="true" />
            <p className="rounded-xl bg-[var(--primary-light)] p-3 text-sm leading-6 text-[var(--foreground)]">
              <span className="font-semibold">฿{openEndedOffer.monthlyRate.toLocaleString("en-US")} a month</span>, from {niceDate(openEndedOffer.firstDue)}. No return date: it renews each month until you tell us you are returning the vehicle
              {endNoticeDays > 0 ? `, with at least ${endNoticeDays} ${endNoticeDays === 1 ? "day" : "days"} notice` : ""}.
            </p>
          </>
        ) : (
          <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
            New return date
            <input className={inputClass} min={minExtensionDate} name="newEndDate" onChange={(event) => setNewEnd(event.target.value)} required type="date" value={newEnd} />
          </label>
        )}
        {!noEnd && extensionQuote && extensionRates && planFor(extensionRates, extraDays) ? (
          <p className="rounded-xl bg-[var(--primary-light)] p-3 text-sm text-[var(--foreground)]">
            <span className="font-semibold">฿{extensionQuote.amount.toLocaleString("en-US")}</span> for {extensionQuote.explain}.
          </p>
        ) : !noEnd && extraDays > 0 ? (
          // No rate meant for a stay this short (or no rates at all): the business sets the price, so none is promised here.
          <p className="rounded-xl bg-[#f5f4f1] p-3 text-sm text-[var(--foreground-secondary)]">
            {organizationName} will confirm the price for {extraDays} extra {extraDays === 1 ? "day" : "days"} before anything changes.
          </p>
        ) : null}
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          Note to owner
          <textarea className={inputClass} name="note" placeholder="Optional" />
        </label>
        <SubmitButton isPending={isPending} label="Submit request" />
      </form>
    );
  }

  if (type === "return_confirmation") {
    // A return date already agreed stays available even inside the notice period.
    const earliestReturn = addDaysLocal(today(), endNoticeDays);
    return (
      <form action={(formData) => onSubmit(formData, `Return confirmed - we'll see you on ${String(formData.get("returnDate") || endDate)} at ${String(formData.get("returnLocation") || deliveryLocation || "the agreed location")}.`)} className="mt-4 space-y-3">
        <input name="actionType" type="hidden" value="return_confirmation" />
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          Return date
          <input className={inputClass} defaultValue={endDate && endDate >= earliestReturn ? endDate : earliestReturn} min={endDate && endDate < earliestReturn ? endDate : earliestReturn} name="returnDate" required type="date" />
          {endNoticeDays > 0 ? <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Please give at least {endNoticeDays} {endNoticeDays === 1 ? "day" : "days"} notice before returning.</span> : null}
        </label>
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          Return time
          <input className={inputClass} name="returnTime" required type="time" />
        </label>
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          Return location
          <input className={inputClass} defaultValue={deliveryLocation} name="returnLocation" placeholder="Return location" />
        </label>
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          Note
          <textarea className={inputClass} name="note" placeholder="Optional" />
        </label>
        <SubmitButton isPending={isPending} label="Confirm return" />
      </form>
    );
  }

  if (type === "problem_report") {
    return (
      <form action={(formData) => onSubmit(formData, `Problem report sent. ${ownerContact ? `Contact ${organizationName} at ${ownerContact} if this is urgent.` : "The owner has been notified."}`)} className="mt-4 space-y-3">
        <input name="actionType" type="hidden" value="problem_report" />
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          Category
          <select className={inputClass} name="category" required>
            <option>Breakdown</option>
            <option>Damage</option>
            <option>Other mechanical issue</option>
            <option>Query about my rental</option>
            <option>Other</option>
          </select>
        </label>
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          Description
          <textarea className={inputClass} name="description" required />
        </label>
        <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
          Photo
          <input accept="image/*" className={inputClass} name="photo" type="file" />
        </label>
        <SubmitButton isPending={isPending} label="Submit report" />
      </form>
    );
  }

  return (
    <form action={(formData) => onSubmit(formData, "Question sent - we'll get back to you shortly.")} className="mt-4 space-y-3">
      <input name="actionType" type="hidden" value="question" />
      <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
        Question
        <textarea className={inputClass} name="question" required />
      </label>
      <SubmitButton isPending={isPending} label="Send question" />
    </form>
  );
}

function SubmitButton({ isPending, label }: { isPending: boolean; label: string }) {
  return (
    <button className="pressable min-h-12 w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
      {isPending ? "Sending..." : label}
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

function returnCountdown(endDate: string | null | undefined) {
  if (!endDate) return { label: "Monthly, no return date set", overdue: false, today: false };
  const todayDate = new Date();
  const target = new Date(endDate);
  todayDate.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.ceil((target.getTime() - todayDate.getTime()) / 86_400_000);
  if (days < 0) return { label: `${Math.abs(days)} days overdue`, overdue: true, today: false };
  if (days === 0) return { label: "Due today", overdue: false, today: true };
  return { label: `Returns in ${days} days`, overdue: false, today: false };
}

function today() {
  return businessToday();
}

/** "2026-11-04" -> "4 Nov 2026". */
function niceDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
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
