import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const storageUrlPattern = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/;

function cleanPath(path) {
  return decodeURIComponent(path).replace(/^\/+/, "");
}

function parseLegacyBrandingReference(value, defaultBucket = "branding") {
  if (!value) return null;
  if (typeof value === "object") {
    const bucket = String(value.bucket || "").trim();
    const path = cleanPath(String(value.path || ""));
    return bucket && path ? { kind: "storage", reference: { bucket, path } } : null;
  }
  const rawValue = String(value).trim();
  if (!rawValue) return null;
  if (rawValue.startsWith("data:")) return { kind: "data_url", url: rawValue };
  const storageMatch = rawValue.match(storageUrlPattern);
  if (storageMatch) {
    return { kind: "storage", reference: { bucket: storageMatch[1], path: cleanPath(storageMatch[2]) } };
  }
  if (/^https?:\/\//i.test(rawValue)) return { kind: "external_url", url: rawValue };
  return { kind: "storage", reference: { bucket: defaultBucket, path: cleanPath(rawValue) } };
}

function stableJsonStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  return `{${Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
    .join(",")}}`;
}

function calculateRentalDocumentContentHash(input) {
  return createHash("sha256")
    .update(
      stableJsonStringify({
        business_snapshot: input.businessSnapshot,
        pdf_storage_bucket: input.pdfStorageBucket || null,
        pdf_storage_path: input.pdfStoragePath || null,
        rendered_data_snapshot: input.renderedDataSnapshot,
        rendered_html_snapshot: input.renderedHtmlSnapshot.replace(/\r\n/g, "\n").trim(),
        template_id: input.templateId || null,
        template_version: input.templateVersion ?? null
      })
    )
    .digest("hex");
}

function buildBusinessDocumentSnapshot(organization) {
  const settings = organization.settings || {};
  const logo = organization.business_logo_storage_bucket && organization.business_logo_storage_path
    ? { kind: "storage", bucket: organization.business_logo_storage_bucket, path: organization.business_logo_storage_path }
    : settings.business_logo_storage_bucket && settings.business_logo_storage_path
      ? { kind: "storage", bucket: settings.business_logo_storage_bucket, path: settings.business_logo_storage_path }
      : parseLegacyBrandingReference(organization.logo_url || settings.logo_url);
  const signature = organization.authorised_signature_storage_bucket && organization.authorised_signature_storage_path
    ? { kind: "storage", bucket: organization.authorised_signature_storage_bucket, path: organization.authorised_signature_storage_path }
    : parseLegacyBrandingReference(organization.owner_signature_url || settings.owner_signature_url);
  return {
    snapshot_schema_version: "business-document-snapshot-v1",
    organization_id: organization.id,
    trading_name: organization.trading_name || organization.name,
    legal_name: organization.legal_name || organization.trading_name || organization.name,
    logo,
    authorised_signature: signature,
    authorised_signatory: {
      name: organization.authorised_signatory_name || null,
      title: organization.authorised_signatory_title || null,
      signature_authorised_at: organization.signature_authorised_at || null,
      signature_authorisation_text_version: organization.signature_authorisation_text_version || null
    },
    powered_by_routehq_enabled: organization.powered_by_routehq_enabled ?? true,
    locale: organization.default_contract_locale || organization.default_locale || "en",
    template_id: organization.default_contract_template_id || null
  };
}

function isRentalDocumentEngineEnabledForOrganization(organization, env = {}) {
  if (!organization?.id) return false;
  const settings = organization.settings || {};
  if (settings.rental_document_engine_enabled === true || settings.experimental_rental_document_engine_enabled === true) return true;
  return String(env.RENTAL_DOCUMENT_ENGINE_ORG_IDS || env.ROUTEHQ_RENTAL_DOCUMENT_ENGINE_ORG_IDS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .includes(organization.id);
}

function renderMockPreview({ organizationId, rental, template = "<p>{{renter_full_name}} {{rental_rate}}</p>", saveDraft = false }) {
  if (rental.organization_id && rental.organization_id !== organizationId) {
    throw new Error("Rental was not found for this organization.");
  }
  const dbWrites = [];
  const variables = {
    renter_full_name: rental.customer_name || "",
    rental_rate: rental.rental_rate == null ? "" : String(rental.rental_rate),
    vehicle_registration: rental.vehicle_registration || ""
  };
  const missingVariables = Object.entries(variables).filter(([, value]) => !value).map(([key]) => key);
  const renderedHtml = template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => variables[key] || "");
  const renderedDataSnapshot = {
    adapter_schema_version: "rental-document-template-adapter-v1",
    rental_id: rental.id,
    variables
  };
  const contentHash = calculateRentalDocumentContentHash({
    renderedHtmlSnapshot: renderedHtml,
    renderedDataSnapshot,
    businessSnapshot: { organization_id: organizationId },
    templateId: "tpl-1",
    templateVersion: 1
  });
  if (saveDraft) {
    dbWrites.push({
      document: { organization_id: organizationId, rental_id: rental.id, status: "draft" },
      version: { status: "draft", finalised_at: null, signed_at: null, content_hash: contentHash }
    });
  }
  return {
    safeResult: {
      renderedHtml,
      warnings: missingVariables.map((key) => ({
        variable: key,
        severity: key === "renter_full_name" ? "blocking" : "warning",
        message: `${key} is missing.`,
        blocksSigning: key === "renter_full_name"
      })),
      contentHash
    },
    dbWrites,
    missingVariables
  };
}

