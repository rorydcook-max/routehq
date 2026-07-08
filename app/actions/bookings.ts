"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { markOnboardingStep } from "@/lib/onboarding";
import { activateRental } from "@/lib/rental-activation";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyOperator } from "@/lib/notify-operator";

function requiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  if (!value) {
    throw new Error(`${key} is required.`);
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

function normalizeThaiWhatsapp(phone: string | null | undefined) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("66")) {
    return digits;
  }
  if (digits.startsWith("0")) {
    return `66${digits.slice(1)}`;
  }
  return digits;
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
  const whatsappPhone = normalizeThaiWhatsapp(phone);
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
  const today = now.slice(0, 10);
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
    .update({ payment_due_trigger: "confirmed" })
    .eq("id", rental.id)
    .eq("organization_id", organizationId);
}

export async function createBooking(formData: FormData) {
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
  const upfrontPeriods = Math.max(0, numberFromForm(formData, "upfrontPeriods"));
  const upfrontRate = numberFromForm(formData, "upfrontRate");
  const upfrontTotal = numberFromForm(formData, "upfrontTotal");
  const createsActiveRental = bookingMode === "existing_rental" || walkInFastTrack;

  if (!["daily", "weekly", "monthly", "custom"].includes(pricingModel)) {
    throw new Error("Choose a valid billing period.");
  }
  if (!["THB", "USD", "IDR", "PHP", "MYR", "SGD", "VND", "AUD", "GBP", "EUR"].includes(currency)) {
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
  if (createsActiveRental && !customerId) {
    throw new Error(walkInFastTrack ? "Choose a customer before recording a walk-in rental." : "Choose a customer before recording an existing rental.");
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
    supabase.from("organizations").select("name").eq("id", organizationId).maybeSingle()
  ]);

  const { data: vehicle, error: vehicleError } = vehicleResult;
  const { data: organization, error: organizationError } = organizationResult;

  if (vehicleError || !vehicle) {
    throw new Error(vehicleError?.message || "Vehicle was not found.");
  }
  if (organizationError || !organization) {
    throw new Error(organizationError?.message || "Organization was not found.");
  }
  if (["rented", "maintenance", "inactive", "retired"].includes(vehicle.status)) {
    throw new Error("This vehicle is not available for a new booking.");
  }

  // Optional customer lookup
  let customer: { full_name: string; phone: string | null; nationality: string | null; document_status: string | null } | null = null;
  if (customerId) {
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("full_name, phone, nationality, document_status")
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

  const rentalInsert: Record<string, any> = {
    organization_id: organizationId,
    customer_id: customerId || null,
    vehicle_id: vehicleId,
    start_date: startDate,
    end_date: endDate,
    is_indefinite: openEnded,
    status: createsActiveRental ? "active" : "booked",
    pricing_model: pricingModel,
    recurring_billing: pricingModel === "monthly",
    billing_interval: pricingModel,
    rental_rate: rentalRate,
    deposit_amount: depositAmount,
    balance_due: walkInFastTrack ? Math.max(0, rentalRate - (walkInPaymentAmount || 0)) : rentalRate + depositAmount,
    currency,
    delivery_method: deliveryMethod,
    delivery_location: bookingData.delivery_location,
    delivery_datetime: bookingData.delivery_datetime,
    return_location: null,
    created_by: user.id
  };
  if (createsActiveRental) {
    rentalInsert.entered_by_operator = true;
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .insert(rentalInsert)
    .select("id, display_code, reference")
    .single();

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Unable to create booking.");
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

    if (walkInFastTrack) {
      try {
        await createWalkInPaymentRecords({
          supabase,
          rental,
          organizationId,
          vehicleId,
          customerId: customerId!,
          userId: user.id,
          currency,
          paymentAmount: walkInPaymentAmount || rentalRate,
          depositAmount: walkInDepositAmount || depositAmount,
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
      detail: customer
        ? `${bookingReference(rental)} was recorded as ${walkInFastTrack ? "a walk-in rental" : "an existing active rental"} for ${customer.full_name} and ${vehicle.registration_number}.`
        : `${bookingReference(rental)} was recorded as ${walkInFastTrack ? "a walk-in rental" : "an existing active rental"} for ${vehicle.registration_number}.`
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
      message: walkInFastTrack ? `Walk-in rental recorded. Payment of ${walkInPaymentAmount || rentalRate} collected.` : "Existing rental recorded.",
      whatsappUrl: "",
      lineUrl: "",
      smsUrl: "",
      emailUrl: ""
    };
  }

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
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: user.id
    })
    .select("id, token")
    .single();

  if (linkError || !bookingLink) {
    throw new Error(linkError?.message || "Unable to generate booking link.");
  }

  const bookingUrl = `${baseUrl}/book/${bookingLink.token}`;

  const [{ error: linkUpdateError }, { error: contractUpdateError }, { error: rentalUpdateError }, { error: vehicleUpdateError }] = await Promise.all([
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
    supabase
      .from("rentals")
      .update({ contract_id: contract.id })
      .eq("id", rental.id)
      .eq("organization_id", organizationId),
    supabase
      .from("vehicles")
      .update({
        status: "reserved",
        availability_status: "reserved",
        current_customer_id: customerId || null,
        current_rental_id: rental.id
      })
      .eq("id", vehicleId)
      .eq("organization_id", organizationId)
  ]);

  const updateError = linkUpdateError || contractUpdateError || rentalUpdateError || vehicleUpdateError;
  if (updateError) {
    throw new Error(updateError.message);
  }

  const vehicleLabel = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const message = customer
    ? `Hello ${customer.full_name},\n\nHere is your booking link for your ${vehicleLabel} rental:\n${bookingUrl}\n\nPlease complete your details and sign the rental agreement through the link.\n\n${organization.name}`
    : `Here is the booking link for the ${vehicleLabel} rental:\n${bookingUrl}\n\nPlease complete your details and sign the rental agreement through the link.\n\n${organization.name}`;
  const urls = shareUrls({ message, phone: customer?.phone, organizationName: organization.name });

  await recordActivityEvent(supabase, {
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
  });
  await markOnboardingStep(supabase, organizationId, "first_booking");

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath(`/fleet/${vehicleId}`);

  const vLabel = [vehicle.make, vehicle.model].filter(Boolean).join(" ");
  const customerLabel = customer ? customer.full_name : "Unknown customer";
  notifyOperator(
    organizationId,
    `📋 New booking created for ${customerLabel} — ${vLabel}. Booking link sent.`,
    "operator_notification"
  ).catch(() => null);

  return {
    rentalId: rental.id as string,
    bookingUrl,
    message,
    ...urls
  };
}

export async function assignCustomerToBooking(formData: FormData) {
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
      .select("id, vehicle_id, contract_id, display_code, reference")
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

export async function resendBookingLink(formData: FormData) {
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

  const [{ data: rental, error: rentalError }, { data: organization, error: organizationError }] = await Promise.all([
    supabase
      .from("rentals")
      .select("*, vehicles!rentals_vehicle_id_fkey(make, model, registration_number), customers!rentals_customer_id_fkey(full_name, phone)")
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

  const { data: bookingLink, error: linkError } = await supabase
    .from("booking_links")
    .select("id, token, public_url")
    .eq("organization_id", organizationId)
    .eq("rental_id", rentalId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkError || !bookingLink) {
    throw new Error(linkError?.message || "Booking link was not found.");
  }

  const bookingUrl = bookingLink.public_url || `${baseUrl}/book/${bookingLink.token}`;
  const { error: updateError } = await supabase
    .from("booking_links")
    .update({
      public_url: bookingUrl,
      status: "sent",
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    })
    .eq("id", bookingLink.id)
    .eq("organization_id", organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const vehicleLabel = [rental.vehicles?.make, rental.vehicles?.model].filter(Boolean).join(" ");
  const customerName = rental.customers?.full_name || "there";
  const message = `Hello ${customerName},\n\nHere is your booking link for your ${vehicleLabel} rental:\n${bookingUrl}\n\nPlease complete your details and sign the rental agreement through the link.\n\n${organization.name}`;
  const urls = shareUrls({ message, phone: rental.customers?.phone, organizationName: organization.name });

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: rental.vehicle_id,
    rental_id: rentalId,
    customer_id: rental.customer_id,
    event_type: "booking_link_resent",
    title: "Booking link resent",
    detail: `Booking link resent for ${bookingReference(rental)}.`
  });

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);

  return {
    bookingUrl,
    message,
    ...urls
  };
}

export async function cancelBooking(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be signed in.");
  }

  const organizationId = requiredString(formData, "organizationId");
  const rentalId = requiredString(formData, "rentalId");

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, display_code, reference, vehicle_id, customer_id, status")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Booking was not found.");
  }

  if (["completed", "cancelled"].includes(rental.status)) {
    throw new Error("This booking cannot be cancelled from its current status.");
  }

  const now = new Date().toISOString();
  const [{ error: rentalUpdateError }, { error: linkUpdateError }, { error: vehicleUpdateError }] = await Promise.all([
    supabase.from("rentals").update({ status: "cancelled" }).eq("id", rentalId).eq("organization_id", organizationId),
    supabase
      .from("booking_links")
      .update({ status: "cancelled", cancelled_at: now })
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId),
    supabase
      .from("vehicles")
      .update({
        status: "available",
        availability_status: "available_now",
        current_customer_id: null,
        current_rental_id: null
      })
      .eq("id", rental.vehicle_id)
      .eq("organization_id", organizationId)
      .eq("current_rental_id", rentalId)
  ]);

  const updateError = rentalUpdateError || linkUpdateError || vehicleUpdateError;
  if (updateError) {
    throw new Error(updateError.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: rental.vehicle_id,
    rental_id: rentalId,
    customer_id: rental.customer_id,
    event_type: "booking_cancelled",
    title: "Booking cancelled",
    detail: `${bookingReference(rental)} was cancelled.`
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath(`/fleet/${rental.vehicle_id}`);
}

export async function deleteBooking(rentalId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "You must be signed in." };

  const cleanId = String(rentalId || "").trim();
  if (!cleanId) return { success: false, error: "Booking ID is required." };

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, vehicle_id, customer_id, organization_id, status")
    .eq("id", cleanId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) return { success: false, error: rentalError?.message || "Booking not found." };

  await ensureMembership(supabase, rental.organization_id, user.id);

  // Null out receipt FKs before deleting transactions
  const { data: txIds } = await supabase
    .from("transactions")
    .select("id")
    .eq("rental_id", cleanId)
    .eq("organization_id", rental.organization_id);

  if (txIds?.length) {
    const ids = txIds.map((t: any) => t.id);
    await supabase.from("receipts").update({ transaction_id: null }).in("transaction_id", ids);
    await supabase.from("rental_payments").update({ transaction_id: null }).in("transaction_id", ids);
  }

  // receipts.rental_id has no ON DELETE SET NULL, so detach receipts before deleting the rental.
  await supabase
    .from("receipts")
    .update({ rental_id: null })
    .eq("rental_id", cleanId)
    .eq("organisation_id", rental.organization_id);

  await Promise.allSettled([
    supabase.from("rental_payments").delete().eq("rental_id", cleanId).eq("organization_id", rental.organization_id),
    supabase.from("transactions").delete().eq("rental_id", cleanId).eq("organization_id", rental.organization_id),
    supabase.from("inspections").delete().eq("rental_id", cleanId).eq("organization_id", rental.organization_id),
    supabase.from("booking_links").delete().eq("rental_id", cleanId).eq("organization_id", rental.organization_id),
    supabase.from("contracts").delete().eq("rental_id", cleanId).eq("organization_id", rental.organization_id),
    supabase.from("activity_events").delete().eq("rental_id", cleanId).eq("organization_id", rental.organization_id),
    supabase.from("communication_log").delete().eq("rental_id", cleanId).eq("organisation_id", rental.organization_id),
  ]);

  const { error: deleteError } = await supabase
    .from("rentals")
    .delete()
    .eq("id", cleanId)
    .eq("organization_id", rental.organization_id);

  if (deleteError) return { success: false, error: deleteError.message };

  // Free up the vehicle if it was assigned to this rental
  await supabase
    .from("vehicles")
    .update({ status: "available", availability_status: "available_now", current_customer_id: null, current_rental_id: null })
    .eq("id", rental.vehicle_id)
    .eq("organization_id", rental.organization_id)
    .eq("current_rental_id", cleanId);

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath("/fleet");
  if (rental.vehicle_id) revalidatePath(`/fleet/${rental.vehicle_id}`);

  return { success: true };
}

