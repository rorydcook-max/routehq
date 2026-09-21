import { createHash, randomUUID } from "node:crypto";
import { htmlToPdf } from "@/lib/html-to-pdf";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordActivityEventOnce } from "@/lib/supabase/activity";
import { emailExecutedDocumentToCustomer } from "@/lib/rental-document-email";

/**
 * Delivery and return reports.
 *
 * When a delivery or return inspection is submitted, its evidence is rendered
 * into a standalone report, stored as a PDF and finalised through the
 * finalise_inspection_report RPC (migration 0065), which makes it an immutable
 * rental document of type delivery_report / return_report with the customer's
 * signature bound to its content hash. The signed rental agreement is never
 * touched: each report is its own document.
 *
 * The HTML is the thing that gets hashed, so it must be built only from the
 * values passed in - no clock reads, no random ids inside the markup.
 */

export type InspectionReportMode = "delivery" | "return";

export type InspectionReportInput = {
  /** User-scoped client: the RPC checks auth.uid() and the caller's role. */
  supabase: any;
  organizationId: string;
  inspectionId: string;
  rentalId: string;
  vehicleId: string;
  customerId: string | null;
  mode: InspectionReportMode;
  inspectedAt: string;
  odometerReading: number;
  fuelLevel: number | null;
  fuelLevelLabel: string | null;
  damageItems: unknown[];
  notes: string | null;
  customerSignature: string;
  customerSignedName: string | null;
};