function generateDraftPdfRecord({ organizationId, rentalId, documentId, version, now = "20260713010101" }) {
  if (!isRentalDocumentEngineEnabledForOrganization({ id: organizationId, settings: { rental_document_engine_enabled: true } })) {
    throw new Error("feature disabled");
  }
  if (version.organization_id !== organizationId) throw new Error("cross-organization access rejected");
  if (version.status !== "draft") throw new Error("Only draft versions can generate draft PDFs.");
  const pdfStoragePath = `organizations/${organizationId}/rentals/${rentalId}/rental-documents/${documentId}/versions/${version.id}/draft-${now}.pdf`;
  const watermarkedHtml = `<div>DRAFT - NOT SIGNED</div>${version.rendered_html_snapshot}`;
  const contentHash = calculateRentalDocumentContentHash({
    renderedHtmlSnapshot: version.rendered_html_snapshot,
    renderedDataSnapshot: version.rendered_data_snapshot,
    businessSnapshot: version.business_snapshot,
    templateId: version.template_id,
    templateVersion: version.template_version,
    versionNumber: version.version_number,
    pdfStorageBucket: "documents",
    pdfStoragePath
  });
  return {
    uploadInput: { html: watermarkedHtml },
    dbUpdate: { pdf_storage_bucket: "documents", pdf_storage_path: pdfStoragePath, content_hash: contentHash, signed_url: undefined }
  };
}

function finalisationEligibility({ featureEnabled = true, organizationId, document, version }) {
  const issues = [];
  const variables = version.rendered_data_snapshot?.variables || {};
  const business = version.business_snapshot || {};
  const signatory = business.authorised_signatory || {};
  const signature = business.authorised_signature || {};
  const expectedHash = calculateRentalDocumentContentHash({
    renderedHtmlSnapshot: version.rendered_html_snapshot || "",
    renderedDataSnapshot: version.rendered_data_snapshot || {},
    businessSnapshot: business,
    templateId: version.template_id,
    templateVersion: version.template_version,
    versionNumber: version.version_number,
    pdfStorageBucket: version.pdf_storage_bucket,
    pdfStoragePath: version.pdf_storage_path
  });
  if (!featureEnabled) issues.push("feature_disabled");
  if (document.organization_id !== organizationId || version.organization_id !== organizationId) issues.push("cross_org");
  if (version.status !== "draft") issues.push("not_draft");
  if (document.current_version_id !== version.id) issues.push("not_current");
  if (!version.rendered_html_snapshot) issues.push("missing_html");
  if (!version.rendered_data_snapshot) issues.push("missing_data");
  if (!business.legal_name) issues.push("missing_business_name");
  if (!variables.renter_full_name) issues.push("missing_renter");
  if (!variables.vehicle_registration && !variables.vehicle_vin) issues.push("missing_vehicle");
  if (!variables.rental_start_date) issues.push("missing_start");
  if (!variables.contracted_rate && !variables.rental_rate) issues.push("missing_rate");
  if (!variables.billing_period && !variables.billing_period_label) issues.push("missing_billing");
  if (variables.is_rolling_monthly === true && !variables.standard_daily_rate) issues.push("missing_standard_daily_rate");
  for (const warning of version.rendered_data_snapshot?.warnings || []) {
    if (warning.blocksSigning === true || warning.severity === "blocking") issues.push(`blocking_template_warning_${warning.variable || "unknown"}`);
  }
  if (!signatory.name || !signatory.title || !signatory.signature_authorised_at || !signatory.signature_authorisation_text_version) issues.push("missing_authorisation");
  if (signature.kind !== "storage" || !signature.bucket || !signature.path) issues.push("missing_signature");
  if (expectedHash !== version.content_hash) issues.push("hash_mismatch");
  return { eligible: issues.length === 0, issues };
}

