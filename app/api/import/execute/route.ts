import { NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { businessToday } from "@/lib/business-time";
import {
  cleanPlate,
  cleanString,
  normalizeTransactionType,
  parseDateValue,
  parseIntegerValue,
  parseKnownNumber,
  parseNumberValue
} from "@/lib/import/normalize";
import { googleSheetToSpreadsheetInput, isGoogleSheetsUrl, parseSpreadsheetFile } from "@/lib/import/spreadsheet";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Mapping = { source_column: string; routehq_field: string };
type SheetMapping = { sheet_name: string; primary_data_type: string; column_mappings: Mapping[] };
type Fields = Record<string, string>;

function compactObject(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "" && value !== null && value !== undefined));
}

function mappedRow(row: Record<string, string>, mappings: Mapping[]) {
  const output: Fields = {};
  mappings.forEach((mapping) => {
    if (!mapping.routehq_field || mapping.routehq_field === "__ignore__") return;
    output[mapping.routehq_field] = row[mapping.source_column] || "";
  });
  return output;
}

function normalizeDataType(value: string, mappings: Mapping[]) {
  const cleaned = cleanString(value).toLowerCase();
  if (["vehicles", "customers", "rentals", "transactions"].includes(cleaned)) return cleaned;
  const fields = new Set(mappings.map((mapping) => mapping.routehq_field));
  if (fields.has("amount") && fields.has("type")) return "transactions";
  if (fields.has("vehicle_registration") && fields.has("start_date")) return "rentals";
  if (fields.has("full_name") || fields.has("passport_number") || fields.has("driving_licence_number")) return "customers";
  return "vehicles";
}

function splitVehicleName(value: string) {
  const parts = cleanString(value).split(/\s+/).filter(Boolean);
  return { make: parts[0] || "", model: parts.slice(1, 3).join(" "), trim: parts.slice(3).join(" ") };
}

async function findOrCreateCustomer(supabase: any, organizationId: string, fields: Fields, userId: string) {
  const fullName = cleanString(fields.full_name || fields.customer_name);
  if (!fullName) return null;

  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    // Same person regardless of capitalisation; % and _ are escaped so a name can't act as a wildcard.
    .ilike("full_name", fullName.replace(/[\\%_]/g, (character) => `\\${character}`))
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return { id: existing.id as string, created: false };

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
      created_by: userId
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, created: true };
}

/**
 * A rental taken over from a spreadsheet. It is marked as entered by the
 * operator, so the booking asks for payments to be set up rather than
 * inventing a schedule, and no contract is generated for it.
 */
async function createImportedRental(
  supabase: any,
  context: { organizationId: string; currency: string; userId: string },
  input: { vehicleId: string; customerId: string; fields: Fields }
) {
  const startDate = parseDateValue(input.fields.start_date);
  if (!startDate) return { error: "no rental start date" as const };
  const endDate = parseDateValue(input.fields.end_date);
  const today = businessToday();
  const status = endDate && endDate < today ? "completed" : startDate > today ? "booked" : "active";

  const { data: rental, error } = await supabase
    .from("rentals")
    .insert({
      organization_id: context.organizationId,
      customer_id: input.customerId,
      vehicle_id: input.vehicleId,
      start_date: startDate,
      end_date: endDate,
      is_indefinite: !endDate,
      pricing_model: "monthly",
      billing_interval: "monthly",
      rental_rate: parseNumberValue(input.fields.rental_rate) || 0,
      deposit_amount: parseNumberValue(input.fields.deposit_amount) || 0,
      mileage_at_delivery: parseIntegerValue(parseKnownNumber(input.fields.mileage_at_start)),
      currency: context.currency,
      status,
      entered_by_operator: true,
      created_by: context.userId
    })
    .select("id, status")
    .single();
  if (error) throw new Error(error.message);

  if (status === "active") {
    await supabase
      .from("vehicles")
      .update({ status: "rented", availability_status: "rented", current_rental_id: rental.id, current_customer_id: input.customerId })
      .eq("id", input.vehicleId)
      .eq("organization_id", context.organizationId);
  }
  return { id: rental.id as string, status };
}

