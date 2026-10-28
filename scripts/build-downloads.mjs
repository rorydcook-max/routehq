#!/usr/bin/env node
/**
 * Builds the website's free downloads (lead magnets) from their template text, in every language that has one:
 *
 *   content/resources/<locale>/<slug>.template.md  →  downloads/<slug>/<locale>.docx  (editable, Word)
 *                                                  →  downloads/<slug>/<locale>.pdf   (print-ready)
 *
 * Usage:
 *   node scripts/build-downloads.mjs                         every resource with a template, every language
 *   node scripts/build-downloads.mjs rental-agreement        one resource, every language it has
 *   node scripts/build-downloads.mjs rental-agreement th de  one resource, some languages
 *
 * downloads/ is outside public/ on purpose: the files are only served through a signed link
 * (app/api/download/[slug]/route.ts). Translating a template = copying the English .template.md to the new
 * language's folder, translating the text (keep the Markdown and the frontmatter keys), and running this script.
 *
 * Tools: `docx` (Word files) and `playwright-core` (PDF through Chrome's print engine) are NOT app dependencies.
 * They are loaded from DOWNLOADS_TOOLS_DIR (default: %TEMP%/pwshot, where `npm install docx playwright-core` was run).
 * Chrome must be installed (Playwright's "chrome" channel); set DOWNLOADS_CHROME_CHANNEL="" to use a bundled Chromium.
 *
 * Template Markdown: "# " title, "## " sections, paragraphs, "- " lists, tables (the first row is the header),
 * **bold**, *italic*, "> " for a highlighted note, and "---" on its own line for a new page. Frontmatter:
 *   fileName  document title (file properties)
 *   footer    footer text on every page
 *   page, of  the words in "Page 1 of 4"
 *   tall      optional list of first-column labels whose table rows get room for a signature
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { parse as parseYaml } from "yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS = process.env.DOWNLOADS_TOOLS_DIR || join(tmpdir(), "pwshot");
const tools = createRequire(join(TOOLS, "noop.js"));
const docx = tools("docx");
const { chromium } = tools("playwright-core");

const LOCALES = ["en", "th", "my", "vi", "id", "ms", "zh", "zh-TW", "fil", "hi", "ta", "si", "fr", "ru", "es", "pt", "he", "de", "sv", "nb", "lo", "ko", "ja"];
const RTL = new Set(["he"]);
const DEFAULT_TALL = ["Signature", "Owner's signature", "Renter's signature"];
const INK = "06162B";
const TEAL = "0B8F8C";
const MIST = "F3F6F8";
const LINE = "C9D1DA";
const MUTED = "5F6B7A";

/** Fonts for scripts Arial lacks (Windows names; Word and Chrome fall back sensibly elsewhere). */
const SCRIPT_FONT = {
  th: "Leelawadee UI", lo: "Leelawadee UI", my: "Myanmar Text", hi: "Nirmala UI", ta: "Nirmala UI", si: "Nirmala UI",
  zh: "Microsoft YaHei", "zh-TW": "Microsoft JhengHei", ja: "Yu Gothic", ko: "Malgun Gothic"
};

function readTemplate(slug, locale) {
  const path = join(ROOT, "content", "resources", locale, `${slug}.template.md`);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8").replace(/^﻿/, "");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const meta = match ? parseYaml(match[1]) || {} : {};
  return { meta, body: match ? match[2] : raw };
}

const plain = (tokens = []) => tokens.map((t) => (t.tokens ? plain(t.tokens) : t.text ?? t.raw ?? "")).join("");
const decode = (text) => String(text).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

/* ── Word ─────────────────────────────────────────────────────────────── */

