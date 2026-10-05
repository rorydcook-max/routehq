import { createHash } from "node:crypto";

/**
 * Signed amendments to a rental agreement (migration 0074).
 *
 * An amendment changes the return date (with the agreed extension charge),
 * the rate from a given date, the deposit, or the vehicle. The business prepares it, the
 * customer signs it through a short link, and only then are the changes
 * applied to the rental. Everything else in the original agreement stays in
 * force, and the amendment says so.
 *
 * The HTML built here is what gets hashed and stored, so it must depend only
 * on the values passed in: no clock reads, no random ids.
 */

export type AmendmentChanges = {
  currency: string;
  billing_period: string;
  previous_end_date?: string | null;
  new_end_date?: string | null;
  extension_amount?: number | null;
  extension_due_date?: string | null;
  previous_rate?: number | null;
  new_rate?: number | null;
  rate_from?: string | null;
  previous_deposit?: number | null;
  new_deposit?: number | null;
  deposit_due_date?: string | null;
  /** A change of vehicle: the one being given up and the one taking its place. */
  previous_vehicle_id?: string | null;
  previous_vehicle_label?: string | null;
  new_vehicle_id?: string | null;
  new_vehicle_label?: string | null;
  /** True once the customer has the vehicle: handover and collection forms follow the signing. */
  vehicle_handed_over?: boolean;
  /** What happens to the vehicle given up: "available" or "repair". */
  original_vehicle_disposition?: string | null;
  vehicle_change_reason?: string | null;
  /** When two rentals exchange vehicles: the other rental, and the amendment its customer signs. */
  swap_with_rental_id?: string | null;
  swap_group?: string | null;
  /**
   * The customer couldn't sign on the spot (a breakdown, say), so the vehicle was
   * changed first and this is signed afterwards. Holds the date it was changed.
   */
  applied_before_signature?: string | null;
  /** Extra wording the business wants the customer to agree to. */
  additional_terms?: string | null;
};

export type AmendmentRenderInput = {
  changes: AmendmentChanges;
  businessLegalName: string;
  businessTradingName: string;
  businessAddress: string | null;
  signatoryName: string;
  signatoryTitle: string | null;
  renterName: string;
  vehicleLabel: string;
  rentalReference: string;
  agreement: { versionNumber: number; signedOn: string | null; hashFragment: string } | null;
  /** Date the amendment was prepared, YYYY-MM-DD. */
  preparedOn: string;
};

export type AmendmentSignatures = {
  businessSignatureUrl: string | null;
  renterSignatureDataUrl: string;
  renterName: string;
  signedAtLabel: string;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function amendmentMoney(value: number | null | undefined, currency = "THB") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "THB", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0));
}

