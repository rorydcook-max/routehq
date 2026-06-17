declare module "html-pdf-node" {
  const htmlPdf: {
    generatePdf(file: { content: string } | { url: string }, options?: unknown): Promise<Buffer | Uint8Array>;
  };

  export default htmlPdf;
}
