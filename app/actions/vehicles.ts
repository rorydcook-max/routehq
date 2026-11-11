"use server";

import { businessToday } from "@/lib/business-time";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { guard } from "@/lib/action-error";
import { markOnboardingStep } from "@/lib/onboarding";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { getCurrentMembership } from "@/lib/auth/roles";
import { asCondition, valueForCondition } from "@/lib/vehicle-condition";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { costTypeForService, recordService } from "@/lib/vehicle-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loanFromForm } from "@/lib/vehicle-loan";
import { removeStoredFiles } from "@/lib/supabase/remove-stored-files";
import { paperCostType, paperworkFor } from "@/lib/country-paperwork";
import { monthsCovered } from "@/lib/cost-spread";
import { nextMonthly, postDueComplianceInstalments } from "@/lib/compliance-billing";

function numberFromForm(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").replace(/,/g, "").trim();
  return value ? Number(value) : 0;
}

function optionalNumberFromForm(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").replace(/,/g, "").trim();
  return value ? Number(value) : null;
}

/** A model year: four digits, from 1950 to next year. Anything else is a typing slip, not a year. */
function yearFromForm(formData: FormData) {
  const year = optionalNumberFromForm(formData, "year");
  if (year === null) return null;
  if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
    throw new Error("Check the year: four digits, like 2023.");
  }
  return year;
}

function optionalStringFromForm(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim() || null;
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function compactObject<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== "" && entry !== null)) as Partial<T>;
}



async function attachLogbookDocument({
  supabase,
  file,
  organizationId,
  vehicleId,
  userId
}: {
  supabase: any;
  file: File;
  organizationId: string;
  vehicleId: string;
  userId: string;
}) {
  if (!file || file.size === 0) {
    return;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "upload";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${organizationId}/vehicle/${vehicleId}/logbook/${Date.now()}-${safeName || `logbook.${extension}`}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: documentError } = await supabase.from("documents").insert({
    organization_id: organizationId,
    owner_type: "vehicle",
    owner_id: vehicleId,
    storage_bucket: "documents",
    storage_path: storagePath,
    file_name: file.name || `logbook.${extension}`,
    mime_type: file.type || null,
    size_bytes: file.size,
    category: "vehicle_logbook",
    locale: "th",
    ocr_status: "queued",
    extracted_data: {},
    uploaded_by: userId
  });

  if (documentError) {
    throw new Error(documentError.message);
  }
}

