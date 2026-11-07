import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/auth/active-organization-server";
import { signDocumentFile } from "@/lib/documents-hub";

/**
 * One file from Settings › Files: signs a fresh link for the member's own business and sends the browser there.
 * Used as the file's link and as its thumbnail's src, so nothing is signed until it is opened or scrolled into view.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const { data: membership } = await getActiveMembership(supabase, user.id);
  if (!membership?.organization_id) return NextResponse.json({ error: "Organization membership was not found." }, { status: 403 });

  const url = await signDocumentFile(membership.organization_id, decodeURIComponent(id));
  if (!url) return NextResponse.json({ error: "File not found." }, { status: 404 });

  // The signed link lasts an hour; the browser may reuse the redirect for a little less than that.
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, max-age=1800" } });
}
