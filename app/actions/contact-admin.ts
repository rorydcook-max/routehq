"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Admin console → Messages: mark a website message handled (or open again). Platform admins only. */
export async function setContactHandled(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id") || "");
  const handled = String(formData.get("handled") || "1") === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const db = createSupabaseAdminClient() as any;
  await db
    .from("contact_messages")
    .update(handled ? { handled_at: new Date().toISOString(), handled_by: admin.userId } : { handled_at: null, handled_by: null })
    .eq("id", id);
  revalidatePath("/platform/messages");
}
