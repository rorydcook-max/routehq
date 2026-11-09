"use server";

import { openBusinessScope } from "@/lib/business-time-scope";
import { extrasFrom, priceExtras } from "@/lib/price-rules";
import { extrasIncomeTag } from "@/lib/extras";
import { toInternationalPhone } from "@/lib/phone";
import { vatSettings, withVat } from "@/lib/regional";
import { billingPeriodAmounts, generatePaymentSchedule } from "@/lib/payment-schedule";

import { said } from "@/lib/i18n/server-text";
import { guard, userError } from "@/lib/action-error";
import { completeRentalJobs, retireUnsent, tellRentalCustomer } from "@/lib/customer-messages";
import { allocatePayment, type OpenPayment } from "@/lib/payment-allocation";
import { customerPaymentLabel } from "@/lib/payment-labels";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { markOnboardingStep } from "@/lib/onboarding";
import { activateRental } from "@/lib/rental-activation";
import { settleExistingRental } from "@/lib/existing-rental";
import { dropReferralFee, noteReferralFee } from "@/lib/partner-network";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { niceDate } from "@/lib/nice-date";
import { niceMoney } from "@/lib/nice-money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyOperator } from "@/lib/notify-operator";
import { wallTimeToIso, businessToday } from "@/lib/business-time";
import { DOUBLE_BOOKING_MESSAGE, earlyHandoverBlocker, findConflict, isDoubleBookingError, loadBusyPeriods, vehicleConflictMessage } from "@/lib/rental-conflicts";
import { earlyStartFor, ensureEarlyStartCharge, requestEarlyWaiver, settleEarlyChoice } from "@/lib/early-start";
import { applyLateStart, lateStartNote } from "@/lib/late-start";
import { syncVehicleStatusFromBookings } from "@/lib/vehicle-status";
import { canDecideMoney, getCurrentMembership } from "@/lib/auth/roles";
import { adoptBusinessClock } from "@/lib/auth/active-organization-server";
import { enterBusinessTimeZone } from "@/lib/business-time-scope";
import { holdDeadline, retakeHold } from "@/lib/booking-holds";
import { bookingRules } from "@/lib/booking-rules";
import { bookingLinkMessage } from "@/lib/booking-link-message";
import { removeStoredFiles } from "@/lib/supabase/remove-stored-files";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** What to ask for when a form arrives without a field the person chooses (the rest are the page's own ids). */
const MISSING_FIELD: Record<string, string> = {
  vehicleId: "Choose a vehicle.",
  customerId: "Choose a customer.",
  startDate: "Choose a start date.",
  pricingModel: "Choose a billing period.",
  deliveryMethod: "Choose how the vehicle is handed over.",
  dueDate: "Choose a due date."
};

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  if (!value) {
    throw new Error(MISSING_FIELD[key] || `${key} is required.`);
  }
  return value;
}

function optionalString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim() || null;
}

function numberFromForm(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").replace(/,/g, "").trim();
  return value ? Number(value) : 0;
}