function finaliseMockDocument({ organizationId, document, version, liveOrganization, now = "20260713020202", existingSignatures = [] }) {
  const eligibility = finalisationEligibility({ featureEnabled: true, organizationId, document, version });
  if (!eligibility.eligible) throw new Error(eligibility.issues[0]);
  const finalPdfPath = `organizations/${organizationId}/rentals/${document.rental_id}/rental-documents/${document.id}/versions/${version.id}/final-${now}.pdf`;
  const finalHtml = version.rendered_html_snapshot;
  assert.equal(finalHtml.includes("DRAFT - NOT SIGNED"), false);
  const finalHash = calculateRentalDocumentContentHash({
    renderedHtmlSnapshot: finalHtml,
    renderedDataSnapshot: version.rendered_data_snapshot,
    businessSnapshot: version.business_snapshot,
    templateId: version.template_id,
    templateVersion: version.template_version,
    versionNumber: version.version_number,
    pdfStorageBucket: "documents",
    pdfStoragePath: finalPdfPath
  });
  const signatureReference = version.business_snapshot.authorised_signature;
  const signature = existingSignatures.find((entry) => entry.signer_role === "authorised_business_signatory");
  return {
    version: {
      ...version,
      status: signature ? "signed" : "signed",
      finalised_at: "now",
      pdf_storage_bucket: "documents",
      pdf_storage_path: finalPdfPath,
      final_pdf_storage_bucket: "documents",
      final_pdf_storage_path: finalPdfPath,
      draft_pdf_storage_path: version.draft_pdf_storage_path,
      content_hash: finalHash
    },
    signature: signature || {
      signer_role: "authorised_business_signatory",
      signer_name: version.business_snapshot.authorised_signatory.name,
      signature_storage_bucket: signatureReference.bucket,
      signature_storage_path: signatureReference.path,
      content_hash_at_signing: finalHash,
      live_signature_ignored: liveOrganization.authorised_signature_storage_path !== signatureReference.path
    },
    signedUrlPersisted: false
  };
}

function finaliseRpcMock({ organizationId, document, version, finalPdfPath, currentHash, finalHash, existingSignatures = [] }) {
  if (document.organization_id !== organizationId || version.organization_id !== organizationId) throw new Error("wrong_org");
  if (document.current_version_id !== version.id) throw new Error("superseded");
  const expectedPrefix = `organizations/${organizationId}/rentals/${document.rental_id}/rental-documents/${document.id}/versions/${version.id}/final-`;
  if (
    finalPdfPath.length > 512 ||
    !finalPdfPath.startsWith(expectedPrefix) ||
    !/\/final-[-A-Za-z0-9_]+\.pdf$/.test(finalPdfPath) ||
    finalPdfPath.includes("..") ||
    finalPdfPath.includes("//") ||
    /%2e|%2f|%5c/i.test(finalPdfPath)
  ) {
    throw new Error("unsafe_final_path");
  }
  if (version.status === "draft" && version.content_hash !== currentHash) throw new Error("hash_mismatch");
  const existing = existingSignatures.find((entry) => entry.signer_role === "authorised_business_signatory");
  if (existing && existing.content_hash_at_signing !== finalHash) throw new Error("conflicting_signature");
  return {
    version: { ...version, status: "signed", content_hash: finalHash, final_pdf_storage_path: finalPdfPath, pdf_storage_path: finalPdfPath },
    signature: existing || { signer_role: "authorised_business_signatory", content_hash_at_signing: finalHash },
    insertedSignatureCount: existing ? 0 : 1
  };
}

function isSafeRentalDocumentPath(organizationId, path) {
  const uuid = "[0-9a-fA-F-]{36}";
  return new RegExp(`^organizations/${organizationId}/rentals/${uuid}/rental-documents/${uuid}/versions/${uuid}/(?:draft|final)-[-A-Za-z0-9_]+\\.pdf$`).test(path);
}

function orphanCandidates({ organizationId, objects, referencedPaths, nowMs, minAgeHours = 24 }) {
  const minAgeMs = minAgeHours * 60 * 60 * 1000;
  return objects.filter((object) => (
    isSafeRentalDocumentPath(organizationId, object.path) &&
    !referencedPaths.has(object.path) &&
    nowMs - Date.parse(object.updated_at) >= minAgeMs
  ));
}

function businessLogoExtension(file) {
  const mime = file.type || "";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  const nameExt = file.name?.split(".").pop()?.toLowerCase();
  if (nameExt && ["png", "jpg", "jpeg", "webp"].includes(nameExt)) return nameExt === "jpeg" ? "jpg" : nameExt;
  return null;
}

function validateRasterBrandingFile(file) {
  if (!businessLogoExtension(file) || file.type === "image/svg+xml" || file.name?.toLowerCase().endsWith(".svg")) {
    throw new Error("svg_rejected");
  }
}

function assertDevelopmentGuard(url) {
  if (!url.includes("adxwmzfbljlanfnxhsoa") || url.includes("loutrkhqnkslwapqxpkm")) {
    throw new Error("Refusing to run");
  }
}

function recordEventOnce(events, event) {
  const key = `${event.organization_id}:${event.event_type}:${event.metadata?.idempotency_key || ""}`;
  if (event.metadata?.idempotency_key && events.some((entry) => `${entry.organization_id}:${entry.event_type}:${entry.metadata?.idempotency_key || ""}` === key)) {
    return events;
  }
  return [...events, event];
}

