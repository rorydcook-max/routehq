import { NextResponse } from "next/server";
import { ownBatch } from "@/app/api/import/batch";
import { attachExisting, buildPreview, previewCounts } from "@/lib/import/preview";

/** The owner changed how a column was read: rebuild the cards from the stored sheets. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const own = await ownBatch(String(body.batchId || ""));
  if ("error" in own) return own.error;
  const { supabase, organization, batch } = own;
  const mappings = Array.isArray(body.mappings) ? body.mappings : batch.mappings;
  const [{ data: vehicles }, { data: customers }] = await Promise.all([
    supabase.from("vehicles").select("id, registration_number, make, model").eq("organization_id", organization.id).is("deleted_at", null),
    supabase.from("customers").select("id, full_name, phone").eq("organization_id", organization.id).is("deleted_at", null)
  ]);
  const preview = attachExisting(buildPreview(batch.sheets, mappings), vehicles || [], customers || []);
  const counts = previewCounts(preview);
  await supabase.from("import_batches").update({ mappings, preview, counts }).eq("id", batch.id);
  return NextResponse.json({ preview, counts, mappings });
}
