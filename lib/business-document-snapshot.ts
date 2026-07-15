import { parseLegacyBrandingReference, type BrandingStorageReference } from "@/lib/branding-assets";
import type { Json } from "@/lib/supabase/database.types";

export const businessDocumentSnapshotSchemaVersion = "business-document-snapshot-v1" as const;

export type BusinessDocumentAssetReference =
  | { kind: "storage"; bucket: string; path: string }
  | { kind: "data_url"; value: string }
  | { kind: "legacy_url"; value: string }
  | null;

export type BusinessDocumentSnapshot = {
  snapshot_schema_version: typeof businessDocumentSnapshotSchemaVersion;
  organization_id: string;
  trading_name: string;
  legal_name: string;
  registration_or_tax_number: string | null;
  address: string | null;
  contacts: {
    phone: string | null;
    email: string | null;
    whatsapp: string | null;
    line_id: string | null;
  };
  logo: BusinessDocumentAssetReference;
  accent_colour: string;
  authorised_signatory: {
    name: string | null;
    title: string | null;
    signature_authorised_at: string | null;
    signature_authorisation_text_version: string | null;
  };
  authorised_signature: BusinessDocumentAssetReference;
  footer_text: string | null;
  powered_by_routehq_enabled: boolean;
  locale: string;
  template_id: string | null;
};

export type BusinessDocumentSnapshotOrganization = {
  id: string;
  name: string;
  trading_name?: string | null;
  legal_name?: string | null;
  registration_or_tax_number?: string | null;
  business_address?: string | null;
  business_phone?: string | null;
  business_email?: string | null;
  whatsapp?: string | null;
  line_id?: string | null;
  logo_url?: string | null;
  business_logo_storage_bucket?: string | null;
  business_logo_storage_path?: string | null;
  owner_signature_url?: string | null;
  contract_accent_colour?: string | null;
  authorised_signatory_name?: string | null;
  authorised_signatory_title?: string | null;
  authorised_signature_storage_bucket?: string | null;
  authorised_signature_storage_path?: string | null;
  signature_authorised_at?: string | null;
  signature_authorisation_text_version?: string | null;
  contract_footer_text?: string | null;
  powered_by_routehq_enabled?: boolean | null;
  default_locale: string;
  default_contract_locale?: string | null;
  default_contract_template_id?: string | null;
  settings?: Json;
};

function settingsObject(value: Json | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function cleanOptional(value: unknown) {
  const cleaned = String(value || "").trim();
  return cleaned || null;
}

function assetReferenceFromLegacy(value: string | BrandingStorageReference | null | undefined): BusinessDocumentAssetReference {
  const parsed = parseLegacyBrandingReference(value);
  if (!parsed) return null;
  if (parsed.kind === "storage") {
    return { kind: "storage", bucket: parsed.reference.bucket, path: parsed.reference.path };
  }
  if (parsed.kind === "data_url") {
    return { kind: "data_url", value: parsed.url };
  }
  return { kind: "legacy_url", value: parsed.url };
}

function assetReferenceFromCanonical(bucket: unknown, path: unknown): BusinessDocumentAssetReference {
  const cleanBucket = cleanOptional(bucket);
  const cleanPath = cleanOptional(path);
  return cleanBucket && cleanPath ? { kind: "storage", bucket: cleanBucket, path: cleanPath } : null;
}

export function buildBusinessDocumentSnapshot(organization: BusinessDocumentSnapshotOrganization): BusinessDocumentSnapshot {
  const settings = settingsObject(organization.settings);
  const tradingName = cleanOptional(organization.trading_name) || organization.name;
  const legalName = cleanOptional(organization.legal_name) || tradingName;
  const signatureBucket = cleanOptional(organization.authorised_signature_storage_bucket);
  const signaturePath = cleanOptional(organization.authorised_signature_storage_path);

  return {
    snapshot_schema_version: businessDocumentSnapshotSchemaVersion,
    organization_id: organization.id,
    trading_name: tradingName,
    legal_name: legalName,
    registration_or_tax_number: cleanOptional(organization.registration_or_tax_number),
    address: cleanOptional(organization.business_address || settings.business_address || settings.address),
    contacts: {
      phone: cleanOptional(organization.business_phone || settings.business_phone || settings.phone),
      email: cleanOptional(organization.business_email || settings.business_email || settings.email),
      whatsapp: cleanOptional(organization.whatsapp || settings.owner_whatsapp),
      line_id: cleanOptional(organization.line_id || settings.owner_line_id)
    },
    logo:
      assetReferenceFromCanonical(organization.business_logo_storage_bucket, organization.business_logo_storage_path) ||
      assetReferenceFromCanonical(settings.business_logo_storage_bucket, settings.business_logo_storage_path) ||
      assetReferenceFromLegacy(cleanOptional(organization.logo_url || String(settings.logo_url || ""))),
    accent_colour: cleanOptional(organization.contract_accent_colour) || "#0f766e",
    authorised_signatory: {
      name: cleanOptional(organization.authorised_signatory_name),
      title: cleanOptional(organization.authorised_signatory_title),
      signature_authorised_at: cleanOptional(organization.signature_authorised_at),
      signature_authorisation_text_version: cleanOptional(organization.signature_authorisation_text_version)
    },
    authorised_signature:
      signatureBucket && signaturePath
        ? { kind: "storage", bucket: signatureBucket, path: signaturePath }
        : assetReferenceFromLegacy(cleanOptional(organization.owner_signature_url || String(settings.owner_signature_url || ""))),
    footer_text: cleanOptional(organization.contract_footer_text),
    powered_by_routehq_enabled: organization.powered_by_routehq_enabled ?? true,
    locale: cleanOptional(organization.default_contract_locale || organization.default_locale) || "en",
    template_id: cleanOptional(organization.default_contract_template_id)
  };
}
