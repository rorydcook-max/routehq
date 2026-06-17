"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { markOnboardingStep } from "@/lib/onboarding";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function numberFromForm(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").replace(/,/g, "").trim();
  return value ? Number(value) : 0;
}

function optionalNumberFromForm(formData: FormData, key: string) {
  const value = String(formData.get(key) || "").replace(/,/g, "").trim();
  return value ? Number(value) : null;
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

function csvValue(row: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(current);
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((cell) => cell.trim())) {
    rows.push(row);
  }

  const headers = (rows.shift() || []).map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]))
  );
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
  service: { label: "Service due", section: "compliance", field: "next_service_date" },
  oil: { label: "Oil change", section: "compliance", field: "oil_change_due_date" },
  finance: { label: "Finance end date", section: "finance", field: "end_date" }
};

export async function createVehicle(formData: FormData) {
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

  if (!organizationId || !categoryId || !make || !model || !registrationNumber) {
    throw new Error("Vehicle category, make, model, and registration number are required.");
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

  const finance = compactObject({
    lender: optionalStringFromForm(formData, "financeLender"),
    monthly_payment: optionalNumberFromForm(formData, "financeMonthlyPayment"),
    outstanding_balance: optionalNumberFromForm(formData, "financeOutstanding"),
    end_date: optionalStringFromForm(formData, "financeEndDate")
  });

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
      year: optionalNumberFromForm(formData, "year"),
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

    if (submissionError) {
      throw new Error(submissionError.message);
    }
  }

  const logbookFile = formData.get("logbookFile");
  if (logbookFile instanceof File && logbookFile.size > 0) {
    await attachLogbookDocument({
      supabase,
      file: logbookFile,
      organizationId,
      vehicleId: data.id,
      userId: user.id
    });
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
  redirect("/fleet");
}

export async function updateVehicle(formData: FormData) {
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

  if (!vehicleId || !organizationId || !categoryId || !make || !model || !registrationNumber) {
    throw new Error("Vehicle category, make, model, and registration number are required.");
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

  const finance = compactObject({
    lender: optionalStringFromForm(formData, "financeLender"),
    monthly_payment: optionalNumberFromForm(formData, "financeMonthlyPayment"),
    outstanding_balance: optionalNumberFromForm(formData, "financeOutstanding"),
    end_date: optionalStringFromForm(formData, "financeEndDate")
  });

  const acquisition = compactObject({
    purchase_mileage: optionalNumberFromForm(formData, "purchaseMileage")
  });

  const { error } = await supabase
    .from("vehicles")
    .update({
      make,
      model,
      category_id: categoryId,
      trim: optionalStringFromForm(formData, "trim"),
      year: optionalNumberFromForm(formData, "year"),
      vin: optionalStringFromForm(formData, "vin"),
      registration_number: registrationNumber,
      color: optionalStringFromForm(formData, "color"),
      purchase_price: optionalNumberFromForm(formData, "purchasePrice"),
      estimated_value: optionalNumberFromForm(formData, "estimatedValue"),
      mileage: numberFromForm(formData, "mileage"),
      home_branch_id: optionalStringFromForm(formData, "homeBranchId"),
      service_area: serviceArea,
      daily_rate: numberFromForm(formData, "dailyRate"),
      weekly_rate: numberFromForm(formData, "weeklyRate"),
      monthly_rate: numberFromForm(formData, "monthlyRate"),
      specifications,
      metadata: {
        acquisition,
        compliance,
        finance
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

export async function uploadVehiclePhotos(formData: FormData) {
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

  const vehicle = await requireVehicleAccess(supabase, vehicleId, organizationId);

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Vehicle photos must be image files.");
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "upload";
    const storagePath = `${organizationId}/vehicle/${vehicleId}/photos/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name || `vehicle-photo.${extension}`)}`;
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
      file_name: file.name || `vehicle-photo.${extension}`,
      mime_type: file.type || null,
      size_bytes: file.size,
      category: "vehicle_photo",
      ocr_status: "not_started",
      extracted_data: {},
      uploaded_by: user.id
    });

    if (documentError) {
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

export async function removeVehiclePhoto(formData: FormData) {
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

  const vehicle = await requireVehicleAccess(supabase, vehicleId, organizationId);
  const { data: document, error: documentError } = await supabase
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

  const { error: updateError } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("organization_id", organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await supabase.storage.from(document.storage_bucket || "documents").remove([document.storage_path]);

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

export async function reorderVehiclePhotos(formData: FormData) {
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

  await requireVehicleAccess(supabase, vehicleId, organizationId);

  const photoIds = JSON.parse(rawOrder);
  if (!Array.isArray(photoIds) || photoIds.some((id) => typeof id !== "string")) {
    throw new Error("Invalid photo order.");
  }

  const { data: documents, error: documentError } = await supabase
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
  await Promise.all(
    photoIds.map((photoId, index) => {
      const document = documentById.get(photoId);
      if (!document) {
        return Promise.resolve();
      }
      const extractedData =
        typeof document.extracted_data === "object" && document.extracted_data !== null && !Array.isArray(document.extracted_data)
          ? document.extracted_data
          : {};

      return supabase
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

  if (cost !== null) {
    nextSection[`${config.field}_last_cost`] = cost;
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

  const { error: updateError } = await supabase
    .from("vehicles")
    .update({
      metadata: {
        ...metadata,
        [config.section]: nextSection
      }
    })
    .eq("id", vehicleId)
    .eq("organization_id", organizationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { data: complianceEvent, error: complianceError } = await supabase
    .from("compliance_events")
    .insert({
      organization_id: organizationId,
      vehicle_id: vehicleId,
      compliance_type: complianceType,
      effective_date: new Date().toISOString().slice(0, 10),
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

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "compliance",
    entity_id: complianceEvent.id,
    vehicle_id: vehicleId,
    event_type: "compliance_renewed",
    title: `${config.label} renewed`,
    detail: `New expiry date: ${newExpiryDate}${cost ? `, cost THB ${cost}` : ""}.`
  });

  revalidatePath("/");
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
}

export async function logVehicleMaintenance(formData: FormData) {
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
  const nextDueDate = optionalStringFromForm(formData, "nextDueDate");
  const nextDueMileage = optionalNumberFromForm(formData, "nextDueMileage");

  if (!vehicleId || !organizationId || !eventType || !serviceDate) {
    throw new Error("Vehicle, maintenance type, and service date are required.");
  }

  let transactionId: string | null = null;

  if (cost && cost > 0) {
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        organization_id: organizationId,
        vehicle_id: vehicleId,
        type: eventType === "repair" ? "repair" : "maintenance",
        amount: cost,
        currency: "THB",
        transaction_date: serviceDate,
        supplier,
        mileage,
        notes: notes || `${eventType} logged from vehicle profile.`,
        created_by: user.id
      })
      .select("id")
      .single();

    if (transactionError) {
      throw new Error(transactionError.message);
    }

    transactionId = transaction.id;
  }

  const receiptFile = formData.get("receiptFile");
  const receiptDocumentId = receiptFile instanceof File && receiptFile.size > 0
    ? await attachVehicleDocument({
        supabase,
        file: receiptFile,
        organizationId,
        vehicleId,
        userId: user.id,
        category: "maintenance_receipt"
      })
    : null;

  const { data: maintenance, error: maintenanceError } = await supabase
    .from("maintenance_events")
    .insert({
      organization_id: organizationId,
      vehicle_id: vehicleId,
      transaction_id: transactionId,
      event_type: eventType,
      service_date: serviceDate,
      mileage,
      cost,
      supplier,
      notes: [notes, receiptDocumentId ? `Receipt: ${receiptDocumentId}` : ""].filter(Boolean).join("\n") || null,
      next_due_date: nextDueDate,
      next_due_mileage: nextDueMileage,
      created_by: user.id
    })
    .select("id")
    .single();

  if (maintenanceError) {
    throw new Error(maintenanceError.message);
  }

  if (mileage !== null) {
    const { data: vehicle } = await supabase.from("vehicles").select("mileage").eq("id", vehicleId).eq("organization_id", organizationId).maybeSingle();
    if (vehicle && mileage > Number(vehicle.mileage || 0)) {
      await supabase.from("vehicles").update({ mileage }).eq("id", vehicleId).eq("organization_id", organizationId);
    }
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "maintenance",
    entity_id: maintenance.id,
    vehicle_id: vehicleId,
    event_type: "maintenance_completed",
    title: "Maintenance logged",
    detail: `${eventType} completed${cost ? `, cost THB ${cost}` : ""}.`
  });

  revalidatePath("/");
  revalidatePath("/fleet");
  revalidatePath(`/fleet/${vehicleId}`);
}

export async function updateVehicleNotes(formData: FormData) {
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

export async function archiveVehicle(formData: FormData) {
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

export async function deleteVehicle(formData: FormData) {
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

  const { error } = await supabase
    .from("vehicles")
    .update({
      deleted_at: new Date().toISOString(),
      status: "retired",
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
    event_type: "vehicle_deleted",
    title: "Vehicle deleted",
    detail: "Vehicle was soft-deleted from the fleet."
  });

  revalidatePath("/");
  revalidatePath("/fleet");
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

  const { error } = await supabase
    .from("vehicles")
    .update({
      deleted_at: new Date().toISOString(),
      status: "retired",
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
    event_type: "vehicles_deleted",
    title: "Vehicles deleted",
    detail: `${vehicleIds.length} vehicle${vehicleIds.length === 1 ? "" : "s"} soft-deleted.`
  });

  revalidatePath("/");
  revalidatePath("/fleet");
}

export async function importVehicles(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizationId = String(formData.get("organizationId") || "");
  const defaultCategoryId = String(formData.get("defaultCategoryId") || "");
  const defaultHomeBranchId = optionalStringFromForm(formData, "defaultHomeBranchId");
  const pastedCsv = String(formData.get("csvText") || "").trim();
  const upload = formData.get("csvFile");
  const uploadedCsv = upload instanceof File && upload.size > 0 ? await upload.text() : "";
  const csvText = uploadedCsv || pastedCsv;

  if (!organizationId || !defaultCategoryId || !csvText) {
    throw new Error("Choose defaults and provide a CSV file or pasted CSV rows.");
  }

  const rows = parseCsv(csvText);
  const vehicles = rows
    .map((row) => {
      const make = csvValue(row, "make", "brand");
      const model = csvValue(row, "model");
      const registrationNumber = csvValue(row, "registration_number", "plate", "license_plate", "registration", "ทะเบียน").toUpperCase();

      if (!make || !model || !registrationNumber) {
        return null;
      }

      const transmission = csvValue(row, "transmission");
      const seatingCapacity = Number(csvValue(row, "seating_capacity", "seats")) || null;
      const engineCc = Number(csvValue(row, "engine_cc", "engine")) || null;

      return {
        organization_id: organizationId,
        category_id: defaultCategoryId,
        home_branch_id: defaultHomeBranchId,
        service_area: csvValue(row, "service_area") === "all_branches" ? "all_branches" : "home_branch",
        partner_network_enabled: false,
        make,
        model,
        trim: csvValue(row, "trim") || null,
        year: Number(csvValue(row, "year")) || null,
        vin: csvValue(row, "vin", "frame_number") || null,
        registration_number: registrationNumber,
        color: csvValue(row, "color", "colour") || null,
        purchase_price: Number(csvValue(row, "purchase_price")) || null,
        estimated_value: Number(csvValue(row, "estimated_value")) || null,
        mileage: Number(csvValue(row, "mileage", "current_mileage")) || 0,
        status: "available",
        availability_status: "available_now",
        daily_rate: Number(csvValue(row, "daily_rate")) || 0,
        weekly_rate: Number(csvValue(row, "weekly_rate")) || 0,
        monthly_rate: Number(csvValue(row, "monthly_rate")) || 0,
        utilization_12_month: 0,
        utilization_lifecycle: 0,
        revenue_generated: 0,
        profit_generated: 0,
        health_score: 100,
        specifications: compactObject({
          transmission,
          seating_capacity: seatingCapacity,
          engine_cc: engineCc
        }),
        metadata: {
          compliance: compactObject({
            tax_expiry_date: csvValue(row, "tax_expiry_date", "tax_expiry") || null,
            porbor_expiry_date: csvValue(row, "porbor_expiry_date", "compulsory_insurance_expiry") || null,
            insurance_expiry_date: csvValue(row, "insurance_expiry_date", "full_insurance_expiry") || null,
            next_service_date: csvValue(row, "next_service_date") || null,
            oil_change_due_date: csvValue(row, "oil_change_due_date") || null
          }),
          finance: compactObject({
            lender: csvValue(row, "finance_lender", "finance_provider") || null,
            monthly_payment: Number(csvValue(row, "finance_monthly_payment")) || null,
            outstanding_balance: Number(csvValue(row, "finance_outstanding")) || null,
            end_date: csvValue(row, "finance_end_date") || null
          })
        },
        created_by: user.id
      };
    })
    .filter(Boolean);

  if (vehicles.length === 0) {
    throw new Error("No valid vehicles found. Required columns: make, model, registration_number.");
  }

  const { data, error } = await supabase.from("vehicles").insert(vehicles).select("id");
  if (error) {
    throw new Error(error.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "vehicle",
    entity_id: data?.[0]?.id || organizationId,
    event_type: "vehicles_imported",
    title: "Vehicles imported",
    detail: `${vehicles.length} vehicles imported from CSV.`
  });

  revalidatePath("/");
  revalidatePath("/fleet");
  redirect("/fleet");
}
