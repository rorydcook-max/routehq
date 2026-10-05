"use client";

import { businessToday } from "@/lib/business-time";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Car, CheckCircle2, Copy, MapPin, Send, UserPlus, UserRound, X } from "lucide-react";
import { createBooking } from "@/app/actions/bookings";
import { CustomerSelector } from "@/components/customer-selector";
import { Badge, ProgressBar } from "@/components/ui";
import { flagForNationality } from "@/lib/customer-options";
import { conflictMessage, findConflict, type BusyPeriod } from "@/lib/rental-conflicts";

type BookingVehicle = {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  year: number | null;
  registration_number: string;
  status: string;
  availability_status: string;
  daily_rate: number;
  weekly_rate: number;
  /** This vehicle's own deposit; null means the business's usual one. */
  deposit_amount?: number | null;
  monthly_rate: number;
  color: string | null;
};

type BookingCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  nationality: string | null;
  document_status?: string | null;
};

type BookingShareResult = {
  mode?: "booking_link" | "existing_rental";
  rentalId: string;
  bookingUrl: string;
  message: string;
  whatsappUrl: string;
  lineUrl: string;
  smsUrl: string;
  emailUrl: string;
};

type GooglePlaceResult = {
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
  name?: string;
  place_id?: string;
};

type GoogleAutocomplete = {
  addListener: (eventName: "place_changed", callback: () => void) => void;
  getPlace: () => GooglePlaceResult;
};

type GoogleLatLngLiteral = { lat: number; lng: number };

type GoogleMap = {
  addListener: (eventName: "click", callback: (event: { latLng?: { lat: () => number; lng: () => number } }) => void) => void;
};

type GoogleMarker = {
  addListener: (eventName: "dragend", callback: () => void) => void;
  getPosition: () => { lat: () => number; lng: () => number } | null;
  setPosition: (position: GoogleLatLngLiteral) => void;
};

type GoogleGeocoder = {
  geocode: (
    request: { address?: string; location?: GoogleLatLngLiteral },
    callback: (results: Array<{ formatted_address: string; geometry?: { location?: { lat: () => number; lng: () => number } }; place_id?: string }> | null, status: string) => void
  ) => void;
};

declare global {
  interface Window {
    google?: {
      maps?: {
        Geocoder: new () => GoogleGeocoder;
        Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
        Marker: new (options: Record<string, unknown>) => GoogleMarker;
        places?: {
          Autocomplete: new (input: HTMLInputElement, options?: Record<string, unknown>) => GoogleAutocomplete;
        };
      };
    };
    __routeHqGoogleMapsPromise?: Promise<void>;
  }
}

const steps = ["Vehicle", "Customer", "Rental", "Delivery", "Review"];
const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]";
const defaultAppUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
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

const CURRENCY_INFO: Record<string, { symbol: string; locale: string; label: string }> = {
  THB: { symbol: "฿", locale: "th-TH", label: "Thai Baht" },
  IDR: { symbol: "Rp", locale: "id-ID", label: "Indonesian Rupiah" },
  PHP: { symbol: "₱", locale: "en-PH", label: "Philippine Peso" },
  MYR: { symbol: "RM", locale: "ms-MY", label: "Malaysian Ringgit" },
  SGD: { symbol: "S$", locale: "en-SG", label: "Singapore Dollar" },
  VND: { symbol: "₫", locale: "vi-VN", label: "Vietnamese Dong" },
  AUD: { symbol: "A$", locale: "en-AU", label: "Australian Dollar" },
  GBP: { symbol: "£", locale: "en-GB", label: "British Pound" },
  USD: { symbol: "$", locale: "en-US", label: "US Dollar" },
  EUR: { symbol: "€", locale: "de-DE", label: "Euro" },
};