async function attachVehicleDocument({
  supabase,
  file,
  organizationId,
  vehicleId,
  userId,
  category
}: {
  supabase: any;
  file: File;
  organizationId: string;
  vehicleId: string;
  userId: string;
  category: string;
}) {
  if (!file || file.size === 0) {
    return null;
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "upload";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const storagePath = `${organizationId}/vehicle/${vehicleId}/${category}/${Date.now()}-${safeName || `document.${extension}`}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: false
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data, error: documentError } = await supabase
    .from("documents")
    .insert({
      organization_id: organizationId,
      owner_type: "vehicle",
      owner_id: vehicleId,
      storage_bucket: "documents",
      storage_path: storagePath,
      file_name: file.name || `document.${extension}`,
      mime_type: file.type || null,
      size_bytes: file.size,
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

  return data?.id || null;
}

async function requireVehicleAccess(supabase: any, vehicleId: string, organizationId: string) {
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("id, organization_id, registration_number, make, model")
    .eq("id", vehicleId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !vehicle) {
    throw new Error(error?.message || "Vehicle was not found.");
  }

  return vehicle;
}

async function requireVehiclePhotoManagementAccess(
  supabase: any,
  userId: string,
  vehicleId: string,
  organizationId: string
) {
  const vehicle = await requireVehicleAccess(supabase, vehicleId, organizationId);
  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !membership || !["owner", "manager", "operator"].includes(membership.role)) {
    throw new Error(error?.message || "You do not have permission to manage vehicle photos.");
  }

  return vehicle;
}

const complianceFieldMap: Record<
  string,
  {
    label: string;
    section: "compliance" | "finance";
    field: string;
  }
> = {
  tax: { label: "Vehicle tax", section: "compliance", field: "tax_expiry_date" },
  porbor: { label: "Compulsory insurance", section: "compliance", field: "porbor_expiry_date" },
  insurance: { label: "Voluntary insurance", section: "compliance", field: "insurance_expiry_date" },
  inspection: { label: "Vehicle inspection", section: "compliance", field: "inspection_expiry_date" },
  service: { label: "Service due", section: "compliance", field: "next_service_date" },
  oil: { label: "Oil change", section: "compliance", field: "oil_change_due_date" },
  finance: { label: "Finance end date", section: "finance", field: "end_date" }
};

/**
 * The Add vehicle form. Photos chosen on the short form (setup) come along, already made small on the phone.
 * From setup it goes back to setup; otherwise to the fleet.
 */
export async function createVehicle(formData: FormData) {
  // A reason it can't be added (a plate already used, a year typed wrong) comes back as `{ actionError }` for the form.
  return guard(() => createVehicleOrThrow(formData), "Couldn't add the vehicle. Nothing was saved.");
}

async function createVehicleOrThrow(formData: FormData) {
  const created = await insertVehicle(formData);
  const photos = formData.getAll("vehiclePhotos").filter((item): item is File => item instanceof File && item.size > 0);
  if (photos.length) {
    const photoForm = new FormData();
    photoForm.set("vehicleId", created.id);
    photoForm.set("organizationId", created.organizationId);
    for (const photo of photos) photoForm.append("vehiclePhotos", photo, photo.name || "photo.jpg");
    // A photo that fails must not lose the vehicle just added; it can be added again from the car's page.
    await uploadVehiclePhotos(photoForm).catch((error) => console.warn("photos on new vehicle:", error instanceof Error ? error.message : error));
  }
  if (String(formData.get("returnTo") || "") === "onboarding") redirect("/onboarding?added=1");
  redirect("/fleet");
}

/** Adds one vehicle from form fields and returns it. Shared by the Add vehicle form and the fleet assistant. */
export async function insertVehicle(formData: FormData): Promise<{ id: string; organizationId: string; label: string }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = String(formData.get("organizationId") || "");
  const categoryId = String(formData.get("categoryId") || "");
  const make = String(formData.get("make") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const trim = String(formData.get("trim") || "").trim() || null;
  const registrationNumber = String(formData.get("registrationNumber") || "").trim().toUpperCase();
  const serviceArea = String(formData.get("serviceArea") || "home_branch");

  // Only the type, make and model are needed; the plate, prices and the rest can be added later (Rory, 31 Oct 2026).
  if (!organizationId || !categoryId || !make || !model) {
    throw new Error("Vehicle category, make and model are required.");
  }

  if (!["home_branch", "all_branches"].includes(serviceArea)) {
    throw new Error("Invalid service area.");
  }

  const transmission = String(formData.get("transmission") || "").trim();
  const seatingCapacity = optionalNumberFromForm(formData, "seatingCapacity");
  const engineCc = optionalNumberFromForm(formData, "engineCc");

  const specifications = compactObject({
    transmission,
    seating_capacity: seatingCapacity,
    engine_cc: engineCc,
    fuel_type: optionalStringFromForm(formData, "fuelType"),
    drivetrain: optionalStringFromForm(formData, "drivetrain"),
    body_class: optionalStringFromForm(formData, "bodyClass")
  });

  const compliance = compactObject({
    tax_expiry_date: optionalStringFromForm(formData, "taxExpiryDate"),
    porbor_expiry_date: optionalStringFromForm(formData, "porborExpiryDate"),
    insurance_expiry_date: optionalStringFromForm(formData, "insuranceExpiryDate"),
    voluntary_insurance_type: optionalStringFromForm(formData, "voluntaryInsuranceType"),
    next_service_date: optionalStringFromForm(formData, "nextServiceDate"),
    oil_change_due_date: optionalStringFromForm(formData, "oilChangeDueDate")
  });

  const finance = loanFromForm(formData);

  const acquisition = compactObject({
    purchase_mileage: optionalNumberFromForm(formData, "purchaseMileage")
  });

  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      organization_id: organizationId,
      category_id: categoryId,
      make,
      model,
      trim,
      year: yearFromForm(formData),
      vin: String(formData.get("vin") || "").trim() || null,
      registration_number: registrationNumber,
      color: String(formData.get("color") || "").trim() || null,
      purchase_price: optionalNumberFromForm(formData, "purchasePrice"),
      estimated_value: optionalNumberFromForm(formData, "estimatedValue"),
      mileage: numberFromForm(formData, "mileage"),
      status: "available",
      availability_status: "available_now",
      home_branch_id: optionalStringFromForm(formData, "homeBranchId"),
      service_area: serviceArea,
      partner_network_enabled: false,
      daily_rate: numberFromForm(formData, "dailyRate"),
      weekly_rate: numberFromForm(formData, "weeklyRate"),
      monthly_rate: numberFromForm(formData, "monthlyRate"),
      // Empty means "use the business's usual deposit".
      deposit_amount: String(formData.get("depositAmount") || "").trim() ? numberFromForm(formData, "depositAmount") : null,
      utilization_12_month: 0,
      utilization_lifecycle: 0,
      revenue_generated: 0,
      profit_generated: 0,
      health_score: 100,
      specifications,
      metadata: {
        acquisition,
        compliance,
        finance
      },
      created_by: user.id
    })
    .select("id, registration_number, make, model")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to add vehicle.");
  }

  const customCatalogEntry =
    String(formData.get("catalogMakeIsCustom") || "") === "true" ||
    String(formData.get("catalogModelIsCustom") || "") === "true" ||
    String(formData.get("catalogTrimIsCustom") || "") === "true" ||
    !String(formData.get("catalogMakeId") || "") ||
    !String(formData.get("catalogModelId") || "") ||
    (Boolean(trim) && !String(formData.get("catalogTrimId") || ""));

  if (customCatalogEntry) {
    const { error: submissionError } = await supabase.from("vehicle_catalog_submissions").insert({
      organization_id: organizationId,
      submitted_by: user.id,
      make_name: make,
      model_name: model,
      trim_name: trim,
      category_code: optionalStringFromForm(formData, "categoryCode"),
      year_from: optionalNumberFromForm(formData, "year"),
      engine_cc: engineCc,
      transmission: transmission || null,
      fuel_type: optionalStringFromForm(formData, "fuelType"),
      seating_capacity: seatingCapacity,
      drivetrain: optionalStringFromForm(formData, "drivetrain"),
      notes: `Captured automatically from Add Vehicle for ${registrationNumber}.`,
      status: "pending_review"
    });

    // Only a note for the catalog team: the vehicle is already saved, so this must not show an error (and a second try
    // would then fail on the plate).
    if (submissionError) console.warn("[insertVehicle] catalog submission:", submissionError.message);
  }

  const logbookFile = formData.get("logbookFile");
  if (logbookFile instanceof File && logbookFile.size > 0) {
    // The vehicle is saved: a logbook that fails to upload can be added again from its page.
    await attachLogbookDocument({
      supabase,
      file: logbookFile,
      organizationId,
      vehicleId: data.id,
      userId: user.id
    }).catch((uploadError) => console.warn("[insertVehicle] logbook:", uploadError instanceof Error ? uploadError.message : uploadError));
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "vehicle",
    entity_id: data.id,
    vehicle_id: data.id,
    event_type: "vehicle_created",
    title: "Vehicle added",
    detail: `${data.registration_number} ${data.make} ${data.model} added to fleet.`
  });
  await markOnboardingStep(supabase, organizationId, "first_vehicle");

  revalidatePath("/");
  revalidatePath("/fleet");
  return { id: data.id, organizationId, label: [data.make, data.model, data.registration_number].filter(Boolean).join(" ") };
}

export async function updateVehicle(formData: FormData) {
  // A reason it can't be saved (a plate already used, a year typed wrong) comes back as `{ actionError }` for the form.
  return guard(() => updateVehicleOrThrow(formData));
}

async function updateVehicleOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const categoryId = String(formData.get("categoryId") || "");
  const make = String(formData.get("make") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const registrationNumber = String(formData.get("registrationNumber") || "").trim().toUpperCase();
  const serviceArea = String(formData.get("serviceArea") || "home_branch");

  if (!vehicleId || !organizationId || !categoryId || !make || !model) {
    throw new Error("Vehicle category, make and model are required.");
  }

  if (!["home_branch", "all_branches"].includes(serviceArea)) {
    throw new Error("Invalid service area.");
  }

  const transmission = String(formData.get("transmission") || "").trim();
  const seatingCapacity = optionalNumberFromForm(formData, "seatingCapacity");
  const engineCc = optionalNumberFromForm(formData, "engineCc");

  const specifications = compactObject({
    transmission,
    seating_capacity: seatingCapacity,
    engine_cc: engineCc,
    fuel_type: optionalStringFromForm(formData, "fuelType"),
    drivetrain: optionalStringFromForm(formData, "drivetrain"),
    body_class: optionalStringFromForm(formData, "bodyClass")
  });

  // Only the fields this form shows; anything else saved on the vehicle (costs from an import, included items) is kept below.
  const compliance = {
    insurance_sum_insured: optionalNumberFromForm(formData, "insuranceSumInsured"),
    insurance_excess: optionalNumberFromForm(formData, "insuranceExcess"),
    tax_expiry_date: optionalStringFromForm(formData, "taxExpiryDate"),
    porbor_expiry_date: optionalStringFromForm(formData, "porborExpiryDate"),
    insurance_expiry_date: optionalStringFromForm(formData, "insuranceExpiryDate"),
    voluntary_insurance_type: optionalStringFromForm(formData, "voluntaryInsuranceType"),
    next_service_date: optionalStringFromForm(formData, "nextServiceDate"),
    oil_change_due_date: optionalStringFromForm(formData, "oilChangeDueDate")
  };

  const acquisition = {
    purchase_mileage: optionalNumberFromForm(formData, "purchaseMileage")
  };

  // What was paid, what it is worth and any loan are the owner's: a teammate's save leaves them as they are.
  const ownerFields = (await getCurrentMembership())?.role === "owner";

  // Saving the form used to replace everything stored with the vehicle, losing what it does not show.
  const { data: before } = await supabase.from("vehicles").select("metadata").eq("id", vehicleId).eq("organization_id", organizationId).maybeSingle();
  const kept = (before?.metadata || {}) as Record<string, any>;
  const merged = (section: string, fromForm: Record<string, unknown>) => compactObject({ ...(kept[section] || {}), ...fromForm });
  // Condition: changed only when the owner picks a different one; the estimated value moves with it while it is still the estimate.
  const conditionPicked = asCondition(formData.get("condition"));
  const conditionChanged = conditionPicked && conditionPicked !== kept.condition?.value;
  const estimateShown = kept.valuation?.typical && Number(kept.valuation.value || kept.valuation.typical);
  const typedValue = ownerFields ? optionalNumberFromForm(formData, "estimatedValue") : null;
  const valueFollows = conditionChanged && estimateShown && (!typedValue || typedValue === estimateShown);
  const placed = valueFollows ? valueForCondition(kept.valuation, conditionPicked) : null;
  const conditionPatch = conditionChanged
    ? {
        condition: { value: conditionPicked, set_at: new Date().toISOString(), by: "owner" },
        ...(placed ? { valuation: { ...kept.valuation, value: placed } } : {})
      }
    : {};

  const { error } = await supabase
    .from("vehicles")
    .update({
      make,
      model,
      category_id: categoryId,
      trim: optionalStringFromForm(formData, "trim"),
      year: yearFromForm(formData),
      vin: optionalStringFromForm(formData, "vin"),
      registration_number: registrationNumber,
      color: optionalStringFromForm(formData, "color"),
      ...(ownerFields
        ? {
            purchase_price: optionalNumberFromForm(formData, "purchasePrice"),
            purchase_date: optionalStringFromForm(formData, "purchaseDate"),
            estimated_value: placed || optionalNumberFromForm(formData, "estimatedValue")
          }
        : placed
          ? { estimated_value: placed }
          : {}),
      mileage: numberFromForm(formData, "mileage"),
      home_branch_id: optionalStringFromForm(formData, "homeBranchId"),
      service_area: serviceArea,
      daily_rate: numberFromForm(formData, "dailyRate"),
      weekly_rate: numberFromForm(formData, "weeklyRate"),
      monthly_rate: numberFromForm(formData, "monthlyRate"),
      // Empty means "use the business's usual deposit".
      deposit_amount: String(formData.get("depositAmount") || "").trim() ? numberFromForm(formData, "depositAmount") : null,
      specifications,
      metadata: {
        ...kept,
        ...conditionPatch,
        // Owned by someone else: their name and share (owner only; empty name clears it).
        ...(ownerFields
          ? {
              partner: optionalStringFromForm(formData, "partnerName")
                ? {
                    name: optionalStringFromForm(formData, "partnerName"),
                    phone: optionalStringFromForm(formData, "partnerPhone"),
                    pct: Math.max(0, Math.min(100, optionalNumberFromForm(formData, "partnerPct") || 0)),
                    basis: String(formData.get("partnerBasis")) === "profit" ? "profit" : "income"
                  }
                : null
            }
          : {}),
        acquisition: ownerFields ? merged("acquisition", acquisition) : kept.acquisition || {},
        compliance: merged("compliance", compliance),
        // The loan is replaced as a whole, so clearing a field clears it (lib/vehicle-loan.ts).
        finance: ownerFields ? loanFromForm(formData, kept.finance) : kept.finance || {}
      }
    })
    .eq("id", vehicleId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "vehicle",
    entity_id: vehicleId,
    vehicle_id: vehicleId,
    event_type: "vehicle_updated",
    title: "Vehicle updated",
    detail: `${registrationNumber} ${make} ${model} updated.`
  });

  revalidatePath("/");
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
  redirect(`/fleet/${vehicleId}`);
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function uploadVehiclePhotos(...args: Parameters<typeof uploadVehiclePhotosOrThrow>) {
  return guard(() => uploadVehiclePhotosOrThrow(...args));
}

async function uploadVehiclePhotosOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const files = formData.getAll("vehiclePhotos").filter((item): item is File => item instanceof File && item.size > 0);

  if (!vehicleId || !organizationId) {
    throw new Error("Vehicle is required.");
  }

  if (files.length === 0) {
    throw new Error("Choose at least one photo to upload.");
  }

  const vehicle = await requireVehiclePhotoManagementAccess(supabase, user.id, vehicleId, organizationId);
  const admin = createSupabaseAdminClient() as any;

  // New photos go after the ones already there, in the order they were chosen, so the first photo of a car's first
  // upload is its main photo (Rory, 1 Nov 2026: photos came out in reverse, the last one chosen becoming main).
  const { data: existing } = await admin
    .from("documents")
    .select("extracted_data")
    .eq("organization_id", organizationId)
    .eq("owner_type", "vehicle")
    .eq("owner_id", vehicleId)
    .eq("category", "vehicle_photo")
    .is("deleted_at", null);
  let nextOrder =
    ((existing || []) as any[]).reduce((highest, row) => {
      const order = Number(row.extracted_data?.vehicle_photo_order);
      return Number.isFinite(order) && row.extracted_data?.vehicle_photo_order !== null ? Math.max(highest, order) : highest;
    }, -1) + 1;
  // Older photos without a place (from before places were saved) keep showing first.
  nextOrder = Math.max(nextOrder, ((existing || []) as any[]).length);

  for (const file of files) {
    // An iPhone can send a photo with no type at all; its name still says what it is.
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)) {
      throw new Error("Vehicle photos must be image files.");
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "upload";
    const storagePath = `${organizationId}/vehicle/${vehicleId}/photos/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name || `vehicle-photo.${extension}`)}`;
    const { error: uploadError } = await admin.storage.from("documents").upload(storagePath, file, {
      contentType: file.type || (/\.hei[cf]$/i.test(file.name) ? "image/heic" : /\.png$/i.test(file.name) ? "image/png" : "image/jpeg"),
      upsert: false
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { error: documentError } = await admin.from("documents").insert({
      organization_id: organizationId,
      owner_type: "vehicle",
      owner_id: vehicleId,
      storage_bucket: "documents",
      storage_path: storagePath,
      file_name: file.name || `vehicle-photo.${extension}`,
      mime_type: file.type || null,
      size_bytes: file.size,
      category: "vehicle_photo",
      ocr_status: "not_started",
      // A photo AI made on the Add vehicle form (components/ai-photos.tsx names it so): it carries the "AI image" label.
      extracted_data: { vehicle_photo_order: nextOrder++, ...(/^ai-generated-/.test(file.name || "") ? { ai_generated: true } : {}) },
      uploaded_by: user.id
    });

    if (documentError) {
      await admin.storage.from("documents").remove([storagePath]);
      throw new Error(documentError.message);
    }
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "vehicle",
    entity_id: vehicleId,
    vehicle_id: vehicleId,
    event_type: "vehicle_photos_updated",
    title: "Vehicle photos added",
    detail: `${files.length} photo${files.length === 1 ? "" : "s"} added for ${vehicle.registration_number || [vehicle.make, vehicle.model].filter(Boolean).join(" ")}.`
  });

  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function removeVehiclePhoto(...args: Parameters<typeof removeVehiclePhotoOrThrow>) {
  return guard(() => removeVehiclePhotoOrThrow(...args));
}

async function removeVehiclePhotoOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const documentId = String(formData.get("documentId") || "");

  if (!vehicleId || !organizationId || !documentId) {
    throw new Error("Vehicle photo is required.");
  }

  const vehicle = await requireVehiclePhotoManagementAccess(supabase, user.id, vehicleId, organizationId);
  const admin = createSupabaseAdminClient() as any;
  const { data: document, error: documentError } = await admin
    .from("documents")
    .select("id, storage_bucket, storage_path, file_name")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .eq("owner_type", "vehicle")
    .eq("owner_id", vehicleId)
    .is("deleted_at", null)
    .maybeSingle();

  if (documentError || !document) {
    throw new Error(documentError?.message || "Photo was not found.");
  }

  const deletedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("documents")
    .update({ deleted_at: deletedAt })
    .eq("id", documentId)
    .eq("organization_id", organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: storageError } = await admin.storage
    .from(document.storage_bucket || "documents")
    .remove([document.storage_path]);

  if (storageError) {
    await admin
      .from("documents")
      .update({ deleted_at: null })
      .eq("id", documentId)
      .eq("organization_id", organizationId)
      .eq("deleted_at", deletedAt);
    throw new Error(storageError.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "vehicle",
    entity_id: vehicleId,
    vehicle_id: vehicleId,
    event_type: "vehicle_photos_updated",
    title: "Vehicle photo removed",
    detail: `${document.file_name || "Vehicle photo"} removed from ${vehicle.registration_number || [vehicle.make, vehicle.model].filter(Boolean).join(" ")}.`
  });

  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function reorderVehiclePhotos(...args: Parameters<typeof reorderVehiclePhotosOrThrow>) {
  return guard(() => reorderVehiclePhotosOrThrow(...args));
}

async function reorderVehiclePhotosOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const rawOrder = String(formData.get("photoOrder") || "[]");

  if (!vehicleId || !organizationId) {
    throw new Error("Vehicle is required.");
  }

  await requireVehiclePhotoManagementAccess(supabase, user.id, vehicleId, organizationId);
  const admin = createSupabaseAdminClient() as any;

  const photoIds = JSON.parse(rawOrder);
  if (!Array.isArray(photoIds) || photoIds.some((id) => typeof id !== "string")) {
    throw new Error("Invalid photo order.");
  }

  const { data: documents, error: documentError } = await admin
    .from("documents")
    .select("id, extracted_data")
    .eq("organization_id", organizationId)
    .eq("owner_type", "vehicle")
    .eq("owner_id", vehicleId)
    .in("id", photoIds)
    .is("deleted_at", null);

  if (documentError) {
    throw new Error(documentError.message);
  }

  const documentById = new Map<string, { id: string; extracted_data: unknown }>((documents || []).map((document: any) => [document.id, document]));
  const updateResults = await Promise.all(
    photoIds.map((photoId, index) => {
      const document = documentById.get(photoId);
      if (!document) {
        return Promise.resolve(null);
      }
      const extractedData =
        typeof document.extracted_data === "object" && document.extracted_data !== null && !Array.isArray(document.extracted_data)
          ? document.extracted_data
          : {};

      return admin
        .from("documents")
        .update({
          extracted_data: {
            ...extractedData,
            vehicle_photo_order: index
          }
        })
        .eq("id", photoId)
        .eq("organization_id", organizationId);
    })
  );
  const orderError = updateResults.find((result) => result?.error)?.error;

  if (orderError) {
    throw new Error(orderError.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "vehicle",
    entity_id: vehicleId,
    vehicle_id: vehicleId,
    event_type: "vehicle_photos_updated",
    title: "Vehicle photos reordered",
    detail: "Vehicle photo display order updated."
  });

  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
}

/**
 * The renewal form and the assistant's cards: a reason it can't be saved comes back as `{ actionError }`.
 * renewVehicleCompliance itself still throws, for the assistant's confirm step (app/actions/ask.ts).
 */
export async function renewVehicleComplianceFromForm(formData: FormData) {
  return guard(() => renewVehicleCompliance(formData));
}

export async function renewVehicleCompliance(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const complianceType = String(formData.get("complianceType") || "");
  const newExpiryDate = optionalStringFromForm(formData, "newExpiryDate");
  const cost = optionalNumberFromForm(formData, "cost");
  const notes = optionalStringFromForm(formData, "notes");
  const config = complianceFieldMap[complianceType];

  if (!vehicleId || !organizationId || !config || !newExpiryDate) {
    throw new Error("Vehicle, renewal type, and new expiry date are required.");
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("metadata")
    .eq("id", vehicleId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (vehicleError || !vehicle) {
    throw new Error(vehicleError?.message || "Vehicle was not found.");
  }

  const metadata = vehicle.metadata || {};
  const nextSection = {
    ...(metadata[config.section] || {}),
    [config.field]: newExpiryDate
  };

  // Paperwork (tax, insurance, inspection) is a cost: paid once for the whole cover, or every month (Rory, 2 Nov 2026).
  const isPaperwork = ["tax", "porbor", "insurance", "inspection"].includes(complianceType);
  const today = businessToday();
  const coverStartInput = optionalStringFromForm(formData, "coverStart");
  const coverStart = isPaperwork && coverStartInput && coverStartInput < newExpiryDate ? coverStartInput : today;
  const paidMonthly = isPaperwork && String(formData.get("paymentMode") || "") === "monthly" && cost !== null && cost > 0;
  const { data: organization } = await supabase.from("organizations").select("country_code, currency").eq("id", organizationId).maybeSingle();
  const currency = organization?.currency || "THB";
  const costType = paperCostType(organization?.country_code, complianceType);

  if (cost !== null) {
    nextSection[`${config.field}_last_cost`] = cost;
    nextSection[`${config.field}_monthly`] = paidMonthly || undefined;
  }

  const documentFile = formData.get("documentFile");
  const documentId = documentFile instanceof File && documentFile.size > 0
    ? await attachVehicleDocument({
        supabase,
        file: documentFile,
        organizationId,
        vehicleId,
        userId: user.id,
        category: `${complianceType}_renewal`
      })
    : null;

  const { data: complianceEvent, error: complianceError } = await supabase
    .from("compliance_events")
    .insert({
      organization_id: organizationId,
      vehicle_id: vehicleId,
      compliance_type: complianceType,
      effective_date: isPaperwork ? coverStart : today,
      expiry_date: newExpiryDate,
      cost,
      notes: [notes, documentId ? `Document: ${documentId}` : ""].filter(Boolean).join("\n") || null,
      created_by: user.id
    })
    .select("id")
    .single();

  if (complianceError) {
    throw new Error(complianceError.message);
  }

  // A monthly plan replaces any earlier one for the same paperwork; paying once ends it.
  const plans = { ...(metadata.compliance_plans || {}) };
  if (isPaperwork && cost !== null) delete plans[complianceType];
  if (paidMonthly) {
    // A set number of payments (10 for a year's cover, say): the last one falls that many months in, and none after.
    const count = Math.floor(Number(optionalNumberFromForm(formData, "payments") || 0));
    let lastInstalment = newExpiryDate;
    if (count >= 1) {
      let day = coverStart;
      for (let i = 1; i < Math.min(count, 36); i++) day = nextMonthly(coverStart, day);
      if (day < newExpiryDate) lastInstalment = day;
    }
    plans[complianceType] = { amount: cost, currency, type: costType, start: coverStart, next: coverStart, until: lastInstalment, eventId: complianceEvent.id, ...(count >= 1 ? { payments: count } : {}) };
  }
  const nextMetadata: Record<string, any> = { ...metadata, [config.section]: nextSection };
  if (Object.keys(plans).length) nextMetadata.compliance_plans = plans;
  else delete nextMetadata.compliance_plans;

  const { error: updateError } = await supabase
    .from("vehicles")
    .update({ metadata: nextMetadata })
    .eq("id", vehicleId)
    .eq("organization_id", organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (isPaperwork && cost !== null && cost > 0) {
    if (paidMonthly) {
      // The instalments already due (the first, or several when entered late); the daily run adds the rest.
      await postDueComplianceInstalments(supabase, { vehicleId, organizationId });
    } else {
      // Paid on the day the cover starts, or today when it starts later. Counted a share per month it covers.
      const spread = monthsCovered({ from: coverStart, to: newExpiryDate }) >= 2 ? { from: coverStart, to: newExpiryDate } : undefined;
      const { error: transactionError } = await supabase.from("transactions").insert({
        organization_id: organizationId,
        vehicle_id: vehicleId,
        type: costType,
        amount: cost,
        currency,
        transaction_date: coverStart < today ? coverStart : today,
        notes: notes || null,
        receipt_document_id: documentId,
        metadata: { source: "compliance_renewal", compliance_type: complianceType, compliance_event_id: complianceEvent.id, ...(spread ? { spread } : {}) },
        created_by: user.id
      });
      if (transactionError) {
        throw new Error(transactionError.message);
      }
    }
  }

  // Thailand: an older vehicle's inspection (ตรอ.) is done with the road tax, so its cost comes in the same renewal.
  const inspectionCost = complianceType === "tax" ? optionalNumberFromForm(formData, "inspectionCost") : null;
  if (inspectionCost !== null && inspectionCost > 0) {
    const local = paperworkFor(organization?.country_code).find((item) => item.key === "tax")?.inspectionWith?.local || null;
    const spread = monthsCovered({ from: coverStart, to: newExpiryDate }) >= 2 ? { from: coverStart, to: newExpiryDate } : undefined;
    const { error: inspectionError } = await supabase.from("transactions").insert({
      organization_id: organizationId,
      vehicle_id: vehicleId,
      type: "other",
      amount: inspectionCost,
      currency,
      transaction_date: coverStart < today ? coverStart : today,
      supplier: local,
      metadata: { source: "compliance_renewal", compliance_type: "inspection", compliance_event_id: complianceEvent.id, ...(spread ? { spread } : {}) },
      created_by: user.id
    });
    if (inspectionError) {
      throw new Error(inspectionError.message);
    }
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "compliance",
    entity_id: complianceEvent.id,
    vehicle_id: vehicleId,
    event_type: "compliance_renewed",
    title: `${config.label} renewed`,
    detail: `New expiry date: ${newExpiryDate}${cost ? `, cost ${currency} ${cost}${paidMonthly ? " a month" : ""}` : ""}.`
  });

  revalidatePath("/");
  revalidatePath("/fleet");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath(`/fleet/${vehicleId}`);
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function logVehicleMaintenance(...args: Parameters<typeof logVehicleMaintenanceOrThrow>) {
  return guard(() => logVehicleMaintenanceOrThrow(...args));
}

async function logVehicleMaintenanceOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const eventType = String(formData.get("eventType") || "").trim();
  const serviceDate = optionalStringFromForm(formData, "serviceDate");
  const cost = optionalNumberFromForm(formData, "cost");
  const mileage = optionalNumberFromForm(formData, "mileage");
  const supplier = optionalStringFromForm(formData, "supplier");
  const notes = optionalStringFromForm(formData, "notes");
  // Only a service sets the next service: a repair, tyres or a battery leaves it as it was.
  const setsNextService = eventType === "service" || eventType === "oil_change";
  const nextDueDate = setsNextService ? optionalStringFromForm(formData, "nextDueDate") : null;
  const nextDueMileage = setsNextService ? optionalNumberFromForm(formData, "nextDueMileage") : null;
  const oilChanged = String(formData.get("oilChanged") || "") === "true" || eventType === "oil_change";

  if (!vehicleId || !organizationId || !eventType || !serviceDate) {
    throw new Error("Vehicle, maintenance type, and service date are required.");
  }

  // The receipt belongs to the car's files and to the money entry.
  const receiptFile = formData.get("receiptFile");
  const receiptDocumentId = receiptFile instanceof File && receiptFile.size > 0
    ? await attachVehicleDocument({ supabase, file: receiptFile, organizationId, vehicleId, userId: user.id, category: "maintenance_receipt" })
    : null;

  // The cost is in the business's own money, not always baht.
  const { data: organization } = await supabase.from("organizations").select("currency").eq("id", organizationId).maybeSingle();
  const currency = organization?.currency || "THB";

  // What it cost is a money entry like any other, so it's in Money in & out and the reports.
  let transactionId: string | null = null;
  if (cost && cost > 0) {
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        organization_id: organizationId,
        vehicle_id: vehicleId,
        type: costTypeForService(eventType),
        amount: cost,
        currency,
        transaction_date: serviceDate,
        supplier,
        mileage,
        notes: notes || null,
        receipt_document_id: receiptDocumentId,
        created_by: user.id
      })
      .select("id")
      .single();
    if (transactionError) {
      throw new Error(transactionError.message);
    }
    transactionId = transaction.id;
  }

  const maintenanceId = await recordService(supabase, {
    organizationId,
    vehicleId,
    userId: user.id,
    kind: eventType,
    date: serviceDate,
    mileage,
    cost,
    supplier,
    notes,
    nextDueDate,
    nextDueMileage,
    oilChanged,
    transactionId
  });

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "maintenance",
    entity_id: maintenanceId,
    vehicle_id: vehicleId,
    event_type: "maintenance_completed",
    title: "Maintenance logged",
    detail: `${eventType} completed${oilChanged && eventType !== "oil_change" ? " with an oil change" : ""}${cost ? `, cost ${currency} ${cost}` : ""}.`
  });

  revalidatePath("/");
  revalidatePath("/fleet");
  revalidatePath("/transactions");
  revalidatePath("/reports");
  revalidatePath(`/fleet/${vehicleId}`);
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function updateVehicleNotes(...args: Parameters<typeof updateVehicleNotesOrThrow>) {
  return guard(() => updateVehicleNotesOrThrow(...args));
}

async function updateVehicleNotesOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const notes = String(formData.get("notes") || "");

  if (!vehicleId || !organizationId) {
    throw new Error("Vehicle is required.");
  }

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("metadata")
    .eq("id", vehicleId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (vehicleError || !vehicle) {
    throw new Error(vehicleError?.message || "Vehicle was not found.");
  }

  const metadata = vehicle.metadata || {};
  const { error } = await supabase
    .from("vehicles")
    .update({
      metadata: {
        ...metadata,
        notes,
        notes_updated_at: new Date().toISOString(),
        notes_updated_by: user.id
      }
    })
    .eq("id", vehicleId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/fleet/${vehicleId}`);
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function archiveVehicle(...args: Parameters<typeof archiveVehicleOrThrow>) {
  return guard(() => archiveVehicleOrThrow(...args));
}

