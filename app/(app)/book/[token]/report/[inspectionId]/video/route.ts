import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * The walkaround video of a handover or return, from the customer's copy of the report (lib/customer-copies.ts) or
 * the report page. The booking link's token is the key and the inspection must be on that booking; each visit opens
 * a fresh stored-file link.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; inspectionId: string }> }) {
  const { token, inspectionId } = await params;
  const back = new URL(`/book/${encodeURIComponent(String(token || ""))}/report/${encodeURIComponent(String(inspectionId || ""))}`, request.url).toString();
  if (!token || !/^[0-9a-f-]{36}$/i.test(String(inspectionId || ""))) return NextResponse.redirect(back, 302);
  const admin = createSupabaseAdminClient() as any;
  const { data: link } = await admin.from("booking_links").select("organization_id, rental_id").eq("token", token).is("deleted_at", null).maybeSingle();
  if (!link?.rental_id) return NextResponse.redirect(back, 302);
  const { data: inspection } = await admin
    .from("inspections")
    .select("video_url")
    .eq("id", inspectionId)
    .eq("organization_id", link.organization_id)
    .eq("rental_id", link.rental_id)
    .is("deleted_at", null)
    .maybeSingle();
  const path = String(inspection?.video_url || "");
  if (!path) return NextResponse.redirect(back, 302);
  if (/^https?:\/\//.test(path)) return NextResponse.redirect(path, 302);
  const { data } = await admin.storage.from("documents").createSignedUrl(path, 60 * 60);
  return NextResponse.redirect(data?.signedUrl || back, { status: 302, headers: { "Cache-Control": "no-store" } });
}