export async function manuallyActivateRental(rentalId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "You must be signed in." };

  const cleanId = String(rentalId || "").trim();
  if (!cleanId) return { success: false, error: "Rental ID is required." };

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id")
    .eq("id", cleanId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) return { success: false, error: rentalError?.message || "Rental not found." };

  await ensureMembership(supabase, rental.organization_id, user.id);

  // Also set the vehicle to rented if not already
  if (rental.vehicle_id) {
    await supabase
      .from("vehicles")
      .update({ status: "rented", availability_status: "rented", current_rental_id: cleanId, current_customer_id: rental.customer_id })
      .eq("id", rental.vehicle_id)
      .eq("organization_id", rental.organization_id);
  }

  await activateRental(cleanId, supabase);

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${cleanId}`);
  if (rental.vehicle_id) revalidatePath(`/fleet/${rental.vehicle_id}`);

  return { success: true };
}

function allStrings(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value || "").trim()).filter(Boolean);
}

function dateTimeOrNull(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").trim();
  return value || null;
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function formatChange(value: unknown) {
  if (value === null || value === undefined || value === "") return "blank";
  if (Array.isArray(value)) return value.join(", ") || "none";
  return String(value);
}

export async function updateBooking(formData: FormData) {
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
  const deliveryDateTime = dateTimeOrNull(formData, "deliveryDateTime");
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

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("*")
    .eq("id", rentalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Booking was not found.");
  }

  await ensureMembership(supabase, rental.organization_id, user.id);

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
  compare("Open ended", Boolean(rental.is_indefinite), openEnded);
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

  redirect(`/bookings/${rental.id}?updated=1`);
}

export async function addRentalPayment(formData: FormData) {
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

  await ensureMembership(supabase, rental.organization_id, user.id);

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

  const detail = `Payment row added: THB ${Math.round(amount).toLocaleString()} due ${dueDate} (${description}).`;
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

export async function setupExistingRentalPayments(formData: FormData) {
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

  await ensureMembership(supabase, rental.organization_id, user.id);

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
  return new Date().toISOString().slice(0, 10);
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
  if (!nextDueDate || (rental.end_date && nextDueDate > dateOnly(rental.end_date))) {
    return;
  }

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
    amount: Number(rental.rental_rate || payment.amount || 0),
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

export async function generatePaymentScheduleForRental(rentalId: string) {
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

  await ensureMembership(supabase, rental.organization_id, user.id);

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

  for (let periodIndex = 0; periodIndex < 12; periodIndex += 1) {
    const dueDate = addMonthsToDate(firstPaymentDate, periodIndex);
    if (!dueDate) continue;
    if (endDate && dueDate > endDate) break;
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

export async function matchPaymentsToTransactions(rentalId: string) {
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
    .select("id, organization_id, customer_id, vehicle_id, rental_rate")
    .eq("id", cleanRentalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) {
    throw new Error(rentalError?.message || "Rental was not found.");
  }

  await ensureMembership(supabase, rental.organization_id, user.id);

  const { data: payments, error: paymentsError } = await supabase
    .from("rental_payments")
    .select("id, amount, due_date, status, voided, metadata, transaction_id")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rental.id)
    .is("deleted_at", null)
    .is("transaction_id", null)
    .or("voided.is.null,voided.eq.false")
    .order("due_date", { ascending: true });

  if (paymentsError) {
    throw new Error(paymentsError.message);
  }

  const candidatePayments = (payments || []).filter((payment: any) => {
    const metadata = payment.metadata || {};
    const type = String(metadata.type || "rent").toLowerCase();
    const status = String(payment.status || "").toLowerCase();
    return !["voided", "cancelled", "refunded"].includes(status) && !metadata.voided && !["deposit", "deposit_received", "deposit_refunded"].includes(type);
  });

  const { data: allLinkedPayments } = await supabase
    .from("rental_payments")
    .select("transaction_id")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", rental.id)
    .is("deleted_at", null);

  const usedTransactionIds = new Set<string>(
    (allLinkedPayments || []).map((payment: any) => String(payment.transaction_id || "")).filter(Boolean)
  );

  const { data: transactions, error: transactionsError } = await supabase
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

  let matched = 0;

  for (const payment of candidatePayments) {
    const dueDate = dateOnly(payment.due_date);
    if (!dueDate) continue;

    const expectedAmount = Number(payment.amount || rental.rental_rate || 0);
    const matchedTransaction = findScheduleTransactionMatch({
      dueDate,
      amount: expectedAmount,
      transactions: transactions || [],
      usedTransactionIds
    });
    const transactionId = matchedTransaction?.id ? String(matchedTransaction.id) : "";
    if (!transactionId) continue;

    usedTransactionIds.add(transactionId);
    const metadata = payment.metadata || {};
    const { error: updateError } = await supabase
      .from("rental_payments")
      .update({
        status: "paid",
        paid_at: matchedTransaction.transaction_date ? new Date(matchedTransaction.transaction_date).toISOString() : new Date().toISOString(),
        transaction_id: transactionId,
        metadata: {
          ...metadata,
          auto_matched: true,
          matched_transaction_id: transactionId,
          matched_at: new Date().toISOString(),
          matched_by: user.id
        }
      })
      .eq("id", payment.id)
      .eq("organization_id", rental.organization_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    matched += 1;
  }

  const message = `Payment schedule matched - ${matched} linked to existing transactions`;
  if (matched > 0) {
    await recordActivityEvent(supabase, {
      organization_id: rental.organization_id,
      actor_id: user.id,
      entity_type: "rental",
      entity_id: rental.id,
      vehicle_id: rental.vehicle_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      event_type: "payment_schedule_matched",
      title: "Payment schedule matched",
      detail: message,
      metadata: {
        content: message,
        matched_count: matched
      }
    });
  }

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath(`/bookings/${rental.id}/edit`);
  revalidatePath("/calendar");

  return { success: true, matched, message };
}

export async function adjustRental(params: {
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

      const description = `Extension - ${originalEndDate || "open"} to ${cleanEndDate}`;
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

    const paymentSentence =
      extensionPaymentAmount > 0
        ? ` Extension payment THB ${Math.round(extensionPaymentAmount).toLocaleString()} due ${extensionPaymentDueDate}.`
        : " No extension payment recorded.";
    const detail = `Rental extended to ${cleanEndDate}.${paymentSentence}${cleanNote ? ` ${cleanNote}` : ""}`;

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
        title: `Rental extended to ${cleanEndDate}`,
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
    const completed = cleanEndDate <= nowDate;

    const { error: updateError } = await supabase
      .from("rentals")
      .update({
        end_date: cleanEndDate,
        ...(completed ? { status: "completed" } : {})
      })
      .eq("id", rental.id)
      .eq("organization_id", rental.organization_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Fetch future scheduled/pending payments past the new return date
    const { data: futurePayments, error: futurePaymentFetchError } = await supabase
      .from("rental_payments")
      .select("id")
      .eq("rental_id", rental.id)
      .eq("organization_id", rental.organization_id)
      .in("status", ["scheduled", "pending"])
      .gt("due_date", cleanEndDate)
      .or("voided.is.null,voided.eq.false");

    if (futurePaymentFetchError) {
      throw new Error(futurePaymentFetchError.message);
    }

    const futurePaymentIds = (futurePayments || []).map((p: any) => p.id);

    if (futurePaymentIds.length > 0) {
      // Delete associated payment reminder tasks first
      await supabase
        .from("tasks")
        .delete()
        .eq("organization_id", rental.organization_id)
        .in("rental_payment_id", futurePaymentIds);

      // Delete the payments themselves
      await supabase
        .from("rental_payments")
        .delete()
        .eq("rental_id", rental.id)
        .eq("organization_id", rental.organization_id)
        .in("id", futurePaymentIds);
    }

    // Belt-and-suspenders: delete any remaining payment reminder tasks past return date
    await supabase
      .from("tasks")
      .delete()
      .eq("organization_id", rental.organization_id)
      .eq("rental_id", rental.id)
      .eq("task_type", "payment_reminder")
      .gt("due_at", `${cleanEndDate}T23:59:59.999Z`);

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
        ? ` ${futurePaymentsDeleted} future payment ${futurePaymentsDeleted === 1 ? "record" : "records"} deleted.`
        : " No future payment records removed.";
    const detail = `Early return recorded - new end date ${cleanEndDate}. ${refundAmount > 0 ? `Refund of THB ${Math.round(refundAmount).toLocaleString()} issued.` : "No refund issued."}${voidedSentence}${refundReason ? ` ${refundReason}` : ""}${cleanNote ? ` ${cleanNote}` : ""}`;

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
        title: "Early return recorded",
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
}

export async function updateRentalEndDate(rentalId: string, newEndDate: string) {
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
    .select("id, organization_id, vehicle_id, customer_id, end_date")
    .eq("id", cleanRentalId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !rental) {
    throw new Error(error?.message || "Rental was not found.");
  }

  await ensureMembership(supabase, rental.organization_id, user.id);

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

export async function updateRentalPayment(paymentId: string, fields: RentalPaymentCorrection) {
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

  await ensureMembership(supabase, payment.organization_id, user.id);

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

  const detail = `Payment corrected: THB ${Math.round(oldAmount).toLocaleString()} -> THB ${Math.round(amount).toLocaleString()} (${description || oldDescription || "Scheduled payment"})`;
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

  if (!cleanPaymentId || amount <= 0) {
    throw new Error("Payment and amount are required.");
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

  await ensureMembership(supabase, payment.organization_id, user.id);

  const description = payment.metadata?.description || "Scheduled payment";
  const transactionNotes = `${description} - received via ${method}${note ? `. ${note}` : ""}`;
  const { error: transactionError } = await supabase.from("transactions").insert({
    organization_id: payment.organization_id,
    vehicle_id: payment.vehicle_id || null,
    rental_id: payment.rental_id,
    customer_id: payment.customer_id || null,
    rental_payment_id: payment.id,
    type: "rental_income",
    amount,
    currency: payment.currency || "THB",
    transaction_date: receivedDate,
    notes: transactionNotes,
    metadata: {
      source: "payment_schedule",
      payment_method: method,
      payment_description: description,
      note
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

  const { error: updateError } = await supabase
    .from("rental_payments")
    .update({
      status: "paid",
      paid_at: `${receivedDate}T00:00:00.000Z`,
      metadata
    })
    .eq("id", payment.id)
    .eq("organization_id", payment.organization_id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const detail = `Payment received: ${description} THB ${Math.round(amount).toLocaleString()} via ${method}`;
  await recordActivityEvent(supabase, {
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
  });

  await createNextMonthlyPaymentIfNeeded(supabase, payment);

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${payment.rental_id}`);
  revalidatePath("/calendar");

  return { success: true };
}

