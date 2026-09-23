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
  billing_period_label: string;
  payment_due_label: string;
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
  owner_signature_url: string;
  customer_signature_url: string;
  customer_signed_at: string;
  delivery_appendix_visible: boolean;
  delivery_customer_signature_url: string;
  delivery_customer_signed_at: string;
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
  "billing_period_label",
  "payment_due_label",
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
  "owner_signature_url",
  "customer_signature_url",
  "customer_signed_at",
  "delivery_appendix_visible",
  "delivery_customer_signature_url",
  "delivery_customer_signed_at",
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
  <p>Rental: {{rental_start_date}} to {{rental_end_date}}, {{rental_rate}} per {{billing_period_label}}. Deposit: {{deposit_amount}}.</p>
  <p>Governing law: {{jurisdiction}}.</p>
`;

export function renderContractTemplate(template: string, variables: Record<string, unknown>) {
  const rawHtmlKeys = new Set(["included_items", "special_conditions", "delivery_damage_report"]);

  let rendered = template.replace(/<!--\s*CONDITIONAL:\s*([a-zA-Z0-9_]+)\s*-->([\s\S]*?)<!--\s*END CONDITIONAL\s*-->/g, (_match, key, content) => {
    return variables[key] ? content : "";
  });

  // Resolve {{#if key}} ... {{else}} ... {{/if}} blocks innermost-first.
  //
  // The pattern only matches a block whose body contains no other {{#if, so a
  // block can only ever pair with its OWN {{else}} and {{/if}}. The previous
  // approach tried an if/else pattern first, lazily; an {{#if}} with no
  // {{else}} (e.g. is_rolling_monthly) then ran on to the NEXT block's
  // {{else}} and treated ~250 lines of contract as one conditional. Fixed-term
  // rentals lost about 80% of the contract, including the signatures section,
  // and rolling-monthly contracts showed raw {{#if}} tags. Repeating until
  // nothing changes resolves nested blocks from the inside out.
  const innermostIf = /\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}((?:(?!\{\{#if\b)[\s\S])*?)\{\{\/if\}\}/g;

  for (let i = 0; i < 50; i += 1) {
    const before = rendered;

    rendered = rendered.replace(innermostIf, (_match, key, body) => {
      const elseIndex = body.indexOf("{{else}}");
      const truthyContent = elseIndex === -1 ? body : body.slice(0, elseIndex);
      const fallbackContent = elseIndex === -1 ? "" : body.slice(elseIndex + "{{else}}".length);
      return variables[key] ? truthyContent : fallbackContent;
    });

    if (rendered === before) break;
  }

  return rendered.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = variables[key] ?? "";
    return rawHtmlKeys.has(key) ? String(value) : escapeHtml(value);
  });
}

/**
 * Extracts the inner content of a full HTML document for safe inline preview.
 *
 * The contract template is a full HTML document (<!DOCTYPE html><html>...) which
 * is correct for PDF generation. For inline preview inside React via
 * dangerouslySetInnerHTML, we need only the <body> content with styles inlined,
 * because injecting a full HTML document into the DOM breaks the page layout.
 *
 * Extracts:
 *   - All <style> blocks from <head>, wrapped in a single <style> tag
 *   - The inner content of <body>
 *
 * Falls back to returning the original string unchanged if no <body> tag is
 * found (handles legacy body-fragment templates gracefully).
 */
export function extractBodyHtml(fullHtml: string): string {
  const trimmed = fullHtml.trimStart();

  // Already a fragment — no document wrapper to strip
  if (
    !trimmed.toLowerCase().startsWith("<!doctype") &&
    !trimmed.toLowerCase().startsWith("<html")
  ) {
    return fullHtml;
  }

  // Extract <style> blocks from <head>
  const styles: string[] = [];
  const stylePattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch: RegExpExecArray | null;
  while ((styleMatch = stylePattern.exec(fullHtml)) !== null) {
    styles.push(styleMatch[1]);
  }

  // Scope all CSS selectors to .routehq-contract-preview so that contract
  // styles (body {}, h2 {}, etc.) don't leak into the surrounding page when
  // injected via dangerouslySetInnerHTML.
  const scopedCss = styles
    .join("\n")
    .split(/\n/)
    .map((line) => {
      const trimmedLine = line.trim();
      if (
        !trimmedLine ||
        trimmedLine.startsWith("//") ||
        trimmedLine.startsWith("/*") ||
        trimmedLine.startsWith("*") ||
        trimmedLine.startsWith("@") ||
        trimmedLine.startsWith("}") ||
        !trimmedLine.includes("{")
      ) {
        return line;
      }
      const [selectorPart, ...rest] = line.split("{");
      const scopedSelectors = selectorPart
        .split(",")
        .map((sel) => {
          const s = sel.trim();
          if (!s) return s;
          if (s.startsWith(".routehq-contract-preview")) return s;
          if (s === "body") return ".routehq-contract-preview";
          return `.routehq-contract-preview ${s}`;
        })
        .join(", ");
      return `${scopedSelectors} {${rest.join("{")}`;
    })
    .join("\n");

  const styleBlock = scopedCss.trim() ? `<style>\n${scopedCss}\n</style>` : "";

  // Extract <body> inner content using indexOf for reliability
  const bodyOpen = fullHtml.toLowerCase().indexOf("<body");
  const bodyClose = fullHtml.toLowerCase().lastIndexOf("</body>");

  if (bodyOpen === -1) {
    return fullHtml;
  }

  const bodyTagEnd = fullHtml.indexOf(">", bodyOpen) + 1;
  const bodyContent =
    bodyClose !== -1 ? fullHtml.slice(bodyTagEnd, bodyClose) : fullHtml.slice(bodyTagEnd);

  return `${styleBlock}\n${bodyContent}`;
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
  const deliveryDateTime =
    bookingData.delivery_datetime ||
    bookingData.deliveryDateTime ||
    bookingData.delivery_date ||
    null;
  const isRollingMonthly = Boolean(rental?.is_indefinite || rental?.pricing_model === "subscription" || bookingData.open_ended);
  const islandClauseEnabled = settings.home_territory_type === "island" || settings.island_travel_policy !== "notice_only";
  const secondaryDepositEnabled = settings.island_travel_policy === "deposit_required";
  const vehicleSpecs = typeof vehicle?.specifications === "object" && vehicle.specifications ? vehicle.specifications : {};
  const fuelType = vehicle?.fuel_type || vehicleSpecs.fuel_type || vehicleSpecs.fuelType || "";
  const deliveryLocation = bookingData.delivery_location || rental?.delivery_location || bookingData.collection_address || "To be confirmed";
  const deliveryOdometer = stripEmpty(bookingData.delivery_odometer || bookingData.odometer_at_delivery, "");
  const deliveryFuelLevel = stripEmpty(bookingData.delivery_fuel_level || bookingData.fuel_level_at_delivery, "");
  const deliveryFuelImageUrl = stripEmpty(bookingData.delivery_fuel_image_url || bookingData.fuel_photo_url, "");
  const deliveryDamageReport = stripEmpty(bookingData.delivery_damage_report || bookingData.damage_report_html || bookingData.delivery_damage_html, "");
  const ownerSignatureUrl = stripEmpty(
    organization?.authorised_signature_storage_path ||
      organization?.settings?.owner_signature_url ||
      organization?.settings?.signature_url ||
      organization?.owner_signature_url,
    ""
  );
  const customerSignatureUrl = stripEmpty(
    bookingData.customer_signature_url ||
      bookingData.signature_url ||
      bookingLink?.customer_signature_url ||
      bookingLink?.signature_url,
    ""
  );
  const customerSignedAt =
    bookingData.customer_signed_at ||
    bookingData.signed_at ||
    bookingLink?.customer_signed_at ||
    bookingLink?.signed_at ||
    null;
  const deliveryCustomerSignatureUrl = stripEmpty(
    bookingData.delivery_customer_signature_url || bookingData.delivery_signature_url,
    ""
  );
  const deliveryCustomerSignedAt = bookingData.delivery_customer_signed_at || null;
  const deliveryAppendixVisible = Boolean(
    deliveryOdometer ||
      deliveryFuelLevel ||
      deliveryFuelImageUrl ||
      deliveryDamageReport ||
      deliveryCustomerSignatureUrl ||
      deliveryCustomerSignedAt
  );
  const deliveryMethod =
    bookingData.delivery_method === "collection" || bookingData.delivery_method === "collect"
      ? "Customer collection"
      : bookingData.delivery_method === "tbd"
        ? "To be confirmed"
        : "Delivery";

  const variables: ContractVariables = {
    business_name: optionalText(organization?.name, "Rental operator"),
    business_logo_url: stripEmpty(
      organization?.business_logo_storage_path ||
        organization?.settings?.business_logo_storage_path ||
        organization?.logo_url ||
        organization?.settings?.logo_url,
      ""
    ),
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
    renter_passport_number: optionalText(
      bookingData.passport_number ||
        bookingData.ocr_passport_number ||
        customer?.passport_number
    ),
    renter_licence_number: optionalText(
      bookingData.licence_number ||
        bookingData.driver_licence_number ||
        bookingData.ocr_licence_number ||
        customer?.driver_license_number ||
        customer?.driving_licence_number
    ),
    renter_licence_country: optionalText(
      bookingData.licence_country ||
        bookingData.ocr_licence_country ||
        customer?.driver_license_country
    ),
    renter_licence_expiry: (() => {
      const expiry =
        bookingData.licence_expiry ||
        bookingData.ocr_licence_expiry ||
        customer?.driver_license_expiry;
      return expiry ? formatContractDate(String(expiry), locale) : "Not provided";
    })(),
    renter_phone: optionalText(customer?.phone),
    renter_email: optionalText(customer?.email),
    renter_address: optionalText(customer?.address),
    renter_nationality: optionalText(
      bookingData.nationality ||
        bookingData.ocr_nationality ||
        customer?.nationality
    ),
    vehicle_make: stripEmpty(vehicle?.make),
    vehicle_model: [vehicle?.model, vehicle?.trim].filter(Boolean).join(" "),
    vehicle_year: stripEmpty(vehicle?.year),
    vehicle_registration: stripEmpty(vehicle?.registration_number),
    vehicle_colour: stripEmpty(vehicle?.color),
    vehicle_fuel_type: optionalText(fuelType, "As specified by manufacturer"),
    rental_start_date: deliveryDateTime
      ? formatContractDate(deliveryDateTime, locale)
      : formatContractDate(rental?.start_date, locale),
    rental_start_time: deliveryDateTime
      ? formatContractTime(deliveryDateTime) || "To be confirmed"
      : formatContractTime(rental?.start_date) || "To be confirmed",
    rental_end_date: isRollingMonthly
      ? "Open ended"
      : rental?.end_date
        ? formatContractDate(rental.end_date, locale)
        : "N/A",
    rental_end_time:
      isRollingMonthly || !rental?.end_date
        ? ""
        : deliveryDateTime
          ? formatContractTime(deliveryDateTime)
          : formatContractTime(rental?.start_date),
    rental_rate: formatAmount(rental?.rental_rate),
    billing_period: stripEmpty(rental?.pricing_model, "rental period"),
    billing_period_label: (() => {
      const model = stripEmpty(rental?.pricing_model, "rental period");
      return model === "custom" || model === "once" ? "entire period" : model;
    })(),
    payment_due_label: (() => {
      const model = rental?.pricing_model;
      if (model === "custom" || model === "once") return "Paid in full upfront";
      if (model === "monthly") return "Same date each month";
      if (model === "weekly") return "Same day each week";
      return "As agreed";
    })(),
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
    delivery_odometer: deliveryOdometer,
    delivery_fuel_level: deliveryFuelLevel,
    delivery_fuel_image_url: deliveryFuelImageUrl,
    delivery_date: deliveryDateTime ? formatContractDate(deliveryDateTime, locale) : "",
    delivery_location: stripEmpty(deliveryLocation),
    delivery_damage_report: deliveryDamageReport || "<div style=\"background:#f8f9fa;border:1px dashed #c4c9cc;border-radius:6px;padding:10px;color:#717d86;font-size:11px;\">Delivery inspection report to be attached or completed at handover.</div>",
    owner_signature_url: ownerSignatureUrl,
    customer_signature_url: customerSignatureUrl,
    customer_signed_at: customerSignedAt ? formatContractDate(String(customerSignedAt), locale) : "",
    delivery_appendix_visible: deliveryAppendixVisible,
    delivery_customer_signature_url: deliveryCustomerSignatureUrl,
    delivery_customer_signed_at: deliveryCustomerSignedAt ? formatContractDate(String(deliveryCustomerSignedAt), locale) : "",
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
