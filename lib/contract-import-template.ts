/**
 * "Use your own agreement": the shared half (safe in the browser and on the server).
 *
 * An owner uploads the agreement they already use; lib/contract-import.ts reads it into an ImportedAgreement
 * (sections of numbered clauses in the owner's own words, with [[F1]] markers where the original had a blank to
 * fill in). This file turns that into template HTML for the normal agreement engine, so a booking's agreement is
 * rendered, versioned, countersigned and signed exactly like the RoveHQ agreement. The review screen calls the same
 * builder as the owner edits, so what they see is what gets saved.
 */

export const UPLOADED_TEMPLATE_KEY = "uploaded_agreement";
export const UPLOADED_TEMPLATE_MARKER = "<!-- rovehq-uploaded-agreement -->";
export const IMPORT_MAX_PAGES = 10;
export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** A booking detail an owner's blank can be filled with: the names the agreement engine fills in (lib/contract-rendering.ts). */
export const IMPORT_VARIABLES = [
  { key: "renter_full_name", label: "Renter's full name" },
  { key: "renter_first_name", label: "Renter's first name" },
  { key: "renter_surname", label: "Renter's surname" },
  { key: "renter_passport_number", label: "Passport or ID number" },
  { key: "renter_nationality", label: "Nationality" },
  { key: "customer_date_of_birth", label: "Date of birth" },
  { key: "renter_licence_number", label: "Driving licence number" },
  { key: "renter_licence_country", label: "Licence country" },
  { key: "renter_licence_expiry", label: "Licence expiry" },
  { key: "renter_phone", label: "Renter's phone" },
  { key: "renter_email", label: "Renter's email" },
  { key: "renter_address", label: "Renter's address" },
  { key: "vehicle_make_model", label: "Vehicle make and model" },
  { key: "vehicle_make", label: "Vehicle make" },
  { key: "vehicle_model", label: "Vehicle model" },
  { key: "vehicle_year", label: "Vehicle year" },
  { key: "vehicle_registration", label: "Number plate" },
  { key: "vehicle_colour", label: "Vehicle colour" },
  { key: "vehicle_fuel_type", label: "Fuel type" },
  { key: "vehicle_vin", label: "Chassis / VIN" },
  { key: "rental_start_date", label: "Start date" },
  { key: "rental_start_time", label: "Start time" },
  { key: "rental_end_date", label: "End date" },
  { key: "rental_end_time", label: "End time" },
  { key: "rental_duration", label: "Rental period" },
  { key: "rental_rate", label: "Rental rate" },
  { key: "billing_period_label", label: "Rate per (day / week / month)" },
  { key: "deposit_amount", label: "Deposit" },
  { key: "insurance_excess", label: "Insurance excess" },
  { key: "mileage_limit", label: "Distance limit" },
  { key: "delivery_location", label: "Delivery place" },
  { key: "delivery_odometer", label: "Odometer at handover" },
  { key: "delivery_fuel_level", label: "Fuel at handover" },
  { key: "business_name", label: "Business name" },
  { key: "business_legal_name", label: "Legal business name" },
  { key: "business_address", label: "Business address" },
  { key: "business_registration_or_tax_number", label: "Tax / registration number" },
  { key: "owner_name", label: "Who signs for the business" },
  { key: "owner_phone", label: "Business phone" },
  { key: "owner_email", label: "Business email" },
  { key: "home_territory", label: "Permitted area" },
  { key: "jurisdiction", label: "Governing law" },
  { key: "contract_date", label: "Agreement date" }
] as const;

export type ImportVariable = (typeof IMPORT_VARIABLES)[number]["key"];
const variableKeys = new Set<string>(IMPORT_VARIABLES.map((item) => item.key));

export function isImportVariable(value: string): value is ImportVariable {
  return variableKeys.has(value);
}

export type ImportedClause = { text: string; text_secondary?: string };
export type ImportedSection = { heading: string; heading_secondary?: string; clauses: ImportedClause[] };
/** One blank in the original. `variable` is a booking detail, or "custom:<label>" (left as a line to write on), or "" (removed: the original text is put back). */
export type ImportedField = { id: string; placeholder_text_in_original: string; variable: string; label?: string };
export type ImportedAgreement = {
  title: string;
  title_secondary?: string;
  languages: string[];
  sections: ImportedSection[];
  fields: ImportedField[];
};

/**
 * What Thailand's Contract Committee notice on car and motorcycle rental (B.E. 2568, in force 30 Dec 2025) expects
 * in every rental agreement. `clause` is the matching clause of content/contracts/th.yaml, offered as "Add this
 * clause" when the owner's agreement doesn't cover the point. Text size has no clause: RoveHQ prints at 10.5pt.
 */