async function vehicleIdForPlate(supabase: any, organizationId: string, plate: string) {
  if (!plate) return null;
  const { data } = await supabase
    .from("vehicles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("registration_number", plate)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return (data?.id as string) || null;
}

export async function POST(request: Request) {
  const membership = await getCurrentMembership();
  if (!membership) return NextResponse.json({ error: "Please sign in before importing data." }, { status: 401 });
  if (membership.role !== "owner") return NextResponse.json({ error: "Only the business owner can import data." }, { status: 403 });

  const supabase = (await createSupabaseServerClient()) as any;
  const formData = await request.formData();
  const file = formData.get("file");
  const sheetUrl = String(formData.get("sheetUrl") || "").trim();
  const mappingText = String(formData.get("mapping") || "");

  if (((!(file instanceof File) || file.size === 0) && !sheetUrl) || !mappingText) {
    return NextResponse.json({ error: "Spreadsheet source and confirmed mapping are required." }, { status: 400 });
  }
  if (sheetUrl && !isGoogleSheetsUrl(sheetUrl)) {
    return NextResponse.json({ error: "Only public Google Sheets links are supported." }, { status: 400 });
  }

  let mappings: SheetMapping[];
  try {
    mappings = JSON.parse(mappingText);
  } catch {
    return NextResponse.json({ error: "Mapping was invalid." }, { status: 400 });
  }

  let sheets;
  try {
    sheets = await parseSpreadsheetFile(sheetUrl ? await googleSheetToSpreadsheetInput(sheetUrl) : (file as File));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read the spreadsheet." }, { status: 400 });
  }

  const organization = await getDefaultOrganization();
  if (organization.id !== membership.organizationId) {
    return NextResponse.json({ error: "Switch to the business you want to import into and try again." }, { status: 409 });
  }
  const currency = organization.currency || "THB";
  const categories = await getVehicleCategories(organization.id);
  const defaultCategory = categories.find((category) => category.code === "car") || categories[0];
  const skipped: string[] = [];
  const warnings: string[] = [];
  const imported = { vehicles: 0, customers: 0, rentals: 0, transactions: 0 };
  const context = { organizationId: organization.id, currency, userId: membership.userId };

  for (let sheetIndex = 0; sheetIndex < mappings.length; sheetIndex += 1) {
    const sheetMapping = mappings[sheetIndex];
    const sheet = sheets.find((item) => item.sheetName === sheetMapping.sheet_name) || (sheets.length === 1 ? sheets[0] : null);
    if (!sheet) {
      skipped.push(`Sheet "${sheetMapping.sheet_name}" was not found in the spreadsheet.`);
      continue;
    }

    const primaryDataType = normalizeDataType(sheetMapping.primary_data_type, sheetMapping.column_mappings);

    for (let index = 0; index < sheet.rows.length; index += 1) {
      const fields = mappedRow(sheet.rows[index], sheetMapping.column_mappings);
      // Rows are named by what they contain; spreadsheet row numbers shift once blank rows are dropped.
      const label = `${sheet.sheetName} row ${index + 1}${fields.registration_number || fields.vehicle_registration ? ` (${cleanString(fields.registration_number || fields.vehicle_registration)})` : fields.full_name || fields.customer_name ? ` (${cleanString(fields.full_name || fields.customer_name)})` : ""}`;
      if (!Object.values(fields).some((value) => cleanString(value))) continue;

      try {
        if (primaryDataType === "customers") {
          const customer = await findOrCreateCustomer(supabase, organization.id, fields, membership.userId);
          if (!customer) skipped.push(`${label}: no customer name`);
          else if (customer.created) imported.customers += 1;
          else skipped.push(`${label}: customer already exists - not changed`);
          continue;
        }

        if (primaryDataType === "rentals") {
          const plate = cleanPlate(fields.vehicle_registration);
          const vehicleId = await vehicleIdForPlate(supabase, organization.id, plate);
          if (!vehicleId) {
            skipped.push(`${label}: ${plate ? `no vehicle with plate ${plate} - import vehicles first` : "no vehicle plate"}`);
            continue;
          }
          const customer = await findOrCreateCustomer(supabase, organization.id, fields, membership.userId);
          if (!customer) {
            skipped.push(`${label}: no customer name`);
            continue;
          }
          if (customer.created) imported.customers += 1;
          const rental = await createImportedRental(supabase, context, {
            vehicleId,
            customerId: customer.id,
            fields: { ...fields, rental_rate: fields.rental_rate || fields.monthly_rate }
          });
          if ("error" in rental) skipped.push(`${label}: ${rental.error}`);
          else imported.rentals += 1;
          continue;
        }

        if (primaryDataType === "transactions") {
          const plate = cleanPlate(fields.vehicle_registration);
          const amount = parseNumberValue(fields.amount);
          const vehicleId = await vehicleIdForPlate(supabase, organization.id, plate);
          if (!vehicleId || amount === null) {
            skipped.push(`${label}: ${amount === null ? "no amount" : plate ? `no vehicle with plate ${plate}` : "no vehicle plate"}`);
            continue;
          }
          const date = parseDateValue(fields.date);
          if (!date) warnings.push(`${label}: no readable date - recorded as today`);
          const { error } = await supabase.from("transactions").insert({
            organization_id: organization.id,
            vehicle_id: vehicleId,
            transaction_date: date || businessToday(),
            type: normalizeTransactionType(fields.type),
            amount: Math.abs(amount),
            currency,
            notes: cleanString(fields.notes) || null,
            created_by: membership.userId
          });
          if (error) throw new Error(error.message);
          imported.transactions += 1;
          continue;
        }

        // Vehicles (optionally with the rental currently running on each one).
        const registrationNumber = cleanPlate(fields.registration_number || fields.vehicle_registration);
        const combinedVehicle = splitVehicleName(fields.vehicle_name || fields.vehicle || fields.description);
        const make = cleanString(fields.make) || combinedVehicle.make;
        const model = cleanString(fields.model) || combinedVehicle.model;
        const trim = cleanString(fields.trim) || combinedVehicle.trim;

        if (!registrationNumber || !make || !model || !defaultCategory?.id) {
          const missing = [!registrationNumber && "plate", !make && "make", !model && "model"].filter(Boolean).join(", ");
          skipped.push(`${label}: missing ${missing || "vehicle category"}`);
          continue;
        }

        if (await vehicleIdForPlate(supabase, organization.id, registrationNumber)) {
          skipped.push(`${label}: ${registrationNumber} is already in your fleet - not changed`);
          continue;
        }

        const mileage = parseIntegerValue(parseKnownNumber(fields.current_mileage));
        if (mileage === null) warnings.push(`${label}: current mileage not known - set it on the vehicle before its next handover`);

        const { data: vehicle, error } = await supabase
          .from("vehicles")
          .insert({
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
            mileage: mileage ?? 0,
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
              engine_size: cleanString(fields.engine_cc),
              fuel_type: cleanString(fields.fuel_type),
              seating_capacity: parseIntegerValue(fields.seating_capacity),
              drivetrain: cleanString(fields.drivetrain),
              body_type: cleanString(fields.body_type)
            }),
            metadata: {
              acquisition: compactObject({ purchase_mileage: parseIntegerValue(parseKnownNumber(fields.purchase_mileage)) }),
              compliance: compactObject({
                tax_expiry_date: parseDateValue(fields.tax_expiry_date),
                tax_cost: parseNumberValue(fields.tax_cost),
                insurance_expiry_date: parseDateValue(fields.insurance_expiry_date),
                insurance_cost: parseNumberValue(fields.insurance_cost),
                insurance_sum_insured: parseNumberValue(fields.insurance_sum_insured),
                insurance_excess: parseNumberValue(fields.insurance_excess),
                porbor_expiry_date: parseDateValue(fields.porbor_expiry_date),
                porbor_cost: parseNumberValue(fields.porbor_cost),
                last_service_date: parseDateValue(fields.last_service_date),
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
                notes: cleanString(fields.notes),
                mileage_unknown: mileage === null ? true : null
              })
            },
            created_by: membership.userId
          })
          .select("id")
          .single();

        if (error) {
          if (String(error.message).toLowerCase().includes("duplicate")) {
            skipped.push(`${label}: ${registrationNumber} is already in your fleet - not changed`);
            continue;
          }
          throw new Error(error.message);
        }
        imported.vehicles += 1;

        // The sheet may also say who is renting this vehicle right now.
        if (cleanString(fields.customer_name) && cleanString(fields.start_date)) {
          const customer = await findOrCreateCustomer(supabase, organization.id, fields, membership.userId);
          if (customer) {
            if (customer.created) imported.customers += 1;
            const rental = await createImportedRental(supabase, context, { vehicleId: vehicle.id, customerId: customer.id, fields });
            if ("error" in rental) warnings.push(`${label}: current rental not created - ${rental.error}`);
            else {
              imported.rentals += 1;
              warnings.push(`${label}: rental for ${cleanString(fields.customer_name)} added - open it to set up its payments`);
            }
          }
        }
      } catch (error) {
        skipped.push(`${label}: ${error instanceof Error ? error.message : "import failed"}`);
      }
    }
  }

  const total = imported.vehicles + imported.customers + imported.rentals + imported.transactions;
  if (total) {
    await recordActivityEvent(supabase, {
      organization_id: organization.id,
      actor_id: membership.userId,
      entity_type: "organization",
      entity_id: organization.id,
      event_type: "smart_import_completed",
      title: "Spreadsheet import completed",
      detail: `${imported.vehicles} vehicles, ${imported.customers} customers, ${imported.rentals} rentals, ${imported.transactions} transactions imported.`
    });
  }

  if (!total) {
    return NextResponse.json(
      {
        error: "Nothing was imported. Check the column mapping - vehicles need a plate, make and model.",
        imported,
        skipped: skipped.length ? skipped : ["No importable rows were found."],
        warnings
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ imported, skipped, warnings });
}
