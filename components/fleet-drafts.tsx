"use client";

import { Check, Loader2, Pencil, X } from "lucide-react";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DraftPaperwork, DraftRental, DraftVehicle } from "@/app/actions/fleet-assistant";
import { dateFormat } from "@/lib/i18n/dates";

/**
 * The fleet assistant's draft cards: vehicles to add, rentals running now, paperwork renewals read from photos.
 * One source for both places they show: the live chat (components/chat/chat-panel.tsx) and the full-page assistant
 * still used in setup (components/fleet-assistant.tsx). They only show and edit the lists; saving is the caller's.
 */

export function draftMoney(currency = "THB") {
  return (value?: number | null) => (value ? `${currency === "THB" ? "฿" : `${currency} `}${Math.round(value).toLocaleString("en-US")}` : "");
}

const heading = "px-1 text-[13px] font-bold uppercase tracking-wide text-[var(--muted)]";
const row = "rounded-xl bg-[var(--panel-secondary)] px-3 py-2";
const removeButton = "pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)]";

function Thumb({ url }: { url?: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" src={url} />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--panel)] text-[var(--muted)]">
      <Check size={16} />
    </span>
  );
}

/** Vehicles ready to add. With onEdit, each one's key details can be corrected before adding. */
export function VehicleDrafts({
  draft,
  currency,
  photoUrl,
  onRemove,
  onEdit,
  onAdd,
  adding,
  rowClassName = row
}: {
  draft: DraftVehicle[];
  currency?: string;
  photoUrl: (photo: number) => string | null | undefined;
  onRemove: (index: number) => void;
  onEdit?: (index: number, vehicle: DraftVehicle) => void;
  onAdd: () => void;
  adding: boolean;
  rowClassName?: string;
}) {
  const t = useTranslations("fleetAssistant");
  const money = draftMoney(currency);
  const [editing, setEditing] = useState<number | null>(null);
  const readyCount = draft.filter((vehicle) => vehicle.make && vehicle.model).length;
  return (
    <div>
      <p className={heading}>{t("listTitle", { count: draft.length })}</p>
      <ul className="mt-2 space-y-1.5">
        {draft.map((vehicle, index) => (
          <li className={rowClassName} key={index}>
            <div className="flex items-center gap-2.5">
              <Thumb url={vehicle.photos?.[0] ? photoUrl(vehicle.photos[0]) : null} />
              <div className="min-w-0 flex-1">
                {/* Wrapped, not cut off: in the chat on a phone the row is narrow and the plate matters. */}
                <p className="font-semibold leading-snug text-[var(--foreground)] [overflow-wrap:anywhere]">{[vehicle.make, vehicle.model, vehicle.variant, vehicle.year].filter(Boolean).join(" ") || t("unnamed")}</p>
                <p className="text-[13px] text-[var(--muted)] [overflow-wrap:anywhere]">
                  {[vehicle.plate, vehicle.colour, vehicle.monthlyRate ? t("perMonth", { price: money(vehicle.monthlyRate) }) : vehicle.dailyRate ? t("perDay", { price: money(vehicle.dailyRate) }) : ""].filter(Boolean).join(" · ") || t("noDetails")}
                </p>
              </div>
              {onEdit ? (
                <button aria-expanded={editing === index} aria-label={t("edit")} className={removeButton} onClick={() => setEditing(editing === index ? null : index)} type="button">
                  {editing === index ? <Check size={16} /> : <Pencil size={15} />}
                </button>
              ) : null}
              <button aria-label={t("remove")} className={removeButton} onClick={() => onRemove(index)} type="button">
                <X size={16} />
              </button>
            </div>
            {onEdit && editing === index ? <VehicleFields onChange={(next) => onEdit(index, next)} vehicle={vehicle} /> : null}
          </li>
        ))}
      </ul>
      <button className="primary-action pressable mt-3 w-full justify-center" disabled={!readyCount || adding} onClick={onAdd} type="button">
        {adding ? <Loader2 className="animate-spin" size={18} /> : null}
        {adding ? t("adding") : t("addButton", { count: readyCount })}
      </button>
    </div>
  );
}

/** The details worth correcting before a vehicle goes in: make, model, year, plate and the price. */
function VehicleFields({ vehicle, onChange }: { vehicle: DraftVehicle; onChange: (vehicle: DraftVehicle) => void }) {
  const t = useTranslations("fleetAssistant");
  const field = "mt-0.5 h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[16px] text-[var(--foreground)]";
  const label = "block text-[12px] font-semibold text-[var(--muted)]";
  const num = (value: string) => (Number(value) > 0 ? Number(value) : null);
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      <label className={label}>
        {t("fieldMake")}
        <input className={field} onChange={(event) => onChange({ ...vehicle, make: event.target.value })} value={vehicle.make || ""} />
      </label>
      <label className={label}>
        {t("fieldModel")}
        <input className={field} onChange={(event) => onChange({ ...vehicle, model: event.target.value })} value={vehicle.model || ""} />
      </label>
      <label className={label}>
        {t("fieldYear")}
        <input className={field} inputMode="numeric" onChange={(event) => onChange({ ...vehicle, year: num(event.target.value) })} value={vehicle.year || ""} />
      </label>
      <label className={label}>
        {t("fieldPlate")}
        <input className={field} onChange={(event) => onChange({ ...vehicle, plate: event.target.value })} value={vehicle.plate || ""} />
      </label>
      <label className={label}>
        {t("fieldMonthly")}
        <input className={field} inputMode="decimal" onChange={(event) => onChange({ ...vehicle, monthlyRate: num(event.target.value) })} value={vehicle.monthlyRate || ""} />
      </label>
      <label className={label}>
        {t("fieldDaily")}
        <input className={field} inputMode="decimal" onChange={(event) => onChange({ ...vehicle, dailyRate: num(event.target.value) })} value={vehicle.dailyRate || ""} />
      </label>
    </div>
  );
}

