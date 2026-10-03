import { TRANSACTION_TYPE_OPTIONS } from "@/lib/transaction-options";

/**
 * Changes the assistant can make for the owner. It never makes them on its
 * own: it fills one of these in, the owner sees exactly what will be saved,
 * and only "Confirm" runs it, through the same code the forms use.
 */

export type ActionKind = "add_vehicle" | "add_transaction" | "create_booking_link" | "renew_paperwork";

export type ProposedAction = {
  kind: ActionKind;
  title: string;
  /** What will be saved, in plain words, for the owner to check. */
  rows: Array<{ label: string; value: string }>;
  /** Cleaned-up values; these are what Confirm sends back. */
  args: Record<string, string | number | boolean | null>;
};

export type AssistantRecords = {
  today: string;
  vehicles: Array<{ id: string; name: string; plate: string }>;
  customers: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; code: string; name: string }>;
};

const VEHICLE_TYPES = ["car", "van", "motorcycle", "scooter", "ebike", "atv"] as const;
const PAPERWORK = { tax: "Road tax", porbor: "Compulsory insurance (Por Ror Bor)", insurance: "Insurance", service: "Service", oil: "Oil change" } as const;
const PERIODS = { daily: "day", weekly: "week", monthly: "month" } as const;

/** The function list given to the model. */
export const ASSISTANT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "add_vehicle",
      description: "Add a new vehicle to the fleet. Needs at least make, model and registration plate.",
      parameters: {
        type: "object",
        properties: {
          vehicleType: { type: "string", enum: [...VEHICLE_TYPES], description: "car unless the owner says otherwise" },
          make: { type: "string" },
          model: { type: "string" },
          year: { type: "integer" },
          registrationNumber: { type: "string", description: "License plate exactly as given" },
          color: { type: "string" },
          mileage: { type: "number" },
          dailyRate: { type: "number" },
          weeklyRate: { type: "number" },
          monthlyRate: { type: "number" },
          purchasePrice: { type: "number" }
        },
        required: ["make", "model", "registrationNumber"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "add_transaction",
      description: "Record money received or a cost against a vehicle (repair, fuel, insurance, rental income...).",
      parameters: {
        type: "object",
        properties: {
          vehicleId: { type: "string", description: "id of the vehicle from the records" },
          type: { type: "string", enum: TRANSACTION_TYPE_OPTIONS.map((option) => option.value) },
          amount: { type: "number", description: "Positive amount in THB" },
          date: { type: "string", description: "Optional, YYYY-MM-DD. Leave out when not stated; today is used. Never ask for it." },
          notes: { type: "string", description: "What it was for, in the owner's words" },
          supplier: { type: "string" }
        },
        required: ["vehicleId", "type", "amount"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "create_booking_link",
      description: "Create a booking and its link for a customer to fill in their details and sign.",
      parameters: {
        type: "object",
        properties: {
          vehicleId: { type: "string" },
          customerId: { type: "string", description: "Optional. Fill in only if the owner named an existing customer. Never ask for it: without it the customer fills in their own details from the link." },
          startDate: { type: "string", description: "YYYY-MM-DD" },
          endDate: { type: "string", description: "Optional, YYYY-MM-DD. Leave out when no end is mentioned (e.g. 'run monthly'): the rental is then open-ended. Never ask for it." },
          pricingModel: { type: "string", enum: ["daily", "weekly", "monthly"] },
          rentalRate: { type: "number", description: "Price per day, week or month" },
          depositAmount: { type: "number" }
        },
        required: ["vehicleId", "startDate", "pricingModel", "rentalRate"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "renew_paperwork",
      description: "Mark a vehicle's road tax, compulsory insurance, insurance, service or oil change as renewed, with its new expiry or next-due date.",
      parameters: {
        type: "object",
        properties: {
          vehicleId: { type: "string" },
          what: { type: "string", enum: Object.keys(PAPERWORK) },
          newExpiryDate: { type: "string", description: "YYYY-MM-DD. 'Renewed today for 1 year' means one year from today." },
          cost: { type: "number", description: "Total paid for this renewal, if the owner gave a total" },
          notes: { type: "string", description: "Anything else said, e.g. a monthly price" }
        },
        required: ["vehicleId", "what", "newExpiryDate"]
      }
    }
  }
];

const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
const text = (value: unknown, max = 200) => String(value ?? "").trim().slice(0, max);
const amount = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 && number < 100_000_000 ? Math.round(number * 100) / 100 : null;
};
const baht = (value: number) => `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

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
  const vehicle = records.vehicles.find((entry) => entry.id === raw.vehicleId);
  const vehicleLabel = vehicle ? `${vehicle.name} · ${vehicle.plate}` : "";

  if (kind === "add_vehicle") {
    const make = text(raw.make, 60);
    const model = text(raw.model, 60);
    const plate = text(raw.registrationNumber, 20).toUpperCase();
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
      purchasePrice: amount(raw.purchasePrice)
    };
    const rows = [
      { label: "Vehicle", value: [make, model, year].filter(Boolean).join(" ") },
      { label: "Type", value: category.name },
      { label: "Plate", value: plate },
      args.color ? { label: "Colour", value: args.color } : null,
      args.mileage ? { label: "Mileage", value: `${args.mileage.toLocaleString("en-US")} km` } : null,
      args.dailyRate ? { label: "Per day", value: baht(args.dailyRate) } : null,
      args.weeklyRate ? { label: "Per week", value: baht(args.weeklyRate) } : null,
      args.monthlyRate ? { label: "Per month", value: baht(args.monthlyRate) } : null,
      args.purchasePrice ? { label: "Bought for", value: baht(args.purchasePrice) } : null
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
      { label: option.category === "expense" ? "Cost" : "Money in", value: `${option.label} · ${baht(value)}` },
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
      { label: "Price", value: `${baht(rate)} per ${PERIODS[period]}` },
      { label: "Deposit", value: deposit > 0 ? baht(deposit) : "None" }
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
      cost ? { label: "Cost", value: baht(cost) } : null,
      args.notes ? { label: "Note", value: args.notes } : null
    ].filter(Boolean) as ProposedAction["rows"];
    return { ok: true, action: { kind: "renew_paperwork", title: "Mark this as renewed", rows, args } };
  }

  return { ok: false, error: "That isn't something I can do from here yet." };
}
