import { isEmailConfigured, sendEmail, type EmailAttachment } from "@/lib/email";
import { recordActivityEventOnce } from "@/lib/supabase/activity";

type StoredFile = { bucket: string | null | undefined; path: string | null | undefined; filename: string };

export type ExecutedDocumentEmail = {
  supabase: any;
  organizationId: string;
  rentalId: string;
  vehicleId?: string | null;
  customerId?: string | null;
  documentId: string;
  versionId: string;
  documentLabel: string;
  recipientEmail: string | null | undefined;
  recipientName: string | null | undefined;
  businessName: string | null | undefined;
  files: StoredFile[];
};

async function downloadAttachments(supabase: any, files: StoredFile[]): Promise<EmailAttachment[]> {
  const attachments: EmailAttachment[] = [];
  for (const file of files) {
    if (!file.bucket || !file.path) continue;
    const { data, error } = await supabase.storage.from(file.bucket).download(file.path);
    if (error || !data) throw new Error(`Could not load ${file.filename} for emailing: ${error?.message || "not found"}`);
    attachments.push({ filename: file.filename, content: new Uint8Array(await data.arrayBuffer()), contentType: "application/pdf" });
  }
  return attachments;
}

/**
 * Send an executed rental document to the customer and record the outcome.
 *
 * Never throws: the document is already executed and immutable by the time
 * this runs, so a mail problem must not undo or obscure that. Every outcome -
 * sent, skipped because no provider is configured, or failed - is written to
 * activity_events against the document, once per version, so there is a
 * trail showing whether the customer was sent their copy.
 */
export async function emailExecutedDocumentToCustomer(input: ExecutedDocumentEmail) {
  const base = {
    organization_id: input.organizationId,
    entity_type: "document",
    entity_id: input.documentId,
    vehicle_id: input.vehicleId ?? null,
    rental_id: input.rentalId,
    customer_id: input.customerId ?? null
  };
  const record = (status: string, title: string, detail: string, metadata: Record<string, unknown> = {}) =>
    recordActivityEventOnce(
      input.supabase,
      {
        ...base,
        event_type: `rental_document_email_${status}`,
        title,
        detail,
        metadata: { document_id: input.documentId, version_id: input.versionId, ...metadata }
      },
      `rental_document_email_${status}:${input.versionId}`
    );

  try {
    const to = String(input.recipientEmail || "").trim();
    if (!to) {
      await record("skipped", `${input.documentLabel} not emailed`, "The customer has no email address on file.", { reason: "no_recipient" });
      return { status: "skipped" as const };
    }

    if (!isEmailConfigured()) {
      await record("skipped", `${input.documentLabel} not emailed`, `No email provider is configured, so the copy for ${to} was not sent.`, {
        reason: "not_configured",
        recipient: to
      });
      return { status: "not_configured" as const };
    }

    const business = String(input.businessName || "").trim() || "your rental company";
    const name = String(input.recipientName || "").trim();
    const attachments = await downloadAttachments(input.supabase, input.files);

    const result = await sendEmail({
      to,
      subject: `Your ${input.documentLabel.toLowerCase()} from ${business}`,
      text: [
        name ? `Hi ${name},` : "Hello,",
        "",
        `Attached is your signed ${input.documentLabel.toLowerCase()} from ${business}. Please keep it for your records.`,
        "",
        `If anything in it looks wrong, reply to this email or contact ${business} directly.`
      ].join("\n"),
      attachments,
      metadata: { document_id: input.documentId, version_id: input.versionId }
    });

    if (result.status === "sent") {
      await record("sent", `${input.documentLabel} emailed`, `Sent to ${to}.`, { recipient: to, provider: result.provider, message_id: result.messageId });
    } else if (result.status === "failed") {
      await record("failed", `${input.documentLabel} email failed`, result.error, { recipient: to, provider: result.provider });
    } else {
      await record("skipped", `${input.documentLabel} not emailed`, "No email provider is configured.", { reason: "not_configured", recipient: to });
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await record("failed", `${input.documentLabel} email failed`, message).catch(() => undefined);
    return { status: "failed" as const, provider: "", error: message };
  }
}
