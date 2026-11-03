import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { parse as parseYaml } from "yaml";
import { createChatCompletion } from "@/lib/ai-chat";
import { readFileAsJson } from "@/lib/ai-vision";
import {
  IMPORT_VARIABLES,
  THAI_CHECKS,
  tidyImportedAgreement,
  type ImportedAgreement,
  type ThaiCheck,
  type ThaiCheckItem
} from "@/lib/contract-import-template";

/**
 * "Use your own agreement": reading the owner's contract (server side).
 *
 * A Word file is opened here (a .docx is a zip with the text in word/document.xml), so its exact wording goes to
 * the model as text. A PDF or photos go to the vision model as they are. Either way one model call returns the
 * agreement as sections of clauses in the owner's own words, with each blank to fill in marked [[F1]], [[F2]]...
 * and matched to a booking detail. Nothing here is saved; app/actions/contract-import.ts does that.
 */

// ---------------------------------------------------------------------------------------------------------------
// Word files

/** One file out of a zip, using only Node's own inflate (no new dependency for a single read). */
function unzipEntry(zip: Buffer, wanted: string): Buffer | null {
  // The central directory's end record sits in the last 64 KB (22 bytes plus an optional comment).
  let end = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i -= 1) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  for (let index = 0; index < count && offset + 46 <= zip.length; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) return null;
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (name === wanted) {
      // The local header repeats the name and has its own extra field, so the data starts after both.
      const localName = zip.readUInt16LE(localOffset + 26);
      const localExtra = zip.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + localName + localExtra;
      const data = zip.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      return null;
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function decodeXml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

/** The paragraphs of a .docx, one per line, in reading order (table cells included). Empty when it isn't a Word file. */
export function readDocxText(bytes: Buffer): string {
  let xml: string;
  try {
    const entry = unzipEntry(bytes, "word/document.xml");
    if (!entry) return "";
    xml = entry.toString("utf8");
  } catch {
    return "";
  }
  const paragraphs: string[] = [];
  for (const match of xml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g)) {
    const paragraph = match[0];
    let line = "";
    for (const piece of paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g)) {
      if (piece[1] !== undefined) line += decodeXml(piece[1]);
      else if (piece[0] === "<w:tab/>") line += "\t";
      else line += "\n";
    }
    paragraphs.push(line);
  }
  return paragraphs
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------------------------------------------
// Reading the agreement

const variableList = IMPORT_VARIABLES.map((item) => `${item.key} (${item.label})`).join(", ");

const SYSTEM =
  "You convert a vehicle rental business's own rental agreement into structured JSON so it can be signed online. " +
  "The agreement may be in English, Thai, another language, or two languages side by side. " +
  "KEEP THE OWNER'S WORDING EXACTLY: copy every clause word for word, with the same spelling, numbers and amounts. Do not summarise, translate, correct, reorder or add anything. " +
  "Leave out only: the letterhead (business name, address and contact details at the very top), page numbers, headers/footers repeated on every page, and the signature/witness lines and boxes at the end (a signature page is added automatically). Keep any sentence about copies, signing or acceptance as a clause. " +
  "Split the agreement into sections under its own headings (use the document's headings; if it has none, one section with an empty heading). Each numbered or separate paragraph is one clause; drop the original clause numbers (they are renumbered), but keep sub-lists inside a clause with line breaks. " +
  "If the agreement is bilingual, put the first language's text in `text` and the matching translation in `text_secondary` (same for headings and title); never drop either language. " +
  "BLANKS: wherever the original has a space to fill in for each rental (underscores, dots, empty boxes, brackets like [name], or an obvious example value such as a sample name, plate or date), replace just that blank with a marker [[F1]], [[F2]], ... and list it in `fields`. Reuse the same id when the same detail appears again (including in the translation). " +
  `Match each field to one of these booking details: ${variableList}. If none fits (e.g. hotel room number, flight number, witness), use "custom:<short label>". ` +
  "Amounts and terms the owner has written as fixed text (e.g. a fixed 500 baht cleaning fee) are not blanks: keep them as written. " +
  'Return JSON: {"title": string, "title_secondary": string|null, "languages": ["en","th",...], "sections": [{"heading": string, "heading_secondary": string|null, "clauses": [{"text": string, "text_secondary": string|null}]}], ' +
  '"fields": [{"id": "F1", "placeholder_text_in_original": "the exact blank or example text it replaced", "variable": "renter_full_name or custom:<label>", "label": "what the blank asks for, a few words"}]}.';

