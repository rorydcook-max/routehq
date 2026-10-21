import { NextResponse } from "next/server";
import { getShellContext } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

/**
 * The sidebar's badges, business list and brand. A plain GET rather than a server action: calling a server
 * action from the page resets Next's in-app page cache, so every tap reloaded every page in full.
 */
export async function GET() {
  const context = await getShellContext();
  return NextResponse.json(context, { headers: { "Cache-Control": "private, no-store" } });
}