function money(value: unknown, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function moneyInput(value: number, currencyInfo: { symbol: string; locale: string }, showZero = false) {
  if (!showZero && !value) return "";
  return `${currencyInfo.symbol} ${new Intl.NumberFormat(currencyInfo.locale, { maximumFractionDigits: 0 }).format(Number(value || 0))}`;
}

function parseMoneyInput(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

function localDate(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateTime(value = new Date()) {
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${localDate(value)}T${hours}:${minutes}`;
}

function vehicleTitle(vehicle?: BookingVehicle | null) {
  if (!vehicle) return "";
  return [vehicle.make, vehicle.model, vehicle.trim, vehicle.year].filter(Boolean).join(" ");
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

// A car out on rent can still be booked for when it comes back; the dates step
// checks for clashes. Only cars taken out of service can't be chosen.
function selectable(vehicle: BookingVehicle) {
  return !["maintenance", "inactive", "retired"].includes(vehicle.status);
}

function longDay(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || "")) return "not set";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
}

/** A wall-clock "YYYY-MM-DDTHH:mm" from a datetime-local input, shown as "8 Nov 2026, 10:00". */
function longDateTime(value: string) {
  const time = value.slice(11, 16);
  return time ? `${longDay(value)}, ${time}` : longDay(value);
}

function shortDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/** One line on when the car is taken, e.g. "Taken until 8 Nov" or "Booked from 27 Oct". */
function availabilityNote(periods: BusyPeriod[], today: string) {
  const current = periods.find((period) => period.startDate <= today && (!period.endDate || period.endDate >= today));
  if (current) return current.endDate ? `Taken until ${shortDay(current.endDate)}` : "Taken, no end date";
  const next = periods.find((period) => period.startDate > today);
  return next ? `Booked from ${shortDay(next.startDate)}` : null;
}

const VEHICLE_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  rented: "On rent",
  reserved: "Booked",
  maintenance: "In maintenance",
  inactive: "Inactive",
  retired: "Retired"
};

/**
 * The vehicle's rate for a pricing period. When it has no rate for that period,
 * the price is worked out from whichever rate it does have (nearest period
 * first): a monthly-only vehicle still gets a daily and weekly price, and a
 * daily-only vehicle a weekly and monthly one. `from` names the rate used.
 */
function rateWithSource(vehicle: BookingVehicle | null, pricingModel: string): { rate: number; from: "daily" | "weekly" | "monthly" | null } {
  if (!vehicle) return { rate: 0, from: null };
  const saved = { daily: Number(vehicle.daily_rate || 0), weekly: Number(vehicle.weekly_rate || 0), monthly: Number(vehicle.monthly_rate || 0) };
  const days = { daily: 1, weekly: 7, monthly: 30 };
  if (pricingModel !== "daily" && pricingModel !== "weekly" && pricingModel !== "monthly") return { rate: 0, from: null };
  if (saved[pricingModel] > 0) return { rate: saved[pricingModel], from: null };
  const order: Array<"daily" | "weekly" | "monthly"> = pricingModel === "daily" ? ["weekly", "monthly"] : pricingModel === "weekly" ? ["daily", "monthly"] : ["weekly", "daily"];
  const from = order.find((key) => saved[key] > 0);
  if (!from) return { rate: 0, from: null };
  // To the nearest 10, the way a person would quote it.
  return { rate: Math.max(10, Math.round(((saved[from] / days[from]) * days[pricingModel]) / 10) * 10), from };
}

function rateFor(vehicle: BookingVehicle | null, pricingModel: string) {
  return rateWithSource(vehicle, pricingModel).rate;
}

function loadGooglePlaces() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || typeof window === "undefined") {
    return null;
  }

  if (window.google?.maps?.places?.Autocomplete) {
    return Promise.resolve();
  }

  if (!window.__routeHqGoogleMapsPromise) {
    window.__routeHqGoogleMapsPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-routehq-google-places="true"]');
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.defer = true;
      script.dataset.routehqGooglePlaces = "true";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps failed to load."));
      document.head.appendChild(script);
    });
  }

  return window.__routeHqGoogleMapsPromise;
}

export function BookingForm({
  organizationId,
  organizationName,
  operatorAddress,
  vehicles,
  customers,
  preselectedVehicleId = "",
  preselectedStartDate = "",
  preselectedEndDate = "",
  preselectedCustomerId = "",
  defaultCurrency = "THB",
  defaultDeposit = 0,
  homeTerritory = "Koh Samui, Thailand",
  busyPeriods = {}
}: {
  organizationId: string;
  organizationName: string;
  operatorAddress: string;
  vehicles: BookingVehicle[];
  busyPeriods?: Record<string, BusyPeriod[]>;
  customers: BookingCustomer[];
  preselectedVehicleId?: string;
  /** A day picked on the calendar; ignored if it is in the past. */
  preselectedStartDate?: string;
  preselectedEndDate?: string;
  preselectedCustomerId?: string;
  defaultCurrency?: string;
  /** The deposit the business usually takes, from Settings. */
  defaultDeposit?: number;
  homeTerritory?: string;
}) {
  const validPreselectedVehicle = vehicles.some((vehicle) => vehicle.id === preselectedVehicleId && selectable(vehicle));
  const preselectedCustomer = customers.some((customer) => customer.id === preselectedCustomerId);
  // With a vehicle already picked (from its page or the calendar) the form opens on the rental details.
  const firstStep = validPreselectedVehicle ? (preselectedCustomer ? 1 : 2) : 0;

  const [step, setStep] = useState(firstStep);
  // Show modal immediately when a vehicle is preselected (operator came from vehicle profile)
  // Arriving with both a vehicle and a customer (an accepted request) skips the "add customer?" question.
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  // A booking link needs no customer: they fill in their own details. Choosing one is optional.
  const [customerSkipped, setCustomerSkipped] = useState(!preselectedCustomer);
  const [bookingMode, setBookingMode] = useState<"booking_link" | "existing_rental">("booking_link");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleId, setVehicleId] = useState(validPreselectedVehicle ? preselectedVehicleId : "");
  const [selectedCustomer, setSelectedCustomer] = useState<BookingCustomer | null>(customers.find((customer) => customer.id === preselectedCustomerId) || null);
  const [startDate, setStartDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(preselectedStartDate) && preselectedStartDate >= businessToday() ? preselectedStartDate : businessToday());
  const [endDate, setEndDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(preselectedEndDate) && preselectedEndDate > businessToday() ? preselectedEndDate : "");
  const [openEnded, setOpenEnded] = useState(false);
  const [pricingModel, setPricingModel] = useState("monthly");
  // Until the operator picks a period themselves, it follows the length of the rental.
  const pricingChosenByHand = useRef(false);
  const [currency, setCurrency] = useState(CURRENCY_INFO[defaultCurrency] ? defaultCurrency : "THB");
  // Filled from the start when the vehicle is already chosen, so the rate never shows as empty while the page loads.
  const [rentalRate, setRentalRate] = useState(() => {
    const preselected = validPreselectedVehicle ? vehicles.find((vehicle) => vehicle.id === preselectedVehicleId) : null;
    return preselected ? rateFor(preselected, "monthly") : 0;
  });
  const [depositAmount, setDepositAmount] = useState(defaultDeposit > 0 ? defaultDeposit : 0);
  // For a rental that has already started: what the customer has paid so far.
  const [existingPaid, setExistingPaid] = useState<"up_to_date" | "until" | "none">("up_to_date");
  const [existingPaidUntil, setExistingPaidUntil] = useState("");
  const [existingDepositHeld, setExistingDepositHeld] = useState(true);
  const [includedItems, setIncludedItems] = useState<string[]>([includedOptions[1]]);
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "collection" | "tbd">("delivery");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryPlaceId, setDeliveryPlaceId] = useState("");
  const [deliveryLat, setDeliveryLat] = useState("");
  const [deliveryLng, setDeliveryLng] = useState("");
  const [deliveryDateTime, setDeliveryDateTime] = useState("");
  const [collectionAddress, setCollectionAddress] = useState(operatorAddress);
  const [collectionTime, setCollectionTime] = useState("");
  const [specialConditions, setSpecialConditions] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [error, setError] = useState("");
  const [shareResult, setShareResult] = useState<BookingShareResult | null>(null);
  const [walkInNow, setWalkInNow] = useState(false);
  const [walkInFastTrack, setWalkInFastTrack] = useState(false);
  const [walkInPaymentAmount, setWalkInPaymentAmount] = useState(0);
  const [walkInDepositAmount, setWalkInDepositAmount] = useState(0);
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState("cash");
  const [walkInPaymentNote, setWalkInPaymentNote] = useState("");
  const [upfrontEnabled, setUpfrontEnabled] = useState(false);
  const [upfrontPeriods, setUpfrontPeriods] = useState(1);
  const [upfrontRate, setUpfrontRate] = useState(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitIntentRef = useRef<"default" | "booking_link" | "walk_in">("default");
  const [isPending, startTransition] = useTransition();

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId) || null;
  const dateConflict = vehicleId ? findConflict(busyPeriods[vehicleId] || [], startDate, openEnded ? null : endDate || null) : null;
  const currencyInfo = CURRENCY_INFO[currency] ?? CURRENCY_INFO["THB"];
  const periodLabel = pricingModel === "monthly" ? "month" : pricingModel === "weekly" ? "week" : pricingModel === "daily" ? "day" : "period";
  const handoverDateTime = deliveryMethod === "delivery" ? deliveryDateTime : deliveryMethod === "collection" ? collectionTime : "";
  const isSameDayHandover = Boolean(handoverDateTime && handoverDateTime.slice(0, 10) === localDate());
  const filteredVehicles = useMemo(() => {
    const needle = vehicleSearch.toLowerCase().trim();
    return vehicles.filter((vehicle) => {
      const haystack = [vehicle.make, vehicle.model, vehicle.trim, vehicle.registration_number].filter(Boolean).join(" ").toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [vehicleSearch, vehicles]);

  // Display logic: when customer is skipped, there are 4 effective steps instead of 5
  // A rental that has already started has no handover to arrange, so that step is left out.
  const skipDelivery = bookingMode === "existing_rental";
  const effectiveStepCount = steps.length - (customerSkipped ? 1 : 0) - (skipDelivery ? 1 : 0);
  // Map internal step index to display number (1-based), accounting for the skipped customer step
  const displayStepNumber = (customerSkipped
    ? step === 0 ? 1 : step       // 0→1, 2→2, 3→3, 4→4
    : step + 1)                    // 0→1, 1→2, 2→3, 3→4, 4→5
    - (skipDelivery && step === 4 ? 1 : 0);

  useEffect(() => {
    setBaseUrl(defaultAppUrl || window.location.origin);
  }, []);

  useEffect(() => {
    if (pricingChosenByHand.current) return;
    if (openEnded) return setPricingModel("monthly");
    if (!startDate || !endDate) return;
    const days = Math.round((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000);
    if (!(days > 0)) return;
    setPricingModel(days >= 28 ? "monthly" : days >= 7 ? "weekly" : "daily");
  }, [startDate, endDate, openEnded]);

  // Prefill the rate when the vehicle or pricing period changes - not when the
  // vehicle list refreshes (after saving, the booked car drops out of the list
  // and the review showed ฿0).
  useEffect(() => {
    const vehicle = vehicles.find((item) => item.id === vehicleId) || null;
    if (vehicle) setRentalRate(rateFor(vehicle, pricingModel));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, pricingModel]);

  // The deposit follows the vehicle: its own if set, otherwise the business's usual one.
  useEffect(() => {
    const vehicle = vehicles.find((item) => item.id === vehicleId) || null;
    if (vehicle) setDepositAmount(vehicle.deposit_amount ?? (defaultDeposit > 0 ? defaultDeposit : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  // Choosing a car that is out now starts the booking on the day it comes back.
  useEffect(() => {
    if (!vehicleId) return;
    const today = businessToday();
    const current = (busyPeriods[vehicleId] || []).find((period) => period.startDate <= today && period.endDate && period.endDate >= today);
    if (current?.endDate && startDate < current.endDate) setStartDate(current.endDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  function canContinue() {
    if (step === 0) return Boolean(selectedVehicle && selectable(selectedVehicle));
    if (step === 1) return Boolean(selectedCustomer); // Only reached when not skipped
    if (step === 2) return Boolean(startDate && rentalRate > 0 && (openEnded || endDate) && !dateConflict);
    if (step === 3) return true;
    return true;
  }

  function goNext() {
    // After vehicle selection, show the customer modal instead of advancing directly
    if (step === 0 && canContinue()) {
      if (bookingMode === "existing_rental") handleAddCustomer();
      else if (selectedCustomer) {
        setCustomerSkipped(false);
        setStep(2);
      } else handleSkipCustomer();
      return;
    }
    if (step < steps.length - 1 && canContinue()) {
      setStep((current) => (current === 2 && skipDelivery ? 4 : current + 1));
    }
  }

  function goBack() {
    if (step === 0) return;

    if (step === 1) {
      // Going back from customer step: go to vehicle or show modal again (if preselected)
      setStep(0);
      return;
    }

    if (customerSkipped && step === 2) {
      // Going back from rental when customer was skipped
      setStep(0); // Go back to vehicle selection
      return;
    }

    setStep((current) => (current === 4 && skipDelivery ? 2 : current - 1));
  }

  function handleSkipCustomer() {
    if (bookingMode === "existing_rental") {
      setCustomerSkipped(false);
      setShowCustomerModal(false);
      setStep(1);
      return;
    }
    setCustomerSkipped(true);
    setSelectedCustomer(null);
    setShowCustomerModal(false);
    setStep(2);
  }

  function handleAddCustomer() {
    setCustomerSkipped(false);
    setShowCustomerModal(false);
    setStep(1);
  }

  function setRentalStartToday() {
    setStartDate(localDate());
  }

  function setHandoverNow() {
    const now = localDateTime();
    if (deliveryMethod === "collection") {
      setCollectionTime(now);
    } else {
      setDeliveryDateTime(now);
    }
  }

  function toggleWalkInNow(checked: boolean) {
    setWalkInNow(checked);
    if (!checked) return;

    const now = localDateTime();
    setBookingMode("existing_rental");
    setCustomerSkipped(false);
    setStartDate(localDate());
    setDeliveryMethod("delivery");
    setDeliveryDateTime(now);
    setWalkInFastTrack(true);
    setWalkInPaymentAmount(rentalRate);
    setWalkInDepositAmount(depositAmount);
  }

  function submitBookingLink() {
    submitIntentRef.current = "booking_link";
    formRef.current?.requestSubmit();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setShareResult(null);
    const form = event.currentTarget;
    const submitIntent = submitIntentRef.current;
    const shouldFastTrackWalkIn = submitIntent === "walk_in" || (submitIntent === "default" && walkInFastTrack);

    if (shouldFastTrackWalkIn && !selectedCustomer) {
      setError("Choose or add a customer before recording a walk-in rental.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData(form);
        const fastTrack = submitIntent === "booking_link" ? false : shouldFastTrackWalkIn;
        const requestedBookingMode = submitIntent === "booking_link" ? "booking_link" : fastTrack ? "existing_rental" : bookingMode;
        formData.set("includedItems", JSON.stringify(includedItems));
        formData.set("openEnded", String(openEnded));
        formData.set("baseUrl", baseUrl || defaultAppUrl || window.location.origin);
        formData.set("bookingMode", requestedBookingMode);
        formData.set("walkInFastTrack", String(fastTrack));
        formData.set("walkInPaymentAmount", String(walkInPaymentAmount || rentalRate || 0));
        formData.set("walkInDepositAmount", String(walkInDepositAmount || depositAmount || 0));
        formData.set("walkInPaymentMethod", walkInPaymentMethod);
        formData.set("walkInPaymentNote", walkInPaymentNote);
        formData.set("existingPaid", existingPaid);
        formData.set("existingPaidUntil", existingPaidUntil);
        formData.set("existingDepositHeld", String(existingDepositHeld));
        const result = await createBooking(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if ("mode" in result && result.mode === "existing_rental") {
          window.location.href = `/bookings/${result.rentalId}${fastTrack ? "?success=walk-in" : ""}`;
          return;
        }
        setShareResult(result);
      } catch (bookingError) {
        setError(bookingError instanceof Error ? bookingError.message : "Unable to create booking.");
      }
    });
  }

  const backDisabled = step === 0 || showCustomerModal || Boolean(shareResult);

  return (
    <form className="space-y-3" onSubmit={handleSubmit} ref={formRef}>
      <input name="bookingMode" type="hidden" value={bookingMode} />
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="vehicleId" type="hidden" value={vehicleId} />
      <input name="customerId" type="hidden" value={selectedCustomer?.id || ""} />
      <input name="startDate" type="hidden" value={startDate} />
      <input name="endDate" type="hidden" value={endDate} />
      <input name="pricingModel" type="hidden" value={pricingModel} />
      <input name="currency" type="hidden" value={currency} />
      <input name="rentalRate" type="hidden" value={rentalRate} />
      <input name="depositAmount" type="hidden" value={depositAmount} />
      <input name="deliveryMethod" type="hidden" value={deliveryMethod} />
      <input name="deliveryLocation" type="hidden" value={deliveryLocation} />
      <input name="deliveryPlaceId" type="hidden" value={deliveryPlaceId} />
      <input name="deliveryLat" type="hidden" value={deliveryLat} />
      <input name="deliveryLng" type="hidden" value={deliveryLng} />
      <input name="deliveryDateTime" type="hidden" value={deliveryDateTime} />
      <input name="collectionAddress" type="hidden" value={collectionAddress} />
      <input name="collectionTime" type="hidden" value={collectionTime} />
      <input name="shareChannel" type="hidden" value="copy" />
      <input name="specialConditions" type="hidden" value={specialConditions} />
      <input name="baseUrl" type="hidden" value={baseUrl} />
      <input name="walkInFastTrack" type="hidden" value={String(walkInFastTrack)} />
      <input name="walkInPaymentAmount" type="hidden" value={walkInPaymentAmount} />
      <input name="walkInDepositAmount" type="hidden" value={walkInDepositAmount} />
      <input name="walkInPaymentMethod" type="hidden" value={walkInPaymentMethod} />
      <input name="walkInPaymentNote" type="hidden" value={walkInPaymentNote} />
      <input name="upfrontPeriods" type="hidden" value={upfrontEnabled ? upfrontPeriods : 0} />
      <input name="upfrontRate" type="hidden" value={upfrontEnabled ? upfrontRate : 0} />
      <input name="upfrontTotal" type="hidden" value={upfrontEnabled ? upfrontPeriods * upfrontRate : 0} />

      {/* Customer choice modal — shown after vehicle selection */}
      {showCustomerModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3 p-3 pb-3">
              <div>
                <h2 className="text-xl font-semibold text-[var(--foreground)]">Add customer details?</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  The booking link you generate will ask your customer to fill in their personal details, upload their passport and driving licence, and sign the rental contract. You don't need their information before sending the link.
                </p>
              </div>
              <button
                aria-label="Close"
                className="pressable shrink-0 rounded-full p-2 text-[var(--muted)] hover:bg-[#fbfaf8]"
                onClick={() => setShowCustomerModal(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 px-6 pb-6">
              {/* Skip for now — primary / recommended */}
              {bookingMode === "booking_link" ? (
                <button
                  className="pressable w-full rounded-lg border-2 border-[var(--primary)] bg-[var(--primary-light)] p-3 text-left transition hover:bg-[var(--primary-light)]"
                  onClick={handleSkipCustomer}
                  type="button"
                >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
                    <Send size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--foreground)]">Skip for now</p>
                      <Badge tone="green">Recommended</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">Your customer will complete their details via the booking link. You can assign a customer later.</p>
                  </div>
                </div>
                </button>
              ) : (
                <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-sm font-semibold text-[#92400e]">
                  Existing rentals need a customer now because the rental is created as active immediately.
                </div>
              )}

              {/* Add customer now — secondary */}
              <button
                className="pressable w-full rounded-lg border border-[var(--border)] bg-white p-3 text-left transition hover:border-[var(--primary)] hover:bg-[var(--primary-light)]"
                onClick={handleAddCustomer}
                type="button"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
                    <UserPlus size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--foreground)]">Add customer now</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Select a returning customer or add a new one</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step !== 0 ? (
        <div className="content-section flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
          <span className="font-semibold text-[var(--foreground)]">{bookingMode === "booking_link" ? "Booking link for the customer" : "Recording a rental that has already started"}</span>
          <button
            className="font-semibold text-[var(--primary)] underline"
            onClick={() => {
              if (bookingMode === "booking_link") {
                setBookingMode("existing_rental");
                setCustomerSkipped(false);
                if (!selectedCustomer) setStep((current) => (current >= 2 ? 1 : current));
              } else {
                setBookingMode("booking_link");
              }
            }}
            type="button"
          >
            {bookingMode === "booking_link" ? "It has already started" : "Send a booking link instead"}
          </button>
        </div>
      ) : null}
      <div className={step === 0 ? "content-section" : "hidden"}>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`pressable rounded-lg border p-3 text-left ${bookingMode === "booking_link" ? "border-[var(--primary)] bg-[var(--primary-light)]" : "border-[var(--border)] bg-white"}`}
            onClick={() => setBookingMode("booking_link")}
            type="button"
          >
            <p className="font-semibold text-[var(--foreground)]">New booking</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Send a link. The customer fills in and signs on their phone.</p>
          </button>
          <button
            className={`pressable rounded-lg border p-3 text-left ${bookingMode === "existing_rental" ? "border-[var(--primary)] bg-[var(--primary-light)]" : "border-[var(--border)] bg-white"}`}
            onClick={() => {
              setBookingMode("existing_rental");
              setCustomerSkipped(false);
              // A rental already under way needs its customer chosen first.
              if (!selectedCustomer) setStep((current) => (current >= 2 ? 1 : current));
            }}
            type="button"
          >
            <p className="font-semibold text-[var(--foreground)]">Already out</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">The customer has the vehicle now. Just record it.</p>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-1">
        <div className="flex items-center justify-between text-xs font-semibold uppercase text-[var(--muted)]">
          <span>
            Step {displayStepNumber} of {effectiveStepCount}
          </span>
          <span>{steps[step]}</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar value={(displayStepNumber / effectiveStepCount) * 100} />
        </div>
      </div>

      {step === 0 ? (
        <section className="content-section">
          <Header icon={Car} eyebrow="Step 1" title="Select vehicle" />
          <label className="mt-3 block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Search by make, model, or plate</span>
            <input
              className={inputClass}
              onChange={(event) => setVehicleSearch(event.target.value.replace(/^🔎\s*/, ""))}
              placeholder="🔎 Toyota, Ranger, BKK..."
              value={vehicleSearch ? `🔎 ${vehicleSearch}` : ""}
            />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[...filteredVehicles]
              .map((vehicle) => ({ vehicle, rank: !selectable(vehicle) ? 2 : availabilityNote(busyPeriods[vehicle.id] || [], businessToday()) ? 1 : 0 }))
              .sort((a, b) => a.rank - b.rank)
              .map(({ vehicle }) => {
              const disabled = !selectable(vehicle);
              const selected = vehicle.id === vehicleId;
              return (
                <button
                  className={`pressable rounded-lg border p-3 text-left ${selected ? "border-[var(--primary)] bg-[var(--primary-light)]" : "border-[var(--border)] bg-white"} ${disabled ? "opacity-55" : ""}`}
                  disabled={disabled}
                  key={vehicle.id}
                  onClick={() => setVehicleId(vehicle.id)}
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
                      <Car size={25} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold text-[var(--foreground)]">{vehicleTitle(vehicle)}</span>
                      <span className="font-mono-data block text-sm font-bold text-[var(--muted)]">{vehicle.registration_number}</span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        {(() => {
                          const note = disabled ? null : availabilityNote(busyPeriods[vehicle.id] || [], businessToday());
                          return (
                            <Badge tone={disabled ? "neutral" : note ? "amber" : selected ? "green" : "blue"}>
                              {disabled ? VEHICLE_STATUS_LABELS[vehicle.status] || vehicle.status : note || "Available"}
                            </Badge>
                          );
                        })()}
                        {vehicle.monthly_rate > 0 ? (
                          <Badge tone="neutral"><span className="font-mono-data">{money(vehicle.monthly_rate, currency)} / month</span></Badge>
                        ) : null}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="content-section">
          <Header icon={UserRound} eyebrow="Step 2" title="Select or create customer" />
          {/* Allow re-opening the skip modal */}
          <button
            className="pressable mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--muted)]"
            hidden={bookingMode === "existing_rental"}
            onClick={handleSkipCustomer}
            type="button"
          >
            <Send size={14} />
            Send the link without choosing a customer
          </button>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="min-w-0 flex-1">
              <CustomerSelector customers={customers} defaultCustomerId={preselectedCustomerId} name="customerSelectorId" onSelect={setSelectedCustomer} organizationId={organizationId} />
            </div>

          </div>
          {selectedCustomer ? (
            <div className="sub-surface mt-3 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    {flagForNationality(selectedCustomer.nationality)} {selectedCustomer.full_name}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--muted)]">{selectedCustomer.phone || "No phone"}</p>
                </div>
                <Badge tone={documentTone(selectedCustomer.document_status)}>{documentLabel(selectedCustomer.document_status)}</Badge>
              </div>
              {selectedCustomer.document_status !== "complete" ? (
                <p className="mt-3 rounded-lg bg-[#fffbeb] p-3 text-sm font-semibold text-[#92400e]">Customer is missing documents. They can upload via the booking link.</p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="content-section">
          <Header icon={CalendarDays} eyebrow={`Step ${displayStepNumber}`} title="Rental details" />
          {selectedVehicle ? (
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              {[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(" ")}
              {selectedVehicle.registration_number ? <span className="font-mono-data ml-2 text-[var(--muted)]">{selectedVehicle.registration_number}</span> : null}{" "}
              <button className="ml-1 font-semibold text-[var(--primary)] underline" onClick={() => setStep(0)} type="button">
                Change
              </button>
            </p>
          ) : null}
          {bookingMode === "booking_link" ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {selectedCustomer && !customerSkipped ? `For ${selectedCustomer.full_name}. ` : "The customer fills in their own details from the link. "}
              <button className="font-semibold text-[var(--primary)] underline" onClick={handleAddCustomer} type="button">
                {selectedCustomer && !customerSkipped ? "Change customer" : "Choose a returning customer instead"}
              </button>
            </p>
          ) : null}
          {bookingMode === "existing_rental" ? (
            <label className="checkbox-label sub-surface mt-3 min-h-12 font-bold text-[var(--foreground)]" style={{ display: "flex", alignItems: "center", padding: "10px 12px" }}>
              <input
                checked={walkInNow}
                className="flex-shrink-0"
                onChange={(event) => toggleWalkInNow(event.target.checked)}
                type="checkbox"
              />
              <span>This is a walk-in - happening right now</span>
            </label>
          ) : null}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:items-end">
            <label className="block">
              <span className="flex items-center justify-between gap-2 text-[11px] font-medium text-[var(--foreground-secondary)]">
                <span>Rental start date</span>
                <button
                  className="pressable rounded-full border border-[var(--border)] bg-white px-2 py-1 text-[10px] font-semibold text-[var(--primary)]"
                  onClick={setRentalStartToday}
                  type="button"
                >
                  Today
                </button>
              </span>
              <input className={inputClass} onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Rental end date</span>
              <input className={inputClass} disabled={openEnded} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
            </label>
          </div>
          {bookingMode === "existing_rental" ? (
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
              Use the date the rental actually started.
            </p>
          ) : null}
          <label className="checkbox-label sub-surface mt-3 min-h-12 font-bold text-[var(--foreground)]" style={{ display: "flex", alignItems: "center", padding: "10px 12px" }}>
            <input
              checked={openEnded}
              className="flex-shrink-0"
              name="openEndedToggle"
              onChange={(event) => setOpenEnded(event.target.checked)}
              type="checkbox"
            />
            <span>Open-ended (no return date yet)</span>
          </label>
          {dateConflict ? (
            <p className="mt-3 rounded-lg border border-[#fecaca] bg-[#fff1f2] p-3 text-sm font-bold text-[#be123c]" role="alert">
              {conflictMessage(dateConflict)}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
            {["daily", "weekly", "monthly", "custom"].map((period) => (
              <button
                className={`pressable min-h-11 rounded-lg border px-1 py-2 text-sm font-semibold capitalize ${pricingModel === period ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
                key={period}
                onClick={() => {
                  pricingChosenByHand.current = true;
                  setPricingModel(period);
                }}
                type="button"
              >
                {period}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">{pricingModel === "custom" ? "Rental rate" : `Rate per ${periodLabel}`}</span>
              <input
                className="font-mono-data mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]"
                inputMode="numeric"
                onChange={(event) => setRentalRate(parseMoneyInput(event.target.value))}
                placeholder={`${currencyInfo.symbol} 0`}
                required
                type="text"
                value={moneyInput(rentalRate, currencyInfo)}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Deposit amount</span>
              <input
                className="font-mono-data mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]"
                inputMode="numeric"
                onChange={(event) => setDepositAmount(parseMoneyInput(event.target.value))}
                placeholder={`${currencyInfo.symbol} 0`}
                type="text"
                value={moneyInput(depositAmount, currencyInfo, true)}
              />
            </label>
          </div>
          {(() => {
            const source = rateWithSource(selectedVehicle, pricingModel);
            if (!source.from || rentalRate !== source.rate) return null;
            const per = source.from === "daily" ? "day" : source.from === "weekly" ? "week" : "month";
            const savedRate = Number((source.from === "daily" ? selectedVehicle?.daily_rate : source.from === "weekly" ? selectedVehicle?.weekly_rate : selectedVehicle?.monthly_rate) || 0);
            return (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Worked out from this vehicle&apos;s rate of {money(savedRate, currency)} a {per}. Change it if you agreed something else.
              </p>
            );
          })()}
          {!(rentalRate > 0) ? (
            <p className="mt-2 text-xs font-semibold text-[#b45309]">
              {pricingModel === "custom" ? "Enter the rate to continue." : `This vehicle has no rates saved. Enter the rate per ${periodLabel} to continue.`}
            </p>
          ) : null}
          <div className="mt-3">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">What is included</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {includedOptions.map((item) => (
                <label
                  className="checkbox-label sub-surface min-h-12 font-bold text-[var(--foreground-secondary)]"
                  key={item}
                  style={{ display: "flex", alignItems: "center", padding: "10px 12px" }}
                >
                  <input
                    checked={includedItems.includes(item)}
                    className="flex-shrink-0"
                    name="includedItem"
                    onChange={(event) => {
                      setIncludedItems((current) => (event.target.checked ? [...current, item] : current.filter((entry) => entry !== item)));
                    }}
                    type="checkbox"
                    value={item}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Rarely needed: kept one tap away so the usual booking is a short screen. */}
          <details className="mt-3" open={upfrontEnabled || Boolean(specialConditions) || currency !== (CURRENCY_INFO[defaultCurrency] ? defaultCurrency : "THB")}>
            <summary className="cursor-pointer py-1 text-sm font-semibold text-[var(--primary)]">More options: paying ahead, currency, special conditions</summary>
          <div className="mt-3">
            <label
              className="checkbox-label sub-surface min-h-12 font-bold text-[var(--foreground)]"
              style={{ display: "flex", alignItems: "center", padding: "10px 12px" }}
            >
              <input
                checked={upfrontEnabled}
                className="flex-shrink-0"
                onChange={(event) => {
                  setUpfrontEnabled(event.target.checked);
                  if (event.target.checked) {
                    setUpfrontPeriods(1);
                    setUpfrontRate(rentalRate);
                  } else {
                    setUpfrontPeriods(0);
                    setUpfrontRate(0);
                  }
                }}
                type="checkbox"
              />
              <span>Customer is paying multiple {periodLabel}s upfront</span>
            </label>
            {upfrontEnabled ? (
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">How many {periodLabel}s upfront?</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]"
                    inputMode="numeric"
                    min={1}
                    onChange={(event) => setUpfrontPeriods(Math.max(1, Number(event.target.value) || 1))}
                    type="number"
                    value={upfrontPeriods}
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Rate per {periodLabel}</span>
                  <input
                    className="font-mono-data mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]"
                    inputMode="numeric"
                    onChange={(event) => setUpfrontRate(parseMoneyInput(event.target.value))}
                    placeholder={`${currencyInfo.symbol} 0`}
                    type="text"
                    value={moneyInput(upfrontRate, currencyInfo)}
                  />
                  <p className="mt-1 text-[11px] text-[var(--muted)]">Adjust if offering a discount</p>
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Total upfront</span>
                  <div className="font-mono-data mt-1 flex h-10 items-center rounded-lg border border-[var(--border)] bg-[#fbfaf8] px-3 text-[13px] font-bold text-[var(--foreground)]">
                    {money(upfrontPeriods * upfrontRate, currency)}
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">{upfrontPeriods} × {money(upfrontRate, currency)}</p>
                </label>
              </div>
            ) : null}
          </div>
          <div className="mt-3 max-w-[12rem]">
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Currency</span>
              <select className={inputClass} onChange={(event) => setCurrency(event.target.value)} value={currency}>
                {Object.entries(CURRENCY_INFO).map(([code, info]) => (
                  <option key={code} value={code}>
                    {info.symbol} - {code}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Special conditions</span>
            <textarea className={inputClass} onChange={(event) => setSpecialConditions(event.target.value)} placeholder="Optional terms that should appear in the contract" rows={4} value={specialConditions} />
          </label>
          </details>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="content-section">
          <Header icon={MapPin} eyebrow={`Step ${displayStepNumber}`} title="Handing over the vehicle" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["delivery", "I deliver"],
              ["collection", "They collect"],
              ["tbd", "Decide later"]
            ].map(([value, label]) => (
              <button
                className={`pressable min-h-12 rounded-lg border px-1 py-2 text-sm font-semibold ${deliveryMethod === value ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
                key={value}
                onClick={() => setDeliveryMethod(value as "delivery" | "collection" | "tbd")}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {deliveryMethod === "tbd" ? (
            <div className="mt-3 flex items-start gap-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-sm leading-6 text-[#92400e]">
              <span aria-label="Information" title="Decide later">ⓘ</span>
              <p>Nothing to fill in now. The customer can say where and when they would like it on their booking link, and you can set it later from the booking.</p>
            </div>
          ) : deliveryMethod === "delivery" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <GooglePlaceInput
                label="Delivery location"
                helperText="Type a specific hotel, airport, pier, villa, or address — or leave blank to confirm later."
                homeTerritory={homeTerritory}
                onChange={setDeliveryLocation}
                onPlaceSelect={({ address, lat, lng, placeId }) => {
                  setDeliveryLocation(address);
                  setDeliveryPlaceId(placeId || "");
                  setDeliveryLat(lat === null ? "" : String(lat));
                  setDeliveryLng(lng === null ? "" : String(lng));
                }}
                placeholder="Search Google Maps or enter an address..."
                tooltip="Optional — you can confirm the location later, or your customer can provide it through the booking link"
                value={deliveryLocation}
              />
              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[var(--foreground-secondary)]">
                  <label htmlFor="delivery-datetime">Delivery date and time</label>
                  <span className="cursor-help text-[var(--muted)]" title="Optional — leave blank if not yet confirmed. The customer cannot select a time in the past through the booking link.">ⓘ</span>
                </div>
                <button className="pressable mb-2 min-h-10 rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-[13px] font-bold text-white" onClick={setHandoverNow} type="button">
                  Now
                </button>
                <input className={inputClass} id="delivery-datetime" onChange={(event) => setDeliveryDateTime(event.target.value)} type="datetime-local" value={deliveryDateTime} />
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">Leave blank if not yet agreed.</p>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="inline-flex items-center gap-2 text-[11px] font-medium text-[var(--foreground-secondary)]">
                  Collection address
                  <span className="cursor-help text-[var(--muted)]" title="Optional — you can confirm the location later, or your customer can provide it through the booking link">ⓘ</span>
                </span>
                <input className={inputClass} onChange={(event) => setCollectionAddress(event.target.value)} value={collectionAddress} />
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">Type a specific hotel, airport, pier, villa, or address — or leave blank to confirm later.</p>
              </label>
              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--foreground-secondary)]">
                  <label htmlFor="collection-datetime">Collection time</label>
                  <span className="cursor-help text-[var(--muted)]" title="Optional — leave blank if not yet confirmed. The customer cannot select a time in the past through the booking link.">ⓘ</span>
                </div>
                <button className="pressable min-h-10 rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" onClick={setHandoverNow} type="button">
                  Now
                </button>
                <input className={inputClass} id="collection-datetime" onChange={(event) => setCollectionTime(event.target.value)} type="datetime-local" value={collectionTime} />
                <p className="mt-2 text-xs font-semibold text-[var(--muted)]">Leave blank if not yet agreed.</p>
              </div>
            </div>
          )}
          {isSameDayHandover ? (
            <div className="mt-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs font-bold text-[#92400e]">
              Walk-in / same-day handover - payment will be due immediately.
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 4 ? (
        <section className="content-section">
          <Header icon={CheckCircle2} eyebrow={`Step ${displayStepNumber}`} title={shareResult ? "All done" : bookingMode === "existing_rental" ? "Check and save" : "Check and send"} />
          <BookingLinkSharePanel result={shareResult} />
          {isSameDayHandover ? (
            <div className="mt-3 rounded-lg border border-[#bfe0db] bg-[#fbfaf8] p-3">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--primary)]">Walk-in fast track</p>
              <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
                This handover is scheduled for today. You can send the customer the booking link, or record payment now and create an active rental immediately.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  className="pressable min-h-11 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground-secondary)]"
                  onClick={submitBookingLink}
                  type="button"
                >
                  Share booking link with customer
                </button>
                <button
                  className="pressable min-h-11 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                    setWalkInFastTrack(true);
                    setWalkInPaymentAmount((current) => current || rentalRate);
                    setWalkInDepositAmount((current) => current || depositAmount);
                  }}
                  type="button"
                >
                  Payment already collected - record now
                </button>
              </div>
              {walkInFastTrack ? (
                <div className="mt-3 grid gap-3 rounded-lg border border-[var(--border)] bg-white p-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Payment amount</span>
                    <input
                      className="font-mono-data mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]"
                      inputMode="numeric"
                      onChange={(event) => setWalkInPaymentAmount(parseMoneyInput(event.target.value))}
                      placeholder={`${currencyInfo.symbol} 0`}
                      type="text"
                      value={moneyInput(walkInPaymentAmount || rentalRate, currencyInfo, true)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Deposit amount</span>
                    <input
                      className="font-mono-data mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]"
                      inputMode="numeric"
                      onChange={(event) => setWalkInDepositAmount(parseMoneyInput(event.target.value))}
                      placeholder={`${currencyInfo.symbol} 0`}
                      type="text"
                      value={moneyInput(walkInDepositAmount || depositAmount, currencyInfo, true)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Payment method</span>
                    <select className={inputClass} onChange={(event) => setWalkInPaymentMethod(event.target.value)} value={walkInPaymentMethod}>
                      <option value="cash">Cash</option>
                      <option value="promptpay">PromptPay</option>
                      <option value="bank_transfer">Bank transfer</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Note</span>
                    <input className={inputClass} onChange={(event) => setWalkInPaymentNote(event.target.value)} placeholder="Optional internal note" value={walkInPaymentNote} />
                  </label>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 grid gap-3">
            <SummaryRow label="Vehicle" value={selectedVehicle ? `${vehicleTitle(selectedVehicle)} - ${selectedVehicle.registration_number}` : "Not selected"} />
            <SummaryRow
              label="Customer"
              value={
                customerSkipped
                  ? "They add their own details, ID photos and signature on the link"
                  : selectedCustomer
                    ? `${selectedCustomer.full_name} - ${selectedCustomer.nationality || "Nationality not set"}`
                    : "Not selected"
              }
            />
            <SummaryRow
              label="Rental"
              value={`${longDay(startDate)} – ${openEnded ? "open-ended" : longDay(endDate)} · ${money(rentalRate, currency)} / ${periodLabel}`}
            />
            {upfrontEnabled && upfrontPeriods > 0 ? (
              <SummaryRow label="Upfront" mono value={`${upfrontPeriods} ${periodLabel}${upfrontPeriods !== 1 ? "s" : ""} × ${money(upfrontRate, currency)} = ${money(upfrontPeriods * upfrontRate, currency)}`} />
            ) : null}
            <SummaryRow label="Deposit" mono value={money(depositAmount, currency)} />
            {bookingMode === "booking_link" && rentalRate > 0
              ? (() => {
                  const rentalDays = !openEnded && startDate && endDate ? Math.max(1, Math.round((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000)) : 1;
                  const firstRent =
                    pricingModel === "daily"
                      ? rentalRate * rentalDays
                      : upfrontEnabled && upfrontPeriods > 0
                        ? upfrontPeriods * upfrontRate
                        : rentalRate;
                  const rentWords =
                    pricingModel === "daily"
                      ? `${rentalDays} ${rentalDays === 1 ? "day" : "days"} rent`
                      : upfrontEnabled && upfrontPeriods > 0
                        ? `${upfrontPeriods} ${periodLabel}${upfrontPeriods !== 1 ? "s" : ""} rent`
                        : pricingModel === "custom"
                          ? "rent"
                          : `first ${periodLabel}'s rent`;
                  return (
                    <SummaryRow
                      label="Customer pays first"
                      value={`${money(firstRent + depositAmount, currency)} · ${money(firstRent, currency)} ${rentWords}${depositAmount > 0 ? ` + ${money(depositAmount, currency)} deposit` : ""}`}
                    />
                  );
                })()
              : null}
            {skipDelivery ? null : <SummaryRow
              label="Handover"
              value={
                deliveryMethod === "tbd"
                  ? "To be arranged"
                  : deliveryMethod === "delivery"
                    ? `Delivery to ${deliveryLocation || "a place to be confirmed"} · ${deliveryDateTime ? longDateTime(deliveryDateTime) : "time to be confirmed"}`
                    : `Collection from ${collectionAddress || "a place to be confirmed"} · ${collectionTime ? longDateTime(collectionTime) : "time to be confirmed"}`
              }
            />}
            <SummaryRow label="Included" value={includedItems.length ? includedItems.join(", ") : "None selected"} />
          </div>
          {bookingMode === "existing_rental" && !walkInFastTrack ? (
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">What has the customer paid so far?</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Rent is worked out from the start date and the rate. Anything marked as paid is recorded on the date it fell due.</p>
              <div className="mt-3 space-y-2">
                {(
                  [
                    ["up_to_date", "Up to date", "Every payment due so far has been paid."],
                    ["until", "Paid until a date", "Payments due before that date are paid; anything due since shows as owed."],
                    ["none", "Nothing paid yet", "Everything due so far shows as owed."]
                  ] as const
                ).map(([value, label, hint]) => (
                  <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${existingPaid === value ? "border-[var(--primary)] bg-white" : "border-[var(--border)] bg-white"}`} key={value}>
                    <input checked={existingPaid === value} className="mt-1 accent-[#0d9488]" onChange={() => setExistingPaid(value)} type="radio" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[var(--foreground)]">{label}</span>
                      <span className="block text-xs text-[var(--muted)]">{hint}</span>
                      {value === "until" && existingPaid === "until" ? (
                        <input className={`${inputClass} mt-2 max-w-[200px]`} min={startDate} onChange={(event) => setExistingPaidUntil(event.target.value)} type="date" value={existingPaidUntil} />
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
              {depositAmount > 0 ? (
                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] bg-white p-3">
                  <input checked={existingDepositHeld} className="accent-[#0d9488]" onChange={(event) => setExistingDepositHeld(event.target.checked)} type="checkbox" />
                  <span className="text-sm font-semibold text-[var(--foreground)]">You are holding the {money(depositAmount, currency)} deposit</span>
                </label>
              ) : null}
              <p className="mt-3 text-xs text-[var(--muted)]">The rental starts as on rent straight away, with no booking link. You can still send the customer a link to sign from the booking.</p>
            </div>
          ) : null}
          {error ? <p className="mt-3 rounded-lg bg-[#ffe4e6] p-3 text-sm font-bold text-[#be123c]">{error}</p> : null}
        </section>
      ) : null}

      <div className="sticky-actions sticky z-20 -mx-4 flex gap-2 border-t border-[var(--border)] bg-white/95 p-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <button
          className="pressable min-h-12 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground-secondary)] disabled:opacity-50"
          disabled={backDisabled}
          onClick={goBack}
          type="button"
        >
          Back
        </button>
        {/* Separate keys: otherwise React reuses the Continue button as the submit
            button, and the click that opens the review step also submits it. */}
        {step < steps.length - 1 ? (
          <button
            className="pressable min-h-12 flex-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white shadow-lg disabled:bg-[#94a3b8]"
            disabled={!canContinue() || showCustomerModal}
            key="continue"
            onClick={goNext}
            type="button"
          >
            Continue
          </button>
        ) : shareResult ? (
          <Link
            className="pressable min-h-12 flex-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-center text-sm font-semibold text-white shadow-lg inline-flex items-center justify-center"
            href={`/bookings/${shareResult.rentalId}`}
          >
            View booking
          </Link>
        ) : (
          <button
            className="pressable min-h-12 flex-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white shadow-lg disabled:bg-[#94a3b8]"
            disabled={isPending}
            key="submit"
            onClick={() => {
              submitIntentRef.current = walkInFastTrack ? "walk_in" : "default";
            }}
            type="submit"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <span className="spinner" />
                {bookingMode === "existing_rental" || walkInFastTrack ? "Recording..." : "Generating..."}
              </span>
            ) : walkInFastTrack ? (
              "Record walk-in rental"
            ) : bookingMode === "existing_rental" ? (
              "Save rental"
            ) : (
              "Generate booking link"
            )}
          </button>
        )}
      </div>
    </form>
  );
}

function BookingLinkSharePanel({ result }: { result: BookingShareResult | null }) {
  const bookingUrl = result?.bookingUrl || "";
  const encodedUrl = encodeURIComponent(bookingUrl);
  const encodedMessage = encodeURIComponent(result?.message || bookingUrl);
  // The QR code is drawn here on the device, so the customer's link is never sent to an outside service.
  const [qrUrl, setQrUrl] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    if (!bookingUrl) return;
    let cancelled = false;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(bookingUrl, { width: 400, margin: 2 }))
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => undefined);
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    return () => {
      cancelled = true;
    };
  }, [bookingUrl]);

  async function nativeShare() {
    try {
      await navigator.share({ text: result?.message || bookingUrl, url: result?.message?.includes(bookingUrl) ? undefined : bookingUrl });
    } catch {
      // Closed without sharing: nothing to do.
    }
  }
  const shareChannels = [
    { key: "whatsapp", label: "WhatsApp", title: "Share via WhatsApp", icon: <WhatsAppLogo /> },
    { key: "line", label: "LINE", title: "Share via LINE", icon: <LineLogo /> },
    { key: "messenger", label: "Messenger", title: "Share via Messenger", icon: <MessengerLogo /> },
    { key: "sms", label: "SMS", title: "Share via SMS", icon: <SmsLogo /> },
    { key: "email", label: "Email", title: "Share via email", icon: <EmailLogo /> }
  ];
  const shareLinks: Record<string, string> = result
    ? {
        whatsapp: result.whatsappUrl || `https://wa.me/?text=${encodedMessage}`,
        line: result.lineUrl || `https://line.me/R/msg/text/${encodedMessage}`,
        messenger: `https://www.messenger.com/t/?link=${encodedUrl}`,
        sms: result.smsUrl || `sms:?body=${encodedMessage}`,
        email: result.emailUrl || `mailto:?subject=${encodeURIComponent("Booking link")}&body=${encodedMessage}`
      }
    : {};

  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
    } catch {
      const el = document.createElement("textarea");
      el.value = bookingUrl;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare(channel: string) {
    const href = shareLinks[channel];
    if (!href) return;

    if (href.startsWith("mailto:") || href.startsWith("sms:")) {
      window.location.href = href;
      return;
    }

    window.open(href, "_blank", "noopener,noreferrer");
  }

  // Nothing to share until the link exists.
  if (!bookingUrl) return null;

  return (
    <div className="mt-3 scroll-mt-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4" ref={panelRef}>
      <p className="flex items-center gap-2 text-base font-semibold text-[#166534]">
        <CheckCircle2 size={20} />
        Booking created
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--foreground-secondary)]">Now send the link to your customer. They fill in their details and sign on their phone.</p>

      {canNativeShare ? (
        <button className="pressable mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white" onClick={nativeShare} type="button">
          Send to customer
        </button>
      ) : null}

      <div className="mt-3 grid grid-cols-5 gap-1 rounded-lg border border-[var(--border)] bg-white p-1">
        {shareChannels.map(({ icon, key, label, title }) => (
          <button
            aria-label={title}
            className="pressable flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 hover:bg-gray-50"
            key={key}
            onClick={() => handleShare(key)}
            title={title}
            type="button"
          >
            {icon}
            <span className="max-w-full truncate tracking-tight" style={{ fontSize: "10px", color: "#64748b", fontWeight: 500 }}>{label}</span>
          </button>
        ))}
      </div>

      <button
        className="pressable mt-2 flex min-h-12 w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-left text-sm font-semibold"
        onClick={copyLink}
        style={{ color: copied ? "var(--primary)" : "var(--foreground-secondary)" }}
        type="button"
      >
        <Copy className="shrink-0" size={17} />
        <span className="shrink-0">{copied ? "Copied" : "Copy link"}</span>
        <span className="font-mono-data min-w-0 flex-1 truncate text-xs font-normal text-[var(--muted)]">{bookingUrl.replace(/^https?:\/\//, "")}</span>
      </button>

      <details className="mt-2 rounded-lg border border-[var(--border)] bg-white">
        <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-[var(--foreground-secondary)]">Customer is with you? Show a code to scan</summary>
        <div className="flex justify-center px-3 pb-4">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="Booking link QR code" height={220} src={qrUrl} style={{ borderRadius: 8, border: "0.5px solid #e2e8f0" }} width={220} />
          ) : (
            <span className="spinner" />
          )}
        </div>
      </details>
    </div>
  );
}

function WhatsAppLogo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.859L.057 23.571a.5.5 0 0 0 .612.612l5.712-1.476A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.693-.516-5.228-1.415l-.375-.222-3.888 1.004 1.004-3.888-.222-.375A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
    </svg>
  );
}

function LineLogo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#06C755" aria-hidden="true">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

function MessengerLogo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <defs>
        <linearGradient id="msgr-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: "#0099FF" }} />
          <stop offset="100%" style={{ stopColor: "#A033FF" }} />
        </linearGradient>
      </defs>
      <path fill="url(#msgr-grad)" d="M12 0C5.373 0 0 5.149 0 11.5c0 3.607 1.786 6.832 4.59 8.965V24l4.197-2.309C9.854 21.88 10.912 22 12 22c6.627 0 12-5.149 12-11.5S18.627 0 12 0zm1.191 15.524l-3.054-3.26-5.963 3.26L10.732 8.5l3.131 3.26L19.752 8.5l-6.561 7.024z" />
    </svg>
  );
}

function SmsLogo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#4CAF50" aria-hidden="true">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
    </svg>
  );
}

function EmailLogo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#EA4335" aria-hidden="true">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  );
}

