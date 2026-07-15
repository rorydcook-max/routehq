import { createHash } from "node:crypto";
import type { Json, TableRow } from "@/lib/supabase/database.types";
import { recordActivityEvent, recordActivityEventOnce } from "@/lib/supabase/activity";

export const rentalDocumentTypes = [
  "rental_agreement",
  "agreement_amendment",
  "delivery_report",
  "return_report",
  "vehicle_substitution",
  "extension_amendment",
  "early_termination_statement",
  "incident_report",
  "deposit_reconciliation",
  "final_rental_pack"
] as const;

export const rentalDocumentSignerRoles = [
  "authorised_business_signatory",
  "operator",
  "renter",
  "additional_driver",
  "witness"
] as const;

export const rentalDocumentStatuses = ["draft", "rendered", "finalised", "partially_signed", "signed", "void"] as const;

export const rentalDocumentVersionStatuses = ["draft", "rendered", "finalised", "signed", "void"] as const;

export type RentalDocumentType = (typeof rentalDocumentTypes)[number];
export type RentalDocumentSignerRole = (typeof rentalDocumentSignerRoles)[number];
export type RentalDocumentStatus = (typeof rentalDocumentStatuses)[number];
export type RentalDocumentVersionStatus = (typeof rentalDocumentVersionStatuses)[number];
export type RentalDocument = TableRow<"rental_documents">;
export type RentalDocumentVersion = TableRow<"rental_document_versions">;
export type RentalDocumentSignature = TableRow<"rental_document_signatures">;

export type RenderedSnapshot = Record<string, unknown>;
export type BusinessSnapshot = Record<string, unknown>;

export type SupabaseQueryResult<T> = Promise<{ data: T | null; error: { code?: string; message: string } | null }>;

export type RentalDocumentSupabaseClient = {
  from: (table: string) => {
    select: (columns?: string) => any;
    insert: (values: Record<string, unknown> | Record<string, unknown>[]) => any;
    update: (values: Record<string, unknown>) => any;
  };
  rpc?: (fn: string, args: Record<string, unknown>) => any;
};

export type CreateRentalDocumentInput = {
  supabase: RentalDocumentSupabaseClient;
  organizationId: string;
  rentalId: string;
  documentType: RentalDocumentType | string;
  legacyContractId?: string | null;
  sourceEventType?: string | null;
  sourceEventId?: string | null;
  createdBy?: string | null;
};

export type CreateDraftDocumentVersionInput = {
  supabase: RentalDocumentSupabaseClient;
  organizationId: string;
  documentId: string;
  renderedHtmlSnapshot: string;
  renderedDataSnapshot: RenderedSnapshot;
  businessSnapshot: BusinessSnapshot;
  templateId?: string | null;
  templateVersion?: number | null;
  pdfStorageBucket?: string | null;
  pdfStoragePath?: string | null;
  draftPdfStorageBucket?: string | null;
  draftPdfStoragePath?: string | null;
  draftPdfGeneratedAt?: string | null;
  finalPdfStorageBucket?: string | null;
  finalPdfStoragePath?: string | null;
  finalPdfGeneratedAt?: string | null;
  supersedesVersionId?: string | null;
  generatedAt?: string | null;
  createdBy?: string | null;
};

export type RenderDocumentVersionInput = Omit<CreateDraftDocumentVersionInput, "documentId" | "supersedesVersionId" | "generatedAt"> & {
  versionId: string;
  status?: "draft" | "rendered";
};

export type SignDocumentVersionInput = {
  supabase: RentalDocumentSupabaseClient;
  organizationId: string;
  documentVersionId: string;
  signerRole: RentalDocumentSignerRole | string;
  signerName: string;
  signerUserId?: string | null;
  signatureStorageBucket?: string | null;
  signatureStoragePath?: string | null;
  signatureDataUrl?: string | null;
  signedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  verificationMethod?: string | null;
  consentTextVersion?: string | null;
  contentHashAtSigning?: string | null;
  metadata?: Record<string, unknown>;
};

