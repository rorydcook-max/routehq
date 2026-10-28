import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse, type NextRequest } from "next/server";
import { downloadFilePath } from "@/lib/site/content";
import { verifyDownloadToken } from "@/lib/site/download-token";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf"
};

/**
 * A free resource's file (downloads/<slug>/<locale>.<format>, outside public/), for someone holding a signed link
 * from the resource's page or email (lib/site/download-token.ts). No link, a forged or expired one: 403.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const claim = verifyDownloadToken(request.nextUrl.searchParams.get("t"));
  const denied = () => new NextResponse("This download link is not valid or has expired.", { status: 403, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  if (!claim || claim.slug !== slug) return denied();
  const path = downloadFilePath(claim.slug, claim.locale, claim.format);
  if (!path) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  const size = statSync(path).size;
  const body = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
  return new NextResponse(body, {
    headers: {
      "Content-Type": TYPES[claim.format] || "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="routehq-${claim.slug}-${claim.locale}.${claim.format}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
