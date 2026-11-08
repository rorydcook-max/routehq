"use server";

import { userError } from "@/lib/action-error";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildDocumentStoragePath } from "@/services/documents/storage-path";

/** Puts a receipt on an entry already recorded (or replaces the one it had). One photo per request, already made small on the phone. */
export async function attachReceipt(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = (await createSupabaseServerClient()) as any;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "You must be signed in." };

    const transactionId = String(formData.get("transactionId") || "").trim();
    const file = formData.get("receipt");
    if (!transactionId || !(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo of the receipt." };

    // RLS keeps this to the signed-in person's own business.
    const { data: transaction } = await supabase
      .from("transactions")
      .select("id, organization_id, vehicle_id, rental_id")
      .eq("id", transactionId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!transaction) return { ok: false, error: "That entry was not found." };

    const ownerId = transaction.vehicle_id || transaction.organization_id;
    const fileName = file.name || "receipt.jpg";
    const storagePath = buildDocumentStoragePath({ organizationId: transaction.organization_id, ownerType: "transaction", ownerId, fileName });
    const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file, { contentType: file.type || "image/jpeg", upsert: false });
    if (uploadError) return { ok: false, error: uploadError.message };

    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        organization_id: transaction.organization_id,
        owner_type: "transaction",
        owner_id: ownerId,
        storage_bucket: "documents",
        storage_path: storagePath,
        file_name: fileName,
        mime_type: file.type || "image/jpeg",
        size_bytes: file.size,
        category: "receipt",
        uploaded_by: user.id
      })
      .select("id")
      .single();
    if (documentError) return { ok: false, error: documentError.message };

    const { error: linkError } = await supabase
      .from("transactions")
      .update({ receipt_document_id: document.id })
      .eq("id", transaction.id)
      .eq("organization_id", transaction.organization_id);
    if (linkError) return { ok: false, error: linkError.message };

    revalidatePath("/transactions");
    if (transaction.vehicle_id) revalidatePath(`/fleet/${transaction.vehicle_id}`);
    if (transaction.rental_id) revalidatePath(`/bookings/${transaction.rental_id}`);
    return { ok: true };
  } catch (caught) {
    return { ok: false, error: await userError(caught, "The receipt could not be saved.") };
  }
}

/** A short-lived link to look at an entry's receipt. */
export async function receiptViewUrl(documentId: string): Promise<string | null> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: document } = await supabase.from("documents").select("storage_bucket, storage_path").eq("id", documentId).maybeSingle();
  if (!document?.storage_path) return null;
  const { data } = await supabase.storage.from(document.storage_bucket || "documents").createSignedUrl(document.storage_path, 600);
  return data?.signedUrl || null;
}
