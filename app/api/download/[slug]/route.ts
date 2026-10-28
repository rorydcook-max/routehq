import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { CONTRACT_FORMATS, contractFile, type ContractFormat } from "@/lib/contract-builder/serve";
import { downloadFilePath } from "@/lib/site/content";
import { verifyDownloadToken } from "@/lib/site/download-token";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};

/**
 * A free resource's file (downloads/<slug>/<locale>.<format>, outside public/), for someone holding a signed link
 * from the resource's page or email (lib/site/download-token.ts). No link, a forged or expired one: 403.
 * A contract-builder link (format contract-docx / contract-print, with a lead) builds that operator's own agreement
 * from what they typed in: the Word file, or a print page the browser saves as PDF.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const claim = verifyDownloadToken(request.nextUrl.searchParams.get("t"));
  const denied = () => new NextResponse("This download link is not valid or has expired.", { status: 403, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  if (!claim || claim.slug !== slug) return denied();

  if ((CONTRACT_FORMATS as readonly string[]).includes(claim.format)) {
    if (!claim.lead) return denied();
    const m = await getTranslations({ locale: claim.locale, namespace: "marketing" }).catch(() => getTranslations({ locale: "en", namespace: "marketing" }));
    const file = await contractFile(claim.lead, claim.format as ContractFormat, { printLabel: m("contractPrintButton"), printHint: m("contractPrintHint"), lang: claim.locale });
    if (!file) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
    const headers: Record<string, string> = { "Content-Type": file.type, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
    if (file.fileName) headers["Content-Disposition"] = `attachment; filename="${file.fileName}"`;
    return new NextResponse(typeof file.body === "string" ? file.body : new Uint8Array(file.body), { headers });
  }

  const path = downloadFilePath(claim.slug, claim.locale, claim.format);
  if (!path) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  const size = statSync(path).size;
  const body = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
  return new NextResponse(body, {
    headers: {
      "Content-Type": TYPES[claim.format] || "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="lokalfleet-${claim.slug}-${claim.locale}.${claim.format}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
