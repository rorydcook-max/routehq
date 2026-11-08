import { NextResponse } from "next/server";
import { getCustomerExecutedAgreementDownloads } from "@/lib/rental-document-customer-signing";

export const dynamic = "force-dynamic";

/**
 * The customer's signed agreement (PDF), from the link in the copy they were sent (lib/customer-copies.ts). Stored-file
 * links expire after minutes, so this opens a fresh one each time; before signing it goes to the booking page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const downloads = await getCustomerExecutedAgreementDownloads(String(token || "")).catch(() => ({ original: null, certificate: null }));
  const wantsCertificate = new URL(request.url).searchParams.get("part") === "certificate";
  const target = (wantsCertificate ? downloads.certificate : downloads.original) || new URL(`/book/${encodeURIComponent(String(token || ""))}`, request.url).toString();
  return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
}
