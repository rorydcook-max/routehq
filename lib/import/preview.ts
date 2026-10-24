/**
 * The importer's preview: a spreadsheet, read through its column mapping, turned
 * into the records RouteHQ would create, in RouteHQ's own shape. The owner sees
 * and corrects these cards; nothing is written until they say so.
 *
 * Rows with a problem are kept, marked "needs a look", not thrown away.
 */
import { businessToday } from "@/lib/business-time";
import type { ParsedSheet } from "@/lib/import/spreadsheet";
import { categorizeCost, cleanPlate, cleanString, findByPlate, namesAgree, parseBooleanValue, normalizeTransactionType, parseDateValue, parseIntegerValue, parseKnownNumber, parseNumberValue, parseYearValue, plateKey } from "@/lib/import/normalize";

export type Mapping = { source_column: string; routehq_field: string };
export type SheetMapping = {
  sheet_name: string;
  primary_data_type: string;
  column_mappings: Mapping[];
  /** How the sheet writes 05/06/2026 (see dateOrderOf); `date_example` is a date that could be read either way. */
  date_order?: "dmy" | "mdy";
  date_order_unsure?: boolean;
  date_example?: string | null;
  /** What the rent is per when the sheet doesn't say: the owner's answer to the quick question. */
  rate_period?: "day" | "week" | "month";
};

// The date order of the sheet being read (buildPreview sets it per sheet).
let DATE_ORDER: "dmy" | "mdy" = "dmy";
const readDate = (value: unknown) => parseDateValue(value, DATE_ORDER);

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
  | "cancelled_in_file"
  | "date_guessed"
  | "vehicle_purchase"
  | "end_passed"
  | "payment_gaps"
  | "next_due_from_payments";

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
  /** The usual deposit for this vehicle. */
  deposit?: number | null;
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
  /** Nothing in the sheet said what the rent is per; the period was assumed (asked about on the import screen). */
  periodGuessed?: boolean;
  /** Rent comes from a payment sheet in the same file: its payments are recorded as money (not worked out from
   * the rate) and the schedule starts at the next payment due, the day after "paid up to". */
  moneyFromSheet?: boolean;
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
  /** A business cost not tied to a vehicle ("NON-VEHICLE PURCHASE", "Office"). */
  business?: boolean;
  /** Rent received for a rental in this import. */
  rentalKey?: string | null;
  /** The vehicle's name as written next to the plate ("2017 Toyota Yaris"), for a new vehicle card. */
  vehicleName?: string;
};

type PaymentRow = { sheet: string; row: number; label: string; plate: string; date: string | null; paidOn?: string | null; amount: number | null; paid: boolean; notes: string };

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
    if (hint !== "month" || /month|เดือน|p\/m|\/ ?m\b|\bpm\b/i.test(rateColumn)) output.rate_period = hint;
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
  // A plate's leading digit is written against its letters ("2ขฒ7536"); after a word, a spaced digit is the
  // model's ("2013 Mazda 2 กม6964"), so it stays in the name.
  const found = thai && thai.index && /^\d\s/.test(thai[0]) ? thai[0].replace(/^\d\s+/, "") : thai?.[0];
  if (found && cleanString(text.replace(found, "")).length >= 3) return { plate: cleanPlate(found), name: cleanString(text.replace(found, "").replace(/[-–|,]+$/, "")) };
  return { plate: cleanPlate(text), name: "" };
}