export const THAI_CHECKS = [
  { id: "two_copies", clause: "signatures.1", title: "Made in two copies, one for each party" },
  { id: "tax_insurance", clause: "vehicle.2", title: "Vehicle tax and insurance valid for the whole rental" },
  { id: "replacement", clause: "accident.3", title: "Replacement vehicle if it can't be used for more than a day" },
  { id: "deposit_deductions", clause: "deposit.1", title: "Deposit deductions only for actual, evidenced loss pointed out at return" },
  { id: "deposit_refund", clause: "deposit.2", title: "When the deposit is refunded" },
  { id: "early_return", clause: "cancellation.3", title: "Early return refunded pro rata" },
  { id: "owner_termination", clause: "termination.1", title: "Owner may end the rental only if the renter breaches it" },
  { id: "actual_costs", clause: "damage.2", title: "Charges at actual, evidenced cost, up to the amounts stated" },
  { id: "text_size", clause: "", title: "Text at least 2 mm high" }
] as const;

export type ThaiCheckItem = { id: string; present: boolean; note?: string };
export type ThaiCheck = { checked_at: string; items: ThaiCheckItem[] };

/** What is kept in contract_templates.variables for an uploaded agreement. */
export type UploadedTemplateMeta = {
  kind: "uploaded_agreement";
  source: { bucket: string; paths: string[]; names: string[]; type: "pdf" | "docx" | "images"; from_chat?: boolean };
  doc: ImportedAgreement;
  include_details: boolean;
  extracted_text?: string;
  th_check?: ThaiCheck | null;
};

const BLANK = "________________";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    // The owner's own words must never be read as a {{placeholder}} or {{#if}} by the template engine.
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

/** Clause text to HTML: the owner's words escaped, each [[F1]] marker swapped for the booking detail chosen for it. */
export function clauseHtml(text: string, fields: ImportedField[]) {
  const byId = new Map(fields.map((field) => [field.id, field]));
  return escapeHtml(text)
    .replace(/\[\[\s*([A-Za-z0-9_-]{1,12})\s*\]\]/g, (_match, id: string) => {
      const field = byId.get(id);
      if (!field) return BLANK;
      // Owners' contracts usually ask for "make/model" as one blank; the engine knows them as two.
      if (field.variable === "vehicle_make_model") return "<strong>{{vehicle_make}} {{vehicle_model}}</strong>";
      // A detail the booking doesn't have yet (a return time, say) stays a visible blank, not a hole in the sentence.
      if (isImportVariable(field.variable)) return `<strong>{{#if ${field.variable}}}{{${field.variable}}}{{else}}${BLANK}{{/if}}</strong>`;
      if (field.variable.startsWith("custom:")) return `<span class="fill-line">${BLANK}</span>`;
      // Removed by the owner: what the original said there goes back in.
      return escapeHtml(field.placeholder_text_in_original);
    })
    .replace(/\r?\n/g, "<br>");
}

/** The booking details the owner's own blanks don't already cover, as one compact grid at the top. */
function detailsBlock(thai: boolean) {
  const label = (en: string, th: string) => (thai ? `${en} / ${th}` : en);
  const cell = (en: string, th: string, value: string) =>
    `<div class="info-cell"><div class="info-label">${label(en, th)}</div><div class="info-value">${value}</div></div>`;
  return `
  <section class="section">
    <div class="section-title">${label("Booking details", "รายละเอียดการเช่า")}</div>
    <div class="section-body">
      <div class="info-grid grid-4">
        ${cell("Renter", "ผู้เช่า", "{{renter_full_name}}")}
        ${cell("Passport or ID", "หนังสือเดินทาง", "{{renter_passport_number}}")}
        ${cell("Licence", "ใบขับขี่", "{{renter_licence_number}}")}
        ${cell("Phone", "โทรศัพท์", "{{renter_phone}}")}
        ${cell("Vehicle", "รถ", "{{vehicle_make}} {{vehicle_model}}")}
        ${cell("Plate", "ทะเบียน", "{{vehicle_registration}}")}
        ${cell("Start", "เริ่ม", "{{rental_start_date}} {{rental_start_time}}")}
        ${cell("End", "สิ้นสุด", "{{rental_end_date}} {{rental_end_time}}")}
        ${cell("Rate", "ค่าเช่า", "{{rental_rate}} / {{billing_period_label}}")}
        ${cell("Deposit", "เงินประกัน", "{{deposit_amount}}")}
      </div>
    </div>
  </section>`;
}

/**
 * The signature page, with exactly the placeholders of lib/contract-templates/default-en.html: the owner's saved
 * signature ({{owner_signature_url}}) is drawn in when the agreement is rendered for countersigning, and the
 * renter's ({{customer_signature_url}}, {{customer_signed_at}}) on the older booking-link signing path. The newer
 * signing flow keeps the rendered agreement as is and adds a separate execution certificate, so nothing here
 * needs to change for it.
 */
