import HtmlPdfNode from "html-pdf-node";

const PDF_OPTIONS: HtmlPdfNode.Options = {
  format: "A4",
  margin: { top: "14mm", bottom: "14mm", left: "15mm", right: "15mm" },
  printBackground: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
};

export async function htmlToPdf(html: string): Promise<Buffer> {
  const document = html.trimStart().startsWith("<!DOCTYPE")
    ? html
    : `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body>${html}</body></html>`;
  const file: HtmlPdfNode.File = { content: document };
  const pdfBuffer = await HtmlPdfNode.generatePdf(file, PDF_OPTIONS);
  return Buffer.from(pdfBuffer);
}
