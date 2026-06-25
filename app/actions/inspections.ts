"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyDepositDeduction, returnDeposit } from "@/app/actions/deposits";
import { activateRental } from "@/lib/rental-activation";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyOperator } from "@/lib/notify-operator";

type InspectionMode = "delivery" | "return" | "condition_report";

function stringField(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function optionalStringField(formData: FormData, key: string) {
  return stringField(formData, key) || null;
}

function numberField(formData: FormData, key: string) {
  const value = stringField(formData, key).replace(/,/g, "");
  return value ? Number(value) : null;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function safeJsonArray(formData: FormData, key: string) {
  try {
    const parsed = JSON.parse(stringField(formData, key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "inspection-upload";
}

function mediaTypeFromField(key: string) {
  return key
    .replace(/^photo_/, "")
    .replace(/^damagePhoto_/, "damage_")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase();
}

async function uploadInspectionMedia({
  supabase,
  formData,
  organizationId,
  inspectionId,
  userId,
  damageItems
}: {
  supabase: any;
  formData: FormData;
  organizationId: string;
  inspectionId: string;
  userId: string;
  damageItems: any[];
}) {
  const photos: any[] = [];
  const photoDocumentIds: string[] = [];
  const videoDocumentIds: string[] = [];
  let videoUrl: string | null = null;
  const damagePhotoPaths = new Map<string, string>();

  for (const [key, value] of formData.entries()) {
    if (!(value instanceof File) || value.size === 0) {
      continue;
    }

    const isVideo = key === "walkaroundVideo" || value.type.startsWith("video/");
    const isPhoto = key.startsWith("photo_") || key.startsWith("damagePhoto_") || value.type.startsWith("image/");
    if (!isVideo && !isPhoto) {
      continue;
    }

    const storagePath = `${organizationId}/inspections/${inspectionId}/${Date.now()}-${key}-${safeFileName(value.name)}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, value, {
      contentType: value.type || undefined,
      upsert: false
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const category = isVideo ? "inspection_video" : `inspection_${mediaTypeFromField(key)}`;
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        organization_id: organizationId,
        owner_type: "inspection",
        owner_id: inspectionId,
        storage_bucket: "documents",
        storage_path: storagePath,
        file_name: value.name || `${category}.upload`,
        mime_type: value.type || null,
        size_bytes: value.size,
        category,
        ocr_status: "not_started",
        extracted_data: {},
        uploaded_by: userId
      })
      .select("id")
      .single();

    if (documentError) {
      throw new Error(documentError.message);
    }

    if (isVideo) {
      videoUrl = storagePath;
      videoDocumentIds.push(document.id);
    } else {
      const photo = {
        id: crypto.randomUUID(),
        type: mediaTypeFromField(key),
        url: storagePath,
        thumbnail_url: storagePath,
        captured_at: new Date().toISOString()
      };
      photos.push(photo);
      photoDocumentIds.push(document.id);
      if (key.startsWith("damagePhoto_")) {
        damagePhotoPaths.set(key.replace("damagePhoto_", ""), storagePath);
      }
    }
  }

  const damageWithPhotos = damageItems.map((item) => ({
    ...item,
    photo_url: item.photo_url || (item.photo_key ? damagePhotoPaths.get(item.photo_key) : null) || null
  }));

  return { photos, photoDocumentIds, videoDocumentIds, videoUrl, damageWithPhotos };
}

async function updateVehicleMileageIfHigher(supabase: any, organizationId: string, vehicleId: string, odometerReading: number | null) {
  if (odometerReading === null) {
    return;
  }

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("mileage")
    .eq("id", vehicleId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!vehicle || odometerReading <= Number(vehicle.mileage || 0)) {
    return;
  }

  const { error: updateError } = await supabase
    .from("vehicles")
    .update({ mileage: odometerReading })
    .eq("id", vehicleId)
    .eq("organization_id", organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function reconcileReturnDeposit(formData: FormData, organizationId: string, rentalId: string) {
  const { data: rental } = await ((await createSupabaseServerClient()) as any)
    .from("rentals")
    .select("deposit_held, deposit_status, deposit_refunded_amount, deposit_forfeited_amount")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (rental?.deposit_status === "fully_returned") {
    return;
  }

  const held = Number(rental?.deposit_held || 0);
  const refunded = Number(rental?.deposit_refunded_amount || 0);
  const forfeited = Number(rental?.deposit_forfeited_amount || 0);
  let remaining = Math.max(0, held - refunded - forfeited);

  const deductions = [
    { key: "depositOutstandingBalance", reason: "Unpaid rent" },
    { key: "depositFuelDeficitCharge", reason: "Fuel deficit" },
    { key: "depositDamageCharge", reason: "Damage" },
    { key: "depositCleaningCharge", reason: "Cleaning fee" }
  ];

  for (const item of deductions) {
    const requested = numberField(formData, item.key) || 0;
    const amount = Math.min(remaining, requested);
    if (amount <= 0) continue;

    const deductionData = new FormData();
    deductionData.set("organizationId", organizationId);
    deductionData.set("rentalId", rentalId);
    deductionData.set("deductionAmount", String(amount));
    deductionData.set("reason", item.reason);
    deductionData.set("notes", "Recorded from return inspection.");
    await applyDepositDeduction(deductionData);
    remaining -= amount;
  }

  const refundAmount = Math.min(remaining, numberField(formData, "depositRefundAmount") || 0);
  if (refundAmount > 0) {
    const refundData = new FormData();
    refundData.set("organizationId", organizationId);
    refundData.set("rentalId", rentalId);
    refundData.set("returnAmount", String(refundAmount));
    refundData.set("notes", "Recorded from return inspection.");
    await returnDeposit(refundData);
  }
}

async function createOnDeliveryPaymentRecords(supabase: any, organizationId: string, rentalId: string) {
  const { data: rental, error } = await supabase
    .from("rentals")
    .select("id, organization_id, customer_id, vehicle_id, currency, payment_due_trigger, payment_due_after_delivery, first_payment_amount, deposit_payment_amount")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  // payment_due_trigger is the primary state machine; payment_due_after_delivery is the legacy fallback
  const isOnDelivery =
    rental?.payment_due_trigger === "on_delivery" ||
    (rental?.payment_due_trigger == null && rental?.payment_due_after_delivery);
  if (!isOnDelivery) {
    return;
  }

  if (!rental.customer_id || !rental.vehicle_id) {
    throw new Error("Customer and vehicle are required before creating delivery payment records.");
  }

  // Idempotency: if non-voided payment records already exist, skip creation entirely
  const { data: existingPayments, error: existingError } = await supabase
    .from("rental_payments")
    .select("id, status, voided")
    .eq("organization_id", organizationId)
    .eq("rental_id", rentalId)
    .is("deleted_at", null);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const activePayments = (existingPayments || []).filter(
    (p: any) => !p.voided && !["voided", "waived", "cancelled"].includes(p.status)
  );
  if (activePayments.length > 0) {
    return;
  }

  const dueDate = todayDate();
  const inserts = [];
  const firstPaymentAmount = Number(rental.first_payment_amount || 0);
  const depositPaymentAmount = Number(rental.deposit_payment_amount || 0);

  if (firstPaymentAmount > 0) {
    inserts.push({
      organization_id: rental.organization_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      vehicle_id: rental.vehicle_id,
      amount: firstPaymentAmount,
      due_date: dueDate,
      scheduled_date: dueDate,
      status: "pending",
      currency: rental.currency || "THB",
      metadata: {
        type: "rent",
        description: "First rental payment - payment due on delivery",
        payment_trigger: "on_delivery"
      }
    });
  }

  if (depositPaymentAmount > 0) {
    inserts.push({
      organization_id: rental.organization_id,
      rental_id: rental.id,
      customer_id: rental.customer_id,
      vehicle_id: rental.vehicle_id,
      amount: depositPaymentAmount,
      due_date: dueDate,
      scheduled_date: dueDate,
      status: "pending",
      currency: rental.currency || "THB",
      metadata: {
        is_deposit: true,
        type: "deposit",
        description: "Security deposit - collected on delivery",
        payment_trigger: "on_delivery"
      }
    });
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("rental_payments").insert(inserts);
    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  // Advance state machine to 'confirmed' to prevent any future re-triggering
  const { error: clearError } = await supabase
    .from("rentals")
    .update({ payment_due_after_delivery: false, payment_due_trigger: "confirmed" })
    .eq("id", rental.id)
    .eq("organization_id", rental.organization_id);

  if (clearError) {
    throw new Error(clearError.message);
  }
}

export async function submitInspection(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = stringField(formData, "organizationId");
  const vehicleId = stringField(formData, "vehicleId");
  const rentalId = optionalStringField(formData, "rentalId");
  const customerId = optionalStringField(formData, "customerId");
  const mode = stringField(formData, "mode") as InspectionMode;
  const odometerReading = numberField(formData, "odometerReading");
  const fuelLevel = numberField(formData, "fuelLevel");
  const fuelLevelLabel = optionalStringField(formData, "fuelLevelLabel");
  const damageItems = safeJsonArray(formData, "damageItems");
  const notes = optionalStringField(formData, "notes");
  const customerSignature = optionalStringField(formData, "customerSignature");
  const customerSignedName = optionalStringField(formData, "customerSignedName");

  if (!organizationId || !vehicleId || !["delivery", "return", "condition_report"].includes(mode)) {
    throw new Error("Inspection context is missing.");
  }

  if (mode !== "condition_report" && !rentalId) {
    throw new Error("A rental is required for delivery and return inspections.");
  }

  if (odometerReading === null) {
    throw new Error("Confirm the odometer reading before submitting.");
  }

  if (mode !== "condition_report" && !customerSignature) {
    throw new Error("Customer signature is required before submitting.");
  }

  const now = new Date().toISOString();
  const { data: inspection, error: inspectionError } = await supabase
    .from("inspections")
    .insert({
      organization_id: organizationId,
      rental_id: rentalId,
      vehicle_id: vehicleId,
      customer_id: customerId,
      inspection_type: mode,
      type: mode,
      status: "submitted",
      inspected_at: now,
      mileage: odometerReading,
      odometer_reading: odometerReading,
      fuel_level: fuelLevel,
      fuel_level_label: fuelLevelLabel,
      damage_markers: damageItems,
      damage_items: damageItems,
      photos: [],
      video_url: null,
      customer_signature: customerSignature,
      customer_signed_at: customerSignature ? now : null,
      customer_signed_name: customerSignedName,
      notes,
      submitted_at: now,
      submitted_by: user.id,
      completed_by: user.id
    })
    .select("id")
    .single();

  if (inspectionError || !inspection) {
    throw new Error(inspectionError?.message || "Unable to save inspection.");
  }

  const media = await uploadInspectionMedia({
    supabase,
    formData,
    organizationId,
    inspectionId: inspection.id,
    userId: user.id,
    damageItems
  });

  const { error: mediaUpdateError } = await supabase
    .from("inspections")
    .update({
      photos: media.photos,
      video_url: media.videoUrl,
      photo_document_ids: media.photoDocumentIds,
      video_document_ids: media.videoDocumentIds,
      damage_items: media.damageWithPhotos,
      damage_markers: media.damageWithPhotos
    })
    .eq("id", inspection.id)
    .eq("organization_id", organizationId);

  if (mediaUpdateError) {
    throw new Error(mediaUpdateError.message);
  }

  await updateVehicleMileageIfHigher(supabase, organizationId, vehicleId, odometerReading);

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("make, model, registration_number")
    .eq("id", vehicleId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  let customerName = "Customer";
  if (customerId) {
    const { data: customer } = await supabase
      .from("customers")
      .select("full_name")
      .eq("id", customerId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    customerName = customer?.full_name || customerName;
  }

  if (mode === "delivery" && rentalId) {
    const { error: rentalError } = await supabase
      .from("rentals")
      .update({ mileage_at_delivery: odometerReading, status: "active" })
      .eq("id", rentalId)
      .eq("organization_id", organizationId);
    if (rentalError) {
      throw new Error(rentalError.message);
    }

    const { error: vehicleError } = await supabase
      .from("vehicles")
      .update({
        status: "rented",
        availability_status: "rented",
        current_rental_id: rentalId,
        current_customer_id: customerId
      })
      .eq("id", vehicleId)
      .eq("organization_id", organizationId);
    if (vehicleError) {
      throw new Error(vehicleError.message);
    }

    await createOnDeliveryPaymentRecords(supabase, organizationId, rentalId);
    // Generate payment schedule (idempotent — skips if already exists)
    await activateRental(rentalId, supabase).catch(() => null);
  }

  if (mode === "return" && rentalId) {
    const { data: rental, error: rentalFetchError } = await supabase
      .from("rentals")
      .select("mileage_at_delivery")
      .eq("id", rentalId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (rentalFetchError) {
      throw new Error(rentalFetchError.message);
    }

    const kmDriven =
      odometerReading !== null && rental?.mileage_at_delivery !== null && rental?.mileage_at_delivery !== undefined
        ? Math.max(0, odometerReading - Number(rental.mileage_at_delivery || 0))
        : null;

    const { error: rentalError } = await supabase
      .from("rentals")
      .update({ mileage_at_return: odometerReading, km_driven: kmDriven, status: "completed" })
      .eq("id", rentalId)
      .eq("organization_id", organizationId);
    if (rentalError) {
      throw new Error(rentalError.message);
    }

    await reconcileReturnDeposit(formData, organizationId, rentalId);

    const { error: vehicleError } = await supabase
      .from("vehicles")
      .update({
        status: "available",
        availability_status: "available_now",
        current_rental_id: null,
        current_customer_id: null
      })
      .eq("id", vehicleId)
      .eq("organization_id", organizationId);
    if (vehicleError) {
      throw new Error(vehicleError.message);
    }
  }

  const vehicleLabel = [vehicle?.registration_number, vehicle?.make, vehicle?.model].filter(Boolean).join(" ");
  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "inspection",
    entity_id: inspection.id,
    vehicle_id: vehicleId,
    rental_id: rentalId,
    customer_id: customerId,
    event_type: `${mode}_inspection_completed`,
    title:
      mode === "return"
        ? "Return inspection completed"
        : mode === "condition_report"
          ? "Vehicle condition report completed"
          : "Delivery inspection completed",
    detail:
      mode === "return"
        ? `${customerName} returned ${vehicleLabel}. ${odometerReading.toLocaleString()} km recorded.`
        : `${vehicleLabel} inspected for ${customerName}. ${odometerReading.toLocaleString()} km recorded.`
  });

  if (mode === "return") {
    notifyOperator(
      organizationId,
      `🔄 Return inspection complete — ${vehicleLabel} returned by ${customerName}`,
      "return_inspection"
    ).catch(() => null);
  }

  revalidatePath("/");
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
  if (rentalId) {
    revalidatePath(`/bookings/${rentalId}`);
    redirect(`/bookings/${rentalId}`);
  }
  redirect(`/fleet/${vehicleId}`);
}
