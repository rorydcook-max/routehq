import type { Json } from "@/lib/supabase/database.types";

type RentalDocumentFeatureOrganization = {
  id: string;
  settings?: Json | Record<string, unknown> | null;
};

function settingsObject(value: RentalDocumentFeatureOrganization["settings"]) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function allowlistFromEnv() {
  return String(process.env.RENTAL_DOCUMENT_ENGINE_ORG_IDS || process.env.ROUTEHQ_RENTAL_DOCUMENT_ENGINE_ORG_IDS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function isRentalDocumentEngineEnabledForOrganization(organization: RentalDocumentFeatureOrganization | null | undefined) {
  if (!organization?.id) return false;

  const settings = settingsObject(organization.settings);
  if (settings.rental_document_engine_enabled === true || settings.experimental_rental_document_engine_enabled === true) {
    return true;
  }

  return allowlistFromEnv().includes(organization.id);
}