function buildDocx({ meta, body }, locale) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, PageBreak, Footer, PageNumber, HeightRule, AlignmentType, TableLayoutType } = docx;
  const rtl = RTL.has(locale);
  const scriptFont = SCRIPT_FONT[locale];
  const font = { ascii: "Arial", hAnsi: "Arial", cs: scriptFont || "Arial", eastAsia: scriptFont || "Arial" };
  const tall = new Set(Array.isArray(meta.tall) ? meta.tall.map(String) : DEFAULT_TALL);
  const tokens = new Marked({ gfm: true }).lexer(body);

  /** Inline Markdown as Word runs. */
  const runs = (inline = [], style = {}) => {
    const out = [];
    for (const t of inline) {
      if (t.type === "strong") out.push(...runs(t.tokens, { ...style, bold: true }));
      else if (t.type === "em") out.push(...runs(t.tokens, { ...style, italics: true }));
      else if (t.type === "br") out.push(new TextRun({ break: 1 }));
      else if (t.type === "link") out.push(...runs(t.tokens, style));
      else if (t.tokens && t.type !== "codespan") out.push(...runs(t.tokens, style));
      else out.push(new TextRun({ text: decode(t.text ?? t.raw ?? ""), font, rightToLeft: rtl, ...style }));
    }
    return out;
  };
  const para = (children, extra = {}) => new Paragraph({ children, bidirectional: rtl, spacing: { after: 120, line: 276 }, ...extra });

  const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  const borders = { top: border, bottom: border, left: border, right: border };
  const table = (t) => {
    const columns = t.header.length;
    const widths = columns === 1 ? [100] : columns === 2 ? [40, 60] : columns === 3 ? [30, 35, 35] : Array.from({ length: columns }, (_, i) => (i === 0 ? 28 : Math.floor(72 / (columns - 1))));
    const total = 9746; // A4 width minus margins, in twentieths of a point
    const cell = (inline, header, width) =>
      new TableCell({
        children: [para(runs(inline, header ? { bold: true } : {}), { spacing: { after: 0 } })],
        borders,
        width: { size: Math.round((total * width) / 100), type: WidthType.DXA },
        shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: MIST } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 }
      });
    const rows = [new TableRow({ tableHeader: true, children: t.header.map((h, i) => cell(h.tokens, true, widths[i])) })];
    for (const row of t.rows) {
      const label = plain(row[0]?.tokens).trim();
      rows.push(
        new TableRow({
          height: { value: tall.has(label) ? 900 : 440, rule: HeightRule.ATLEAST },
          cantSplit: true,
          children: row.map((c, i) => cell(c.tokens, false, widths[i]))
        })
      );
    }
    return new Table({ rows, width: { size: total, type: WidthType.DXA }, columnWidths: widths.map((w) => Math.round((total * w) / 100)), layout: TableLayoutType.FIXED, visuallyRightToLeft: rtl });
  };

  const children = [];
  for (const t of tokens) {
    if (t.type === "heading" && t.depth === 1) {
      children.push(para(runs(t.tokens, { bold: true, size: 40, color: INK }), { spacing: { after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 6 } } }));
    } else if (t.type === "heading") {
      children.push(para(runs(t.tokens, { bold: true, size: t.depth === 2 ? 25 : 22, color: INK }), { spacing: { before: 280, after: 100 }, keepNext: true }));
    } else if (t.type === "paragraph") {
      children.push(para(runs(t.tokens)));
    } else if (t.type === "blockquote") {
      for (const inner of t.tokens.filter((x) => x.type === "paragraph")) {
        children.push(para(runs(inner.tokens), { shading: { type: ShadingType.CLEAR, color: "auto", fill: MIST }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: TEAL, space: 8 } }, indent: { left: 160 }, spacing: { before: 120, after: 200 } }));
      }
    } else if (t.type === "list") {
      for (const item of t.items) children.push(para(runs(item.tokens.flatMap((x) => x.tokens || [x])), { bullet: { level: 0 }, spacing: { after: 60 } }));
    } else if (t.type === "table") {
      children.push(table(t));
      children.push(para([], { spacing: { after: 160 } }));
    } else if (t.type === "hr") {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  const footerText = String(meta.footer || "");
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: rtl,
        children: [
          new TextRun({ text: `${footerText}${footerText ? "  ·  " : ""}${meta.page || "Page"} `, size: 16, color: MUTED, font }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED, font }),
          new TextRun({ text: ` ${meta.of || "of"} `, size: 16, color: MUTED, font }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: MUTED, font })
        ]
      })
    ]
  });

  const doc = new Document({
    creator: "Lokalfleet",
    title: String(meta.fileName || "Template"),
    description: footerText,
    styles: { default: { document: { run: { font: "Arial", size: 20, color: "0B1A2E" } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080, footer: 500 } } },
        footers: { default: footer },
        children
      }
    ]
  });
  return Packer.toBuffer(doc);
}

/* ── PDF (Chrome's print engine) ──────────────────────────────────────── */

