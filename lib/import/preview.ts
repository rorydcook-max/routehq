/**
 * The importer's preview: a spreadsheet, read through its column mapping, turned
 * into the records RouteHQ would create, in RouteHQ's own shape. The owner sees
 * and corrects these cards; nothing is written until they say so.
 *
 * Rows with a problem are kept, marked "needs a look", not thrown away.
 */
import { businessToday } from "@/lib/business-time";
import type { ParsedSheet } from "@/lib/import/spreadsheet";
import { cleanPlate, cleanString, findByPlate, namesAgree, normalizeTransactionType, parseDateValue, parseIntegerValue, parseKnownNumber, parseNumberValue, plateKey } from "@/lib/import/normalize";

export type Mapping = { source_column: string; routehq_field: string };
export type SheetMapping = { sheet_name: string; primary_data_type: string; column_mappings: Mapping[] };

/** Why a row needs a look. The screen names each code in the reader's language. */
export type Problem =
  | "no_plate"
  | "no_make_model"
  | "no_mileage"
  | "no_year"
  | "bad_date"
  | "no_rate"
  | "no_start"
  | "no_customer"
  | "no_amount"
  | "unknown_vehicle"
  | "duplicate_in_file"
  | "already_in_fleet"
  | "already_a_customer"
  | "paid_until_unknown"
  | "already_booked"
  | "vehicle_busy"
  | "cancelled_in_file";

type Base = { key: string; sheet: string; row: number; include: boolean; problems: Problem[] };

export type PreviewVehicle = Base & {
  existingId: string | null;
  plate: string;
  make: string;
  model: string;
  trim: string;
  year: number | null;
  color: string;
  mileage: number | null;
  dailyRate: number | null;
  weeklyRate: number | null;
  monthlyRate: number | null;
  /** Everything else the sheet said about the vehicle, kept for the record. */
  extra: Record<string, string>;
};

export type PreviewRental = Base & {
  plate: string;
  existingVehicleId: string | null;
  /** The vehicle card in this same import, when the vehicle is new. */
  vehicleKey: string | null;
  customerName: string;
  phone: string;
  email: string;
  startDate: string | null;
  endDate: string | null;
  rate: number | null;
  /** What the rent is per. Notebooks and short-term shops usually charge by the day. */
  ratePeriod: "day" | "week" | "month";
  /** Make and model written next to the plate, used when the vehicle is new. */
  vehicleName: string;
  /** Already a customer of the business (matched by phone, then name). */
  existingCustomer: boolean;
  deposit: number | null;
  mileageAtStart: number | null;
  nextDue: string | null;
  /** Rent is paid up to and including this day. Null = the owner has to say. */
  paidUntil: string | null;
  depositHeld: boolean;
  status: "active" | "booked" | "completed";
};

export type PreviewCustomer = Base & {
  existingId: string | null;
  fullName: string;
  phone: string;
  email: string;
  nationality: string;
  passport: string;
  licence: string;
};

export type PreviewTransaction = Base & {
  plate: string;
  existingVehicleId: string | null;
  vehicleKey: string | null;
  date: string | null;
  type: string;
  amount: number | null;
  notes: string;
};

export type ImportPreview = {
  vehicles: PreviewVehicle[];
  rentals: PreviewRental[];
  customers: PreviewCustomer[];
  transactions: PreviewTransaction[];
};

const DATA_TYPES = ["vehicles", "customers", "rentals", "transactions"] as const;

