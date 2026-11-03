/**
 * Export files from other rental software, recognised by their headings and read without the AI (faster, free and
 * the same every time). Columns a preset doesn't know are left to the usual reading (the owner's past corrections, the
 * AI when it's on, then the header rules), so an export with extra or renamed columns still comes in.
 *
 * Before the mapping, the files are prepared the way RoveHQ needs them, as extra columns the owner can see in
 * "Change how a column was read":
 * - a booking's status in the other system becomes "Returned (from status)" yes/no (cancelled, quotes and drafts are
 *   left out by the preview, lib/import/preview.ts);
 * - several files at once are linked: a booking that names its customer or vehicle by the other system's ID gets the
 *   customer's name, phone and email and the vehicle's plate from the customers and vehicles files;
 * - a payments file gets "Money in" / "Money out" (refunds go out), so a deposit is never read as rent; payments on a
 *   rental that is still running are left to the rental's "paid up to" (not copied, so nothing is counted twice);
 * - mileage in miles or kilometres is converted to the business's unit.
 * Column names come from the software's help articles, API field names and on-screen labels (docs/competitor-exports.md).
 */
import type { ParsedSheet } from "@/lib/import/spreadsheet";
import { cleanString, parseNumberValue } from "@/lib/import/normalize";
import { SOFTWARE_BY_ID, softwareById, type SoftwareId } from "@/lib/import/software";

export type PresetKind = "vehicles" | "customers" | "rentals" | "payments";
type Columns = Array<[RegExp, string]>;

type PresetFile = {
  software: SoftwareId;
  kind: PresetKind;
  /** At least one of these headings must be there: what tells this software's file from another's. */
  key: RegExp[];
  /** Headings the file usually has; `need` of them (key included) must be there. */
  signature: RegExp[];
  need: number;
  /** This software's own names for columns, checked before the shared ones. */
  columns?: Columns;
  /** The record's own ID in the other system (for linking files). */
  id?: RegExp;
  /** Shared column names to leave alone in this software's file (Rezdy's "Deposit" is a part payment, not a bond). */
  skip?: string[];
};

