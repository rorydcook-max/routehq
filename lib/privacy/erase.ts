/**
 * Deleting personal data (GDPR Art. 17, UK GDPR, Thai PDPA s.33), 3 Nov 2026. Server only (service role).
 * The database work is in SQL functions (migration 0119_privacy_rights): they return the storage files to remove,
 * which are removed here afterwards (a file that is already gone is not an error).
 *
 * - eraseCustomer: a renter asked their rental business to delete them. Details, ID photos, messages and reports go;
 *   bookings, payments and signed agreements stay under "Deleted customer" for the business's accounts.
 * - purgeBusiness: an owner deleted their business. Everything goes (Rory: delete removes everything).
 * - runIdPhotoRetention: the daily job that deletes renters' ID photos N months after their last rental.
 */

type Admin = any;
type StorageFile = { bucket: string | null; path: string | null };

/** Not installed yet (migration 0119 not applied): callers say "not available yet" instead of failing silently. */
export class PrivacyFunctionMissing extends Error {}

const missingFunction = (error: { code?: string; message?: string } | null) => Boolean(error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message || "")));

/** Removes files from storage, grouped by bucket, 100 at a time. Returns how many were asked to go. */
export async function removeStorageFiles(admin: Admin, files: StorageFile[]) {
  const byBucket = new Map<string, Set<string>>();
  for (const file of files) {
    if (!file.bucket || !file.path) continue;
    byBucket.set(file.bucket, (byBucket.get(file.bucket) || new Set()).add(file.path));
  }
  let removed = 0;
  for (const [bucket, paths] of byBucket) {
    const list = [...paths];
    for (let i = 0; i < list.length; i += 100) {
      const chunk = list.slice(i, i + 100);
      const { error } = await admin.storage.from(bucket).remove(chunk);
      if (error) console.error("[privacy] storage remove failed", bucket, error.message);
      else removed += chunk.length;
    }
  }
  return removed;
}

/** Deletes one customer's personal data and ID photos; keeps their bookings and payments anonymised. */
export async function eraseCustomer(admin: Admin, customerId: string) {
  const { data, error } = await admin.rpc("erase_customer", { p_customer: customerId });
  if (missingFunction(error)) throw new PrivacyFunctionMissing("erase_customer");
  if (error) throw new Error(error.message);
  return removeStorageFiles(admin, (data || []) as StorageFile[]);
}

/** Deletes a business and everything in it. People's sign-in accounts stay (they may work for other businesses). */
export async function purgeBusiness(admin: Admin, organizationId: string) {
  const { data, error } = await admin.rpc("purge_organization_data", { p_organization_id: organizationId });
  if (missingFunction(error)) throw new PrivacyFunctionMissing("purge_organization_data");
  if (error) throw new Error(error.message);
  return removeStorageFiles(admin, (data || []) as StorageFile[]);
}

/**
 * How the daily ID-photo job runs, from ID_PHOTO_RETENTION:
 *   unset or "dry-run" (default): finds what would be deleted for every business (as if each had it switched on, with
 *     its months or the default 24) and only logs counts. Nothing is deleted.
 *   "on": deletes, but only for businesses whose owner switched automatic deletion on (My account).
 *   "off": does nothing.
 */
export function idPhotoRetentionMode(): "off" | "dry-run" | "on" {
  const value = String(process.env.ID_PHOTO_RETENTION || "dry-run").trim().toLowerCase();
  return value === "on" ? "on" : value === "off" ? "off" : "dry-run";
}

/** Small batches, so one run never does too much at once; the rest goes on the following days. */
const BATCH = 200;

export async function runIdPhotoRetention(admin: Admin) {
  const mode = idPhotoRetentionMode();
  if (mode === "off") return { mode, found: 0, deleted: 0 };
  const { data, error } = await admin.rpc("id_photo_retention_candidates", { p_limit: BATCH, p_only_enabled: mode === "on" });
  if (error) {
    console.error("[id-photo-retention]", error.message);
    return { mode, found: 0, deleted: 0, error: error.message };
  }
  const rows = (data || []) as Array<{ document_id: string; organization_id: string; customer_id: string; bucket: string; path: string; last_rental_end: string; months: number }>;
  const businesses = new Set(rows.map((row) => row.organization_id)).size;
  const customers = new Set(rows.map((row) => row.customer_id)).size;
  if (mode === "dry-run") {
    console.log(`[id-photo-retention] dry run: ${rows.length} ID photos of ${customers} renters in ${businesses} businesses would be deleted (first ${BATCH}). Nothing deleted.`);
    return { mode, found: rows.length, deleted: 0, customers, businesses };
  }
  let deleted = 0;
  for (const row of rows) {
    const { error: removeError } = await admin.storage.from(row.bucket).remove([row.path]);
    if (removeError) {
      console.error("[id-photo-retention] file not removed, row kept", row.document_id, removeError.message);
      continue;
    }
    const { error: rowError } = await admin.from("documents").delete().eq("id", row.document_id).eq("organization_id", row.organization_id).eq("owner_type", "customer");
    if (rowError) console.error("[id-photo-retention] row not deleted", row.document_id, rowError.message);
    else deleted += 1;
  }
  console.log(`[id-photo-retention] deleted ${deleted} of ${rows.length} ID photos (${customers} renters, ${businesses} businesses).`);
  return { mode, found: rows.length, deleted, customers, businesses };
}