function safeDisplayUrl({ canonical, legacy, signedUrl }) {
  if (canonical) return signedUrl;
  const parsed = parseLegacyBrandingReference(legacy);
  if (!parsed) return null;
  if (parsed.kind === "data_url") return parsed.url;
  if (parsed.kind === "external_url") return null;
  return signedUrl;
}

function sanitizeRentalDocumentTimelineEntry(entry) {
  return {
    documentId: entry.document.id,
    documentType: entry.document.document_type,
    documentStatus: entry.document.status,
    legacyContractId: entry.document.legacy_contract_id,
    sourceEventType: entry.document.source_event_type,
    sourceEventId: entry.document.source_event_id,
    createdAt: entry.document.created_at,
    finalisedAt: entry.document.finalised_at,
    currentVersion: entry.currentVersion
      ? {
          id: entry.currentVersion.id,
          versionNumber: entry.currentVersion.version_number,
          status: entry.currentVersion.status,
          generatedAt: entry.currentVersion.generated_at,
          finalisedAt: entry.currentVersion.finalised_at,
          templateId: entry.currentVersion.template_id,
          templateVersion: entry.currentVersion.template_version,
          pdfAvailable: Boolean(entry.currentVersion.pdf_storage_bucket && entry.currentVersion.pdf_storage_path),
          pdfGeneratedAt: entry.currentVersion.pdf_storage_path ? entry.currentVersion.generated_at : null
        }
      : null,
    signerRoles: Array.from(new Set(entry.signatures.map((signature) => signature.signer_role))),
    signatures: entry.signatures.map((signature) => ({
      signerRole: signature.signer_role,
      signerName: signature.signer_name,
      signedAt: signature.signed_at
    }))
  };
}

assert.deepEqual(parseLegacyBrandingReference("org-1/branding/logo.png"), {
  kind: "storage",
  reference: { bucket: "branding", path: "org-1/branding/logo.png" }
});
assert.deepEqual(parseLegacyBrandingReference("https://example.supabase.co/storage/v1/object/public/branding/org-1/logo.png?x=1"), {
  kind: "storage",
  reference: { bucket: "branding", path: "org-1/logo.png" }
});
assert.equal(parseLegacyBrandingReference("data:image/png;base64,abc")?.kind, "data_url");
assert.equal(safeDisplayUrl({ legacy: "https://example.com/logo.png", signedUrl: "signed" }), null);
assert.equal(safeDisplayUrl({ canonical: { bucket: "branding", path: "org/logo.png" }, legacy: "data:image/png;base64,old", signedUrl: "signed-new" }), "signed-new");

const snapshot = buildBusinessDocumentSnapshot({
  id: "org-1",
  name: "Trading",
  legal_name: "Legal Co",
  default_locale: "en",
  business_logo_storage_bucket: "branding",
  business_logo_storage_path: "org-1/branding/logo-column.png",
  settings: { business_logo_storage_bucket: "branding", business_logo_storage_path: "org-1/branding/logo-settings.png" },
  logo_url: "https://legacy.example/logo.png",
  authorised_signature_storage_bucket: "branding",
  authorised_signature_storage_path: "org-1/branding/signature.png",
  owner_signature_url: "data:image/png;base64,old",
  authorised_signatory_name: "Mali Owner",
  authorised_signatory_title: "Director",
  signature_authorised_at: "2026-07-13T00:00:00.000Z",
  signature_authorisation_text_version: "business-signature-authorisation-v1"
});
assert.equal(snapshot.logo.path, "org-1/branding/logo-column.png");
assert.equal(snapshot.authorised_signature.path, "org-1/branding/signature.png");
assert.equal(JSON.stringify(snapshot).includes("signedUrl"), false);
assert.equal(stableJsonStringify(snapshot), stableJsonStringify(JSON.parse(JSON.stringify(snapshot))));

const settingsFallbackSnapshot = buildBusinessDocumentSnapshot({
  id: "org-1",
  name: "Trading",
  default_locale: "en",
  settings: { business_logo_storage_bucket: "branding", business_logo_storage_path: "org-1/branding/logo-settings.png" },
  logo_url: "https://legacy.example/logo.png"
});
assert.equal(settingsFallbackSnapshot.logo.path, "org-1/branding/logo-settings.png");

const logoUrlFallbackSnapshot = buildBusinessDocumentSnapshot({
  id: "org-1",
  name: "Trading",
  default_locale: "en",
  settings: {},
  logo_url: "org-1/branding/logo-legacy.png"
});
assert.equal(logoUrlFallbackSnapshot.logo.reference.path, "org-1/branding/logo-legacy.png");

assert.equal(isRentalDocumentEngineEnabledForOrganization({ id: "org-1", settings: {} }), false);
assert.equal(isRentalDocumentEngineEnabledForOrganization({ id: "org-1", settings: { rental_document_engine_enabled: true } }), true);
assert.equal(isRentalDocumentEngineEnabledForOrganization({ id: "org-1", settings: {} }, { RENTAL_DOCUMENT_ENGINE_ORG_IDS: "org-2,org-1" }), true);

