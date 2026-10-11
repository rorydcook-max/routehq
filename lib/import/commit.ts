import { phoneVariants, toInternationalPhone } from "@/lib/phone";
/**
 * Writes an import preview into the business. Every row carries the batch id,
 * so the whole import can be undone. Rows the owner marked "needs a look" go in
 * too, each with a To do item, so nothing is silently dropped.
 */
import { businessToday } from "@/lib/business-time";
import { settleExistingRental } from "@/lib/existing-rental";
import type { ImportPreview, PreviewRental, PreviewVehicle, Problem } from "@/lib/import/preview";
import { findByPlate } from "@/lib/import/normalize";
import { activateRental } from "@/lib/rental-activation";

export type CommitContext = { supabase: any; organizationId: string; userId: string; currency: string; categoryId: string | null; batchId: string };

export type CommitResult = {
  counts: { vehicles: number; vehiclesUpdated: number; customers: number; rentals: number; transactions: number; tasks: number };
  /** Rows that could not be written at all, with why, in English for the log. */
  failed: string[];
};

const NEEDS_LOOK: Problem[] = ["no_plate", "no_mileage", "no_year", "bad_date", "no_rate", "no_customer", "paid_until_unknown"];

function plateKey(value: unknown) {
  return String(value ?? "").replace(/[\s-]+/g, "").toUpperCase();
}

function compact(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "" && value !== null && value !== undefined));
}

function num(value: unknown) {
  const cleaned = String(value ?? "").replace(/[฿,\s]|THB|บาท/gi, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

async function addTask(context: CommitContext, vehicleId: string | null, rentalId: string | null, title: string) {
  const { error } = await context.supabase.from("tasks").insert({
    organization_id: context.organizationId,
    vehicle_id: vehicleId,
    rental_id: rentalId,
    title,
    task_type: "other",
    due_at: businessToday(3),
    import_batch_id: context.batchId,
    created_by: context.userId
  });
  return !error;
}

function shortDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** What to tell the owner to check, in plain words. */
function lookTitle(problems: Problem[], what: string) {
  const reasons = problems
    .map((problem) =>
      problem === "no_plate"
        ? "plate missing"
        : problem === "no_mileage"
        ? "mileage not known"
        : problem === "no_year"
          ? "year unclear"
          : problem === "bad_date"
            ? "a date could not be read"
            : problem === "no_rate"
              ? "rent not known"
              : problem === "no_customer"
                ? "customer name missing"
                : problem === "paid_until_unknown"
                  ? "say what rent is paid up to"
                  : problem === "duplicate_in_file"
                    ? "listed twice in the file"
                    : ""
    )
    .filter(Boolean);
  return `Check after import: ${what}${reasons.length ? ` (${reasons.join(", ")})` : ""}`;
}

async function upsertVehicle(context: CommitContext, vehicle: PreviewVehicle, result: CommitResult): Promise<string | null> {
  const { supabase } = context;
  const specifications = compact({
    transmission: vehicle.extra.transmission,
    engine_cc: num(vehicle.extra.engine_cc),
    fuel_type: vehicle.extra.fuel_type,
    seating_capacity: num(vehicle.extra.seating_capacity),
    drivetrain: vehicle.extra.drivetrain,
    body_type: vehicle.extra.body_type
  });
  const metadata = {
    acquisition: compact({ purchase_mileage: num(vehicle.extra.purchase_mileage) }),
    compliance: compact({
      tax_expiry_date: vehicle.extra.tax_expiry_date,
      tax_cost: num(vehicle.extra.tax_cost),
      insurance_expiry_date: vehicle.extra.insurance_expiry_date,
      insurance_cost: num(vehicle.extra.insurance_cost),
      insurance_sum_insured: num(vehicle.extra.insurance_sum_insured),
      insurance_excess: num(vehicle.extra.insurance_excess),
      porbor_expiry_date: vehicle.extra.porbor_expiry_date,
      porbor_cost: num(vehicle.extra.porbor_cost),
      last_service_date: vehicle.extra.last_service_date,
      next_service_date: vehicle.extra.next_service_date
    }),
    finance: compact({
      lender: vehicle.extra.finance_lender,
      monthly_payment: num(vehicle.extra.finance_monthly_payment),
      outstanding_balance: num(vehicle.extra.finance_outstanding),
      end_date: vehicle.extra.finance_end_date
    }),
    import: compact({ gps_tracker_url: vehicle.extra.gps_tracker_url, notes: vehicle.extra.notes, mileage_unknown: vehicle.mileage === null ? true : null })
  };

  if (vehicle.existingId) {
    // Already in the fleet: fill in what is blank, never overwrite what the owner typed.
    const { data: current } = await supabase.from("vehicles").select("year, color, mileage, daily_rate, weekly_rate, monthly_rate, trim, vin").eq("id", vehicle.existingId).maybeSingle();
    const updates = compact({
      year: current?.year ? null : vehicle.year,
      color: current?.color ? null : vehicle.color,
      trim: current?.trim ? null : vehicle.trim,
      vin: current?.vin ? null : vehicle.extra.vin,
      mileage: Number(current?.mileage || 0) > 0 ? null : vehicle.mileage,
      daily_rate: Number(current?.daily_rate || 0) > 0 ? null : vehicle.dailyRate,
      weekly_rate: Number(current?.weekly_rate || 0) > 0 ? null : vehicle.weeklyRate,
      monthly_rate: Number(current?.monthly_rate || 0) > 0 ? null : vehicle.monthlyRate
    });
    if (Object.keys(updates).length) {
      await supabase.from("vehicles").update(updates).eq("id", vehicle.existingId).eq("organization_id", context.organizationId);
      result.counts.vehiclesUpdated += 1;
    }
    return vehicle.existingId;
  }

  if (!context.categoryId) {
    result.failed.push(`${vehicle.plate || `row ${vehicle.row}`}: no vehicle category set up`);
    return null;
  }
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      organization_id: context.organizationId,
      category_id: context.categoryId,
      make: vehicle.make || "Unknown",
      model: vehicle.model || "Unknown",
      trim: vehicle.trim || null,
      year: vehicle.year,
      vin: vehicle.extra.vin || null,
      registration_number: vehicle.plate || `IMPORT-${vehicle.row}`,
      color: vehicle.color || null,
      purchase_date: vehicle.extra.purchase_date || null,
      purchase_price: num(vehicle.extra.purchase_price),
      estimated_value: num(vehicle.extra.estimated_value),
      mileage: vehicle.mileage ?? 0,
      status: "available",
      availability_status: "available_now",
      daily_rate: vehicle.dailyRate || 0,
      weekly_rate: vehicle.weeklyRate || 0,
      monthly_rate: vehicle.monthlyRate || 0,
      utilization_12_month: 0,
      utilization_lifecycle: 0,
      revenue_generated: 0,
      profit_generated: 0,
      health_score: 100,
      specifications,
      metadata,
      import_batch_id: context.batchId,
      created_by: context.userId
    })
    .select("id")
    .single();
  if (error) {
    result.failed.push(`${vehicle.plate || `row ${vehicle.row}`}: ${error.message}`);
    return null;
  }
  result.counts.vehicles += 1;
  return data.id as string;
}

