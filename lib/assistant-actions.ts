import { TRANSACTION_TYPE_OPTIONS } from "@/lib/transaction-options";
import { businessDistanceUnit } from "@/lib/business-units";

/**
 * Changes the assistant can make for the owner. It never makes them on its
 * own: it fills one of these in, the owner sees exactly what will be saved,
 * and only "Confirm" runs it, through the same code the forms use.
 */

export type ActionKind = "add_vehicle" | "add_transaction" | "create_booking_link" | "renew_paperwork" | "record_cost" | "record_payment" | "create_booking";

/** A value on the card the person can change before saving (the newer cards: cost, payment, booking). */
export type ProposalField = {
  /** The args key it edits. */
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "tel";
  value: string;
  options?: Array<{ value: string; label: string }>;
  /** May be left empty (an open-ended booking's end date, a note). */
  optional?: boolean;
};

export type ProposedAction = {
  kind: ActionKind;
  title: string;
  /** What will be saved, in plain words, for the owner to check. */
  rows: Array<{ label: string; value: string }>;
  /** Cleaned-up values; these are what Confirm sends back. */
  args: Record<string, string | number | boolean | null>;
  /** Editable values, shown as inputs on the card; what's typed there replaces the matching args on Confirm. */
  fields?: ProposalField[];
  /** An escape hatch under the card ("Open the full form"), with the file handed over where it can be. */
  fullForm?: { label: string; href: string; receiptPath?: string };
};

/** A payment a customer still owes, for recording money in from the chat. */
export type OpenPayment = { id: string; label: string; amount: number; customer: string; rentalId: string; dueDate: string };

export type AssistantRecords = {
  today: string;
  /** The business's money (THB, MYR, IDR...): amounts on the card are shown in it. */
  currency?: string;
  vehicles: Array<{ id: string; name: string; plate: string }>;
  customers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; code: string; name: string }>;
  /** Payments still due (record_payment only). */
  payments?: OpenPayment[];
};

/** The running costs a cost card offers, in the money types' own names. */
export const COST_TYPES = ["fuel", "repair", "servicing", "maintenance", "insurance", "tax", "fine", "accessories", "finance", "other"] as const;
export const PAYMENT_METHODS = { cash: "Cash", bank_transfer: "Bank transfer", promptpay: "PromptPay", card: "Card" } as const;

const VEHICLE_TYPES = ["car", "van", "motorcycle", "scooter", "ebike", "atv"] as const;
// Inspection too (Malaysia's PUSPAKOM, Indonesia's KIR...): the vehicle page keeps a date for it outside Thailand.
const PAPERWORK = { tax: "Road tax", porbor: "Compulsory insurance (Por Ror Bor)", insurance: "Insurance", inspection: "Vehicle inspection", service: "Service", oil: "Oil change" } as const;
const PERIODS = { daily: "day", weekly: "week", monthly: "month" } as const;

const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
const text = (value: unknown, max = 200) => String(value ?? "").trim().slice(0, max);
const amount = (value: unknown) => {
  const number = Number(value);
  // The cap allows rupiah and dong: a car bought for 300,000,000 IDR is an ordinary purchase price there.
  return Number.isFinite(number) && number > 0 && number < 100_000_000_000 ? Math.round(number * 100) / 100 : null;
};
/** An amount in the business's money: ฿12,500, RM 1,200... (not always baht: Malaysian and Indonesian businesses too). */
const inMoney = (currency: string) => (value: number) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
};

function plainDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

type Checked = { ok: true; action: ProposedAction } | { ok: false; error: string };

/**
 * Checks what the model (or a Confirm click) asked for against the real
 * records and returns a cleaned proposal. Run twice: once to show the owner,
 * and again on Confirm, so nothing unchecked is ever saved.
 */
