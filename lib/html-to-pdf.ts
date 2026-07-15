import HtmlPdfNode from "html-pdf-node";

const PDF_OPTIONS: HtmlPdfNode.Options = {
  format: "A4",
  margin: { top: "14mm", bottom: "14mm", left: "15mm", right: "15mm" },
  printBackground: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
};

/**
 * Strip any remaining Handlebars-style tokens ({{...}}) from HTML before
 * passing to html-pdf-node, which uses Handlebars internally and will throw
 * a parse error if it encounters unresolved {{#if}}, {{/if}}, or {{variable}}
 * tokens left over from our template renderer.
 */
function sanitiseForHandlebars(html: string): string {
  return html
    .replace(/\{\{#if\s+[^}]+\}\}/g, "")
    .replace(/\{\{else\}\}/g, "")
    .replace(/\{\{\/if\}\}/g, "")
    .replace(/\{\{\/[^}]+\}\}/g, "")
    .replace(/\{\{[^}]+\}\}/g, "");
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const sanitised = sanitiseForHandlebars(html);

  const document = sanitised.trimStart().toLowerCase().startsWith("<!doctype")
    ? sanitised
    : `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>${sanitised}</body></html>`;

  const file: HtmlPdfNode.File = { content: document };
  const pdfBuffer = await HtmlPdfNode.generatePdf(file, PDF_OPTIONS);
  return Buffer.from(pdfBuffer);
}