async function archiveVehicleOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const organizationId = String(formData.get("organizationId") || "");

  if (!vehicleId || !organizationId) {
    throw new Error("Vehicle is required.");
  }

  // A vehicle with bookings still to come or on the road was archived without a word, leaving those customers
  // booked on a vehicle that is no longer in the fleet (real-user-test, 8 Nov 2026).
  const { data: liveBookings } = await supabase
    .from("rentals")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehicleId)
    .is("deleted_at", null)
    .not("status", "in", "(draft,completed,cancelled)")
    .limit(1);
  if (liveBookings?.length) {
    throw new Error("This vehicle has bookings that haven't finished. Move them to another vehicle or cancel them first.");
  }

  const { error } = await supabase
    .from("vehicles")
    .update({
      status: "inactive",
      availability_status: "offline"
    })
    .eq("id", vehicleId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "vehicle",
    entity_id: vehicleId,
    vehicle_id: vehicleId,
    event_type: "vehicle_archived",
    title: "Vehicle archived",
    detail: "Vehicle moved out of active operation."
  });

  revalidatePath("/");
  revalidatePath("/fleet");
  redirect("/fleet");
}

/** Puts an archived vehicle back in the fleet, free to rent (real-user test, 8 Nov 2026: there was no way back). */
export async function unarchiveVehicle(...args: Parameters<typeof unarchiveVehicleOrThrow>) {
  return guard(() => unarchiveVehicleOrThrow(...args));
}