function mappedRow(row: Record<string, string>, mappings: Mapping[]) {
  const output: Record<string, string> = {};
  for (const mapping of mappings) {
    if (!mapping.routehq_field || mapping.routehq_field === "__ignore__") continue;
    output[mapping.routehq_field] = row[mapping.source_column] || "";
  }
  // First and last name in their own columns (most booking systems export them that way).
  const joined = [output.first_name, output.last_name].map(cleanString).filter(Boolean).join(" ");
  if (joined) {
    if (!cleanString(output.customer_name)) output.customer_name = joined;
    if (!cleanString(output.full_name)) output.full_name = joined;
  }
  // A country code in its own column: "49" + "1701234567" is +491701234567.
  const code = cleanString(output.phone_country_code).replace(/\D/g, "");
  if (code && cleanString(output.phone) && !cleanString(output.phone).startsWith("+")) output.phone = `+${code}${cleanString(output.phone).replace(/\D/g, "").replace(/^0/, "")}`;
  // Where the rent column says what it's per ("DailyRate", "Monthly price").
  const rateColumn = mappings.find((mapping) => mapping.routehq_field === "rental_rate")?.source_column || "";
  const hasTotal = mappings.some((mapping) => mapping.routehq_field === "rental_total");
  if (rateColumn && !hasTotal && /total|incl|gesamt|subtotal|amount due|order price|ยอดรวม|รวม/i.test(rateColumn) && !/day|daily|week|month|วัน|สัปดาห์|เดือน/i.test(rateColumn)) {
    output.rental_total = output.rental_rate;
    output.rental_rate = "";
    return output;
  }
  if (rateColumn && !hasTotal && /^\W*(price|amount|cost|charges?|fee|ราคา)\b/i.test(rateColumn) && !/rent|rate|per\b|day|daily|week|month|วัน|สัปดาห์|เดือน/i.test(rateColumn)) {
    output.price_unclear = "1";
  }
  if (rateColumn && !cleanString(output.rate_period)) {
    const hint = ratePeriodFrom(rateColumn);
    if (hint !== "month" || /month|เดือน/i.test(rateColumn)) output.rate_period = hint;
  }
  return output;
}

const THAI_PLATE = /\d?\s?[ก-ฮ]{1,3}[\s-]?\d{1,4}(?:\s+[ก-๙]{4,}(?:\s?[ก-๙]+)?)?/;

/**
 * Booking systems put the vehicle in one text: "1 x Honda Click 125i (2กท 1188)", "Honda PCX 160 (1กข 2345)".
 * The plate is taken out; what's left is the vehicle's name.
 */
export function splitPlateFromName(value: unknown): { plate: string; name: string } {
  const text = cleanString(value).replace(/^\d+\s*[x×]\s+/i, "");
  if (!text) return { plate: "", name: "" };
  const inBrackets = text.match(/[(\[]\s*([^)\]]{3,30})\s*[)\]]/);
  if (inBrackets && /\d/.test(inBrackets[1]) && (THAI_PLATE.test(inBrackets[1]) || /^[A-Z0-9 -]{3,12}$/i.test(inBrackets[1]))) {
    return { plate: cleanPlate(inBrackets[1]), name: cleanString(text.replace(inBrackets[0], "")) };
  }
  const thai = text.match(THAI_PLATE);
  if (thai && cleanString(text.replace(thai[0], "")).length >= 3) return { plate: cleanPlate(thai[0]), name: cleanString(text.replace(thai[0], "").replace(/[-–|,]+$/, "")) };
  return { plate: cleanPlate(text), name: "" };
}

function daysBetween(start: string, end: string) {
  return Math.max(1, Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000));
}

const CANCELLED = /cancel|annul|storn|no.?show|void|ยกเลิก|ไม่มา/i;

export function sheetDataType(value: string, mappings: Mapping[]) {
  const cleaned = cleanString(value).toLowerCase();
  const fields = new Set(mappings.map((mapping) => mapping.routehq_field));
  const isBookings = fields.has("start_date") && ["customer_name", "first_name", "last_name", "full_name"].some((field) => fields.has(field));
  // An owner's fleet sheet: one row per vehicle (year, colour, its price, tax and insurance dates), with who has it now
  // alongside. That stays a vehicle list, so a vehicle nobody is renting isn't dropped. A booking export labelled
  // "vehicles" has renter columns but says little about the vehicles themselves.
  const describesVehicles = ["year", "color", "make", "model", "monthly_rate", "daily_rate", "weekly_rate", "current_mileage", "tax_expiry_date", "insurance_expiry_date", "porbor_expiry_date", "purchase_price", "estimated_value"].filter((field) => fields.has(field)).length >= 2;
  if (isBookings && cleaned === "vehicles" && describesVehicles && fields.has("registration_number")) return "vehicles";
  if (isBookings && (cleaned === "vehicles" || cleaned === "customers")) return "rentals";
  if ((DATA_TYPES as readonly string[]).includes(cleaned)) return cleaned as (typeof DATA_TYPES)[number];
  if (fields.has("amount") && fields.has("type")) return "transactions";
  if (fields.has("vehicle_registration") && fields.has("start_date")) return "rentals";
  if (fields.has("full_name") || fields.has("passport_number") || fields.has("driving_licence_number")) return "customers";
  return "vehicles";
}