/** "2026-10-01" -> "1 Oct 2026". */
export function amendmentDate(value: string | null | undefined) {
  const match = String(value || "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value ? String(value) : "Not set";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}`;
}

export function periodLabel(period: string) {
  const clean = String(period || "monthly").toLowerCase();
  if (clean === "daily") return "per day";
  if (clean === "weekly") return "per week";
  if (clean === "custom") return "per billing period";
  return "per month";
}

export function amendmentHash(html: string) {
  return createHash("sha256").update(html, "utf8").digest("hex");
}

export function hashFragment(hash: string | null | undefined) {
  const clean = String(hash || "").trim();
  return clean ? `${clean.slice(0, 8)}...${clean.slice(-8)}` : "";
}

export type AmendmentRow = { label: string; before: string; after: string };

/** The changes as rows of "before / after", for the page and the document. */
export function amendmentRows(changes: AmendmentChanges): AmendmentRow[] {
  const rows: AmendmentRow[] = [];
  const currency = changes.currency || "THB";
  if (changes.new_vehicle_id) {
    rows.push({ label: "Vehicle", before: changes.previous_vehicle_label || "Current vehicle", after: changes.new_vehicle_label || "Replacement vehicle" });
  }
  if (changes.new_end_date) {
    rows.push({ label: "Return date", before: amendmentDate(changes.previous_end_date), after: amendmentDate(changes.new_end_date) });
    if (Number(changes.extension_amount || 0) > 0) {
      rows.push({
        label: "Charge for the extension",
        before: "-",
        after: `${amendmentMoney(changes.extension_amount, currency)}, due ${amendmentDate(changes.extension_due_date)}`
      });
    }
  }
  if (changes.new_rate !== null && changes.new_rate !== undefined) {
    rows.push({
      label: "Rental rate",
      before: `${amendmentMoney(changes.previous_rate, currency)} ${periodLabel(changes.billing_period)}`,
      after: `${amendmentMoney(changes.new_rate, currency)} ${periodLabel(changes.billing_period)}, for payments due from ${amendmentDate(changes.rate_from)}`
    });
  }
  if (changes.new_deposit !== null && changes.new_deposit !== undefined) {
    const topUp = Number(changes.new_deposit) - Number(changes.previous_deposit || 0);
    rows.push({
      label: "Security deposit",
      before: amendmentMoney(changes.previous_deposit, currency),
      after:
        amendmentMoney(changes.new_deposit, currency) +
        (topUp > 0 ? ` (additional ${amendmentMoney(topUp, currency)} due ${amendmentDate(changes.deposit_due_date)})` : "")
    });
  }
  return rows;
}

const BUSINESS_SIGNATURE_PLACEHOLDER = `<p class="muted">Signed electronically with the business's pre-authorised signature when the renter signs.</p>`;
const RENTER_SIGNATURE_PLACEHOLDER = `<p class="muted">To be signed electronically by the renter.</p>`;

/**
 * The signed copy for the PDF: the stored text, word for word, with the two
 * signature images in place of the placeholders.
 */
export function withAmendmentSignatures(html: string, signatures: AmendmentSignatures) {
  const business = signatures.businessSignatureUrl
    ? `<img class="sig" alt="Business signature" src="${escapeHtml(signatures.businessSignatureUrl)}"><p class="muted">Pre-authorised electronic signature</p>`
    : `<div class="sig"></div><p class="muted">Pre-authorised electronic signature</p>`;
  const renter = `<img class="sig" alt="Renter signature" src="${escapeHtml(signatures.renterSignatureDataUrl)}"><p class="muted">Signed ${escapeHtml(
    signatures.signedAtLabel
  )}</p>`;
  return html.replace(BUSINESS_SIGNATURE_PLACEHOLDER, business).replace(RENTER_SIGNATURE_PLACEHOLDER, renter);
}

/** The amendment as a standalone document: the stored, hashed copy the customer reads and signs. */
export function renderAmendmentHtml(input: AmendmentRenderInput) {
  const { changes } = input;
  const rows = amendmentRows(changes);
  const agreementLine = input.agreement
    ? `the rental agreement for this rental (version ${input.agreement.versionNumber}${
        input.agreement.signedOn ? `, signed ${escapeHtml(amendmentDate(input.agreement.signedOn))}` : ""
      }, document fingerprint ${escapeHtml(input.agreement.hashFragment)})`
    : "the rental agreement for this rental";
  const businessName = input.businessLegalName || input.businessTradingName;
  const signatoryLine = `${escapeHtml(input.signatoryName)}${input.signatoryTitle ? `, ${escapeHtml(input.signatoryTitle)}` : ""}`;
  const businessSignature = BUSINESS_SIGNATURE_PLACEHOLDER;
  const renterSignature = RENTER_SIGNATURE_PLACEHOLDER;
  const signedLine = "";
  const extensionClause =
    changes.new_end_date && Number(changes.extension_amount || 0) > 0
      ? `<li>The renter will pay ${escapeHtml(amendmentMoney(changes.extension_amount, changes.currency))} for the extended period, due ${escapeHtml(
          amendmentDate(changes.extension_due_date)
        )}. This is a fixed charge for the period ${escapeHtml(amendmentDate(changes.previous_end_date))} to ${escapeHtml(
          amendmentDate(changes.new_end_date)
        )} and replaces the regular rate for that period.</li>`
      : changes.new_end_date
        ? `<li>The regular rate in the agreement applies to the extended period unless stated otherwise above.</li>`
        : "";
  const rateClause =
    changes.new_rate !== null && changes.new_rate !== undefined
      ? `<li>The new rate applies to rent payments due on or after ${escapeHtml(amendmentDate(changes.rate_from))}. Payments due before that date are unchanged.</li>`
      : "";
  const vehicleClause = changes.new_vehicle_id
    ? `<li>The renter gives up the ${escapeHtml(changes.previous_vehicle_label || "current vehicle")} and takes the ${escapeHtml(changes.new_vehicle_label || "replacement vehicle")} in its place${
        changes.vehicle_change_reason ? ` (${escapeHtml(changes.vehicle_change_reason)})` : ""
      }. From the change, every term of the agreement that refers to the vehicle applies to the replacement vehicle.</li>` +
      (changes.vehicle_handed_over
        ? `<li>The condition of the replacement vehicle is recorded on a handover form, and the condition of the vehicle given up on a collection form, each signed by the renter. Both forms are part of the agreement. Any charge for the vehicle given up (damage, fuel) is settled on the terms of the agreement.</li>`
        : "") +
      `<li>The security deposit and the rental dates carry over unchanged unless this amendment says otherwise.</li>` +
      (changes.applied_before_signature
        ? `<li>The vehicles were changed on ${escapeHtml(amendmentDate(changes.applied_before_signature))}, before this amendment was signed. By signing, the renter confirms that change.</li>`
        : "") +
      (changes.swap_with_rental_id ? `<li>The replacement vehicle is currently on another rental. This change takes effect once that vehicle is released by its renter signing their own change.</li>` : "")
    : "";
  const depositClause =
    changes.new_deposit !== null && changes.new_deposit !== undefined
      ? `<li>The security deposit is held and returned on the terms of the agreement, using the new amount.</li>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Amendment to rental agreement</title><style>
body{font-family:Helvetica,Arial,sans-serif;color:#10252b;font-size:12px;line-height:1.5;margin:32px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px}.muted{color:#667085}
table{width:100%;border-collapse:collapse;margin:8px 0 14px}th,td{border:1px solid #d6e5e2;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f4f8f7;font-weight:600}.sigs{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:10px}
.sig{height:70px;max-width:100%;border-bottom:1px solid #10252b;display:block}ol{padding-left:18px}
</style></head><body>
<h1>Amendment to rental agreement</h1>
<p class="muted">${escapeHtml(input.businessTradingName)} &middot; Rental ${escapeHtml(input.rentalReference)} &middot; Prepared ${escapeHtml(amendmentDate(input.preparedOn))}</p>
<table>
<tr><th>Business</th><td>${escapeHtml(businessName)}${input.businessAddress ? `<br><span class="muted">${escapeHtml(input.businessAddress)}</span>` : ""}</td></tr>
<tr><th>Renter</th><td>${escapeHtml(input.renterName)}</td></tr>
<tr><th>Vehicle</th><td>${escapeHtml(input.vehicleLabel)}</td></tr>
</table>
<p>This amendment changes ${agreementLine}. The business and the renter agree to the following changes:</p>
<table><tr><th>Term</th><th>Before</th><th>After this amendment</th></tr>
${rows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.before)}</td><td><strong>${escapeHtml(row.after)}</strong></td></tr>`).join("")}
</table>
<ol>
${vehicleClause}${extensionClause}${rateClause}${depositClause}
<li>All other terms of the rental agreement remain unchanged and continue to apply, including to any extended period.</li>
<li>This amendment takes effect when signed by the renter. Both parties agree to sign it electronically.</li>
</ol>
${changes.additional_terms ? `<h2>Additional terms</h2><p>${escapeHtml(changes.additional_terms).replace(/\n/g, "<br>")}</p>` : ""}
<h2>Signatures</h2>
<div class="sigs">
<div><p><strong>For ${escapeHtml(businessName)}</strong></p>${businessSignature}<p>${signatoryLine}</p></div>
<div><p><strong>Renter</strong></p>${renterSignature}<p>${escapeHtml(input.renterName)}</p>${signedLine}</div>
</div>
</body></html>`;
}