async function unarchiveVehicleOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const membership = await getCurrentMembership();
  if (!membership) throw new Error("You must be signed in.");
  const vehicleId = String(formData.get("vehicleId") || "");
  if (!vehicleId) throw new Error("Vehicle is required.");
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, status, make, model, registration_number")
    .eq("id", vehicleId)
    .eq("organization_id", membership.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!vehicle) throw new Error("Vehicle not found.");
  if (vehicle.status === "inactive") {
    const { error } = await supabase
      .from("vehicles")
      .update({ status: "available", availability_status: "available_now" })
      .eq("id", vehicleId)
      .eq("organization_id", membership.organizationId);
    if (error) throw new Error(error.message);
    await recordActivityEvent(supabase, {
      organization_id: membership.organizationId,
      actor_id: user.id,
      entity_type: "vehicle",
      entity_id: vehicleId,
      vehicle_id: vehicleId,
      event_type: "vehicle_unarchived",
      title: "Vehicle back in the fleet",
      detail: [vehicle.make, vehicle.model, vehicle.registration_number].filter(Boolean).join(" ")
    });
  }
  revalidatePath("/");
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
}

/**
 * Delete vehicles and everything about them (owner only; Rory, 31 Oct 2026): every booking they have had, with its
 * payments, checks, photos and agreement, and their own costs, papers and photos. Archive is how an owner keeps
 * records. The database does it in one transaction per vehicle (purge_vehicle); the files it lists are then removed.
 */