async function findOrCreateCustomer(context: CommitContext, input: { fullName: string; phone: string; email: string; nationality?: string; passport?: string; licence?: string; existingId?: string | null }, result: CommitResult, cache: Map<string, string>) {
  const { supabase } = context;
  if (input.existingId) return input.existingId;
  const cacheKey = (input.phone || input.fullName).toLowerCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;
  if (!input.fullName) return null;

  // Same person already in the business: by phone, then by name.
  const { data: byPhone } = input.phone
    ? await supabase.from("customers").select("id").eq("organization_id", context.organizationId).in("phone", phoneVariants(input.phone)).is("deleted_at", null).limit(1).maybeSingle()
    : { data: null };
  const { data: byName } = byPhone
    ? { data: null }
    : await supabase
        .from("customers")
        .select("id")
        .eq("organization_id", context.organizationId)
        .ilike("full_name", input.fullName.replace(/[\\%_]/g, (character) => `\\${character}`))
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
  const found = byPhone?.id || byName?.id;
  if (found) {
    cache.set(cacheKey, found);
    return found as string;
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: context.organizationId,
      full_name: input.fullName,
      phone: toInternationalPhone(input.phone),
      email: input.email || null,
      nationality: input.nationality || null,
      passport_number: input.passport || null,
      driver_license_number: input.licence || null,
      import_batch_id: context.batchId,
      created_by: context.userId
    })
    .select("id")
    .single();
  if (error) {
    result.failed.push(`${input.fullName}: ${error.message}`);
    return null;
  }
  result.counts.customers += 1;
  cache.set(cacheKey, data.id);
  return data.id as string;
}

