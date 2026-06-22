"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { CalendarDays, Car, CheckCircle2, MapPin, Plus, Trash2 } from "lucide-react";
import { addRentalPayment, cleanupDepositPayments, deleteRentalPayment, updateBooking, updateRentalPayment } from "@/app/actions/bookings";
import { CustomerSelector } from "@/components/customer-selector";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { isMapsUrl } from "@/lib/delivery-location";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  nationality: string | null;
  document_status?: string | null;
};

type PlaceResult = {
  formatted_address?: string;
  geometry?: { location?: { lat: () => number; lng: () => number } };
  name?: string;
  place_id?: string;
};

const includedOptions = [
  "Full insurance",
  "Compulsory insurance (Por Ror Bor)",
  "Breakdown cover",
  "Delivery and collection",
  "Car seat",
  "GPS tracker",
  "Unlimited mileage",
  "Free fuel"
];

const paymentStatusOptions = ["pending", "paid", "overdue", "waived", "scheduled", "cancelled", "refunded", "reconciled"];
const pricingOptions = ["daily", "weekly", "monthly", "custom"];
const currencies = ["THB", "USD", "IDR", "PHP", "MYR", "SGD", "VND", "AUD", "GBP", "EUR"];
const moneySymbol = "\u0e3f";

function money(value: unknown, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
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

function paymentDescription(payment: any) {
  return payment?.metadata?.description || payment?.metadata?.type || "Scheduled payment";
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold text-[var(--foreground-secondary)]">{children}</span>;
}

function MoneyField({
  label,
  name,
  value,
  required = false
}: {
  label: string;
  name: string;
  value: unknown;
  required?: boolean;
}) {
  const [display, setDisplay] = useState(moneyInput(value));
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1 flex h-9 items-center rounded-lg border border-[var(--border-strong)] bg-white">
        <span className="font-mono-data pl-3 pr-2 text-[13px] font-bold text-[var(--muted)]">{moneySymbol}</span>
        <input
          className="font-mono-data min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-[13px] outline-none"
          inputMode="numeric"
          name={name}
          onBlur={() => setDisplay(moneyInput(parseMoneyInput(display)))}
          onChange={(event) => setDisplay(event.target.value)}
          required={required}
          value={display}
        />
      </div>
    </label>
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [location, setLocation] = useState(value || "");
  const [placeId, setPlaceId] = useState(String(initialPlaceId || ""));
  const [lat, setLat] = useState(initialLat === null || initialLat === undefined ? "" : String(initialLat));
  const [lng, setLng] = useState(initialLng === null || initialLng === undefined ? "" : String(initialLng));
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const mapsKeyConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  // If Maps hasn't loaded within 3 seconds, fall back to plain text input
  useEffect(() => {
    if (enabled || !mapsKeyConfigured) return;
    const timer = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(timer);
  }, [enabled, mapsKeyConfigured]);

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
        setEnabled(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [homeTerritory]);

  return (
    <div className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1 grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="flex h-9 items-center rounded-lg border border-[var(--border-strong)] bg-white">
          <MapPin className="ml-3 mr-2 shrink-0 text-[var(--muted)]" size={15} />
          <input
            autoComplete="off"
            className="min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-[13px] outline-none"
            name="deliveryLocation"
            onChange={(event) => setLocation(event.target.value)}
            placeholder={enabled ? "Search Google Maps or enter an address..." : "Enter address..."}
            ref={inputRef}
            value={location}
          />
        </div>
        {enabled ? (
          <button
            className="pressable min-h-9 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-bold text-[var(--foreground-secondary)]"
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location || homeTerritory)}`, "_blank")}
            type="button"
          >
            Open map
          </button>
        ) : null}
      </div>
      <input name="deliveryPlaceId" type="hidden" value={placeId} />
      <input name="deliveryLat" type="hidden" value={lat} />
      <input name="deliveryLng" type="hidden" value={lng} />
      <p className="mt-1 text-xs font-medium text-[var(--muted)]">
        {(failed || timedOut || !mapsKeyConfigured)
          ? "Google Maps search unavailable - enter address manually."
          : "Optional. Search a hotel, airport, pier, villa or address."}
      </p>
    </div>
  );
}

function DeliveryMethodCards({ value }: { value: string }) {
  const [method, setMethod] = useState(value || "delivery");
  return (
    <div>
      <FieldLabel>Delivery method</FieldLabel>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {[
          ["delivery", "I will deliver", "Operator delivery"],
          ["collection", "Customer collects", "Collection by customer"],
          ["tbd", "To be determined", "Confirm later"]
        ].map(([entry, label, sub]) => (
          <label
            className={`pressable block min-h-16 cursor-pointer rounded-lg border px-3 py-3 ${
              method === entry ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"
            }`}
            key={entry}
          >
            <input className="sr-only" checked={method === entry} name="deliveryMethod" onChange={() => setMethod(entry)} type="radio" value={entry} />
            <span className="block text-sm font-bold">{label}</span>
            <span className="mt-1 block text-xs opacity-75">{sub}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function PaymentEditor({ payments, rentalId, currency, depositHeld }: { payments: any[]; rentalId: string; currency: string; depositHeld: number }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  const hasDepositPayments = depositHeld > 0 && payments.some(
    (p) => !p.voided && p.status !== "voided" &&
      (p.metadata?.is_deposit === true || p.metadata?.type === "deposit" ||
        Number(p.amount) === depositHeld)
  );
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

  function runDepositCleanup() {
    setCleanupMessage(null);
    startTransition(async () => {
      const result = await cleanupDepositPayments(rentalId);
      if (result.success) {
        setCleanupMessage(`Voided ${result.voided} deposit payment record${result.voided === 1 ? "" : "s"}.`);
        router.refresh();
      } else {
        setCleanupMessage(result.error || "Failed to clean up deposit records.");
      }
    });
  }

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
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update payment.");
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
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to delete payment.");
      }
    });
  }

  function addPayment(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      try {
        await addRentalPayment(formData);
        router.refresh();
        const form = document.getElementById("add-payment-row") as HTMLFormElement | null;
        form?.reset();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to add payment row.");
      }
    });
  }

  return (
    <Card>
      <SectionHeader eyebrow="Payment records" title="Edit schedule and corrections" />
      <div className="card-section overflow-x-auto">
        {message ? <p className="mb-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-2 text-xs font-bold text-[#dc2626]">{message}</p> : null}
        {!hasUpcomingRentPayments ? (
          <div className="mb-3 rounded-[10px] border border-[#fde68a] bg-[#fffbeb] p-3">
            <p className="text-[13px] font-semibold text-[#92400e]">No payment schedule found</p>
            <p className="mt-1 text-xs text-[#b45309]">
              No upcoming payment records exist. The schedule generates automatically when the rental activates — check the main booking page.
            </p>
          </div>
        ) : null}
        {hasDepositPayments ? (
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
            <div className="flex-1">
              <p className="text-xs font-bold text-[#92400e]">Deposit payment record detected</p>
              <p className="mt-0.5 text-xs text-[#92400e]">A ฿{depositHeld.toLocaleString()} deposit payment record exists but deposits are tracked via deposit_held. Void it to fix the outstanding balance.</p>
            </div>
            <button
              className="pressable shrink-0 rounded-lg border border-[#fde68a] bg-white px-3 py-2 text-xs font-bold text-[#92400e] hover:bg-[#fef3c7]"
              disabled={isPending}
              onClick={runDepositCleanup}
              type="button"
            >
              Fix deposit records
            </button>
          </div>
        ) : null}
        {cleanupMessage ? (
          <p className="mb-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-2 text-xs font-bold text-[#15803d]">{cleanupMessage}</p>
        ) : null}
        <table className="min-w-[760px] w-full text-left">
          <thead>
            <tr>
              <th>Due</th>
              <th>Description</th>
              <th>Status</th>
              <th className="text-right">Amount</th>
              <th className="w-40 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const voided = isVoidedPayment(payment);
              const editing = editingId === payment.id;
              if (editing) {
                return (
                  <tr key={payment.id} className="align-top">
                    <td colSpan={5}>
                      <form action={(formData) => savePayment(payment, formData)} className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3 md:grid-cols-[130px_1fr_140px_120px_130px_auto]">
                        <input className="font-mono-data" defaultValue={dateInput(payment.due_date)} name="dueDate" required type="date" />
                        <input defaultValue={paymentDescription(payment)} name="description" placeholder="Description" />
                        <select defaultValue={payment.status || "pending"} name="status">
                          {paymentStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <input className="font-mono-data" defaultValue={moneyInput(payment.amount)} name="amount" required />
                        <input className="font-mono-data" defaultValue={dateInput(payment.paid_at)} name="paidDate" type="date" />
                        <div className="flex gap-2">
                          <button className="primary-action pressable min-h-9 px-3 text-xs" disabled={isPending} type="submit">Save</button>
                          <button className="secondary-action pressable min-h-9 px-3 text-xs" onClick={() => setEditingId(null)} type="button">Cancel</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              }
              return (
                <tr className={voided ? "text-[var(--muted)] opacity-70" : ""} key={payment.id}>
                  <td className="font-mono-data">{dateInput(payment.due_date) || "-"}</td>
                  <td>{paymentDescription(payment)}</td>
                  <td>
                    <Badge tone={voided ? "neutral" : payment.status === "paid" ? "green" : payment.status === "overdue" ? "red" : "amber"}>
                      {voided ? "voided" : payment.status || "pending"}
                    </Badge>
                  </td>
                  <td className={`font-mono-data text-right font-bold ${voided ? "line-through" : ""}`}>{money(payment.amount, payment.currency || currency)}</td>
                  <td>
                    {!voided ? (
                      confirmDeleteId === payment.id ? (
                        <div className="flex justify-end gap-1">
                          <button className="pressable min-h-8 rounded-lg border border-[#fecaca] bg-[#dc2626] px-3 text-xs font-bold text-white" disabled={isPending} onClick={() => deletePayment(payment.id)} type="button">Confirm delete</button>
                          <button className="secondary-action pressable min-h-8 px-3 text-xs" onClick={() => setConfirmDeleteId(null)} type="button">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button className="secondary-action pressable min-h-8 px-3 text-xs" onClick={() => setEditingId(payment.id)} type="button">Edit</button>
                          <button className="pressable inline-flex min-h-8 items-center justify-center rounded-lg border border-[#fecaca] bg-[#fef2f2] px-2 text-xs font-bold text-[#dc2626]" onClick={() => setConfirmDeleteId(payment.id)} type="button">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <form action={addPayment} className="mt-3 grid gap-2 rounded-lg border border-[var(--border)] bg-white p-3 md:grid-cols-[130px_1fr_140px_120px_auto]" id="add-payment-row">
          <input name="rentalId" type="hidden" value={rentalId} />
          <input className="font-mono-data" name="dueDate" required type="date" />
          <input name="description" placeholder="Add payment description" />
          <select defaultValue="pending" name="status">
            {paymentStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <input className="font-mono-data" name="amount" placeholder="0" required />
          <button className="primary-action pressable min-h-9 px-3 text-xs" disabled={isPending} type="submit">
            <Plus size={14} />
            Add row
          </button>
        </form>
      </div>
    </Card>
  );
}

export function BookingEditForm({
  bookingLink,
  customers,
  homeTerritory,
  payments,
  rental
}: {
  bookingLink: any;
  customers: Customer[];
  homeTerritory: string;
  payments: any[];
  rental: any;
}) {
  const vehicle = rental.vehicles;
  const bookingData = (bookingLink?.booking_data || {}) as Record<string, any>;
  const selectedItems = useMemo(() => {
    const fromLink = Array.isArray(bookingLink?.included_items) ? bookingLink.included_items : [];
    return fromLink.length ? fromLink : Array.isArray(rental.included_items) ? rental.included_items : [];
  }, [bookingLink?.included_items, rental.included_items]);
  const [openEnded, setOpenEnded] = useState(Boolean(rental.is_indefinite || !rental.end_date));
  const deliveryMethod = rental.delivery_method || bookingLink?.delivery_method || bookingData.delivery_method || "delivery";
  const deliveryLocation = rental.delivery_location || bookingData.delivery_location || "";
  const deliveryDateTime = rental.delivery_datetime || bookingData.delivery_datetime || "";

  return (
    <>
      <Card className="border-[#fde68a] bg-[#fffbeb]">
        <div className="card-section flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fef3c7] text-[#d97706]">
            <i className="ti ti-alert-triangle" />
          </span>
          <div>
            <p className="font-bold text-[#92400e]">Editing an existing booking</p>
            <p className="mt-1 text-sm text-[#92400e]">This page is for correcting booking details. It will not create a new booking link or duplicate rental.</p>
          </div>
        </div>
      </Card>

      <form action={updateBooking} className="space-y-3" id="booking-edit-form">
        <input name="rentalId" type="hidden" value={rental.id} />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <Card>
              <SectionHeader eyebrow="Vehicle" title="Assigned vehicle" />
              <div className="card-section">
                <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
                    <Car size={21} />
                  </span>
                  <div>
                    <p className="text-lg font-black text-[var(--foreground)]">{vehicleTitle(vehicle)}</p>
                    <p className="font-mono-data mt-1 text-sm font-bold text-[var(--muted)]">{vehicle?.registration_number || "No plate"}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">Vehicle changes should be handled by cancelling or creating a replacement booking.</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <SectionHeader eyebrow="Customer" title="Customer details" />
              <div className="card-section">
                <CustomerSelector customers={customers} defaultCustomerId={rental.customer_id || ""} name="customerId" organizationId={rental.organization_id} />
              </div>
            </Card>

            <Card>
              <SectionHeader eyebrow="Rental" title="Rental period and pricing" />
              <div className="card-section grid gap-3 sm:grid-cols-2">
                <label>
                  <FieldLabel>Start date</FieldLabel>
                  <input className="mt-1 w-full font-mono-data" defaultValue={dateInput(rental.start_date)} name="startDate" required type="date" />
                </label>
                <label>
                  <FieldLabel>End date</FieldLabel>
                  <input className="mt-1 w-full font-mono-data disabled:opacity-50" defaultValue={dateInput(rental.end_date)} disabled={openEnded} name="endDate" type="date" />
                </label>
                <label className="checkbox-label sm:col-span-2">
                  <input checked={openEnded} className="flex-shrink-0" name="openEnded" onChange={(event) => setOpenEnded(event.target.checked)} type="checkbox" />
                  <span className="text-sm font-bold text-[var(--foreground-secondary)]">Open-ended / long-term rental</span>
                </label>
                <label>
                  <FieldLabel>Billing period</FieldLabel>
                  <select className="mt-1 w-full" defaultValue={rental.pricing_model || "monthly"} name="pricingModel">
                    {pricingOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  <FieldLabel>Currency</FieldLabel>
                  <select className="mt-1 w-full" defaultValue={rental.currency || "THB"} name="currency">
                    {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </label>
                <MoneyField label="Rental rate" name="rentalRate" required value={rental.rental_rate} />
                <MoneyField label="Deposit amount" name="depositAmount" value={rental.deposit_amount} />
                <MoneyField label="Deposit held (actual)" name="depositHeld" value={rental.deposit_held} />
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <Card>
              <SectionHeader eyebrow="Delivery" title="Delivery and included terms" />
              <div className="card-section space-y-3">
                <DeliveryMethodCards value={deliveryMethod} />
                <GoogleLocationField
                  homeTerritory={homeTerritory}
                  initialLat={bookingData.delivery_lat}
                  initialLng={bookingData.delivery_lng}
                  initialPlaceId={bookingData.delivery_place_id}
                  label={deliveryMethod === "collection" ? "Collection location" : "Delivery location"}
                  value={deliveryLocation}
                />
                {isMapsUrl(String(deliveryLocation)) ? (
                  <p className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                    Location stored as coordinates. Edit this field to add a readable address.
                  </p>
                ) : null}
                <label className="block">
                  <FieldLabel>Delivery / collection date and time</FieldLabel>
                  <input className="mt-1 w-full font-mono-data" defaultValue={dateTimeInput(deliveryDateTime)} name="deliveryDateTime" type="datetime-local" />
                  <p className="mt-1 text-xs font-medium text-[var(--muted)]">Optional. Leave blank if the exact time is still being confirmed.</p>
                </label>
              </div>
            </Card>

            <Card>
              <SectionHeader eyebrow="Inclusions" title="Included items and special conditions" />
              <div className="card-section space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {includedOptions.map((item) => (
                    <label className="checkbox-label min-h-10 rounded-lg border border-[var(--border)] bg-white px-3 py-2 font-bold text-[var(--foreground-secondary)]" key={item}>
                      <input className="flex-shrink-0" defaultChecked={selectedItems.includes(item)} name="includedItems" type="checkbox" value={item} />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
                <label className="block">
                  <FieldLabel>Special conditions</FieldLabel>
                  <textarea
                    className="mt-1 w-full"
                    defaultValue={bookingLink?.special_conditions || bookingData.special_conditions || ""}
                    name="specialConditions"
                    placeholder="Optional terms that should appear in the contract"
                  />
                </label>
              </div>
            </Card>
          </div>
        </div>
      </form>

      <PaymentEditor currency={rental.currency || "THB"} depositHeld={Number(rental.deposit_held || 0)} payments={payments} rentalId={rental.id} />

      <div className="sticky bottom-0 z-20 -mx-4 flex gap-2 border-t border-[var(--border)] bg-white/95 p-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <Link className="secondary-action pressable min-h-11 flex-1 justify-center" href={`/bookings/${rental.id}` as Route}>
          Cancel
        </Link>
        <button className="primary-action pressable min-h-11 flex-1 justify-center" form="booking-edit-form" type="submit">
          <CheckCircle2 size={17} />
          Save booking changes
        </button>
      </div>
    </>
  );
}