export type RentalDocumentTimelineEntry = {
  documentId: string;
  documentType: RentalDocumentType | string;
  documentStatus: string;
  legacyContractId: string | null;
  sourceEventType: string | null;
  sourceEventId: string | null;
  createdAt: string;
  finalisedAt: string | null;
  currentVersion: {
    id: string;
    versionNumber: number;
    status: string;
    generatedAt: string;
    finalisedAt: string | null;
    templateId: string | null;
    templateVersion: number | null;
    pdfAvailable: boolean;
    pdfGeneratedAt: string | null;
    draftPdfAvailable: boolean;
    draftPdfGeneratedAt: string | null;
    finalPdfAvailable: boolean;
    finalPdfGeneratedAt: string | null;
  } | null;
  signerRoles: string[];
  signatures: Array<{
    signerRole: string;
    signerName: string;
    signedAt: string;
  }>;
};

function assertNonEmpty(value: string, label: string) {
  if (!value.trim()) {
    throw new Error(`${label} is required.`);
  }
}

export function isRentalDocumentType(value: string): value is RentalDocumentType {
  return (rentalDocumentTypes as readonly string[]).includes(value);
}

export function assertRentalDocumentType(value: string): asserts value is RentalDocumentType {
  if (!isRentalDocumentType(value)) {
    throw new Error(`Unsupported rental document type: ${value}`);
  }
}

export function isRentalDocumentSignerRole(value: string): value is RentalDocumentSignerRole {
  return (rentalDocumentSignerRoles as readonly string[]).includes(value);
}

export function assertRentalDocumentSignerRole(value: string): asserts value is RentalDocumentSignerRole {
  if (!isRentalDocumentSignerRole(value)) {
    throw new Error(`Unsupported signer role: ${value}`);
  }
}

export function isRentalDocumentStatus(value: string): value is RentalDocumentStatus {
  return (rentalDocumentStatuses as readonly string[]).includes(value);
}

export function isRentalDocumentVersionStatus(value: string): value is RentalDocumentVersionStatus {
  return (rentalDocumentVersionStatuses as readonly string[]).includes(value);
}

export function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .filter((key) => objectValue[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(objectValue[key])}`)
    .join(",")}}`;
}

function normalizeHtml(html: string) {
  return html.replace(/\r\n/g, "\n").trim();
}

export function calculateRentalDocumentContentHash(input: {
  renderedHtmlSnapshot: string;
  renderedDataSnapshot: RenderedSnapshot;
  businessSnapshot: BusinessSnapshot;
  templateId?: string | null;
  templateVersion?: number | null;
  // Version number is accepted for compatibility with older callers, but it is
  // intentionally excluded from the hash. The hash represents immutable document
  // content/snapshots; version numbering is lifecycle metadata allocated by DB.
  versionNumber?: number | null;
  pdfStorageBucket?: string | null;
  pdfStoragePath?: string | null;
}) {
  return createHash("sha256")
    .update(
      stableJsonStringify({
        business_snapshot: input.businessSnapshot,
        pdf_storage_bucket: input.pdfStorageBucket || null,
        pdf_storage_path: input.pdfStoragePath || null,
        rendered_data_snapshot: input.renderedDataSnapshot,
        rendered_html_snapshot: normalizeHtml(input.renderedHtmlSnapshot),
        template_id: input.templateId || null,
        template_version: input.templateVersion ?? null
      })
    )
    .digest("hex");
}

async function maybeSingle<T>(query: any): SupabaseQueryResult<T> {
  return query.maybeSingle();
}

async function single<T>(query: any): SupabaseQueryResult<T> {
  return query.single();
}