const LABELS: Record<InspectionReportMode, string> = {
  delivery: "Delivery report",
  return: "Return report"
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseSignaturePng(dataUrl: string) {
  const match = String(dataUrl || "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("The customer signature is not a PNG image.");
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length < 32 || buffer.length > 280_000) throw new Error("The customer signature image size is invalid.");
  if (!buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error("The customer signature is not a valid PNG.");
  }
  return buffer;
}

function describeDamage(item: unknown) {
  const record = item && typeof item === "object" ? (item as Record<string, unknown>) : { description: item };
  const pick = (...keys: string[]) => keys.map((key) => record[key]).find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const photos = [record.photos, record.photoUrls, record.photo_urls, record.photoDocumentIds].find(Array.isArray) as unknown[] | undefined;
  return {
    where: pick("location", "area", "panel", "position", "zone") || "",
    what: pick("description", "label", "type", "damage_type", "name") || "Damage noted",
    severity: pick("severity", "level") || "",
    note: pick("notes", "note", "comment") || "",
    photoCount: photos?.length || 0
  };
}

export function renderInspectionReportHtml(input: {
  mode: InspectionReportMode;
  businessName: string;
  reference: string;
  inspectedAt: string;
  vehicleLabel: string;
  customerName: string;
  odometerReading: number;
  fuelLabel: string;
  damageItems: unknown[];
  notes: string | null;
  signerName: string;
  signatureDataUrl: string;
}) {
  const title = LABELS[input.mode];
  const damage = input.damageItems.map(describeDamage);
  const damageRows = damage.length
    ? damage
        .map(
          (item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.where)}</td><td>${escapeHtml(item.what)}${
            item.severity ? ` <span class="muted">(${escapeHtml(item.severity)})</span>` : ""
          }${item.note ? `<div class="muted">${escapeHtml(item.note)}</div>` : ""}</td><td>${item.photoCount}</td></tr>`
        )
        .join("")
    : `<tr><td colspan="4" class="muted">No damage recorded.</td></tr>`;
  const handover = input.mode === "delivery" ? "received the vehicle" : "returned the vehicle";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
body{font-family:Helvetica,Arial,sans-serif;color:#10252b;font-size:12px;margin:32px}
h1{font-size:20px;margin:0 0 4px}.muted{color:#667085}.meta{margin:0 0 20px}
table{width:100%;border-collapse:collapse;margin:8px 0 18px}th,td{border:1px solid #d6e5e2;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f4f8f7;font-weight:600}h2{font-size:14px;margin:18px 0 6px}.sig{height:80px;border-bottom:1px solid #10252b}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p class="meta muted">${escapeHtml(input.businessName)} &middot; Reference ${escapeHtml(input.reference)} &middot; ${escapeHtml(input.inspectedAt)}</p>
<table><tr><th>Vehicle</th><td>${escapeHtml(input.vehicleLabel)}</td></tr>
<tr><th>Customer</th><td>${escapeHtml(input.customerName)}</td></tr>
<tr><th>Odometer</th><td>${escapeHtml(input.odometerReading.toLocaleString("en-US"))} km</td></tr>
<tr><th>Fuel level</th><td>${escapeHtml(input.fuelLabel)}</td></tr></table>
<h2>Condition</h2>
<table><tr><th>#</th><th>Location</th><th>Finding</th><th>Photos</th></tr>${damageRows}</table>
${input.notes ? `<h2>Notes</h2><p>${escapeHtml(input.notes)}</p>` : ""}
<h2>Customer acknowledgement</h2>
<p>I confirm that I ${handover} in the condition recorded above.</p>
<img class="sig" alt="Customer signature" src="${escapeHtml(input.signatureDataUrl)}">
<p>${escapeHtml(input.signerName)}<br><span class="muted">Signed ${escapeHtml(input.inspectedAt)}</span></p>
</body></html>`;
}

/**
 * Build, store and finalise the report for a submitted inspection.
 *
 * Never throws. A report failure must not undo a vehicle handover that has
 * already happened, so any error is recorded against the inspection in
 * activity_events instead, where the operator can see it.
 */
export async function finaliseInspectionReport(input: InspectionReportInput) {
  const admin = createSupabaseAdminClient() as any;
  const label = LABELS[input.mode];
  const uploaded: string[] = [];

  try {
    const [{ data: organization }, { data: vehicle }, { data: customer }, { data: rental }] = await Promise.all([
      admin.from("organizations").select("name").eq("id", input.organizationId).maybeSingle(),
      admin.from("vehicles").select("make, model, registration_number").eq("id", input.vehicleId).eq("organization_id", input.organizationId).maybeSingle(),
      input.customerId
        ? admin.from("customers").select("full_name, email").eq("id", input.customerId).eq("organization_id", input.organizationId).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("rentals").select("*").eq("id", input.rentalId).eq("organization_id", input.organizationId).maybeSingle()
    ]);

    const signaturePng = parseSignaturePng(input.customerSignature);
    const signerName = String(input.customerSignedName || customer?.full_name || "").trim();
    if (!signerName) throw new Error("The customer's printed name is missing.");

    const reference = String(rental?.booking_reference || rental?.reference || rental?.reference_number || input.rentalId.slice(0, 8)).toUpperCase();
    const html = renderInspectionReportHtml({
      mode: input.mode,
      businessName: String(organization?.name || "Rental company"),
      reference,
      inspectedAt: input.inspectedAt,
      vehicleLabel: [vehicle?.registration_number, vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "Vehicle",
      customerName: String(customer?.full_name || signerName),
      odometerReading: input.odometerReading,
      fuelLabel: input.fuelLevelLabel || (input.fuelLevel === null ? "Not recorded" : `${input.fuelLevel}%`),
      damageItems: input.damageItems,
      notes: input.notes,
      signerName,
      signatureDataUrl: input.customerSignature
    });
    const contentHash = createHash("sha256").update(html, "utf8").digest("hex");

    const documentId = randomUUID();
    const versionId = randomUUID();
    const prefix = `organizations/${input.organizationId}/rentals/${input.rentalId}/rental-documents/${documentId}/versions/${versionId}/`;
    const pdfPath = `${prefix}report-${input.mode}.pdf`;
    const signaturePath = `${prefix}customer-signature-${input.mode}.png`;

    const storage = admin.storage.from("documents");
    const pdf = await htmlToPdf(html);
    const pdfUpload = await storage.upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
    if (pdfUpload.error) throw new Error(pdfUpload.error.message);
    uploaded.push(pdfPath);
    const signatureUpload = await storage.upload(signaturePath, signaturePng, { contentType: "image/png", upsert: false });
    if (signatureUpload.error) throw new Error(signatureUpload.error.message);
    uploaded.push(signaturePath);

    const { error } = await input.supabase.rpc("finalise_inspection_report", {
      p_organization_id: input.organizationId,
      p_inspection_id: input.inspectionId,
      p_document_id: documentId,
      p_version_id: versionId,
      p_rendered_html_snapshot: html,
      p_rendered_data_snapshot: {
        mode: input.mode,
        inspection_id: input.inspectionId,
        odometer_reading: input.odometerReading,
        fuel_level: input.fuelLevel,
        fuel_level_label: input.fuelLevelLabel,
        damage_items: input.damageItems,
        notes: input.notes,
        signer_name: signerName
      },
      p_content_hash: contentHash,
      p_pdf_storage_bucket: "documents",
      p_pdf_storage_path: pdfPath,
      p_signature_storage_bucket: "documents",
      p_signature_storage_path: signaturePath,
      p_signer_name: signerName
    });
    if (error) throw new Error(error.message);
    uploaded.length = 0;

    await recordActivityEventOnce(
      admin,
      {
        organization_id: input.organizationId,
        entity_type: "document",
        entity_id: documentId,
        vehicle_id: input.vehicleId,
        rental_id: input.rentalId,
        customer_id: input.customerId,
        event_type: `${input.mode}_report_finalised`,
        title: `${label} signed and stored`,
        detail: `${signerName} signed the ${label.toLowerCase()}.`,
        metadata: { document_id: documentId, version_id: versionId, inspection_id: input.inspectionId }
      },
      `${input.mode}_report_finalised:${input.inspectionId}`
    );

    await emailExecutedDocumentToCustomer({
      supabase: admin,
      organizationId: input.organizationId,
      rentalId: input.rentalId,
      vehicleId: input.vehicleId,
      customerId: input.customerId,
      documentId,
      versionId,
      documentLabel: label,
      recipientEmail: customer?.email,
      recipientName: customer?.full_name,
      businessName: organization?.name,
      files: [{ bucket: "documents", path: pdfPath, filename: `${input.mode}-report.pdf` }]
    });

    return { status: "finalised" as const, documentId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (uploaded.length) await admin.storage.from("documents").remove(uploaded).catch(() => undefined);
    await recordActivityEventOnce(
      admin,
      {
        organization_id: input.organizationId,
        entity_type: "inspection",
        entity_id: input.inspectionId,
        vehicle_id: input.vehicleId,
        rental_id: input.rentalId,
        customer_id: input.customerId,
        event_type: `${input.mode}_report_failed`,
        title: `${label} could not be created`,
        detail: message,
        metadata: { inspection_id: input.inspectionId }
      },
      `${input.mode}_report_failed:${input.inspectionId}`
    ).catch(() => undefined);
    return { status: "failed" as const, error: message };
  }
}
