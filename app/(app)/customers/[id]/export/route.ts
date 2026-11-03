import { NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { exportCustomer, exportFileName } from "@/lib/privacy/export";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** "Export this customer's data": everything the business holds about one renter, for their access request. Owner or manager. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const membership = await getCurrentMembership();
  if (!membership) return new NextResponse("Not signed in", { status: 401 });
  if (membership.role !== "owner" && membership.role !== "manager") return new NextResponse("Only an owner or manager can export a customer's data.", { status: 403 });
  const { id } = await params;
  const admin = createSupabaseAdminClient() as any;
  const data = await exportCustomer(admin, membership.organizationId, id);
  if (!data) return new NextResponse("Not found", { status: 404 });
  const name = String((data.customer as { full_name?: string }).full_name || "customer");
  console.log(`[privacy] customer export ${id} (business ${membership.organizationId}) by ${membership.userId}`);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(name)}"`,
      "Cache-Control": "no-store"
    }
  });
}