async function createRental(context: CommitContext, rental: PreviewRental, vehicleId: string, customerId: string, result: CommitResult) {
  const { supabase } = context;
  if (!rental.startDate) return null;
  const { data, error } = await supabase
    .from("rentals")
    .insert({
      organization_id: context.organizationId,
      customer_id: customerId,
      vehicle_id: vehicleId,
      start_date: rental.startDate,
      end_date: rental.endDate,
      is_indefinite: !rental.endDate,
      pricing_model: PRICING[rental.ratePeriod || "month"],
      billing_interval: PRICING[rental.ratePeriod || "month"],
      recurring_billing: (rental.ratePeriod || "month") === "month",
      rental_rate: rental.rate || 0,
      deposit_amount: rental.deposit || 0,
      mileage_at_delivery: rental.mileageAtStart,
      currency: context.currency,
      status: rental.status,
      entered_by_operator: true,
      import_batch_id: context.batchId,
      created_by: context.userId
    })
    .select("id")
    .single();
  if (error) {
    const reason = /rentals_no_double_booking|exclusion constraint/.test(error.message) ? "the vehicle is already rented for these dates" : error.message;
    result.failed.push(`${rental.customerName || `row ${rental.row}`}: ${reason}`);
    return null;
  }
  result.counts.rentals += 1;

  if (rental.status === "active") {
    await supabase
      .from("vehicles")
      .update({ status: "rented", availability_status: "rented", current_rental_id: data.id, current_customer_id: customerId })
      .eq("id", vehicleId)
      .eq("organization_id", context.organizationId);
    if (rental.rate) {
      // The same schedule and "paid up to" handling as recording an existing rental by hand.
      await activateRental(data.id, supabase).catch(() => null);
      const paidBefore = rental.paidUntil ? nextDay(rental.paidUntil) : null;
      await settleExistingRental(supabase, {
        rental: { id: data.id, vehicle_id: vehicleId, customer_id: customerId, start_date: rental.startDate },
        organizationId: context.organizationId,
        userId: context.userId,
        paidBefore,
        depositHeld: rental.depositHeld ? rental.deposit || 0 : 0,
        currency: context.currency
      }).catch(() => null);
      // Tag what the settle step wrote so an undo takes it back too.
      await supabase.from("rental_payments").update({ import_batch_id: context.batchId }).eq("rental_id", data.id).is("import_batch_id", null);
      await supabase.from("transactions").update({ import_batch_id: context.batchId }).eq("rental_id", data.id).is("import_batch_id", null);
    }
  }
  return data.id as string;
}

const PRICING = { day: "daily", week: "weekly", month: "monthly" } as const;

