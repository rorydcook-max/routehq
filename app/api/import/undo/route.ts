import { NextResponse } from "next/server";
import { ownBatch } from "@/app/api/import/batch";
import { said } from "@/lib/i18n/server-text";
import { undoBatch } from "@/lib/import/commit";
import { recordActivityEvent } from "@/lib/supabase/activity";

const UNDO_DAYS = 30;

/** Takes a whole import back, within 30 days. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const own = await ownBatch(String(body.batchId || ""));
  if ("error" in own) return own.error;
  const { supabase, organization, batch, membership } = own;
  if (batch.status !== "imported") return NextResponse.json({ error: await said("This import has already been taken back.") }, { status: 409 });
  if (Date.now() - new Date(batch.created_at).getTime() > UNDO_DAYS * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: await said("An import can only be taken back within 30 days.") }, { status: 409 });
  }
  await undoBatch(supabase, organization.id, batch.id);
  await recordActivityEvent(supabase, {
    organization_id: organization.id,
    actor_id: membership.userId,
    entity_type: "organization",
    entity_id: organization.id,
    event_type: "import_undone",
    title: "Import taken back",
    detail: `The import from ${batch.source_name || "a spreadsheet"} was taken back.`
  });
  return NextResponse.json({ ok: true });
}