async function purgeVehicles(organizationId: string, vehicleIds: string[]) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await getCurrentMembership();
  if (!membership || membership.organizationId !== organizationId || membership.role !== "owner") {
    redirect("/fleet?notice=vehicle-owner-only");
  }

  const db = createSupabaseAdminClient() as any;
  // Only vehicles of this business.
  const { data: owned } = await db.from("vehicles").select("id").eq("organization_id", organizationId).in("id", vehicleIds);
  const ids: string[] = (owned || []).map((row: { id: string }) => row.id);
  for (const id of ids) {
    const { data: files, error } = await db.rpc("purge_vehicle", { p_vehicle: id });
    if (error) throw new Error(error.message);
    await removeStoredFiles(db, files);
  }

  if (ids.length) {
    await recordActivityEvent(supabase, {
      organization_id: organizationId,
      actor_id: user.id,
      entity_type: "vehicle",
      entity_id: ids[0],
      event_type: ids.length === 1 ? "vehicle_deleted" : "vehicles_deleted",
      title: ids.length === 1 ? "Vehicle deleted" : "Vehicles deleted",
      detail: `${ids.length} vehicle${ids.length === 1 ? "" : "s"} deleted with all their bookings and records.`
    });
  }

  revalidatePath("/");
  revalidatePath("/fleet");
  revalidatePath("/bookings");
}