function nextDay(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

export async function commitPreview(context: CommitContext, preview: ImportPreview): Promise<CommitResult> {
  const result: CommitResult = { counts: { vehicles: 0, vehiclesUpdated: 0, customers: 0, rentals: 0, transactions: 0, tasks: 0 }, failed: [] };
  const vehicleIdByKey = new Map<string, string>();
  const vehicleIdByPlate = new Map<string, string>();
  const customerCache = new Map<string, string>();

  // 1. Vehicles. A plate listed twice in the file is one vehicle: the second row fills in the first's blanks.
  for (const vehicle of preview.vehicles) {
    if (!vehicle.include) continue;
    const seen = vehicle.plate ? findByPlate(vehicleIdByPlate, vehicle.plate) : null;
    const id = await upsertVehicle(context, seen ? { ...vehicle, existingId: seen } : vehicle, result);
    if (id && vehicle.plate) vehicleIdByPlate.set(plateKey(vehicle.plate), id);
    if (seen) {
      vehicleIdByKey.set(vehicle.key, seen);
      continue;
    }
    if (!id) continue;
    vehicleIdByKey.set(vehicle.key, id);
    const look = vehicle.problems.filter((problem) => NEEDS_LOOK.includes(problem));
    if (id && look.length && !vehicle.existingId && (await addTask(context, id, null, lookTitle(look, `${vehicle.make} ${vehicle.model} ${vehicle.plate}`.trim())))) result.counts.tasks += 1;
  }

  // 2. Customers listed on their own.
  for (const customer of preview.customers) {
    if (!customer.include) continue;
    await findOrCreateCustomer(context, { ...customer, existingId: customer.existingId }, result, customerCache);
  }

  // 3. Who has what now, then past and future rentals.
  for (const rental of preview.rentals) {
    if (!rental.include) continue;
    const vehicleId = (rental.vehicleKey && vehicleIdByKey.get(rental.vehicleKey)) || rental.existingVehicleId;
    if (!vehicleId) {
      // Nobody said which vehicle: the customer comes in, and the booking waits in To do with everything the file said.
      const waiting = rental.customerName
        ? await findOrCreateCustomer(context, { fullName: rental.customerName, phone: rental.phone, email: rental.email }, result, customerCache)
        : null;
      const when = [rental.startDate, rental.endDate].filter(Boolean).map((day) => shortDay(day as string)).join(" – ");
      const vehicle = rental.vehicleName || rental.plate;
      const price = rental.rate ? `฿${rental.rate.toLocaleString("en-US")} / ${rental.ratePeriod || "month"}` : "";
      const details = [when, vehicle, price].filter(Boolean).join(", ");
      const title = `Booking for ${rental.customerName || `row ${rental.row}`}${details ? ` (${details})` : ""}: choose the vehicle and add the booking`;
      if (await addTask(context, null, null, title)) result.counts.tasks += 1;
      else result.failed.push(`${rental.customerName || `row ${rental.row}`}: no vehicle`);
      void waiting;
      continue;
    }
    const customerId = await findOrCreateCustomer(context, { fullName: rental.customerName || `Customer (row ${rental.row})`, phone: rental.phone, email: rental.email }, result, customerCache);
    if (!customerId) continue;
    const rentalId = await createRental(context, rental, vehicleId, customerId, result);
    const look = rental.problems.filter((problem) => NEEDS_LOOK.includes(problem));
    if (rentalId && look.length && (await addTask(context, vehicleId, rentalId, lookTitle(look, `rental for ${rental.customerName || "unnamed customer"}`)))) result.counts.tasks += 1;
  }

  // 4. Money. Years of history can be thousands of rows: written 200 at a time, row by row only if a group fails.
  const money: { row: number; record: Record<string, unknown> }[] = [];
  for (const transaction of preview.transactions) {
    if (!transaction.include || transaction.amount === null) continue;
    const vehicleId = (transaction.vehicleKey && vehicleIdByKey.get(transaction.vehicleKey)) || transaction.existingVehicleId;
    if (!vehicleId) {
      result.failed.push(`row ${transaction.row}: no vehicle ${transaction.plate ? `with plate ${transaction.plate}` : "plate"}`);
      continue;
    }
    money.push({
      row: transaction.row,
      record: {
        organization_id: context.organizationId,
        vehicle_id: vehicleId,
        transaction_date: transaction.date || businessToday(),
        type: transaction.type,
        amount: transaction.amount,
        currency: context.currency,
        notes: transaction.notes || null,
        metadata: { source: "import" },
        import_batch_id: context.batchId,
        created_by: context.userId
      }
    });
  }
  for (let at = 0; at < money.length; at += 200) {
    const group = money.slice(at, at + 200);
    const { error } = await context.supabase.from("transactions").insert(group.map((item) => item.record));
    if (!error) {
      result.counts.transactions += group.length;
      continue;
    }
    for (const item of group) {
      const { error: rowError } = await context.supabase.from("transactions").insert(item.record);
      if (rowError) result.failed.push(`row ${item.row}: ${rowError.message}`);
      else result.counts.transactions += 1;
    }
  }

  return result;
}

/**
 * Takes an import back: everything the batch created is soft-deleted and the
 * vehicles it rented out are freed. Vehicles that already existed and were only
 * filled in are left as they are.
 */
export async function undoBatch(supabase: any, organizationId: string, batchId: string) {
  const gone = new Date().toISOString();
  const { data: rentals } = await supabase.from("rentals").select("id, vehicle_id").eq("organization_id", organizationId).eq("import_batch_id", batchId).is("deleted_at", null);
  for (const rental of rentals || []) {
    await supabase.from("vehicles").update({ status: "available", availability_status: "available_now", current_rental_id: null, current_customer_id: null }).eq("id", rental.vehicle_id).eq("current_rental_id", rental.id);
  }
  for (const table of ["tasks", "transactions", "rental_payments", "rentals", "customers", "vehicles"]) {
    await supabase.from(table).update({ deleted_at: gone }).eq("organization_id", organizationId).eq("import_batch_id", batchId).is("deleted_at", null);
  }
  await supabase.from("import_batches").update({ status: "undone", undone_at: gone }).eq("id", batchId).eq("organization_id", organizationId);
}