/** Rentals already running, each with its reminder switch. */
export function RentalDrafts({
  rentals,
  currency,
  onRemove,
  onRemind,
  onAdd,
  adding,
  rowClassName = row
}: {
  rentals: DraftRental[];
  currency?: string;
  onRemove: (index: number) => void;
  onRemind: (index: number, remind: boolean) => void;
  onAdd: () => void;
  adding: boolean;
  rowClassName?: string;
}) {
  const t = useTranslations("fleetAssistant");
  const locale = useLocale();
  const money = draftMoney(currency);
  const when = (iso?: string | null) => (iso ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "");
  const per = (rental: DraftRental) => (rental.rate ? t(rental.ratePeriod === "day" ? "perDay" : rental.ratePeriod === "week" ? "perWeek" : "perMonth", { price: money(rental.rate) }) : "");
  return (
    <div>
      <p className={heading}>{t("rentalsTitle", { count: rentals.length })}</p>
      <ul className="mt-2 space-y-1.5">
        {rentals.map((rental, index) => (
          <li className={rowClassName} key={index}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[var(--foreground)]">{rental.customerName} · {rental.vehicleName || t("unnamed")}</p>
                <p className="text-[13px] text-[var(--muted)]">
                  {[per(rental), rental.nextPaymentDate ? t("nextPay", { date: when(rental.nextPaymentDate) }) : rental.endDate ? t("dueBack", { date: when(rental.endDate) }) : "", rental.depositHeld ? t("deposit", { price: money(rental.depositHeld) }) : ""].filter(Boolean).join(" · ") || t("noDetails")}
                </p>
              </div>
              <button aria-label={t("remove")} className={removeButton} onClick={() => onRemove(index)} type="button">
                <X size={16} />
              </button>
            </div>
            {/* Reminders for this customer: on unless the owner says no. */}
            <label className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold text-[var(--foreground-secondary)]">
              <input checked={rental.remind !== false} className="h-4 w-4" onChange={(event) => onRemind(index, event.target.checked)} type="checkbox" />
              {rental.endDate && !rental.nextPaymentDate ? t("remindReturn") : t("remindRent")}
            </label>
          </li>
        ))}
      </ul>
      <button className="primary-action pressable mt-3 w-full justify-center" disabled={adding} onClick={onAdd} type="button">
        {adding ? <Loader2 className="animate-spin" size={18} /> : null}
        {adding ? t("adding") : t("addRentals", { count: rentals.length })}
      </button>
    </div>
  );
}

/** Renewals read from policy and tax photos: Save updates each car's date and records the cost; ✕ dismisses a wrong one. */
export function PaperworkDrafts({
  paperwork,
  currency,
  paperNames,
  photoUrl,
  onDismiss,
  onDate,
  onSave,
  saving,
  rowClassName = row
}: {
  paperwork: DraftPaperwork[];
  currency?: string;
  /** Each paperwork kind's name in this country ("Road tax (LKM)"), by key. */
  paperNames?: Record<string, string>;
  photoUrl: (photo: number) => string | null | undefined;
  onDismiss: (index: number) => void;
  onDate: (index: number, coverTo: string) => void;
  onSave: () => void;
  saving: boolean;
  rowClassName?: string;
}) {
  const t = useTranslations("fleetAssistant");
  const locale = useLocale();
  const money = draftMoney(currency);
  const missing = paperwork.some((item) => !item.coverTo);
  return (
    <div>
      <p className={heading}>{t("paperTitle", { count: paperwork.length })}</p>
      <ul className="mt-2 space-y-1.5">
        {paperwork.map((item, index) => (
          <li className={`flex items-center gap-2.5 ${rowClassName}`} key={index}>
            <Thumb url={item.photo ? photoUrl(item.photo) : null} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[var(--foreground)]">{paperNames?.[item.kind] || t(`paper_${item.kind}` as never)} · {item.vehicleName || t("unnamed")}</p>
              {!item.coverTo ? (
                // The date on the document couldn't be read: asked for here rather than the item being dropped.
                <label className="mt-1 block">
                  <span className="block text-[13px] font-semibold text-[var(--warning)]">
                    {t("paperNoDate")}
                    {item.coverToText ? ` ${t("paperPrinted", { text: item.coverToText })}` : ""}
                  </span>
                  <input className="mt-1 h-9 w-full max-w-[200px] rounded-lg border border-[var(--border)] bg-white px-2 text-[16px]" onChange={(event) => onDate(index, event.target.value)} type="date" />
                </label>
              ) : null}
              <p className="truncate text-[13px] text-[var(--muted)]">
                {[
                  item.coverTo ? t("paperUntil", { date: dateFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${item.coverTo}T00:00:00Z`)) }) : "",
                  item.cost ? (item.monthly ? t("perMonth", { price: money(item.cost) }) : money(item.cost)) : "",
                  item.inspectionCost ? t("paperInspection", { price: money(item.inspectionCost) }) : "",
                  item.note || ""
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button aria-label={t("paperDismiss")} className={removeButton} onClick={() => onDismiss(index)} title={t("paperDismiss")} type="button">
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
      <button className="primary-action pressable mt-3 w-full justify-center" disabled={saving || missing} onClick={onSave} type="button">
        {saving ? <Loader2 className="animate-spin" size={18} /> : null}
        {saving ? t("adding") : missing ? t("paperNeedDates") : t("paperSave", { count: paperwork.length })}
      </button>
      <p className="mt-2 px-1 text-[12px] text-[var(--muted)]">{t("paperCheck")}</p>
    </div>
  );
}