/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function deleteVehicle(...args: Parameters<typeof deleteVehicleOrThrow>) {
  return guard(() => deleteVehicleOrThrow(...args));
}

async function deleteVehicleOrThrow(formData: FormData) {
  const vehicleId = String(formData.get("vehicleId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  if (!vehicleId || !organizationId) {
    throw new Error("Vehicle is required.");
  }
  await purgeVehicles(organizationId, [vehicleId]);
  redirect("/fleet");
}

export async function bulkArchiveVehicles(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = String(formData.get("organizationId") || "");
  const vehicleIds = formData.getAll("vehicleIds").map((value) => String(value)).filter(Boolean);

  if (!organizationId || vehicleIds.length === 0) {
    throw new Error("Select at least one vehicle.");
  }

  // Archiving takes vehicles out of the business, like deleting, so only the owner can do it from the list.
  const membership = await getCurrentMembership();
  if (!membership || membership.organizationId !== organizationId || membership.role !== "owner") {
    redirect("/fleet?notice=vehicle-owner-only");
  }

  // The same check as archiving one vehicle: none with bookings still to come or on the road.
  const { data: liveBookings } = await supabase
    .from("rentals")
    .select("id")
    .eq("organization_id", organizationId)
    .in("vehicle_id", vehicleIds)
    .is("deleted_at", null)
    .not("status", "in", "(draft,completed,cancelled)")
    .limit(1);
  if (liveBookings?.length) {
    redirect("/fleet?notice=archive-live-bookings");
  }

  const { error } = await supabase
    .from("vehicles")
    .update({
      status: "inactive",
      availability_status: "offline"
    })
    .eq("organization_id", organizationId)
    .in("id", vehicleIds);

  if (error) {
    throw new Error(error.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "vehicle",
    entity_id: vehicleIds[0],
    vehicle_id: vehicleIds[0],
    event_type: "vehicles_archived",
    title: "Vehicles archived",
    detail: `${vehicleIds.length} vehicle${vehicleIds.length === 1 ? "" : "s"} archived.`
  });

  revalidatePath("/");
  revalidatePath("/fleet");
}

export async function bulkDeleteVehicles(formData: FormData) {
  const organizationId = String(formData.get("organizationId") || "");
  const vehicleIds = formData.getAll("vehicleIds").map((value) => String(value)).filter(Boolean);
  if (!organizationId || vehicleIds.length === 0) {
    throw new Error("Select at least one vehicle.");
  }
  await purgeVehicles(organizationId, vehicleIds);
}

/**
 * Quick price from the fleet list (Rory, 31 Oct 2026): one rate, per day, week or month, without opening the
 * edit page. The other rates are worked out from it when a booking is taken, as on the vehicle form.
 */
export async function setVehicleRate(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const vehicleId = String(formData.get("vehicleId") || "");
  const period = String(formData.get("period") || "");
  const amount = Math.round(Number(String(formData.get("rate") || "").replace(/,/g, "")));
  const column = ({ day: "daily_rate", week: "weekly_rate", month: "monthly_rate" } as Record<string, string>)[period];
  if (!vehicleId || !column) return { success: false, error: "Choose day, week or month." };
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Enter a price." };

  const membership = await getCurrentMembership();
  if (!membership) return { success: false, error: "You must be signed in." };
  const { error } = await supabase
    .from("vehicles")
    .update({ [column]: amount })
    .eq("id", vehicleId)
    .eq("organization_id", membership.organizationId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
  return { success: true };
}

/**
 * In the shop, or back and free to rent (Rory, 1 Nov 2026: there was no way to take a car out of "In the shop").
 * Only between those two: a car on rent or booked follows its booking.
 */
/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function setVehicleInShop(...args: Parameters<typeof setVehicleInShopOrThrow>) {
  return guard(() => setVehicleInShopOrThrow(...args));
}

async function setVehicleInShopOrThrow(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in.");
  const membership = await getCurrentMembership();
  if (!membership) throw new Error("You must be signed in.");
  const vehicleId = String(formData.get("vehicleId") || "");
  const inShop = String(formData.get("inShop") || "") === "true";
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, status, make, model, registration_number")
    .eq("id", vehicleId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (!vehicle) throw new Error("Vehicle not found.");
  if (!["available", "maintenance"].includes(String(vehicle.status || ""))) return;
  const { error } = await supabase
    .from("vehicles")
    .update(inShop ? { status: "maintenance", availability_status: "offline" } : { status: "available", availability_status: "available_now" })
    .eq("id", vehicleId)
    .eq("organization_id", membership.organizationId);
  if (error) throw new Error(error.message);
  await recordActivityEvent(supabase, {
    organization_id: membership.organizationId,
    actor_id: user.id,
    entity_type: "vehicle",
    entity_id: vehicleId,
    vehicle_id: vehicleId,
    event_type: inShop ? "vehicle_in_shop" : "vehicle_back_in_service",
    title: inShop ? "Vehicle in the shop" : "Vehicle back and free to rent",
    detail: [vehicle.make, vehicle.model, vehicle.registration_number].filter(Boolean).join(" ")
  });
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
  revalidatePath("/");
}