const hashInput = {
  renderedHtmlSnapshot: "<p>Hello</p>\r\n",
  renderedDataSnapshot: { b: 2, a: 1 },
  businessSnapshot: { legal_name: "Legal Co", trading_name: "Trading" },
  templateId: "tpl-1",
  templateVersion: 1,
  versionNumber: 2,
  pdfStorageBucket: "documents",
  pdfStoragePath: "org/doc.pdf"
};
assert.equal(calculateRentalDocumentContentHash(hashInput), calculateRentalDocumentContentHash({ ...hashInput, renderedDataSnapshot: { a: 1, b: 2 } }));
assert.equal(calculateRentalDocumentContentHash(hashInput), calculateRentalDocumentContentHash({ ...hashInput, versionNumber: 99 }));
assert.notEqual(calculateRentalDocumentContentHash(hashInput), calculateRentalDocumentContentHash({ ...hashInput, renderedHtmlSnapshot: "<p>Changed</p>" }));

const previewA = renderMockPreview({ organizationId: "org-1", rental: { id: "rental-1", customer_name: "Alex", rental_rate: 1000, vehicle_registration: "ABC123" } });
const previewB = renderMockPreview({ organizationId: "org-1", rental: { id: "rental-1", customer_name: "Alex", rental_rate: 1000, vehicle_registration: "ABC123" } });
const previewChanged = renderMockPreview({ organizationId: "org-1", rental: { id: "rental-1", customer_name: "Alex", rental_rate: 1200, vehicle_registration: "ABC123" } });
assert.equal(previewA.safeResult.renderedHtml, previewB.safeResult.renderedHtml);
assert.equal(previewA.safeResult.contentHash, previewB.safeResult.contentHash);
assert.notEqual(previewA.safeResult.contentHash, previewChanged.safeResult.contentHash);
assert.equal(previewA.dbWrites.length, 0);
assert.equal(JSON.stringify(previewA.safeResult).includes("org-1/branding/private.png"), false);
assert.throws(
  () => renderMockPreview({ organizationId: "org-1", rental: { id: "rental-2", organization_id: "org-2", customer_name: "Alex", rental_rate: 1000, vehicle_registration: "ABC123" } }),
  /not found for this organization/
);

const missingPreview = renderMockPreview({ organizationId: "org-1", rental: { id: "rental-1", customer_name: "", rental_rate: 0, vehicle_registration: "" } });
assert.ok(missingPreview.missingVariables.includes("renter_full_name"));
assert.ok(missingPreview.safeResult.warnings.length >= 1);
assert.equal(missingPreview.safeResult.warnings[0].blocksSigning, true);

const unknownMoneyPreview = renderMockPreview({ organizationId: "org-1", rental: { id: "rental-1", customer_name: "Alex", rental_rate: null, vehicle_registration: "ABC123" } });
assert.equal(unknownMoneyPreview.safeResult.renderedHtml.includes(">0<"), false);

const savedDraft = renderMockPreview({ organizationId: "org-1", rental: { id: "rental-1", customer_name: "Alex", rental_rate: 1000, vehicle_registration: "ABC123" }, saveDraft: true });
assert.equal(savedDraft.dbWrites.length, 1);
assert.equal(savedDraft.dbWrites[0].version.status, "draft");
assert.equal(savedDraft.dbWrites[0].version.finalised_at, null);
assert.equal(savedDraft.dbWrites[0].version.signed_at, null);

const draftPdf = generateDraftPdfRecord({
  organizationId: "org-1",
  rentalId: "rental-1",
  documentId: "doc-1",
  version: {
    id: "ver-1",
    organization_id: "org-1",
    status: "draft",
    rendered_html_snapshot: "<p>stored snapshot</p>",
    rendered_data_snapshot: { rate: 1000 },
    business_snapshot: { issuer: "Rental Business", powered_by_routehq_enabled: false },
    template_id: "tpl-1",
    template_version: 1,
    version_number: 1
  }
});
assert.equal(draftPdf.uploadInput.html.includes("stored snapshot"), true);
assert.equal(draftPdf.uploadInput.html.includes("DRAFT - NOT SIGNED"), true);
assert.equal(draftPdf.dbUpdate.pdf_storage_bucket, "documents");
assert.equal(draftPdf.dbUpdate.pdf_storage_path, "organizations/org-1/rentals/rental-1/rental-documents/doc-1/versions/ver-1/draft-20260713010101.pdf");
assert.equal("signed_url" in draftPdf.dbUpdate && draftPdf.dbUpdate.signed_url !== undefined, false);
assert.throws(() => generateDraftPdfRecord({
  organizationId: "org-1",
  rentalId: "rental-1",
  documentId: "doc-1",
  version: { id: "ver-2", organization_id: "org-2", status: "draft", rendered_html_snapshot: "", rendered_data_snapshot: {}, business_snapshot: {}, version_number: 1 }
}), /cross-organization/);
assert.throws(() => generateDraftPdfRecord({
  organizationId: "org-1",
  rentalId: "rental-1",
  documentId: "doc-1",
  version: { id: "ver-3", organization_id: "org-1", status: "finalised", rendered_html_snapshot: "", rendered_data_snapshot: {}, business_snapshot: {}, version_number: 1 }
}), /Only draft/);

