import type { Bi, ContractDocument } from "./document";

/**
 * The print version of a built agreement: one self-contained A4 page that the browser saves as PDF (phones too).
 * Bilingual agreements put English and the local language side by side, clause by clause, so both parties read the
 * same thing in the same place.
 */

const FONT_FOR: Record<string, string> = {
  th: "Noto+Sans+Thai", lo: "Noto+Sans+Lao", km: "Noto+Sans+Khmer", vi: "Noto+Sans", id: "Noto+Sans", ms: "Noto+Sans", fil: "Noto+Sans", en: "Noto+Sans"
};

const esc = (text: string) => String(text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lines = (text: string) => esc(text).replace(/\n/g, "<br>");

export function renderContractHtml(doc: ContractDocument, options: { logo?: string | null; printLabel: string; printHint: string; lang: string }) {
  const two = doc.bilingual;
  const pair = (text: Bi, tag = "p", cls = "") =>
    two
      ? `<div class="pair ${cls}"><${tag} lang="en">${lines(text.en)}</${tag}><${tag} lang="${doc.locale}">${lines(text.local)}</${tag}></div>`
      : `<${tag} class="${cls}" lang="en">${lines(text.en)}</${tag}>`;
  const label = (text: Bi) => (two && text.local ? `${esc(text.en)}<span class="lbl-local" lang="${doc.locale}">${esc(text.local)}</span>` : esc(text.en));
  const body = doc.blocks
    .map((block) => {
      if (block.kind === "heading") return `${block.pageBreak ? '<div class="page-break"></div>' : ""}${pair(block.text, "h2", "h")}`;
      if (block.kind === "clause") return pair(block.text, "p", "clause");
      if (block.kind === "fields")
        return `<table class="fields">${block.rows.map((row) => `<tr><th>${label(row.label)}</th><td>${row.value ? lines(row.value) : '<span class="blank"></span>'}</td></tr>`).join("")}</table>`;
      if (block.kind === "sign")
        return `<table class="sign">${block.rows.map((row) => `<tr><th>${label(row)}</th><td></td></tr>`).join("")}</table>`;
      return `<table class="grid"><thead><tr>${block.columns.map((col) => `<th>${label(col)}</th>`).join("")}</tr></thead><tbody>${block.rows
        .map((row) => `<tr><td>${label(row)}</td>${block.columns.slice(1).map(() => "<td></td>").join("")}</tr>`)
        .join("")}</tbody></table>`;
    })
    .join("\n");
  const b = doc.business;
  const contact = [b.address, b.phone, b.email, b.reg].filter(Boolean).map(lines).join("<br>");
  const font = FONT_FOR[doc.locale] || "Noto+Sans";
  return `<!doctype html>
<html lang="${esc(options.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(doc.title.en)}${b.name ? ` · ${esc(b.name)}` : ""}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700${font !== "Noto+Sans" ? `&family=${font}:wght@400;600;700` : ""}&display=swap" rel="stylesheet">
<style>
:root{--ink:#06162b;--muted:#5f6b7a;--line:#c9d1da;--mist:#f3f6f8;--teal:#0b8f8c}
*{box-sizing:border-box}
body{margin:0;background:#e9edf1;color:var(--ink);font:10pt/1.45 "Noto Sans",${font !== "Noto+Sans" ? `"${font.replace(/\+/g, " ")}",` : ""}system-ui,sans-serif}
.bar{position:sticky;top:0;z-index:2;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;padding:12px 16px;background:var(--ink);color:#fff;font-size:14px}
.bar button{font:inherit;font-weight:700;padding:10px 18px;border-radius:999px;border:0;background:#12bcb8;color:var(--ink);cursor:pointer}
.sheet{width:210mm;max-width:100%;margin:16px auto;background:#fff;padding:16mm 15mm;box-shadow:0 2px 12px rgba(6,22,43,.12)}
header.top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid var(--ink);padding-bottom:10px;margin-bottom:14px}
header.top img{max-height:56px;max-width:180px;object-fit:contain}
.biz{font-size:9pt;color:var(--muted);text-align:right}.biz strong{display:block;color:var(--ink);font-size:11pt}
h1{font-size:17pt;margin:0 0 2px}.subtitle{color:var(--muted);margin:0 0 12px}
h1 .loc{display:block;font-size:13pt;color:var(--teal)}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.pair>*:last-child{color:#26384f}
h2,.h>*{font-size:11pt;margin:14px 0 6px;padding-top:6px;border-top:1px solid var(--line)}
.h>*{margin-top:14px}
p,.clause>*{margin:0 0 7px}
table{width:100%;border-collapse:collapse;margin:4px 0 10px;font-size:9.5pt;page-break-inside:auto}
tr{page-break-inside:avoid}
th,td{border:1px solid var(--line);padding:5px 7px;text-align:left;vertical-align:top}
.fields th{width:42%;background:var(--mist);font-weight:600}
.lbl-local{display:block;font-weight:400;color:var(--muted);font-size:8.5pt}
.blank{display:block;min-height:14px}
.sign th{width:42%;background:var(--mist)}.sign td{height:56px}
.grid thead th{background:var(--mist)}.grid td{height:26px}
.page-break{break-before:page;page-break-before:always;height:0}
footer.foot{margin-top:18px;color:var(--muted);font-size:8pt;text-align:center}
@media (max-width:700px){.sheet{padding:18px 14px}.pair{grid-template-columns:1fr;gap:2px}.pair>*:last-child{margin-bottom:10px}}
@page{size:A4;margin:14mm 13mm}
@media print{body{background:#fff}.bar{display:none}.sheet{margin:0;padding:0;box-shadow:none;width:auto}.pair{grid-template-columns:1fr 1fr}}
</style></head><body>
<div class="bar"><span>${esc(options.printHint)}</span><button type="button" onclick="window.print()">${esc(options.printLabel)}</button></div>
<main class="sheet">
<header class="top"><div>${options.logo ? `<img alt="" src="${esc(options.logo)}">` : ""}</div><div class="biz">${b.name ? `<strong>${esc(b.name)}</strong>` : ""}${contact}</div></header>
<h1>${esc(doc.title.en)}${two && doc.title.local ? `<span class="loc" lang="${doc.locale}">${esc(doc.title.local)}</span>` : ""}</h1>
<p class="subtitle">${esc(doc.subtitle.en)}${two && doc.subtitle.local ? ` · <span lang="${doc.locale}">${esc(doc.subtitle.local)}</span>` : ""}</p>
${body}
<footer class="foot">${esc(doc.footer.en)}<br>Free template from Lokalfleet · lokalfleet.com</footer>
</main></body></html>`;
}
