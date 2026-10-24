import { NextResponse } from "next/server";
import { ownBatch } from "@/app/api/import/batch";
import { attachExisting, buildPreview, previewCounts, type ImportPreview } from "@/lib/import/preview";
import { existingRentals } from "@/lib/import/existing";
import { applyCostLearnings, emptyLearnings, learningKey, loadLearnings, rememberColumns } from "@/lib/import/learnings";

/**
 * The owner changed how a column was read: rebuild the cards from the stored sheets, and remember the choice so the
 * next import from this business reads that heading the same way.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const own = await ownBatch(String(body.batchId || ""));
  if ("error" in own) return own.error;
  const { supabase, organization, batch } = own;
  const mappings = Array.isArray(body.mappings) ? body.mappings : batch.mappings;
  const [{ data: vehicles }, { data: customers }, learnings] = await Promise.all([
    supabase.from("vehicles").select("id, registration_number, make, model").eq("organization_id", organization.id).is("deleted_at", null),
    supabase.from("customers").select("id, full_name, phone").eq("organization_id", organization.id).is("deleted_at", null),
    loadLearnings(supabase, organization.id).catch(() => emptyLearnings())
  ]);
  const preview = attachExisting(buildPreview(batch.sheets, mappings), vehicles || [], customers || [], await existingRentals(supabase, organization.id));
  // Costs keep the kind they had before the rebuild (worked out by the AI or chosen by the owner), then this
  // owner's past corrections apply.
  const before = new Map(((batch.preview as ImportPreview | null)?.transactions || []).filter((item) => item.type !== "other").map((item) => [learningKey(item.notes), item.type]));
  for (const item of preview.transactions) {
    const kept = item.type === "other" ? before.get(learningKey(item.notes)) : undefined;
    if (kept) item.type = kept;
  }
  applyCostLearnings(preview, learnings);
  const counts = previewCounts(preview);
  await supabase.from("import_batches").update({ mappings, preview, counts }).eq("id", batch.id);
  await rememberColumns(supabase, organization.id, batch.mappings || [], mappings).catch(() => null);
  return NextResponse.json({ preview, counts, mappings });
}