function safeJsonArray(formData: FormData, key: string) {
  try {
    const parsed = JSON.parse(String(formData.get(key) || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The number for a wa.me link: international digits, a local number getting the business's own country code. */
function whatsappDigits(phone: string | null | undefined) {
  return String(toInternationalPhone(phone) || "").replace(/\D/g, "");
}

function shareUrls({
  message,
  phone,
  organizationName
}: {
  message: string;
  phone: string | null | undefined;
  organizationName: string;
}) {
  const encodedMessage = encodeURIComponent(message);
  const whatsappPhone = whatsappDigits(phone);
  return {
    whatsappUrl: whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${encodedMessage}` : "",
    lineUrl: `https://line.me/R/msg/text/${encodedMessage}`,
    smsUrl: phone ? `sms:${phone}?body=${encodedMessage}` : "",
    emailUrl: `mailto:?subject=${encodeURIComponent(`${organizationName} booking link`)}&body=${encodedMessage}`
  };
}

function bookingReference(rental: any) {
  return rental?.reference || rental?.display_code || rental?.id;
}

function operatorName(user: any) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "operator";
}

/**
 * A rental recorded after it started: mark what the customer has already paid.
 * Rent due before `paidBefore` is recorded as paid on the day it fell due
 * (with its income), and the deposit, if held, is recorded as received at the
 * start. Anything else due so far stays owed.
 */
async function createWalkInPaymentRecords({
  supabase,
  rental,
  organizationId,
  vehicleId,
  customerId,
  userId,
  currency,
  paymentAmount,
  depositAmount,
  paymentMethod,
  note
}: {
  supabase: any;
  rental: any;
  organizationId: string;
  vehicleId: string;
  customerId: string;
  userId: string;
  currency: string;
  paymentAmount: number;
  depositAmount: number;
  paymentMethod: string;
  note: string | null;
}) {
  const now = new Date().toISOString();
  const today = businessToday();
  const paymentInserts: Record<string, any>[] = [];

  if (paymentAmount > 0) {
    paymentInserts.push({
      organization_id: organizationId,
      rental_id: rental.id,
      customer_id: customerId,
      vehicle_id: vehicleId,
      amount: paymentAmount,
      due_date: today,
      scheduled_date: today,
      status: "paid",
      currency,
      payment_method: paymentMethod,
      paid_at: now,
      metadata: {
        type: "rent",
        source: "walk_in_fast_track",
        description: "Walk-in rental payment collected",
        note
      }
    });
  }

  if (depositAmount > 0) {
    paymentInserts.push({
      organization_id: organizationId,
      rental_id: rental.id,
      customer_id: customerId,
      vehicle_id: vehicleId,
      amount: depositAmount,
      due_date: today,
      scheduled_date: today,
      status: "paid",
      currency,
      payment_method: paymentMethod,
      paid_at: now,
      metadata: {
        type: "deposit",
        source: "walk_in_fast_track",
        description: "Walk-in security deposit received",
        note
      }
    });
  }

  if (paymentInserts.length > 0) {
    const { error: paymentError } = await supabase.from("rental_payments").insert(paymentInserts);
    if (paymentError) {
      throw new Error(paymentError.message);
    }
  }

  const transactionInserts: Record<string, any>[] = [];

  if (paymentAmount > 0) {
    transactionInserts.push({
      organization_id: organizationId,
      rental_id: rental.id,
      vehicle_id: vehicleId,
      customer_id: customerId,
      type: "rental_income",
      amount: paymentAmount,
      currency,
      transaction_date: today,
      notes: note ? `Walk-in rental payment collected - ${note}` : "Walk-in rental payment collected",
      is_deposit: false,
      created_by: userId,
      metadata: { source: "walk_in_fast_track", payment_method: paymentMethod }
    });
  }

  if (depositAmount > 0) {
    transactionInserts.push({
      organization_id: organizationId,
      rental_id: rental.id,
      vehicle_id: vehicleId,
      customer_id: customerId,
      type: "deposit_received",
      amount: depositAmount,
      currency,
      transaction_date: today,
      notes: note ? `Security deposit received - ${note}` : "Security deposit received",
      is_deposit: true,
      deposit_rental_id: rental.id,
      created_by: userId,
      metadata: { source: "walk_in_fast_track", payment_method: paymentMethod }
    });
  }

  if (transactionInserts.length > 0) {
    const { error: transactionError } = await supabase.from("transactions").insert(transactionInserts);
    if (transactionError) {
      throw new Error(transactionError.message);
    }
  }

  if (depositAmount > 0) {
    const { error: depositError } = await supabase
      .from("rentals")
      .update({
        deposit_held: depositAmount,
        deposit_status: "received",
        deposit_received_at: now
      })
      .eq("id", rental.id)
      .eq("organization_id", organizationId);

    if (depositError) {
      throw new Error(depositError.message);
    }
  }

  // Mark state machine as confirmed so delivery inspection knows payment is already done
  await supabase
    .from("rentals")
    .update({ payment_due_trigger: "manual" })
    .eq("id", rental.id)
    .eq("organization_id", organizationId);
}

/**
 * Server-action errors are hidden in production, so the booking form gets the
 * reason back as a value instead of a thrown error.
 */
export async function createBooking(formData: FormData) {
  try {
    return { ok: true as const, ...(await createBookingOrThrow(formData)) };
  } catch (error) {
    // Our own sentences pass through; database wording never reaches the screen (lib/action-error.ts).
    return { ok: false as const, error: await userError(error, "Couldn't create the booking. Nothing was saved.") };
  }
}

/** A three-letter ISO 4217 code the runtime can format ("JPY", "BRL", "KES"...). */
function isIsoCurrency(code: string) {
  if (!/^[A-Z]{3}$/.test(code)) return false;
  try {
    new Intl.NumberFormat("en-US", { style: "currency", currency: code });
    return true;
  } catch {
    return false;
  }
}

type EarlierVehicleSwap = { vehicleId: string; swapDate: string; label: string };

/**
 * "Started on a different vehicle?" on a rental already under way: the vehicle the customer had first and the day
 * they moved to the vehicle chosen for the booking. Null when not given.
 */
async function earlierVehicleSwap(supabase: any, formData: FormData, args: { organizationId: string; vehicleId: string; startDate: string; endDate: string | null }): Promise<EarlierVehicleSwap | null> {
  const earlierId = String(formData.get("earlierVehicleId") || "").trim();
  if (!earlierId) return null;
  const swapDate = dateOnly(String(formData.get("swapDate") || ""));
  if (earlierId === args.vehicleId) throw new Error("Choose a different vehicle for the start of the rental.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(swapDate)) throw new Error("Choose the day the customer changed vehicle.");
  if (swapDate <= args.startDate.slice(0, 10)) throw new Error("The vehicle change must be after the start date.");
  if (swapDate > businessToday()) throw new Error("The vehicle change can't be in the future.");
  if (args.endDate && swapDate >= args.endDate.slice(0, 10)) throw new Error("The vehicle change must be before the return date.");
  const { data: earlier } = await supabase
    .from("vehicles")
    .select("id, make, model, registration_number")
    .eq("id", earlierId)
    .eq("organization_id", args.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!earlier) throw new Error("Vehicle was not found.");
  return { vehicleId: earlier.id, swapDate, label: [earlier.make, earlier.model].filter(Boolean).join(" ") || String(earlier.registration_number || "") };
}

/**
 * Records the earlier vehicle the way a change of vehicle made in the app is recorded (applyVehicleChange in
 * amendments.ts): rentals.original_vehicle_id (set on insert), a vehicle_changes row and a "Vehicle changed" event on
 * the swap date. Rent and deposit dated before the swap stay with the earlier vehicle, as they do after an in-app change.
 */
async function recordEarlierVehicle(
  supabase: any,
  args: { organizationId: string; rentalId: string; customerId: string | null; userId: string; swap: EarlierVehicleSwap; currentVehicleId: string; currentLabel: string; rate: number }
) {
  const { organizationId, rentalId, swap } = args;
  const changedAt = wallTimeToIso(`${swap.swapDate}T09:00`) || `${swap.swapDate}T00:00:00.000Z`;
  await Promise.all([
    supabase.from("rental_payments").update({ vehicle_id: swap.vehicleId }).eq("organization_id", organizationId).eq("rental_id", rentalId).lt("due_date", swap.swapDate),
    supabase.from("transactions").update({ vehicle_id: swap.vehicleId }).eq("organization_id", organizationId).eq("rental_id", rentalId).lt("transaction_date", swap.swapDate)
  ]);
  const { error } = await supabase.from("vehicle_changes").insert({
    organization_id: organizationId,
    rental_id: rentalId,
    from_vehicle_id: swap.vehicleId,
    to_vehicle_id: args.currentVehicleId,
    reason: "other",
    reason_notes: "Vehicle changed",
    changed_at: changedAt,
    changed_by: args.userId,
    original_vehicle_disposition: "available",
    rate_before: args.rate,
    rate_after: args.rate
  });
  if (error) throw new Error(error.message);
  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: args.userId,
    entity_type: "rental",
    entity_id: rentalId,
    rental_id: rentalId,
    vehicle_id: args.currentVehicleId,
    customer_id: args.customerId,
    event_type: "vehicle_changed",
    title: "Vehicle changed",
    detail: `Moved from the ${swap.label} to the ${args.currentLabel}. Dates and price unchanged.`,
    occurred_at: changedAt
  } as any);
}

async function createBookingOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in to create a booking.");
  }

  const organizationId = requiredString(formData, "organizationId");
  const vehicleId = requiredString(formData, "vehicleId");
  // customer is now optional — operator can skip and let the customer fill via booking link
  const customerId = optionalString(formData, "customerId");
  const startDate = requiredString(formData, "startDate");
  const openEnded = String(formData.get("openEnded") || "") === "true";
  const endDate = openEnded ? null : optionalString(formData, "endDate");
  const pricingModel = requiredString(formData, "pricingModel");
  const currency = String(formData.get("currency") || "THB").trim().toUpperCase();
  const rentalRate = numberFromForm(formData, "rentalRate");
  const depositAmount = numberFromForm(formData, "depositAmount");
  const deliveryMethod = requiredString(formData, "deliveryMethod");
  const deliveryLocation = optionalString(formData, "deliveryLocation");
  const deliveryPlaceId = optionalString(formData, "deliveryPlaceId");
  const deliveryLat = optionalString(formData, "deliveryLat");
  const deliveryLng = optionalString(formData, "deliveryLng");
  const collectionAddress = optionalString(formData, "collectionAddress");
  const deliveryDateTime = optionalString(formData, "deliveryDateTime");
  const collectionTime = optionalString(formData, "collectionTime");
  const includedItems = safeJsonArray(formData, "includedItems");
  const shareChannel = String(formData.get("shareChannel") || "copy");
  const baseUrl = String(formData.get("baseUrl") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const bookingMode = String(formData.get("bookingMode") || "booking_link");
  const walkInFastTrack = String(formData.get("walkInFastTrack") || "") === "true";
  const walkInPaymentAmount = numberFromForm(formData, "walkInPaymentAmount");
  const walkInDepositAmount = numberFromForm(formData, "walkInDepositAmount");
  const walkInPaymentMethod = String(formData.get("walkInPaymentMethod") || "cash").trim() || "cash";
  const walkInPaymentNote = optionalString(formData, "walkInPaymentNote");
  // A walk-in records money only when the operator opened "Payment already collected?" and confirmed it (real-user test, 8 Nov 2026).
  const walkInPaymentCollected = walkInFastTrack && String(formData.get("walkInPaymentCollected") || "") === "true";
  const upfrontPeriods = Math.max(0, numberFromForm(formData, "upfrontPeriods"));
  const upfrontRate = numberFromForm(formData, "upfrontRate");
  const upfrontTotal = numberFromForm(formData, "upfrontTotal");
  const createsActiveRental = bookingMode === "existing_rental" || walkInFastTrack;

  if (!["daily", "weekly", "monthly", "custom"].includes(pricingModel)) {
    throw new Error("Choose a valid billing period.");
  }
  // Any ISO 4217 code (every country can sign up since 8 Nov 2026), not only the ten first offered.
  if (!isIsoCurrency(currency)) {
    throw new Error("Choose a valid currency.");
  }
  if (!["delivery", "collection", "tbd"].includes(deliveryMethod)) {
    throw new Error("Choose a valid delivery method.");
  }
  if (!["booking_link", "existing_rental"].includes(bookingMode)) {
    throw new Error("Choose a valid booking mode.");
  }

  if (!openEnded && !endDate) {
    throw new Error("Choose an end date or mark the booking open-ended.");
  }
  // A return date before the start was saved as a rental "19 days late" with rent charged twice (real-user-test, 8 Nov 2026).
  if (endDate && endDate.slice(0, 10) < startDate.slice(0, 10)) {
    throw new Error("The return date must be after the start date.");
  }
  if (createsActiveRental && !customerId) {
    throw new Error(walkInFastTrack ? "Choose a customer before recording a walk-in rental." : "Choose a customer before recording an existing rental.");
  }
  if (walkInPaymentCollected && !(walkInPaymentAmount > 0) && !(walkInDepositAmount > 0)) {
    throw new Error("Enter the amount received.");
  }

  // Fetch vehicle and organisation; only fetch customer when one is provided
  const [vehicleResult, organizationResult] = await Promise.all([
    supabase
      .from("vehicles")
      .select("make, model, trim, year, registration_number, status, availability_status, daily_rate, weekly_rate, monthly_rate, current_customer_id, current_rental_id")
      .eq("id", vehicleId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("organizations").select("name, settings").eq("id", organizationId).maybeSingle()
  ]);

  const { data: vehicle, error: vehicleError } = vehicleResult;
  const { data: organization, error: organizationError } = organizationResult;

  if (vehicleError || !vehicle) {
    throw new Error(vehicleError?.message || "Vehicle was not found.");
  }
  if (organizationError || !organization) {
    throw new Error(organizationError?.message || "Organization was not found.");
  }
  if (["maintenance", "inactive", "retired"].includes(vehicle.status)) {
    throw new Error("This vehicle is marked as unavailable (in maintenance or inactive). Change its status on the vehicle page first.");
  }
  // A rental already under way that began on another vehicle (Rory, 9 Nov 2026): the earlier vehicle is only needed
  // from the start to the swap date, the current one from the swap date. Recorded like a vehicle change made in the app.
  const swap = bookingMode === "existing_rental" && !walkInFastTrack ? await earlierVehicleSwap(supabase, formData, { organizationId, vehicleId, startDate, endDate }) : null;
  // A car on rent now can still be booked for dates after it comes back.
  const conflict = await vehicleConflictMessage(supabase, { organizationId, vehicleId, startDate: swap ? swap.swapDate : startDate, endDate, customerId });
  if (conflict) {
    throw new Error(conflict);
  }
  if (swap) {
    const earlierConflict = await vehicleConflictMessage(supabase, { organizationId, vehicleId: swap.vehicleId, startDate, endDate: swap.swapDate, customerId });
    if (earlierConflict) throw new Error(`${swap.label}: ${earlierConflict}`);
    // The database keeps a rental's whole period on its current vehicle: an open booking on it before the swap date is in the way.
    const busy = await loadBusyPeriods(supabase, organizationId, [vehicleId]);
    const before = findConflict(busy[vehicleId] || [], startDate, swap.swapDate);
    if (before) throw new Error(`This vehicle still has an open booking before the swap date (${before.code || before.customerName || "another booking"}). Return or cancel it first.`);
  }

  // The agreement can't be signed without a number plate (final pre-release test, 8 Nov 2026): the form asks for it
  // on its last step and it is saved to the vehicle here. A rental already under way (not a walk-in) has no agreement to sign.
  if (!String(vehicle.registration_number || "").trim()) {
    const plate = String(formData.get("vehiclePlate") || "").trim().toUpperCase().slice(0, 20);
    if (plate) {
      const { error: plateError } = await supabase.from("vehicles").update({ registration_number: plate }).eq("id", vehicleId).eq("organization_id", organizationId);
      if (plateError) throw new Error(plateError.message);
      vehicle.registration_number = plate;
      revalidatePath(`/fleet/${vehicleId}`);
    } else if (bookingMode === "booking_link" || walkInFastTrack) {
      throw new Error("Add the vehicle's number plate first. The agreement can't be signed without it.");
    }
  }

  // A price typed for a car that had none is kept on the car, so the next booking starts from it.
  // Never overwrites a saved price; a failure here (a role that can't edit vehicles) doesn't stop the booking.
  if (String(formData.get("saveVehicleRate") || "") === "true" && rentalRate > 0 && ["daily", "weekly", "monthly"].includes(pricingModel)) {
    const column = `${pricingModel}_rate` as "daily_rate" | "weekly_rate" | "monthly_rate";
    if (!(Number((vehicle as any)[column] || 0) > 0)) {
      const { error: rateError } = await supabase.from("vehicles").update({ [column]: rentalRate }).eq("id", vehicleId).eq("organization_id", organizationId);
      if (rateError) console.warn("[createBooking] could not save vehicle price:", rateError.message);
      else revalidatePath(`/fleet/${vehicleId}`);
    }
  }

  // Optional customer lookup
  let customer: { full_name: string; phone: string | null; nationality: string | null; document_status: string | null; preferred_locale?: string | null } | null = null;
  if (customerId) {
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("full_name, phone, nationality, document_status, preferred_locale")
      .eq("id", customerId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (customerError || !customerData) {
      throw new Error(customerError?.message || "Customer was not found.");
    }
    customer = customerData;
  }

  const bookingData = {
    delivery_method: deliveryMethod,
    delivery_location: deliveryMethod === "delivery" ? deliveryLocation : deliveryMethod === "collection" ? collectionAddress : null,
    delivery_datetime: deliveryMethod === "delivery" ? deliveryDateTime : deliveryMethod === "collection" ? collectionTime : null,
    delivery_place_id: deliveryMethod === "delivery" ? deliveryPlaceId : null,
    delivery_lat: deliveryMethod === "delivery" && deliveryLat ? Number(deliveryLat) : null,
    delivery_lng: deliveryMethod === "delivery" && deliveryLng ? Number(deliveryLng) : null,
    special_conditions: optionalString(formData, "specialConditions"),
    customer_document_status: customer?.document_status ?? null,
    share_channel: shareChannel
  };

  // Paid extras: priced again here from Settings, so the price can't be changed in the browser.
  const extraIds = safeJsonArray(formData, "extraIds").map(String);
  // Prices typed before VAT (Settings › Country and units) are charged with it, the same as the booking form shows.
  const extrasVat = vatSettings(organization);
  const extrasPriced = priceExtras(
    extrasFrom(organization.settings)
      .filter((extra) => extraIds.includes(extra.id))
      .map((extra) => ({ ...extra, price: Math.round(withVat(extra.price, extrasVat) * 100) / 100 })),
    endDate ? Math.max(1, Math.round((new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86_400_000)) : null
  );

  const rentalInsert: Record<string, any> = {
    organization_id: organizationId,
    customer_id: customerId || null,
    extras: extrasPriced.lines,
    extras_total: extrasPriced.upfront,
    vehicle_id: vehicleId,
    start_date: startDate,
    end_date: endDate,
    is_indefinite: openEnded,
    status: createsActiveRental ? "active" : "booked",
    pricing_model: pricingModel,
    recurring_billing: pricingModel === "monthly",
    billing_interval: pricingModel,
    // With no end date, per-day extras are a monthly amount on top of the rent.
    rental_rate: rentalRate + extrasPriced.monthly,
    deposit_amount: depositAmount,
    balance_due: walkInPaymentCollected ? Math.max(0, rentalRate - (walkInPaymentAmount || 0)) : rentalRate + depositAmount,
    currency,
    delivery_method: deliveryMethod,
    delivery_location: bookingData.delivery_location,
    delivery_datetime: wallTimeToIso(bookingData.delivery_datetime),
    return_location: null,
    created_by: user.id
  };
  if (createsActiveRental) {
    rentalInsert.entered_by_operator = true;
  }
  if (swap) rentalInsert.original_vehicle_id = swap.vehicleId;

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .insert(rentalInsert)
    .select("id, display_code, reference")
    .single();

  if (rentalError || !rental) {
    throw new Error(isDoubleBookingError(rentalError) ? DOUBLE_BOOKING_MESSAGE : rentalError?.message || "Unable to create booking.");
  }

  if (upfrontPeriods > 0) {
    await supabase
      .from("rentals")
      .update({
        upfront_periods: upfrontPeriods,
        upfront_rate: upfrontRate || null,
        upfront_total: upfrontTotal || null,
        upfront_accepted: true
      })
      .eq("id", rental.id)
      .eq("organization_id", organizationId);
  }

  // Remember what this vehicle was rented with, so the next booking starts from it instead of a wall of tick boxes.
  // A convenience only, so it runs after the reply: the person isn't kept waiting for it.
  after(async () => {
    try {
      const { data: vehicleRow } = await supabase.from("vehicles").select("metadata, deposit_amount").eq("id", vehicleId).eq("organization_id", organizationId).maybeSingle();
      await supabase
        .from("vehicles")
        .update({
          metadata: { ...((vehicleRow?.metadata as Record<string, unknown> | null) || {}), included_items: includedItems },
          // A vehicle with no usual deposit takes the first one charged for it.
          ...(vehicleRow && vehicleRow.deposit_amount == null && depositAmount > 0 ? { deposit_amount: depositAmount } : {})
        })
        .eq("id", vehicleId)
        .eq("organization_id", organizationId);
    } catch {
      // The booking itself is already saved.
    }
  });

  const contractInsert: Record<string, any> = {
    organization_id: organizationId,
    rental_id: rental.id,
    customer_id: customerId || null,
    locale: "en",
    status: createsActiveRental ? "operator_confirmed" : "draft",
    metadata: {
      included_items: includedItems,
      special_conditions: bookingData.special_conditions
    }
  };
  if (createsActiveRental) {
    contractInsert.operator_confirmed = true;
  }

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .insert(contractInsert)
    .select("id")
    .single();

  if (contractError || !contract) {
    throw new Error(contractError?.message || "Unable to create booking contract.");
  }

  if (createsActiveRental) {
    const [{ error: rentalUpdateError }, { error: vehicleUpdateError }] = await Promise.all([
      supabase
        .from("rentals")
        .update({ contract_id: contract.id })
        .eq("id", rental.id)
        .eq("organization_id", organizationId),
      supabase
        .from("vehicles")
        .update({
          status: "rented",
          availability_status: "rented",
          current_customer_id: customerId,
          current_rental_id: rental.id
        })
        .eq("id", vehicleId)
        .eq("organization_id", organizationId)
    ]);

    const existingUpdateError = rentalUpdateError || vehicleUpdateError;
    if (existingUpdateError) {
      throw new Error(existingUpdateError.message);
    }

    if (walkInPaymentCollected) {
      try {
        await createWalkInPaymentRecords({
          supabase,
          rental,
          organizationId,
          vehicleId,
          customerId: customerId!,
          userId: user.id,
          currency,
          paymentAmount: walkInPaymentAmount,
          depositAmount: walkInDepositAmount,
          paymentMethod: walkInPaymentMethod,
          note: walkInPaymentNote
        });
      } catch (paymentError) {
        await Promise.allSettled([
          supabase.from("rental_payments").delete().eq("rental_id", rental.id).eq("organization_id", organizationId),
          supabase.from("transactions").delete().eq("rental_id", rental.id).eq("organization_id", organizationId),
          supabase.from("contracts").delete().eq("id", contract.id).eq("organization_id", organizationId),
          supabase.from("rentals").delete().eq("id", rental.id).eq("organization_id", organizationId),
          supabase
            .from("vehicles")
            .update({
              status: vehicle.status,
              availability_status: vehicle.availability_status,
              current_customer_id: vehicle.current_customer_id || null,
              current_rental_id: vehicle.current_rental_id || null
            })
            .eq("id", vehicleId)
            .eq("organization_id", organizationId)
        ]);
        throw paymentError;
      }
    }

    // Auto-generate payment schedule for operator-entered rentals
    await activateRental(rental.id, supabase).catch(() => null);

    if (!walkInPaymentCollected) {
      // What the owner said has been paid already: up to date, until a date, or nothing. A walk-in with no payment recorded has paid nothing yet.
      const paidMode = walkInFastTrack ? "none" : String(formData.get("existingPaid") || "up_to_date");
      const paidUntil = dateOnly(String(formData.get("existingPaidUntil") || ""));
      const tomorrow = new Date(`${todayDate()}T00:00:00Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      let paidBefore = paidMode === "none" ? null : paidMode === "until" && paidUntil ? paidUntil : tomorrow.toISOString().slice(0, 10);
      // Paid several periods upfront (Rory, 1 Nov 2026): those periods are paid too, even the ones still ahead.
      // Two months from 14 Oct covers the rent due 14 Oct and 14 Nov; at the upfront rate when one was agreed.
      let upfrontUntil: string | null = null;
      if (upfrontPeriods > 0 && paidMode !== "none" && startDate) {
        const covered = new Date(`${startDate}T00:00:00Z`);
        if (pricingModel === "monthly") covered.setUTCMonth(covered.getUTCMonth() + upfrontPeriods);
        else if (pricingModel === "weekly") covered.setUTCDate(covered.getUTCDate() + 7 * upfrontPeriods);
        else covered.setUTCDate(covered.getUTCDate() + upfrontPeriods);
        const coveredUntil = covered.toISOString().slice(0, 10);
        upfrontUntil = coveredUntil;
        if (!paidBefore || coveredUntil > paidBefore) paidBefore = coveredUntil;
        if (upfrontRate > 0 && upfrontRate !== rentalRate) {
          const { data: coveredRows } = await supabase
            .from("rental_payments")
            .select("id, metadata")
            .eq("organization_id", organizationId)
            .eq("rental_id", rental.id)
            .in("status", ["pending", "overdue", "scheduled"])
            .lt("due_date", coveredUntil)
            .is("deleted_at", null);
          const rentIds = ((coveredRows || []) as any[]).filter((row) => row.metadata?.type !== "deposit" && row.metadata?.is_deposit !== true).map((row) => row.id);
          if (rentIds.length) await supabase.from("rental_payments").update({ amount: upfrontRate }).in("id", rentIds);
        }
      }
      const depositHeld = !walkInFastTrack && String(formData.get("existingDepositHeld") || "") === "true" ? depositAmount : 0;
      await settleExistingRental(supabase, { rental: { ...rental, vehicle_id: vehicleId, customer_id: customerId, start_date: startDate }, organizationId, userId: user.id, paidBefore, depositHeld, currency, upfrontUntil }).catch(() => null);
    }

    if (swap) {
      await recordEarlierVehicle(supabase, { organizationId, rentalId: rental.id, customerId: customerId || null, userId: user.id, swap, currentVehicleId: vehicleId, currentLabel: [vehicle.make, vehicle.model].filter(Boolean).join(" "), rate: rentalRate + extrasPriced.monthly }).catch((swapError) =>
        console.warn("[createBooking] earlier vehicle not recorded:", swapError instanceof Error ? swapError.message : swapError)
      );
      revalidatePath(`/fleet/${swap.vehicleId}`);
      revalidatePath("/calendar");
    }

    await recordActivityEvent(supabase, {
      organization_id: organizationId,
      actor_id: user.id,
      entity_type: "rental",
      entity_id: rental.id,
      vehicle_id: vehicleId,
      rental_id: rental.id,
      customer_id: customerId || null,
      event_type: "rental_created",
      title: walkInFastTrack ? "Walk-in rental recorded" : "Existing rental recorded",
      detail: (customer
        ? `${bookingReference(rental)} was recorded as ${walkInFastTrack ? "a walk-in rental" : "an existing active rental"} for ${customer.full_name} and ${vehicle.registration_number}.`
        : `${bookingReference(rental)} was recorded as ${walkInFastTrack ? "a walk-in rental" : "an existing active rental"} for ${vehicle.registration_number}.`) + (swap ? ` It started on the ${swap.label}.` : "")
    });
    await markOnboardingStep(supabase, organizationId, "first_booking");

    revalidatePath("/");
    revalidatePath("/bookings");
    revalidatePath(`/bookings/${rental.id}`);
    revalidatePath(`/fleet/${vehicleId}`);

    return {
      mode: "existing_rental" as const,
      rentalId: rental.id as string,
      bookingUrl: "",
      message: walkInPaymentCollected ? `Walk-in rental recorded. Payment of ${walkInPaymentAmount} collected.` : walkInFastTrack ? "Walk-in rental recorded." : "Existing rental recorded.",
      whatsappUrl: "",
      lineUrl: "",
      smsUrl: "",
      emailUrl: ""
    };
  }

  // The booking points at its agreement whatever happens with the link, so that write runs alongside the link's.
  // (A Supabase query only runs once something awaits it: Promise.resolve starts it now.)
  const rentalContractPending: Promise<{ error: { message: string } | null }> = Promise.resolve(
    supabase.from("rentals").update({ contract_id: contract.id }).eq("id", rental.id).eq("organization_id", organizationId)
  );
  const holdUntil = holdDeadline(bookingRules(organization.settings).holdHours);
  const linkExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: bookingLink, error: linkError } = await supabase
    .from("booking_links")
    .insert({
      organization_id: organizationId,
      rental_id: rental.id,
      vehicle_id: vehicleId,
      customer_id: customerId || null,
      contract_id: contract.id,
      status: "pending",
      data_type: "rental_booking",
      delivery_method: deliveryMethod,
      booking_data: bookingData,
      included_items: includedItems,
      special_conditions: bookingData.special_conditions,
      share_channels: [shareChannel],
      // The vehicle is held for the customer for a limited time; the link itself lasts much longer.
      hold_until: holdUntil,
      expires_at: linkExpiresAt,
      created_by: user.id
    })
    .select("id, token")
    .single();

  if (linkError || !bookingLink) {
    throw new Error(linkError?.message || "Unable to generate booking link.");
  }

  const bookingUrl = `${baseUrl}/book/${bookingLink.token}`;

  const [{ error: linkUpdateError }, { error: contractUpdateError }, { error: rentalUpdateError }] = await Promise.all([
    supabase
      .from("booking_links")
      .update({ public_url: bookingUrl, contract_id: contract.id })
      .eq("id", bookingLink.id)
      .eq("organization_id", organizationId),
    supabase
      .from("contracts")
      .update({ booking_link_id: bookingLink.id })
      .eq("id", contract.id)
      .eq("organization_id", organizationId),
    rentalContractPending
  ]);

  const updateError = linkUpdateError || contractUpdateError || rentalUpdateError;
  if (updateError) {
    throw new Error(updateError.message);
  }

  // A car that is out on rent stays "on rent"; a free car shows as booked.
  await syncVehicleStatusFromBookings(supabase, organizationId, vehicleId);

  const vehicleLabel = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  // In the customer's language, with the time the vehicle is held until (lib/booking-link-message.ts).
  const message = await bookingLinkMessage({
    customerName: customer?.full_name,
    vehicle: vehicleLabel,
    url: bookingUrl,
    business: organization.name,
    locale: customer?.preferred_locale,
    holdUntil,
    expiresAt: linkExpiresAt
  });
  const urls = shareUrls({ message, phone: customer?.phone, organizationName: organization.name });

  // The history line and the setup checklist are written just after the reply, so "Booking created" shows at once.
  after(async () => {
    await Promise.allSettled([
      recordActivityEvent(supabase, {
        organization_id: organizationId,
        actor_id: user.id,
        entity_type: "rental",
        entity_id: rental.id,
        vehicle_id: vehicleId,
        rental_id: rental.id,
        customer_id: customerId || null,
        event_type: "booking_created",
        title: "Booking created",
        detail: customer
          ? `${bookingReference(rental)} for ${customer.full_name} and ${vehicle.registration_number}.`
          : `${bookingReference(rental)} for ${vehicle.registration_number}. Awaiting customer details via booking link.`
      }),
      markOnboardingStep(supabase, organizationId, "first_booking")
    ]);
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath(`/fleet/${vehicleId}`);

  const vLabel = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const customerLabel = customer ? customer.full_name : "Unknown customer";
  notifyOperator(
    organizationId,
    customer
      ? { emoji: "📋", key: "bookingCreated", values: { customer: customerLabel, vehicle: vLabel || null } }
      : { emoji: "📋", key: "bookingCreatedNoCustomer", values: { vehicle: vLabel || null } },
    "operator_notification"
  ).catch(() => null);

  return {
    rentalId: rental.id as string,
    bookingUrl,
    message,
    ...urls
  };
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function assignCustomerToBooking(...args: Parameters<typeof assignCustomerToBookingOrThrow>) {
  return guard(() => assignCustomerToBookingOrThrow(...args));
}

async function assignCustomerToBookingOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const organizationId = requiredString(formData, "organizationId");
  const rentalId = requiredString(formData, "rentalId");
  const customerId = requiredString(formData, "customerId");

  const [{ data: rental, error: rentalError }, { data: customer, error: customerError }] = await Promise.all([
    supabase
      .from("rentals")
      .select("id, vehicle_id, contract_id, display_code, reference, status")
      .eq("id", rentalId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("full_name")
      .eq("id", customerId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle()
  ]);

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Booking not found.");
  }
  if (customerError || !customer) {
    throw new Error(customerError?.message || "Customer not found.");
  }

  const updates: Promise<any>[] = [
    supabase.from("rentals").update({ customer_id: customerId }).eq("id", rentalId).eq("organization_id", organizationId),
    supabase.from("booking_links").update({ customer_id: customerId }).eq("rental_id", rentalId).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("vehicles").update({ current_customer_id: customerId }).eq("id", rental.vehicle_id).eq("organization_id", organizationId).eq("current_rental_id", rentalId)
  ];

  if (rental.contract_id) {
    updates.push(
      supabase.from("contracts").update({ customer_id: customerId }).eq("id", rental.contract_id).eq("organization_id", organizationId)
    );
  }

  const results = await Promise.all(updates);
  const updateError = results.find((r: any) => r.error)?.error;
  if (updateError) {
    throw new Error(updateError.message);
  }
  if (rental.status === "active") {
    await activateRental(rentalId, supabase).catch(() => null);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: rental.vehicle_id,
    rental_id: rentalId,
    customer_id: customerId,
    event_type: "customer_assigned",
    title: "Customer assigned",
    detail: `${customer.full_name} was manually assigned to booking ${bookingReference(rental)}.`
  });

  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath("/bookings");
}

async function hasSignedAgreement(supabase: any, organizationId: string, rentalId: string) {
  const { data } = await supabase
    .from("rental_documents")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("rental_id", rentalId)
    .eq("document_type", "rental_agreement")
    .eq("status", "signed")
    .limit(1);
  return Boolean(data?.length);
}

async function createBookingLinkForRental(supabase: any, organizationId: string, rental: any, userId: string) {
  if (["cancelled", "completed"].includes(String(rental.status))) {
    throw new Error("This booking has ended, so a customer link can't be created.");
  }

  let contractId = rental.contract_id as string | null;
  if (!contractId) {
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .insert({
        organization_id: organizationId,
        rental_id: rental.id,
        customer_id: rental.customer_id || null,
        locale: "en",
        status: "draft",
        metadata: {}
      })
      .select("id")
      .single();
    if (contractError || !contract) throw new Error(contractError?.message || "Unable to prepare the booking agreement.");
    contractId = contract.id as string;
    await supabase.from("rentals").update({ contract_id: contractId }).eq("id", rental.id).eq("organization_id", organizationId);
  }

  const { data: link, error } = await supabase
    .from("booking_links")
    .insert({
      organization_id: organizationId,
      rental_id: rental.id,
      vehicle_id: rental.vehicle_id,
      customer_id: rental.customer_id || null,
      contract_id: contractId,
      status: "pending",
      data_type: "rental_booking",
      delivery_method: rental.delivery_method || null,
      booking_data: {
        delivery_location: rental.delivery_location || null,
        delivery_datetime: rental.delivery_datetime || null
      },
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: userId
    })
    .select("id, token, public_url")
    .single();
  if (error || !link) throw new Error(error?.message || "Unable to create the booking link.");

  await supabase.from("contracts").update({ booking_link_id: link.id }).eq("id", contractId).eq("organization_id", organizationId);
  return link;
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function resendBookingLink(...args: Parameters<typeof resendBookingLinkOrThrow>) {
  return guard(() => resendBookingLinkOrThrow(...args));
}

async function resendBookingLinkOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const organizationId = requiredString(formData, "organizationId");
  const rentalId = requiredString(formData, "rentalId");
  const baseUrl = String(formData.get("baseUrl") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  // The link's deadline in the message is written on this business's clock.
  enterBusinessTimeZone(await ensureMembership(supabase, organizationId, user.id));

  const [{ data: rental, error: rentalError }, { data: organization, error: organizationError }] = await Promise.all([
    supabase
      .from("rentals")
      .select("*, vehicles!rentals_vehicle_id_fkey(make, model, registration_number), customers!rentals_customer_id_fkey(full_name, phone, preferred_locale)")
      .eq("id", rentalId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle()
  ]);

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Booking was not found.");
  }
  if (organizationError || !organization) {
    throw new Error(organizationError?.message || "Organization was not found.");
  }

  const { data: existingLink, error: linkError } = await supabase
    .from("booking_links")
    .select("id, token, public_url, hold_until, hold_released_at, contract_signed_at, expires_at")
    .eq("organization_id", organizationId)
    .eq("rental_id", rentalId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkError) {
    throw new Error(linkError.message);
  }
  // A booking entered by the team has no link yet: create one so the
  // customer can add their details and sign the agreement online.
  const bookingLink = existingLink || (await createBookingLinkForRental(supabase, organizationId, rental, user.id));

  const bookingUrl = bookingLink.public_url || `${baseUrl}/book/${bookingLink.token}`;
  // Copying the link isn't sending it: only a real send marks it sent (real-user test, 8 Nov 2026).
  const copyOnly = String(formData.get("channel") || "") === "copy";
  // At least a week from now, and never shorter than the link already had (a new booking's link lasts 60 days).
  const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const currentExpiry = (bookingLink as { expires_at?: string | null }).expires_at || null;
  const linkExpiresAt = currentExpiry && currentExpiry > weekAhead ? currentExpiry : weekAhead;
  const { error: updateError } = await supabase
    .from("booking_links")
    .update({
      public_url: bookingUrl,
      ...(copyOnly ? {} : { status: "sent", sent_at: new Date().toISOString() }),
      expires_at: linkExpiresAt
    })
    .eq("id", bookingLink.id)
    .eq("organization_id", organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const vehicleLabel = [rental.vehicles?.make, rental.vehicles?.model].filter(Boolean).join(" ");
  // The vehicle's hold while it runs (unsigned, not released), otherwise how long the link works.
  const held = bookingLink as { hold_until?: string | null; hold_released_at?: string | null; contract_signed_at?: string | null };
  const message = await bookingLinkMessage({
    customerName: rental.customers?.full_name,
    vehicle: vehicleLabel,
    url: bookingUrl,
    business: organization.name,
    locale: rental.customers?.preferred_locale,
    holdUntil: held.hold_until && !held.hold_released_at && !held.contract_signed_at ? held.hold_until : null,
    expiresAt: held.contract_signed_at ? null : linkExpiresAt
  });
  const urls = shareUrls({ message, phone: rental.customers?.phone, organizationName: organization.name });

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: rental.vehicle_id,
    rental_id: rentalId,
    customer_id: rental.customer_id,
    event_type: existingLink ? "booking_link_resent" : "booking_link_created",
    title: existingLink ? "Booking link resent" : "Booking link created",
    detail: existingLink
      ? `Booking link resent for ${bookingReference(rental)}.`
      : `Booking link created for ${bookingReference(rental)} so the customer can add their details and sign.`
  });

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);

  return {
    created: !existingLink,
    bookingUrl,
    message,
    ...urls
  };
}

export type DeleteBookingResult = {
  success: boolean;
  error?: string;
  /** Asked before deleting a booking that has real records: what would go (shown in the second "are you sure"). */
  needsConfirm?: { signed: boolean; payments: number; inspections: number };
};

/**
 * Delete a booking and everything on it (owner only; Rory, 31 Oct 2026: delete removes everything, archive keeps).
 * Payments, inspections or a signed agreement on record: the first call returns needsConfirm, and the owner confirms.
 */
export async function deleteBooking(rentalId: string, confirmed = false): Promise<DeleteBookingResult> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: await said("You must be signed in.") };

  const cleanId = String(rentalId || "").trim();
  if (!cleanId) return { success: false, error: await said("Booking ID is required.") };

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, vehicle_id, customer_id, organization_id, status")
    .eq("id", cleanId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) return { success: false, error: rentalError?.message || "Booking not found." };

  enterBusinessTimeZone(await ensureMembership(supabase, rental.organization_id, user.id));

  const membership = await getCurrentMembership();
  if (!membership || membership.organizationId !== rental.organization_id || membership.role !== "owner") {
    return { success: false, error: await said("Only the business owner can delete a booking.") };
  }
  const org = rental.organization_id;
  const [documentsCheck, transactionsCheck, inspectionsCheck, acknowledgementsCheck] = await Promise.all([
    supabase.from("rental_documents").select("id, status").eq("rental_id", cleanId).eq("organization_id", org),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("rental_id", cleanId).eq("organization_id", org),
    supabase.from("inspections").select("id").eq("rental_id", cleanId).eq("organization_id", org),
    supabase.from("rental_document_acknowledgements").select("id", { count: "exact", head: true }).eq("rental_id", cleanId)
  ]);
  const checkError = documentsCheck.error || transactionsCheck.error || inspectionsCheck.error;
  if (checkError) return { success: false, error: checkError.message };
  const documents = (documentsCheck.data || []) as Array<{ id: string; status: string | null }>;
  const inspectionIds = ((inspectionsCheck.data || []) as Array<{ id: string }>).map((row) => row.id);
  const payments = transactionsCheck.count || 0;
  const signed = (acknowledgementsCheck.count || 0) > 0 || documents.some((doc) => doc.status && doc.status !== "draft");
  if (!confirmed && (signed || payments > 0 || inspectionIds.length > 0)) {
    return { success: false, needsConfirm: { signed, payments, inspections: inspectionIds.length } };
  }

  // The owner is checked above. Everything on the booking goes (Rory, 31 Oct 2026): payments, money entries,
  // handover and return checks with their photos, links, reminders, To do items and the agreement, signed or not.
  // Archive is how an owner keeps records. The database does it in one transaction (purge_rental), which is the
  // only path allowed to remove signed agreement records; then the files it lists are removed from storage.
  const db = createSupabaseAdminClient() as any;
  const { data: vehicleBefore } = await db.from("vehicles").select("current_rental_id").eq("id", rental.vehicle_id).maybeSingle();
  const wasOnThisBooking = vehicleBefore?.current_rental_id === cleanId;
  const { data: files, error: purgeError } = await db.rpc("purge_rental", { p_rental: cleanId });
  if (purgeError) return { success: false, error: purgeError.message };
  await removeStoredFiles(db, files);

  // Free up the vehicle if it was out on this booking
  if (wasOnThisBooking) {
    await supabase
      .from("vehicles")
      .update({ status: "available", availability_status: "available_now", current_customer_id: null, current_rental_id: null })
      .eq("id", rental.vehicle_id)
      .eq("organization_id", rental.organization_id);
  }
  await syncVehicleStatusFromBookings(supabase, rental.organization_id, rental.vehicle_id);

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath("/fleet");
  if (rental.vehicle_id) revalidatePath(`/fleet/${rental.vehicle_id}`);

  return { success: true };
}

export async function manuallyActivateRental(rentalId: string, earlyStart?: string, lateStart?: string, customerName?: string): Promise<{ success: boolean; error?: string }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: await said("You must be signed in.") };

  const cleanId = String(rentalId || "").trim();
  if (!cleanId) return { success: false, error: await said("Rental ID is required.") };

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, start_date, end_date, rental_rate, pricing_model, billing_interval, currency, display_code, reference")
    .eq("id", cleanId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) return { success: false, error: rentalError?.message || "Rental not found." };

  enterBusinessTimeZone(await ensureMembership(supabase, rental.organization_id, user.id));

  // Going out before the customer filled in their link: the name typed here becomes the customer, so the rent
  // schedule can be written and anything unpaid shows as owed. (The link later fills in this same record.)
  if (!rental.customer_id) {
    const name = String(customerName || "").trim();
    if (!name) return { success: false, error: await said("Add the customer's name to hand over.") };
    const { data: created, error: customerError } = await supabase.from("customers").insert({ organization_id: rental.organization_id, full_name: name }).select("id").single();
    if (customerError || !created?.id) return { success: false, error: customerError?.message || "The customer could not be added." };
    const [{ error: linkError }] = await Promise.all([
      supabase.from("rentals").update({ customer_id: created.id }).eq("id", cleanId).eq("organization_id", rental.organization_id),
      supabase.from("booking_links").update({ customer_id: created.id }).eq("rental_id", cleanId).is("customer_id", null),
      supabase.from("contracts").update({ customer_id: created.id }).eq("rental_id", cleanId).is("customer_id", null)
    ]);
    if (linkError) {
      // Not linked: take the new record away again so a second try doesn't leave a customer with no rentals.
      await supabase.from("customers").update({ deleted_at: new Date().toISOString() }).eq("id", created.id).eq("organization_id", rental.organization_id);
      return { success: false, error: isDoubleBookingError(linkError) ? await said(DOUBLE_BOOKING_MESSAGE) : linkError.message };
    }
    rental.customer_id = created.id;
  }

  // Handed over before the booked start date: the rental starts today, and the extra days are charged, the
  // booking keeps its length, or they're free, as the owner chose (as with the form).
  const handoverDate = todayDate();
  let scheduleFrom: string | null = null;
  if (rental.start_date && handoverDate < String(rental.start_date).slice(0, 10)) {
    const inWay = await earlyHandoverBlocker(supabase, { organizationId: rental.organization_id, vehicleId: String(rental.vehicle_id || ""), rentalId: cleanId, startDate: rental.start_date, endDate: rental.end_date || null, today: handoverDate });
    if (inWay) return { success: false, error: await said("This vehicle is still out on another rental. Return it first or pick another vehicle.") };
    const { data: rates } = await supabase.from("vehicles").select("daily_rate, weekly_rate, monthly_rate").eq("id", rental.vehicle_id).eq("organization_id", rental.organization_id).maybeSingle();
    const early = earlyStartFor(rental, rates, handoverDate);
    const choice = settleEarlyChoice(earlyStart, early, canDecideMoney((await getCurrentMembership())?.role));
    const shortenTo = early && choice === "shorten" ? early.shortenedEnd : null;
    if (early && choice !== "shorten") scheduleFrom = early.bookedStart;
    const { error: moveError } = await supabase.from("rentals").update({ start_date: handoverDate, ...(shortenTo ? { end_date: shortenTo } : {}) }).eq("id", cleanId).eq("organization_id", rental.organization_id);
    if (moveError) return { success: false, error: isDoubleBookingError(moveError) ? await said(DOUBLE_BOOKING_MESSAGE) : moveError.message };
    if (early) {
      await supabase
        .from("rental_payments")
        .update({ due_date: handoverDate, scheduled_date: handoverDate })
        .eq("organization_id", rental.organization_id)
        .eq("rental_id", cleanId)
        .eq("due_date", early.bookedStart)
        .in("status", ["scheduled", "pending", "failed", "overdue"])
        .is("deleted_at", null);
      if (choice === "charge" || choice === "ask") {
        const paymentId = await ensureEarlyStartCharge(supabase, { organizationId: rental.organization_id, rentalId: cleanId, vehicleId: rental.vehicle_id, customerId: rental.customer_id, currency: rental.currency || "THB", today: handoverDate, early });
        if (choice === "ask") {
          const { data: who } = rental.customer_id ? await supabase.from("customers").select("full_name").eq("id", rental.customer_id).maybeSingle() : { data: null };
          await requestEarlyWaiver(createSupabaseAdminClient(), { organizationId: rental.organization_id, rentalId: cleanId, vehicleId: rental.vehicle_id, paymentId, early, customerName: who?.full_name || "the customer", userId: user.id }).catch(() => null);
        }
      }
    }
  }

  // Handed over after the booked start date: rent starts today (the return date stays, or an open-ended
  // schedule moves with it), or the booking keeps its dates, as the owner chose. Before activation, so it
  // still sees a booking.
  const lateResult = await applyLateStart(supabase, { organizationId: rental.organization_id, rentalId: cleanId, today: handoverDate, choice: lateStart }).catch((error) => {
    console.error("late start failed", error);
    return null;
  });
  if (lateResult) {
    await recordActivityEvent(supabase, {
      organization_id: rental.organization_id,
      actor_id: user.id,
      entity_type: "rental",
      entity_id: cleanId,
      vehicle_id: rental.vehicle_id,
      rental_id: cleanId,
      customer_id: rental.customer_id,
      event_type: "late_start",
      title: "Handed over late",
      detail: lateStartNote(lateResult)
    }).catch(() => null);
  }

  // Also set the vehicle to rented if not already
  if (rental.vehicle_id) {
    await supabase
      .from("vehicles")
      .update({ status: "rented", availability_status: "rented", current_rental_id: cleanId, current_customer_id: rental.customer_id })
      .eq("id", rental.vehicle_id)
      .eq("organization_id", rental.organization_id);
  }

  await activateRental(cleanId, supabase, { scheduleFrom });

  await recordActivityEvent(supabase, {
    organization_id: rental.organization_id,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: cleanId,
    vehicle_id: rental.vehicle_id,
    rental_id: cleanId,
    customer_id: rental.customer_id,
    event_type: "handed_over_without_form",
    title: "Handed over without the form",
    detail: `${bookingReference(rental)} went out without a handover form.`
  }).catch(() => null);

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${cleanId}`);
  if (rental.vehicle_id) revalidatePath(`/fleet/${rental.vehicle_id}`);

  return { success: true };
}

function allStrings(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value || "").trim()).filter(Boolean);
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function formatChange(value: unknown) {
  if (value === null || value === undefined || value === "") return "blank";
  if (Array.isArray(value)) return value.join(", ") || "none";
  return String(value);
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function updateBooking(...args: Parameters<typeof updateBookingOrThrow>) {
  return guard(() => updateBookingOrThrow(...args));
}

async function updateBookingOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const rentalId = requiredString(formData, "rentalId");
  const customerId = optionalString(formData, "customerId");
  const startDate = requiredString(formData, "startDate");
  const openEnded = String(formData.get("openEnded") || "") === "on";
  const endDate = openEnded ? null : optionalString(formData, "endDate");
  const pricingModel = requiredString(formData, "pricingModel");
  const currency = String(formData.get("currency") || "THB").trim().toUpperCase();
  const rentalRate = numberFromForm(formData, "rentalRate");
  const depositAmount = numberFromForm(formData, "depositAmount");
  const depositHeld = numberFromForm(formData, "depositHeld");
  const deliveryMethod = requiredString(formData, "deliveryMethod");
  const deliveryLocation = optionalString(formData, "deliveryLocation");
  // Business wall time from the form -> real instant (see lib/business-time.ts).
  const deliveryDateTime = wallTimeToIso(formData.get("deliveryDateTime"));
  const deliveryPlaceId = optionalString(formData, "deliveryPlaceId");
  const deliveryLat = optionalString(formData, "deliveryLat");
  const deliveryLng = optionalString(formData, "deliveryLng");
  const includedItems = allStrings(formData, "includedItems");
  const specialConditions = optionalString(formData, "specialConditions");

  if (!["daily", "weekly", "monthly", "custom"].includes(pricingModel)) {
    throw new Error("Choose a valid billing period.");
  }
  if (!["delivery", "collection", "tbd"].includes(deliveryMethod)) {
    throw new Error("Choose a valid delivery method.");
  }
  if (!openEnded && !endDate) {
    throw new Error("Choose an end date or mark the booking open-ended.");
  }
  if (endDate && endDate.slice(0, 10) < startDate.slice(0, 10)) {
    throw new Error("The return date must be after the start date.");
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Booking was not found.");
  }

  enterBusinessTimeZone(await ensureMembership(supabase, rental.organization_id, user.id));

  if (rental.vehicle_id && !["cancelled", "completed", "draft"].includes(String(rental.status))) {
    const conflict = await vehicleConflictMessage(supabase, {
      organizationId: rental.organization_id,
      vehicleId: rental.vehicle_id,
      startDate,
      endDate,
      excludeRentalId: rental.id
    });
    if (conflict) {
      return { error: await said(conflict) };
    }
  }

  if (customerId) {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, full_name")
      .eq("id", customerId)
      .eq("organization_id", rental.organization_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (customerError || !customer) {
      throw new Error(customerError?.message || "Customer was not found.");
    }
  }

  const { data: bookingLinks, error: linkReadError } = await supabase
    .from("booking_links")
    .select("id, booking_data, included_items, special_conditions")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rental.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (linkReadError) {
    throw new Error(linkReadError.message);
  }

  const bookingLink = bookingLinks?.[0] || null;
  const oldBookingData = (bookingLink?.booking_data || {}) as Record<string, unknown>;
  const previousIncludedItems = Array.isArray(bookingLink?.included_items) ? bookingLink.included_items : [];
  const previousSpecialConditions = bookingLink?.special_conditions || oldBookingData.special_conditions || null;

  const rentalUpdates = {
    customer_id: customerId || null,
    start_date: startDate,
    end_date: endDate,
    is_indefinite: openEnded,
    pricing_model: pricingModel,
    billing_interval: pricingModel,
    recurring_billing: pricingModel === "monthly",
    rental_rate: rentalRate,
    deposit_amount: depositAmount,
    deposit_held: depositHeld,
    currency,
    delivery_method: deliveryMethod,
    delivery_location: deliveryMethod === "tbd" ? null : deliveryLocation,
    delivery_datetime: deliveryMethod === "tbd" ? null : deliveryDateTime
  };

  const changes: Array<{ label: string; oldValue: unknown; newValue: unknown }> = [];
  const compare = (label: string, oldValue: unknown, newValue: unknown) => {
    if (!sameJson(oldValue, newValue)) {
      changes.push({ label, oldValue, newValue });
    }
  };

  compare("Customer", rental.customer_id || null, customerId || null);
  compare("Start date", dateOnly(rental.start_date), startDate);
  compare("End date", dateOnly(rental.end_date), endDate);
  compare("Open-ended", Boolean(rental.is_indefinite), openEnded);
  compare("Billing period", rental.pricing_model, pricingModel);
  compare("Rental rate", Number(rental.rental_rate || 0), rentalRate);
  compare("Deposit amount", Number(rental.deposit_amount || 0), depositAmount);
  compare("Deposit held", Number(rental.deposit_held || 0), depositHeld);
  compare("Currency", rental.currency || "THB", currency);
  compare("Delivery method", rental.delivery_method || oldBookingData.delivery_method || "delivery", deliveryMethod);
  compare("Delivery location", rental.delivery_location || oldBookingData.delivery_location || null, rentalUpdates.delivery_location);
  compare("Delivery date/time", rental.delivery_datetime || oldBookingData.delivery_datetime || null, rentalUpdates.delivery_datetime);
  compare("Included items", previousIncludedItems, includedItems);
  compare("Special conditions", previousSpecialConditions, specialConditions);

  // Once the customer has signed, these are terms of the agreement. Changing
  // them here would leave the signed agreement saying something else.
  const signedTerms = ["Customer", "Start date", "End date", "Open-ended", "Billing period", "Rental rate", "Deposit amount", "Currency", "Included items", "Special conditions"];
  const changedTerms = changes.filter((change) => signedTerms.includes(change.label)).map((change) => change.label.toLowerCase());
  if (changedTerms.length && (await hasSignedAgreement(supabase, rental.organization_id, rental.id))) {
    // Returned, not thrown: production hides thrown server-action messages.
    return {
      error: await said(`The customer has signed the agreement, so these can't be changed here: ${changedTerms.join(", ")}. To extend the rental or change the rate or deposit, use "Extend / change terms" on the booking: the customer signs a short amendment.`)
    };
  }

  const { error: updateError } = await supabase
    .from("rentals")
    .update(rentalUpdates)
    .eq("id", rental.id)
    .eq("organization_id", rental.organization_id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const bookingData = {
    ...oldBookingData,
    delivery_method: deliveryMethod,
    delivery_location: deliveryMethod === "tbd" ? null : deliveryLocation,
    delivery_datetime: deliveryMethod === "tbd" ? null : deliveryDateTime,
    delivery_place_id: deliveryMethod === "tbd" ? null : deliveryPlaceId,
    delivery_lat: deliveryMethod === "tbd" || !deliveryLat ? null : Number(deliveryLat),
    delivery_lng: deliveryMethod === "tbd" || !deliveryLng ? null : Number(deliveryLng),
    special_conditions: specialConditions
  };

  const updateTasks: Promise<any>[] = [
    supabase
      .from("booking_links")
      .update({
        customer_id: customerId || null,
        delivery_method: deliveryMethod,
        booking_data: bookingData,
        included_items: includedItems,
        special_conditions: specialConditions
      })
      .eq("organization_id", rental.organization_id)
      .eq("rental_id", rental.id),
    supabase
      .from("vehicles")
      .update({ current_customer_id: customerId || null })
      .eq("id", rental.vehicle_id)
      .eq("organization_id", rental.organization_id)
      .eq("current_rental_id", rental.id)
  ];

  if (rental.contract_id) {
    updateTasks.push(
      supabase
        .from("contracts")
        .update({ customer_id: customerId || null, metadata: { included_items: includedItems, special_conditions: specialConditions } })
        .eq("id", rental.contract_id)
        .eq("organization_id", rental.organization_id)
    );
  }

  const updateResults = await Promise.all(updateTasks);
  const linkedUpdateError = updateResults.find((result: any) => result.error)?.error;
  if (linkedUpdateError) {
    throw new Error(linkedUpdateError.message);
  }

  const actor = operatorName(user);
  await Promise.all(
    changes.map((change) =>
      recordActivityEvent(supabase, {
        organization_id: rental.organization_id,
        actor_id: user.id,
        entity_type: "rental",
        entity_id: rental.id,
        vehicle_id: rental.vehicle_id,
        rental_id: rental.id,
        customer_id: customerId || rental.customer_id || null,
        event_type: "booking_edited",
        title: `${change.label} updated`,
        detail: `${change.label} changed from ${formatChange(change.oldValue)} to ${formatChange(change.newValue)} by ${actor}.`,
        metadata: {
          field: change.label,
          old_value: change.oldValue,
          new_value: change.newValue
        }
      })
    )
  );

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath(`/bookings/${rental.id}/edit`);
  revalidatePath(`/fleet/${rental.vehicle_id}`);
  revalidatePath("/calendar");

  // The edit form navigates back to the booking itself.
  return { error: null as string | null, rentalId: rental.id as string };
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function addRentalPayment(...args: Parameters<typeof addRentalPaymentOrThrow>) {
  return guard(() => addRentalPaymentOrThrow(...args));
}

async function addRentalPaymentOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const rentalId = requiredString(formData, "rentalId");
  const amount = numberFromForm(formData, "amount");
  const dueDate = requiredString(formData, "dueDate");
  const description = optionalString(formData, "description") || "Scheduled payment";
  const status = String(formData.get("status") || "pending");

  if (amount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, currency")
    .eq("id", rentalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Booking was not found.");
  }
  if (!rental.customer_id) {
    throw new Error("Assign a customer before adding payment rows.");
  }

  enterBusinessTimeZone(await ensureMembership(supabase, rental.organization_id, user.id));

  const { data: existingPendingPayments, error: existingPaymentsError } = await supabase
    .from("rental_payments")
    .select("id, amount, status")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rentalId)
    .in("status", ["pending", "scheduled", "overdue"])
    .is("deleted_at", null);

  if (existingPaymentsError) {
    throw new Error(existingPaymentsError.message);
  }

  const duplicate = (existingPendingPayments || []).find(
    (payment: any) => Math.round(Number(payment.amount || 0)) === Math.round(amount)
  );

  if (duplicate) {
    throw new Error(
      `A pending charge of ${Math.round(amount).toLocaleString()} already exists for this rental. ` +
      "Record it as received instead of adding a duplicate."
    );
  }

  const { data: payment, error: insertError } = await supabase
    .from("rental_payments")
    .insert({
      organization_id: rental.organization_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      vehicle_id: rental.vehicle_id,
      due_date: dueDate,
      scheduled_date: dueDate,
      amount,
      currency: rental.currency || "THB",
      status,
      metadata: { description }
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    throw new Error(insertError?.message || "Unable to add payment row.");
  }

  const detail = `Payment row added: ${niceMoney(amount, rental.currency)} due ${niceDate(dueDate)} (${description}).`;
  await recordActivityEvent(supabase, {
    organization_id: rental.organization_id,
    actor_id: user.id,
    entity_type: "payment",
    entity_id: payment.id,
    vehicle_id: rental.vehicle_id,
    rental_id: rental.id,
    customer_id: rental.customer_id,
    event_type: "booking_edited",
    title: "Payment row added",
    detail,
    metadata: { content: detail }
  });

  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath(`/bookings/${rental.id}/edit`);
  revalidatePath("/bookings");
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function setupExistingRentalPayments(...args: Parameters<typeof setupExistingRentalPaymentsOrThrow>) {
  return guard(() => setupExistingRentalPaymentsOrThrow(...args));
}

async function setupExistingRentalPaymentsOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const rentalId = requiredString(formData, "rentalId");
  const firstPaymentMode = String(formData.get("firstPaymentMode") || "outstanding");
  const depositMode = String(formData.get("depositMode") || "none");
  const firstAmount = numberFromForm(formData, "firstPaymentAmount");
  const firstDate = dateOnly(String(formData.get("firstPaymentDate") || "")) || todayDate();
  const firstMethod = String(formData.get("firstPaymentMethod") || "cash").trim() || "cash";
  const depositAmount = numberFromForm(formData, "depositAmount");
  const depositDate = dateOnly(String(formData.get("depositDate") || "")) || todayDate();
  const depositMethod = String(formData.get("depositMethod") || "cash").trim() || "cash";

  if (!["collected", "outstanding"].includes(firstPaymentMode)) {
    throw new Error("Choose how the first payment should be set up.");
  }
  if (!["collected", "pending", "none"].includes(depositMode)) {
    throw new Error("Choose a valid deposit setup option.");
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, start_date, rental_rate, deposit_amount, currency, entered_by_operator")
    .eq("id", rentalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Booking was not found.");
  }
  if (!rental.customer_id) {
    throw new Error("Assign a customer before setting up payment records.");
  }

  enterBusinessTimeZone(await ensureMembership(supabase, rental.organization_id, user.id));

  const { data: existingPayments, error: existingError } = await supabase
    .from("rental_payments")
    .select("id")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rental.id)
    .is("deleted_at", null)
    .limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }
  if ((existingPayments || []).length > 0) {
    throw new Error("This booking already has payment records.");
  }

  const currency = rental.currency || "THB";
  const setupDate = dateOnly(rental.start_date) || todayDate();
  const rentAmount = firstAmount > 0 ? firstAmount : Number(rental.rental_rate || 0);
  const depositSetupAmount = depositAmount > 0 ? depositAmount : Number(rental.deposit_amount || 0);
  const insertedPaymentIds: string[] = [];

  if (rentAmount > 0) {
    const rentDescription =
      firstPaymentMode === "collected"
        ? "First rental payment - already collected"
        : "First rental payment - outstanding";
    const { data: rentPayment, error: rentError } = await supabase
      .from("rental_payments")
      .insert({
        organization_id: rental.organization_id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        vehicle_id: rental.vehicle_id,
        due_date: firstPaymentMode === "collected" ? firstDate : setupDate,
        scheduled_date: firstPaymentMode === "collected" ? firstDate : setupDate,
        paid_at: firstPaymentMode === "collected" ? `${firstDate}T00:00:00.000Z` : null,
        payment_method: firstPaymentMode === "collected" ? firstMethod : null,
        status: firstPaymentMode === "collected" ? "paid" : "pending",
        amount: rentAmount,
        currency,
        metadata: {
          type: "rent",
          description: rentDescription,
          setup_source: "operator_existing_rental"
        }
      })
      .select("id")
      .single();

    if (rentError || !rentPayment) {
      throw new Error(rentError?.message || "Unable to create the first payment record.");
    }
    insertedPaymentIds.push(rentPayment.id);

    if (firstPaymentMode === "collected") {
      const { error: transactionError } = await supabase.from("transactions").insert({
        organization_id: rental.organization_id,
        vehicle_id: rental.vehicle_id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        rental_payment_id: rentPayment.id,
        type: "rental_income",
        amount: rentAmount,
        currency,
        transaction_date: firstDate,
        notes: `${rentDescription} - received via ${firstMethod}`,
        metadata: {
          source: "existing_rental_setup",
          payment_method: firstMethod,
          payment_description: rentDescription
        },
        created_by: user.id
      });

      if (transactionError) {
        throw new Error(transactionError.message);
      }
    }
  }

  if (depositMode !== "none" && depositSetupAmount > 0) {
    const depositDescription =
      depositMode === "collected"
        ? "Security deposit - already collected"
        : "Security deposit - outstanding";
    const { data: depositPayment, error: depositError } = await supabase
      .from("rental_payments")
      .insert({
        organization_id: rental.organization_id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        vehicle_id: rental.vehicle_id,
        due_date: depositMode === "collected" ? depositDate : setupDate,
        scheduled_date: depositMode === "collected" ? depositDate : setupDate,
        paid_at: depositMode === "collected" ? `${depositDate}T00:00:00.000Z` : null,
        payment_method: depositMode === "collected" ? depositMethod : null,
        status: depositMode === "collected" ? "paid" : "pending",
        amount: depositSetupAmount,
        currency,
        metadata: {
          type: "deposit",
          description: depositDescription,
          setup_source: "operator_existing_rental"
        }
      })
      .select("id")
      .single();

    if (depositError || !depositPayment) {
      throw new Error(depositError?.message || "Unable to create the deposit payment record.");
    }
    insertedPaymentIds.push(depositPayment.id);

    if (depositMode === "collected") {
      const { error: transactionError } = await supabase.from("transactions").insert({
        organization_id: rental.organization_id,
        vehicle_id: rental.vehicle_id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        rental_payment_id: depositPayment.id,
        type: "deposit_received",
        amount: depositSetupAmount,
        currency,
        transaction_date: depositDate,
        notes: `${depositDescription} - received via ${depositMethod}`,
        is_deposit: true,
        deposit_rental_id: rental.id,
        metadata: {
          source: "existing_rental_setup",
          payment_method: depositMethod,
          payment_description: depositDescription
        },
        created_by: user.id
      });

      if (transactionError) {
        throw new Error(transactionError.message);
      }

      await supabase
        .from("rentals")
        .update({
          deposit_held: depositSetupAmount,
          deposit_status: "received",
          deposit_received_at: `${depositDate}T00:00:00.000Z`
        })
        .eq("id", rental.id)
        .eq("organization_id", rental.organization_id);
    }
  }

  const detail = `Existing rental payment records set up by ${operatorName(user)}. ${insertedPaymentIds.length} payment ${insertedPaymentIds.length === 1 ? "row" : "rows"} created.`;
  await recordActivityEvent(supabase, {
    organization_id: rental.organization_id,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rental.id,
    vehicle_id: rental.vehicle_id,
    rental_id: rental.id,
    customer_id: rental.customer_id,
    event_type: "payment_setup",
    title: "Payment records set up",
    detail,
    metadata: {
      content: detail,
      first_payment_mode: firstPaymentMode,
      deposit_mode: depositMode,
      payment_ids: insertedPaymentIds
    }
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath(`/fleet/${rental.vehicle_id}`);
  revalidatePath("/calendar");

  return { success: true };
}

function dateOnly(value: string | null | undefined) {
  return String(value || "").slice(0, 10);
}

function daysBetweenDates(from: string | null | undefined, to: string | null | undefined) {
  if (!from || !to) return 0;
  const start = new Date(dateOnly(from));
  const end = new Date(dateOnly(to));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function todayDate() {
  return businessToday();
}

function amountFromParam(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function addMonthsToDate(dateString: string | null | undefined, months: number) {
  const normalized = dateOnly(dateString);
  if (!normalized) return "";
  const [year, month, day] = normalized.split("-").map((part) => Number(part));
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  const originalDay = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months);
  if (date.getUTCDate() !== originalDay) {
    date.setUTCDate(0);
  }
  return date.toISOString().slice(0, 10);
}

function monthYearLabel(dateString: string | null | undefined) {
  const normalized = dateOnly(dateString);
  if (!normalized) return "Next";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${normalized}T00:00:00.000Z`));
}

function absoluteDaysBetweenDates(from: string | null | undefined, to: string | null | undefined) {
  const start = dateOnly(from);
  const end = dateOnly(to);
  if (!start || !end) return Number.POSITIVE_INFINITY;
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000));
}

function amountMatchesSchedule(transactionAmount: unknown, expectedAmount: number) {
  const amount = Number(transactionAmount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) return true;
  return Math.abs(amount - expectedAmount) <= expectedAmount * 0.2;
}

function findScheduleTransactionMatch({
  dueDate,
  amount,
  transactions,
  usedTransactionIds
}: {
  dueDate: string;
  amount: number;
  transactions: any[];
  usedTransactionIds: Set<string>;
}) {
  return [...transactions]
    .filter((transaction: any) => {
      const transactionId = String(transaction.id || "");
      if (!transactionId || usedTransactionIds.has(transactionId)) return false;
      if (absoluteDaysBetweenDates(dueDate, transaction.transaction_date) > 10) return false;
      return amountMatchesSchedule(transaction.amount, amount);
    })
    .sort((a: any, b: any) => absoluteDaysBetweenDates(dueDate, a.transaction_date) - absoluteDaysBetweenDates(dueDate, b.transaction_date))[0];
}

async function createNextMonthlyPaymentIfNeeded(supabase: any, payment: any) {
  const metadata = payment.metadata || {};
  const paymentType = String(metadata.type || "rent");
  if (["deposit", "deposit_received", "deposit_refunded"].includes(paymentType)) {
    return;
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, organization_id, customer_id, vehicle_id, status, end_date, rental_rate, currency, pricing_model, billing_interval")
    .eq("id", payment.rental_id)
    .eq("organization_id", payment.organization_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) {
    return;
  }

  const billingPeriod = String(rental.billing_interval || rental.pricing_model || "").toLowerCase();
  const rentalStatus = String(rental.status || "").toLowerCase();
  const isMonthly = billingPeriod === "monthly" || billingPeriod === "month";
  const isActive = ["active", "due_soon", "overdue", "extended"].includes(rentalStatus);
  if (!isMonthly || !isActive || !rental.customer_id || !rental.vehicle_id) {
    return;
  }

  const nextDueDate = addMonthsToDate(payment.due_date, 1);
  // A payment due on the return day (or later) would pay for time after the vehicle is back: none is made.
  const endDate = rental.end_date ? dateOnly(rental.end_date) : null;
  if (!nextDueDate || (endDate && nextDueDate >= endDate)) {
    return;
  }
  // Less than a month left before the return: that last stretch is charged exactly as a full schedule charges it
  // (billingPeriodAmounts from the period just paid: its second amount is this next one, part-month when short).
  const fullRate = Number(rental.rental_rate || payment.amount || 0);
  const nextAmount = endDate ? billingPeriodAmounts(dateOnly(payment.due_date), endDate, "monthly", fullRate, 60)[1] ?? fullRate : fullRate;

  const { data: existingPayments, error: existingError } = await supabase
    .from("rental_payments")
    .select("id, status, metadata")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rental.id)
    .eq("due_date", nextDueDate)
    .is("deleted_at", null);

  if (existingError) {
    return;
  }

  const nextAlreadyExists = (existingPayments || []).some((row: any) => {
    const rowType = String(row.metadata?.type || "rent");
    return row.status !== "voided" && !row.metadata?.voided && rowType !== "deposit";
  });
  if (nextAlreadyExists) {
    return;
  }

  const description = `${monthYearLabel(nextDueDate)} rental payment`;
  await supabase.from("rental_payments").insert({
    organization_id: rental.organization_id,
    rental_id: rental.id,
    customer_id: rental.customer_id,
    vehicle_id: rental.vehicle_id,
    due_date: nextDueDate,
    scheduled_date: nextDueDate,
    status: "scheduled",
    amount: nextAmount,
    currency: rental.currency || payment.currency || "THB",
    metadata: {
      type: "rent",
      is_deposit: false,
      period_label: monthYearLabel(nextDueDate),
      auto_generated: true,
      description,
      generated_from_payment_id: payment.id,
      generated_reason: "monthly_rolling_schedule"
    }
  });
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function generatePaymentScheduleForRental(...args: Parameters<typeof generatePaymentScheduleForRentalOrThrow>) {
  return guard(() => generatePaymentScheduleForRentalOrThrow(...args));
}

async function generatePaymentScheduleForRentalOrThrow(rentalId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const cleanRentalId = String(rentalId || "").trim();
  if (!cleanRentalId) {
    throw new Error("Rental is required.");
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, organization_id, customer_id, vehicle_id, start_date, end_date, rental_rate, pricing_model, billing_interval, currency")
    .eq("id", cleanRentalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Rental was not found.");
  }

  enterBusinessTimeZone(await ensureMembership(supabase, rental.organization_id, user.id));

  if (!rental.customer_id || !rental.vehicle_id) {
    throw new Error("A customer and vehicle are required before generating a payment schedule.");
  }

  const rentalRate = Number(rental.rental_rate || 0);
  if (rentalRate <= 0) {
    throw new Error("Set a rental rate before generating a payment schedule.");
  }

  const firstFallbackDate = dateOnly(rental.start_date);
  if (!firstFallbackDate) {
    throw new Error("Set a rental start date before generating a payment schedule.");
  }

  const { data: existingPayments, error: paymentsError } = await supabase
    .from("rental_payments")
    .select("id, due_date, status, amount, currency, voided, metadata, transaction_id")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rental.id)
    .is("deleted_at", null);

  if (paymentsError) {
    throw new Error(paymentsError.message);
  }

  const nonVoidedRentPayments = (existingPayments || []).filter((payment: any) => {
    const metadata = payment.metadata || {};
    const type = String(metadata.type || "rent").toLowerCase();
    return payment.status !== "voided" && !payment.voided && !metadata.voided && !["deposit", "deposit_received", "deposit_refunded"].includes(type);
  });

  const firstPaidPayment = [...nonVoidedRentPayments]
    .filter((payment: any) => payment.status === "paid" && dateOnly(payment.due_date))
    .sort((a: any, b: any) => dateOnly(a.due_date).localeCompare(dateOnly(b.due_date)))[0];
  const firstPaymentDate = dateOnly(firstPaidPayment?.due_date) || firstFallbackDate;

  const generatedStatusesToReplace = new Set(["scheduled", "pending", "overdue"]);
  const preservedDueDates = new Set(
    nonVoidedRentPayments
      .filter((payment: any) => !generatedStatusesToReplace.has(String(payment.status || "")) || Boolean(payment.transaction_id))
      .map((payment: any) => dateOnly(payment.due_date))
      .filter(Boolean)
  );

  const { error: deleteError } = await supabase
    .from("rental_payments")
    .delete()
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rental.id)
    .in("status", ["scheduled", "pending", "overdue"])
    .is("transaction_id", null);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { data: existingTransactions, error: transactionsError } = await supabase
    .from("transactions")
    .select("id, amount, transaction_date, voided, metadata")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rental.id)
    .eq("type", "rental_income")
    .or("voided.is.null,voided.eq.false")
    .order("transaction_date", { ascending: true });

  if (transactionsError) {
    throw new Error(transactionsError.message);
  }

  const endDate = dateOnly(rental.end_date);
  const today = todayDate();
  const records: Record<string, any>[] = [];
  const usedTransactionIds = new Set<string>(
    nonVoidedRentPayments.map((payment: any) => String(payment.transaction_id || "")).filter(Boolean)
  );
  let matchedCount = 0;
  let overdueCount = 0;
  let upcomingCount = 0;

  // With no end date: what is due so far and the next two months. The daily job adds each month after that.
  const openEndedHorizon = endDate ? "" : addMonthsToDate(today > firstPaymentDate ? today : firstPaymentDate, 2);
  for (let periodIndex = 0; periodIndex < (endDate ? 12 : 240); periodIndex += 1) {
    const dueDate = addMonthsToDate(firstPaymentDate, periodIndex);
    if (!dueDate) continue;
    if (endDate && dueDate > endDate) break;
    if (!endDate && openEndedHorizon && dueDate > openEndedHorizon) break;
    if (preservedDueDates.has(dueDate)) continue;

    const matchedTransaction = findScheduleTransactionMatch({
      dueDate,
      amount: rentalRate,
      transactions: existingTransactions || [],
      usedTransactionIds
    });
    const matchedTransactionId = matchedTransaction?.id ? String(matchedTransaction.id) : null;
    if (matchedTransactionId) {
      usedTransactionIds.add(matchedTransactionId);
    }

    let status = "scheduled";
    if (matchedTransactionId) {
      status = "paid";
      matchedCount += 1;
    } else if (dueDate < today) {
      status = "overdue";
      overdueCount += 1;
    } else {
      status = dueDate === today ? "pending" : "scheduled";
      upcomingCount += 1;
    }

    records.push({
      organization_id: rental.organization_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      vehicle_id: rental.vehicle_id,
      amount: rentalRate,
      currency: rental.currency || "THB",
      scheduled_date: dueDate,
      due_date: dueDate,
      status,
      paid_at: matchedTransaction?.transaction_date ? new Date(matchedTransaction.transaction_date).toISOString() : null,
      transaction_id: matchedTransactionId,
      metadata: {
        type: "rent",
        is_deposit: false,
        period_index: periodIndex,
        period_label: monthYearLabel(dueDate),
        auto_matched: Boolean(matchedTransactionId),
        matched_transaction_id: matchedTransactionId,
        description: `${monthYearLabel(dueDate)} rental payment`,
        generated_by: user.id,
        generated_source: "operator_payment_schedule_button",
        generated_at: new Date().toISOString()
      }
    });
  }

  if (records.length > 0) {
    const { error: insertError } = await supabase.from("rental_payments").insert(records);
    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  const message = `Payment schedule generated - ${matchedCount} matched to existing transactions, ${overdueCount} overdue, ${upcomingCount} upcoming`;
  const detail = `${message}.`;
  await recordActivityEvent(supabase, {
    organization_id: rental.organization_id,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rental.id,
    vehicle_id: rental.vehicle_id,
    rental_id: rental.id,
    customer_id: rental.customer_id,
    event_type: "payment_schedule_generated",
    title: "Payment schedule generated",
    detail,
    metadata: {
      content: detail,
      count: records.length,
      matched_count: matchedCount,
      overdue_count: overdueCount,
      upcoming_count: upcomingCount,
      first_payment_date: firstPaymentDate,
      rental_rate: rentalRate,
      billing_period: rental.billing_interval || rental.pricing_model || "monthly"
    }
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath(`/bookings/${rental.id}/edit`);
  revalidatePath("/calendar");

  return { success: true, count: records.length, matched: matchedCount, overdue: overdueCount, upcoming: upcomingCount, message };
}

type AdjustRentalParams = Parameters<typeof adjustRentalOrThrow>[0];

export async function adjustRental(params: AdjustRentalParams): Promise<{ success: boolean; error?: string }> {
  try {
    await adjustRentalOrThrow(params);
    return { success: true };
  } catch (error) {
    // Our own sentences pass through; database wording never reaches the screen (lib/action-error.ts).
    return { success: false, error: await userError(error, "Couldn't change the rental. Nothing was saved.") };
  }
}

async function adjustRentalOrThrow(params: {
  rentalId: string;
  adjustmentType: "extension" | "early_return";
  newEndDate: string;
  extensionPaymentAmount?: number;
  extensionPaymentDueDate?: string;
  refundAmount?: number;
  advancePaidAmount?: number;
  refundReason?: string;
  note?: string;
}) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const cleanRentalId = String(params.rentalId || "").trim();
  const cleanEndDate = dateOnly(params.newEndDate);
  const cleanNote = String(params.note || "").trim() || null;
  const adjustmentType = params.adjustmentType;

  if (!cleanRentalId) {
    throw new Error("Rental is required.");
  }
  if (!cleanEndDate) {
    throw new Error("Return date is required.");
  }
  if (!["extension", "early_return"].includes(adjustmentType)) {
    throw new Error("Choose a valid rental adjustment.");
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, start_date, end_date, rental_rate, currency, status, display_code, reference")
    .eq("id", cleanRentalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Rental was not found.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", rental.organization_id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error(membershipError?.message || "You do not have access to this rental.");
  }

  const originalEndDate = dateOnly(rental.end_date);
  const actor = operatorName(user);
  const nowDate = todayDate();

  if (adjustmentType === "extension" && rental.vehicle_id) {
    const conflict = await vehicleConflictMessage(supabase, {
      organizationId: rental.organization_id,
      vehicleId: rental.vehicle_id,
      startDate: dateOnly(rental.start_date) || nowDate,
      endDate: cleanEndDate,
      excludeRentalId: rental.id
    });
    if (conflict) {
      throw new Error(`Can't extend to that date. ${conflict.replace(/ Choose other dates or another vehicle\.$/, "")}`);
    }
  }

  if (adjustmentType === "extension") {
    const extensionPaymentAmount = amountFromParam(params.extensionPaymentAmount);
    const extensionPaymentDueDate = dateOnly(params.extensionPaymentDueDate) || originalEndDate || nowDate;
    const extensionDays = daysBetweenDates(originalEndDate, cleanEndDate);

    const { error: updateError } = await supabase
      .from("rentals")
      .update({ end_date: cleanEndDate })
      .eq("id", rental.id)
      .eq("organization_id", rental.organization_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (extensionPaymentAmount > 0) {
      if (!rental.customer_id) {
        throw new Error("Assign a customer before creating an extension payment.");
      }

      const description = `Extension - ${originalEndDate ? niceDate(originalEndDate) : "open"} to ${niceDate(cleanEndDate)}`;
      const { error: paymentError } = await supabase.from("rental_payments").insert({
        organization_id: rental.organization_id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        vehicle_id: rental.vehicle_id,
        due_date: extensionPaymentDueDate,
        scheduled_date: extensionPaymentDueDate,
        status: "pending",
        amount: extensionPaymentAmount,
        currency: rental.currency || "THB",
        metadata: {
          type: "extension",
          description,
          adjustment_type: "extension",
          previous_end_date: originalEndDate,
          new_end_date: cleanEndDate,
          extension_days: extensionDays,
          note: cleanNote
        }
      });

      if (paymentError) {
        throw new Error(paymentError.message);
      }
    }

    const extCurrency = rental.currency || "THB";
    const extMoney = `${extCurrency === "THB" ? "฿" : `${extCurrency} `}${Math.round(extensionPaymentAmount).toLocaleString("en-US")}`;
    const paymentSentence =
      extensionPaymentAmount > 0
        ? ` ${extMoney} for the extra days is due ${niceDate(extensionPaymentDueDate)}.`
        : " No extra payment recorded.";
    const detail = `Rental extended to ${niceDate(cleanEndDate)} (was ${niceDate(originalEndDate)}).${paymentSentence}${cleanNote ? ` ${cleanNote}` : ""}`;

    await Promise.all([
      recordActivityEvent(supabase, {
        organization_id: rental.organization_id,
        actor_id: user.id,
        entity_type: "rental",
        entity_id: rental.id,
        vehicle_id: rental.vehicle_id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        event_type: "rental_extended",
        title: `Rental extended to ${niceDate(cleanEndDate)}`,
        detail: `${detail} Adjusted by ${actor}.`
      }),
      supabase.from("communication_log").insert({
        organisation_id: rental.organization_id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        type: "system_event",
        direction: "internal",
        content: detail,
        status: "sent",
        metadata: {
          adjustment_type: "extension",
          previous_end_date: originalEndDate,
          new_end_date: cleanEndDate,
          extension_payment_amount: extensionPaymentAmount,
          extension_payment_due_date: extensionPaymentDueDate,
          note: cleanNote
        },
        created_by: user.id
      })
    ]);
  } else {
    const refundAmount = amountFromParam(params.refundAmount);
    const advancePaidAmount = amountFromParam(params.advancePaidAmount);
    const refundReason = String(params.refundReason || "").trim() || null;
    const daysEarly = daysBetweenDates(cleanEndDate, originalEndDate);
    // A vehicle that is already back goes through "Start return", which records its
    // condition, settles the deposit and frees the vehicle. This only moves the planned date.
    if (cleanEndDate <= nowDate) {
      throw new Error("If the vehicle is back already, use Start return: it records the condition and settles the deposit.");
    }

    const { error: updateError } = await supabase
      .from("rentals")
      .update({ end_date: cleanEndDate, is_indefinite: false })
      .eq("id", rental.id)
      .eq("organization_id", rental.organization_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Rent that would have fallen due after the new return date is no longer owed.
    const { data: futurePayments, error: futurePaymentFetchError } = await supabase
      .from("rental_payments")
      .select("id, metadata")
      .eq("rental_id", rental.id)
      .eq("organization_id", rental.organization_id)
      .in("status", ["scheduled", "pending"])
      .is("transaction_id", null)
      .gt("due_date", cleanEndDate)
      .or("voided.is.null,voided.eq.false");

    if (futurePaymentFetchError) {
      throw new Error(futurePaymentFetchError.message);
    }

    // Unpaid extensions are judged by the days they cover: wholly after the new date, off; partly, cut to the days kept.
    const { data: extensionRows } = await supabase
      .from("rental_payments")
      .select("id, amount, metadata")
      .eq("rental_id", rental.id)
      .eq("organization_id", rental.organization_id)
      .in("status", ["scheduled", "pending", "overdue", "failed"])
      .is("transaction_id", null)
      .lte("due_date", cleanEndDate)
      .or("voided.is.null,voided.eq.false");
    const spanDays = (from: string, to: string) => Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
    for (const row of extensionRows || []) {
      const from = String(row.metadata?.previous_end_date || "").slice(0, 10);
      const to = String(row.metadata?.new_end_date || "").slice(0, 10);
      if (row.metadata?.type !== "extension" || !from || !to || to <= cleanEndDate) continue;
      if (from >= cleanEndDate) {
        (futurePayments as any[]).push(row);
        continue;
      }
      const kept = spanDays(from, cleanEndDate);
      const length = spanDays(from, to);
      if (length <= 0) continue;
      const amount = Math.round((Number(row.amount || 0) * kept) / length / 10) * 10;
      await supabase
        .from("rental_payments")
        .update({ amount, metadata: { ...(row.metadata || {}), new_end_date: cleanEndDate, scheduled_amount: Number(row.amount || 0), shortened_reason: "Return date brought forward" } })
        .eq("id", row.id);
    }

    const futurePaymentIds = (futurePayments || []).map((p: any) => p.id);
    for (const payment of futurePayments || []) {
      await supabase
        .from("rental_payments")
        .update({ voided: true, status: "voided", metadata: { ...(payment.metadata || {}), voided_reason: "Return date brought forward", voided_at: new Date().toISOString(), voided_by: user.id } })
        .eq("id", payment.id);
    }

    const futurePaymentsDeleted = futurePaymentIds.length;

    if (refundAmount > 0) {
      const description = `Partial refund - early return ${daysEarly} days early${refundReason ? `. ${refundReason}` : ""}`;
      const { error: transactionError } = await supabase.from("transactions").insert({
        organization_id: rental.organization_id,
        vehicle_id: rental.vehicle_id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        type: "refund",
        amount: -Math.abs(refundAmount),
        currency: rental.currency || "THB",
        transaction_date: nowDate,
        notes: description,
        metadata: {
          adjustment_type: "early_return",
          description,
          previous_end_date: originalEndDate,
          new_end_date: cleanEndDate,
          days_early: daysEarly,
          advance_paid_amount: advancePaidAmount,
          refund_amount: refundAmount,
          refund_reason: refundReason,
          note: cleanNote,
          is_rental_refund: true
        },
        created_by: user.id
      });

      if (transactionError) {
        throw new Error(transactionError.message);
      }
    }

    const voidedSentence =
      futurePaymentsDeleted > 0
        ? ` ${futurePaymentsDeleted} later ${futurePaymentsDeleted === 1 ? "payment" : "payments"} removed from the schedule.`
        : "";
    const detail = `Return date set to ${cleanEndDate}${originalEndDate ? ` (was ${originalEndDate})` : " (was open-ended)"}.`;
    const legacyDetail = `Early return recorded - new end date ${niceDate(cleanEndDate)}. ${refundAmount > 0 ? `Refund of ${niceMoney(refundAmount, rental.currency)} issued.` : "No refund issued."}${voidedSentence}${refundReason ? ` ${refundReason}` : ""}${cleanNote ? ` ${cleanNote}` : ""}`;

    await Promise.all([
      recordActivityEvent(supabase, {
        organization_id: rental.organization_id,
        actor_id: user.id,
        entity_type: "rental",
        entity_id: rental.id,
        vehicle_id: rental.vehicle_id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        event_type: "rental_early_return",
        title: "Return date changed",
        detail: `${detail}${voidedSentence}${cleanNote ? ` ${cleanNote}` : ""} Changed by ${actor}.`
      }),
      supabase.from("communication_log").insert({
        organisation_id: rental.organization_id,
        rental_id: rental.id,
        customer_id: rental.customer_id,
        type: "system_event",
        direction: "internal",
        content: detail,
        status: "sent",
        metadata: {
          adjustment_type: "early_return",
          previous_end_date: originalEndDate,
          new_end_date: cleanEndDate,
          days_early: daysEarly,
          advance_paid_amount: advancePaidAmount,
          refund_amount: refundAmount,
          refund_reason: refundReason,
          future_payment_records_deleted: futurePaymentsDeleted,
          note: cleanNote
        },
        created_by: user.id
      })
    ]);
    void legacyDetail;
    await tellRentalCustomer(
      createSupabaseAdminClient() as any,
      rental.id,
      ({ say, vehicle, date }) => say("returnDateChanged", { vehicle, date: date(cleanEndDate) }),
      { sentBy: user.id }
    );
    revalidatePath("/calendar");
  }

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath(`/fleet/${rental.vehicle_id}`);
  revalidatePath("/calendar");

  return { success: true };
}

type RentalPaymentCorrection = {
  amount: number;
  dueDate: string;
  description?: string | null;
  status: "scheduled" | "pending" | "paid" | "failed" | "overdue" | "cancelled" | "refunded" | "reconciled" | "waived" | "voided";
  paidDate?: string | null;
};

type RecordPaymentReceivedInput = {
  amount: number;
  date: string;
  method: string;
  note?: string | null;
};

async function ensureMembership(supabase: any, organizationId: string, userId: string) {
  // Opened before the first await, so the business loaded here stays with the code that awaited this (server actions too).
  openBusinessScope();
  const { data, error } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "You do not have access to this organization.");
  }
  // "Today" for the rest of this save is this business's day, not Bangkok's (the caller enters it: enterBusinessTimeZone).
  return adoptBusinessClock(supabase, organizationId);
}

export async function updateRentalEndDate(rentalId: string, newEndDate: string): Promise<{ success: boolean; error?: string }> {
  try {
    await updateRentalEndDateOrThrow(rentalId, newEndDate);
    return { success: true };
  } catch (error) {
    // Our own sentences pass through; database wording never reaches the screen (lib/action-error.ts).
    return { success: false, error: await userError(error, "Couldn't change the return date. Nothing was saved.") };
  }
}

async function updateRentalEndDateOrThrow(rentalId: string, newEndDate: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const cleanRentalId = String(rentalId || "").trim();
  const cleanEndDate = dateOnly(newEndDate);
  if (!cleanRentalId || !cleanEndDate) {
    throw new Error("Rental and new end date are required.");
  }

  const { data: rental, error } = await supabase
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, start_date, end_date")
    .eq("id", cleanRentalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !rental) {
    throw new Error(error?.message || "Rental was not found.");
  }

  enterBusinessTimeZone(await ensureMembership(supabase, rental.organization_id, user.id));

  if (rental.vehicle_id && rental.start_date) {
    const conflict = await vehicleConflictMessage(supabase, {
      organizationId: rental.organization_id,
      vehicleId: rental.vehicle_id,
      startDate: dateOnly(rental.start_date),
      endDate: cleanEndDate,
      excludeRentalId: rental.id
    });
    if (conflict) {
      throw new Error(`That end date clashes with another booking. ${conflict.replace(/ Choose other dates or another vehicle\.$/, "")}`);
    }
  }

  const oldDate = dateOnly(rental.end_date) || "Open";
  const { error: updateError } = await supabase
    .from("rentals")
    .update({ end_date: cleanEndDate })
    .eq("id", rental.id)
    .eq("organization_id", rental.organization_id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const detail = `End date corrected: ${oldDate} -> ${cleanEndDate}`;
  await recordActivityEvent(supabase, {
    organization_id: rental.organization_id,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rental.id,
    vehicle_id: rental.vehicle_id,
    rental_id: rental.id,
    customer_id: rental.customer_id,
    event_type: "correction",
    title: "End date corrected",
    detail,
    metadata: { type: "correction", content: detail, old_end_date: oldDate, new_end_date: cleanEndDate }
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath(`/fleet/${rental.vehicle_id}`);
  revalidatePath("/calendar");

  return { success: true };
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function updateRentalPayment(...args: Parameters<typeof updateRentalPaymentOrThrow>) {
  return guard(() => updateRentalPaymentOrThrow(...args));
}

async function updateRentalPaymentOrThrow(paymentId: string, fields: RentalPaymentCorrection) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const cleanPaymentId = String(paymentId || "").trim();
  const amount = amountFromParam(fields.amount);
  const dueDate = dateOnly(fields.dueDate);
  const status = String(fields.status || "pending");
  const paidDate = dateOnly(fields.paidDate);
  const description = String(fields.description || "").trim();

  if (!cleanPaymentId || !dueDate || amount < 0) {
    throw new Error("Payment amount and due date are required.");
  }

  const { data: payment, error } = await supabase
    .from("rental_payments")
    .select("*")
    .eq("id", cleanPaymentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !payment) {
    throw new Error(error?.message || "Payment was not found.");
  }

  enterBusinessTimeZone(await ensureMembership(supabase, payment.organization_id, user.id));

  const oldAmount = Number(payment.amount || 0);
  const oldDueDate = dateOnly(payment.due_date);
  const oldDescription = payment.metadata?.description || "";
  const oldStatus = String(payment.status || "");
  const metadata = {
    ...(payment.metadata || {}),
    description,
    corrected_at: new Date().toISOString(),
    corrected_by: user.id,
    correction_history: [
      ...((Array.isArray(payment.metadata?.correction_history) && payment.metadata.correction_history) || []),
      {
        at: new Date().toISOString(),
        by: user.id,
        old_amount: oldAmount,
        new_amount: amount,
        old_due_date: oldDueDate,
        new_due_date: dueDate,
        old_status: oldStatus,
        new_status: status,
        old_description: oldDescription,
        new_description: description
      }
    ]
  };

  const { error: updateError } = await supabase
    .from("rental_payments")
    .update({
      amount,
      due_date: dueDate,
      scheduled_date: dueDate,
      status,
      paid_at: status === "paid" ? (paidDate ? `${paidDate}T00:00:00.000Z` : new Date().toISOString()) : null,
      metadata
    })
    .eq("id", payment.id)
    .eq("organization_id", payment.organization_id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const detail = `Payment corrected: ${niceMoney(oldAmount)} -> ${niceMoney(amount)} (${description || oldDescription || "Scheduled payment"})`;
  await recordActivityEvent(supabase, {
    organization_id: payment.organization_id,
    actor_id: user.id,
    entity_type: "payment",
    entity_id: payment.id,
    vehicle_id: payment.vehicle_id || null,
    rental_id: payment.rental_id,
    customer_id: payment.customer_id || null,
    event_type: "correction",
    title: "Payment corrected",
    detail,
    metadata: { type: "correction", content: detail, old_amount: oldAmount, new_amount: amount }
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${payment.rental_id}`);
  revalidatePath("/calendar");

  return { success: true };
}

/**
 * "Record payment" on the booking screen: a reason it can't be saved comes back as `{ actionError }`.
 * recordPaymentReceived itself still throws, for the receipt confirm and the assistant that call it.
 */
export async function recordPaymentReceivedFromScreen(paymentId: string, fields: RecordPaymentReceivedInput) {
  return guard(() => recordPaymentReceived(paymentId, fields));
}

export async function recordPaymentReceived(paymentId: string, fields: RecordPaymentReceivedInput) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const cleanPaymentId = String(paymentId || "").trim();
  const amount = amountFromParam(fields.amount);
  const receivedDate = dateOnly(fields.date) || todayDate();
  const method = String(fields.method || "cash").trim() || "cash";
  const note = String(fields.note || "").trim() || null;

  if (!cleanPaymentId) {
    throw new Error("Payment and amount are required.");
  }
  if (!(amount > 0)) {
    throw new Error("Enter the amount received.");
  }

  const { data: payment, error } = await supabase
    .from("rental_payments")
    .select("*")
    .eq("id", cleanPaymentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !payment) {
    throw new Error(error?.message || "Payment was not found.");
  }

  enterBusinessTimeZone(await ensureMembership(supabase, payment.organization_id, user.id));

  const paymentType = String(payment.metadata?.type || "");
  const description =
    payment.metadata?.description ||
    (paymentType === "deposit" || payment.metadata?.is_deposit === true
      ? "Deposit"
      : paymentType === "extension"
        ? "Extension payment"
        : paymentType === "charge"
          ? "Charge"
        : payment.metadata?.period_label
          ? `${payment.metadata.period_label} rent`
          : "Rent payment");
  const methodLabel = method.replace(/_/g, " ");
  const transactionNotes = `${description} - received by ${methodLabel}${note ? `. ${note}` : ""}`;
  // A deposit (for example a top-up agreed in a signed amendment) is held,
  // not earned: record it as deposit received and add it to the deposit held.
  const isDepositPayment = payment.metadata?.type === "deposit" || payment.metadata?.is_deposit === true;
  // A cost billed to the customer (damage, a fine, fuel) is income of its own, not rent.
  const isChargePayment = paymentType === "charge";
  const { error: transactionError } = await supabase.from("transactions").insert({
    organization_id: payment.organization_id,
    vehicle_id: payment.vehicle_id || null,
    rental_id: payment.rental_id,
    customer_id: payment.customer_id || null,
    rental_payment_id: payment.id,
    type: isDepositPayment ? "deposit_received" : isChargePayment ? "charge_recovered" : "rental_income",
    ...(isDepositPayment ? { is_deposit: true, deposit_rental_id: payment.rental_id } : {}),
    amount,
    currency: payment.currency || "THB",
    transaction_date: receivedDate,
    notes: transactionNotes,
    metadata: {
      source: "payment_schedule",
      payment_method: method,
      payment_description: description,
      note,
      // Extras are rental income, tagged so what was paid for them can be seen and refunded.
      ...extrasIncomeTag(payment.metadata, amount),
      // The charge for coming back late: rental income, but shown and counted as "Late return", not rent.
      ...(payment.metadata?.late_return ? { late_return: true } : {}),
      // The customer's receipt, when they sent one, stays with the money it proves.
      ...(payment.metadata?.receipt?.path ? { receipt_path: payment.metadata.receipt.path } : {})
    },
    created_by: user.id
  });

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  const metadata = {
    ...(payment.metadata || {}),
    payment_received_method: method,
    payment_received_note: note,
    payment_received_at: new Date().toISOString()
  };

  // A part payment settles only what was received; the rest stays due on the
  // same date as its own line, so the balance and reminders stay right.
  const scheduledAmount = Number(payment.amount || 0);
  const remainder = Math.round((scheduledAmount - amount) * 100) / 100;
  const isPartPayment = remainder >= 1;

  const { error: updateError } = await supabase
    .from("rental_payments")
    .update({
      status: "paid",
      paid_at: `${receivedDate}T00:00:00.000Z`,
      paid_date: receivedDate,
      ...(isPartPayment ? { amount } : {}),
      metadata: isPartPayment ? { ...metadata, scheduled_amount: scheduledAmount } : metadata
    })
    .eq("id", payment.id)
    .eq("organization_id", payment.organization_id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  // With the payment marked paid, the rest doesn't depend on each other: it runs together so the save is quick.
  const insertRemainder = async () => {
    if (!isPartPayment) return;
    const { error: remainderError } = await supabase.from("rental_payments").insert({
      organization_id: payment.organization_id,
      rental_id: payment.rental_id,
      customer_id: payment.customer_id,
      vehicle_id: payment.vehicle_id,
      due_date: payment.due_date,
      scheduled_date: payment.scheduled_date || payment.due_date,
      amount: remainder,
      currency: payment.currency || "THB",
      status: "pending",
      // A bill keeps its own words and links; rent and deposits are named from their kind when shown.
      metadata: paymentType === "charge"
        ? { ...(payment.metadata || {}), payment_received_method: undefined, payment_received_note: undefined, payment_received_at: undefined, remainder_of: payment.id }
        : {
            type: payment.metadata?.type || "rent",
            is_deposit: payment.metadata?.is_deposit === true,
            period_label: payment.metadata?.period_label || null,
            description: `Remaining balance - ${description}`,
            remainder_of: payment.id,
            ...(payment.metadata?.late_return ? { late_return: payment.metadata.late_return } : {}),
            // Extras keep their names; extras inside rent count as paid first, the rest stays with the remainder.
            ...(Array.isArray(payment.metadata?.extras) ? { extras: payment.metadata.extras } : {}),
            ...(Number(payment.metadata?.includes_extras?.amount || 0) > amount
              ? { includes_extras: { ...payment.metadata.includes_extras, amount: Number(payment.metadata.includes_extras.amount) - amount } }
              : {})
          }
    });
    if (remainderError) {
      throw new Error(remainderError.message);
    }
  };

  // Any reminder task for this payment is now done.
  const closeReminderTasks = async () => {
    await supabase
      .from("tasks")
      .update({ completed_at: new Date().toISOString(), completion_notes: "Payment recorded." })
      .eq("organization_id", payment.organization_id)
      .eq("rental_payment_id", payment.id)
      .is("completed_at", null);
  };

  const addToDepositHeld = async () => {
    if (!isDepositPayment) return;
    const { data: depositRental } = await supabase
      .from("rentals")
      .select("deposit_held")
      .eq("id", payment.rental_id)
      .eq("organization_id", payment.organization_id)
      .maybeSingle();
    await supabase
      .from("rentals")
      .update({
        deposit_held: Number(depositRental?.deposit_held || 0) + amount,
        deposit_status: "received",
        deposit_received_at: new Date().toISOString()
      })
      .eq("id", payment.rental_id)
      .eq("organization_id", payment.organization_id);
  };

  // The next month's rent is shown on the booking as soon as this one is paid, so it is part of the save.
  const [remainderResult] = await Promise.allSettled([insertRemainder(), closeReminderTasks(), addToDepositHeld(), createNextMonthlyPaymentIfNeeded(supabase, payment)]);
  if (remainderResult.status === "rejected") throw remainderResult.reason;

  // The history line and a partner's finder's fee are written just after the reply.
  const detail = `Payment received: ${description} ${niceMoney(amount)} via ${method}`;
  after(async () => {
    await Promise.allSettled([
      recordActivityEvent(supabase, {
        organization_id: payment.organization_id,
        actor_id: user.id,
        entity_type: "payment",
        entity_id: payment.id,
        vehicle_id: payment.vehicle_id || null,
        rental_id: payment.rental_id,
        customer_id: payment.customer_id || null,
        event_type: "payment_received",
        title: "Payment received",
        detail,
        metadata: { content: detail, payment_method: method, note }
      }),
      // A customer a partner referred: 10% of each rental payment is owed to that partner (lib/partner-network.ts).
      !isDepositPayment && !isChargePayment ? noteReferralFee(supabase, payment.rental_id, amount, payment.metadata, payment.id, payment.currency) : Promise.resolve()
    ]);
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${payment.rental_id}`);
  revalidatePath("/calendar");
  revalidatePath("/tasks");

  return { success: true };
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function deleteRentalPayment(...args: Parameters<typeof deleteRentalPaymentOrThrow>) {
  return guard(() => deleteRentalPaymentOrThrow(...args));
}

async function deleteRentalPaymentOrThrow(paymentId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const cleanPaymentId = String(paymentId || "").trim();
  if (!cleanPaymentId) {
    throw new Error("Payment is required.");
  }

  const { data: payment, error } = await supabase
    .from("rental_payments")
    .select("id, rental_id, organization_id, transaction_id, amount")
    .eq("id", cleanPaymentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !payment) {
    throw new Error(error?.message || "Payment was not found.");
  }

  const { data: rentalForAuth } = await supabase
    .from("rentals")
    .select("organization_id")
    .eq("id", payment.rental_id)
    .maybeSingle();

  const orgId: string = rentalForAuth?.organization_id || payment.organization_id;
  enterBusinessTimeZone(await ensureMembership(supabase, orgId, user.id));

  // Clear the transaction link before deleting
  if (payment.transaction_id) {
    await supabase
      .from("rental_payments")
      .update({ transaction_id: null })
      .eq("id", payment.id)
      .eq("organization_id", orgId);
  }

  // A partner's commission on this payment goes with it (unless already settled).
  await dropReferralFee(payment.id).catch(() => null);

  const { error: deleteError } = await supabase
    .from("rental_payments")
    .delete()
    .eq("id", payment.id)
    .eq("organization_id", orgId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${payment.rental_id}`);
  revalidatePath("/transactions");
  revalidatePath("/calendar");

  return { success: true };
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function cancelBookingWithDisposition(...args: Parameters<typeof cancelBookingWithDispositionOrThrow>) {
  return guard(() => cancelBookingWithDispositionOrThrow(...args));
}

async function cancelBookingWithDispositionOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You must be signed in.");

  const organizationId  = String(formData.get("organizationId") || "").trim();
  const rentalId        = String(formData.get("rentalId") || "").trim();
  const vehicleId       = String(formData.get("vehicleId") || "").trim();
  const reasonRaw       = String(formData.get("reason") || "").trim();
  const reason          = reasonRaw;
  // Written into money notes people read ("Rental refund on cancellation — canceled by us"), not the stored code
  // with its underscores swapped for spaces ("operator cancelled").
  const reasonWords: Record<string, string> = {
    customer_cancelled_before_delivery: "customer canceled before handover",
    customer_cancelled_early: "customer ended the rental early",
    vehicle_breakdown: "vehicle breakdown or fault",
    operator_cancelled: "canceled by us",
    other: "other reason"
  };
  const reasonLabel     = reasonRaw.split(",").map(r => reasonWords[r] || r.replace(/_/g, " ")).join(" + ");
  const refundOption    = String(formData.get("refundOption") || "").trim();
  const partialRefund   = Number(formData.get("partialRefundAmount") || 0);
  const partialDeposit  = Number(formData.get("partialDepositReturn") || 0);
  const notes           = String(formData.get("notes") || "").trim();
  const cancelledAtRaw  = String(formData.get("cancelledAt") || "").trim();
  const cancelledAt     = cancelledAtRaw || new Date().toISOString();
  const collectionDatetime = String(formData.get("collectionDatetime") || "").trim() || null;
  const vehicleDisposition = String(formData.get("vehicleDisposition") || "available").trim();
  const repairNotes = String(formData.get("repairNotes") || "").trim() || null;
  const repairExpectedEnd = String(formData.get("repairExpectedEnd") || "").trim() || null;

  if (!organizationId || !rentalId) throw new Error("Missing required fields.");
  if (!["available", "repair", "keep_assigned"].includes(vehicleDisposition)) {
    throw new Error("Choose a valid vehicle status.");
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) throw new Error(rentalError?.message || "Booking not found.");
  if (["completed", "cancelled"].includes(rental.status)) {
    throw new Error("This booking cannot be canceled from its current status.");
  }

  const now = new Date().toISOString();
  const today = businessToday();
  const currency = rental.currency || "THB";
  const depositHeld = Math.max(0, Number(rental.deposit_held || 0) - Number(rental.deposit_refunded_amount || 0) - Number(rental.deposit_forfeited_amount || 0));

  const { data: paidTransactions } = await supabase
    .from("transactions")
    .select("id, amount, type")
    .eq("rental_id", rentalId)
    .eq("organization_id", organizationId)
    .eq("voided", false)
    .in("type", ["rental_income", "deposit_received"])
    .is("deleted_at", null);

  // Rent already given back (a refund recorded earlier) is not refunded a second time on cancelling.
  const { data: earlierRefunds } = await supabase
    .from("transactions")
    .select("amount, is_deposit, metadata")
    .eq("rental_id", rentalId)
    .eq("organization_id", organizationId)
    .eq("voided", false)
    .eq("type", "refund")
    .is("deleted_at", null);
  const alreadyRefunded = (earlierRefunds || []).filter((t: any) => !t.is_deposit && !t.metadata?.voided).reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount || 0)), 0);
  const totalPaidIncome = Math.max(
    0,
    Math.round(
      ((paidTransactions || []).filter((t: any) => t.type === "rental_income").reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount || 0)), 0) - alreadyRefunded) * 100
    ) / 100
  );

  const transactionsToInsert: any[] = [];
  // What the customer is told on cancelling: their refund and what happens to the deposit.
  let refundTold = 0;
  let depositBackTold = 0;
  let depositKeptTold = 0;

  if (refundOption) {
    const isFullRefund    = refundOption.startsWith("full_refund");
    const isPartialRefund = refundOption.startsWith("partial_refund");
    const returnDeposit   = refundOption.endsWith("deposit_returned");
    const retainDeposit   = refundOption.endsWith("deposit_retained");

    // Money must add up: never refund more rent than was paid, nor return more deposit than is held.
    if (isPartialRefund && partialRefund > totalPaidIncome + 0.005) {
      throw new Error(await said(`The most you can refund is ${niceMoney(totalPaidIncome, currency)}.`));
    }
    if (isPartialRefund && partialDeposit > depositHeld + 0.005) {
      throw new Error(await said(`The deposit still held is ${niceMoney(depositHeld, currency)}.`));
    }

    const refundAmount = isFullRefund
      ? totalPaidIncome
      : isPartialRefund
        ? partialRefund
        : 0;
    refundTold = Math.max(0, refundAmount);

    if (refundAmount > 0) {
      transactionsToInsert.push({
        organization_id: organizationId,
        vehicle_id: vehicleId,
        rental_id: rentalId,
        customer_id: rental.customer_id,
        type: "refund",
        amount: -refundAmount,
        currency,
        transaction_date: today,
        notes: `Rental refund on cancellation — ${reasonLabel}${notes ? `: ${notes}` : ""}`,
        metadata: { cancellation_reason: reason, refund_option: refundOption, auto_created: true },
        is_deposit: false,
        created_by: user.id
      });
    }

    if (returnDeposit && depositHeld > 0) {
      const depositReturnAmount = isPartialRefund && partialDeposit > 0 ? partialDeposit : depositHeld;
      depositBackTold = depositReturnAmount;
      transactionsToInsert.push({
        organization_id: organizationId,
        vehicle_id: vehicleId,
        rental_id: rentalId,
        customer_id: rental.customer_id,
        type: "deposit_refunded",
        amount: -depositReturnAmount,
        currency,
        transaction_date: today,
        notes: `Deposit returned on cancellation — ${reasonLabel}`,
        metadata: { cancellation_reason: reason, refund_option: refundOption, auto_created: true },
        is_deposit: true,
        deposit_rental_id: rentalId,
        created_by: user.id
      });
    }

    if (retainDeposit && depositHeld > 0) {
      depositKeptTold = depositHeld;
      transactionsToInsert.push({
        organization_id: organizationId,
        vehicle_id: vehicleId,
        rental_id: rentalId,
        customer_id: rental.customer_id,
        type: "deposit_forfeited",
        amount: depositHeld,
        currency,
        transaction_date: today,
        notes: `Deposit forfeited on cancellation — ${reasonLabel}`,
        metadata: { cancellation_reason: reason, refund_option: refundOption, auto_created: true },
        is_deposit: true,
        deposit_rental_id: rentalId,
        created_by: user.id
      });
    }
  }

  const depositStatus = (() => {
    if (!refundOption || !depositHeld) return rental.deposit_status;
    if (refundOption.endsWith("deposit_returned")) {
      if (refundOption.startsWith("partial_refund") && partialDeposit > 0 && partialDeposit < depositHeld) {
        return "partially_returned";
      }
      return "fully_returned";
    }
    if (refundOption.endsWith("deposit_retained")) return "forfeited";
    return rental.deposit_status;
  })();

  const cancellationUpdate = {
    status: "cancelled",
    cancellation_reason: reason,
    cancellation_notes: notes || null,
    cancellation_refund_option: refundOption || null,
    cancelled_at: cancelledAt,
    cancelled_by: user.id,
    collection_datetime: collectionDatetime,
    deposit_status: depositStatus,
    ...(refundOption?.endsWith("deposit_returned")
      ? {
          // Added to what was already returned: depositHeld is only what is still held, so setting it replaced an
          // earlier part-return and the booking showed that part as still held.
          deposit_refunded_amount: Number(rental.deposit_refunded_amount || 0) + (refundOption.startsWith("partial_refund") && partialDeposit > 0
            ? partialDeposit
            : depositHeld),
          deposit_reconciled_at: now,
          deposit_reconciled_by: user.id,
          deposit_deduction_reason: notes || reason
        }
      : {}),
    ...(refundOption?.endsWith("deposit_retained") && depositHeld > 0
      ? {
          deposit_forfeited_amount: Number(rental.deposit_forfeited_amount || 0) + depositHeld,
          deposit_deduction_reason: notes || reason,
          deposit_reconciled_at: now,
          deposit_reconciled_by: user.id
        }
      : {})
  };

  const vehicleUpdate: Record<string, unknown> = {
    current_customer_id: null,
    current_rental_id: null
  };

  if (vehicleDisposition === "available") {
    vehicleUpdate.status = "available";
    vehicleUpdate.availability_status = "available_now";
    vehicleUpdate.repair_started_at = null;
    vehicleUpdate.repair_expected_end = null;
    vehicleUpdate.repair_notes = null;
  } else if (vehicleDisposition === "repair") {
    vehicleUpdate.status = "maintenance";
    vehicleUpdate.availability_status = "blocked";
    vehicleUpdate.repair_started_at = collectionDatetime || new Date().toISOString();
    vehicleUpdate.repair_expected_end = repairExpectedEnd;
    vehicleUpdate.repair_notes = repairNotes;
  }

  function throwCancellationError(step: string, error: { message?: string } | null) {
    if (!error) return;

    const message = error.message || "Unknown database error.";
    if (
      /cancellation_reason|cancellation_notes|cancellation_refund_option|cancelled_by|collection_datetime|repair_started_at|repair_expected_end|repair_notes/i.test(
        message
      )
    ) {
      throw new Error(
        "Cancellation fields are not available yet. Run migration 0045_rental_cancellation_fields.sql in Supabase, then try again."
      );
    }

    throw new Error(`${step}: ${message}`);
  }

  const rentalUpdateResult = await supabase
    .from("rentals")
    .update(cancellationUpdate)
    .eq("id", rentalId)
    .eq("organization_id", organizationId);
  throwCancellationError("Could not cancel the rental", rentalUpdateResult.error);

  const bookingLinkResult = await supabase
    .from("booking_links")
    .update({ status: "cancelled", cancelled_at: now })
    .eq("organization_id", organizationId)
    .eq("rental_id", rentalId);
  throwCancellationError("Could not cancel the booking link", bookingLinkResult.error);

  if (vehicleDisposition !== "keep_assigned") {
    const vehicleResult = await supabase
      .from("vehicles")
      .update(vehicleUpdate)
      .eq("id", vehicleId)
      .eq("organization_id", organizationId)
      .eq("current_rental_id", rentalId);
    throwCancellationError("Could not update the vehicle", vehicleResult.error);
    if (vehicleDisposition === "available") {
      await syncVehicleStatusFromBookings(supabase, organizationId, vehicleId);
    }
  }

  if (transactionsToInsert.length > 0) {
    const transactionResult = await supabase
      .from("transactions")
      .insert(transactionsToInsert);
    throwCancellationError("Could not record the cancellation transactions", transactionResult.error);
  }

  const paymentScheduleResult = await supabase
    .from("rental_payments")
    .update({ status: "cancelled" })
    .eq("rental_id", rentalId)
    .eq("organization_id", organizationId)
    .in("status", ["scheduled", "pending", "overdue"]);
  throwCancellationError("Could not cancel the payment schedule", paymentScheduleResult.error);
  // Any refund chosen in this dialog settles a "Refund to decide" job.
  if (refundOption) await completeRentalJobs(createSupabaseAdminClient() as any, rentalId, "refund", "Settled when the booking was canceled");
  // In the customer's language and the booking's currency: the refund (or that there is none) and the deposit.
  await tellRentalCustomer(
    createSupabaseAdminClient() as any,
    rentalId,
    ({ say, t, vehicle, money }) => {
      const lines = [say("rentalCancelled", { vehicle })];
      if (refundTold > 0) lines.push(t("cancelRefund", { amount: money(refundTold) }));
      else if (refundOption && totalPaidIncome > 0) lines.push(t("cancelNoRefund"));
      if (depositBackTold > 0) lines.push(depositBackTold < depositHeld - 0.005 ? t("cancelDepositPart", { returned: money(depositBackTold), held: money(depositHeld) }) : t("cancelDepositBack", { amount: money(depositBackTold) }));
      else if (depositKeptTold > 0) lines.push(t("cancelDepositKept", { amount: money(depositKeptTold) }));
      lines.push(t("anyQuestions"));
      return lines.join(" ");
    },
    { sentBy: user.id, withLink: false, replacesEarlier: true }
  );

  const refundLabel = refundOption ? ` — ${refundOption.replace(/_/g, " ")}` : "";

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: vehicleId,
    rental_id: rentalId,
    customer_id: rental.customer_id,
    event_type: "booking_cancelled",
    title: "Booking canceled",
    detail: `${rental.reference || rental.display_code || rentalId} canceled — ${reasonLabel}${refundLabel}.${notes ? ` Notes: ${notes}` : ""}`
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath(`/fleet/${vehicleId}`);

  return { success: true };
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function recordPaymentRefund(...args: Parameters<typeof recordPaymentRefundOrThrow>) {
  return guard(() => recordPaymentRefundOrThrow(...args));
}

async function recordPaymentRefundOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You must be signed in.");

  const organizationId = String(formData.get("organizationId") || "").trim();
  const rentalId = String(formData.get("rentalId") || "").trim();
  const amount = Number(String(formData.get("amount") || "0").replace(/,/g, ""));
  const notes = String(formData.get("notes") || "").trim();

  if (!organizationId || !rentalId) throw new Error("Missing required fields.");
  if (amount <= 0) throw new Error("Enter a refund amount greater than zero.");
  if (!canDecideMoney((await getCurrentMembership())?.role)) throw new Error(await said("Only the owner or a manager can refund a payment. Ask them to decide."));

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, vehicle_id, customer_id, currency, organization_id")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) throw new Error(rentalError?.message || "Booking not found.");

  enterBusinessTimeZone(await ensureMembership(supabase, organizationId, user.id));

  // Refunding part of one payment from its row on the booking: never more than that payment, less what was
  // already given back from it (real-user test, 8 Nov 2026).
  const paymentId = String(formData.get("paymentId") || "").trim();
  if (paymentId) {
    const { data: payment } = await supabase
      .from("rental_payments")
      .select("id, amount, status, metadata")
      .eq("id", paymentId)
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!payment || payment.status !== "paid") throw new Error(await said("Only a payment that has been received can be refunded."));
    if (payment.metadata?.type === "deposit" || payment.metadata?.is_deposit === true) throw new Error(await said("Give the deposit back with Return deposit."));
    const { data: earlier } = await supabase
      .from("transactions")
      .select("amount, voided, metadata")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .eq("type", "refund")
      .eq("metadata->>refund_of_payment", paymentId);
    const before = ((earlier || []) as any[]).filter((row) => !row.voided && !row.metadata?.voided).reduce((sum, row) => sum + Math.abs(Number(row.amount || 0)), 0);
    const left = Math.round((Number(payment.amount || 0) - before) * 100) / 100;
    if (amount > left + 0.005) {
      throw new Error(await said(`The most you can refund from this payment is ${niceMoney(Math.max(0, left), rental.currency)}.`));
    }
  }

  // Never more than was paid for this booking, less what has already been given back: nothing stopped a refund
  // bigger than the rent taken, or the same refund being recorded twice (the form offered the full amount again).
  {
    const { data: moneyRows, error: moneyError } = await supabase
      .from("transactions")
      .select("type, amount, is_deposit, voided, metadata")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .in("type", ["rental_income", "refund"]);
    if (moneyError) throw new Error(moneyError.message);
    const live = (moneyRows || []).filter((row: any) => !row.voided && !row.metadata?.voided && !row.is_deposit);
    const paidIn = live.filter((row: any) => row.type === "rental_income").reduce((sum: number, row: any) => sum + Math.abs(Number(row.amount || 0)), 0);
    const givenBack = live.filter((row: any) => row.type === "refund").reduce((sum: number, row: any) => sum + Math.abs(Number(row.amount || 0)), 0);
    const refundable = Math.round((paidIn - givenBack) * 100) / 100;
    if (amount > refundable + 0.005) {
      throw new Error(await said(`The most you can refund is ${niceMoney(Math.max(0, refundable), rental.currency)} (paid for this booking, less refunds already made).`));
    }
  }

  const { error } = await supabase
    .from("transactions")
    .insert({
      organization_id: organizationId,
      vehicle_id: rental.vehicle_id,
      rental_id: rentalId,
      customer_id: rental.customer_id,
      type: "refund",
      amount: -Math.abs(amount),
      currency: rental.currency || "THB",
      transaction_date: businessToday(),
      notes: notes || "Payment refund",
      metadata: {
        description: "Payment refund",
        notes,
        created_by_operator: true,
        ...(paymentId ? { refund_of_payment: paymentId } : {}),
        ...(["cash", "bank_transfer", "promptpay"].includes(String(formData.get("paymentMethod") || "")) ? { payment_method: String(formData.get("paymentMethod")) } : {})
      },
      is_deposit: false,
      created_by: user.id
    });

  if (error) throw new Error(error.message);

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: rental.vehicle_id,
    rental_id: rentalId,
    customer_id: rental.customer_id,
    event_type: "payment_refunded",
    title: "Payment refunded",
    detail: `Refund of ${niceMoney(amount, rental.currency)} recorded.${notes ? ` Notes: ${notes}` : ""}`
  });
  {
    const admin = createSupabaseAdminClient() as any;
    await completeRentalJobs(admin, rentalId, "refund", `Refund of ${niceMoney(amount, rental.currency)} recorded`);
    // The early-return suggestion has been dealt with; stop showing it.
    const { data: flagged } = await admin.from("rental_payments").select("id, metadata").eq("rental_id", rentalId).not("metadata->early_return", "is", null);
    for (const row of flagged || []) {
      await admin.from("rental_payments").update({ metadata: { ...(row.metadata || {}), early_return: { ...(row.metadata?.early_return || {}), settled: true } } }).eq("id", row.id);
    }
    // Refunding the net figure (unused days minus what was owed) settles the balance too:
    // the money was taken off the refund, so those payments are not chased again.
    const suggestion = (flagged || []).map((row: any) => row.metadata?.early_return).find((item: any) => item && Number(item.owed || 0) > 0);
    if (suggestion && amount + Number(suggestion.owed) <= Number(suggestion.amount) + 1) {
      const { data: open } = await admin
        .from("rental_payments")
        .select("id, amount, metadata")
        .eq("rental_id", rentalId)
        .in("status", ["pending", "overdue", "scheduled"])
        .is("deleted_at", null);
      let left = Number(suggestion.owed);
      for (const row of open || []) {
        if (left <= 0) break;
        const value = Number(row.amount || 0);
        if (value > left + 1) continue;
        left -= value;
        await admin
          .from("rental_payments")
          .update({ status: "paid", paid_at: new Date().toISOString(), metadata: { ...(row.metadata || {}), settled_against_refund: true, description: `${row.metadata?.description || ""}${row.metadata?.description ? " - " : ""}settled against the refund of unused days` } })
          .eq("id", row.id);
      }
    }
    // A "still to pay" message waiting to go out is out of date once the refund settles things.
    await tellRentalCustomer(admin, rentalId, ({ say, money }) => say("refunded", { amount: money(amount) }), { sentBy: user.id, withLink: false, replacesEarlier: true });
  }
  revalidatePath("/tasks");

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function undoCancellation(...args: Parameters<typeof undoCancellationOrThrow>) {
  return guard(() => undoCancellationOrThrow(...args));
}

async function undoCancellationOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const organizationId = String(formData.get("organizationId") || "").trim();
  const rentalId       = String(formData.get("rentalId") || "").trim();
  const vehicleId      = String(formData.get("vehicleId") || "").trim();

  if (!organizationId || !rentalId) throw new Error("Missing required fields.");

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, status, reference, display_code, delivery_datetime, mileage_at_delivery, cancelled_at")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) throw new Error(rentalError?.message || "Booking not found.");
  if (rental.status !== "cancelled") throw new Error("This booking is not canceled.");

  enterBusinessTimeZone(await ensureMembership(supabase, organizationId, user.id));

  const resolvedVehicleId = vehicleId || rental.vehicle_id;
  // Back on rent only if the vehicle really went out (a handover form, a reading at handover, or "handed over
  // without the form"). A delivery time on the booking is only a plan: restoring that as "on rent" made money
  // owed on a car that never left.
  const [{ data: handoverForm }, { data: handedWithoutForm }, { data: links }] = await Promise.all([
    supabase.from("inspections").select("id").eq("rental_id", rentalId).eq("organization_id", organizationId).eq("inspection_type", "delivery").limit(1),
    supabase.from("activity_events").select("id").eq("rental_id", rentalId).eq("organization_id", organizationId).eq("event_type", "handed_over_without_form").limit(1),
    supabase.from("booking_links").select("id, contract_signed_at, customer_details_submitted_at, viewed_at, sent_at, hold_released_at").eq("organization_id", organizationId).eq("rental_id", rentalId).eq("status", "cancelled")
  ]);
  const wentOut = rental.mileage_at_delivery != null || (handoverForm || []).length > 0 || (handedWithoutForm || []).length > 0;
  // An unsigned booking whose hold had already run out was a draft before it was cancelled, and goes back to one.
  const wasLapsedDraft = !wentOut && (links || []).some((link: any) => link.hold_released_at && !link.contract_signed_at);
  const restoreStatus = wentOut ? "active" : wasLapsedDraft ? "draft" : "booked";
  const today = businessToday();
  // The link goes back to where the customer had got to, not straight to "completed" (which showed
  // "Customer signed" on a booking nobody had signed).
  const linkStatusOf = (link: any) => (link.contract_signed_at ? "completed" : link.customer_details_submitted_at ? "details_submitted" : link.viewed_at ? "viewed" : link.sent_at ? "sent" : "pending");

  const ops: Promise<any>[] = [
    // Restore rental status and clear cancellation fields
    supabase
      .from("rentals")
      .update({
        status: restoreStatus,
        cancellation_reason: null,
        cancellation_notes: null,
        cancellation_refund_option: null,
        cancelled_at: null,
        cancelled_by: null,
      })
      .eq("id", rentalId)
      .eq("organization_id", organizationId),

    // Restore each booking link to its own stage
    ...(links || []).map((link: any) =>
      supabase.from("booking_links").update({ status: linkStatusOf(link), cancelled_at: null }).eq("id", link.id).eq("organization_id", organizationId)
    ),

    // Restore future cancelled payments to scheduled
    supabase
      .from("rental_payments")
      .update({ status: "scheduled" })
      .eq("rental_id", rentalId)
      .eq("organization_id", organizationId)
      .eq("status", "cancelled")
      .gte("scheduled_date", today),

  ];

  const results = await Promise.all(ops);
  const firstError = results.find((r: any) => r?.error)?.error;
  if (firstError) throw new Error(firstError.message);

  // On rent, reserved or free: whatever this vehicle's bookings now say.
  if (resolvedVehicleId) await syncVehicleStatusFromBookings(supabase, organizationId, resolvedVehicleId).catch(() => null);
  {
    const admin = createSupabaseAdminClient() as any;
    // "Your booking is back on, sorry for any confusion" only makes sense if the customer heard it was cancelled.
    // If the cancellation note never went out, it is simply dropped and nothing is said.
    const { data: toldCancelled } = rental.cancelled_at
      ? await admin
          .from("communication_log")
          .select("id")
          .eq("organisation_id", organizationId)
          .eq("rental_id", rentalId)
          .eq("type", "automated_reminder")
          .in("status", ["sent", "delivered", "read"])
          .gte("created_at", rental.cancelled_at)
          .limit(1)
      : { data: [{ id: "unknown" }] };
    if ((toldCancelled || []).length > 0) {
      await tellRentalCustomer(admin, rentalId, ({ say }) => say("bookingRestored"), { sentBy: user.id, withLink: true, replacesEarlier: true });
    } else {
      await retireUnsent(admin, organizationId, rentalId).catch(() => null);
    }
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: resolvedVehicleId || rental.vehicle_id,
    rental_id: rentalId,
    customer_id: rental.customer_id,
    event_type: "booking_restored",
    title: "Cancellation undone",
    detail: `${bookingReference(rental)} cancellation reversed — restored to ${restoreStatus}.`,
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
  if (resolvedVehicleId) revalidatePath(`/fleet/${resolvedVehicleId}`);
}


type ConfirmReceiptInput = {
  /** The payment the receipt was sent for. */
  paymentId: string;
  /** What actually arrived. */
  amount: number;
  date: string;
  method: string;
  /** Every payment this money is for (the one above is always included). */
  paymentIds?: string[];
  /** Send the customer the short "payment received" message. On unless the person recording it unticks the box. */
  tellCustomer?: boolean;
};

async function openPaymentsForRental(supabase: any, organizationId: string, rentalId: string) {
  const { data, error } = await supabase
    .from("rental_payments")
    .select("id, amount, due_date, status, voided, metadata")
    .eq("organization_id", organizationId)
    .eq("rental_id", rentalId)
    .is("deleted_at", null)
    .not("status", "in", "(paid,voided,waived,cancelled)")
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data || []) as any[]).filter((row) => row.voided !== true && String(row.metadata?.voided || "") !== "true");
}

/**
 * Records money a customer sent, however it lines up with the schedule: the
 * exact amount, less (the rest stays due), more (the extra goes to the next
 * payment), or one transfer for several payments such as rent plus deposit.
 * The receipt is kept on every payment it settles.
 */
/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function confirmReceiptPayment(...args: Parameters<typeof confirmReceiptPaymentOrThrow>) {
  return guard(() => confirmReceiptPaymentOrThrow(...args));
}

async function confirmReceiptPaymentOrThrow(input: ConfirmReceiptInput) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const amount = amountFromParam(input.amount);
  if (amount <= 0) throw new Error("Enter the amount received.");

  const { data: primary, error } = await supabase
    .from("rental_payments")
    .select("id, organization_id, rental_id, metadata")
    .eq("id", String(input.paymentId || "").trim())
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !primary) throw new Error(error?.message || "Payment was not found.");
  enterBusinessTimeZone(await ensureMembership(supabase, primary.organization_id, user.id));

  const receipt = primary.metadata?.receipt?.path ? primary.metadata.receipt : null;
  const open = await openPaymentsForRental(supabase, primary.organization_id, primary.rental_id);
  if (!open.some((row) => row.id === primary.id)) throw new Error("This payment is already settled.");

  const wanted = new Set<string>([primary.id, ...(input.paymentIds || []).map(String)]);
  const asOpenPayment = (row: any): OpenPayment => ({
    id: row.id,
    label: customerPaymentLabel(row.metadata),
    amount: Number(row.amount || 0),
    dueDate: String(row.due_date || "").slice(0, 10)
  });
  const chosen = open.filter((row) => wanted.has(row.id)).map(asOpenPayment);
  const others = open.filter((row) => !wanted.has(row.id)).map(asOpenPayment);
  const lines = allocatePayment(amount, chosen, others).filter((line) => line.paid > 0);
  const split = lines.length > 1;
  const settled = new Set(lines.map((line) => line.id));

  for (const line of lines) {
    const row = open.find((item) => item.id === line.id);
    if (receipt && row?.metadata?.receipt?.path !== receipt.path) {
      await supabase
        .from("rental_payments")
        .update({ metadata: { ...(row?.metadata || {}), receipt } })
        .eq("id", line.id)
        .eq("organization_id", primary.organization_id);
    }
    const notes = [
      receipt ? "Receipt checked" : null,
      split ? `Part of one payment of ${niceMoney(amount)}` : null,
      line.extra > 0 ? `Includes ${niceMoney(line.extra)} more than was due` : null
    ].filter(Boolean);
    await recordPaymentReceived(line.id, { amount: line.paid, date: input.date, method: input.method, note: notes.join(". ") || null });
  }

  // Payments the receipt was meant for but the money didn't reach stay due, without the receipt.
  if (receipt) {
    for (const row of open) {
      if (settled.has(row.id) || row.metadata?.receipt?.path !== receipt.path) continue;
      const { receipt: _receipt, ...rest } = row.metadata || {};
      await supabase.from("rental_payments").update({ metadata: rest }).eq("id", row.id).eq("organization_id", primary.organization_id);
    }
  }

  if (input.tellCustomer !== false) {
    const stillDue = lines.reduce((sum, line) => sum + line.stillDue, 0);
    await tellRentalCustomer(createSupabaseAdminClient() as any, primary.rental_id, ({ say, t, money }) =>
      `${say("paymentReceived", { amount: money(amount) })}${stillDue > 0 ? ` ${t("stillToPay", { amount: money(stillDue) })}` : ""}`,
      { sentBy: user.id }
    );
  }

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath(`/bookings/${primary.rental_id}`);
  return { success: true, lines };
}

/**
 * The receipt a customer sent doesn't match money received. Every payment it
 * was sent for stays due, and the customer's booking page asks them to get in
 * touch or send it again.
 */
/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function declinePaymentReceipt(...args: Parameters<typeof declinePaymentReceiptOrThrow>) {
  return guard(() => declinePaymentReceiptOrThrow(...args));
}

async function declinePaymentReceiptOrThrow(paymentId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const { data: payment, error } = await supabase
    .from("rental_payments")
    .select("id, organization_id, rental_id, customer_id, vehicle_id, amount, metadata")
    .eq("id", String(paymentId || "").trim())
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !payment) throw new Error(error?.message || "Payment was not found.");

  enterBusinessTimeZone(await ensureMembership(supabase, payment.organization_id, user.id));

  const path = payment.metadata?.receipt?.path;
  if (!path) return { success: true };

  const declinedAt = new Date().toISOString();
  const open = await openPaymentsForRental(supabase, payment.organization_id, payment.rental_id);
  for (const row of open) {
    if (row.metadata?.receipt?.path !== path) continue;
    const { receipt: _receipt, ...rest } = row.metadata || {};
    const { error: updateError } = await supabase
      .from("rental_payments")
      .update({ metadata: { ...rest, receipt_declined_at: declinedAt, receipt_declined_path: path } })
      .eq("id", row.id)
      .eq("organization_id", payment.organization_id);
    if (updateError) throw new Error(updateError.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: payment.organization_id,
    actor_id: user.id,
    entity_type: "payment",
    entity_id: payment.id,
    vehicle_id: payment.vehicle_id || null,
    rental_id: payment.rental_id,
    customer_id: payment.customer_id || null,
    event_type: "payment_receipt_declined",
    title: "Receipt not accepted",
    detail: "The receipt the customer sent did not match a payment received."
  });
  await tellRentalCustomer(createSupabaseAdminClient() as any, payment.rental_id, ({ say }) => say("receiptNotMatched"),
    { sentBy: user.id }
  );

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath(`/bookings/${payment.rental_id}`);
  return { success: true };
}

/** Gives a customer more time: the hold on their booking restarts from now. */
export async function extendBookingHold(rentalId: string): Promise<{ success: boolean; error?: string }> {
  const membership = await getCurrentMembership();
  if (!membership) return { success: false, error: await said("Please sign in again.") };
  const admin = createSupabaseAdminClient() as any;
  const [{ data: link }, { data: organization }, { data: rental }] = await Promise.all([
    admin.from("booking_links").select("id, status, hold_released_at").eq("rental_id", String(rentalId || "")).eq("organization_id", membership.organizationId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("organizations").select("settings").eq("id", membership.organizationId).maybeSingle(),
    admin.from("rentals").select("status").eq("id", String(rentalId || "")).eq("organization_id", membership.organizationId).maybeSingle()
  ]);
  if (!link) return { success: false, error: await said("This booking has no booking link.") };
  if (["completed", "cancelled"].includes(String(link.status))) return { success: false, error: await said("This booking no longer needs a hold.") };
  // The dates were opened up (the hold ran out, or the booking is sitting as a draft for any other reason):
  // take them back if they are still free. A new deadline alone would leave the booking a draft, blocking nothing.
  if (link.hold_released_at || rental?.status === "draft") {
    const retaken = await retakeHold(admin, { id: link.id, rental_id: rentalId });
    if (!retaken) return { success: false, error: await said("Those dates have since been booked by someone else.") };
  } else {
    await admin.from("booking_links").update({ hold_until: holdDeadline(bookingRules(organization?.settings).holdHours) }).eq("id", link.id);
  }
  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
  return { success: true };
}

/**
 * Before the handover, nothing has started: new dates simply replace the old ones and the rent is worked out again
 * from them (no "extension" on a rental that hasn't begun). Only while nothing has been paid and the customer
 * hasn't signed; after that the change goes through an amendment the customer signs.
 */
/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function rescheduleBooking(...args: Parameters<typeof rescheduleBookingOrThrow>) {
  return guard(() => rescheduleBookingOrThrow(...args));
}

async function rescheduleBookingOrThrow(rentalId: string, startDate: string, endDate: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = (await createSupabaseServerClient()) as any;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: await said("You must be signed in.") };

    const start = dateOnly(startDate);
    const end = dateOnly(endDate);
    if (!start || !end) return { ok: false, error: await said("Choose the start and return dates.") };
    if (end < start) return { ok: false, error: await said("The return date must be after the start date.") };
    if (start < businessToday()) return { ok: false, error: await said("The start date can't be in the past.") };

    const { data: rental } = await supabase
      .from("rentals")
      .select("id, organization_id, vehicle_id, customer_id, status, start_date, end_date, rental_rate, deposit_amount, billing_interval, pricing_model, delivery_datetime")
      .eq("id", rentalId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!rental) return { ok: false, error: await said("Rental not found.") };
    enterBusinessTimeZone(await ensureMembership(supabase, rental.organization_id, user.id));
    if (String(rental.status) !== "booked") return { ok: false, error: await said("This rental has already started. Use Extend or end early instead.") };

    const { data: links } = await supabase.from("booking_links").select("contract_signed_at").eq("rental_id", rental.id).is("deleted_at", null);
    if ((links || []).some((link: any) => link.contract_signed_at)) return { ok: false, error: await said("The customer has signed for these dates. Send them the change to sign instead.") };

    const { data: payments } = await supabase.from("rental_payments").select("id, status, transaction_id").eq("rental_id", rental.id).is("deleted_at", null);
    if ((payments || []).some((payment: any) => payment.status === "paid" || payment.transaction_id)) return { ok: false, error: await said("Some of this booking is already paid. Use Extend or end early instead.") };

    if (rental.vehicle_id) {
      const conflict = await vehicleConflictMessage(supabase, { organizationId: rental.organization_id, vehicleId: rental.vehicle_id, startDate: start, endDate: end, excludeRentalId: rental.id });
      if (conflict) return { ok: false, error: await said(conflict) };
    }

    // A handover time on the old start day moves with it; one already agreed for another day stays.
    const oldStart = dateOnly(rental.start_date);
    const delivery = rental.delivery_datetime ? String(rental.delivery_datetime) : null;
    const update: Record<string, unknown> = { start_date: start, end_date: end };
    if (delivery && delivery.slice(0, 10) === oldStart) update.delivery_datetime = start + delivery.slice(10);

    const { error: updateError } = await supabase.from("rentals").update(update).eq("id", rental.id).eq("organization_id", rental.organization_id);
    if (updateError) return { ok: false, error: await said(isDoubleBookingError(updateError) ? DOUBLE_BOOKING_MESSAGE : updateError.message) };

    // The rent (and deposit) still to pay, worked out again from the new dates. A booking whose customer hasn't
    // finished the link has no schedule yet: it is made when they do, from these dates.
    const period = String(rental.billing_interval || rental.pricing_model || "monthly").toLowerCase();
    if (!(payments || []).length) {
      if (period.startsWith("da") && Number(rental.rental_rate || 0) > 0) {
        const days = Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000));
        await supabase.from("rentals").update({ balance_due: Number(rental.rental_rate) * days + Number(rental.deposit_amount || 0) }).eq("id", rental.id);
      }
    } else if (rental.customer_id && Number(rental.rental_rate || 0) > 0) {
      await supabase.from("rental_payments").delete().eq("organization_id", rental.organization_id).eq("rental_id", rental.id).in("status", ["scheduled", "pending", "overdue"]).is("transaction_id", null);
      await generatePaymentSchedule({
        supabase,
        organisationId: rental.organization_id,
        rentalId: rental.id,
        rentalRate: Number(rental.rental_rate || 0),
        depositAmount: Number(rental.deposit_amount || 0),
        deliveryDate: start,
        endDate: end,
        billingPeriod: rental.billing_interval || rental.pricing_model || "monthly",
        upfrontPeriods: 0
      });
      const { data: open } = await supabase.from("rental_payments").select("amount, metadata").eq("rental_id", rental.id).in("status", ["scheduled", "pending", "overdue"]).is("deleted_at", null);
      const owed = (open || []).filter((row: any) => !(row.metadata?.is_deposit === true || row.metadata?.type === "deposit")).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
      await supabase.from("rentals").update({ balance_due: owed }).eq("id", rental.id);
    }

    await recordActivityEvent(supabase, {
      organization_id: rental.organization_id,
      actor_id: user.id,
      entity_type: "rental",
      entity_id: rental.id,
      vehicle_id: rental.vehicle_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      event_type: "rental_rescheduled",
      title: "Booking dates changed",
      detail: `${oldStart} to ${dateOnly(rental.end_date) || "open"} changed to ${start} to ${end}`
    }).catch(() => null);

    await syncVehicleStatusFromBookings(supabase, rental.organization_id, rental.vehicle_id).catch(() => null);
    revalidatePath(`/bookings/${rental.id}`);
    revalidatePath("/bookings");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: await userError(error, "Couldn't change the dates.") };
  }
}