function signatureBlock(thai: boolean) {
  const label = (en: string, th: string) => (thai ? `${en} / ${th}` : en);
  return `
  <div style="page-break-before:always;"></div>

  <h2>${label("Signatures", "ลายเซ็น")}</h2>
  <p style="font-size:12px;color:#64748b;margin:6px 0 16px;">${label(
    "By signing below, both parties confirm they have read, understood, and agree to all terms of this rental contract.",
    "โดยการลงนามด้านล่าง คู่สัญญาทั้งสองฝ่ายยืนยันว่าได้อ่าน เข้าใจ และยินยอมผูกพันตามเงื่อนไขทั้งหมดของสัญญาเช่านี้"
  )}</p>

  <div class="info-grid cols-1" style="margin-bottom:24px;">
    <div class="info-cell"><div class="lbl">${label("Contract Date", "วันที่สัญญา")}</div><div class="val">{{contract_date}}</div></div>
  </div>

  <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
    <tr>
      <td style="width:50%;padding-right:20px;vertical-align:top;">
        <p style="font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;letter-spacing:0.05em;margin:0 0 8px;">${label("Owner", "ผู้ให้เช่า")}</p>
        <div style="height:80px;border:1px dashed #94a3b8;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#fafafa;margin-bottom:10px;">
          {{#if owner_signature_url}}
          <img src="{{owner_signature_url}}" style="max-width:200px;max-height:70px;" alt="Owner signature"/>
          {{else}}
          <span style="color:#94a3b8;font-size:11px;font-style:italic;">${label("Owner signature", "ลายเซ็นเจ้าของ")}</span>
          {{/if}}
        </div>
        <div style="border-top:1px solid #334155;padding-top:6px;font-size:14px;color:#1a1d21;">${label("Name (print)", "ชื่อ (ตัวพิมพ์)")}: <strong>{{owner_name}}</strong></div>
      </td>
      <td style="width:50%;padding-left:20px;vertical-align:top;">
        <p style="font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;letter-spacing:0.05em;margin:0 0 8px;">${label("Renter", "ผู้เช่า")}</p>
        <div style="height:80px;border:1px dashed #94a3b8;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#fafafa;margin-bottom:10px;">
          {{#if customer_signature_url}}
          <img src="{{customer_signature_url}}" style="max-width:200px;max-height:70px;" alt="Renter signature"/>
          {{else}}
          <span style="color:#94a3b8;font-size:11px;font-style:italic;">${label("Renter signature", "ลายเซ็นผู้เช่า")}</span>
          {{/if}}
        </div>
        <div style="border-top:1px solid #334155;padding-top:6px;font-size:14px;color:#1a1d21;">${label("Name (print)", "ชื่อ (ตัวพิมพ์)")}: <strong>{{renter_full_name}}</strong></div>
        <div style="font-size:11px;color:#717d86;margin-top:4px;">{{customer_signed_at}}</div>
      </td>
    </tr>
  </table>`;
}

/**
 * The finished template. `styleCss` is the <style> of the RoveHQ agreement (read on the server from
 * default-en.html), so an uploaded agreement looks like the platform one: same header, colours and fonts.
 */