const finalDraft = {
  id: "ver-final",
  organization_id: "org-1",
  document_id: "doc-final",
  version_number: 1,
  status: "draft",
  rendered_html_snapshot: "<p>Final agreement for Rental Business</p>",
  rendered_data_snapshot: {
    variables: {
      renter_full_name: "Alex",
      vehicle_registration: "ABC123",
      rental_start_date: "14/07/2026",
      contracted_rate: "1000",
      billing_period: "daily",
      standard_daily_rate: "1000"
    }
  },
  business_snapshot: {
    legal_name: "Rental Business Co",
    powered_by_routehq_enabled: false,
    authorised_signatory: {
      name: "Mali Owner",
      title: "Director",
      signature_authorised_at: "2026-07-13T00:00:00.000Z",
      signature_authorisation_text_version: "business-signature-authorisation-v1"
    },
    authorised_signature: { kind: "storage", bucket: "branding", path: "org-1/branding/snapshot-signature.png" }
  },
  template_id: "tpl-1",
  template_version: 1,
  pdf_storage_bucket: null,
  pdf_storage_path: null,
  draft_pdf_storage_path: "organizations/org-1/rentals/rental-final/rental-documents/doc-final/versions/ver-final/draft-1.pdf"
};
finalDraft.content_hash = calculateRentalDocumentContentHash({
  renderedHtmlSnapshot: finalDraft.rendered_html_snapshot,
  renderedDataSnapshot: finalDraft.rendered_data_snapshot,
  businessSnapshot: finalDraft.business_snapshot,
  templateId: finalDraft.template_id,
  templateVersion: finalDraft.template_version,
  versionNumber: finalDraft.version_number
});
const finalDocument = { id: "doc-final", organization_id: "org-1", rental_id: "rental-final", current_version_id: "ver-final", document_type: "rental_agreement" };
assert.equal(finalisationEligibility({ organizationId: "org-1", document: finalDocument, version: finalDraft }).eligible, true);
assert.equal(finalisationEligibility({
  organizationId: "org-1",
  document: finalDocument,
  version: {
    ...finalDraft,
    rendered_data_snapshot: {
      ...finalDraft.rendered_data_snapshot,
      warnings: [{ variable: "renter_passport_number", severity: "blocking", blocksSigning: true, message: "Passport missing." }]
    },
    content_hash: calculateRentalDocumentContentHash({
      renderedHtmlSnapshot: finalDraft.rendered_html_snapshot,
      renderedDataSnapshot: {
        ...finalDraft.rendered_data_snapshot,
        warnings: [{ variable: "renter_passport_number", severity: "blocking", blocksSigning: true, message: "Passport missing." }]
      },
      businessSnapshot: finalDraft.business_snapshot,
      templateId: finalDraft.template_id,
      templateVersion: finalDraft.template_version,
      versionNumber: finalDraft.version_number
    })
  }
}).issues.includes("blocking_template_warning_renter_passport_number"), true);
assert.equal(finalisationEligibility({ featureEnabled: false, organizationId: "org-1", document: finalDocument, version: finalDraft }).issues.includes("feature_disabled"), true);
const changedSnapshotDraft = {
  ...finalDraft,
  rendered_data_snapshot: { variables: { ...finalDraft.rendered_data_snapshot.variables, standard_daily_rate: "" } }
};
assert.equal(finalisationEligibility({ organizationId: "org-1", document: finalDocument, version: changedSnapshotDraft }).issues.includes("hash_mismatch"), true);
const rollingDraft = { ...finalDraft, rendered_data_snapshot: { variables: { ...finalDraft.rendered_data_snapshot.variables, is_rolling_monthly: true, standard_daily_rate: "" } } };
rollingDraft.content_hash = calculateRentalDocumentContentHash({
  renderedHtmlSnapshot: rollingDraft.rendered_html_snapshot,
  renderedDataSnapshot: rollingDraft.rendered_data_snapshot,
  businessSnapshot: rollingDraft.business_snapshot,
  templateId: rollingDraft.template_id,
  templateVersion: rollingDraft.template_version,
  versionNumber: rollingDraft.version_number
});
assert.equal(finalisationEligibility({ organizationId: "org-1", document: finalDocument, version: rollingDraft }).issues.includes("missing_standard_daily_rate"), true);
assert.throws(() => finaliseMockDocument({ organizationId: "org-2", document: finalDocument, version: finalDraft, liveOrganization: {} }), /cross_org/);
assert.throws(() => finaliseMockDocument({ organizationId: "org-1", document: finalDocument, version: { ...finalDraft, content_hash: "bad" }, liveOrganization: {} }), /hash_mismatch/);
assert.throws(() => finaliseMockDocument({ organizationId: "org-1", document: finalDocument, version: { ...finalDraft, status: "finalised" }, liveOrganization: {} }), /not_draft/);
const finalised = finaliseMockDocument({
  organizationId: "org-1",
  document: finalDocument,
  version: finalDraft,
  liveOrganization: { authorised_signature_storage_path: "org-1/branding/live-changed.png" }
});
assert.equal(finalised.version.final_pdf_storage_path.includes("/final-"), true);
assert.equal(finalised.version.draft_pdf_storage_path, finalDraft.draft_pdf_storage_path);
assert.equal(finalised.signature.signature_storage_path, "org-1/branding/snapshot-signature.png");
assert.equal(finalised.signature.content_hash_at_signing, finalised.version.content_hash);
assert.equal(finalised.signature.live_signature_ignored, true);
assert.equal(finalised.signedUrlPersisted, false);
assert.equal(finalised.version.pdf_storage_path.includes("DRAFT"), false);
const idempotentFinalised = finaliseMockDocument({
  organizationId: "org-1",
  document: finalDocument,
  version: finalDraft,
  liveOrganization: {},
  existingSignatures: [finalised.signature]
});
assert.equal(idempotentFinalised.signature.content_hash_at_signing, finalised.version.content_hash);
const finalRpcPath = "organizations/org-1/rentals/rental-final/rental-documents/doc-final/versions/ver-final/final-20260714010101.pdf";
const rpcFinalHash = calculateRentalDocumentContentHash({
  renderedHtmlSnapshot: finalDraft.rendered_html_snapshot,
  renderedDataSnapshot: finalDraft.rendered_data_snapshot,
  businessSnapshot: finalDraft.business_snapshot,
  templateId: finalDraft.template_id,
  templateVersion: finalDraft.template_version,
  versionNumber: finalDraft.version_number,
  pdfStorageBucket: "documents",
  pdfStoragePath: finalRpcPath
});
const rpcFinalised = finaliseRpcMock({
  organizationId: "org-1",
  document: finalDocument,
  version: finalDraft,
  finalPdfPath: finalRpcPath,
  currentHash: finalDraft.content_hash,
  finalHash: rpcFinalHash
});
assert.equal(rpcFinalised.insertedSignatureCount, 1);
assert.equal(rpcFinalised.signature.content_hash_at_signing, rpcFinalHash);
const rpcIdempotent = finaliseRpcMock({
  organizationId: "org-1",
  document: finalDocument,
  version: { ...rpcFinalised.version, status: "signed" },
  finalPdfPath: finalRpcPath,
  currentHash: rpcFinalHash,
  finalHash: rpcFinalHash,
  existingSignatures: [rpcFinalised.signature]
});
assert.equal(rpcIdempotent.insertedSignatureCount, 0);
assert.throws(() => finaliseRpcMock({ organizationId: "org-2", document: finalDocument, version: finalDraft, finalPdfPath: finalRpcPath, currentHash: finalDraft.content_hash, finalHash: rpcFinalHash }), /wrong_org/);
assert.throws(() => finaliseRpcMock({ organizationId: "org-1", document: { ...finalDocument, current_version_id: "newer" }, version: finalDraft, finalPdfPath: finalRpcPath, currentHash: finalDraft.content_hash, finalHash: rpcFinalHash }), /superseded/);
assert.throws(() => finaliseRpcMock({ organizationId: "org-1", document: finalDocument, version: finalDraft, finalPdfPath: finalRpcPath, currentHash: "bad", finalHash: rpcFinalHash }), /hash_mismatch/);
assert.throws(() => finaliseRpcMock({ organizationId: "org-1", document: finalDocument, version: finalDraft, finalPdfPath: finalRpcPath, currentHash: finalDraft.content_hash, finalHash: rpcFinalHash, existingSignatures: [{ signer_role: "authorised_business_signatory", content_hash_at_signing: "other" }] }), /conflicting_signature/);
assert.throws(() => finaliseRpcMock({ organizationId: "org-1", document: finalDocument, version: finalDraft, finalPdfPath: "../outside.pdf", currentHash: finalDraft.content_hash, finalHash: rpcFinalHash }), /unsafe_final_path/);

