import htmlPdf from "html-pdf-node";

type HtmlPdfFile = {
  content: string;
};

type HtmlPdfOptions = {
  format: string;
  printBackground: boolean;
  margin: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
};

export async function htmlToPdf(html: string) {
  const file: HtmlPdfFile = { content: html };
  const options: HtmlPdfOptions = {
    format: "A4",
    printBackground: true,
    margin: {
      top: "14mm",
      right: "14mm",
      bottom: "14mm",
      left: "14mm"
    }
  };

  const pdf = await htmlPdf.generatePdf(file, options);
  return Buffer.from(pdf);
}
