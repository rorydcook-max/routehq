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

export type RentalDocumentType = (typeof rentalDocumentTypes)[number];
export type RentalDocument = TableRow<"rental_documents">;
export type RentalDocumentVersion = TableRow<"rental_document_versions">;
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

