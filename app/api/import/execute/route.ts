import { NextResponse } from "next/server";
import { ownBatch } from "@/app/api/import/batch";
import { said } from "@/lib/i18n/server-text";
import { commitPreview } from "@/lib/import/commit";
import { previewCounts, type ImportPreview } from "@/lib/import/preview";
import { getVehicleCategories } from "@/lib/organization";
import { recordActivityEvent } from "@/lib/supabase/activity";

/**
 * "Bring it in": writes the cards the owner confirmed (with their edits) into
 * the business, all tagged with the batch so the import can be undone.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const own = await ownBatch(String(body.batchId || ""));
  if ("error" in own) return own.error;
  const { supabase, organization, batch, membership } = own;
  if (batch.status !== "previewing") return NextResponse.json({ error: await said("This import has already been brought in.") }, { status: 409 });

  // The owner's edited cards, or the stored preview if none were sent.
  const preview = (body.preview && typeof body.preview === "object" ? body.preview : batch.preview) as ImportPreview;
  for (const list of ["vehicles", "rentals", "customers", "transactions"] as const) if (!Array.isArray(preview[list])) (preview as any)[list] = [];

  const categories = await getVehicleCategories(organization.id);
  const defaultCategory = categories.find((category) => category.code === "car") || categories[0];
  const result = await commitPreview(
    { supabase, organizationId: organization.id, userId: membership.userId, currency: organization.currency || "THB", categoryId: defaultCategory?.id || null, batchId: batch.id },
    preview
  );

  const total = result.counts.vehicles + result.counts.vehiclesUpdated + result.counts.customers + result.counts.rentals + result.counts.transactions;
  await supabase
    .from("import_batches")
    .update({ status: total ? "imported" : "previewing", preview, counts: { ...previewCounts(preview), ...result.counts }, imported_at: total ? new Date().toISOString() : null })
    .eq("id", batch.id);

  if (total) {
    await recordActivityEvent(supabase, {
      organization_id: organization.id,
      actor_id: membership.userId,
      entity_type: "organization",
      entity_id: organization.id,
      event_type: "smart_import_completed",
      title: "Import completed",
      detail: `${result.counts.vehicles} vehicles, ${result.counts.customers} customers, ${result.counts.rentals} rentals, ${result.counts.transactions} money records imported from ${batch.source_name || "a spreadsheet"}.`
    });
    return NextResponse.json({ ...result, batchId: batch.id });
  }
  return NextResponse.json({ error: await said("Nothing was brought in. Vehicles need at least a plate; check the cards and try again."), ...result }, { status: 422 });
}
