import { NextResponse } from "next/server";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { cleanPlate, cleanString, normalizeTransactionType, parseDateValue, parseIntegerValue, parseNumberValue } from "@/lib/import/normalize";
import { googleSheetToSpreadsheetInput, isGoogleSheetsUrl, parseSpreadsheetFile } from "@/lib/import/spreadsheet";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Mapping = {
  source_column: string;
  fleetos_field: string;
};

type SheetMapping = {
  sheet_name: string;
  primary_data_type: string;
  column_mappings: Mapping[];
};

function compactObject(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "" && value !== null && value !== undefined));
}

function mappedRow(row: Record<string, string>, mappings: Mapping[]) {
  const output: Record<string, string> = {};
  mappings.forEach((mapping) => {
    if (!mapping.fleetos_field || mapping.fleetos_field === "__ignore__") {
      return;
    }
    output[mapping.fleetos_field] = row[mapping.source_column] || "";
  });
  return output;
}

function normalizeDataType(value: string, mappings: Mapping[]) {
  const cleaned = cleanString(value).toLowerCase();
  if (["vehicles", "customers", "rentals", "transactions"].includes(cleaned)) {
    return cleaned;
  }

  const fields = new Set(mappings.map((mapping) => mapping.fleetos_field));
  if (fields.has("amount") && fields.has("type")) return "transactions";
  if (fields.has("start_date") || fields.has("end_date") || fields.has("customer_name")) return "rentals";
  if (fields.has("full_name") || fields.has("passport_number") || fields.has("driving_licence_number")) return "customers";
  return "vehicles";
}

function splitVehicleName(value: string) {
  const parts = cleanString(value).split(/\s+/).filter(Boolean);
  return {
    make: parts[0] || "",
    model: parts.slice(1, 3).join(" "),
    trim: parts.slice(3).join(" ")
  };
}

async function findOrCreateCustomer(supabase: any, organizationId: string, fields: Record<string, string>, userId: string) {
  const fullName = cleanString(fields.full_name || fields.customer_name);
  if (!fullName) {
    return null;
  }

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("full_name", fullName)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: organizationId,
      full_name: fullName,
      phone: cleanString(fields.phone) || null,
      email: cleanString(fields.email) || null,
      nationality: cleanString(fields.nationality) || null,
      passport_number: cleanString(fields.passport_number) || null,
      driver_license_number: cleanString(fields.driving_licence_number) || null,
      notes: cleanString(fields.notes) || null,
      created_by: userId
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id;
}

