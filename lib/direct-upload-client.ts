"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PreparedUploads, UploadRequest } from "@/lib/direct-uploads";

/**
 * Shrink a phone photo before upload: at most 1600 px on the long side, JPEG.
 * A 5 MB camera photo becomes roughly 150-300 KB (about 40% less than at
 * 2000 px), so a handover's photos go up in seconds on mobile data, and it is
 * still sharp enough to show a scratch. Anything that isn't a photo, or can't
 * be read, is sent as is.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.75): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 400 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** A copy of the form data with every photo shrunk (see compressImage). */
export async function compressFormImages(formData: FormData): Promise<FormData> {
  const next = new FormData();
  for (const [field, value] of formData.entries()) {
    next.append(field, value instanceof File && value.size > 0 ? await compressImage(value) : value);
  }
  return next;
}

/**
 * Wrap a server action used as a form action so photos are shrunk in the
 * browser first. Keeps each request under Vercel's 4.5 MB limit for forms
 * that send one or a few photos.
 */
export function withCompressedImages<T>(action: (formData: FormData) => Promise<T>) {
  return async (formData: FormData) => action(await compressFormImages(formData));
}

type Uploaded = { field: string; path: string; name: string; type: string; size: number };
type Prepare = (files: UploadRequest[]) => Promise<PreparedUploads>;

// Photos start uploading the moment they are taken, while the person carries on
// through the form; at "Finish" only the ones not yet sent still have to go.
const early = new Map<File, Promise<Uploaded>>();

async function sendOne(field: string, original: File, prepare: Prepare, bucket: string): Promise<Uploaded> {
  const file = await compressImage(original);
  const prepared = await prepare([{ field, name: file.name, type: file.type, size: file.size }]);
  if (prepared.error) throw new Error(prepared.error);
  const target = prepared.uploads[0];
  if (!target) throw new Error("The upload could not be prepared. Please try again.");
  const { error } = await createSupabaseBrowserClient().storage.from(bucket).uploadToSignedUrl(target.path, target.token, file, {
    contentType: file.type || undefined
  });
  if (error) throw new Error(`${file.name} could not be uploaded (${error.message}). Check the connection and try again.`);
  return { field, path: target.path, name: file.name, type: file.type, size: file.size };
}

/** Start sending a photo now, in the background. A failure is quiet: it is simply sent again at submit. */
export function startEarlyUpload(field: string, file: File, prepare: Prepare, bucket = "documents") {
  if (!field || !(file?.size > 0) || early.has(file)) return;
  const job = sendOne(field, file, prepare, bucket);
  early.set(file, job);
  job.catch(() => early.delete(file));
}

/**
 * Upload every file in `formData` straight to storage and return a copy of the
 * form data with the files replaced by an `uploadedFiles` list of paths.
 * Files already sent by startEarlyUpload are not sent again.
 *
 * `prepare` is a server action that checks the user may upload here and
 * returns one signed upload URL per file, in the same order.
 */
export async function uploadFormFiles(
  formData: FormData,
  prepare: (files: UploadRequest[]) => Promise<PreparedUploads>,
  onProgress?: (done: number, total: number) => void,
  bucket = "documents"
): Promise<FormData> {
  const next = new FormData();
  const pending: Array<{ field: string; file: File }> = [];
  for (const [field, value] of formData.entries()) {
    if (value instanceof File) {
      if (value.size > 0) pending.push({ field, file: value });
    } else {
      next.append(field, value);
    }
  }
  if (pending.length === 0) return next;

  // Already sent (or on its way) in the background: wait for it rather than sending it twice.
  const ready: Uploaded[] = [];
  const rest: Array<{ field: string; file: File }> = [];
  await Promise.all(
    pending.map(async (item) => {
      const job = early.get(item.file);
      if (job) {
        try {
          ready.push({ ...(await job), field: item.field });
          return;
        } catch {
          // Fell over in the background: send it now with the rest.
        }
      }
      rest.push(item);
    })
  );
  if (rest.length === 0) {
    onProgress?.(pending.length, pending.length);
    next.set("uploadedFiles", JSON.stringify(ready));
    return next;
  }
  const sentEarly = ready.length;
  pending.length = 0;
  pending.push(...rest);

  const files = await Promise.all(pending.map(async (item) => ({ field: item.field, file: await compressImage(item.file) })));
  const prepared = await prepare(files.map(({ field, file }) => ({ field, name: file.name, type: file.type, size: file.size })));
  if (prepared.error) throw new Error(prepared.error);
  const signed = prepared.uploads;
  if (signed.length !== files.length) throw new Error("The upload could not be prepared. Please try again.");
  const supabase = createSupabaseBrowserClient();
  const uploaded: Array<{ field: string; path: string; name: string; type: string; size: number } | undefined> = new Array(files.length);
  const total = files.length + sentEarly;
  onProgress?.(sentEarly, total);
  // Three at a time: much quicker than one by one on mobile data, without crowding a weak connection.
  let nextIndex = 0;
  let done = sentEarly;
  const worker = async () => {
    while (nextIndex < files.length) {
      const index = nextIndex++;
      const { field, file } = files[index];
      const target = signed[index];
      const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(target.path, target.token, file, {
        contentType: file.type || undefined
      });
      if (error) throw new Error(`${file.name} could not be uploaded (${error.message}). Check the connection and try again.`);
      uploaded[index] = { field, path: target.path, name: file.name, type: file.type, size: file.size };
      onProgress?.(++done, total);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
  next.set("uploadedFiles", JSON.stringify([...ready, ...uploaded.filter(Boolean)]));
  return next;
}