const escapeHtml = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function buildHtml({ meta, body }, locale) {
  const tall = Array.isArray(meta.tall) ? meta.tall.map(String) : DEFAULT_TALL;
  let html = new Marked({ gfm: true }).parse(body);
  // Rows that need room for a signature.
  for (const label of tall) {
    const cell = escapeHtml(label).replace(/'/g, "&#39;").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(`<tr>(\\s*<td>${cell}</td>)`, "g"), '<tr class="tall">$1');
  }
  const scriptFont = SCRIPT_FONT[locale] ? `"${SCRIPT_FONT[locale]}", ` : "";
  return `<!doctype html>
<html lang="${locale}" dir="${RTL.has(locale) ? "rtl" : "ltr"}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(meta.fileName || "Template")}</title>
<style>
  @page { size: A4; margin: 18mm 18mm 20mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: Arial, ${scriptFont}"Leelawadee UI", "Nirmala UI", "Myanmar Text", "Microsoft YaHei", "Yu Gothic", "Malgun Gothic", sans-serif; font-size: 10pt; line-height: 1.45; color: #0b1a2e; }
  h1 { margin: 0 0 10pt; padding-bottom: 6pt; border-bottom: 1.5pt solid #${TEAL}; font-size: 20pt; line-height: 1.2; color: #${INK}; }
  h2 { margin: 14pt 0 5pt; font-size: 12.5pt; color: #${INK}; break-after: avoid; }
  h3 { margin: 10pt 0 4pt; font-size: 11pt; break-after: avoid; }
  p { margin: 0 0 6pt; }
  ul { margin: 0 0 6pt; padding-inline-start: 16pt; }
  li { margin-bottom: 2pt; }
  blockquote { margin: 6pt 0 10pt; padding: 6pt 10pt; border-inline-start: 3pt solid #${TEAL}; background: #${MIST}; }
  blockquote p { margin: 0; }
  table { width: 100%; margin: 4pt 0 10pt; border-collapse: collapse; table-layout: fixed; break-inside: auto; }
  tr { break-inside: avoid; }
  th, td { padding: 4pt 6pt; border: 0.75pt solid #${LINE}; text-align: start; vertical-align: top; }
  th { background: #${MIST}; font-weight: 700; }
  td { height: 20pt; }
  tr.tall td { height: 40pt; }
  th:first-child, td:first-child { width: 40%; }
  table:has(tr > :nth-child(3)) th:first-child, table:has(tr > :nth-child(3)) td:first-child { width: 30%; }
  table:has(tr > :nth-child(4)) th:first-child, table:has(tr > :nth-child(4)) td:first-child { width: 28%; }
  th:only-child, td:only-child { width: 100%; }
  hr { break-after: page; height: 0; margin: 0; border: 0; }
  strong { font-weight: 700; }
</style>
</head>
<body>${html}</body>
</html>`;
}

async function buildPdf(browser, template, locale) {
  const page = await browser.newPage();
  await page.setContent(buildHtml(template, locale), { waitUntil: "load" });
  const footer = escapeHtml(String(template.meta.footer || ""));
  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-family:Arial,sans-serif;font-size:7.5pt;color:#${MUTED};text-align:center;">${footer}${footer ? " &nbsp;·&nbsp; " : ""}${escapeHtml(template.meta.page || "Page")} <span class="pageNumber"></span> ${escapeHtml(template.meta.of || "of")} <span class="totalPages"></span></div>`,
    margin: { top: "18mm", bottom: "20mm", left: "18mm", right: "18mm" },
    preferCSSPageSize: true
  });
  await page.close();
  return pdf;
}

/* ── Run ──────────────────────────────────────────────────────────────── */

const [slugArg, ...localeArgs] = process.argv.slice(2);
const resourcesDir = join(ROOT, "content", "resources");
const slugs = slugArg
  ? [slugArg]
  : [...new Set(LOCALES.flatMap((locale) => (existsSync(join(resourcesDir, locale)) ? readdirSync(join(resourcesDir, locale)) : []).filter((name) => name.endsWith(".template.md")).map((name) => name.slice(0, -".template.md".length))))];
if (!slugs.length) {
  console.log("No templates found (content/resources/<locale>/<slug>.template.md).");
  process.exit(0);
}

const channel = process.env.DOWNLOADS_CHROME_CHANNEL ?? "chrome";
const browser = await chromium.launch(channel ? { channel, headless: true } : { headless: true });
let built = 0;
try {
  for (const slug of slugs) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Not a resource slug: ${slug}`);
    const outDir = join(ROOT, "downloads", slug);
    mkdirSync(outDir, { recursive: true });
    for (const locale of localeArgs.length ? localeArgs : LOCALES) {
      const template = readTemplate(slug, locale);
      if (!template) {
        if (localeArgs.length) console.warn(`skip ${slug}/${locale}: no content/resources/${locale}/${slug}.template.md`);
        continue;
      }
      const word = await buildDocx(template, locale);
      writeFileSync(join(outDir, `${locale}.docx`), word);
      const pdf = await buildPdf(browser, template, locale);
      writeFileSync(join(outDir, `${locale}.pdf`), pdf);
      built += 1;
      console.log(`built downloads/${slug}/${locale}.docx (${Math.round(word.length / 1024)} KB) and ${locale}.pdf (${Math.round(pdf.length / 1024)} KB)`);
    }
  }
} finally {
  await browser.close();
}
console.log(built ? `Done: ${built} language file set(s).` : "Nothing built.");