const REPLY_TOKENS = 16_000;

/** Reads an agreement from its text (a Word file), a PDF, or photos of its pages. Throws when no model could read it. */
export async function readImportedAgreement(input: { text?: string; pdf?: Buffer; images?: Array<{ bytes: Buffer; type: string }> }): Promise<ImportedAgreement> {
  let raw: Record<string, unknown>;
  if (input.text) {
    const completion = await createChatCompletion(
      {
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: REPLY_TOKENS,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Here is the agreement, exactly as written in the owner's Word file:\n\n${input.text.slice(0, 120_000)}` }
        ]
      },
      { timeout: 240_000 }
    );
    raw = parseJson(String(completion.choices?.[0]?.message?.content || ""));
  } else if (input.pdf) {
    // Claude and Gemini read a PDF directly (text and scanned pages alike); see lib/receipt-reading.ts.
    raw = await readFileAsJson({
      system: SYSTEM,
      prompt: "Convert this rental agreement into the JSON described.",
      bytes: input.pdf,
      mediaType: "application/pdf",
      maxTokens: REPLY_TOKENS,
      personal: true
    });
  } else if (input.images?.length) {
    // All pages in one request, in order, so a clause running over a page break stays one clause.
    const completion = await createChatCompletion(
      {
        model: "gpt-4o",
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: REPLY_TOKENS,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: `These ${input.images.length} photo(s) are the pages of the agreement, in order. Convert it into the JSON described.` },
              ...input.images.map((image) => ({
                type: "image_url" as const,
                image_url: { url: `data:${image.type || "image/jpeg"};base64,${image.bytes.toString("base64")}`, detail: "high" as const }
              }))
            ]
          }
        ]
      },
      { timeout: 240_000 }
    );
    raw = parseJson(String(completion.choices?.[0]?.message?.content || ""));
  } else {
    throw new Error("Nothing to read.");
  }
  const doc = tidyImportedAgreement(raw);
  if (!doc.sections.length) throw new Error("No agreement text was found in the file.");
  return doc;
}

function parseJson(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The agreement could not be read.");
  return JSON.parse(text.slice(start, end + 1));
}

