import { NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { said } from "@/lib/i18n/server-text";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The owner's own batch, or the error response to send back. */
export async function ownBatch(batchId: string) {
  const membership = await getCurrentMembership();
  if (!membership) return { error: NextResponse.json({ error: await said("Please sign in first.") }, { status: 401 }) };
  if (membership.role !== "owner") return { error: NextResponse.json({ error: await said("Only the business owner can import data.") }, { status: 403 }) };
  const organization = await getDefaultOrganization();
  if (organization.id !== membership.organizationId) {
    return { error: NextResponse.json({ error: await said("Switch to the business you want to import into and try again.") }, { status: 409 }) };
  }
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: batch } = batchId
    ? await supabase.from("import_batches").select("id, status, sheets, mappings, preview, counts, created_at, source_name").eq("id", batchId).eq("organization_id", organization.id).maybeSingle()
    : { data: null };
  if (!batch) return { error: NextResponse.json({ error: await said("This import was not found. Start again from the file.") }, { status: 404 }) };
  return { membership, organization, supabase, batch };
}
