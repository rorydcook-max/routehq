import { NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { exportBusiness, exportFileName } from "@/lib/privacy/export";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// A big business can take a while to gather.
export const maxDuration = 60;

/** "Download all your data" (My account): the whole business as one JSON file. Owner only. */
export async function GET() {
  const membership = await getCurrentMembership();
  if (!membership) return new NextResponse("Not signed in", { status: 401 });
  if (membership.role !== "owner") return new NextResponse("Only the owner can download all data.", { status: 403 });
  const admin = createSupabaseAdminClient() as any;
  const data = await exportBusiness(admin, membership.organizationId);
  const name = String((data.business as { name?: string } | null)?.name || "business");
  console.log(`[privacy] business export ${membership.organizationId} by ${membership.userId}`);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(name)}"`,
      "Cache-Control": "no-store"
    }
  });
}
