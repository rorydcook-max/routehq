import { vehiclePhotoAddress } from "@/lib/photo-url";

/** A vehicle photo as stored: its document, file, and whether AI made it (an AI-enhanced photo is still a real photo). */
export type VehiclePhotoRef = { id: string; vehicleId: string; path: string; aiGenerated: boolean };

/**
 * Each vehicle's photos, in the order set on the vehicle page (the main photo first).
 * `perVehicle` caps how many come back for each vehicle: 1 for a thumbnail, a handful for a gallery.
 */
export async function vehiclePhotoRefs(client: any, organizationId: string, perVehicle = 1, onlyVehicleId?: string): Promise<Map<string, VehiclePhotoRef[]>> {
  let query = client
    .from("documents")
    .select("id, owner_id, storage_path, extracted_data, created_at")
    .eq("organization_id", organizationId)
    .eq("owner_type", "vehicle")
    .eq("category", "vehicle_photo")
    .is("deleted_at", null);
  if (onlyVehicleId) query = query.eq("owner_id", onlyVehicleId);
  const { data } = await query.order("created_at", { ascending: true });

  const byVehicle = new Map<string, Array<VehiclePhotoRef & { order: number; index: number }>>();
  ((data || []) as any[]).forEach((row, index) => {
    if (!row.owner_id || !row.storage_path) return;
    const list = byVehicle.get(row.owner_id) || [];
    const order = Number(row.extracted_data?.vehicle_photo_order);
    list.push({ id: String(row.id), vehicleId: String(row.owner_id), path: row.storage_path, aiGenerated: row.extracted_data?.ai_generated === true, order: Number.isFinite(order) ? order : 9999, index });
    byVehicle.set(row.owner_id, list);
  });

  const chosen = new Map<string, VehiclePhotoRef[]>();
  for (const [vehicleId, list] of byVehicle) {
    // The same order as the vehicle page (lib/vehicle-detail.ts): photos with a set place first, in that order; the
    // rest newest first (Rory, 1 Nov 2026: the Ranger's thumbnail was its oldest photo, not the main one).
    chosen.set(
      vehicleId,
      list
        .sort((a, b) => a.order - b.order || b.index - a.index)
        .slice(0, perVehicle)
        .map(({ id, path, aiGenerated }) => ({ id, vehicleId, path, aiGenerated }))
    );
  }
  return chosen;
}

/** Each vehicle's photos at their stable, cacheable public address (app/api/rove-photo). For public pages only. */
export async function publicVehiclePhotos(client: any, organizationId: string, perVehicle = 1, onlyVehicleId?: string): Promise<Map<string, Array<{ url: string; aiGenerated: boolean }>>> {
  const refs = await vehiclePhotoRefs(client, organizationId, perVehicle, onlyVehicleId);
  const result = new Map<string, Array<{ url: string; aiGenerated: boolean }>>();
  for (const [vehicleId, list] of refs) result.set(vehicleId, list.map((ref) => ({ url: vehiclePhotoAddress(vehicleId, ref.id, ref.path), aiGenerated: ref.aiGenerated })));
  return result;
}

/**
 * Each vehicle's photos as signed links, in the order set on the vehicle page (the main photo first).
 * `perVehicle` caps how many are signed for each vehicle: 1 for a thumbnail, a handful for a gallery.
 */
export async function vehiclePhotoUrls(client: any, organizationId: string, perVehicle = 1, expiresIn = 6 * 3600, onlyVehicleId?: string): Promise<Map<string, string[]>> {
  const chosen = await vehiclePhotoRefs(client, organizationId, perVehicle, onlyVehicleId);
  const paths = [...chosen.values()].flat().map((ref) => ref.path);
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await client.storage.from("documents").createSignedUrls(paths, expiresIn);
    for (const row of signed || []) if (row?.path && row?.signedUrl) signedByPath.set(row.path, row.signedUrl);
  }
  const result = new Map<string, string[]>();
  for (const [vehicleId, list] of chosen) {
    const urls = list.map((ref) => signedByPath.get(ref.path)).filter(Boolean) as string[];
    if (urls.length) result.set(vehicleId, urls);
  }
  return result;
}