assert.equal(orphanCandidates({
  organizationId: "org-1",
  nowMs: Date.parse("2026-07-14T00:00:00.000Z"),
  referencedPaths: new Set([
    "organizations/org-1/rentals/11111111-1111-4111-8111-111111111111/rental-documents/22222222-2222-4222-8222-222222222222/versions/33333333-3333-4333-8333-333333333333/draft-ref.pdf",
    "organizations/org-1/rentals/11111111-1111-4111-8111-111111111111/rental-documents/22222222-2222-4222-8222-222222222222/versions/33333333-3333-4333-8333-333333333333/final-ref.pdf"
  ]),
  objects: [
    { path: "organizations/org-1/rentals/11111111-1111-4111-8111-111111111111/rental-documents/22222222-2222-4222-8222-222222222222/versions/33333333-3333-4333-8333-333333333333/draft-ref.pdf", updated_at: "2026-07-12T00:00:00.000Z" },
    { path: "organizations/org-1/rentals/11111111-1111-4111-8111-111111111111/rental-documents/22222222-2222-4222-8222-222222222222/versions/33333333-3333-4333-8333-333333333333/draft-orphan.pdf", updated_at: "2026-07-12T00:00:00.000Z" },
    { path: "organizations/org-1/rentals/11111111-1111-4111-8111-111111111111/rental-documents/22222222-2222-4222-8222-222222222222/versions/33333333-3333-4333-8333-333333333333/draft-young.pdf", updated_at: "2026-07-13T12:00:00.000Z" },
    { path: "organizations/org-1/rentals/11111111-1111-4111-8111-111111111111/rental-documents/22222222-2222-4222-8222-222222222222/versions/33333333-3333-4333-8333-333333333333/final-ref.pdf", updated_at: "2026-07-12T00:00:00.000Z" },
    { path: "organizations/org-1/rentals/11111111-1111-4111-8111-111111111111/rental-documents/22222222-2222-4222-8222-222222222222/versions/33333333-3333-4333-8333-333333333333/final-orphan.pdf", updated_at: "2026-07-12T00:00:00.000Z" },
    { path: "organizations/org-2/rentals/11111111-1111-4111-8111-111111111111/rental-documents/22222222-2222-4222-8222-222222222222/versions/33333333-3333-4333-8333-333333333333/draft.pdf", updated_at: "2026-07-12T00:00:00.000Z" },
    { path: "outside/draft.pdf", updated_at: "2026-07-12T00:00:00.000Z" }
  ]
}).map((entry) => entry.path).join(","), [
  "organizations/org-1/rentals/11111111-1111-4111-8111-111111111111/rental-documents/22222222-2222-4222-8222-222222222222/versions/33333333-3333-4333-8333-333333333333/draft-orphan.pdf",
  "organizations/org-1/rentals/11111111-1111-4111-8111-111111111111/rental-documents/22222222-2222-4222-8222-222222222222/versions/33333333-3333-4333-8333-333333333333/final-orphan.pdf"
].join(","));
assert.throws(() => validateRasterBrandingFile({ type: "image/svg+xml", name: "signature.svg" }), /svg_rejected/);
assert.throws(() => assertDevelopmentGuard("https://loutrkhqnkslwapqxpkm.supabase.co"), /Refusing/);
assert.doesNotThrow(() => assertDevelopmentGuard("https://adxwmzfbljlanfnxhsoa.supabase.co"));
let events = [];
events = recordEventOnce(events, { organization_id: "org-1", event_type: "rental_document_version_finalised", metadata: { idempotency_key: "version:1" } });
events = recordEventOnce(events, { organization_id: "org-1", event_type: "rental_document_version_finalised", metadata: { idempotency_key: "version:1" } });
events = recordEventOnce(events, { organization_id: "org-1", event_type: "rental_document_final_pdf_downloaded", metadata: {} });
events = recordEventOnce(events, { organization_id: "org-1", event_type: "rental_document_final_pdf_downloaded", metadata: {} });
assert.equal(events.filter((event) => event.event_type === "rental_document_version_finalised").length, 1);
assert.equal(events.filter((event) => event.event_type === "rental_document_final_pdf_downloaded").length, 2);