export async function POST(request: Request) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please log in before importing data." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const sheetUrl = String(formData.get("sheetUrl") || "").trim();
  const mappingText = String(formData.get("mapping") || "");

  if (((!(file instanceof File) || file.size === 0) && !sheetUrl) || !mappingText) {
    return NextResponse.json({ error: "Spreadsheet source and confirmed mapping are required." }, { status: 400 });
  }

  let mappings: SheetMapping[];
  try {
    mappings = JSON.parse(mappingText);
  } catch {
    return NextResponse.json({ error: "Mapping JSON was invalid." }, { status: 400 });
  }

  let sheets;
  try {
    const spreadsheetInput = sheetUrl
      ? await googleSheetToSpreadsheetInput(sheetUrl)
      : file instanceof File
        ? file
        : null;

    if (!spreadsheetInput) {
      return NextResponse.json({ error: "Spreadsheet source is required." }, { status: 400 });
    }

    if (sheetUrl && !isGoogleSheetsUrl(sheetUrl)) {
      return NextResponse.json({ error: "Only public Google Sheets links are supported." }, { status: 400 });
    }

    sheets = await parseSpreadsheetFile(spreadsheetInput);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to parse spreadsheet." }, { status: 400 });
  }

  const organization = await getDefaultOrganization();
  const categories = await getVehicleCategories(organization.id);
  const defaultCategory = categories.find((category) => category.code === "car") || categories[0];
  const skipped: string[] = [];
  const imported = {
    customers: 0,
    rentals: 0,
    transactions: 0,
    vehicles: 0
  };

  for (let sheetIndex = 0; sheetIndex < mappings.length; sheetIndex += 1) {
    const sheetMapping = mappings[sheetIndex];
    const sheet =
      sheets.find((item) => item.sheetName === sheetMapping.sheet_name) ||
      (sheets.length === mappings.length ? sheets[sheetIndex] : null) ||
      (sheets.length === 1 ? sheets[0] : null);

    if (!sheet) {
      skipped.push(`Sheet "${sheetMapping.sheet_name}" was not found in the uploaded file.`);
      continue;
    }

    const primaryDataType = normalizeDataType(sheetMapping.primary_data_type, sheetMapping.column_mappings);

    for (let index = 0; index < sheet.rows.length; index += 1) {
      const fields = mappedRow(sheet.rows[index], sheetMapping.column_mappings);
      const rowNumber = index + 2;

      try {
        if (primaryDataType === "customers") {
          const customerId = await findOrCreateCustomer(supabase, organization.id, fields, user.id);
          if (customerId) imported.customers += 1;
          else skipped.push(`Row ${rowNumber}: missing customer name`);
          continue;
        }

        if (primaryDataType === "rentals") {
          const plate = cleanPlate(fields.vehicle_registration);
          const customerId = await findOrCreateCustomer(supabase, organization.id, fields, user.id);
          const startDate = parseDateValue(fields.start_date);
          const { data: vehicle } = await supabase
            .from("vehicles")
            .select("id")
            .eq("organization_id", organization.id)
            .eq("registration_number", plate)
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle();

          if (!plate || !vehicle?.id || !customerId || !startDate) {
            skipped.push(`Row ${rowNumber}: missing vehicle, customer, or start date`);
            continue;
          }

          const { error } = await supabase.from("rentals").insert({
            organization_id: organization.id,
            customer_id: customerId,
            vehicle_id: vehicle.id,
            start_date: startDate,
            end_date: parseDateValue(fields.end_date),
            pricing_model: "monthly",
            rental_rate: parseNumberValue(fields.monthly_rate) || 0,
            deposit_amount: parseNumberValue(fields.deposit_amount) || 0,
            currency: organization.currency || "THB",
            status: "booked",
            created_by: user.id
          });
          if (error) throw new Error(error.message);
          imported.rentals += 1;
          continue;
        }

        if (primaryDataType === "transactions") {
          const plate = cleanPlate(fields.vehicle_registration);
          const amount = parseNumberValue(fields.amount);
          const { data: vehicle } = await supabase
            .from("vehicles")
            .select("id")
            .eq("organization_id", organization.id)
            .eq("registration_number", plate)
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle();

          if (!vehicle?.id || amount === null) {
            skipped.push(`Row ${rowNumber}: missing vehicle or amount`);
            continue;
          }

          const { error } = await supabase.from("transactions").insert({
            organization_id: organization.id,
            vehicle_id: vehicle.id,
            transaction_date: parseDateValue(fields.date) || new Date().toISOString().slice(0, 10),
            type: normalizeTransactionType(fields.type),
            amount,
            currency: organization.currency || "THB",
            notes: cleanString(fields.notes) || null,
            created_by: user.id
          });
          if (error) throw new Error(error.message);
          imported.transactions += 1;
          continue;
        }

        const registrationNumber = cleanPlate(fields.registration_number || fields.vehicle_registration);
        const combinedVehicle = splitVehicleName(fields.vehicle || fields.vehicle_name || fields.description);
        const make = cleanString(fields.make) || combinedVehicle.make;
        const model = cleanString(fields.model) || combinedVehicle.model;
        const trim = cleanString(fields.trim) || combinedVehicle.trim;

        if (!registrationNumber || !make || !model || !defaultCategory?.id) {
          skipped.push(`Row ${rowNumber}: missing registration number, make, or model`);
          continue;
        }

        const { error } = await supabase.from("vehicles").insert({
          organization_id: organization.id,
          category_id: defaultCategory.id,
          make,
          model,
          trim: trim || null,
          year: parseIntegerValue(fields.year),
          vin: cleanString(fields.vin) || null,
          registration_number: registrationNumber,
          color: cleanString(fields.color) || null,
          purchase_date: parseDateValue(fields.purchase_date),
          purchase_price: parseNumberValue(fields.purchase_price),
          estimated_value: parseNumberValue(fields.estimated_value),
          mileage: parseIntegerValue(fields.current_mileage) || 0,
          status: "available",
          availability_status: "available_now",
          daily_rate: parseNumberValue(fields.daily_rate) || 0,
          weekly_rate: parseNumberValue(fields.weekly_rate) || 0,
          monthly_rate: parseNumberValue(fields.monthly_rate) || 0,
          utilization_12_month: 0,
          utilization_lifecycle: 0,
          revenue_generated: 0,
          profit_generated: 0,
          health_score: 100,
          specifications: compactObject({
            transmission: cleanString(fields.transmission),
            engine_cc: parseIntegerValue(fields.engine_cc),
            fuel_type: cleanString(fields.fuel_type),
            seating_capacity: parseIntegerValue(fields.seating_capacity),
            drivetrain: cleanString(fields.drivetrain),
            body_type: cleanString(fields.body_type)
          }),
          metadata: {
            acquisition: compactObject({
              purchase_mileage: parseIntegerValue(fields.purchase_mileage)
            }),
            compliance: compactObject({
              tax_expiry_date: parseDateValue(fields.tax_expiry_date),
              tax_cost: parseNumberValue(fields.tax_cost),
              insurance_expiry_date: parseDateValue(fields.insurance_expiry_date),
              insurance_cost: parseNumberValue(fields.insurance_cost),
              insurance_sum_insured: parseNumberValue(fields.insurance_sum_insured),
              porbor_expiry_date: parseDateValue(fields.porbor_expiry_date),
              porbor_cost: parseNumberValue(fields.porbor_cost),
              next_service_date: parseDateValue(fields.next_service_date)
            }),
            finance: compactObject({
              lender: cleanString(fields.finance_lender),
              monthly_payment: parseNumberValue(fields.finance_monthly_payment),
              outstanding_balance: parseNumberValue(fields.finance_outstanding),
              end_date: parseDateValue(fields.finance_end_date)
            }),
            import: compactObject({
              gps_tracker_url: cleanString(fields.gps_tracker_url),
              notes: cleanString(fields.notes)
            })
          },
          created_by: user.id
        });

        if (error) {
          if (String(error.message).toLowerCase().includes("duplicate")) {
            skipped.push(`Row ${rowNumber}: duplicate registration number`);
            continue;
          }
          throw new Error(error.message);
        }

        imported.vehicles += 1;
      } catch (error) {
        skipped.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : "import failed"}`);
      }
    }
  }

  if (imported.vehicles || imported.customers || imported.rentals || imported.transactions) {
    await recordActivityEvent(supabase, {
      organization_id: organization.id,
      actor_id: user.id,
      entity_type: "organization",
      entity_id: organization.id,
      event_type: "smart_import_completed",
      title: "Smart import completed",
      detail: `${imported.vehicles} vehicles, ${imported.customers} customers, ${imported.rentals} rentals, ${imported.transactions} transactions imported.`
    });
  }

  if (!imported.vehicles && !imported.customers && !imported.rentals && !imported.transactions) {
    return NextResponse.json(
      {
        error: "No rows were imported. Review the mapping and make sure required fields are mapped.",
        imported,
        skipped: skipped.length ? skipped : ["No matching sheet or importable rows were found."]
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ imported, skipped });
}
