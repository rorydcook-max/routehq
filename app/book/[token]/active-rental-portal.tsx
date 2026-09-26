"use client";

import { businessToday } from "@/lib/business-time";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarCheck, CalendarPlus, CheckCircle2, FileText, ImageIcon, MessageCircle } from "lucide-react";
import { submitCustomerPortalAction } from "@/app/actions/public-booking";

type ActionType = "extension_request" | "return_confirmation" | "problem_report" | "question";

const inputClass = "mt-2 w-full rounded-xl border border-[#d6e5e2] bg-white px-4 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15";

export function ActiveRentalPortal({
  token,
  organizationName,
  vehicle,
  rental,
  bookingData,
  signedContractUrl,
  certificateUrl,
  deliveryPhotoUrls,
  ownerContact
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
}) {
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
      { type: "extension_request" as const, title: "Request extension", icon: CalendarPlus, description: "Ask to keep the vehicle longer." },
      { type: "return_confirmation" as const, title: "Confirm return", icon: CalendarCheck, description: "Tell us when and where you will return." },
      { type: "problem_report" as const, title: "Report a problem", icon: AlertTriangle, description: "Breakdown, damage, or a rental issue." },
      { type: "question" as const, title: "Ask a question", icon: MessageCircle, description: "Send a quick question to the operator." }
    ],
    []
  );

  function submitAction(formData: FormData, successMessage: string) {
    startTransition(async () => {
      formData.set("token", token);
      await submitCustomerPortalAction(formData);
      setConfirmation(successMessage);
      setOpenAction(null);
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
        <div className="flex gap-4">
          <VehiclePhoto vehicle={vehicle} />
          <div className="min-w-0 flex-1">
            <span className="inline-flex rounded-full bg-[#f0fdf4] px-3 py-1 text-xs font-black uppercase text-[#16a34a]">Your rental is active</span>
            <h2 className="mt-3 text-2xl font-black text-[#10252b]">{vehicleName || "Your vehicle"}</h2>
            <p className="font-mono-data mt-1 text-sm font-bold text-[#667085]">{vehicle?.registration_number || "Plate pending"}</p>
            <p className={`mt-3 text-sm font-black ${countdown.overdue ? "text-[#dc2626]" : countdown.today ? "text-[#d97706]" : "text-[#475467]"}`}>
              {countdown.label}
            </p>
          </div>
        </div>
      </section>

      {confirmation ? (
        <p className="rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 text-sm font-bold text-[#166534]">{confirmation}</p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2">
        {actionCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="rounded-2xl border border-[#d6e5e2] bg-white p-4 shadow-sm" key={card.type}>
              <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpenAction(openAction === card.type ? null : card.type)} type="button">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e6fffb] text-[#0f766e]">
                  <Icon size={22} />
                </span>
                <span>
                  <span className="block text-base font-black text-[#10252b]">{card.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-[#667085]">{card.description}</span>
                </span>
              </button>
              {openAction === card.type ? (
                <ActionForm
                  deliveryLocation={deliveryLocation}
                  endDate={endDate}
                  isPending={isPending}
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

      <section className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase text-[#0f766e]">Your rental documents</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {signedContractUrl ? (
            <a className="rounded-xl border border-[#d6e5e2] bg-[#fbfefd] p-4 text-sm font-black text-[#10252b]" href={signedContractUrl} rel="noreferrer" target="_blank">
              <FileText className="mb-2 text-[#0f766e]" />
              Signed rental agreement
            </a>
          ) : null}
          {certificateUrl ? (
            <a className="rounded-xl border border-[#d6e5e2] bg-[#fbfefd] p-4 text-sm font-black text-[#10252b]" href={certificateUrl} rel="noreferrer" target="_blank">
              <FileText className="mb-2 text-[#0f766e]" />
              Signing certificate
            </a>
          ) : null}
          {deliveryPhotoUrls.length ? (
            deliveryPhotoUrls.map((url, index) => (
              <a className="rounded-xl border border-[#d6e5e2] bg-[#fbfefd] p-4 text-sm font-black text-[#10252b]" href={url} key={url} rel="noreferrer" target="_blank">
                <ImageIcon className="mb-2 text-[#0f766e]" />
                Delivery photo {index + 1}
              </a>
            ))
          ) : null}
          {!signedContractUrl && deliveryPhotoUrls.length === 0 ? <p className="text-sm text-[#667085]">Documents will appear here when available.</p> : null}
        </div>
      </section>
    </div>
  );
}

function ActionForm({
  type,
  endDate,
  minExtensionDate,
  deliveryLocation,
  isPending,
  onSubmit,
  organizationName,
  ownerContact
}: {
  type: ActionType;
  endDate: string;
  minExtensionDate: string;
  deliveryLocation: string;
  isPending: boolean;
  organizationName: string;
  ownerContact?: string | null;
  onSubmit: (formData: FormData, successMessage: string) => void;
}) {
  if (type === "extension_request") {
    return (
      <form action={(formData) => onSubmit(formData, "Extension request sent - your owner will confirm shortly.")} className="mt-4 space-y-3">
        <input name="actionType" type="hidden" value="extension_request" />
        <label className="block text-sm font-bold text-[#344054]">
          New return date
          <input className={inputClass} min={minExtensionDate} name="newEndDate" required type="date" />
        </label>
        <label className="block text-sm font-bold text-[#344054]">
          Note to owner
          <textarea className={inputClass} name="note" placeholder="Optional" />
        </label>
        <SubmitButton isPending={isPending} label="Submit request" />
      </form>
    );
  }

  if (type === "return_confirmation") {
    return (
      <form action={(formData) => onSubmit(formData, `Return confirmed - we'll see you on ${String(formData.get("returnDate") || endDate)} at ${String(formData.get("returnLocation") || deliveryLocation || "the agreed location")}.`)} className="mt-4 space-y-3">
        <input name="actionType" type="hidden" value="return_confirmation" />
        <label className="block text-sm font-bold text-[#344054]">
          Return date
          <input className={inputClass} defaultValue={endDate || today()} min={today()} name="returnDate" required type="date" />
        </label>
        <label className="block text-sm font-bold text-[#344054]">
          Return time
          <input className={inputClass} name="returnTime" required type="time" />
        </label>
        <label className="block text-sm font-bold text-[#344054]">
          Return location
          <input className={inputClass} defaultValue={deliveryLocation} name="returnLocation" placeholder="Return location" />
        </label>
        <label className="block text-sm font-bold text-[#344054]">
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
        <label className="block text-sm font-bold text-[#344054]">
          Category
          <select className={inputClass} name="category" required>
            <option>Breakdown</option>
            <option>Damage</option>
            <option>Other mechanical issue</option>
            <option>Query about my rental</option>
            <option>Other</option>
          </select>
        </label>
        <label className="block text-sm font-bold text-[#344054]">
          Description
          <textarea className={inputClass} name="description" required />
        </label>
        <label className="block text-sm font-bold text-[#344054]">
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
      <label className="block text-sm font-bold text-[#344054]">
        Question
        <textarea className={inputClass} name="question" required />
      </label>
      <SubmitButton isPending={isPending} label="Send question" />
    </form>
  );
}

function SubmitButton({ isPending, label }: { isPending: boolean; label: string }) {
  return (
    <button className="pressable min-h-12 w-full rounded-xl bg-[#0f766e] px-4 py-3 text-sm font-black text-white disabled:opacity-60" disabled={isPending} type="submit">
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
    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-[#e6fffb] text-[#0f766e]">
      <ImageIcon size={32} />
    </span>
  );
}

function returnCountdown(endDate: string | null | undefined) {
  if (!endDate) return { label: "Open ended", overdue: false, today: false };
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

function nextDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}
