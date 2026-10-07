"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MapPin, Plus } from "lucide-react";
import { addRentalPayment, deleteRentalPayment, updateBooking, updateRentalPayment } from "@/app/actions/bookings";
import { CustomerSelector } from "@/components/customer-selector";
import { Badge } from "@/components/ui";
import { isMapsUrl } from "@/lib/delivery-location";
import { toWallTime } from "@/lib/business-time";
import { longDate } from "@/lib/i18n/dates";

// The wording for this screen is in locales/<language>/common.json under
// "bookingEdit"; billing periods, delivery choices and included items reuse "newBooking".
type Say = (key: string, values?: Record<string, string | number>) => string;

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  nationality: string | null;
  document_status?: string | null;
};

// Stored on the booking and printed on the agreement in English; shown in the
// account language by position (newBooking inc_0 … inc_7).
const includedOptions = [
  "Full insurance",
  "Compulsory insurance (Por Ror Bor)",
  "Breakdown cover",
  "Delivery and collection",
  "Car seat",
  "GPS tracker",
  "Unlimited mileage",
  "Free fuel",
  "Helmet",
  "Second helmet",
  "Phone holder",
  "Rain poncho"
];

const paymentStatusOptions = ["pending", "paid", "overdue", "waived", "scheduled", "cancelled", "refunded", "reconciled"];
const pricingOptions = ["daily", "weekly", "monthly", "custom"];
const currencies = ["THB", "USD", "IDR", "PHP", "MYR", "SGD", "VND", "AUD", "GBP", "EUR"];
const moneySymbol = "฿";
const labelClass = "font-semibold text-[var(--foreground-secondary)]";
const sectionTitle = "text-[17px] font-bold text-[var(--foreground)]";

function money(value: unknown, currency = "THB") {
  const amount = Math.round(Number(value || 0)).toLocaleString("en-US");
  return currency === "THB" ? `${moneySymbol}${amount}` : `${amount} ${currency}`;
}

function moneyInput(value: unknown) {
  return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function parseMoneyInput(value: string) {
  const digits = value.replace(/[^0-9.-]/g, "");
  return digits ? Number(digits) : 0;
}

function dateInput(value: string | null | undefined) {
  return String(value || "").slice(0, 10);
}

function dateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  // Stored instants are shown in business time; zone-less values are already wall time.
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(String(value))) return toWallTime(value);
  const valueString = String(value);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(valueString)) {
    return valueString.slice(0, 16);
  }
  const parsed = new Date(valueString);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function vehicleTitle(vehicle: any) {
  return [vehicle?.make, vehicle?.model, vehicle?.trim, vehicle?.year].filter(Boolean).join(" ");
}

function isVoidedPayment(payment: any) {
  return payment?.status === "voided" || Boolean(payment?.voided || payment?.metadata?.voided);
}

function loadGooglePlaces() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || typeof window === "undefined") return null;
  const routeWindow = window as Window & { google?: any; __routeHqGoogleMapsPromise?: Promise<void> };
  if (routeWindow.google?.maps?.places?.Autocomplete) return Promise.resolve();
  if (!routeWindow.__routeHqGoogleMapsPromise) {
    routeWindow.__routeHqGoogleMapsPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-routehq-google-places="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.dataset.routehqGooglePlaces = "true";
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps failed to load."));
      document.head.appendChild(script);
    });
  }
  return routeWindow.__routeHqGoogleMapsPromise;
}

function MoneyField({ label, name, value, required = false }: { label: string; name: string; value: unknown; required?: boolean }) {
  const [display, setDisplay] = useState(moneyInput(value));
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-[var(--foreground-secondary)]">{moneySymbol}</span>
        <input
          className="w-full"
          inputMode="numeric"
          name={name}
          onBlur={() => setDisplay(moneyInput(parseMoneyInput(display)))}
          onChange={(event) => setDisplay(event.target.value)}
          required={required}
          style={{ paddingLeft: "1.9rem" }}
          value={display}
        />
      </div>
    </label>
  );
}