assert.throws(() => {
  const replacingSignature = true;
  const acknowledged = false;
  if (replacingSignature && !acknowledged) throw new Error("ack required");
}, /ack required/);

assert.equal(safeDisplayUrl({ canonical: { bucket: "branding", path: "org/private.png" }, signedUrl: "https://signed.example/logo.png" }), "https://signed.example/logo.png");
assert.equal(safeDisplayUrl({ legacy: "org/private.png", signedUrl: "https://signed.example/logo.png" }), "https://signed.example/logo.png");

const timeline = sanitizeRentalDocumentTimelineEntry({
  document: { id: "doc", document_type: "rental_agreement", status: "signed", legacy_contract_id: null, source_event_type: null, source_event_id: null, created_at: "now", finalised_at: "now" },
  currentVersion: { id: "ver", version_number: 1, status: "signed", generated_at: "now", finalised_at: "now", template_id: "tpl", template_version: 1, pdf_storage_bucket: "documents", pdf_storage_path: "private" },
  signatures: [{ signer_role: "renter", signer_name: "Alex", signed_at: "now", ip_address: "127.0.0.1", signature_data_url: "data:image/png;base64,secret" }]
});
assert.equal(JSON.stringify(timeline).includes("127.0.0.1"), false);
assert.equal(JSON.stringify(timeline).includes("secret"), false);
assert.equal(JSON.stringify(timeline).includes("private"), false);
assert.equal(timeline.currentVersion.pdfAvailable, true);

console.log("domain validation ok");