export function checkAction(kind: string, raw: Record<string, unknown>, records: AssistantRecords): Checked {
  const money = inMoney(records.currency || "THB");
  const vehicle = records.vehicles.find((entry) => entry.id === raw.vehicleId);
  const vehicleLabel = vehicle ? `${vehicle.name} · ${vehicle.plate}` : "";

  if (kind === "add_vehicle") {
    const make = text(raw.make, 60);
    let model = text(raw.model, 60);
    // A model may arrive with the year in it ("Ranger Wildtrak 2018"): the year goes in its own field.
    const yearInModel = model.match(/\b(19[7-9]\d|20\d\d)\b/);
    if (yearInModel && !raw.year) {
      raw = { ...raw, year: Number(yearInModel[1]) };
      model = model.replace(yearInModel[0], "").replace(/\s{2,}/g, " ").trim();
    }
    // "UNKNOWN", "N/A", "TBD" and the like are not a plate: ask for it rather than saving a placeholder.
    const plateGiven = text(raw.registrationNumber, 20).toUpperCase();
    const plate = /^(UNKNOWN|N\/?A|NONE|TBD|TBA|NOT GIVEN|NO PLATE|-+|\?+|X+)$/.test(plateGiven) ? "" : plateGiven;
    if (!make || !model) return { ok: false, error: "I need the make and model to add a vehicle." };
    if (!plate) return { ok: false, error: "What's the license plate? I need it to add the vehicle." };
    if (records.vehicles.some((entry) => entry.plate.replace(/\s+/g, "").toUpperCase() === plate.replace(/\s+/g, ""))) {
      return { ok: false, error: `There's already a vehicle with the plate ${plate}.` };
    }
    const type = VEHICLE_TYPES.includes(raw.vehicleType as any) ? String(raw.vehicleType) : "car";
    const category = records.categories.find((entry) => entry.code === type) || records.categories.find((entry) => entry.code === "car");
    if (!category) return { ok: false, error: "I couldn't find a vehicle type to file it under." };
    const year = Number(raw.year) >= 1970 && Number(raw.year) <= Number(records.today.slice(0, 4)) + 1 ? Math.round(Number(raw.year)) : null;
    const args = {
      categoryId: category.id,
      make,
      model,
      registrationNumber: plate,
      year,
      color: text(raw.color, 30) || null,
      mileage: amount(raw.mileage),
      dailyRate: amount(raw.dailyRate),
      weeklyRate: amount(raw.weeklyRate),
      monthlyRate: amount(raw.monthlyRate),
      purchasePrice: amount(raw.purchasePrice),
      currentValue: amount(raw.currentValue)
    };
    const rows = [
      { label: "Vehicle", value: [make, model, year].filter(Boolean).join(" ") },
      { label: "Type", value: category.name },
      { label: "Plate", value: plate },
      args.color ? { label: "Colour", value: args.color } : null,
      args.mileage ? { label: "Mileage", value: `${args.mileage.toLocaleString("en-US")} ${businessDistanceUnit()}` } : null,
      args.dailyRate ? { label: "Per day", value: money(args.dailyRate) } : null,
      args.weeklyRate ? { label: "Per week", value: money(args.weeklyRate) } : null,
      args.monthlyRate ? { label: "Per month", value: money(args.monthlyRate) } : null,
      args.purchasePrice ? { label: "Bought for", value: money(args.purchasePrice) } : null,
      args.currentValue ? { label: "Worth now", value: money(args.currentValue) } : null
    ].filter(Boolean) as ProposedAction["rows"];
    return { ok: true, action: { kind: "add_vehicle", title: "Add this vehicle", rows, args } };
  }

  if (kind === "add_transaction") {
    if (!vehicle) return { ok: false, error: "Which vehicle is this for? I couldn't match it to one in your fleet." };
    const option = TRANSACTION_TYPE_OPTIONS.find((entry) => entry.value === raw.type);
    const value = amount(raw.amount);
    if (!option) return { ok: false, error: "I couldn't tell what kind of payment or cost this is." };
    if (!value) return { ok: false, error: "How much was it? I need an amount." };
    const date = isDate(raw.date) ? raw.date : records.today;
    if (date > records.today) return { ok: false, error: "That date is in the future. Transactions are recorded once the money has moved." };
    const args = { vehicleId: vehicle.id, type: option.value, amount: value, date, notes: text(raw.notes, 300) || null, supplier: text(raw.supplier, 80) || null };
    const rows = [
      { label: option.category === "expense" ? "Cost" : "Money in", value: `${option.label} · ${money(value)}` },
      { label: "Vehicle", value: vehicleLabel },
      { label: "Date", value: plainDate(date) },
      args.supplier ? { label: "Paid to", value: args.supplier } : null,
      args.notes ? { label: "Note", value: args.notes } : null
    ].filter(Boolean) as ProposedAction["rows"];
    return { ok: true, action: { kind: "add_transaction", title: option.category === "expense" ? "Record this cost" : "Record this payment", rows, args } };
  }

  if (kind === "create_booking_link") {
    if (!vehicle) return { ok: false, error: "Which vehicle is the booking for? I couldn't match it to one in your fleet." };
    if (!isDate(raw.startDate)) return { ok: false, error: "When does the booking start?" };
    const period = (raw.pricingModel as keyof typeof PERIODS) in PERIODS ? (raw.pricingModel as keyof typeof PERIODS) : null;
    const rate = amount(raw.rentalRate);
    if (!period || !rate) return { ok: false, error: "What's the price, and is it per day, week or month?" };
    const endDate = isDate(raw.endDate) ? raw.endDate : null;
    if (endDate && endDate <= raw.startDate) return { ok: false, error: "The end date needs to be after the start date." };
    const customer = records.customers.find((entry) => entry.id === raw.customerId) || null;
    const deposit = amount(raw.depositAmount) || 0;
    const args = { vehicleId: vehicle.id, customerId: customer?.id || null, startDate: raw.startDate, endDate, pricingModel: period, rentalRate: rate, depositAmount: deposit };
    const rows = [
      { label: "Vehicle", value: vehicleLabel },
      { label: "Customer", value: customer ? customer.name : "They fill in their details from the link" },
      { label: "From", value: plainDate(raw.startDate) },
      { label: "Until", value: endDate ? plainDate(endDate) : `Open-ended, billed each ${PERIODS[period]}` },
      { label: "Price", value: `${money(rate)} per ${PERIODS[period]}` },
      { label: "Deposit", value: deposit > 0 ? money(deposit) : "None" }
    ];
    return { ok: true, action: { kind: "create_booking_link", title: "Create this booking link", rows, args } };
  }

  if (kind === "renew_paperwork") {
    if (!vehicle) return { ok: false, error: "Which vehicle is this for? I couldn't match it to one in your fleet." };
    const what = String(raw.what) as keyof typeof PAPERWORK;
    if (!(what in PAPERWORK)) return { ok: false, error: "Is this road tax, compulsory insurance, insurance, a service or an oil change?" };
    if (!isDate(raw.newExpiryDate)) return { ok: false, error: "What's the new expiry date?" };
    if (raw.newExpiryDate <= records.today) return { ok: false, error: "The new expiry date needs to be in the future." };
    const cost = amount(raw.cost);
    const args = { vehicleId: vehicle.id, what, newExpiryDate: raw.newExpiryDate, cost, notes: text(raw.notes, 300) || null };
    const rows = [
      { label: "Vehicle", value: vehicleLabel },
      { label: "Renewed", value: PAPERWORK[what] },
      { label: what === "service" || what === "oil" ? "Next due" : "Now valid until", value: plainDate(raw.newExpiryDate) },
      cost ? { label: "Cost", value: money(cost) } : null,
      args.notes ? { label: "Note", value: args.notes } : null
    ].filter(Boolean) as ProposedAction["rows"];
    return { ok: true, action: { kind: "renew_paperwork", title: "Mark this as renewed", rows, args } };
  }

  const vehicleOptions = records.vehicles.map((entry) => ({ value: entry.id, label: `${entry.name} · ${entry.plate}` }));

  if (kind === "record_cost") {
    const value = amount(raw.amount);
    if (!value) return { ok: false, error: "How much was it? I need an amount." };
    const type = COST_TYPES.includes(raw.type as never) ? String(raw.type) : "other";
    // A cost can belong to the business rather than one vehicle (rent, a phone bill).
    const vehicleId = raw.vehicleId === "none" ? "none" : vehicle ? vehicle.id : "";
    // Left for them to pick on the card when the receipt doesn't say; needed by Confirm.
    if (!vehicleId && raw.strict === true) return { ok: false, error: "Which vehicle is this for? Pick one, or No vehicle for a business cost." };
    const date = isDate(raw.date) ? raw.date : records.today;
    if (date > records.today) return { ok: false, error: "That date is in the future. Costs are recorded once the money has moved." };
    const receiptPath = typeof raw.receiptPath === "string" && raw.receiptPath && !raw.receiptPath.includes("..") ? raw.receiptPath.slice(0, 400) : null;
    const mileage = amount(raw.mileage);
    const args = { amount: value, date, type, vehicleId, supplier: text(raw.supplier, 80) || null, notes: text(raw.notes, 300) || null, mileage, receiptPath };
    const fields: ProposalField[] = [
      { key: "amount", label: "Amount", type: "number", value: String(value) },
      { key: "date", label: "Date", type: "date", value: date },
      { key: "supplier", label: "Paid to", type: "text", value: args.supplier || "", optional: true },
      { key: "vehicleId", label: "Vehicle", type: "select", value: vehicleId, options: [...vehicleOptions, { value: "none", label: "No vehicle (business cost)" }] },
      { key: "type", label: "What for", type: "select", value: type, options: COST_TYPES.map((code) => ({ value: code, label: TRANSACTION_TYPE_OPTIONS.find((option) => option.value === code)?.label || code })) },
      { key: "notes", label: "Note", type: "text", value: args.notes || "", optional: true }
    ];
    return { ok: true, action: { kind: "record_cost", title: receiptPath ? "Record this receipt" : "Record this cost", rows: [], args, fields } };
  }

  if (kind === "record_payment") {
    const payments = records.payments || [];
    const payment = payments.find((entry) => entry.id === raw.paymentId);
    if (!payment) return { ok: false, error: "I couldn't find that payment. Which customer paid?" };
    const value = amount(raw.amount) || payment.amount;
    const date = isDate(raw.date) ? raw.date : records.today;
    if (date > records.today) return { ok: false, error: "That date is in the future. Payments are recorded once the money has moved." };
    const method = (raw.method as string) in PAYMENT_METHODS ? String(raw.method) : "cash";
    const args = { paymentId: payment.id, rentalId: payment.rentalId, amount: value, date, method, note: text(raw.note, 300) || null };
    // The same customer's other payments can be picked instead (paying next month's rent early, the deposit).
    const theirs = payments.filter((entry) => entry.customer === payment.customer);
    const fields: ProposalField[] = [
      { key: "paymentId", label: "For", type: "select", value: payment.id, options: theirs.map((entry) => ({ value: entry.id, label: entry.label })) },
      { key: "amount", label: "Amount", type: "number", value: String(value) },
      { key: "date", label: "Paid on", type: "date", value: date },
      { key: "method", label: "How", type: "select", value: method, options: Object.entries(PAYMENT_METHODS).map(([code, label]) => ({ value: code, label })) },
      { key: "note", label: "Note", type: "text", value: args.note || "", optional: true }
    ];
    return { ok: true, action: { kind: "record_payment", title: "Record this payment", rows: [{ label: "Customer", value: payment.customer }], args, fields } };
  }

  if (kind === "create_booking") {
    if (!isDate(raw.startDate)) return { ok: false, error: "When does the booking start?" };
    const period = (raw.pricingModel as keyof typeof PERIODS) in PERIODS ? (raw.pricingModel as keyof typeof PERIODS) : "daily";
    const rate = amount(raw.rentalRate);
    const endDate = isDate(raw.endDate) ? raw.endDate : null;
    if (endDate && endDate <= raw.startDate) return { ok: false, error: "The end date needs to be after the start date." };
    const typedName = text(raw.customerName, 80);
    // An existing customer by id, or by exactly the name typed.
    const customer = records.customers.find((entry) => entry.id === raw.customerId) || (typedName ? records.customers.find((entry) => entry.name.toLowerCase() === typedName.toLowerCase()) : null) || null;
    const customerName = typedName || customer?.name || "";
    // A name typed over the matched customer is someone else.
    const customerId = customer && (!customerName || customerName.toLowerCase() === customer.name.toLowerCase()) ? customer.id : null;
    const deposit = amount(raw.depositAmount) || 0;
    const args = {
      vehicleId: vehicle?.id || "",
      customerId,
      customerName: customerName || null,
      customerPhone: text(raw.customerPhone, 30) || null,
      startDate: raw.startDate,
      endDate,
      pricingModel: period,
      rentalRate: rate,
      depositAmount: deposit
    };
    const fields: ProposalField[] = [
      { key: "vehicleId", label: "Vehicle", type: "select", value: args.vehicleId, options: vehicleOptions },
      { key: "customerName", label: "Customer", type: "text", value: customerName, optional: true },
      { key: "customerPhone", label: "Phone", type: "tel", value: args.customerPhone || "", optional: true },
      { key: "startDate", label: "From", type: "date", value: raw.startDate },
      { key: "endDate", label: "Until", type: "date", value: endDate || "", optional: true },
      { key: "pricingModel", label: "Billed", type: "select", value: period, options: [{ value: "daily", label: "Per day" }, { value: "weekly", label: "Per week" }, { value: "monthly", label: "Per month" }] },
      { key: "rentalRate", label: "Price", type: "number", value: rate ? String(rate) : "" },
      { key: "depositAmount", label: "Deposit", type: "number", value: deposit ? String(deposit) : "", optional: true }
    ];
    // Checked again on Confirm, after any edits: these are what must be there by then.
    if (!vehicle && raw.strict === true) return { ok: false, error: "Which vehicle is the booking for?" };
    if (!rate && raw.strict === true) return { ok: false, error: "What's the price?" };
    if (customerName && !customerId && !args.customerPhone && raw.strict === true) return { ok: false, error: "Add the customer's phone number, or clear the name to let them fill in their own details from the link." };
    return { ok: true, action: { kind: "create_booking", title: "New booking", rows: [], args, fields } };
  }

  return { ok: false, error: "That isn't something I can do from here yet." };
}