async function requireRental(supabase: RentalDocumentSupabaseClient, organizationId: string, rentalId: string) {
  const { data, error } = await maybeSingle<{ id: string; vehicle_id: string | null; customer_id: string | null }>(
    supabase
      .from("rentals")
      .select("id, vehicle_id, customer_id")
      .eq("id", rentalId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
  );
  if (error || !data) {
    throw new Error(error?.message || "Rental was not found for this organization.");
  }
  return data;
}

async function requireLegacyContract(supabase: RentalDocumentSupabaseClient, organizationId: string, contractId: string) {
  const { data, error } = await maybeSingle<{ id: string }>(
    supabase
      .from("contracts")
      .select("id")
      .eq("id", contractId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
  );
  if (error || !data) {
    throw new Error(error?.message || "Legacy contract was not found for this organization.");
  }
  return data;
}

async function requireDocument(supabase: RentalDocumentSupabaseClient, organizationId: string, documentId: string) {
  const { data, error } = await maybeSingle<RentalDocument>(
    supabase
      .from("rental_documents")
      .select("*")
      .eq("id", documentId)
      .eq("organization_id", organizationId)
  );
  if (error || !data) {
    throw new Error(error?.message || "Rental document was not found for this organization.");
  }
  return data;
}

async function requireVersion(supabase: RentalDocumentSupabaseClient, organizationId: string, versionId: string) {
  const { data, error } = await maybeSingle<RentalDocumentVersion>(
    supabase
      .from("rental_document_versions")
      .select("*")
      .eq("id", versionId)
      .eq("organization_id", organizationId)
  );
  if (error || !data) {
    throw new Error(error?.message || "Rental document version was not found for this organization.");
  }
  return data;
}

async function recordDocumentActivity({
  supabase,
  organizationId,
  actorId,
  document,
  versionId,
  eventType,
  title,
  detail,
  metadata = {},
  idempotencyKey
}: {
  supabase: RentalDocumentSupabaseClient;
  organizationId: string;
  actorId?: string | null;
  document: RentalDocument;
  versionId?: string | null;
  eventType: string;
  title: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string | null;
}) {
  const rental = await requireRental(supabase, organizationId, document.rental_id);
  const payload = {
    organization_id: organizationId,
    actor_id: actorId || null,
    entity_type: "document",
    entity_id: document.id,
    vehicle_id: rental.vehicle_id,
    rental_id: document.rental_id,
    customer_id: rental.customer_id,
    event_type: eventType,
    title,
    detail: detail || null,
    metadata: {
      ...metadata,
      document_id: document.id,
      document_type: document.document_type,
      version_id: versionId || null
    }
  };
  if (idempotencyKey) {
    await recordActivityEventOnce(supabase, payload, idempotencyKey);
  } else {
    await recordActivityEvent(supabase, payload);
  }
}

export async function createRentalDocument(input: CreateRentalDocumentInput) {
  const documentType = String(input.documentType);
  assertRentalDocumentType(documentType);
  assertNonEmpty(input.organizationId, "organizationId");
  assertNonEmpty(input.rentalId, "rentalId");

  await requireRental(input.supabase, input.organizationId, input.rentalId);
  if (input.legacyContractId) {
    await requireLegacyContract(input.supabase, input.organizationId, input.legacyContractId);
  }

  const { data, error } = await single<RentalDocument>(
    input.supabase
      .from("rental_documents")
      .insert({
        organization_id: input.organizationId,
        rental_id: input.rentalId,
        legacy_contract_id: input.legacyContractId || null,
        document_type: documentType,
        source_event_type: input.sourceEventType || null,
        source_event_id: input.sourceEventId || null,
        created_by: input.createdBy || null
      })
      .select("*")
  );

  if (error || !data) {
    throw new Error(error?.message || "Unable to create rental document.");
  }

  await recordDocumentActivity({
    supabase: input.supabase,
    organizationId: input.organizationId,
    actorId: input.createdBy,
    document: data,
    eventType: "rental_document_created",
    title: "Rental document created",
    detail: `${documentType.replace(/_/g, " ")} document created.`,
    idempotencyKey: `rental_document_created:${data.id}`
  });

  return data;
}

export async function createDraftDocumentVersion(input: CreateDraftDocumentVersionInput) {
  const document = await requireDocument(input.supabase, input.organizationId, input.documentId);
  if (input.supersedesVersionId) {
    const superseded = await requireVersion(input.supabase, input.organizationId, input.supersedesVersionId);
    if (superseded.document_id !== input.documentId) {
      throw new Error("Superseded version must belong to the same document.");
    }
  }

  if (!input.supabase.rpc) {
    throw new Error("Transactional draft version RPC is unavailable.");
  }

  const contentHash = calculateRentalDocumentContentHash({
    renderedHtmlSnapshot: input.renderedHtmlSnapshot,
    renderedDataSnapshot: input.renderedDataSnapshot,
    businessSnapshot: input.businessSnapshot,
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    pdfStorageBucket: input.pdfStorageBucket,
    pdfStoragePath: input.pdfStoragePath
  });

  const { data, error } = await input.supabase
    .rpc("create_rental_document_draft_version", {
      p_organization_id: input.organizationId,
      p_document_id: input.documentId,
      p_rendered_html_snapshot: input.renderedHtmlSnapshot,
      p_rendered_data_snapshot: input.renderedDataSnapshot as Json,
      p_business_snapshot: input.businessSnapshot as Json,
      p_content_hash: contentHash,
      p_template_id: input.templateId || null,
      p_template_version: input.templateVersion ?? null,
      p_pdf_storage_bucket: input.pdfStorageBucket || null,
      p_pdf_storage_path: input.pdfStoragePath || null,
      p_draft_pdf_storage_bucket: input.draftPdfStorageBucket || null,
      p_draft_pdf_storage_path: input.draftPdfStoragePath || null,
      p_draft_pdf_generated_at: input.draftPdfGeneratedAt || null,
      p_final_pdf_storage_bucket: input.finalPdfStorageBucket || null,
      p_final_pdf_storage_path: input.finalPdfStoragePath || null,
      p_final_pdf_generated_at: input.finalPdfGeneratedAt || null,
      p_supersedes_version_id: input.supersedesVersionId || null,
      p_generated_at: input.generatedAt || null,
      p_created_by: input.createdBy || null
    })
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create rental document version.");
  }

  const version = data as RentalDocumentVersion;
  await recordDocumentActivity({
    supabase: input.supabase,
    organizationId: input.organizationId,
    actorId: input.createdBy,
    document,
    versionId: version.id,
    eventType: "rental_document_version_created",
    title: "Rental document version created",
    detail: `Version ${version.version_number} created.`,
    idempotencyKey: `rental_document_version_created:${version.id}`
  });
  return version;
}

export async function renderRentalDocumentVersion(input: RenderDocumentVersionInput) {
  const version = await requireVersion(input.supabase, input.organizationId, input.versionId);
  const document = await requireDocument(input.supabase, input.organizationId, version.document_id);
  if (version.finalised_at || ["finalised", "signed"].includes(version.status)) {
    throw new Error("Finalised document versions cannot be re-rendered.");
  }

  const contentHash = calculateRentalDocumentContentHash({
    renderedHtmlSnapshot: input.renderedHtmlSnapshot,
    renderedDataSnapshot: input.renderedDataSnapshot,
    businessSnapshot: input.businessSnapshot,
    templateId: input.templateId,
    templateVersion: input.templateVersion,
    versionNumber: version.version_number,
    pdfStorageBucket: input.pdfStorageBucket,
    pdfStoragePath: input.pdfStoragePath
  });

  const { data, error } = await single<RentalDocumentVersion>(
    input.supabase
      .from("rental_document_versions")
      .update({
        template_id: input.templateId || null,
        template_version: input.templateVersion ?? null,
        rendered_html_snapshot: input.renderedHtmlSnapshot,
        rendered_data_snapshot: input.renderedDataSnapshot as Json,
        business_snapshot: input.businessSnapshot as Json,
        pdf_storage_bucket: input.pdfStorageBucket || null,
        pdf_storage_path: input.pdfStoragePath || null,
        draft_pdf_storage_bucket: input.draftPdfStorageBucket ?? version.draft_pdf_storage_bucket,
        draft_pdf_storage_path: input.draftPdfStoragePath ?? version.draft_pdf_storage_path,
        draft_pdf_generated_at: input.draftPdfGeneratedAt ?? version.draft_pdf_generated_at,
        final_pdf_storage_bucket: input.finalPdfStorageBucket ?? version.final_pdf_storage_bucket,
        final_pdf_storage_path: input.finalPdfStoragePath ?? version.final_pdf_storage_path,
        final_pdf_generated_at: input.finalPdfGeneratedAt ?? version.final_pdf_generated_at,
        content_hash: contentHash,
        status: input.status || "rendered"
      })
      .eq("id", input.versionId)
      .eq("organization_id", input.organizationId)
      .select("*")
  );

  if (error || !data) {
    throw new Error(error?.message || "Unable to render rental document version.");
  }

  return { document, version: data };
}

export async function finaliseDocumentVersion(input: {
  supabase: RentalDocumentSupabaseClient;
  organizationId: string;
  documentVersionId: string;
  finalisedBy?: string | null;
}) {
  const version = await requireVersion(input.supabase, input.organizationId, input.documentVersionId);
  const document = await requireDocument(input.supabase, input.organizationId, version.document_id);
  if (version.finalised_at || ["finalised", "signed"].includes(version.status)) {
    throw new Error("Document version is already finalised.");
  }
  if (!version.rendered_html_snapshot || !version.content_hash) {
    throw new Error("Rendered snapshots and content hash are required before finalisation.");
  }

  const finalisedAt = new Date().toISOString();
  const { data, error } = await single<RentalDocumentVersion>(
    input.supabase
      .from("rental_document_versions")
      .update({
        status: "finalised",
        finalised_at: finalisedAt
      })
      .eq("id", input.documentVersionId)
      .eq("organization_id", input.organizationId)
      .select("*")
  );

  if (error || !data) {
    throw new Error(error?.message || "Unable to finalise rental document version.");
  }

  const { error: documentError } = await input.supabase
    .from("rental_documents")
    .update({
      current_version_id: data.id,
      status: "finalised",
      finalised_at: finalisedAt
    })
    .eq("id", document.id)
    .eq("organization_id", input.organizationId);
  if (documentError) {
    throw new Error(documentError.message);
  }

  await recordDocumentActivity({
    supabase: input.supabase,
    organizationId: input.organizationId,
    actorId: input.finalisedBy,
    document,
    versionId: data.id,
    eventType: "rental_document_version_finalised",
    title: "Rental document version finalised",
    detail: `Version ${data.version_number} finalised.`,
    idempotencyKey: `rental_document_version_finalised:${data.id}`
  });

  return data;
}

export async function signDocumentVersion(input: SignDocumentVersionInput) {
  const signerRole = String(input.signerRole);
  assertRentalDocumentSignerRole(signerRole);
  assertNonEmpty(input.signerName, "signerName");

  const version = await requireVersion(input.supabase, input.organizationId, input.documentVersionId);
  const document = await requireDocument(input.supabase, input.organizationId, version.document_id);
  if (!version.finalised_at && !["finalised", "signed"].includes(version.status)) {
    throw new Error("Only finalised document versions can be signed.");
  }
  if (input.contentHashAtSigning && input.contentHashAtSigning !== version.content_hash) {
    throw new Error("Signing hash does not match the document version content hash.");
  }

  const { data, error } = await single<RentalDocumentSignature>(
    input.supabase
      .from("rental_document_signatures")
      .insert({
        organization_id: input.organizationId,
        document_version_id: input.documentVersionId,
        signer_role: signerRole,
        signer_name: input.signerName,
        signer_user_id: input.signerUserId || null,
        signature_storage_bucket: input.signatureStorageBucket || null,
        signature_storage_path: input.signatureStoragePath || null,
        signature_data_url: input.signatureDataUrl || null,
        signed_at: input.signedAt || new Date().toISOString(),
        ip_address: input.ipAddress || null,
        user_agent: input.userAgent || null,
        verification_method: input.verificationMethod || null,
        consent_text_version: input.consentTextVersion || null,
        content_hash_at_signing: version.content_hash,
        metadata: (input.metadata || {}) as Json
      })
      .select("*")
  );

  if (error || !data) {
    throw new Error(error?.message || "Unable to sign rental document version.");
  }

  await Promise.all([
    input.supabase
      .from("rental_document_versions")
      .update({ status: "signed" })
      .eq("id", version.id)
      .eq("organization_id", input.organizationId),
    input.supabase
      .from("rental_documents")
      .update({ status: "partially_signed" })
      .eq("id", document.id)
      .eq("organization_id", input.organizationId)
  ]);

  await recordDocumentActivity({
    supabase: input.supabase,
    organizationId: input.organizationId,
    actorId: input.signerUserId,
    document,
    versionId: version.id,
    eventType: "rental_document_signed",
    title: "Rental document signed",
    detail: `${input.signerName} signed as ${signerRole.replace(/_/g, " ")}.`,
    metadata: { signer_role: signerRole },
    idempotencyKey: `rental_document_signed:${version.id}:${signerRole}`
  });

  return data;
}

export async function getRentalDocument(input: {
  supabase: RentalDocumentSupabaseClient;
  organizationId: string;
  documentId: string;
}) {
  return requireDocument(input.supabase, input.organizationId, input.documentId);
}

export async function getRentalDocumentVersion(input: {
  supabase: RentalDocumentSupabaseClient;
  organizationId: string;
  documentVersionId: string;
}) {
  return requireVersion(input.supabase, input.organizationId, input.documentVersionId);
}

export function sanitizeRentalDocumentTimelineEntry(entry: {
  document: RentalDocument;
  currentVersion: RentalDocumentVersion | null;
  signatures: RentalDocumentSignature[];
}): RentalDocumentTimelineEntry {
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
          pdfAvailable: Boolean(
            (entry.currentVersion.final_pdf_storage_bucket && entry.currentVersion.final_pdf_storage_path) ||
              (entry.currentVersion.pdf_storage_bucket && entry.currentVersion.pdf_storage_path)
          ),
          pdfGeneratedAt: entry.currentVersion.final_pdf_generated_at || (entry.currentVersion.pdf_storage_path ? entry.currentVersion.generated_at : null),
          draftPdfAvailable: Boolean(entry.currentVersion.draft_pdf_storage_bucket && entry.currentVersion.draft_pdf_storage_path),
          draftPdfGeneratedAt: entry.currentVersion.draft_pdf_generated_at,
          finalPdfAvailable: Boolean(
            (entry.currentVersion.final_pdf_storage_bucket && entry.currentVersion.final_pdf_storage_path) ||
              (entry.currentVersion.pdf_storage_bucket && entry.currentVersion.pdf_storage_path && ["finalised", "signed"].includes(entry.currentVersion.status))
          ),
          finalPdfGeneratedAt: entry.currentVersion.final_pdf_generated_at
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

export async function getRentalDocumentTimeline(input: {
  supabase: RentalDocumentSupabaseClient;
  organizationId: string;
  rentalId: string;
}) {
  await requireRental(input.supabase, input.organizationId, input.rentalId);

  const { data: documents, error } = await input.supabase
    .from("rental_documents")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("rental_id", input.rentalId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }

  const documentRows = (documents || []) as RentalDocument[];
  const versionIds = documentRows.map((document) => document.current_version_id).filter((value): value is string => Boolean(value));
  const versionsById = new Map<string, RentalDocumentVersion>();
  const signaturesByVersionId = new Map<string, RentalDocumentSignature[]>();

  if (versionIds.length > 0) {
    const [{ data: versions, error: versionsError }, { data: signatures, error: signaturesError }] = await Promise.all([
      input.supabase
        .from("rental_document_versions")
        .select("*")
        .eq("organization_id", input.organizationId)
        .in("id", versionIds),
      input.supabase
        .from("rental_document_signatures")
        .select("*")
        .eq("organization_id", input.organizationId)
        .in("document_version_id", versionIds)
        .order("signed_at", { ascending: true })
    ]);

    if (versionsError || signaturesError) {
      throw new Error(versionsError?.message || signaturesError?.message || "Unable to load rental document timeline.");
    }

    for (const version of (versions || []) as RentalDocumentVersion[]) {
      versionsById.set(version.id, version);
    }
    for (const signature of (signatures || []) as RentalDocumentSignature[]) {
      const existing = signaturesByVersionId.get(signature.document_version_id) || [];
      existing.push(signature);
      signaturesByVersionId.set(signature.document_version_id, existing);
    }
  }

  return documentRows.map((document) => {
    const currentVersion = document.current_version_id ? versionsById.get(document.current_version_id) || null : null;
    return sanitizeRentalDocumentTimelineEntry({
      document,
      currentVersion,
      signatures: currentVersion ? signaturesByVersionId.get(currentVersion.id) || [] : []
    });
  });
}

export async function linkLegacyContract(input: {
  supabase: RentalDocumentSupabaseClient;
  organizationId: string;
  documentId: string;
  legacyContractId: string;
  linkedBy?: string | null;
}) {
  const document = await requireDocument(input.supabase, input.organizationId, input.documentId);
  await requireLegacyContract(input.supabase, input.organizationId, input.legacyContractId);

  const { data, error } = await single<RentalDocument>(
    input.supabase
      .from("rental_documents")
      .update({ legacy_contract_id: input.legacyContractId })
      .eq("id", input.documentId)
      .eq("organization_id", input.organizationId)
      .select("*")
  );

  if (error || !data) {
    throw new Error(error?.message || "Unable to link legacy contract.");
  }

  await recordDocumentActivity({
    supabase: input.supabase,
    organizationId: input.organizationId,
    actorId: input.linkedBy,
    document,
    eventType: "rental_document_legacy_contract_linked",
    title: "Legacy contract linked",
    detail: "Legacy contract reference linked to rental document.",
    metadata: { legacy_contract_id: input.legacyContractId }
  });

  return data;
}
