"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth/roles";
import { logAdminAction, requirePlatformAdmin } from "@/lib/admin";
import { notifyOperator } from "@/lib/notify-operator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * "We'll set it up for you" (Rory, 2 Nov 2026): a business sends what it keeps today (notebook photos, spreadsheets,
 * chat exports, a note) and RoveHQ support brings it in with the importer, where the AI reads it and a person checks
 * every card before anything is saved. The owner is told when it's done.
 */

export type SetupFile = { path: string; name: string; type: string; size: number };

const MAX_FILES = 30;
const MAX_BYTES = 4_000_000;

/** One file per request (a phone photo, made small first, or a spreadsheet), kept with the business's documents. */
export async function uploadSetupFile(formData: FormData): Promise<{ ok: true; file: SetupFile } | { ok: false; error: string }> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "signed_out" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "no_file" };
  if (file.size > MAX_BYTES) return { ok: false, error: "too_big" };
  const safe = (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
  const path = `${membership.organizationId}/setup-requests/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.storage.from("documents").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) return { ok: false, error: "upload_failed" };
  return { ok: true, file: { path, name: file.name || safe, type: file.type || "", size: file.size } };
}

export async function submitSetupRequest(input: { note: string; files: SetupFile[] }): Promise<{ ok: boolean }> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false };
  const prefix = `${membership.organizationId}/setup-requests/`;
  const files = (input.files || []).filter((file) => typeof file?.path === "string" && file.path.startsWith(prefix)).slice(0, MAX_FILES);
  const note = String(input.note || "").trim().slice(0, 4000);
  if (!files.length && !note) return { ok: false };
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("setup_requests").insert({ organization_id: membership.organizationId, requested_by: membership.userId, note: note || null, files });
  if (error) return { ok: false };
  revalidatePath("/platform/setup");
  return { ok: true };
}

/** RoveHQ admin: a request is being worked on, or done (the owner gets a notification). */
export async function adminSetSetupRequestStatus(formData: FormData) {
  const adminUser = await requirePlatformAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !["new", "in_progress", "done"].includes(status)) return;
  const db = createSupabaseAdminClient() as any;
  const { data: request } = await db.from("setup_requests").select("id, organization_id, status").eq("id", id).maybeSingle();
  if (!request) return;
  await db
    .from("setup_requests")
    .update({ status, handled_by: adminUser.userId, handled_at: new Date().toISOString(), admin_note: String(formData.get("adminNote") || "").trim().slice(0, 2000) || null })
    .eq("id", id);
  await logAdminAction(adminUser, { action: `setup_request_${status}`, organizationId: request.organization_id, details: { request_id: id } });
  if (status === "done" && request.status !== "done") {
    await notifyOperator(request.organization_id, "✅ Your records are in RoveHQ. Have a look at your vehicles and bookings.", "setup_done", "/").catch(() => null);
  }
  revalidatePath("/platform/setup");
  redirect("/platform/setup" as any);
}
