import { NextResponse, type NextRequest } from "next/server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { searchStockPhotos } from "@/lib/stock-photos";

/**
 * GET /api/stock-photos/search?q=lisbon+coast&page=1 for the website editor's Stock photos tab (task unsplash-lib).
 * Searches Unsplash on the server so the access key stays here; results are cached (lib/stock-photos.ts).
 * Errors: 503 not_configured (no UNSPLASH_ACCESS_KEY), 429 rate_limited, 502 failed.
 */
export const dynamic = "force-dynamic";

const STATUS = { not_configured: 503, rate_limited: 429, failed: 502 } as const;

export async function GET(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  const q = String(request.nextUrl.searchParams.get("q") || "").trim();
  const page = Math.min(50, Math.max(1, Math.floor(Number(request.nextUrl.searchParams.get("page")) || 1)));
  if (q.length < 2) return NextResponse.json({ ok: true, photos: [], totalPages: 0 });
  const result = await searchStockPhotos(q, page);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=300" } });
}
