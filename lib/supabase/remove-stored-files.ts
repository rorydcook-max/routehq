/**
 * Remove files from storage after their rows were deleted (purge_rental / purge_vehicle return the list).
 * Best effort: a file that is already gone, or a failure here, never undoes the delete.
 */
export async function removeStoredFiles(db: any, files: Array<{ bucket: string | null; path: string | null }> | null | undefined) {
  const byBucket = new Map<string, string[]>();
  for (const file of files || []) {
    if (!file?.bucket || !file?.path) continue;
    const list = byBucket.get(file.bucket) || [];
    list.push(file.path);
    byBucket.set(file.bucket, list);
  }
  for (const [bucket, paths] of byBucket) {
    for (let i = 0; i < paths.length; i += 100) {
      try {
        await db.storage.from(bucket).remove(paths.slice(i, i + 100));
      } catch {
        // Leave it: an orphaned file is harmless and the records are already gone.
      }
    }
  }
}
