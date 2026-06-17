import { getTravelPolicySettings, type IslandTravelPolicy } from "@/lib/travel-policy";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripEmpty(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatAmount(value: unknown) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numberValue(value));
}

export function formatContractDate(value: string | null | undefined, locale = "en") {
  if (!value) {
    return "Open ended";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(locale === "th" ? "th-TH-u-ca-buddhist" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatContractTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: fullName, surname: "" };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    surname: parts[parts.length - 1]
  };
}

function includedItemsHtml(items: unknown[]) {
  if (!items.length) {
    return "<li>None specified</li>";
  }
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function optionalText(value: unknown, fallback = "Not provided") {
  return stripEmpty(value, fallback);
}

export function renderBilingualSection(english: string, thai: string): string {
  return `<div class="bilingual-section">
  <div class="lang-en">${english}</div>
  <div class="lang-th">${thai}</div>
</div>`;
}

export interface ContractVariables {
  business_name: string;
  business_logo_url: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  owner_line_id: string;
  owner_whatsapp: string;
  business_address: string;
  home_territory: string;
  home_territory_type: "island" | "mainland";
  island_travel_policy: IslandTravelPolicy;
  jurisdiction: string;
  renter_first_name: string;
  renter_surname: string;
  renter_full_name: string;
  renter_passport_number: string;
  renter_licence_number: string;
  renter_licence_country: string;
  renter_licence_expiry: string;
  renter_phone: string;
  renter_email: string;
  renter_address: string;
  renter_nationality: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_registration: string;
  vehicle_colour: string;
  vehicle_fuel_type: string;
  rental_start_date: string;
  rental_start_time: string;
  rental_end_date: string;
  rental_end_time: string;
  rental_rate: string;
  billing_period: string;
  deposit_amount: string;
  secondary_deposit_amount: string;
  mileage_limit: string;
  fuel_charge_per_increment: string;
  late_fee_percentage: string;
  cleaning_fee_minimum: string;
  smoking_fee_maximum: string;
  emergency_repair_limit: string;
  deposit_return_days: string;
  insurance_type: string;
  insurance_excess: string;
  contract_date: string;
  included_items: string;
  special_conditions: string;
  delivery_odometer: string;
  delivery_fuel_level: string;
  delivery_fuel_image_url: string;
  delivery_date: string;
  delivery_location: string;
  delivery_damage_report: string;
  island_travel_clause_enabled: boolean;
  secondary_deposit_enabled: boolean;
  geofence_monitoring_enabled: boolean;
  is_rolling_monthly: boolean;
  [key: string]: string | boolean;
}

export const contractVariableKeys = [
  "business_name",
  "business_logo_url",
  "owner_name",
  "owner_phone",
  "owner_email",
  "owner_line_id",
  "owner_whatsapp",
  "business_address",
  "home_territory",
  "home_territory_type",
  "island_travel_policy",
  "jurisdiction",
  "renter_first_name",
  "renter_surname",
  "renter_full_name",
  "renter_passport_number",
  "renter_licence_number",
  "renter_licence_country",
  "renter_licence_expiry",
  "renter_phone",
  "renter_email",
  "renter_address",
  "renter_nationality",
  "vehicle_make",
  "vehicle_model",
  "vehicle_year",
  "vehicle_registration",
  "vehicle_colour",
  "vehicle_fuel_type",
  "rental_start_date",
  "rental_start_time",
  "rental_end_date",
  "rental_end_time",
  "rental_rate",
  "billing_period",
  "deposit_amount",
  "secondary_deposit_amount",
  "mileage_limit",
  "fuel_charge_per_increment",
  "late_fee_percentage",
  "cleaning_fee_minimum",
  "smoking_fee_maximum",
  "emergency_repair_limit",
  "deposit_return_days",
  "insurance_type",
  "insurance_excess",
  "contract_date",
  "included_items",
  "special_conditions",
  "delivery_odometer",
  "delivery_fuel_level",
  "delivery_fuel_image_url",
  "delivery_date",
  "delivery_location",
  "delivery_damage_report",
  "customer_name",
  "customer_passport",
  "customer_nationality",
  "customer_phone",
  "customer_address",
  "vehicle_plate",
  "rental_duration",
  "delivery_method",
  "delivery_datetime"
] as const;

export const defaultRentalContractTemplate = `
  <h2>Vehicle Rental Agreement</h2>
  {{#if business_logo_url}}<img src="{{business_logo_url}}" alt="{{business_name}} logo" style="max-width: 200px; max-height: 80px; object-fit: contain;" />{{else}}<h1>{{business_name}}</h1>{{/if}}
  <p>This agreement is made on {{contract_date}} between <strong>{{business_name}}</strong> and <strong>{{renter_full_name}}</strong>.</p>
  <p>Vehicle: {{vehicle_year}} {{vehicle_make}} {{vehicle_model}}, registration {{vehicle_registration}}.</p>
  <p>Rental: {{rental_start_date}} to {{rental_end_date}}, {{rental_rate}} per {{billing_period}}. Deposit: {{deposit_amount}}.</p>
  <p>Governing law: {{jurisdiction}}.</p>
`;

export function renderContractTemplate(template: string, variables: Record<string, unknown>) {
  const rawHtmlKeys = new Set(["included_items", "special_conditions", "delivery_damage_report"]);

  let rendered = template.replace(/<!--\s*CONDITIONAL:\s*([a-zA-Z0-9_]+)\s*-->([\s\S]*?)<!--\s*END CONDITIONAL\s*-->/g, (_match, key, content) => {
    return variables[key] ? content : "";
  });

  rendered = rendered.replace(/\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, truthyContent, fallbackContent) => {
    return variables[key] ? truthyContent : fallbackContent;
  });

  rendered = rendered.replace(/\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, content) => {
    return variables[key] ? content : "";
  });

  return rendered.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = variables[key] ?? "";
    return rawHtmlKeys.has(key) ? String(value) : escapeHtml(value);
  });
}