/** The agreement as plain text (both languages), for the Thailand check. */
export function agreementPlainText(doc: ImportedAgreement) {
  return [
    doc.title,
    ...doc.sections.flatMap((section) => [section.heading, section.heading_secondary || "", ...section.clauses.flatMap((clause) => [clause.text, clause.text_secondary || ""])])
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------------------------------------------
// Thailand: the 2025 controlled-contract notice

type YamlClause = { id: string; en: string; local?: string };
let thaiClauses: Map<string, YamlClause> | null = null;

/** Every clause of the RoveHQ Thailand agreement (content/contracts/th.yaml), by id. */
function thaiClauseMap() {
  if (thaiClauses) return thaiClauses;
  const raw = parseYaml(readFileSync(join(process.cwd(), "content", "contracts", "th.yaml"), "utf8").replace(/^﻿/, "")) as { sections?: Array<{ clauses?: YamlClause[] }> };
  thaiClauses = new Map();
  for (const section of raw.sections || []) for (const clause of section.clauses || []) if (clause?.id) thaiClauses.set(clause.id, clause);
  return thaiClauses;
}

/** th.yaml clauses carry {{placeholders}} for the RoveHQ builder; here they read as fixed words or a line to fill. */
function fixedWording(text: string) {
  const words: Record<string, string> = { currency: "THB", local_language: "Thai", prevailing_language: "Thai", jurisdiction: "the Kingdom of Thailand" };
  return (
    text
      .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => words[key] || "________")
      // The RoveHQ agreement points to its own section numbers and annexes, which mean nothing in the owner's
      // contract: "(section 15)" goes, and "in sections 4 and 8" becomes "in this agreement".
      .replace(/\s*\((?:see )?sections? \d+(?:\s*(?:and|,)\s*\d+)*\)/gi, "")
      .replace(/,? including Annexes? [A-Z](?: and [A-Z])?,?/g, "")
      .replace(/\bsections? \d+(?:\s*(?:and|,)\s*\d+)*/gi, "this agreement")
      .replace(/\s*\(ข้อ \d+\)/g, "")
      .replace(/(?:รวมถึง|และ)ภาคผนวก [ก-ฮ](?: และ [ก-ฮ])?\s*(?:แล้ว\s*)?/g, "")
      .replace(/Where Annex [A-Z] is attached, its prices/g, "Where a price list is attached to this agreement, its prices")
      .replace(/หากมีภาคผนวก [ก-ฮ] แนบไว้ ราคาในภาคผนวก [ก-ฮ]/g, "หากมีรายการราคาแนบท้ายสัญญานี้ ราคาในรายการดังกล่าว")
      .replace(/ข้อ \d+(?:\s*และ(?:ข้อ)?\s*\d+)*/g, "สัญญานี้")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/** The "Add this clause" wording for each check, English and Thai, straight from th.yaml. */
export function thaiCheckClauses(): Record<string, { en: string; th: string }> {
  const map = thaiClauseMap();
  const result: Record<string, { en: string; th: string }> = {};
  for (const check of THAI_CHECKS) {
    const clause = check.clause ? map.get(check.clause) : null;
    if (clause) result[check.id] = { en: fixedWording(clause.en), th: fixedWording(clause.local || "") };
  }
  return result;
}

/** Rough fallback when no model answers: a few telltale words per point, in English and Thai. */
const KEYWORDS: Record<string, RegExp> = {
  two_copies: /two (identical )?copies|in duplicate|สองฉบับ|2 ฉบับ/i,
  tax_insurance: /(tax|ภาษี)[\s\S]{0,200}(insurance|ประกัน)|(insurance|ประกัน)[\s\S]{0,200}(tax|ภาษี)/i,
  replacement: /replacement (vehicle|car|bike)|substitute vehicle|รถทดแทน/i,
  deposit_deductions: /(actual|evidenc)[\s\S]{0,120}(loss|damage|cost)|เสียหายจริง|หลักฐาน/i,
  deposit_refund: /(deposit|เงินประกัน)[\s\S]{0,160}(return|refund|คืน)/i,
  early_return: /(early return|return(ed)? early|pro[- ]?rata|in proportion|คืนรถก่อนกำหนด|ตามสัดส่วน)/i,
  owner_termination: /(only if|only where|เฉพาะ)[\s\S]{0,120}(breach|ผิดสัญญา)/i,
  actual_costs: /(actual|evidenced|ที่เกิดขึ้นจริง)[\s\S]{0,80}(cost|repair|ค่าซ่อม|ค่าใช้จ่าย)/i
};

/**
 * Which of the notice's essentials the agreement covers. One model call; if none answers, the keyword list.
 * These are warnings for the owner, never blockers: the owner decides.
 */
export async function checkThaiEssentials(doc: ImportedAgreement): Promise<ThaiCheck> {
  const text = agreementPlainText(doc).slice(0, 60_000);
  const checks = THAI_CHECKS.filter((check) => check.id !== "text_size");
  let items: ThaiCheckItem[] | null = null;
  try {
    const completion = await createChatCompletion(
      {
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 1500,
        messages: [
          {
            role: "system",
            content:
              "You check a Thai vehicle rental agreement against the essentials of the Contract Committee Notice on car and motorcycle rental (B.E. 2568). " +
              "For each point, say whether the agreement clearly covers it (present true) or not (present false), with a note of at most 20 words. Judge by meaning, in any language. " +
              'Return JSON {"items":[{"id": string, "present": boolean, "note": string}]}.'
          },
          {
            role: "user",
            content: `Points:\n${checks.map((check) => `- ${check.id}: ${check.title}`).join("\n")}\n\nAgreement:\n${text}`
          }
        ]
      },
      { timeout: 60_000 }
    );
    const parsed = parseJson(String(completion.choices?.[0]?.message?.content || ""));
    const list = Array.isArray(parsed.items) ? (parsed.items as any[]) : [];
    items = checks.map((check) => {
      const found = list.find((item) => item?.id === check.id);
      return { id: check.id, present: Boolean(found?.present), note: typeof found?.note === "string" ? found.note.slice(0, 200) : undefined };
    });
  } catch (error) {
    console.error("[contract-import] thai check:", error instanceof Error ? error.message : error);
  }
  if (!items) items = checks.map((check) => ({ id: check.id, present: KEYWORDS[check.id]?.test(text) ?? false }));
  // RoveHQ prints every uploaded agreement at 10.5pt, so the 2 mm rule is met however the original was printed.
  items.push({ id: "text_size", present: true });
  return { checked_at: new Date().toISOString(), items };
}