function daysBetween(start: string, end: string) {
  return Math.max(1, Math.round((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000));
}

const CANCELLED = /cancel|annul|storn|no.?show|void|ยกเลิก|ไม่มา/i;

export function sheetDataType(value: string, mappings: Mapping[]) {
  const cleaned = cleanString(value).toLowerCase();
  const fields = new Set(mappings.map((mapping) => mapping.routehq_field));
  // Rent due dates with "received yes/no": a record of rent payments per vehicle.
  if (fields.has("paid") && fields.has("amount") && (fields.has("date") || fields.has("next_payment_date"))) return "payments";
  // Money in / money out columns: a ledger.
  if (fields.has("money_in") || fields.has("money_out")) return "transactions";
  const hasCustomer = ["customer_name", "first_name", "last_name", "full_name"].some((field) => fields.has(field));
  const hasVehicle = ["registration_number", "vehicle_registration", "vehicle_name"].some((field) => fields.has(field));
  const isBookings = (fields.has("start_date") || fields.has("rental_days")) && hasCustomer;
  // An owner's fleet sheet: one row per vehicle (year, colour, its price, tax and insurance dates), with who has it now
  // alongside. That stays a vehicle list, so a vehicle nobody is renting isn't dropped. A booking export labelled
  // "vehicles" has renter columns but says little about the vehicles themselves.
  const describesVehicles = ["year", "color", "make", "model", "monthly_rate", "weekly_rate", "current_mileage", "tax_expiry_date", "insurance_expiry_date", "porbor_expiry_date", "purchase_price", "estimated_value", "vin", "transmission"].filter((field) => fields.has(field)).length >= 2;
  // "Rented out now: yes / no" is a column of a fleet list.
  if (fields.has("rented_now") && hasVehicle) return "vehicles";
  if (isBookings && describesVehicles && fields.has("registration_number") && cleaned !== "rentals") return "vehicles";
  if (isBookings && (cleaned === "vehicles" || cleaned === "customers" || !cleaned)) return "rentals";
  if ((DATA_TYPES as readonly string[]).includes(cleaned)) return cleaned as (typeof DATA_TYPES)[number];
  // Amounts with what they were for, or with dates: money records (a cost log, rent received).
  if (fields.has("amount") && (fields.has("type") || fields.has("date")) && !describesVehicles) return "transactions";
  if (hasVehicle && fields.has("start_date")) return "rentals";
  if (hasCustomer && !hasVehicle && ["passport_number", "nationality", "email", "phone", "driving_licence_number"].some((field) => fields.has(field))) return "customers";
  if (fields.has("full_name") || fields.has("passport_number") || fields.has("driving_licence_number")) return "customers";
  return "vehicles";
}

function splitVehicleName(value: string) {
  const parts = cleanString(value).split(/\s+/).filter(Boolean);
  return { make: parts[0] || "", model: parts.slice(1, 3).join(" "), trim: parts.slice(3).join(" ") };
}

function dateOrProblem(value: string, problems: Problem[]) {
  // "-", "n/a" and "?" mean the same as an empty cell.
  if (!cleanString(value) || /^([-–—?]+|n\/?a|none|tbc|tbd)$/i.test(cleanString(value))) return null;
  const date = readDate(value);
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
const KNOWN_MAKES = /^(toyota|honda|yamaha|nissan|mazda|ford|isuzu|mitsubishi|suzuki|mg|kia|hyundai|bmw|mercedes|benz|vespa|kawasaki|gpx|ducati|triumph|harley|chevrolet|subaru|volvo|lexus|byd|ora|gwm|haval|neta|tesla|piaggio|lambretta|royal enfield|ktm|benelli|stallions)\b/i;

/** A cell that names a vehicle model ("Click 125i", "Toyota Yaris", "PCX"). */
export function looksLikeVehicleName(value: unknown) {
  const text = cleanString(value).split(/\s[-–]\s/).pop()!.trim();
  return Boolean(text) && (KNOWN_MAKES.test(text) || MAKE_OF_MODEL.some(([pattern]) => pattern.test(text)));
}

/** A cell that is a Thai plate ("กข 1234", "2ขฒ7536", "1กท 555 ภูเก็ต"). */
export function looksLikePlate(value: unknown) {
  const text = cleanString(value);
  const match = text.match(THAI_PLATE);
  return Boolean(match) && match![0].trim().length >= text.length - 12 && /\d/.test(text);
}

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

function addDays(date: string, days: number) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

/**
 * The rental a row describes. On a fleet sheet (`onVehicleRow`) a price alone is the vehicle's price, not a rental:
 * there has to be a renter or a start date.
 */
function rentalFrom(fields: Record<string, string>, base: Omit<Base, "problems">, plate: string, today: string, onVehicleRow = false): PreviewRental | null {
  const customerName = cleanString(fields.customer_name || fields.full_name);
  const hasAny = customerName || cleanString(fields.start_date) || (!onVehicleRow && cleanString(fields.rental_rate));
  if (!hasAny) return null;
  const problems: Problem[] = [];
  if (!customerName) problems.push("no_customer");
  const startDate = dateOrProblem(fields.start_date, problems);
  if (!startDate) problems.push("no_start");
  let endDate = dateOrProblem(fields.end_date, problems);
  // "Days: 7" instead of a return date.
  const days = parseIntegerValue(fields.rental_days);
  if (!endDate && startDate && days && days > 0 && days < 1000) endDate = addDays(startDate, days);
  const nextDue = dateOrProblem(fields.next_payment_date, problems);
  // The rent: the renter's own rent, else the price per day, week or month that fits how long the rental is.
  let rate = parseNumberValue(fields.rental_rate);
  let ratePeriod = ratePeriodFrom(fields.rate_period, fields.rental_rate, fields.notes);
  if (rate === null) {
    const daily = parseNumberValue(fields.daily_rate);
    const weekly = parseNumberValue(fields.weekly_rate);
    const monthly = parseNumberValue(fields.monthly_rate);
    const short = startDate && endDate ? daysBetween(startDate, endDate) < 28 : !monthly;
    if (daily !== null && (short || monthly === null)) [rate, ratePeriod] = [daily, "day"];
    else if (weekly !== null && (short || monthly === null)) [rate, ratePeriod] = [weekly, "week"];
    else if (monthly !== null) [rate, ratePeriod] = [monthly, "month"];
  } else if (ratePeriod === "month" && !cleanString(fields.rate_period) && !/month|เดือน|p\/m/i.test(cleanString(fields.rental_rate)) && startDate && endDate && daysBetween(startDate, endDate) < 28 && rate < 3000) {
    // Nothing says what the rent is per, the rental is a few days and the figure is a day's price (฿250 for a
    // scooter): per day, not ฿250 a month.
    ratePeriod = "day";
  }
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
  // The rent came from a column that doesn't say what it's per, and the owner hasn't said either.
  const periodGuessed = rate !== null && Boolean(cleanString(fields.rental_rate)) && !fields.period_answered && !cleanString(fields.rate_period) && !/month|เดือน|p\/m|day|daily|วัน|week|สัปดาห์/i.test(cleanString(fields.rental_rate));
  // "Returned: yes" ends it whatever the dates say; "no" keeps it out even past its end date.
  const returned = parseBooleanValue(fields.returned);
  let status: PreviewRental["status"] = endDate && endDate < today ? "completed" : startDate && startDate > today ? "booked" : "active";
  if (returned === true) status = "completed";
  if (returned === false && status === "completed") status = "active";
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
    status,
    periodGuessed
  };
}

/** Reads every sheet through its mapping. Existing records are matched afterwards (attachExisting). */
export function buildPreview(sheets: ParsedSheet[], mappings: SheetMapping[]): ImportPreview {
  const preview: ImportPreview = { vehicles: [], rentals: [], customers: [], transactions: [] };
  const today = businessToday();
  const platesSeen = new Map<string, string>();
  const payments: PaymentRow[] = [];

  for (const sheetMapping of mappings) {
    const sheet = sheets.find((item) => item.sheetName === sheetMapping.sheet_name) || (sheets.length === 1 ? sheets[0] : null);
    if (!sheet) continue;
    const type = sheetDataType(sheetMapping.primary_data_type, sheetMapping.column_mappings);
    DATE_ORDER = sheetMapping.date_order === "mdy" ? "mdy" : "dmy";
    // One tab per vehicle ("Yaris กข 1234"): rows without a vehicle of their own are that vehicle's.
    const tabName = sheet.sheetName.split(" · ")[0];
    const monthTab = /^\s*((ม|ก|มี|เม|พ|มิ|ส|ต|ธ)\.?\s?[คพยย]\.?|[a-z]{3,9}\.?)\s*'?\d{2,4}\s*$/i.test(tabName);
    const sheetVehicle = !monthTab && THAI_PLATE.test(tabName) ? tabName : "";

    const before = preview.transactions.length;
    sheet.rows.forEach((row, index) => {
      const fields = mappedRow(row, sheetMapping.column_mappings);
      // The owner said what the rent is per (the quick question), for a sheet that doesn't say.
      if (sheetMapping.rate_period && !cleanString(fields.rate_period)) {
        fields.rate_period = sheetMapping.rate_period;
        fields.period_answered = "1";
      }
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
        // No plate column: the plate is often inside the vehicle's name ("Economy - Toyota Yaris (กข 1111)").
        const plateText = cleanString(fields.vehicle_registration || fields.registration_number);
        const split = splitPlateFromName(plateText || fields.vehicle_name);
        if (!plateText && split.plate && !/\d/.test(split.plate)) split.plate = "";
        if (split.name && (!cleanString(fields.vehicle_name) || !plateText)) fields.vehicle_name = split.name;
        const plate = split.plate;
        const rental = rentalFrom(fields, base, plate, today);
        if (!rental) return;
        if (!plate) rental.problems.push("no_plate");
        preview.rentals.push(rental);
        return;
      }


      if (type === "payments") {
        const vehicleText = cleanString(fields.vehicle_registration || fields.registration_number || fields.vehicle_name || fields.vehicle) || sheetVehicle;
        // The due date sets the schedule; a "paid on" date, when there is one, is when the money came in.
        const due = readDate(fields.next_payment_date || fields.date || fields.start_date);
        const paidOn = fields.next_payment_date ? readDate(fields.date) : null;
        payments.push({
          sheet: sheet.sheetName,
          row: index + 1,
          label: vehicleText,
          plate: splitPlateFromName(vehicleText).plate,
          date: due,
          paidOn,
          amount: parseNumberValue(fields.amount),
          paid: parseBooleanValue(fields.paid) === true,
          notes: cleanString(fields.notes)
        });
        return;
      }

      if (type === "transactions") {
        const problems: Problem[] = [];
        const vehicleText = cleanString(fields.vehicle_registration || fields.registration_number || fields.vehicle_name) || sheetVehicle;
        // "NON-VEHICLE PURCHASE", "Office", "General": a cost of the business, not of a vehicle.
        const business = !vehicleText || /non.?vehicle|business|general|office|overhead|admin|ไม่ใช่รถ|ทั่วไป|สำนักงาน/i.test(vehicleText) || (!/\d/.test(vehicleText) && !THAI_PLATE.test(vehicleText));
        const split = business ? { plate: "", name: "" } : splitPlateFromName(vehicleText);
        const plate = split.plate;
        // A ledger with money in and money out columns: whichever is filled says which way the money went.
        const moneyIn = parseNumberValue(fields.money_in);
        const moneyOut = parseNumberValue(fields.money_out);
        const ledger = "money_in" in fields || "money_out" in fields;
        const amount = ledger ? (moneyIn ?? moneyOut) : parseNumberValue(fields.amount);
        const incoming = ledger ? moneyIn !== null : false;
        if (amount === null) problems.push("no_amount");
        const rawDate = cleanString(fields.date);
        const date = dateOrProblem(rawDate, problems);
        // What it was for: worked out from the description first ("Deposit for windshield trim" is a repair, not a
        // deposit; "เปลี่ยนน้ำมันเครื่อง" is servicing), then a kind written on its own ("Rent", "Fuel").
        const written = cleanString(fields.type);
        const described = `${written} ${cleanString(fields.notes)}`.trim();
        const known = normalizeTransactionType(written);
        const worked = categorizeCost(described);
        let kind = worked !== "other" ? worked : known;
        if (incoming) {
          // Money that came in is rent, unless it says it's a deposit or a charge recovered.
          kind = /deposit|bond|มัดจำ/i.test(described) ? "deposit_received" : /damage|charge|fine|ค่าเสียหาย|ค่าปรับ/i.test(described) ? "charge_recovered" : "rental_income";
        } else if (ledger && /deposit|bond|มัดจำ/i.test(described) && /return|refund|back|คืน/i.test(described)) {
          kind = "deposit_refunded";
        } else if (ledger && ["rental_income", "deposit_received", "deposit", "charge_recovered"].includes(kind)) {
          // Money going out isn't rent received ("Office rent", "Parking rent").
          kind = "other";
        } else if (!written && kind === "other" && cleanString(fields.customer_name)) {
          // A list of who paid what, with no "what for" column: rent received.
          kind = "rental_income";
        }
        // The text is kept as the note unless it was only the kind's own name ("Rent", "Fuel").
        const onlyKind = worked === "other" && known !== "other" && !/\s/.test(written);
        const notes = [onlyKind ? "" : written, cleanString(fields.notes), cleanString(fields.customer_name)].filter(Boolean).join(" · ");
        // Buying a vehicle is its purchase price, not a running cost: listed, left out unless ticked.
        const purchase = kind === "vehicle_purchase";
        if (purchase) problems.push("vehicle_purchase");
        preview.transactions.push({
          ...base,
          include: amount !== null && !purchase,
          problems,
          plate,
          existingVehicleId: null,
          vehicleKey: null,
          date,
          type: purchase ? "other" : kind,
          amount: amount === null ? null : Math.abs(amount),
          notes,
          business: business && !purchase,
          vehicleName: split.name
        });
        return;
      }

      // A vehicle, possibly with who is renting it right now on the same row.
      const problems: Problem[] = [];
      const plate = cleanPlate(fields.registration_number || fields.vehicle_registration);
      const combined = splitVehicleName(fields.vehicle_name || fields.vehicle || fields.description);
      let make = cleanString(fields.make) || combined.make;
      let model = cleanString(fields.model) || combined.model;
      // A model with no make column ("Yaris", "Toyota Yaris Ativ", "Click 125i"): the make it belongs to.
      if (!cleanString(fields.make) && cleanString(fields.model)) {
        const guessed = guessMakeModel(cleanString(fields.model));
        make = guessed.make;
        model = guessed.model;
      } else if (cleanString(fields.vehicle_name) && !cleanString(fields.make)) {
        const guessed = guessMakeModel(cleanString(fields.vehicle_name));
        if (guessed.make) [make, model] = [guessed.make, guessed.model];
      }
      // A template row (tick boxes and ฿0.00 filled down an empty sheet) is not a vehicle.
      if (!plate && !make && !model) return;
      if (!plate) problems.push("no_plate");
      if (!make || !model) problems.push("no_make_model");
      const mileage = parseIntegerValue(parseKnownNumber(fields.current_mileage));
      // Only asked about when the sheet has a mileage column: otherwise it is taken at the first handover.
      if (mileage === null && "current_mileage" in fields) problems.push("no_mileage");
      // "2566" is a Buddhist year; "66" on a Thai sheet is too.
      const year = parseYearValue(fields.year);
      if (year !== null && (year < 1950 || year > new Date().getFullYear() + 1)) problems.push("no_year");
      const key = plateKey(plate);
      if (key && platesSeen.has(key)) problems.push("duplicate_in_file");
      else if (key) platesSeen.set(key, base.key);

      const known = new Set(["registration_number", "vehicle_registration", "make", "model", "trim", "vehicle_name", "year", "color", "current_mileage", "daily_rate", "weekly_rate", "monthly_rate", "customer_name", "phone", "email", "start_date", "end_date", "rental_rate", "rate_period", "deposit_amount", "mileage_at_start", "next_payment_date", "full_name", "price_unclear", "first_name", "last_name", "phone_country_code", "rental_total", "amount_paid", "booking_status", "rental_days", "returned", "rented_now", "period_answered"]);
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
        deposit: parseNumberValue(fields.deposit_amount),
        extra
      });

      // A "Rental Status" / "Rented?" column says whether there is a rental at all; without one, renter details do.
      const rentedNow = parseBooleanValue(fields.rented_now);
      const card = preview.vehicles[preview.vehicles.length - 1];
      // The rent written on the row is the vehicle's price when nobody has it (and its price when no other is given).
      const rowRate = parseNumberValue(fields.rental_rate);
      if (rowRate !== null) {
        const period = ratePeriodFrom(fields.rate_period, fields.rental_rate);
        if (period === "month" && card.monthlyRate === null) card.monthlyRate = rowRate;
        if (period === "week" && card.weeklyRate === null) card.weeklyRate = rowRate;
        if (period === "day" && card.dailyRate === null) card.dailyRate = rowRate;
      }
      if (rentedNow === false) return;
      const rental = rentalFrom(fields, { ...base, key: `rentals:${sheet.sheetName}:${index}` }, plate, today, true);
      if (rental) {
        rental.vehicleKey = base.key;
        // Marked as rented now but the end date has passed: still out, the end date is old.
        if (rentedNow === true && rental.endDate && rental.endDate < today) {
          rental.endDate = null;
          rental.problems.push("end_passed");
        }
        if (rentedNow === true && rental.startDate && rental.startDate <= today) rental.status = "active";
        preview.rentals.push(rental);
      }
    });
    // Costs written without a date (common for the first rows of a log) take the nearest date above, else below.
    const added = preview.transactions.slice(before);
    added.forEach((item, at) => {
      if (item.date || item.problems.includes("bad_date")) return;
      const earlier = added.slice(0, at).reverse().find((other) => other.date && !other.problems.includes("date_guessed"));
      const later = added.slice(at + 1).find((other) => other.date && !other.problems.includes("date_guessed"));
      const guess = earlier?.date || later?.date || null;
      if (guess) {
        item.date = guess;
        item.problems.push("date_guessed");
      }
    });
  }

  // Rentals and money on a vehicle that is in this same file.
  const byPlate = new Map<string, string>();
  for (const vehicle of preview.vehicles) if (vehicle.plate && !byPlate.has(plateKey(vehicle.plate))) byPlate.set(plateKey(vehicle.plate), vehicle.key);
  for (const rental of preview.rentals) if (!rental.vehicleKey && rental.plate) rental.vehicleKey = findByPlate(byPlate, rental.plate) || null;
  for (const transaction of preview.transactions) if (transaction.plate) transaction.vehicleKey = findByPlate(byPlate, transaction.plate) || null;

  linkPayments(preview, payments, byPlate, today);
  return preview;
}

