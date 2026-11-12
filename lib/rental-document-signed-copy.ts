import { createRentalDocumentSignedUrl, renderFinalPdfBuffer } from "@/lib/rental-document-storage";

/**
 * The agreement with both parties' signatures on it (Rory, 12 Nov 2026: the downloaded agreement showed only the
 * business's signature, the customer's was kept apart in a "signing certificate").
 *
 * When the customer signs, the agreement's own text is drawn again with their signature in its renter box, and the
 * signing record (who signed, when, the reference and the original's fingerprint) added as the last page. That is
 * the copy everyone downloads and the customer is emailed. The original final PDF the business signed stays exactly
 * as it was. The signed records in the database can't be changed, so the signed copy lives at a fixed place next to
 * the agreement version, written once (no overwrite): whoever hands the agreement out looks there first.
 */

export type AgreementIds = { organizationId: string; rentalId: string; documentId: string; versionId: string };

export function signedCopyPath(ids: AgreementIds) {
  return `organizations/${ids.organizationId}/rentals/${ids.rentalId}/rental-documents/${ids.documentId}/versions/${ids.versionId}/execution/signed-agreement.pdf`;
}

/**
 * A download link for an agreement version: its signed copy when there is one, else the final PDF. `signed` says
 * which, so the separate signing record is only offered for agreements signed before the signed copy existed.
 */
export async function agreementDownload(ids: AgreementIds, version: any, expiresIn = 10 * 60): Promise<{ url: string | null; signed: boolean }> {
  const signed = await createRentalDocumentSignedUrl("documents", signedCopyPath(ids), expiresIn).catch(() => null);
  if (signed) return { url: signed, signed: true };
  const path = version?.final_pdf_storage_path || version?.pdf_storage_path;
  if (!path) return { url: null, signed: false };
  const url = await createRentalDocumentSignedUrl(version.final_pdf_storage_bucket || version.pdf_storage_bucket || "documents", path, expiresIn).catch(() => null);
  return { url, signed: false };
}

const escape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function when(iso: string, timeZone: string) {
  try {
    return `${new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))} (${timeZone})`;
  } catch {
    return `${iso.replace("T", " ").slice(0, 16)} UTC`;
  }
}

/** The renter's box in RoveHQ's own agreement: an empty dashed box with "Renter signature" written in it. */
const RENTER_PLACEHOLDER = /<span[^>]*>\s*Renter signature[^<]*<\/span>/i;

/** The agreement's HTML with the customer's signature in place and the signing record as its last page. */
export function signedAgreementHtml(input: {
  html: string;
  signatureDataUrl: string;
  signerName: string;
  signedAt: string;
  timeZone: string;
  verificationReference: string;
  contentHash: string | null;
  versionNumber: number | null;
  business: { name: string; signer: string | null; signedAt: string | null };
}) {
  const signedLine = `Signed electronically ${escape(when(input.signedAt, input.timeZone))}`;
  const image = `<img src="${input.signatureDataUrl}" style="max-width:200px;max-height:70px;" alt="Renter signature"/>`;
  let html = input.html;
  if (RENTER_PLACEHOLDER.test(html)) {
    html = html.replace(RENTER_PLACEHOLDER, () => image);
    // RoveHQ's agreement leaves an empty line under the renter's printed name: the signing time goes there.
    html = html.replace(/(<div style="font-size:10px;color:#717d86;margin-top:4px;">)(<\/div>)(\s*<\/td>\s*<\/tr>\s*<\/table>\s*<\/body>)/i, (_, open, close, rest) => `${open}${signedLine}${close}${rest}`);
  } else {
    // A business's own agreement (uploaded wording) has no renter box we know: the signature goes on its own block.
    html = html.replace(
      /<\/body>/i,
      () => `<div style="page-break-inside:avoid;margin-top:28px;border-top:1px solid #cbd5e1;padding-top:14px;font-family:Arial,sans-serif;">
  <p style="font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;letter-spacing:0.05em;margin:0 0 8px;">Renter signature</p>
  ${image}
  <p style="font-size:11px;margin:6px 0 0;">${escape(input.signerName)}<br/><span style="color:#64748b;">${signedLine}</span></p>
</div></body>`
    );
  }
  const record = `<div style="page-break-before:always;font-family:Arial,sans-serif;color:#10252b;line-height:1.5;">
  <h2 style="font-size:18px;margin:0 0 6px;">Signing record</h2>
  <p style="font-size:11px;color:#475569;margin:0 0 14px;">This page records how the agreement above was signed electronically. It is part of the agreement.</p>
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr><td style="padding:6px 0;color:#64748b;width:38%;">Reference</td><td style="padding:6px 0;"><strong>${escape(input.verificationReference)}</strong></td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Rental business</td><td style="padding:6px 0;">${escape(input.business.name)}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Signed for the business</td><td style="padding:6px 0;">${escape(input.business.signer || "")}${input.business.signedAt ? `, ${escape(when(input.business.signedAt, input.timeZone))}` : ""}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Signed by the renter</td><td style="padding:6px 0;">${escape(input.signerName)}, ${escape(when(input.signedAt, input.timeZone))}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">How</td><td style="padding:6px 0;">On the renter's own device, from their booking link, after confirming they had read the agreement</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;">Agreement version</td><td style="padding:6px 0;">${escape(input.versionNumber ?? "")}</td></tr>
    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Fingerprint of the signed text</td><td style="padding:6px 0;font-family:monospace;font-size:9.5px;word-break:break-all;">${escape(input.contentHash || "")}</td></tr>
  </table>
  <p style="font-size:10px;color:#64748b;margin-top:16px;">The fingerprint changes if a single character of the agreement changes, so it shows this is the text that was signed. RoveHQ provides the software and is not a party to the agreement.</p>
</div>`;
  return html.replace(/<\/body>/i, () => `${record}</body>`);
}

/**
 * Makes the signed copy and stores it next to the agreement. Never throws: without it, everyone simply gets the
 * original final PDF as before. Returns where it is, or null.
 */
export async function makeSignedAgreementCopy(
  admin: any,
  input: AgreementIds & {
    version: any;
    signatureDataUrl: string;
    signerName: string;
    signedAt: string;
    timeZone: string;
    verificationReference: string;
    business: { name: string; signer: string | null; signedAt: string | null };
  }
): Promise<{ bucket: string; path: string } | null> {
  const path = signedCopyPath(input);
  try {
    const html = signedAgreementHtml({
      html: String(input.version.rendered_html_snapshot || ""),
      signatureDataUrl: input.signatureDataUrl,
      signerName: input.signerName,
      signedAt: input.signedAt,
      timeZone: input.timeZone,
      verificationReference: input.verificationReference,
      contentHash: input.version.content_hash || null,
      versionNumber: input.version.version_number ?? null,
      business: input.business
    });
    const pdf = await renderFinalPdfBuffer(html);
    // Written once: an existing signed copy is never replaced.
    const { error } = await admin.storage.from("documents").upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (error && !/exists|duplicate/i.test(error.message)) throw new Error(error.message);
    return { bucket: "documents", path };
  } catch (error) {
    console.error("[signing] the signed copy of the agreement could not be made", error);
    return null;
  }
}

/** Turns a stored PNG into a data URL (for signatures saved before the signed copy existed). */
export async function storedPngDataUrl(admin: any, bucket: string, path: string) {
  const { data, error } = await admin.storage.from(bucket || "documents").download(path);
  if (error || !data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
