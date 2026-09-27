"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PreparedUploads, UploadRequest } from "@/lib/direct-uploads";

/**
 * Shrink a phone photo before upload: at most 2000 px on the long side, JPEG.
 * A 5 MB camera photo becomes roughly 300-600 KB and is still sharp enough to
 * show a scratch. Anything that isn't a photo, or can't be read, is sent as is.
 */
export async function compressImage(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
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

/**
 * Upload every file in `formData` straight to storage and return a copy of the
 * form data with the files replaced by an `uploadedFiles` list of paths.
 *
 * `prepare` is a server action that checks the user may upload here and
 * returns one signed upload URL per file, in the same order.
 */
export async function uploadFormFiles(
  formData: FormData,
  prepare: (files: UploadRequest[]) => Promise<PreparedUploads>,
  onProgress?: (done: number, total: number) => void
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

  const files = await Promise.all(pending.map(async (item) => ({ field: item.field, file: await compressImage(item.file) })));
  const prepared = await prepare(files.map(({ field, file }) => ({ field, name: file.name, type: file.type, size: file.size })));
  if (prepared.error) throw new Error(prepared.error);
  const signed = prepared.uploads;
  if (signed.length !== files.length) throw new Error("The upload could not be prepared. Please try again.");
  const supabase = createSupabaseBrowserClient();
  const uploaded: Array<{ field: string; path: string; name: string; type: string; size: number }> = [];
  onProgress?.(0, files.length);
  for (let index = 0; index < files.length; index++) {
    const { field, file } = files[index];
    const target = signed[index];
    const { error } = await supabase.storage.from("documents").uploadToSignedUrl(target.path, target.token, file, {
      contentType: file.type || undefined
    });
    if (error) throw new Error(`${file.name} could not be uploaded (${error.message}). Check the connection and try again.`);
    uploaded.push({ field, path: target.path, name: file.name, type: file.type, size: file.size });
    onProgress?.(index + 1, files.length);
  }
  next.set("uploadedFiles", JSON.stringify(uploaded));
  return next;
}