function splitVehicleName(value: string) {
  const parts = cleanString(value).split(/\s+/).filter(Boolean);
  return { make: parts[0] || "", model: parts.slice(1, 3).join(" "), trim: parts.slice(3).join(" ") };
}

function dateOrProblem(value: string, problems: Problem[]) {
  if (!cleanString(value)) return null;
  const date = parseDateValue(value);
  if (!date) problems.push("bad_date");
  return date;
}

/** Thai phone numbers as the app stores them: digits, leading 0 kept, "+66" turned into 0. */
/** "per day", "/วัน", "250/d" → day; "week", "สัปดาห์" → week; everything else is monthly, as before. */
export function ratePeriodFrom(...texts: unknown[]): "day" | "week" | "month" {
  const text = texts.map((value) => cleanString(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_.]+/g, " ").toLowerCase()).join(" ");
  if (/\b(day|daily|days|d)\b|\/d\b|วัน|รายวัน/.test(text)) return "day";
  if (/\b(week|weekly|wk)\b|สัปดาห์|อาทิตย์|รายสัปดาห์/.test(text)) return "week";
  return "month";
}

// The make of models Thai rental shops write on their own ("Click", "Yaris").
const MAKE_OF_MODEL: [RegExp, string][] = [
  [/^(click|pcx|adv|scoopy|wave|zoomer|forza|msx|grom|lead|giorno|vario|cbr|city|jazz|civic|accord|hr-?v|br-?v|cr-?v|wr-?v|brio)\b/i, "Honda"],
  [/^(nmax|n-max|aerox|fino|filano|grand filano|xmax|x-max|qbix|mio|exciter|r15|tricity|lexi)\b/i, "Yamaha"],
  [/^(yaris|vios|fortuner|hilux|revo|corolla|altis|camry|veloz|avanza|innova|commuter|cross)\b/i, "Toyota"],
  [/^(xpander|pajero|triton|attrage|mirage)\b/i, "Mitsubishi"],
  [/^(almera|navara|note|kicks|march|terra)\b/i, "Nissan"],
  [/^(swift|ciaz|ertiga|celerio|burgman|smash)\b/i, "Suzuki"],
  [/^(mazda ?2|mazda ?3|cx-?3|cx-?30|cx-?5|bt-?50)\b/i, "Mazda"],
  [/^(d-?max|mu-?x)\b/i, "Isuzu"],
  [/^(ranger|everest)\b/i, "Ford"],
  [/^(vespa|primavera|sprint)\b/i, "Vespa"]
];
export function guessMakeModel(name: string): { make: string; model: string } {
  // "Economy - Toyota Yaris", "Compact SUV - Toyota Yaris Cross": the class before the dash isn't the make.
  const text = cleanString(name).split(/\s[-–]\s/).pop()!.trim();
  if (!text) return { make: "", model: "" };
  const known = MAKE_OF_MODEL.find(([pattern]) => pattern.test(text));
  if (known) return { make: known[1], model: text };
  const split = splitVehicleName(text);
  return { make: split.make, model: split.model || text };
}

