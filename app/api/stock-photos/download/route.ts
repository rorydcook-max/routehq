import { NextResponse, type NextRequest } from "next/server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { trackStockDownload } from "@/lib/stock-photos";

/**
 * POST /api/stock-photos/download { id, downloadLocation }: the website editor calls this when an owner picks an
 * Unsplash photo, and the server calls the photo's links.download_location (Unsplash's download tracking, required
 * by their API guidelines). Only that photo's own Unsplash endpoint is ever called (lib/stock-photos.ts).
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  if (membership.role !== "owner") return NextResponse.json({ error: "owner_only" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const downloadLocation = typeof body?.downloadLocation === "string" ? body.downloadLocation : "";
  const status = await trackStockDownload(id, downloadLocation);
  // The status only: never the URL (it carries Unsplash's tracking parameters) or the key.
  console.info(`[stock-photos] download tracked: ${status ?? "not sent"}`);
  return NextResponse.json({ ok: status !== null && status >= 200 && status < 300 });
}