export async function deleteRentalPayment(paymentId: string) {
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
  await ensureMembership(supabase, orgId, user.id);

  // Clear the transaction link before deleting
  if (payment.transaction_id) {
    await supabase
      .from("rental_payments")
      .update({ transaction_id: null })
      .eq("id", payment.id)
      .eq("organization_id", orgId);
  }

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

export async function cleanupDepositPayments(rentalId: string) {
  "use server";
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in." };
  }

  const cleanRentalId = String(rentalId || "").trim();
  if (!cleanRentalId) {
    return { success: false, error: "Rental ID is required." };
  }

  const { data: rental } = await supabase
    .from("rentals")
    .select("id, organization_id, deposit_held")
    .eq("id", cleanRentalId)
    .maybeSingle();

  if (!rental) {
    return { success: false, error: "Rental not found." };
  }

  await ensureMembership(supabase, rental.organization_id, user.id);

  const { data: payments } = await supabase
    .from("rental_payments")
    .select("id, amount, status, voided, metadata")
    .eq("organization_id", rental.organization_id)
    .eq("rental_id", cleanRentalId)
    .is("deleted_at", null);

  const depositHeld = Number(rental.deposit_held || 0);
  const depositPaymentIds = (payments || [])
    .filter((p: any) => !p.voided && p.status !== "voided")
    .filter((p: any) =>
      p.metadata?.is_deposit === true ||
      p.metadata?.type === "deposit" ||
      (depositHeld > 0 && Number(p.amount) === depositHeld)
    )
    .map((p: any) => p.id);

  if (depositPaymentIds.length === 0) {
    return { success: true, voided: 0 };
  }

  const { error } = await supabase
    .from("rental_payments")
    .update({
      voided: true,
      status: "voided",
      metadata: { voided_reason: "Deposit tracked via deposit_held — payment record not needed", voided_at: new Date().toISOString(), voided_by: user.id }
    })
    .in("id", depositPaymentIds)
    .eq("organization_id", rental.organization_id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`/bookings/${cleanRentalId}`);
  revalidatePath(`/bookings/${cleanRentalId}/edit`);

  return { success: true, voided: depositPaymentIds.length };
}