export function cleanPhone(value: unknown) {
  const digits = cleanString(value).replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+66")) return `0${digits.slice(3)}`;
  if (digits.startsWith("66") && digits.length >= 11) return `0${digits.slice(2)}`;
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\+/g, "")}`;
  return digits;
}

function rentalFrom(fields: Record<string, string>, base: Omit<Base, "problems">, plate: string, today: string): PreviewRental | null {
  const customerName = cleanString(fields.customer_name || fields.full_name);
  const hasAny = customerName || cleanString(fields.start_date) || cleanString(fields.rental_rate);
  if (!hasAny) return null;
  const problems: Problem[] = [];
  if (!customerName) problems.push("no_customer");
  const startDate = dateOrProblem(fields.start_date, problems);
  if (!startDate) problems.push("no_start");
  const endDate = dateOrProblem(fields.end_date, problems);
  const nextDue = dateOrProblem(fields.next_payment_date, problems);
  let rate = parseNumberValue(fields.rental_rate || fields.monthly_rate);
  let ratePeriod = ratePeriodFrom(fields.rate_period, fields.rental_rate, fields.notes);
  // Only a total for the whole booking: a month or more is priced per month, anything shorter per day.
  let total = parseNumberValue(fields.rental_total);
  if (fields.price_unclear && rate && startDate && endDate && daysBetween(startDate, endDate) < 28 && !cleanString(fields.rate_period)) {
    total = rate;
    rate = null;
  }
  if (!rate && total && startDate && endDate) {
    const days = daysBetween(startDate, endDate);
    if (days >= 28) {
      ratePeriod = "month";
      rate = Math.round(total / (days / 30));
    } else {
      ratePeriod = "day";
      rate = Math.round(total / days);
    }
  }
  if (!rate) problems.push("no_rate");
  const status: PreviewRental["status"] = endDate && endDate < today ? "completed" : startDate && startDate > today ? "booked" : "active";
  // Paid up to: the day before the next payment is due, when the sheet says so; paid in full, the end date;
  // otherwise the owner tells us.
  let paidUntil: string | null = null;
  const paid = parseNumberValue(fields.amount_paid);
  const owedForStay = total ?? (rate && startDate && endDate ? (ratePeriod === "day" ? rate * daysBetween(startDate, endDate) : ratePeriod === "week" ? (rate * daysBetween(startDate, endDate)) / 7 : null) : null);
  if (nextDue) {
    const day = new Date(`${nextDue}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() - 1);
    paidUntil = day.toISOString().slice(0, 10);
  } else if (paid !== null && endDate && owedForStay !== null && paid >= owedForStay - 1) {
    paidUntil = endDate;
  } else if (status === "active") {
    problems.push("paid_until_unknown");
  }
  // A booking the other system shows as cancelled: listed, but left out unless ticked.
  const cancelled = CANCELLED.test(cleanString(fields.booking_status));
  if (cancelled) problems.push("cancelled_in_file");
  return {
    ...base,
    include: cancelled ? false : base.include,
    problems: [...new Set(problems)],
    plate,
    existingVehicleId: null,
    vehicleKey: null,
    customerName,
    phone: cleanPhone(fields.phone),
    email: cleanString(fields.email),
    startDate,
    endDate,
    rate,
    ratePeriod,
    vehicleName: cleanString(fields.vehicle_name || [fields.make, fields.model].filter(Boolean).join(" ")),
    existingCustomer: false,
    deposit: parseNumberValue(fields.deposit_amount),
    mileageAtStart: parseIntegerValue(parseKnownNumber(fields.mileage_at_start)),
    nextDue,
    paidUntil,
    depositHeld: (parseNumberValue(fields.deposit_amount) || 0) > 0,
    status
  };
}