export function renderContract(template: string, variables: Record<string, unknown>) {
  return renderContractTemplate(template, variables);
}

export function buildContractVariables({
  organization,
  customer,
  vehicle,
  rental,
  bookingLink
}: {
  organization: any;
  customer: any;
  vehicle: any;
  rental: any;
  bookingLink: any;
}): ContractVariables {
  const settings = getTravelPolicySettings(organization?.settings);
  const bookingData = (bookingLink?.booking_data || {}) as Record<string, any>;
  const includedItems = Array.isArray(bookingLink?.included_items) ? bookingLink.included_items : [];
  const fullName = optionalText(customer?.full_name, "Customer");
  const name = splitName(fullName);
  const locale = customer?.preferred_locale || bookingLink?.locale || organization?.default_locale || "en";
  const deliveryDateTime = bookingData.delivery_datetime || bookingData.deliveryDateTime || null;
  const isRollingMonthly = Boolean(rental?.is_indefinite || rental?.pricing_model === "subscription" || bookingData.open_ended);
  const islandClauseEnabled = settings.home_territory_type === "island" || settings.island_travel_policy !== "notice_only";
  const secondaryDepositEnabled = settings.island_travel_policy === "deposit_required";
  const vehicleSpecs = typeof vehicle?.specifications === "object" && vehicle.specifications ? vehicle.specifications : {};
  const fuelType = vehicle?.fuel_type || vehicleSpecs.fuel_type || vehicleSpecs.fuelType || "";
  const deliveryLocation = bookingData.delivery_location || rental?.delivery_location || bookingData.collection_address || "To be confirmed";
  const deliveryMethod =
    bookingData.delivery_method === "collection" || bookingData.delivery_method === "collect"
      ? "Customer collection"
      : bookingData.delivery_method === "tbd"
        ? "To be confirmed"
        : "Delivery";

  const variables: ContractVariables = {
    business_name: optionalText(organization?.name, "Rental operator"),
    business_logo_url: stripEmpty(organization?.logo_url || organization?.settings?.logo_url, ""),
    owner_name: optionalText(organization?.settings?.owner_name || organization?.settings?.business_owner_name || organization?.name, "Rental operator"),
    owner_phone: optionalText(organization?.settings?.phone || organization?.settings?.business_phone || settings.owner_whatsapp),
    owner_email: optionalText(organization?.settings?.email || organization?.settings?.business_email),
    owner_line_id: optionalText(settings.owner_line_id, "Not provided"),
    owner_whatsapp: optionalText(settings.owner_whatsapp, "Not provided"),
    business_address: optionalText(organization?.settings?.business_address || organization?.settings?.address || organization?.address),
    home_territory: settings.home_territory,
    home_territory_type: settings.home_territory_type,
    island_travel_policy: settings.island_travel_policy,
    jurisdiction: settings.jurisdiction,
    renter_first_name: name.firstName,
    renter_surname: name.surname,
    renter_full_name: fullName,
    renter_passport_number: optionalText(customer?.passport_number),
    renter_licence_number: optionalText(customer?.driver_license_number || customer?.driving_licence_number),
    renter_licence_country: optionalText(customer?.driver_license_country),
    renter_licence_expiry: customer?.driver_license_expiry ? formatContractDate(customer.driver_license_expiry, locale) : "Not provided",
    renter_phone: optionalText(customer?.phone),
    renter_email: optionalText(customer?.email),
    renter_address: optionalText(customer?.address),
    renter_nationality: optionalText(customer?.nationality),
    vehicle_make: stripEmpty(vehicle?.make),
    vehicle_model: [vehicle?.model, vehicle?.trim].filter(Boolean).join(" "),
    vehicle_year: stripEmpty(vehicle?.year),
    vehicle_registration: stripEmpty(vehicle?.registration_number),
    vehicle_colour: stripEmpty(vehicle?.color),
    vehicle_fuel_type: optionalText(fuelType, "As specified by manufacturer"),
    rental_start_date: formatContractDate(rental?.start_date, locale),
    rental_start_time: formatContractTime(rental?.start_date) || "To be confirmed",
    rental_end_date: isRollingMonthly ? "Open ended" : formatContractDate(rental?.end_date, locale),
    rental_end_time: isRollingMonthly ? "" : formatContractTime(rental?.end_date),
    rental_rate: formatAmount(rental?.rental_rate),
    billing_period: stripEmpty(rental?.pricing_model, "rental period"),
    deposit_amount: formatAmount(rental?.deposit_amount),
    secondary_deposit_amount: formatAmount(settings.secondary_deposit_amount),
    mileage_limit: formatAmount(settings.mileage_limit),
    fuel_charge_per_increment: formatAmount(settings.fuel_charge_per_increment),
    late_fee_percentage: formatAmount(settings.late_fee_percentage),
    cleaning_fee_minimum: formatAmount(settings.cleaning_fee_minimum),
    smoking_fee_maximum: formatAmount(settings.smoking_fee_maximum),
    emergency_repair_limit: formatAmount(settings.emergency_repair_limit),
    deposit_return_days: formatAmount(settings.deposit_return_days),
    insurance_type: optionalText(bookingData.insurance_type || vehicle?.voluntary_insurance_type || "standard rental-use"),
    insurance_excess: formatAmount(bookingData.insurance_excess || organization?.settings?.insurance_excess || 0),
    contract_date: formatContractDate(new Date().toISOString(), locale),
    included_items: includedItemsHtml(includedItems),
    special_conditions: stripEmpty(bookingLink?.special_conditions || bookingData.special_conditions, ""),
    delivery_odometer: "",
    delivery_fuel_level: "",
    delivery_fuel_image_url: "",
    delivery_date: deliveryDateTime ? formatContractDate(deliveryDateTime, locale) : "",
    delivery_location: stripEmpty(deliveryLocation),
    delivery_damage_report: "<div style=\"border:1px solid #ccc; min-height:80px; padding:10px; color:#777;\">Delivery inspection report to be attached or completed at handover.</div>",
    island_travel_clause_enabled: islandClauseEnabled,
    secondary_deposit_enabled: secondaryDepositEnabled,
    geofence_monitoring_enabled: settings.geofence_monitoring_enabled,
    is_rolling_monthly: isRollingMonthly,
    customer_name: fullName,
    customer_passport: optionalText(customer?.passport_number),
    customer_nationality: optionalText(customer?.nationality),
    customer_phone: optionalText(customer?.phone),
    customer_address: optionalText(customer?.address),
    vehicle_plate: stripEmpty(vehicle?.registration_number),
    rental_duration: isRollingMonthly ? "Open ended" : `${formatContractDate(rental?.start_date, locale)} to ${formatContractDate(rental?.end_date, locale)}`,
    delivery_method: deliveryMethod,
    delivery_datetime: deliveryDateTime ? `${formatContractDate(deliveryDateTime, locale)} ${formatContractTime(deliveryDateTime)}` : "To be confirmed"
  };

  return variables;
}

export function htmlToPlainText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(h1|h2|h3|p|li|div)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