function GooglePlaceInput({
  helperText,
  homeTerritory,
  label,
  onChange,
  onPlaceSelect,
  placeholder,
  tooltip,
  value
}: {
  helperText: string;
  homeTerritory: string;
  label: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: { address: string; lat: number | null; lng: number | null; placeId?: string }) => void;
  placeholder: string;
  tooltip: string;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const mapsKeyConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  // If Maps hasn't loaded within 3 seconds, fall back to plain text input
  useEffect(() => {
    if (isEnabled || !mapsKeyConfigured) return;
    const timer = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(timer);
  }, [isEnabled, mapsKeyConfigured]);

  const onPlaceSelectRef = useRef(onPlaceSelect);
  onPlaceSelectRef.current = onPlaceSelect;

  useEffect(() => {
    let cancelled = false;
    const placesLoader = loadGooglePlaces();

    if (!placesLoader) {
      return;
    }

    placesLoader
      .then(() => {
        if (cancelled || !inputRef.current || !window.google?.maps?.places?.Autocomplete) {
          return;
        }

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "geometry", "name", "place_id"],
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const address = place.formatted_address || place.name || inputRef.current?.value || "";
          const lat = place.geometry?.location?.lat() ?? null;
          const lng = place.geometry?.location?.lng() ?? null;
          onPlaceSelectRef.current({ address, lat, lng, placeId: place.place_id });
        });
        setIsEnabled(true);

        if (!document.getElementById("routehq-pac-icon-fix")) {
          const style = document.createElement("style");
          style.id = "routehq-pac-icon-fix";
          style.textContent = ".pac-icon { display: none !important; } .pac-item { padding-left: 8px !important; }";
          document.head.appendChild(style);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasError(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // Created once. onPlaceSelect is an inline function that changes on every
    // render, so keying on it made a new Google search box (and a new error
    // pop-up) for every keystroke. The latest callback is read from a ref.
  }, []);

  return (
    <div className="block sm:col-span-2">
      <span className="inline-flex items-center gap-2 text-[11px] font-medium text-[var(--foreground-secondary)]">
        {label}
        <span className="cursor-help text-[var(--muted)]" title={tooltip}>ⓘ</span>
      </span>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          autoComplete="off"
          className="mt-0 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]"
          onChange={(event) => onChange(event.target.value)}
          placeholder={`📍 ${placeholder}`}
          ref={inputRef}
          value={value}
        />
        {isEnabled ? (
          <button
            className="pressable min-h-12 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground-secondary)]"
            onClick={() => setPinModalOpen(true)}
            type="button"
          >
            Drop a pin
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs font-semibold text-[var(--muted)]">
        {isEnabled ? helperText : (hasError || timedOut || !mapsKeyConfigured) ? "Google Maps search unavailable — enter address manually." : helperText}
      </p>
      {pinModalOpen ? (
        <GooglePinModal
          homeTerritory={homeTerritory}
          onClose={() => setPinModalOpen(false)}
          onConfirm={(place) => {
            onPlaceSelect(place);
            setPinModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function GooglePinModal({
  homeTerritory,
  onClose,
  onConfirm
}: {
  homeTerritory: string;
  onClose: () => void;
  onConfirm: (place: { address: string; lat: number | null; lng: number | null; placeId?: string }) => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const [pin, setPin] = useState<GoogleLatLngLiteral>({ lat: 9.512, lng: 100.013 });
  const [address, setAddress] = useState(homeTerritory);
  const [placeId, setPlaceId] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loader = loadGooglePlaces();

    if (!loader) {
      return;
    }

    loader.then(() => {
      if (cancelled || !mapRef.current || !window.google?.maps?.Map || !window.google.maps.Marker || !window.google.maps.Geocoder) {
        return;
      }

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: homeTerritory || "Koh Samui, Thailand" }, (results, status) => {
        const fallbackCenter = { lat: 9.512, lng: 100.013 };
        const location = status === "OK" && results?.[0]?.geometry?.location
          ? { lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() }
          : fallbackCenter;
        const map = new window.google!.maps!.Map(mapRef.current!, {
          center: location,
          mapTypeControl: false,
          streetViewControl: false,
          zoom: 13
        });
        const marker = new window.google!.maps!.Marker({
          draggable: true,
          map,
          position: location
        });
        markerRef.current = marker;
        setPin(location);

        const updateFromPosition = (position: GoogleLatLngLiteral) => {
          setPin(position);
          geocoder.geocode({ location: position }, (reverseResults, reverseStatus) => {
            if (reverseStatus === "OK" && reverseResults?.[0]) {
              setAddress(reverseResults[0].formatted_address);
              setPlaceId(reverseResults[0].place_id || "");
            }
          });
        };

        marker.addListener("dragend", () => {
          const position = marker.getPosition();
          if (position) {
            updateFromPosition({ lat: position.lat(), lng: position.lng() });
          }
        });
        map.addListener("click", (event) => {
          if (!event.latLng) return;
          const nextPosition = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          marker.setPosition(nextPosition);
          updateFromPosition(nextPosition);
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, [homeTerritory]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-2xl rounded-t-3xl bg-white p-3 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Drop a pin</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">Click the map or drag the pin to set the delivery location.</p>
          </div>
          <button className="pressable rounded-full p-2 text-[var(--muted)] hover:bg-[var(--panel-secondary)]" onClick={onClose} type="button">
            <X size={20} />
          </button>
        </div>
        <div className="mt-3 h-80 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)]" ref={mapRef} />
        <p className="mt-3 text-sm font-semibold text-[var(--foreground-secondary)]">{address}</p>
        <div className="mt-3 flex gap-2">
          <button className="pressable min-h-11 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground-secondary)]" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="pressable min-h-11 flex-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white"
            onClick={() => onConfirm({ address, lat: pin.lat, lng: pin.lng, placeId })}
            type="button"
          >
            Confirm location
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ icon: Icon, eyebrow, title }: { icon: LucideIcon; eyebrow: string; title: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
        <Icon size={21} />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase text-[var(--primary)]">{eyebrow}</p>
        <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="sub-surface p-3">
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">{label}</p>
      <p className={`mt-1 font-bold text-[var(--foreground)] ${mono ? "font-mono-data" : ""}`}>{value}</p>
    </div>
  );
}