export function buildUploadedTemplateHtml(doc: ImportedAgreement, options: { styleCss: string; includeDetails: boolean }) {
  const thai = doc.languages.includes("th");
  // Only headed sections are numbered: an opening paragraph before the first heading reads as a preamble.
  let numbered = 0;
  const sections = doc.sections
    .map((section) => {
      const heading = [section.heading, section.heading_secondary].filter((part) => part && part.trim()).map(escapeHtml).join(" / ");
      const number = heading ? ++numbered : 0;
      const clauses = section.clauses
        .map((clause, clauseIndex) => {
          const num = number ? `<span class="clause-num">${number}.${clauseIndex + 1}</span> ` : "";
          const secondary = clause.text_secondary?.trim()
            ? `\n          <div class="lang-th">${num}${clauseHtml(clause.text_secondary, doc.fields)}</div>`
            : "";
          return `
      <div class="clause">
        <div class="bilingual-section">
          <div class="lang-en">${num}${clauseHtml(clause.text, doc.fields)}</div>${secondary}
        </div>
      </div>`;
        })
        .join("");
      return `
  <section class="section">${number ? `
    <div class="section-title">${number}. ${heading}</div>` : ""}
    <div class="section-body">${clauses}
    </div>
  </section>`;
    })
    .join("\n");

  const title = [doc.title, doc.title_secondary].filter((part) => part && part.trim()).map(escapeHtml).join(" / ") || "Vehicle rental agreement";

  return `${UPLOADED_TEMPLATE_MARKER}
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
${options.styleCss}
    /* The owner's clauses are printed at 10.5pt (14px): Thailand's 2025 rental-contract notice asks for text at
       least 2 mm high, and that is comfortably over it. */
    .lang-en, .lang-th { font-size: 14px; line-height: 1.6; }
    .lang-th { font-family: "Sarabun", Arial, sans-serif; }
    .fill-line { letter-spacing: 0.02em; }
    /* The owner's extra terms are numbered "20.x" for the RoveHQ agreement; here they are a plain list. */
    .owner-terms .clause-num { display: none; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      {{#if business_logo_url}}
      <img src="{{business_logo_url}}" class="logo" alt="{{business_name}} logo" />
      {{else}}
      <div class="wordmark">{{business_name}}</div>
      {{/if}}
    </div>
    <div class="owner-details">
      <strong>{{owner_name}}</strong><br />
      {{business_address}}<br />
      WhatsApp: {{owner_whatsapp}}<br />
      LINE: {{owner_line_id}}<br />
      Email: {{owner_email}}
    </div>
  </div>

  <div class="title-band">
    <h1>${title}</h1>
  </div>
${options.includeDetails ? detailsBlock(thai) : ""}
${sections}

  {{#if owner_extra_terms}}
  <section class="section owner-terms">
    <div class="section-title">${thai ? "Additional terms / เงื่อนไขเพิ่มเติม" : "Additional terms"}</div>
    <div class="section-body">
      {{owner_extra_terms}}
    </div>
  </section>
  {{/if}}
${signatureBlock(thai)}
</body>
</html>`;
}

/** Pulls the <style> of a full HTML document (the RoveHQ agreement), for reuse in an uploaded one. */
export function styleOf(fullHtml: string) {
  return (fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] || "").trim();
}

/** Accepts what the model (or the review screen) sent and keeps only what fits the shape, within sensible sizes. */
export function tidyImportedAgreement(raw: any): ImportedAgreement {
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, max) : "");
  // Sections are renumbered when rendered, so "3. Deposit" or "ข้อ 3 เงินประกัน" would otherwise read "3. 3. Deposit".
  const heading = (value: unknown) =>
    text(value, 200)
      .replace(/^(?:section|clause|ข้อ(?:ที่)?)\s*\d+(?:\.\d+)*\s*[.):]?\s*/i, "")
      // A bare number needs its full stop or bracket, so "24 hour support" is left alone.
      .replace(/^\d+(?:\.\d+)*\s*[.):]\s*/, "");
  const sections: ImportedSection[] = (Array.isArray(raw?.sections) ? raw.sections : [])
    .slice(0, 60)
    .map((section: any) => ({
      heading: heading(section?.heading),
      heading_secondary: heading(section?.heading_secondary) || undefined,
      clauses: (Array.isArray(section?.clauses) ? section.clauses : [])
        .slice(0, 80)
        .map((clause: any) => (typeof clause === "string" ? { text: text(clause, 6000) } : { text: text(clause?.text, 6000), text_secondary: text(clause?.text_secondary, 6000) || undefined }))
        .filter((clause: ImportedClause) => clause.text || clause.text_secondary)
        .map((clause: ImportedClause) => (clause.text ? clause : { text: clause.text_secondary || "" }))
    }))
    .filter((section: ImportedSection) => section.clauses.length || section.heading);
  const seen = new Set<string>();
  const fields: ImportedField[] = (Array.isArray(raw?.fields) ? raw.fields : [])
    .slice(0, 120)
    .map((field: any, index: number) => {
      const id = text(field?.id, 12).replace(/[^A-Za-z0-9_-]/g, "") || `F${index + 1}`;
      const variable = text(field?.variable, 80);
      return {
        id,
        placeholder_text_in_original: text(field?.placeholder_text_in_original ?? field?.original, 200) || BLANK,
        variable: isImportVariable(variable) || variable === "" ? variable : variable.startsWith("custom:") ? `custom:${variable.slice(7).trim().slice(0, 60) || "Other"}` : `custom:${variable.slice(0, 60) || "Other"}`,
        label: text(field?.label, 80) || undefined
      };
    })
    .filter((field: ImportedField) => (seen.has(field.id) ? false : (seen.add(field.id), true)));
  const languages = (Array.isArray(raw?.languages) ? raw.languages : [raw?.language])
    .map((code: unknown) => text(code, 8).toLowerCase())
    .filter(Boolean)
    .slice(0, 3);
  return {
    title: text(raw?.title, 200) || "Vehicle rental agreement",
    title_secondary: text(raw?.title_secondary, 200) || undefined,
    languages: languages.length ? languages : ["en"],
    sections,
    fields
  };
}