/** Headings compared in lower case with punctuation as spaces: "Res #" is "res no", "Pick-Up Date/Time" "pick up date time". */
export function headingKey(header: string) {
  return String(header || "")
    .toLowerCase()
    .replace(/[#№]/g, " no ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PLATE = /^((license|licence|number|registration|reg|vehicle|car) )?plate( no| number)?$|^registration( no| number)?$|^reg( no)?$|^(license|licence)( plate)?( no| number)?$|^tag( no| number)?$|^rego$|^state number$/;
const START = /^(pick ?up|pickup|start|starts at|from|out|date out|out date|time out|check ?out|departure|rental start|start time|tour date|activity date|date from|date start)( date)?( time)?( date time)?$/;
const END = /^(return|drop ?off|dropoff|end|stops at|stop|till|until|to|in|date in|in date|time in|due|due back|date due|due date|expected return|check ?in|rental end|end time|date to|date end)( date)?( time)?( date time)?$/;
const MILEAGE = /^(current |last |latest )?(odometer|mileage|miles|kms?|kilomet(er|re)s)( reading)?( mi| km| miles| kms)?$/;

const VEHICLE_COMMON: Columns = [
  [PLATE, "registration_number"],
  [/^(make|brand|manufacturer)$/, "make"],
  [/^model( name)?$/, "model"],
  [/^(trim|variant|grade)$/, "trim"],
  [/^(vehicle|car|description|vehicle name|vehicle description|name|product|product name|item|item name)$/, "vehicle_name"],
  [/^(year|model year|yr)$/, "year"],
  [/^colou?r$/, "color"],
  [/^(vin|vin no|vin number|chassis( no| number)?)$/, "vin"],
  [MILEAGE, "current_mileage"],
  [/^(transmission|gearbox|gear)$/, "transmission"],
  [/^(fuel|fuel type)$/, "fuel_type"],
  [/^(seats|seating|passengers|seating capacity)$/, "seating_capacity"],
  [/^(daily|day) (rate|price)$|^(rate|price) per day$/, "daily_rate"],
  [/^(weekly|week) (rate|price)$|^(rate|price) per week$/, "weekly_rate"],
  [/^(monthly|month) (rate|price)$|^(rate|price) per month$/, "monthly_rate"],
  [/^(purchase price|cost price|acquisition cost)$/, "purchase_price"],
  [/^(purchase date|in service date|in fleet date|acquired)$/, "purchase_date"],
  [/^(notes?|remarks|comments?)$/, "notes"]
];

const PERSON_COMMON: Columns = [
  [/^((customer|renter|driver|contact|client|lead customer|guest) )?first name$|^given name$/, "first_name"],
  [/^((customer|renter|driver|contact|client|lead customer|guest) )?(last name|surname)$|^family name$/, "last_name"],
  [/^((customer|renter|driver|contact|client|guest) )?e ?mail( address)?$/, "email"],
  [/^((customer|renter|driver|contact|client|guest) )?(phone|mobile|cell|telephone|tel)( no| number| 1)?$/, "phone"],
  [/^(nationality|citizenship)$/, "nationality"],
  [/^passport( no| number)?$/, "passport_number"],
  [/^(driv(er|ers|ing) )?licen[cs]e( no| number)?$|^dl( no| number)?$/, "driving_licence_number"]
];

const RENTAL_COMMON: Columns = [
  [/^(status|booking status|reservation status|order status|state|status name)$/, "booking_status"],
  [START, "start_date"],
  [END, "end_date"],
  [/^(customer|customer name|renter|renter name|driver|driver name|contact|contact name|client|client name|name|full name|guest|lead customer|primary driver|hirer)$/, "customer_name"],
  ...PERSON_COMMON,
  [PLATE, "vehicle_registration"],
  [/^(vehicle|car|vehicle description|vehicle model|vehicle name|model|item|items|product|product name|products|equipment|rental item|summary)$/, "vehicle_name"],
  [/^(vehicle class|class|car group|group|category|vehicle type|vehicle category|car class)$/, "vehicle_name"],
  [/^(total|grand total|total price|total amount|total charges?|order total|booking total|reservation total|amount|price|gross|invoice total|total due|total incl( vat| tax)?|total inc( vat| tax)?)$/, "rental_total"],
  [/^(paid|total paid|amount paid|paid amount|paid total|payments received|payment total|paid to date)$/, "amount_paid"],
  [/^(security deposit|deposit|deposit amount|damage deposit|bond|deposit held|deposit value)$/, "deposit_amount"],
  [/^(days|no of days|number of days|rental days|duration days|total days|length days)$/, "rental_days"],
  [/^(daily rate|rate|day rate|rate per day|price per day)$/, "rental_rate"],
  [/^((odometer|mileage|km|kms|miles) (out|start|at pick ?up|pick ?up)|(out|start) (odometer|mileage|km|kms|miles))( mi| km)?$/, "mileage_at_start"],
  [/^(notes?|remarks|comments?)$/, "notes"]
];

const CUSTOMER_COMMON: Columns = [
  [/^(name|full name|customer|customer name|contact name|display name|client|client name)$/, "full_name"],
  ...PERSON_COMMON,
  [/^country$/, "nationality"]
];

const PAYMENT_COMMON: Columns = [
  [/^(date|payment date|paid on|paid at|created at|created|transaction date|received on|date paid)$/, "date"],
  [/^(amount|payment amount|value|sum|paid|amount paid|total)$/, "amount"],
  [/^(type|payment type|kind|category|description|reason|transaction type|item)$/, "type"],
  [/^(method|payment method|gateway|tender|notes?|memo)$/, "notes"]
];

const COMMON: Record<PresetKind, Columns> = { vehicles: VEHICLE_COMMON, customers: CUSTOMER_COMMON, rentals: RENTAL_COMMON, payments: PAYMENT_COMMON };

const ID_COMMON = /^(id|no|number|code|ref|reference|(booking|reservation|order|res|ra|rental agreement|contract|agreement|customer|client|contact|vehicle|unit|stock|car|payment|transaction)( id| no| number| code| ref)?)$/;
const BOOKING_REF = /^(booking|reservation|order|res|ra|rental agreement|contract|agreement)( id| no| number| code| ref| reference)?$/;

/** The files each software exports. Order matters only for ties (the owner's own choice of software breaks those). */
const PRESETS: PresetFile[] = [
  // Booqable: Orders, Customers and Inventory each have Export at the bottom of the list (CSV).
  {
    software: "booqable",
    kind: "rentals",
    key: [/^item count$/, /^tax region$/, /^(starts at|stops at)$/],
    signature: [/^(number|order number|order)$/, /^status$/, /^(starts at|start date|from)$/, /^(stops at|stop date|till|until)$/, /^customer( name)?$/, /^item count$/, /^tax region$/, /^(price|grand total|total|grand total with tax)$/, /^pickup location$/],
    need: 4,
    id: /^(number|order number|order|id)$/,
    columns: [[/^(grand total with tax|grand total|price)$/, "rental_total"], [/^(deposit|deposit amount|security deposit)$/, "deposit_amount"]]
  },
  {
    software: "booqable",
    kind: "customers",
    key: [/^deposit type$/, /^legal type$/, /^discount percentage$/, /^tax region$/],
    signature: [/^name$/, /^e ?mail$/, /^(number|customer number)$/, /^deposit type$/, /^legal type$/, /^discount percentage$/, /^tax region$/, /^phone$/],
    need: 3,
    id: /^(number|customer number|id)$/,
    columns: [[/^(deposit type|deposit value|discount percentage|legal type|tax region)$/, "__ignore__"]]
  },
  {
    software: "booqable",
    kind: "vehicles",
    key: [/^(stock item )?identifier$/],
    signature: [/^(stock item )?identifier$/, /^(product|product name|name)$/, /^product group$/, /^sku$/, /^trackable$/, /^status$/],
    need: 2,
    id: /^(stock item )?identifier$/,
    columns: [[/^(stock item )?identifier$/, "registration_number"], [/^(product|product name|product group|name)$/, "vehicle_name"]]
  },
  // HQ Rental Software: any table (Reservations, Vehicles, Customers) exports from its menu, Actions > Export (Excel).
  {
    software: "hq",
    kind: "rentals",
    key: [/^pick ?up location$/, /^return location$/, /^outstanding balance$/, /^total paid$/],
    signature: [/^(reservation|reservation no|reservation id|reservation number|no|id)$/, /^pick ?up date( time)?$/, /^return date( time)?$/, /^vehicle class$/, /^pick ?up location$/, /^return location$/, /^status$/, /^customer( name)?$/, /^outstanding balance$/, /^total paid$/, /^security deposit$/],
    need: 4,
    id: /^(reservation|reservation no|reservation id|reservation number|no|id)$/,
    columns: [[/^(total price|total)$/, "rental_total"], [/^total paid$/, "amount_paid"], [/^outstanding balance$/, "__ignore__"]]
  },
  {
    software: "hq",
    kind: "vehicles",
    key: [/^vehicle class$/],
    signature: [/^vehicle class$/, PLATE, /^(brand|make)$/, /^model$/, /^(current )?odometer$/, /^vin$/, /^(location|branch)$/, /^status$/],
    need: 4,
    id: /^(id|vehicle id|no)$/
  },
  // RentWorks / RentWorks Plus: lists have Export buttons; reports export from Export Results (Excel or CSV). US: month first, miles.
  {
    software: "rentworks",
    kind: "rentals",
    key: [/^ra( no| number)?$/, /^res( no| number)?$/, /^unit( no| number)?$/],
    signature: [/^ra( no| number)?$/, /^res( no| number)?$/, /^unit( no| number)?$/, /^(date out|out date|out)$/, /^(date due|due date|due back|due)$/, /^(date in|in date|in)$/, /^class$/, /^(renter|customer|renter name|customer name)$/, /^status$/],
    need: 4,
    id: /^(ra|res)( no| number)?$/
  },
  {
    software: "rentworks",
    kind: "vehicles",
    key: [/^unit( no| number)?$/],
    signature: [/^unit( no| number)?$/, /^vin$/, PLATE, /^make$/, /^model$/, /^(mileage|miles|odometer)$/, /^class$/, /^year$/],
    need: 4,
    id: /^unit( no| number)?$/
  },
  // TSD Rental (dealer loaners and rental): contracts and units by stock number. US: month first, miles.
  {
    software: "tsd",
    kind: "rentals",
    key: [/^contract( no| number)?$/, /^stock( no| number)?$/],
    signature: [/^contract( no| number)?$/, /^stock( no| number)?$/, /^(date out|out date|time out)$/, /^(date in|in date|expected return|due back)$/, /^(customer|customer name)$/, /^vin$/, /^status$/],
    need: 4,
    id: /^contract( no| number)?$/
  },
  {
    software: "tsd",
    kind: "vehicles",
    key: [/^stock( no| number)?$/],
    signature: [/^stock( no| number)?$/, /^vin$/, /^make$/, /^model$/, /^year$/, /^(mileage|miles|odometer)$/, PLATE],
    need: 4,
    id: /^stock( no| number)?$/
  },
  // Navotar: reservations and rental agreements. US: month first, miles.
  {
    software: "navotar",
    kind: "rentals",
    key: [/^agreement( no| number)$/, /^vehicle type$/, /^vehicle( no| number)$/],
    signature: [/^reservation( no| number)?$/, /^agreement( no| number)$/, /^pickup date( time)?$/, /^return date( time)?$/, /^vehicle type$/, /^vehicle( no| number)$/, /^customer( name)?$/, /^status$/],
    need: 4,
    id: /^(agreement|reservation)( no| number)$/
  },
  // Rental Car Manager: Reports > Other Reports > Bookings Export, with payments (payment date, type, reference, amount, merchant fee).
  {
    software: "rcm",
    kind: "rentals",
    key: [/^merchant fee( amount)?$/, /^date booked$/, /^date closed$/, /^dropoff date( time)?$/],
    signature: [/^(reservation no|res no|booking no|reservation number|booking number|reservation)$/, /^pickup date( time)?$/, /^dropoff date( time)?$/, /^date booked$/, /^first name$/, /^last name$/, /^(vehicle category|category)$/, /^registration( no)?$/, /^status$/, /^payment date$/, /^payment type$/, /^merchant fee( amount)?$/],
    need: 4,
    id: /^(reservation no|res no|booking no|reservation number|booking number|reservation)$/,
    columns: [[/^(amount|payment amount)$/, "amount_paid"], [/^(payment type|reference no|reference number)$/, "__ignore__"], [/^payment date$/, "__ignore__"]]
  },
  // RentSyst: Vehicles > Park > Options downloads XLS or CSV; orders and clients lists likewise.
  {
    software: "rentsyst",
    kind: "vehicles",
    key: [/^(state number|car number|number plate|number)$/],
    signature: [/^brand$/, /^model$/, /^(state number|car number|number plate|number)$/, /^group$/, /^mileage$/, /^year$/, /^(color|colour)$/, /^status$/],
    need: 4,
    id: /^(id|number|state number|car number)$/,
    columns: [[/^(state number|car number|number plate|number)$/, "registration_number"]]
  },
  {
    software: "rentsyst",
    kind: "rentals",
    key: [/^client$/],
    signature: [/^order( id| no| number)?$/, /^client$/, /^car$/, /^(date from|start date|date start)$/, /^(date to|end date|date end)$/, /^status$/, /^(total|sum)$/, /^paid$/, /^deposit$/],
    need: 4,
    id: /^(order( id| no| number)?|id)$/,
    columns: [[/^client$/, "customer_name"], [/^car$/, "vehicle_name"], [/^sum$/, "rental_total"]]
  },
  // Checkfront: Booking Index > Export (CSV, Excel, XML), all columns, ISO dates.
  {
    software: "checkfront",
    kind: "rentals",
    key: [/^summary$/, /^customer name$/, /^paid total$/, /^status name$/],
    signature: [/^(booking|booking id|code|booking code)$/, /^status( name)?$/, /^customer name$/, /^customer email$/, /^customer phone$/, /^start date$/, /^end date$/, /^(paid|paid total)$/, /^summary$/, /^total$/],
    need: 5,
    id: /^(booking|booking id|code|booking code)$/
  },
  // FareHarbor: Reports > Bookings, exported in its standard CSV. US: month first.
  {
    software: "fareharbor",
    kind: "rentals",
    key: [/^contact name$/, /^availability$/, /^receivable$/],
    signature: [/^(booking|booking id|booking no|no|id)$/, /^item$/, /^(start|start date|start time|availability)$/, /^contact name$/, /^contact email$/, /^contact phone$/, /^(total|total paid|amount paid|receivable)$/, /^status$/, /^(customer count|pax)$/],
    need: 4,
    id: /^(booking|booking id|booking no|no|id)$/,
    columns: [[/^(total paid|amount paid)$/, "amount_paid"]]
  },
  // Rezdy: Reports > Sales - Orders > Export to CSV (every column).
  {
    software: "rezdy",
    kind: "rentals",
    key: [/^order number$/, /^product name$/],
    signature: [/^order number$/, /^product name$/, /^(start time|tour date|start date|session start)$/, /^customer first name$/, /^customer last name$/, /^customer email$/, /^(total amount|order total|total)$/, /^(paid amount|amount paid|paid)$/, /^status$/],
    need: 5,
    id: /^order number$/,
    columns: [[/^(paid amount|amount paid|paid)$/, "amount_paid"], [/^(total amount|order total|total)$/, "rental_total"], [/^deposit( amount)?$/, "__ignore__"]],
    skip: ["deposit_amount"]
  },
  // Rentle: orders by store, with start and end.
  {
    software: "rentle",
    kind: "rentals",
    key: [/^(store|shop)( name)?$/],
    signature: [/^order( id| no| number)?$/, /^(start|start time|start date)$/, /^(end|end time|end date)$/, /^(store|shop)( name)?$/, /^customer( name)?$/, /^(total|total price)$/, /^(products|items|product)$/],
    need: 5,
    id: /^order( id| no| number)?$/
  }
];

/* ── Recognising a file ───────────────────────────────────────────────── */

export type PresetMatch = { sheetName: string; software: SoftwareId; kind: PresetKind; generic: boolean };

const hasHeading = (keys: string[], pattern: RegExp) => keys.some((key) => pattern.test(key));

/** The preset a sheet's headings fit best, if any. The software the owner said they use needs one heading fewer. */
export function detectPreset(sheet: Pick<ParsedSheet, "headers">, chosen?: string | null): PresetFile | null {
  const keys = sheet.headers.map(headingKey);
  let best: { preset: PresetFile; score: number } | null = null;
  for (const preset of PRESETS) {
    if (!preset.key.some((pattern) => hasHeading(keys, pattern))) continue;
    const hits = preset.signature.filter((pattern) => hasHeading(keys, pattern)).length;
    const mine = preset.software === chosen;
    if (hits < (mine ? preset.need - 1 : preset.need)) continue;
    const score = hits + (mine ? 2 : 0);
    if (!best || score > best.score) best = { preset, score };
  }
  return best?.preset || null;
}

/**
 * Each column's field, rule by rule: the first rule takes the first column it fits, so a software's own names win over
 * the shared ones and "Vehicle" wins over "Vehicle class". One column per field.
 */
function mapColumns(headers: string[], rules: Columns): Map<string, string> {
  const mapped = new Map<string, string>();
  const used = new Set<string>();
  const keys = headers.map(headingKey);
  for (const [pattern, field] of rules) {
    // Set-aside rules take every column they fit.
    if (field === "__ignore__") {
      keys.forEach((key, index) => {
        if (!mapped.has(headers[index]) && pattern.test(key)) mapped.set(headers[index], field);
      });
      continue;
    }
    if (used.has(field)) continue;
    const at = keys.findIndex((key, index) => !mapped.has(headers[index]) && pattern.test(key));
    if (at === -1) continue;
    mapped.set(headers[at], field);
    if (field !== "__ignore__") used.add(field);
  }
  return mapped;
}

function rulesFor(kind: PresetKind, preset?: PresetFile | null): Columns {
  const skip = new Set(preset?.skip || []);
  return [...(preset?.columns || []), ...COMMON[kind].filter(([, field]) => !skip.has(field))];
}

/** A sheet no preset knows, read with the shared names, when it sits next to files that matched (or the owner named a software). */
function genericKind(headers: string[]): PresetKind | null {
  const read = (kind: PresetKind) => new Set(mapColumns(headers, COMMON[kind]).values());
  const keys = headers.map(headingKey);
  const hasRef = keys.some((key) => BOOKING_REF.test(key));
  const payments = read("payments");
  const rentals = read("rentals");
  if (payments.has("amount") && payments.has("date") && (hasRef || payments.has("type")) && !rentals.has("start_date")) return "payments";
  if (rentals.has("start_date") && (rentals.has("end_date") || rentals.has("customer_name") || rentals.has("first_name"))) return "rentals";
  const customers = read("customers");
  if ((customers.has("full_name") || customers.has("first_name")) && (customers.has("email") || customers.has("phone"))) return "customers";
  const vehicles = read("vehicles");
  if (vehicles.has("registration_number") && (vehicles.has("make") || vehicles.has("model") || vehicles.has("vehicle_name") || vehicles.has("vin"))) return "vehicles";
  return null;
}

/* ── What a status in the other system means ──────────────────────────── */

const AGREEMENT_SOFTWARE = new Set<SoftwareId>(["rentworks", "tsd", "navotar"]);

/**
 * "out" (with the customer now), "returned", "cancelled", "draft" (a quote or enquiry, never confirmed) or "booked".
 * Booqable: concept, reserved, started, stopped, archived, canceled. HQ: quote, pending, open, rental, completed,
 * cancelled, no show. Rental Car Manager: reservation, hired, returned. Checkfront: hold, paid, cancelled, void.
 */
export function statusMeaning(value: unknown, software?: SoftwareId | null): "out" | "returned" | "cancelled" | "draft" | "booked" | null {
  const text = cleanString(value).toLowerCase();
  if (!text) return null;
  // Agreement-based systems (RentWorks, TSD, Navotar): an "open" rental agreement is a vehicle out now.
  if (/^open( ra| contract| agreement)?$/.test(text) && software && AGREEMENT_SOFTWARE.has(software)) return "out";
  if (/cancel|void|no.?show|declin|reject|expired|abandon|refused|storn|annul/.test(text)) return "cancelled";
  if (/^(quote|quoted|draft|concept|new|enquiry|inquiry|tentative|on ?hold|hold|request(ed)?|waiting|lead)$/.test(text)) return "draft";
  if (/return|checked ?in|check ?in|closed|complete|finish|stopped|archived|done|ended|settled/.test(text)) return "returned";
  if (/checked ?out|check ?out|on ?rent|^rental$|^rented$|started|picked ?up|^out$|active|in progress|hired|^open contract$|ongoing/.test(text)) return "out";
  if (/reserv|confirm|book|^open$|pending|upcoming|scheduled|^paid$|part.?paid|deposit/.test(text)) return "booked";
  return null;
}

/* ── Preparing the files ──────────────────────────────────────────────── */

type Prepared = { sheet: ParsedSheet; match: PresetMatch; preset: PresetFile | null; mapping: Map<string, string> };

export type RawPresetSheet = {
  sheet_name: string;
  primary_data_type: string;
  confidence: number;
  column_mappings: { source_column: string; routehq_field: string; confidence: number }[];
  date_order_hint?: "dmy" | "mdy";
  preset?: string;
};

export type PreparedImport = {
  sheets: ParsedSheet[];
  matches: PresetMatch[];
  /** The preset reading of each matched sheet, shaped like the AI's answer (lib/import/analysis.ts merges them). */
  raw: RawPresetSheet[];
  /** Headings in matched sheets the preset didn't place: worth the AI's look when it's on. */
  unplaced: Map<string, string[]>;
  /** What was done to the files, in English for said(). */
  notes: string[];
};

const KM_PER_MILE = 1.609344;
const tidy = (value: unknown) => cleanString(value).toLowerCase();

function fieldColumn(item: Prepared, field: string) {
  for (const [header, mapped] of item.mapping) if (mapped === field) return header;
  return null;
}

function addColumn(sheet: ParsedSheet, header: string, values: string[]) {
  let name = header;
  for (let n = 2; sheet.headers.includes(name); n += 1) name = `${header} ${n}`;
  sheet.headers.push(name);
  sheet.rows.forEach((row, index) => {
    row[name] = values[index] || "";
  });
  sheet.sampleRows = sheet.rows.slice(0, 5);
  return name;
}

/** The column holding the record's own ID: named like one, filled in and (mostly) different on every row. */
function idColumn(item: Prepared) {
  const keys = item.sheet.headers.map(headingKey);
  const candidates = item.sheet.headers.filter((header, index) => (item.preset?.id || ID_COMMON).test(keys[index]));
  const fallback = item.sheet.headers.filter((header, index) => ID_COMMON.test(keys[index]));
  for (const header of [...candidates, ...fallback]) {
    const values = item.sheet.rows.map((row) => tidy(row[header])).filter(Boolean);
    if (values.length >= item.sheet.rows.length * 0.8 && new Set(values).size >= values.length * 0.9) return header;
  }
  return null;
}

const REFERRING_FIELDS = new Set(["__ignore__", "customer_name", "first_name", "full_name", "email", "phone", "vehicle_registration", "registration_number", "vehicle_name", "notes", "type"]);
const PAYMENT_ID = /^(id|payment( id| no| number)?|transaction( id| no| number)?)$/;

/** The column of `item` whose values are (mostly) found in `known`: how one file refers to another's records. */
function referringColumn(item: Prepared, known: Set<string>, skip: Set<string> = new Set()) {
  let best: { header: string; share: number } | null = null;
  for (const header of item.sheet.headers) {
    if (skip.has(header)) continue;
    // Days, amounts and dates can't name a record ("3" days is not vehicle 3).
    const mapped = item.mapping.get(header);
    if (mapped && !REFERRING_FIELDS.has(mapped)) continue;
    if (/count|qty|quantity|days|nights|pax|people|persons|seats|units|items|total|price|amount|rate|fee|tax/.test(headingKey(header))) continue;
    const values = item.sheet.rows.map((row) => tidy(row[header])).filter(Boolean);
    if (values.length < Math.max(1, item.sheet.rows.length * 0.5)) continue;
    // A column that says the same thing on every row ("Item count: 1") names nobody in particular.
    if (values.length >= 3 && new Set(values).size < 2) continue;
    const share = values.filter((value) => known.has(value)).length / values.length;
    if (share >= 0.6 && (!best || share > best.share)) best = { header, share };
  }
  return best?.header || null;
}

function personName(item: Prepared, row: Record<string, string>) {
  const full = fieldColumn(item, "full_name") || fieldColumn(item, "customer_name");
  if (full && cleanString(row[full])) return cleanString(row[full]);
  return [fieldColumn(item, "first_name"), fieldColumn(item, "last_name")].map((column) => (column ? cleanString(row[column]) : "")).filter(Boolean).join(" ");
}

/** A rental's customer from a customers file, by the ID (or email) the bookings file names them with. */
function linkCustomers(rentals: Prepared, customers: Prepared, notes: Set<string>) {
  const id = idColumn(customers);
  const email = fieldColumn(customers, "email");
  const index = new Map<string, Record<string, string>>();
  for (const row of customers.sheet.rows) {
    if (id && tidy(row[id])) index.set(tidy(row[id]), row);
    if (email && tidy(row[email]) && !index.has(tidy(row[email]))) index.set(tidy(row[email]), row);
  }
  const skip = new Set([idColumn(rentals) || ""]);
  const ref = index.size ? referringColumn(rentals, new Set(index.keys()), skip) : null;
  const phoneColumn = fieldColumn(customers, "phone");
  const emailColumn = fieldColumn(customers, "email");
  if (!ref) {
    // Bookings that name the customer (Booqable's "Customer"): their phone and email from the customers file.
    const byName = new Map(customers.sheet.rows.map((row) => [tidy(personName(customers, row)), row] as const).filter(([key]) => key));
    const nameColumn = fieldColumn(rentals, "customer_name");
    if (!nameColumn || !byName.size || referringColumn(rentals, new Set(byName.keys()), skip) !== nameColumn) return;
    const rows = rentals.sheet.rows.map((row) => byName.get(tidy(row[nameColumn])) || null);
    if (phoneColumn && !fieldColumn(rentals, "phone")) rentals.mapping.set(addColumn(rentals.sheet, "Phone (linked)", rows.map((row) => (row ? cleanString(row[phoneColumn]) : ""))), "phone");
    if (emailColumn && !fieldColumn(rentals, "email")) rentals.mapping.set(addColumn(rentals.sheet, "Email (linked)", rows.map((row) => (row ? cleanString(row[emailColumn]) : ""))), "email");
    notes.add(`Bookings in “${rentals.sheet.sheetName}” were matched to customers in “${customers.sheet.sheetName}”.`);
    return;
  }
  const found = rentals.sheet.rows.map((row) => index.get(tidy(row[ref])) || null);
  const name = addColumn(rentals.sheet, "Customer (linked)", found.map((row) => (row ? personName(customers, row) : "")));
  // The ID column was read as the renter's name ("Customer: C-1042"): the linked name takes its place.
  const refField = rentals.mapping.get(ref);
  if (refField && ["customer_name", "first_name", "last_name", "full_name", "phone"].includes(refField)) rentals.mapping.set(ref, "__ignore__");
  if (!fieldColumn(rentals, "customer_name") && !fieldColumn(rentals, "first_name")) rentals.mapping.set(name, "customer_name");
  if (phoneColumn && !fieldColumn(rentals, "phone")) rentals.mapping.set(addColumn(rentals.sheet, "Phone (linked)", found.map((row) => (row ? cleanString(row[phoneColumn]) : ""))), "phone");
  if (emailColumn && !fieldColumn(rentals, "email")) rentals.mapping.set(addColumn(rentals.sheet, "Email (linked)", found.map((row) => (row ? cleanString(row[emailColumn]) : ""))), "email");
  notes.add(`Bookings in “${rentals.sheet.sheetName}” were matched to customers in “${customers.sheet.sheetName}”.`);
}

/** A rental's vehicle from a vehicles file, by the plate or the other system's unit or vehicle number. */
function linkVehicles(rentals: Prepared, vehicles: Prepared, notes: Set<string>) {
  const plate = fieldColumn(vehicles, "registration_number");
  const id = idColumn(vehicles);
  const index = new Map<string, Record<string, string>>();
  for (const row of vehicles.sheet.rows) {
    if (id && tidy(row[id])) index.set(tidy(row[id]), row);
    if (plate && tidy(row[plate]) && !index.has(tidy(row[plate]))) index.set(tidy(row[plate]), row);
  }
  if (!index.size || !plate) return;
  const own = fieldColumn(rentals, "vehicle_registration");
  const ref = referringColumn(rentals, new Set(index.keys()), new Set([idColumn(rentals) || ""]));
  if (!ref) return;
  const found = rentals.sheet.rows.map((row) => index.get(tidy(row[ref])) || null);
  // Already the plate: nothing to add.
  if (found.every((row, at) => !row || tidy(row[plate]) === tidy(rentals.sheet.rows[at][ref]))) {
    if (!own) rentals.mapping.set(ref, "vehicle_registration");
    return;
  }
  const name = (row: Record<string, string>) =>
    [fieldColumn(vehicles, "year"), fieldColumn(vehicles, "make"), fieldColumn(vehicles, "model")].map((column) => (column ? cleanString(row[column]) : "")).filter(Boolean).join(" ") ||
    cleanString(row[fieldColumn(vehicles, "vehicle_name") || ""]);
  const refField = rentals.mapping.get(ref);
  if (refField === "vehicle_registration" || refField === "vehicle_name") rentals.mapping.set(ref, "__ignore__");
  if (!fieldColumn(rentals, "vehicle_registration")) rentals.mapping.set(addColumn(rentals.sheet, "Plate (linked)", found.map((row) => (row ? cleanString(row[plate]) : ""))), "vehicle_registration");
  const vehicleName = addColumn(rentals.sheet, "Vehicle (linked)", found.map((row) => (row ? name(row) : "")));
  const current = fieldColumn(rentals, "vehicle_name");
  // A class ("Economy", "Compact SUV") says less than the vehicle itself.
  if (!current || /class|group|category|type/.test(headingKey(current))) {
    if (current) rentals.mapping.set(current, "__ignore__");
    rentals.mapping.set(vehicleName, "vehicle_name");
  }
  notes.add(`Bookings in “${rentals.sheet.sheetName}” were matched to vehicles in “${vehicles.sheet.sheetName}”.`);
}

/**
 * Payments: money in or out by sign and kind (refunds go out; a deposit stays a deposit), linked to their booking's
 * vehicle and customer. Payments on a rental still running are left out: its "paid up to" records them.
 */
function preparePayments(payments: Prepared, rentals: Prepared[], notes: Set<string>) {
  const amount = fieldColumn(payments, "amount");
  if (!amount) return;
  const type = fieldColumn(payments, "type");
  const method = fieldColumn(payments, "notes");
  let linked: { rental: Prepared; byId: Map<string, Record<string, string>>; ref: string } | null = null;
  for (const rental of rentals) {
    const id = idColumn(rental);
    if (!id) continue;
    const byId = new Map(rental.sheet.rows.filter((row) => tidy(row[id])).map((row) => [tidy(row[id]), row] as const));
    const ref = referringColumn(payments, new Set(byId.keys()), new Set([amount, ...payments.sheet.headers.filter((header) => PAYMENT_ID.test(headingKey(header)))]));
    if (ref) {
      linked = { rental, byId, ref };
      break;
    }
  }
  const value = (row: Record<string, string>) => parseNumberValue(row[amount]);
  const outgoing = (row: Record<string, string>) => {
    const text = `${type ? row[type] : ""} ${method ? row[method] : ""}`;
    return (value(row) ?? 0) < 0 || /refund|returned|payout|paid out|reversal|chargeback|withdraw|released/i.test(text);
  };
  // Rent paid on each booking (not deposits, not refunds): the booking's "amount paid" when its file doesn't say,
  // which is how a running rental's "paid up to" is worked out.
  if (linked && !fieldColumn(linked.rental, "amount_paid")) {
    const paid = new Map<string, number>();
    for (const row of payments.sheet.rows) {
      const text = `${type ? row[type] : ""}`;
      if (outgoing(row) || /deposit|bond|damage|fine|charge|fee/i.test(text)) continue;
      const key = tidy(row[linked.ref]);
      paid.set(key, (paid.get(key) || 0) + Math.abs(value(row) || 0));
    }
    const id = idColumn(linked.rental);
    if (id && paid.size) linked.rental.mapping.set(addColumn(linked.rental.sheet, "Paid (from payments)", linked.rental.sheet.rows.map((row) => (paid.has(tidy(row[id])) ? String(paid.get(tidy(row[id]))) : ""))), "amount_paid");
  }
  const keep: Record<string, string>[] = [];
  let running = 0;
  for (const row of payments.sheet.rows) {
    const booking = linked ? linked.byId.get(tidy(row[linked.ref])) || null : null;
    const status = booking && linked ? fieldColumn(linked.rental, "booking_status") : null;
    if (booking && status && linked && statusMeaning(booking[status], linked.rental.match.software) === "out") {
      running += 1;
      continue;
    }
    keep.push(row);
  }
  payments.sheet.rows = keep;
  payments.mapping.set(amount, "__ignore__");
  payments.mapping.set(addColumn(payments.sheet, "Money in", keep.map((row) => (!outgoing(row) && value(row) !== null ? String(Math.abs(value(row)!)) : ""))), "money_in");
  payments.mapping.set(addColumn(payments.sheet, "Money out", keep.map((row) => (outgoing(row) && value(row) !== null ? String(Math.abs(value(row)!)) : ""))), "money_out");
  if (linked) {
    const { rental, byId, ref } = linked;
    const plate = fieldColumn(rental, "vehicle_registration");
    const rows = keep.map((row) => byId.get(tidy(row[ref])) || null);
    if (plate && !fieldColumn(payments, "vehicle_registration")) payments.mapping.set(addColumn(payments.sheet, "Plate (linked)", rows.map((row) => (row ? cleanString(row[plate]) : ""))), "vehicle_registration");
    if (!fieldColumn(payments, "customer_name")) payments.mapping.set(addColumn(payments.sheet, "Customer (linked)", rows.map((row) => (row ? personName(rental, row) : ""))), "customer_name");
  }
  if (running) notes.add(`${running} payment${running === 1 ? "" : "s"} on rentals still running were left out: each rental's “paid up to” records them, so nothing is counted twice.`);
}

/** A booking's status as "Returned" yes/no, which the preview reads (cancelled ones it leaves out itself). */
function addReturned(item: Prepared) {
  const status = fieldColumn(item, "booking_status");
  if (!status || fieldColumn(item, "returned")) return;
  const values = item.sheet.rows.map((row) => {
    const meaning = statusMeaning(row[status], item.match.software);
    return meaning === "returned" ? "yes" : meaning === "out" ? "no" : "";
  });
  if (values.some(Boolean)) item.mapping.set(addColumn(item.sheet, "Returned (from status)", values), "returned");
}

/** Mileage in the business's unit: a heading that says miles or km decides, else what the software uses. */
function convertMileage(item: Prepared, unit: "km" | "mi", notes: Set<string>) {
  const fallback = SOFTWARE_BY_ID.get(item.match.software)?.distance || null;
  for (const [header, field] of item.mapping) {
    if (!["current_mileage", "mileage_at_start", "purchase_mileage"].includes(field)) continue;
    const key = headingKey(header);
    const from = /\b(mi|miles|mileage mi)\b/.test(key) ? "mi" : /\b(km|kms|kilomet\w*)\b/.test(key) ? "km" : fallback;
    if (!from || from === unit) continue;
    for (const row of item.sheet.rows) {
      const number = parseNumberValue(row[header]);
      if (number !== null) row[header] = String(Math.round(from === "mi" ? number * KM_PER_MILE : number / KM_PER_MILE));
    }
    notes.add(from === "mi" ? `Mileage in “${item.sheet.sheetName}” was converted from miles to km.` : `Mileage in “${item.sheet.sheetName}” was converted from km to miles.`);
  }
}

const DATA_TYPE: Record<PresetKind, string> = { vehicles: "vehicles", customers: "customers", rentals: "rentals", payments: "transactions" };

/**
 * Recognises export files from other rental software among the sheets (several files at once are fine), prepares them
 * (links, statuses, payments, mileage) and returns their column reading. Sheets nothing recognises come back untouched.
 */
export function prepareImport(input: ParsedSheet[], options: { software?: string | null; distanceUnit?: "km" | "mi"; currency?: string | null } = {}): PreparedImport {
  const sheets = input.map((sheet) => ({ ...sheet, headers: [...sheet.headers], rows: sheet.rows.map((row) => ({ ...row })), sampleRows: sheet.sampleRows }));
  const chosen = softwareById(options.software)?.preset ? (options.software as SoftwareId) : null;
  const prepared: Prepared[] = [];
  const pending: ParsedSheet[] = [];
  for (const sheet of sheets) {
    const preset = detectPreset(sheet, chosen);
    if (!preset) {
      pending.push(sheet);
      continue;
    }
    prepared.push({ sheet, preset, mapping: mapColumns(sheet.headers, rulesFor(preset.kind, preset)), match: { sheetName: sheet.sheetName, software: preset.software, kind: preset.kind, generic: false } });
  }
  // Files beside a recognised export (a payments list, a plain customer list) are read the same way.
  const dominant = chosen || prepared[0]?.match.software || null;
  if (dominant) {
    for (const sheet of pending) {
      const kind = genericKind(sheet.headers);
      if (!kind) continue;
      prepared.push({ sheet, preset: null, mapping: mapColumns(sheet.headers, rulesFor(kind)), match: { sheetName: sheet.sheetName, software: dominant, kind, generic: true } });
    }
  }
  const notes = new Set<string>();
  const of = (kind: PresetKind) => prepared.filter((item) => item.match.kind === kind);
  for (const rental of of("rentals")) {
    for (const customers of of("customers")) linkCustomers(rental, customers, notes);
    for (const vehicles of of("vehicles")) linkVehicles(rental, vehicles, notes);
    addReturned(rental);
  }
  for (const payments of of("payments")) preparePayments(payments, of("rentals"), notes);
  if (options.distanceUnit) for (const item of prepared) convertMileage(item, options.distanceUnit, notes);

  // Amounts in another currency are kept as written (no exchange rate is guessed).
  const business = String(options.currency || "").toUpperCase();
  for (const item of prepared) {
    const column = item.sheet.headers.find((header) => /^(currency|currency code)$/.test(headingKey(header)));
    if (!column || !business) continue;
    const others = [...new Set(item.sheet.rows.map((row) => cleanString(row[column]).toUpperCase()).filter((code) => /^[A-Z]{3}$/.test(code) && code !== business))];
    if (others.length) notes.add(`Amounts in “${item.sheet.sheetName}” are in ${others.join(", ")} and are kept as written; your business uses ${business}.`);
  }

  const raw: RawPresetSheet[] = [];
  const unplaced = new Map<string, string[]>();
  for (const item of prepared) {
    const software = SOFTWARE_BY_ID.get(item.match.software);
    raw.push({
      sheet_name: item.sheet.sheetName,
      primary_data_type: DATA_TYPE[item.match.kind],
      confidence: 0.95,
      // Columns set aside on purpose (an ID the linked name replaced) stay set aside.
      column_mappings: [...item.mapping].map(([source_column, routehq_field]) => ({ source_column, routehq_field, confidence: routehq_field === "__ignore__" ? 1 : 0.95 })),
      date_order_hint: software?.dateOrder,
      preset: software?.name
    });
    const left = item.sheet.headers.filter((header) => !item.mapping.has(header));
    if (left.length) unplaced.set(item.sheet.sheetName, left);
  }
  return { sheets, matches: prepared.map((item) => item.match), raw, unplaced, notes: [...notes] };
}

/** "Booqable (orders, customers)": what was recognised, for the owner and the assistant. */
export function describeMatches(matches: PresetMatch[]) {
  const bySoftware = new Map<string, Set<string>>();
  for (const match of matches) {
    const name = SOFTWARE_BY_ID.get(match.software)?.name || match.software;
    bySoftware.set(name, new Set([...(bySoftware.get(name) || []), match.kind === "rentals" ? "bookings" : match.kind]));
  }
  return [...bySoftware].map(([name, kinds]) => `${name} (${[...kinds].join(", ")})`).join("; ");
}
