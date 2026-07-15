import { buildBusinessDocumentSnapshot, type BusinessDocumentAssetReference, type BusinessDocumentSnapshot } from "@/lib/business-document-snapshot";
import { buildContractVariables, renderContractTemplate } from "@/lib/contract-rendering";
import { embedLogoInContractVariables, ensureDefaultContractTemplate } from "@/lib/contracts";
import { calculateRentalDocumentContentHash, stableJsonStringify } from "@/lib/rental-documents";

export type RentalDocumentTemplateAdapterResult = {
  renderedHtml: string;
  renderedDataSnapshot: Record<string, unknown>;
  businessSnapshot: BusinessDocumentSnapshot;
  templateId: string | null;
  templateVersion: number | null;
  contentHash: string;
  missingVariables: string[];
  warnings: RentalDocumentTemplateWarning[];
};

export type RentalDocumentTemplateWarning = {
  variable: string;
  severity: "info" | "warning" | "blocking";
  message: string;
  blocksSigning: boolean;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function assetRenderValue(asset: BusinessDocumentAssetReference) {
  if (!asset) return "";
  if (asset.kind === "storage") return asset.path;
  if (asset.kind === "data_url") return asset.value;
  return asset.value;
}

function templateTokens(template: string) {
  const tokens = new Set<string>();
  for (const match of template.matchAll(/\{\{\s*(?:#if\s+)?([a-zA-Z0-9_]+)\s*\}\}/g)) {
    if (match[1] !== "else") tokens.add(match[1]);
  }
  return Array.from(tokens).sort();
}

function warningIfMissing(variable: string, label: string, value: unknown, warnings: RentalDocumentTemplateWarning[], severity: RentalDocumentTemplateWarning["severity"] = "warning") {
  const text = clean(value);
  if (!text || text === "Not provided" || text === "To be confirmed") {
    warnings.push({
      variable,
      severity,
      message: `${label} is missing or needs confirmation.`,
      blocksSigning: severity === "blocking"
    });
  }
}

function safeJsonClone<T>(value: T): T {
  return JSON.parse(stableJsonStringify(value));
}

export async function renderRentalAgreementDraftTemplate({
  supabase,
  organization,
  rental,
  customer,
  vehicle,
  bookingLink,
  templateId
}: {
  supabase: any;
  organization: any;
  rental: any;
  customer: any;
  vehicle: any;
  bookingLink: any;
  templateId?: string | null;
}): Promise<RentalDocumentTemplateAdapterResult> {
  const businessSnapshot = buildBusinessDocumentSnapshot(organization);
  const template = templateId
    ? await loadOrganizationTemplate(supabase, organization.id, templateId)
    : await ensureDefaultContractTemplate(supabase, organization.id);
  const templateHtml = String(template?.content_html || template?.body || "");
  if (!templateHtml) {
    throw new Error("Contract template has no HTML content.");
  }

  const variables = buildContractVariables({
    organization: {
      ...organization,
      name: businessSnapshot.trading_name,
      business_logo_storage_path: assetRenderValue(businessSnapshot.logo),
      owner_signature_url: assetRenderValue(businessSnapshot.authorised_signature),
      settings: {
        ...(organization.settings || {}),
        business_logo_storage_path: assetRenderValue(businessSnapshot.logo),
        owner_signature_url: assetRenderValue(businessSnapshot.authorised_signature),
        owner_whatsapp: businessSnapshot.contacts.whatsapp || organization.settings?.owner_whatsapp,
        owner_line_id: businessSnapshot.contacts.line_id || organization.settings?.owner_line_id
      }
    },
    customer,
    vehicle,
    rental,
    bookingLink
  });

  variables.business_name = businessSnapshot.trading_name;
  variables.owner_name = businessSnapshot.authorised_signatory.name || businessSnapshot.trading_name;
  variables.owner_phone = businessSnapshot.contacts.phone || variables.owner_phone;
  variables.owner_email = businessSnapshot.contacts.email || variables.owner_email;
  variables.owner_whatsapp = businessSnapshot.contacts.whatsapp || variables.owner_whatsapp;
  variables.owner_line_id = businessSnapshot.contacts.line_id || variables.owner_line_id;
  variables.business_address = businessSnapshot.address || variables.business_address;
  variables.business_logo_url = assetRenderValue(businessSnapshot.logo);
  variables.owner_signature_url = assetRenderValue(businessSnapshot.authorised_signature);
  variables.contract_accent_colour = businessSnapshot.accent_colour;
  variables.contract_footer_text = businessSnapshot.footer_text || "";
  variables.powered_by_routehq_enabled = businessSnapshot.powered_by_routehq_enabled;
  variables.authorised_signatory_name = businessSnapshot.authorised_signatory.name || "";
  variables.authorised_signatory_title = businessSnapshot.authorised_signatory.title || "";
  variables.business_legal_name = businessSnapshot.legal_name;
  variables.business_registration_or_tax_number = businessSnapshot.registration_or_tax_number || "";
  variables.customer_date_of_birth = clean(customer?.date_of_birth || customer?.dob);
  variables.customer_thai_id = clean(customer?.thai_id_number || customer?.id_card_number || customer?.national_id_number);
  variables.additional_drivers = Array.isArray(bookingLink?.booking_data?.additional_drivers)
    ? bookingLink.booking_data.additional_drivers.map((driver: any) => clean(driver?.full_name || driver?.name)).filter(Boolean).join(", ")
    : "";
  variables.vehicle_transmission = clean(vehicle?.transmission || vehicle?.specifications?.transmission);
  variables.vehicle_vin = clean(vehicle?.vin || vehicle?.chassis_number);
  variables.open_ended_status = rental?.is_indefinite ? "Open-ended" : "Fixed term";
  variables.contracted_rate = clean(rental?.contracted_rate || rental?.rental_rate);
  variables.standard_daily_rate = rental?.standard_daily_rate == null ? "" : clean(rental.standard_daily_rate);
  variables.early_termination_minimum_days = rental?.early_termination_minimum_days == null ? "" : clean(rental.early_termination_minimum_days);
  variables.delivery_fee = rental?.delivery_fee == null ? "" : clean(rental.delivery_fee);
  variables.collection_fee = rental?.collection_fee == null ? "" : clean(rental.collection_fee);
  variables.cancellation_admin_fee = rental?.cancellation_admin_fee == null ? "" : clean(rental.cancellation_admin_fee);
  variables.insurance_excess_amount = rental?.insurance_excess == null ? "" : clean(rental.insurance_excess);
  variables.mileage_allowance_amount = rental?.mileage_allowance == null ? "" : clean(rental.mileage_allowance);
  variables.excess_mileage_rate_amount = rental?.excess_mileage_rate == null ? "" : clean(rental.excess_mileage_rate);
  variables.permitted_territory = clean(bookingLink?.booking_data?.permitted_territory || organization?.settings?.permitted_territory || organization?.settings?.home_territory);
  variables.fuel_policy = clean(bookingLink?.booking_data?.fuel_policy || organization?.settings?.fuel_policy);
  variables.cleaning_fee = clean(bookingLink?.booking_data?.cleaning_fee || organization?.settings?.cleaning_fee_minimum);
  variables.included_services = Array.isArray(bookingLink?.included_items) ? bookingLink.included_items.join(", ") : "";

  await embedLogoInContractVariables(supabase, variables);

  const tokens = templateTokens(templateHtml);
  const missingVariables = tokens.filter((token) => clean(variables[token]) === "");
  const warnings: RentalDocumentTemplateWarning[] = [];
  warningIfMissing("renter_full_name", "Renter full name", variables.renter_full_name, warnings, "blocking");
  warningIfMissing("renter_passport_number", "Renter passport or ID", variables.renter_passport_number || variables.customer_thai_id, warnings, "blocking");
  warningIfMissing("renter_licence_number", "Renter licence number", variables.renter_licence_number, warnings, "blocking");
  warningIfMissing("vehicle_registration", "Vehicle registration", variables.vehicle_registration, warnings, "blocking");
  warningIfMissing("rental_start_date", "Rental start date", variables.rental_start_date, warnings, "blocking");
  warningIfMissing("rental_rate", "Rental rate", variables.rental_rate, warnings, "blocking");
  warningIfMissing("deposit_amount", "Deposit amount", variables.deposit_amount, warnings, "warning");
  warningIfMissing("business_address", "Business address", variables.business_address, warnings, "warning");
  warningIfMissing("standard_daily_rate", "Standard daily rate", variables.standard_daily_rate, warnings, "info");
  warningIfMissing("insurance_excess_amount", "Insurance excess", variables.insurance_excess_amount, warnings, "warning");
  missingVariables.forEach((token) => warnings.push({
    variable: token,
    severity: "warning",
    message: `Template variable ${token} is not populated.`,
    blocksSigning: false
  }));

  const renderedHtml = renderContractTemplate(templateHtml, variables);
  const renderedDataSnapshot = safeJsonClone({
    adapter_schema_version: "rental-document-template-adapter-v1",
    rental_id: rental.id,
    booking_link_id: bookingLink?.id || null,
    customer_id: customer?.id || null,
    vehicle_id: vehicle?.id || null,
    warnings,
    missing_variables: missingVariables,
    variables
  });
  const contentHash = calculateRentalDocumentContentHash({
    renderedHtmlSnapshot: renderedHtml,
    renderedDataSnapshot,
    businessSnapshot,
    templateId: template?.id || null,
    templateVersion: template?.version ?? null
  });

  return {
    renderedHtml,
    renderedDataSnapshot,
    businessSnapshot,
    templateId: template?.id || null,
    templateVersion: template?.version ?? null,
    contentHash,
    missingVariables,
    warnings
  };
}

async function loadOrganizationTemplate(supabase: any, organizationId: string, templateId: string) {
  const { data, error } = await supabase
    .from("contract_templates")
    .select("*")
    .eq("id", templateId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || "Contract template was not found for this organization.");
  }

  return data;
}