/** A fixed term shown as words, with the value still sent so the save sees no change. */
function FixedTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
      <p className="font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-[17px] font-bold leading-tight text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function GoogleLocationField({
  homeTerritory,
  initialPlaceId,
  initialLat,
  initialLng,
  label,
  value
}: {
  homeTerritory: string;
  initialPlaceId?: string | null;
  initialLat?: string | number | null;
  initialLng?: string | number | null;
  label: string;
  value: string;
}) {
  const say = useTranslations("bookingEdit") as unknown as Say;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [location, setLocation] = useState(value || "");
  const [placeId, setPlaceId] = useState(String(initialPlaceId || ""));
  const [lat, setLat] = useState(initialLat === null || initialLat === undefined ? "" : String(initialLat));
  const [lng, setLng] = useState(initialLng === null || initialLng === undefined ? "" : String(initialLng));

  // Place search is a bonus: without it this is a plain address field, and nothing needs saying.
  useEffect(() => {
    let cancelled = false;
    const loader = loadGooglePlaces();
    if (!loader) return;

    loader
      .then(() => {
        const routeWindow = window as Window & { google?: any };
        if (cancelled || !inputRef.current || !routeWindow.google?.maps?.places?.Autocomplete) return;
        const autocomplete = new routeWindow.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry", "name", "place_id"],
          componentRestrictions: { country: ["th"] }
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const address = place.formatted_address || place.name || inputRef.current?.value || "";
          setLocation(address);
          setPlaceId(place.place_id || "");
          setLat(place.geometry?.location?.lat() === undefined ? "" : String(place.geometry.location.lat()));
          setLng(place.geometry?.location?.lng() === undefined ? "" : String(place.geometry.location.lng()));
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [homeTerritory]);

  return (
    <div className="block">
      <span className={labelClass}>{label}</span>
      <div className="mt-1 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
          <input
            autoComplete="off"
            className="w-full"
            name="deliveryLocation"
            onChange={(event) => setLocation(event.target.value)}
            placeholder={say("d_placeholder")}
            ref={inputRef}
            style={{ paddingLeft: "2.3rem" }}
            value={location}
          />
        </div>
        {location.trim() ? (
          <a className="secondary-action pressable shrink-0" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} rel="noopener noreferrer" target="_blank">
            {say("d_openMap")}
          </a>
        ) : null}
      </div>
      <input name="deliveryPlaceId" type="hidden" value={placeId} />
      <input name="deliveryLat" type="hidden" value={lat} />
      <input name="deliveryLng" type="hidden" value={lng} />
    </div>
  );
}

function DeliveryMethodCards({ value, onChange }: { value: string; onChange: (method: string) => void }) {
  const say = useTranslations("bookingEdit") as unknown as Say;
  const words = useTranslations("newBooking") as unknown as Say;
  return (
    <div>
      <span className={labelClass}>{say("d_method")}</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {["delivery", "collection", "tbd"].map((entry) => (
          <label
            className={`pressable flex min-h-[44px] cursor-pointer items-center rounded-full px-4 font-bold ${value === entry ? "bg-[var(--primary)] text-white" : "bg-[var(--panel-secondary)] text-[var(--foreground)]"}`}
            key={entry}
          >
            <input checked={value === entry} className="sr-only" name="deliveryMethod" onChange={() => onChange(entry)} type="radio" value={entry} />
            {words(`del_${entry}`)}
          </label>
        ))}
      </div>
    </div>
  );
}

// There used to be a "fix deposit records" button here. It dated from before
// deposits were part of the payment schedule and would have removed the
// deposit row every booking now has, so it is gone.
function PaymentEditor({ payments, rentalId, currency }: { payments: any[]; rentalId: string; currency: string }) {
  const t = useTranslations("bookingEdit");
  const say = t as unknown as Say;
  const locale = useLocale();
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const statusName = (status: string) => (t.has(`st_${status}` as never) ? say(`st_${status}`) : status);

  const hasUpcomingRentPayments = payments.some((payment) => {
    const metadata = payment?.metadata || {};
    const type = String(metadata.type || "rent").toLowerCase();
    const status = String(payment?.status || "").toLowerCase();
    return (
      !payment?.voided &&
      !metadata.voided &&
      !["deposit", "deposit_received", "deposit_refunded"].includes(type) &&
      !["paid", "waived", "voided", "cancelled", "refunded", "reconciled"].includes(status)
    );
  });

  function savePayment(payment: any, formData: FormData) {
    setMessage("");
    startTransition(async () => {
      try {
        await updateRentalPayment(payment.id, {
          amount: parseMoneyInput(String(formData.get("amount") || "")),
          dueDate: String(formData.get("dueDate") || ""),
          description: String(formData.get("description") || ""),
          status: String(formData.get("status") || "pending") as any,
          paidDate: String(formData.get("paidDate") || "") || null
        });
        setEditingId(null);
        router.refresh();
      } catch {
        setMessage(say("p_failed"));
      }
    });
  }

  function deletePayment(paymentId: string) {
    setMessage("");
    startTransition(async () => {
      try {
        await deleteRentalPayment(paymentId);
        setConfirmDeleteId(null);
        router.refresh();
      } catch {
        setMessage(say("p_failed"));
      }
    });
  }

  function addPayment(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      try {
        await addRentalPayment(formData);
        setAdding(false);
        router.refresh();
      } catch {
        setMessage(say("p_failed"));
      }
    });
  }

  const statusSelect = (defaultValue: string) => (
    <label className="block">
      <span className={labelClass}>{say("p_f_status")}</span>
      <select className="mt-1 w-full" defaultValue={defaultValue} name="status">
        {paymentStatusOptions.map((option) => (
          <option key={option} value={option}>
            {statusName(option)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="card p-4">
      <h2 className={sectionTitle}>{say("p_title")}</h2>
      {message ? <p className="mt-3 rounded-xl bg-[var(--danger-light)] px-4 py-3 font-bold text-[var(--danger)]">{message}</p> : null}
      {!hasUpcomingRentPayments ? <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("p_none")}</p> : null}

      <div className="mt-3 grid gap-2.5">
        {payments.map((payment) => {
          const voided = isVoidedPayment(payment);
          const kind = String(payment?.metadata?.type || "");
          const description = payment?.metadata?.description || (t.has(`pt_${kind}` as never) ? say(`pt_${kind}`) : kind) || say("p_defaultDesc");
          if (editingId === payment.id) {
            return (
              <form action={(formData) => savePayment(payment, formData)} className="grid gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5 sm:grid-cols-2" key={payment.id}>
                <label className="block sm:col-span-2">
                  <span className={labelClass}>{say("p_f_desc")}</span>
                  <input className="mt-1 w-full" defaultValue={description} name="description" />
                </label>
                <label className="block">
                  <span className={labelClass}>{say("p_f_amount")}</span>
                  <input className="mt-1 w-full" defaultValue={moneyInput(payment.amount)} inputMode="numeric" name="amount" required />
                </label>
                <label className="block">
                  <span className={labelClass}>{say("p_f_due")}</span>
                  <input className="mt-1 w-full" defaultValue={dateInput(payment.due_date)} name="dueDate" required type="date" />
                </label>
                {statusSelect(payment.status || "pending")}
                <label className="block">
                  <span className={labelClass}>{say("p_f_paidOn")}</span>
                  <input className="mt-1 w-full" defaultValue={dateInput(payment.paid_at)} name="paidDate" type="date" />
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <button className="secondary-action pressable" onClick={() => setEditingId(null)} type="button">
                    {say("p_cancel")}
                  </button>
                  <button className="primary-action pressable flex-1" disabled={isPending} type="submit">
                    {say("p_save")}
                  </button>
                </div>
              </form>
            );
          }
          return (
            <div className={`rounded-xl bg-[var(--panel-secondary)] p-3.5 ${voided ? "opacity-60" : ""}`} key={payment.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[17px] font-bold leading-tight text-[var(--foreground)] ${voided ? "line-through" : ""}`}>{money(payment.amount, payment.currency || currency)}</p>
                  <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">
                    {description} · {payment.due_date ? say("p_due", { date: longDate(dateInput(payment.due_date), locale) }) : say("p_noDate")}
                  </p>
                </div>
                <Badge tone={voided ? "neutral" : payment.status === "paid" ? "green" : payment.status === "overdue" ? "red" : "amber"}>{statusName(voided ? "voided" : payment.status || "pending")}</Badge>
              </div>
              {!voided ? (
                confirmDeleteId === payment.id ? (
                  <div className="mt-2.5 flex gap-2">
                    <button className="secondary-action pressable" onClick={() => setConfirmDeleteId(null)} type="button">
                      {say("p_keep")}
                    </button>
                    <button className="pressable min-h-[44px] flex-1 rounded-full bg-[var(--danger)] px-4 font-bold text-white" disabled={isPending} onClick={() => deletePayment(payment.id)} type="button">
                      {say("p_confirmDelete")}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2.5 flex gap-2">
                    <button className="secondary-action pressable" onClick={() => setEditingId(payment.id)} type="button">
                      {say("p_edit")}
                    </button>
                    <button className="secondary-action pressable" onClick={() => setConfirmDeleteId(payment.id)} style={{ color: "var(--danger)" }} type="button">
                      {say("p_delete")}
                    </button>
                  </div>
                )
              ) : null}
            </div>
          );
        })}
      </div>

      {adding ? (
        <form action={addPayment} className="mt-3 grid gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5 sm:grid-cols-2">
          <input name="rentalId" type="hidden" value={rentalId} />
          <label className="block sm:col-span-2">
            <span className={labelClass}>{say("p_f_desc")}</span>
            <input className="mt-1 w-full" name="description" />
          </label>
          <label className="block">
            <span className={labelClass}>{say("p_f_amount")}</span>
            <input className="mt-1 w-full" inputMode="numeric" name="amount" placeholder="0" required />
          </label>
          <label className="block">
            <span className={labelClass}>{say("p_f_due")}</span>
            <input className="mt-1 w-full" name="dueDate" required type="date" />
          </label>
          {statusSelect("pending")}
          <div className="flex gap-2 sm:col-span-2">
            <button className="secondary-action pressable" onClick={() => setAdding(false)} type="button">
              {say("p_cancel")}
            </button>
            <button className="primary-action pressable flex-1" disabled={isPending} type="submit">
              {say("p_addBtn")}
            </button>
          </div>
        </form>
      ) : (
        <button className="secondary-action pressable mt-3" onClick={() => setAdding(true)} type="button">
          <Plus size={17} />
          {say("p_add")}
        </button>
      )}
    </section>
  );
}

export function BookingEditForm({
  agreementSigned = false,
  bookingLink,
  customers,
  homeTerritory,
  payments,
  rental
}: {
  agreementSigned?: boolean;
  bookingLink: any;
  customers: Customer[];
  homeTerritory: string;
  payments: any[];
  rental: any;
}) {
  const say = useTranslations("bookingEdit") as unknown as Say;
  const words = useTranslations("newBooking") as unknown as Say;
  const locale = useLocale();
  const vehicle = rental.vehicles;
  const bookingData = (bookingLink?.booking_data || {}) as Record<string, any>;
  const linkItems: string[] = useMemo(() => (Array.isArray(bookingLink?.included_items) ? bookingLink.included_items : []), [bookingLink?.included_items]);
  const selectedItems: string[] = useMemo(() => (linkItems.length ? linkItems : Array.isArray(rental.included_items) ? rental.included_items : []), [linkItems, rental.included_items]);
  const [openEnded, setOpenEnded] = useState(Boolean(rental.is_indefinite || !rental.end_date));
  const [deliveryMethod, setDeliveryMethod] = useState<string>(rental.delivery_method || bookingLink?.delivery_method || bookingData.delivery_method || "delivery");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const deliveryLocation = rental.delivery_location || bookingData.delivery_location || "";
  const deliveryDateTime = rental.delivery_datetime || bookingData.delivery_datetime || "";
  const specialConditions = bookingLink?.special_conditions || bookingData.special_conditions || "";
  const pricingModel = rental.pricing_model || "monthly";
  const currency = rental.currency || "THB";
  const customer = customers.find((entry) => entry.id === rental.customer_id);
  const itemLabel = (item: string) => {
    const index = includedOptions.indexOf(item);
    return index >= 0 ? words(`inc_${index}`) : item;
  };

  return (
    <>
      {agreementSigned ? <p className="rounded-xl bg-[var(--primary-light)] px-4 py-3 font-medium text-[var(--foreground)]">{say("signedNote")}</p> : null}
      {saveError ? (
        <p className="rounded-xl bg-[var(--danger-light)] px-4 py-3 font-bold text-[var(--danger)]" role="alert">
          {saveError}
        </p>
      ) : null}

      <form
        action={async (formData) => {
          setSaveError("");
          setSaving(true);
          try {
            const result = await updateBooking(formData);
            if (result?.error) {
              setSaveError(result.error);
              setSaving(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
              return;
            }
            router.push(`/bookings/${rental.id}?updated=1` as Route);
          } catch {
            setSaveError(say("saveFailed"));
            setSaving(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        className="grid items-start gap-3 lg:grid-cols-2"
        id="booking-edit-form"
      >
        <input name="rentalId" type="hidden" value={rental.id} />

        <div className="space-y-3">
          <section className="card p-4">
            <h2 className={sectionTitle}>{say("v_title")}</h2>
            <p className="mt-2 text-[17px] font-bold leading-tight text-[var(--foreground)]">{vehicleTitle(vehicle)}</p>
            <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{vehicle?.registration_number || say("v_noPlate")}</p>
            <p className="mt-2 font-medium text-[var(--muted)]">{say("v_change")}</p>
          </section>

          {agreementSigned ? (
            // Signed terms: shown as words, and sent back unchanged so the save goes through.
            <section className="card p-4">
              <h2 className={sectionTitle}>{say("t_title")}</h2>
              <input name="customerId" type="hidden" value={rental.customer_id || ""} />
              <input name="startDate" type="hidden" value={dateInput(rental.start_date)} />
              <input name="endDate" type="hidden" value={dateInput(rental.end_date)} />
              {rental.is_indefinite || !rental.end_date ? <input name="openEnded" type="hidden" value="on" /> : null}
              <input name="pricingModel" type="hidden" value={pricingModel} />
              <input name="currency" type="hidden" value={currency} />
              <input name="rentalRate" type="hidden" value={String(Number(rental.rental_rate || 0))} />
              <input name="depositAmount" type="hidden" value={String(Number(rental.deposit_amount || 0))} />
              {linkItems.map((item) => (
                <input key={item} name="includedItems" type="hidden" value={item} />
              ))}
              <input name="specialConditions" type="hidden" value={specialConditions} />
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <FixedTile label={say("c_title")} value={customer?.full_name || say("c_none")} />
                <FixedTile
                  label={say("t_dates")}
                  value={rental.end_date ? say("t_range", { from: longDate(dateInput(rental.start_date), locale), to: longDate(dateInput(rental.end_date), locale) }) : say("t_from", { date: longDate(dateInput(rental.start_date), locale) })}
                />
                <FixedTile label={say("t_price")} value={words(`per_${pricingModel}`, { amount: money(rental.rental_rate, currency) })} />
                <FixedTile label={say("t_depositAgreed")} value={money(rental.deposit_amount, currency)} />
                <div className="sm:col-span-2">
                  <FixedTile label={say("i_title")} value={selectedItems.length ? selectedItems.map(itemLabel).join(", ") : say("i_none")} />
                </div>
                {specialConditions ? (
                  <div className="sm:col-span-2">
                    <FixedTile label={say("i_special")} value={specialConditions} />
                  </div>
                ) : null}
              </div>
              <input name="depositHeld" type="hidden" value={String(Number(rental.deposit_held || 0))} />
              <div className="mt-2.5">
                <FixedTile label={say("t_depositHeld")} value={money(rental.deposit_held, currency)} />
                <p className="mt-1.5 font-medium text-[var(--muted)]">{say("t_depositHeldHint")}</p>
              </div>
            </section>
          ) : (
            <>
              <section className="card p-4" style={{ overflow: "visible" }}>
                <h2 className={sectionTitle}>{say("c_title")}</h2>
                <div className="mt-3">
                  <CustomerSelector customers={customers} defaultCustomerId={rental.customer_id || ""} name="customerId" organizationId={rental.organization_id} />
                </div>
              </section>

              <section className="card p-4">
                <h2 className={sectionTitle}>{say("t_title")}</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>{say("t_start")}</span>
                    <input className="mt-1 w-full" defaultValue={dateInput(rental.start_date)} name="startDate" required type="date" />
                  </label>
                  <label className="block">
                    <span className={labelClass}>{say("t_end")}</span>
                    <input className="mt-1 w-full disabled:opacity-50" defaultValue={dateInput(rental.end_date)} disabled={openEnded} name="endDate" type="date" />
                  </label>
                  <label className="checkbox-label sm:col-span-2">
                    <input checked={openEnded} className="flex-shrink-0" name="openEnded" onChange={(event) => setOpenEnded(event.target.checked)} type="checkbox" />
                    <span className="font-semibold text-[var(--foreground)]">{say("t_open")}</span>
                  </label>
                  <label className="block">
                    <span className={labelClass}>{say("t_billing")}</span>
                    <select className="mt-1 w-full" defaultValue={pricingModel} name="pricingModel">
                      {pricingOptions.map((option) => (
                        <option key={option} value={option}>
                          {words(`period_${option}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={labelClass}>{say("t_currency")}</span>
                    <select className="mt-1 w-full" defaultValue={currency} name="currency">
                      {currencies.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                    </select>
                  </label>
                  <MoneyField label={say("t_rate")} name="rentalRate" required value={rental.rental_rate} />
                  <MoneyField label={say("t_depositAgreed")} name="depositAmount" value={rental.deposit_amount} />
                </div>
                {/* What is held changes only when money is recorded, so the books always say where the deposit is. */}
                <input name="depositHeld" type="hidden" value={String(Number(rental.deposit_held || 0))} />
                <div className="mt-3">
                  <FixedTile label={say("t_depositHeld")} value={money(rental.deposit_held, currency)} />
                  <p className="mt-1.5 font-medium text-[var(--muted)]">{say("t_depositHeldHint")}</p>
                </div>
              </section>
            </>
          )}
        </div>

        <div className="space-y-3">
          <section className="card p-4">
            <h2 className={sectionTitle}>{say("d_title")}</h2>
            <div className="mt-3 space-y-3">
              <DeliveryMethodCards onChange={setDeliveryMethod} value={deliveryMethod} />
              {deliveryMethod !== "tbd" ? (
                <>
                  <GoogleLocationField
                    homeTerritory={homeTerritory}
                    initialLat={bookingData.delivery_lat}
                    initialLng={bookingData.delivery_lng}
                    initialPlaceId={bookingData.delivery_place_id}
                    label={deliveryMethod === "collection" ? say("d_collectionLoc") : say("d_deliveryLoc")}
                    value={deliveryLocation}
                  />
                  {isMapsUrl(String(deliveryLocation)) ? <p className="rounded-xl bg-[var(--warning-light)] px-4 py-3 font-medium text-[var(--foreground)]">{say("d_coords")}</p> : null}
                  <label className="block">
                    <span className={labelClass}>{say("d_when")}</span>
                    <input className="mt-1 w-full" defaultValue={dateTimeInput(deliveryDateTime)} name="deliveryDateTime" type="datetime-local" />
                    <span className="mt-1 block font-medium text-[var(--muted)]">{say("d_whenHint")}</span>
                  </label>
                </>
              ) : null}
            </div>
          </section>

          {!agreementSigned ? (
            <section className="card p-4">
              <h2 className={sectionTitle}>{say("i_title")}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {includedOptions.map((item, index) => (
                  <label className="checkbox-label min-h-[44px] rounded-xl bg-[var(--panel-secondary)] px-3.5 py-2 font-semibold text-[var(--foreground)]" key={item}>
                    <input className="flex-shrink-0" defaultChecked={selectedItems.includes(item)} name="includedItems" type="checkbox" value={item} />
                    <span>{words(`inc_${index}`)}</span>
                  </label>
                ))}
              </div>
              <label className="mt-3 block">
                <span className={labelClass}>{say("i_special")}</span>
                <textarea className="mt-1 w-full" defaultValue={specialConditions} name="specialConditions" placeholder={say("i_specialPh")} />
              </label>
            </section>
          ) : null}
        </div>
      </form>

      <PaymentEditor currency={currency} payments={payments} rentalId={rental.id} />

      <div className="sticky-actions sticky z-10 -mx-1 flex gap-2 bg-[var(--background)] px-1 py-3 sm:justify-end [&>*:last-child]:flex-1 sm:[&>*:last-child]:flex-none">
        <Link className="secondary-action pressable justify-center" href={`/bookings/${rental.id}` as Route}>
          {say("cancel")}
        </Link>
        <button className="primary-action pressable justify-center" disabled={saving} form="booking-edit-form" type="submit">
          {saving ? say("saving") : say("save")}
        </button>
      </div>
    </>
  );
}
