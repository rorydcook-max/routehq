/**
 * Each vehicle's photos as signed links, in the order set on the vehicle page (the main photo first).
 * `perVehicle` caps how many are signed for each vehicle: 1 for a thumbnail, a handful for a gallery.
 */
export async function vehiclePhotoUrls(client: any, organizationId: string, perVehicle = 1, expiresIn = 6 * 3600, onlyVehicleId?: string): Promise<Map<string, string[]>> {
  let query = client
    .from("documents")
    .select("owner_id, storage_path, extracted_data, created_at")
    .eq("organization_id", organizationId)
    .eq("owner_type", "vehicle")
    .eq("category", "vehicle_photo")
    .is("deleted_at", null);
  if (onlyVehicleId) query = query.eq("owner_id", onlyVehicleId);
  const { data } = await query.order("created_at", { ascending: true });

  const byVehicle = new Map<string, Array<{ path: string; order: number; index: number }>>();
  ((data || []) as any[]).forEach((row, index) => {
    if (!row.owner_id || !row.storage_path) return;
    const list = byVehicle.get(row.owner_id) || [];
    const order = Number(row.extracted_data?.vehicle_photo_order);
    list.push({ path: row.storage_path, order: Number.isFinite(order) ? order : 9999, index });
    byVehicle.set(row.owner_id, list);
  });

  const chosen = new Map<string, string[]>();
  for (const [vehicleId, list] of byVehicle) {
    chosen.set(vehicleId, list.sort((a, b) => a.order - b.order || a.index - b.index).slice(0, perVehicle).map((item) => item.path));
  }
  const paths = [...chosen.values()].flat();
  const signedByPath = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await client.storage.from("documents").createSignedUrls(paths, expiresIn);
    for (const row of signed || []) if (row?.path && row?.signedUrl) signedByPath.set(row.path, row.signedUrl);
  }
  const result = new Map<string, string[]>();
  for (const [vehicleId, list] of chosen) {
    const urls = list.map((path) => signedByPath.get(path)).filter(Boolean) as string[];
    if (urls.length) result.set(vehicleId, urls);
  }
  return result;
}