/** Reads every sheet through its mapping. Existing records are matched afterwards (attachExisting). */
export function buildPreview(sheets: ParsedSheet[], mappings: SheetMapping[]): ImportPreview {
  const preview: ImportPreview = { vehicles: [], rentals: [], customers: [], transactions: [] };
  const today = businessToday();
  const platesSeen = new Map<string, string>();

  for (const sheetMapping of mappings) {
    const sheet = sheets.find((item) => item.sheetName === sheetMapping.sheet_name) || (sheets.length === 1 ? sheets[0] : null);
    if (!sheet) continue;
    const type = sheetDataType(sheetMapping.primary_data_type, sheetMapping.column_mappings);

    sheet.rows.forEach((row, index) => {
      const fields = mappedRow(row, sheetMapping.column_mappings);
      if (!Object.values(fields).some((value) => cleanString(value))) return;
      const base = { key: `${type}:${sheet.sheetName}:${index}`, sheet: sheet.sheetName, row: index + 1, include: true };

      if (type === "customers") {
        const problems: Problem[] = [];
        const fullName = cleanString(fields.full_name || fields.customer_name);
        if (!fullName) problems.push("no_customer");
        preview.customers.push({
          ...base,
          problems,
          existingId: null,
          fullName,
          phone: cleanPhone(fields.phone),
          email: cleanString(fields.email),
          nationality: cleanString(fields.nationality),
          passport: cleanString(fields.passport_number),
          licence: cleanString(fields.driving_licence_number)
        });
        return;
      }

      if (type === "rentals") {
        // "1 x Honda Click 125i (2กท 1188)": the plate, and the vehicle's name if no other column gives it.
        const split = splitPlateFromName(fields.vehicle_registration || fields.registration_number);
        if (split.name && !cleanString(fields.vehicle_name)) fields.vehicle_name = split.name;
        const plate = split.plate;
        const rental = rentalFrom(fields, base, plate, today);
        if (!rental) return;
        if (!plate) rental.problems.push("no_plate");
        preview.rentals.push(rental);
        return;
      }

      if (type === "transactions") {
        const problems: Problem[] = [];
        const plate = splitPlateFromName(fields.vehicle_registration || fields.registration_number).plate;
        if (!plate) problems.push("no_plate");
        const amount = parseNumberValue(fields.amount);
        if (amount === null) problems.push("no_amount");
        const date = dateOrProblem(fields.date, problems);
        preview.transactions.push({
          ...base,
          problems,
          plate,
          existingVehicleId: null,
          vehicleKey: null,
          date,
          type: normalizeTransactionType(fields.type),
          amount: amount === null ? null : Math.abs(amount),
          notes: cleanString(fields.notes)
        });
        return;
      }

      // A vehicle, possibly with who is renting it right now on the same row.
      const problems: Problem[] = [];
      const plate = cleanPlate(fields.registration_number || fields.vehicle_registration);
      const combined = splitVehicleName(fields.vehicle_name || fields.vehicle || fields.description);
      const make = cleanString(fields.make) || combined.make;
      const model = cleanString(fields.model) || combined.model;
      if (!plate) problems.push("no_plate");
      if (!make || !model) problems.push("no_make_model");
      const mileage = parseIntegerValue(parseKnownNumber(fields.current_mileage));
      // Only asked about when the sheet has a mileage column: otherwise it is taken at the first handover.
      if (mileage === null && "current_mileage" in fields) problems.push("no_mileage");
      // "2566" is a Buddhist year; "66" on a Thai sheet is too.
      const rawYear = parseIntegerValue(fields.year);
      const year = rawYear === null ? null : rawYear > 2400 ? rawYear - 543 : rawYear >= 40 && rawYear <= 99 ? 2500 + rawYear - 543 : rawYear;
      if (year !== null && (year < 1950 || year > new Date().getFullYear() + 1)) problems.push("no_year");
      const key = plateKey(plate);
      if (key && platesSeen.has(key)) problems.push("duplicate_in_file");
      else if (key) platesSeen.set(key, base.key);

      const known = new Set(["registration_number", "vehicle_registration", "make", "model", "trim", "vehicle_name", "year", "color", "current_mileage", "daily_rate", "weekly_rate", "monthly_rate", "customer_name", "phone", "email", "start_date", "end_date", "rental_rate", "rate_period", "deposit_amount", "mileage_at_start", "next_payment_date", "full_name", "price_unclear", "first_name", "last_name", "phone_country_code", "rental_total", "amount_paid", "booking_status"]);
      const extra = Object.fromEntries(Object.entries(fields).filter(([field, value]) => !known.has(field) && cleanString(value)));

      preview.vehicles.push({
        ...base,
        problems,
        existingId: null,
        plate,
        make,
        model,
        trim: cleanString(fields.trim) || combined.trim,
        year: year !== null && year >= 1950 && year <= new Date().getFullYear() + 1 ? year : null,
        color: cleanString(fields.color),
        mileage,
        dailyRate: parseNumberValue(fields.daily_rate),
        weeklyRate: parseNumberValue(fields.weekly_rate),
        monthlyRate: parseNumberValue(fields.monthly_rate),
        extra
      });

      const rental = rentalFrom(fields, { ...base, key: `rentals:${sheet.sheetName}:${index}` }, plate, today);
      if (rental) {
        rental.vehicleKey = base.key;
        preview.rentals.push(rental);
      }
    });
  }

  // Rentals and money on a vehicle that is in this same file.
  const byPlate = new Map<string, string>();
  for (const vehicle of preview.vehicles) if (vehicle.plate && !byPlate.has(plateKey(vehicle.plate))) byPlate.set(plateKey(vehicle.plate), vehicle.key);
  for (const rental of preview.rentals) if (!rental.vehicleKey && rental.plate) rental.vehicleKey = findByPlate(byPlate, rental.plate) || null;
  for (const transaction of preview.transactions) if (transaction.plate) transaction.vehicleKey = findByPlate(byPlate, transaction.plate) || null;

  return preview;
}

