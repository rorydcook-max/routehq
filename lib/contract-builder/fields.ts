/**
 * The free contract builder (Rory, 28 Oct 2026): what an operator can type in on /resources/rental-agreement so their
 * download is their own agreement, in English and their country's language. Every field is optional; anything left
 * empty prints as a blank line to fill in by hand. The renter's details are never asked: they're blank lines for
 * handover (or filled automatically when the operator uses Lokalfleet).
 */

/** The free resource that is the contract builder (its page shows the extra fields; its links build the file). */
export const CONTRACT_BUILDER_SLUG = "rental-agreement";

/**
 * Every page that is the contract builder, with the country it starts on: the main page (visitor's country) and the
 * country and city versions written for search ("free rental agreement for Thailand / Bali / Phuket"). Each has its
 * own content/resources/<locale>/<slug>.md; they're `listed: false`, so only the main one shows in the list.
 */
export const CONTRACT_BUILDER_PAGES: Readonly<Record<string, string | null>> = {
  "rental-agreement": null,
  "rental-agreement-thailand": "TH",
  "rental-agreement-phuket": "TH",
  "rental-agreement-koh-samui": "TH",
  "rental-agreement-chiang-mai": "TH",
  "rental-agreement-indonesia": "ID",
  "rental-agreement-bali": "ID",
  "rental-agreement-vietnam": "VN",
  "rental-agreement-malaysia": "MY",
  "rental-agreement-philippines": "PH",
  "rental-agreement-laos": "LA",
  "rental-agreement-cambodia": "KH"
};

export const isContractBuilder = (slug: string) => Object.prototype.hasOwnProperty.call(CONTRACT_BUILDER_PAGES, slug);

export const CONTRACT_COUNTRIES =["TH", "ID", "VN", "MY", "PH", "LA", "KH", "XX"] as const;
export type ContractCountry = (typeof CONTRACT_COUNTRIES)[number];

/** The lead form's country codes (lowercase) to the agreement's country version; anything else gets the general one. */
export function contractCountryFor(leadCountry: string | null | undefined): ContractCountry {
  const code = String(leadCountry || "").toUpperCase();
  return (CONTRACT_COUNTRIES as readonly string[]).includes(code) && code !== "XX" ? (code as ContractCountry) : "XX";
}

/** Which language the agreement is written in alongside English, per country version. */
export const CONTRACT_LANGUAGE: Record<ContractCountry, string> = { TH: "th", ID: "id", VN: "vi", MY: "ms", PH: "fil", LA: "lo", KH: "km", XX: "en" };
/** The currency the form suggests (operators can change it: plenty of shops price in USD or THB elsewhere). */
export const CONTRACT_CURRENCY: Record<ContractCountry, string> = { TH: "THB", ID: "IDR", VN: "VND", MY: "MYR", PH: "PHP", LA: "LAK", KH: "USD", XX: "USD" };
export const CURRENCIES = ["THB", "IDR", "VND", "MYR", "PHP", "LAK", "KHR", "USD", "EUR", "AUD", "SGD"] as const;

type Kind = "text" | "number" | "select" | "textarea";
export type ContractField = { key: string; kind: Kind; max?: number; options?: readonly string[]; group: "business" | "vehicle" | "prices" | "rules" };

