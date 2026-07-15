import {
  calculateRentalDocumentContentHash,
  type BusinessSnapshot,
  type RentalDocument,
  type RentalDocumentVersion,
  type RenderedSnapshot
} from "@/lib/rental-documents";

export type FinalisationIssue = {
  code: string;
  message: string;
  section: "feature" | "ownership" | "version" | "business" | "renter" | "vehicle" | "rental" | "template" | "signature";
};

export type DocumentFinalisationEligibility = {
  eligible: boolean;
  blockingIssues: FinalisationIssue[];
  warnings: FinalisationIssue[];
  requiredBusinessInformationStatus: "complete" | "missing";
  requiredRenterInformationStatus: "complete" | "missing";
  requiredVehicleInformationStatus: "complete" | "missing";
  requiredRentalPricingInformationStatus: "complete" | "missing";
  templateStatus: "complete" | "missing";
  operatorSignatureAuthorisationStatus: "complete" | "missing";
  existingVersionStatus: string;
  contentHashMatches: boolean;
  businessSignatoryName: string | null;
  businessSignatoryTitle: string | null;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function isStorageReference(value: unknown) {
  const asset = objectValue(value);
  return text(asset.kind) === "storage" && Boolean(text(asset.bucket) && text(asset.path));
}

function pushIssue(issues: FinalisationIssue[], section: FinalisationIssue["section"], code: string, message: string) {
  issues.push({ section, code, message });
}

export function getDocumentFinalisationEligibility({
  featureEnabled,
  organizationId,
  document,
  version,
  newerDraftExists = false
}: {
  featureEnabled: boolean;
  organizationId: string;
  document: RentalDocument;
  version: RentalDocumentVersion;
  newerDraftExists?: boolean;
}): DocumentFinalisationEligibility {
  const blockingIssues: FinalisationIssue[] = [];
  const warnings: FinalisationIssue[] = [];
  const renderedDataSnapshot = objectValue(version.rendered_data_snapshot) as RenderedSnapshot;
  const businessSnapshot = objectValue(version.business_snapshot) as BusinessSnapshot;
  const variables = objectValue(renderedDataSnapshot.variables);
  const adapterWarnings = Array.isArray(renderedDataSnapshot.warnings) ? renderedDataSnapshot.warnings : [];
  const authorisedSignatory = objectValue(businessSnapshot.authorised_signatory);
  const recalculatedHash = calculateRentalDocumentContentHash({
    renderedHtmlSnapshot: version.rendered_html_snapshot || "",
    renderedDataSnapshot,
    businessSnapshot,
    templateId: version.template_id,
    templateVersion: version.template_version,
    versionNumber: version.version_number,
    pdfStorageBucket: version.pdf_storage_bucket,
    pdfStoragePath: version.pdf_storage_path
  });
  const contentHashMatches = Boolean(version.content_hash && recalculatedHash === version.content_hash);

  if (!featureEnabled) pushIssue(blockingIssues, "feature", "feature_disabled", "Rental document engine is disabled.");
  if (document.organization_id !== organizationId || version.organization_id !== organizationId) {
    pushIssue(blockingIssues, "ownership", "organization_mismatch", "Document version does not belong to this organization.");
  }
  if (version.document_id !== document.id) pushIssue(blockingIssues, "ownership", "document_mismatch", "Version does not belong to the selected document.");
  if (version.status !== "draft") pushIssue(blockingIssues, "version", "not_draft", "Only draft versions can be finalised.");
  if (document.current_version_id && document.current_version_id !== version.id) {
    pushIssue(blockingIssues, "version", "not_current_version", "Only the current draft version can be finalised.");
  }
  if (document.document_type !== "rental_agreement") pushIssue(blockingIssues, "version", "unsupported_document_type", "Only rental agreement drafts can be finalised in this phase.");
  if (!text(version.rendered_html_snapshot)) pushIssue(blockingIssues, "version", "missing_html", "Rendered HTML snapshot is missing.");
  if (!Object.keys(renderedDataSnapshot).length) pushIssue(blockingIssues, "version", "missing_data_snapshot", "Rendered data snapshot is missing.");
  if (!Object.keys(businessSnapshot).length) pushIssue(blockingIssues, "business", "missing_business_snapshot", "Business snapshot is missing.");
  if (!contentHashMatches) pushIssue(blockingIssues, "version", "hash_mismatch", "Stored content hash does not match the immutable snapshots.");
  if (!version.template_id && !businessSnapshot.template_id) pushIssue(blockingIssues, "template", "missing_template", "Template cannot be identified.");
  if (!text(businessSnapshot.legal_name)) pushIssue(blockingIssues, "business", "missing_legal_name", "Legal business name is missing.");
  if (!text(variables.renter_full_name)) pushIssue(blockingIssues, "renter", "missing_renter_name", "Renter legal name is missing.");
  if (!text(variables.vehicle_registration) && !text(variables.vehicle_vin)) pushIssue(blockingIssues, "vehicle", "missing_vehicle_identity", "Vehicle identity is missing.");
  if (!text(variables.rental_start_date)) pushIssue(blockingIssues, "rental", "missing_rental_start", "Rental start information is missing.");
  if (!text(variables.contracted_rate || variables.rental_rate)) pushIssue(blockingIssues, "rental", "missing_contracted_rate", "Contracted rate is missing.");
  if (!text(variables.billing_period || variables.billing_period_label)) pushIssue(blockingIssues, "rental", "missing_billing_period", "Billing period is missing.");
  if (text(variables.is_rolling_monthly) === "true" && !text(variables.standard_daily_rate)) {
    pushIssue(blockingIssues, "rental", "missing_standard_daily_rate", "Standard daily rate is required for open-ended rentals.");
  }
  if (!text(authorisedSignatory.name)) pushIssue(blockingIssues, "signature", "missing_signatory_name", "Authorised signatory name is missing.");
  if (!text(authorisedSignatory.title)) pushIssue(blockingIssues, "signature", "missing_signatory_title", "Authorised signatory title is missing.");
  if (!text(authorisedSignatory.signature_authorised_at) || !text(authorisedSignatory.signature_authorisation_text_version)) {
    pushIssue(blockingIssues, "signature", "missing_signature_authorisation", "Signature authorisation has not been accepted.");
  }
  if (!isStorageReference(businessSnapshot.authorised_signature)) {
    pushIssue(blockingIssues, "signature", "missing_authorised_signature", "Authorised signature reference is missing.");
  }
  if (newerDraftExists) pushIssue(blockingIssues, "version", "newer_draft_exists", "A newer draft version supersedes this version.");
  for (const warning of adapterWarnings) {
    const entry = objectValue(warning);
    if (entry.blocksSigning === true || entry.severity === "blocking") {
      pushIssue(
        blockingIssues,
        "template",
        `blocking_template_warning_${String(entry.variable || "unknown")}`,
        String(entry.message || "Blocking template warning remains.")
      );
    } else if (entry.message) {
      pushIssue(warnings, "template", `template_warning_${String(entry.variable || "unknown")}`, String(entry.message));
    }
  }

  if (!text(variables.deposit_amount)) pushIssue(warnings, "rental", "missing_deposit", "Deposit amount is not populated.");
  if (!text(variables.insurance_excess_amount) && !text(variables.insurance_excess)) {
    pushIssue(warnings, "rental", "missing_insurance_excess", "Insurance excess is not populated.");
  }

  return {
    eligible: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    requiredBusinessInformationStatus: blockingIssues.some((issue) => issue.section === "business") ? "missing" : "complete",
    requiredRenterInformationStatus: blockingIssues.some((issue) => issue.section === "renter") ? "missing" : "complete",
    requiredVehicleInformationStatus: blockingIssues.some((issue) => issue.section === "vehicle") ? "missing" : "complete",
    requiredRentalPricingInformationStatus: blockingIssues.some((issue) => issue.section === "rental") ? "missing" : "complete",
    templateStatus: blockingIssues.some((issue) => issue.section === "template") ? "missing" : "complete",
    operatorSignatureAuthorisationStatus: blockingIssues.some((issue) => issue.section === "signature") ? "missing" : "complete",
    existingVersionStatus: version.status,
    contentHashMatches,
    businessSignatoryName: text(authorisedSignatory.name) || null,
    businessSignatoryTitle: text(authorisedSignatory.title) || null
  };
}