export type ExistingVehicle = { id: string; registration_number: string | null; make: string; model: string };
export type ExistingCustomer = { id: string; full_name: string; phone: string | null };
/** A booking or rental the business already has, to catch the same rental coming in twice. */
export type ExistingRental = { vehicle_id: string; start_date: string; end_date: string | null; customer_name: string; customer_phone: string | null };

function overlaps(aStart: string | null, aEnd: string | null, bStart: string, bEnd: string | null) {
  if (!aStart) return false;
  return (!bEnd || aStart <= bEnd) && (!aEnd || bStart <= aEnd);
}

/**
 * Matches the preview against what the business already has, so a second
 * import updates rather than duplicates: vehicles by plate, customers by phone
 * then name.
 */
export function attachExisting(preview: ImportPreview, vehicles: ExistingVehicle[], customers: ExistingCustomer[], rentals: ExistingRental[] = []) {
  const vehicleByPlate = new Map(vehicles.map((vehicle) => [plateKey(vehicle.registration_number), vehicle.id]));
  const customerByPhone = new Map(customers.filter((customer) => cleanPhone(customer.phone)).map((customer) => [cleanPhone(customer.phone), customer]));
  // A phone match counts only when the names agree too (see namesAgree).
  const byPhoneFor = (phone: string, name: string) => {
    const match = phone ? customerByPhone.get(phone) : undefined;
    return match && namesAgree(match.full_name, name) ? match.id : null;
  };
  const customerByName = new Map(customers.map((customer) => [cleanString(customer.full_name).toLowerCase(), customer.id]));

  const mark = (problems: Problem[], problem: Problem) => {
    if (!problems.includes(problem)) problems.push(problem);
  };

  for (const vehicle of preview.vehicles) {
    vehicle.existingId = vehicle.plate ? findByPlate(vehicleByPlate, vehicle.plate) || null : null;
    if (vehicle.existingId) mark(vehicle.problems, "already_in_fleet");
  }
  // A rental on a plate that isn't in the fleet or the file (a notebook line: "Click 2กข 777"): a new vehicle card for it.
  const addedByPlate = new Map<string, string>();
  for (const rental of preview.rentals) {
    rental.existingVehicleId = rental.plate ? findByPlate(vehicleByPlate, rental.plate) || null : null;
    rental.existingCustomer = Boolean(byPhoneFor(rental.phone, rental.customerName) || customerByName.get(rental.customerName.toLowerCase()));
    if (rental.existingVehicleId) {
      // The same vehicle is already booked for these dates: the same rental again, or someone else's.
      const clash = rentals.find((existing) => existing.vehicle_id === rental.existingVehicleId && overlaps(rental.startDate, rental.endDate, existing.start_date, existing.end_date));
      if (clash) {
        const same = (rental.phone && cleanPhone(clash.customer_phone) === rental.phone) || cleanString(clash.customer_name).toLowerCase() === rental.customerName.toLowerCase();
        mark(rental.problems, same ? "already_booked" : "vehicle_busy");
        rental.problems = rental.problems.filter((problem) => problem !== "paid_until_unknown");
        rental.include = false;
      }
    }
    if (rental.existingVehicleId || rental.vehicleKey || !rental.include) continue;
    if (!rental.plate) {
      mark(rental.problems, "unknown_vehicle");
      continue;
    }
    const seenKey = findByPlate(addedByPlate, rental.plate);
    if (seenKey) {
      rental.vehicleKey = seenKey;
      const card = preview.vehicles.find((vehicle) => vehicle.key === seenKey);
      if (card && rental.rate) {
        if (rental.ratePeriod === "day" && card.dailyRate === null) card.dailyRate = rental.rate;
        if (rental.ratePeriod === "week" && card.weeklyRate === null) card.weeklyRate = rental.rate;
        if (rental.ratePeriod === "month" && card.monthlyRate === null) card.monthlyRate = rental.rate;
      }
      if (card && rental.mileageAtStart !== null && (card.mileage === null || rental.mileageAtStart > card.mileage)) {
        card.mileage = rental.mileageAtStart;
        card.problems = card.problems.filter((problem) => problem !== "no_mileage");
      }
      continue;
    }
    const { make, model } = guessMakeModel(rental.vehicleName);
    const problems: Problem[] = rental.mileageAtStart === null ? ["no_mileage"] : [];
    if (!make || !model) problems.push("no_make_model");
    const key = `vehicles:${rental.sheet}:from-rental-${rental.row}`;
    preview.vehicles.push({ key, sheet: rental.sheet, row: rental.row, include: true, problems, existingId: null, plate: rental.plate, make, model, trim: "", year: null, color: "", mileage: rental.mileageAtStart, dailyRate: rental.ratePeriod === "day" ? rental.rate : null, weeklyRate: rental.ratePeriod === "week" ? rental.rate : null, monthlyRate: rental.ratePeriod === "month" ? rental.rate : null, extra: {} });
    addedByPlate.set(plateKey(rental.plate), key);
    rental.vehicleKey = key;
  }
  for (const transaction of preview.transactions) {
    transaction.existingVehicleId = transaction.plate ? findByPlate(vehicleByPlate, transaction.plate) || null : null;
    if (!transaction.existingVehicleId && !transaction.vehicleKey) mark(transaction.problems, "unknown_vehicle");
  }
  for (const customer of preview.customers) {
    customer.existingId = byPhoneFor(customer.phone, customer.fullName) || customerByName.get(customer.fullName.toLowerCase()) || null;
    if (customer.existingId) mark(customer.problems, "already_a_customer");
  }
  return preview;
}

/** The headline: "12 vehicles, 9 rented now, 23 customers, 140 payments". */
export function previewCounts(preview: ImportPreview) {
  return {
    vehicles: preview.vehicles.filter((item) => item.include).length,
    rentedNow: preview.rentals.filter((item) => item.include && item.status === "active").length,
    rentals: preview.rentals.filter((item) => item.include).length,
    // Customers listed on their own, plus new people renting in the file.
    customers:
      preview.customers.filter((item) => item.include).length +
      new Set(
        preview.rentals
          .filter((item) => item.include && !item.existingCustomer && item.customerName && !preview.customers.some((customer) => customer.include && (customer.fullName.toLowerCase() === item.customerName.toLowerCase() || (customer.phone && customer.phone === item.phone))))
          .map((item) => item.phone || item.customerName.toLowerCase())
      ).size,
    transactions: preview.transactions.filter((item) => item.include).length,
    needsLook: [...preview.vehicles, ...preview.rentals, ...preview.customers, ...preview.transactions].filter((item) => item.include && item.problems.some((problem) => !["already_in_fleet", "already_a_customer", "already_booked", "cancelled_in_file"].includes(problem))).length
  };
}