export const CONTRACT_FIELDS: readonly ContractField[] = [
  { key: "business_name", kind: "text", max: 120, group: "business" },
  { key: "business_reg_no", kind: "text", max: 60, group: "business" },
  { key: "business_address", kind: "textarea", max: 240, group: "business" },
  { key: "business_phone", kind: "text", max: 80, group: "business" },
  { key: "business_email", kind: "text", max: 120, group: "business" },
  { key: "vehicle_type", kind: "select", options: ["", "car", "motorbike"], group: "vehicle" },
  { key: "vehicle_make_model", kind: "text", max: 80, group: "vehicle" },
  { key: "vehicle_year", kind: "text", max: 10, group: "vehicle" },
  { key: "vehicle_plate", kind: "text", max: 30, group: "vehicle" },
  { key: "vehicle_colour", kind: "text", max: 30, group: "vehicle" },
  { key: "area_of_use", kind: "text", max: 160, group: "vehicle" },
  { key: "currency", kind: "select", options: CURRENCIES, group: "prices" },
  { key: "rate", kind: "number", group: "prices" },
  { key: "rate_period", kind: "select", options: ["day", "week", "month"], group: "prices" },
  { key: "deposit", kind: "number", group: "prices" },
  { key: "deposit_return_days", kind: "number", group: "prices" },
  { key: "delivery_fee", kind: "number", group: "prices" },
  { key: "payment_methods", kind: "text", max: 120, group: "prices" },
  { key: "insurance_level", kind: "select", options: ["compulsory", "third_party", "comprehensive"], group: "prices" },
  { key: "insurance_excess", kind: "number", group: "prices" },
  { key: "fuel_policy", kind: "select", options: ["same", "full"], group: "rules" },
  { key: "fuel_service_fee", kind: "number", group: "rules" },
  { key: "mileage_limit", kind: "number", group: "rules" },
  { key: "mileage_period", kind: "select", options: ["day", "month"], group: "rules" },
  { key: "excess_km_fee", kind: "number", group: "rules" },
  { key: "late_grace_minutes", kind: "number", group: "rules" },
  { key: "late_hour_fee", kind: "number", group: "rules" },
  { key: "late_full_day_hours", kind: "number", group: "rules" },
  { key: "cancel_free_hours", kind: "number", group: "rules" },
  { key: "cancel_fee_percent", kind: "number", group: "rules" },
  { key: "no_show_days", kind: "number", group: "rules" },
  { key: "early_return", kind: "select", options: ["none", "prorata"], group: "rules" },
  { key: "early_return_fee", kind: "number", group: "rules" },
  { key: "notice_days", kind: "number", group: "rules" },
  { key: "cleaning_fee", kind: "number", group: "rules" },
  { key: "smoking", kind: "select", options: ["no", "yes"], group: "rules" },
  { key: "smoking_fee", kind: "number", group: "rules" },
  { key: "pets", kind: "select", options: ["no", "fee"], group: "rules" },
  { key: "pet_fee", kind: "number", group: "rules" },
  { key: "loss_of_use_fee", kind: "number", group: "rules" },
  { key: "loss_of_use_max_days", kind: "number", group: "rules" },
  { key: "emergency_repair_limit", kind: "number", group: "rules" },
  { key: "fine_admin_fee", kind: "number", group: "rules" },
  { key: "special_terms", kind: "textarea", max: 1200, group: "rules" }
];

/** Sensible defaults for the rules a shop rarely thinks about, so a skipped field still reads well. */
export const CONTRACT_DEFAULTS: Record<string, string> = {
  rate_period: "day",
  insurance_level: "compulsory",
  fuel_policy: "same",
  mileage_period: "day",
  late_grace_minutes: "30",
  late_full_day_hours: "3",
  no_show_days: "1",
  early_return: "none",
  notice_days: "30",
  smoking: "no",
  pets: "no",
  loss_of_use_max_days: "14"
};

export type ContractValues = Record<string, string>;

const clean = (value: unknown, max: number) =>
  String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[{}<>]/g, "")
    .trim()
    .slice(0, max);

/** The builder's fields from a form (prefixed "c_"), cleaned: numbers stay numbers, choices stay in their list. */
export function parseContractForm(formData: FormData): ContractValues {
  const values: ContractValues = {};
  for (const field of CONTRACT_FIELDS) {
    const raw = formData.get(`c_${field.key}`);
    if (field.kind === "number") {
      const text = clean(raw, 20).replace(/[,\s]/g, "");
      const number = Number(text);
      if (text && Number.isFinite(number) && number >= 0 && number < 1e12) values[field.key] = String(Math.round(number * 100) / 100);
    } else if (field.kind === "select") {
      const choice = clean(raw, 20);
      if (choice && field.options?.includes(choice)) values[field.key] = choice;
    } else {
      const text = clean(raw, field.max || 120);
      if (text) values[field.key] = text;
    }
  }
  return values;
}

/** Whether the operator typed anything worth personalising with (otherwise they get the blank template). */
export function hasContractDetails(values: ContractValues) {
  return Object.keys(values).some((key) => key !== "currency");
}