function addPeriods(date: string, count: number, period: "day" | "week" | "month") {
  const day = new Date(`${date}T00:00:00Z`);
  if (period === "day") day.setUTCDate(day.getUTCDate() + count);
  else if (period === "week") day.setUTCDate(day.getUTCDate() + 7 * count);
  else {
    const dom = day.getUTCDate();
    day.setUTCDate(1);
    day.setUTCMonth(day.getUTCMonth() + count);
    const last = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0)).getUTCDate();
    day.setUTCDate(Math.min(dom, last));
  }
  return day.toISOString().slice(0, 10);
}

function dayBefore(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

/** "Ford Everest Wildtrak - 2023 - White -": the vehicle card it names, by make, model and year (and colour if needed). */
function vehicleByName(preview: ImportPreview, label: string) {
  const words = cleanString(label).toLowerCase().replace(/[^\p{L}\p{N}\s+]/gu, " ").split(/\s+/).filter((word) => word.length >= 1);
  if (!words.length) return null;
  const scored = preview.vehicles
    .map((vehicle) => {
      const make = cleanString(vehicle.make).toLowerCase();
      const model = cleanString(vehicle.model).toLowerCase();
      const joined = words.join(" ");
      if (!make || !joined.includes(make)) return { vehicle, score: 0 };
      // "MG3" / "Mazda 2": model written straight after the make.
      const modelHit = model && (joined.includes(model) || joined.includes(`${make}${model}`) || words.includes(`${make}${model}`));
      if (!modelHit) return { vehicle, score: 0 };
      let score = 2;
      if (vehicle.year && words.includes(String(vehicle.year))) score += 2;
      if (vehicle.color && words.includes(cleanString(vehicle.color).toLowerCase())) score += 1;
      if (vehicle.trim && cleanString(vehicle.trim).toLowerCase().split(/\s+/).some((word) => word.length > 2 && words.includes(word.replace(/[^\p{L}\p{N}+]/gu, "")))) score += 1;
      return { vehicle, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].vehicle;
}

/**
 * Rent payments from a payment sheet: each one received becomes rent in Money in & out, against its vehicle (and its
 * current rental when it falls in it). The current rental's next payment comes from the same list: the first one not
 * yet received after the last one that was; or, when none is listed, a period (or as many as the last payment
 * covered) after the last one received. Unpaid entries before the last received one are flagged to check.
 */
function linkPayments(preview: ImportPreview, payments: PaymentRow[], byPlate: Map<string, string>, today: string) {
  if (!payments.length) return;
  const keyOf = new Map<string, string | null>();
  const groups = new Map<string, typeof payments>();
  for (const payment of payments) {
    if (!keyOf.has(payment.label)) keyOf.set(payment.label, (payment.plate && findByPlate(byPlate, payment.plate)) || vehicleByName(preview, payment.label)?.key || null);
    const key = keyOf.get(payment.label) || `plate:${payment.plate || payment.label}`;
    groups.set(key, [...(groups.get(key) || []), payment]);
  }
  for (const [key, rows] of groups) {
    const vehicle = preview.vehicles.find((item) => item.key === key) || null;
    const plate = vehicle?.plate || rows[0].plate;
    // The current rental: on the vehicle card, or (when the rentals came from a bookings tab) on the same plate.
    const rental = preview.rentals.find((item) => item.include && item.status === "active" && ((vehicle && item.vehicleKey === vehicle.key) || (plate && item.plate && plateKey(item.plate) === plateKey(plate)))) || null;
    const dated = rows.filter((row) => row.date).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    for (const row of dated) {
      if (!row.paid || row.amount === null || row.amount <= 0) continue;
      preview.transactions.push({
        key: `transactions:${row.sheet}:pay-${row.row}-${preview.transactions.length}`,
        sheet: row.sheet,
        row: row.row,
        include: true,
        problems: vehicle || plate ? [] : ["unknown_vehicle"],
        plate,
        existingVehicleId: null,
        vehicleKey: vehicle?.key || null,
        date: row.paidOn || row.date,
        type: "rental_income",
        amount: row.amount,
        notes: ["Rent", row.notes].filter(Boolean).join(" · "),
        rentalKey: rental && rental.startDate && String(row.date) >= rental.startDate ? rental.key : null,
        vehicleName: splitPlateFromName(row.label).name
      });
    }
    if (!rental || !rental.startDate) continue;
    const inRental = dated.filter((row) => String(row.date) >= String(rental.startDate));
    if (!inRental.length) continue;
    const received = inRental.filter((row) => row.paid);
    const last = received[received.length - 1] || null;
    const nextUnpaid = inRental.find((row) => !row.paid && (!last || String(row.date) > String(last.date)));
    let nextDue: string | null = null;
    if (nextUnpaid) nextDue = nextUnpaid.date;
    else if (last) {
      const covered = rental.rate && last.amount ? Math.max(1, Math.round(last.amount / rental.rate)) : 1;
      nextDue = addPeriods(String(last.date), covered, rental.ratePeriod || "month");
      if (covered !== 1) rental.problems.push("next_due_from_payments");
    }
    if (last && inRental.some((row) => !row.paid && String(row.date) < String(last.date))) rental.problems.push("payment_gaps");
    if (nextDue) {
      rental.nextDue = nextDue;
      rental.paidUntil = dayBefore(nextDue);
      rental.problems = rental.problems.filter((problem) => problem !== "paid_until_unknown");
    }
    rental.moneyFromSheet = true;
    rental.problems = [...new Set(rental.problems)];
    void today;
  }
}

export type ExistingVehicle = { id: string; registration_number: string | null; make: string; model: string };
export type ExistingCustomer = { id: string; full_name: string; phone: string | null };
/** A booking or rental the business already has, to catch the same rental coming in twice. */
export type ExistingRental = { vehicle_id: string; start_date: string; end_date: string | null; customer_name: string; customer_phone: string | null };

/** A vehicle card for a plate that only appears on a rental or a money row ("2017 Toyota Yaris", "Click 125i"). */
function newVehicleCard(sheet: string, row: number, plate: string, name: string, from: "rental" | "money"): PreviewVehicle {
  const yearText = cleanString(name).match(/(?:^|\s)((19|20)\d{2}|25\d{2})(?=\s|$)/)?.[1] || "";
  const { make, model } = guessMakeModel(cleanString(name).replace(yearText, " ").replace(/\s+/g, " ").trim());
  const problems: Problem[] = make && model ? [] : ["no_make_model"];
  return { key: `vehicles:${sheet}:from-${from}-${row}`, sheet, row, include: true, problems, existingId: null, plate, make, model, trim: "", year: parseYearValue(yearText), color: "", mileage: null, dailyRate: null, weeklyRate: null, monthlyRate: null, extra: {} };
}

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
  const fleetInFile = preview.vehicles.length > 0;
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
    const card = newVehicleCard(rental.sheet, rental.row, rental.plate, rental.vehicleName, "rental");
    if (rental.mileageAtStart === null) card.problems.unshift("no_mileage");
    Object.assign(card, { mileage: rental.mileageAtStart, dailyRate: rental.ratePeriod === "day" ? rental.rate : null, weeklyRate: rental.ratePeriod === "week" ? rental.rate : null, monthlyRate: rental.ratePeriod === "month" ? rental.rate : null });
    preview.vehicles.push(card);
    addedByPlate.set(plateKey(rental.plate), card.key);
    rental.vehicleKey = card.key;
  }
  for (const transaction of preview.transactions) {
    transaction.existingVehicleId = transaction.plate ? findByPlate(vehicleByPlate, transaction.plate) || null : null;
    if (transaction.existingVehicleId || transaction.vehicleKey || transaction.business) continue;
    const added = transaction.plate ? findByPlate(addedByPlate, transaction.plate) : undefined;
    if (added) {
      transaction.vehicleKey = added;
      continue;
    }
    // A file of money only (one tab per vehicle, a cost log, rent received): the vehicles it names are new when the
    // business has none yet, or when the row names the vehicle properly ("Yaris กข 1234"). A bare plate nobody has,
    // or one missing from the fleet list in the same file, is more likely a typo, so it's flagged instead.
    if (transaction.plate && /\d/.test(transaction.plate) && !fleetInFile && (vehicles.length === 0 || looksLikeVehicleName(transaction.vehicleName))) {
      const card = newVehicleCard(transaction.sheet, transaction.row, transaction.plate, transaction.vehicleName || "", "money");
      preview.vehicles.push(card);
      addedByPlate.set(plateKey(transaction.plate), card.key);
      transaction.vehicleKey = card.key;
      continue;
    }
    mark(transaction.problems, "unknown_vehicle");
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
