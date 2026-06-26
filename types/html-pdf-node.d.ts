declare module "html-pdf-node" {
  namespace HtmlPdfNode {
    type File = { content: string } | { url: string };

    type Options = {
      format?: string;
      margin?: {
        top?: string;
        bottom?: string;
        left?: string;
        right?: string;
      };
      printBackground?: boolean;
      args?: string[];
      [key: string]: unknown;
    };
  }

  const HtmlPdfNode: {
    generatePdf(file: HtmlPdfNode.File, options?: HtmlPdfNode.Options): Promise<Buffer | Uint8Array>;
  };

  export default HtmlPdfNode;
}