export async function cancelBookingWithDisposition(formData: FormData) {
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
  const reasonLabel     = reasonRaw.split(",").map(r => r.replace(/_/g, " ")).join(" + ");
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
    throw new Error("This booking cannot be cancelled from its current status.");
  }

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const currency = rental.currency || "THB";
  const depositHeld = Number(rental.deposit_held || rental.deposit_amount || 0);

  const { data: paidTransactions } = await supabase
    .from("transactions")
    .select("id, amount, type")
    .eq("rental_id", rentalId)
    .eq("organization_id", organizationId)
    .eq("voided", false)
    .in("type", ["rental_income", "deposit_received"])
    .is("deleted_at", null);

  const totalPaidIncome = (paidTransactions || [])
    .filter((t: any) => t.type === "rental_income")
    .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

  const transactionsToInsert: any[] = [];

  if (refundOption) {
    const isFullRefund    = refundOption.startsWith("full_refund");
    const isPartialRefund = refundOption.startsWith("partial_refund");
    const returnDeposit   = refundOption.endsWith("deposit_returned");
    const retainDeposit   = refundOption.endsWith("deposit_retained");

    const refundAmount = isFullRefund
      ? totalPaidIncome
      : isPartialRefund
        ? partialRefund
        : 0;

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
          deposit_refunded_amount: refundOption.startsWith("partial_refund") && partialDeposit > 0
            ? partialDeposit
            : depositHeld,
          deposit_reconciled_at: now,
          deposit_reconciled_by: user.id,
          deposit_deduction_reason: notes || reason
        }
      : {}),
    ...(refundOption?.endsWith("deposit_retained") && depositHeld > 0
      ? {
          deposit_forfeited_amount: depositHeld,
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
    title: "Booking cancelled",
    detail: `${rental.reference || rental.display_code || rentalId} cancelled — ${reasonLabel}${refundLabel}.${notes ? ` Notes: ${notes}` : ""}`
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath(`/fleet/${vehicleId}`);

  return { success: true };
}

export async function recordPaymentRefund(formData: FormData) {
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

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, vehicle_id, customer_id, currency, organization_id")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) throw new Error(rentalError?.message || "Booking not found.");

  await ensureMembership(supabase, organizationId, user.id);

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
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: notes || "Payment refund",
      metadata: { description: "Payment refund", notes, created_by_operator: true },
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
    detail: `Refund of ${amount} ${rental.currency || "THB"} recorded.${notes ? ` Notes: ${notes}` : ""}`
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
}

export async function changeVehicle(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const rentalId             = String(formData.get("rentalId") || "").trim();
  const organizationId       = String(formData.get("organizationId") || "").trim();
  const replacementVehicleId = String(formData.get("replacementVehicleId") || "").trim();
  const reason               = String(formData.get("reason") || "").trim();
  const reasonNotes          = String(formData.get("reasonNotes") || "").trim() || null;
  const changedAt            = String(formData.get("changedAt") || "").trim() || new Date().toISOString();
  const disposition          = String(formData.get("originalVehicleDisposition") || "available").trim();
  const repairNotes          = String(formData.get("repairNotes") || "").trim() || null;
  const repairExpectedEnd    = String(formData.get("repairExpectedEnd") || "").trim() || null;
  const newRate              = formData.get("newRate") ? Number(formData.get("newRate")) : null;
  const keepRate             = String(formData.get("keepRate") || "true") === "true";

  if (!rentalId || !organizationId || !replacementVehicleId || !reason) {
    throw new Error("Missing required fields.");
  }

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, organization_id, vehicle_id, original_vehicle_id, customer_id, rental_rate, currency, status, reference, display_code")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) throw new Error(rentalError?.message || "Booking not found.");
  if (["completed", "cancelled"].includes(rental.status)) throw new Error("Cannot change vehicle on a completed or cancelled booking.");
  if (rental.vehicle_id === replacementVehicleId) throw new Error("Replacement vehicle is the same as the current vehicle.");

  const { data: replacement, error: replacementError } = await supabase
    .from("vehicles")
    .select("id, make, model, trim, year, registration_number, status, current_rental_id, monthly_rate")
    .eq("id", replacementVehicleId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (replacementError || !replacement) throw new Error("Replacement vehicle not found.");
  if (replacement.current_rental_id && replacement.current_rental_id !== rentalId) {
    throw new Error("This vehicle is currently assigned to another active rental.");
  }

  const originalVehicleId = rental.vehicle_id;
  const rateBefore = Number(rental.rental_rate || 0);
  const rateAfter = (!keepRate && newRate != null) ? newRate : rateBefore;

  const ops: Promise<any>[] = [
    // 1. Update rental: new vehicle + rate
    supabase
      .from("rentals")
      .update({
        vehicle_id: replacementVehicleId,
        original_vehicle_id: rental.original_vehicle_id || originalVehicleId,
        ...(rateAfter !== rateBefore ? { rental_rate: rateAfter } : {})
      })
      .eq("id", rentalId)
      .eq("organization_id", organizationId),

    // 2. Log the change
    supabase
      .from("vehicle_changes")
      .insert({
        organization_id: organizationId,
        rental_id: rentalId,
        from_vehicle_id: originalVehicleId,
        to_vehicle_id: replacementVehicleId,
        reason,
        reason_notes: reasonNotes,
        changed_at: changedAt,
        changed_by: user.id,
        original_vehicle_disposition: disposition,
        repair_notes: repairNotes,
        repair_expected_end: repairExpectedEnd || null,
        rate_before: rateBefore,
        rate_after: rateAfter
      }),

    // 3. Update replacement vehicle: assign to this rental
    supabase
      .from("vehicles")
      .update({
        status: "rented",
        availability_status: "rented",
        current_customer_id: rental.customer_id,
        current_rental_id: rentalId
      })
      .eq("id", replacementVehicleId)
      .eq("organization_id", organizationId),

    // 4. Update original vehicle status based on disposition
    supabase
      .from("vehicles")
      .update(
        disposition === "repair"
          ? {
              status: "maintenance",
              availability_status: "offline",
              current_customer_id: null,
              current_rental_id: null,
              repair_started_at: changedAt,
              repair_expected_end: repairExpectedEnd || null,
              repair_notes: repairNotes || null
            }
          : disposition === "available"
          ? {
              status: "available",
              availability_status: "available_now",
              current_customer_id: null,
              current_rental_id: null
            }
          : {
              current_customer_id: null,
              current_rental_id: null
            }
      )
      .eq("id", originalVehicleId)
      .eq("organization_id", organizationId)
  ];

  // 5. If rate changed, update future scheduled payments
  if (rateAfter !== rateBefore) {
    ops.push(
      supabase
        .from("rental_payments")
        .update({ amount: rateAfter })
        .eq("rental_id", rentalId)
        .eq("organization_id", organizationId)
        .in("status", ["scheduled", "pending", "overdue"])
        .is("deleted_at", null)
    );
  }

  const results = await Promise.all(ops);
  const firstError = results.find((r: any) => r?.error)?.error;
  if (firstError) throw new Error(firstError.message);

  const bookingRef = rental.reference || rental.display_code || rentalId;
  const reasonLabel = reason.replace(/_/g, " ");

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "rental",
    entity_id: rentalId,
    vehicle_id: replacementVehicleId,
    rental_id: rentalId,
    customer_id: rental.customer_id,
    event_type: "vehicle_changed",
    title: "Vehicle changed",
    detail: `${bookingRef} — vehicle changed (${reasonLabel}). Replacement: ${replacement.make} ${replacement.model} ${replacement.year || ""}${rateAfter !== rateBefore ? `. Rate updated: ${rateBefore} → ${rateAfter}` : ""}.`
  });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath(`/bookings/${rentalId}`);
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${originalVehicleId}`);
  revalidatePath(`/fleet/${replacementVehicleId}`);
}

export async function undoCancellation(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");

  const organizationId = String(formData.get("organizationId") || "").trim();
  const rentalId       = String(formData.get("rentalId") || "").trim();
  const vehicleId      = String(formData.get("vehicleId") || "").trim();

  if (!organizationId || !rentalId) throw new Error("Missing required fields.");

  const { data: rental, error: rentalError } = await supabase
    .from("rentals")
    .select("id, organization_id, vehicle_id, customer_id, status, reference, display_code, delivery_datetime")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (rentalError || !rental) throw new Error(rentalError?.message || "Booking not found.");
  if (rental.status !== "cancelled") throw new Error("This booking is not cancelled.");

  await ensureMembership(supabase, organizationId, user.id);

  const resolvedVehicleId = vehicleId || rental.vehicle_id;
  const restoreStatus = rental.delivery_datetime ? "active" : "booked";
  const today = new Date().toISOString().slice(0, 10);

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

    // Restore booking link
    supabase
      .from("booking_links")
      .update({ status: "completed", cancelled_at: null })
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .eq("status", "cancelled"),

    // Restore future cancelled payments to scheduled
    supabase
      .from("rental_payments")
      .update({ status: "scheduled" })
      .eq("rental_id", rentalId)
      .eq("organization_id", organizationId)
      .eq("status", "cancelled")
      .gte("scheduled_date", today),

    // Re-assign vehicle to this rental
    ...(resolvedVehicleId ? [
      supabase
        .from("vehicles")
        .update({
          status: "rented",
          availability_status: "rented",
          current_customer_id: rental.customer_id,
          current_rental_id: rentalId,
        })
        .eq("id", resolvedVehicleId)
        .eq("organization_id", organizationId),
    ] : []),
  ];

  const results = await Promise.all(ops);
  const firstError = results.find((r: any) => r?.error)?.error;
  if (firstError) throw new Error(firstError.message);

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
