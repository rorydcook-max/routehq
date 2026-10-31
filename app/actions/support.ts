"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import type { PreparedUploads, UploadRequest } from "@/lib/direct-uploads";
import { said } from "@/lib/i18n/server-text";
import { notifyOperator } from "@/lib/notify-operator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  SUPPORT_BUCKET,
  SUPPORT_CHANNELS,
  SUPPORT_MAX_FILE_MB,
  SUPPORT_MAX_FILES,
  SUPPORT_TOPICS,
  alertTeam,
  cleanFileName,
  isPlatformAdmin,
  type SupportAttachment,
  type SupportTopic
} from "@/lib/support";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

async function who() {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const supabase = (await createSupabaseServerClient()) as any;
  const team = await isPlatformAdmin(supabase, membership.userId);
  return { membership, team };
}

/** Signed upload links for files going with a Help message: straight from the phone to storage, under the business's own folder. */
export async function prepareSupportUploads(files: UploadRequest[], teamThreadId?: string): Promise<PreparedUploads> {
  const me = await who();
  if (!me) return { uploads: [], error: await said("Please sign in first.") };
  if (!Array.isArray(files) || files.length > SUPPORT_MAX_FILES) return { uploads: [], error: await said(`Send up to ${SUPPORT_MAX_FILES} files at a time.`) };
  const admin = createSupabaseAdminClient() as any;
  // The team's files go into the business's folder, so the business can always open them.
  let folder = me.membership.organizationId;
  if (teamThreadId && me.team) {
    const { data: thread } = await admin.from("support_threads").select("organization_id").eq("id", teamThreadId).maybeSingle();
    if (thread?.organization_id) folder = thread.organization_id;
  }
  const batch = crypto.randomUUID();
  const uploads = [];
  for (const [index, file] of files.entries()) {
    if (!(file.size > 0)) return { uploads: [], error: await said(`${file.name || "A file"} is empty.`) };
    if (file.size > SUPPORT_MAX_FILE_MB * 1024 * 1024) return { uploads: [], error: await said(`${file.name || "A file"} is larger than ${SUPPORT_MAX_FILE_MB} MB.`) };
    const path = `${folder}/${batch}/${index}-${cleanFileName(file.name).replace(/\s+/g, "_")}`;
    const { data, error } = await admin.storage.from(SUPPORT_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) return { uploads: [], error: error?.message || (await said("Could not prepare the upload.")) };
    uploads.push({ field: file.field || "file", path, token: data.token });
  }
  return { uploads };
}

/** Files the browser says it uploaded, kept only if they are in this business's folder and really in storage. */
async function readFiles(formData: FormData, organizationId: string): Promise<SupportAttachment[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("uploadedFiles") || "[]"));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const admin = createSupabaseAdminClient() as any;
  const files: SupportAttachment[] = [];
  for (const entry of parsed.slice(0, SUPPORT_MAX_FILES)) {
    const path = String(entry?.path || "");
    if (!path.startsWith(`${organizationId}/`) || path.includes("..")) continue;
    const folder = path.slice(0, path.lastIndexOf("/"));
    const fileName = path.slice(path.lastIndexOf("/") + 1);
    const { data } = await admin.storage.from(SUPPORT_BUCKET).list(folder, { search: fileName, limit: 1 });
    const stored = (data || []).find((item: any) => item.name === fileName);
    if (!stored) continue;
    files.push({
      path,
      name: String(entry?.name || fileName).slice(0, 200),
      size: Number(stored.metadata?.size || entry?.size || 0),
      type: String(stored.metadata?.mimetype || entry?.type || "")
    });
  }
  return files;
}

/** A short title from a message: its first sentence, or as many whole words as fit. */
function firstLine(text: string) {
  const line = text.split(/\n/).map((part) => part.trim()).find(Boolean) || "";
  const sentence = line.match(/^.{12,90}?[.!?。](?=\s|$)/)?.[0];
  if (sentence) return sentence.replace(/[.。]$/, "");
  if (line.length <= 70) return line;
  const cut = line.slice(0, 70);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).replace(/[,;:\s]+$/, "")}…`;
}

/** A business starts a conversation with the RoveHQ team. */
export async function startSupportThread(formData: FormData): Promise<Result<{ id: string }>> {
  const me = await who();
  if (!me) return { ok: false, error: await said("Please sign in first.") };
  const topic = (SUPPORT_TOPICS as readonly string[]).includes(String(formData.get("topic"))) ? (String(formData.get("topic")) as SupportTopic) : "question";
  const body = String(formData.get("body") || "").trim().slice(0, 8000);
  const organizationId = me.membership.organizationId;
  const files = await readFiles(formData, organizationId);
  if (!body && !files.length) return { ok: false, error: await said("Write a message or add a file.") };
  const subject = String(formData.get("subject") || "").trim().slice(0, 120) || firstLine(body) || (await said("Files to import"));

  const admin = createSupabaseAdminClient() as any;
  const { data: thread, error } = await admin
    .from("support_threads")
    .insert({ organization_id: organizationId, created_by: me.membership.userId, topic, subject, status: "open", unread_by_team: true, unread_by_business: false })
    .select("id")
    .single();
  if (error || !thread) return { ok: false, error: error?.message || (await said("Could not send. Please try again.")) };
  const { error: messageError } = await admin.from("support_messages").insert({ thread_id: thread.id, organization_id: organizationId, author_id: me.membership.userId, from_team: false, body, attachments: files });
  if (messageError) {
    await admin.from("support_threads").delete().eq("id", thread.id);
    return { ok: false, error: messageError.message };
  }
  const { data: org } = await admin.from("organizations").select("name").eq("id", organizationId).maybeSingle();
  await alertTeam(`${org?.name || "A business"} (${topic}): ${subject}${files.length ? ` · ${files.length} file${files.length === 1 ? "" : "s"}` : ""}`, thread.id);
  revalidatePath("/help");
  return { ok: true, id: thread.id };
}

/** A reply in a conversation, from the business or (for platform admins on the team page) from RoveHQ. */
export async function replySupportThread(formData: FormData): Promise<Result> {
  const me = await who();
  if (!me) return { ok: false, error: await said("Please sign in first.") };
  const threadId = String(formData.get("threadId") || "");
  const asTeam = formData.get("asTeam") === "1" && me.team;
  const admin = createSupabaseAdminClient() as any;
  const { data: thread } = await admin.from("support_threads").select("id, organization_id, subject").eq("id", threadId).maybeSingle();
  if (!thread) return { ok: false, error: await said("This conversation was not found.") };
  if (!asTeam && thread.organization_id !== me.membership.organizationId) return { ok: false, error: await said("Switch to the business you want to work in and try again.") };
  const body = String(formData.get("body") || "").trim().slice(0, 8000);
  const files = await readFiles(formData, thread.organization_id);
  if (!body && !files.length) return { ok: false, error: await said("Write a message or add a file.") };

  const { error } = await admin.from("support_messages").insert({ thread_id: thread.id, organization_id: thread.organization_id, author_id: me.membership.userId, from_team: asTeam, body, attachments: files });
  if (error) return { ok: false, error: error.message };
  const now = new Date().toISOString();
  if (asTeam) {
    await admin.from("support_threads").update({ last_message_at: now, status: "answered", unread_by_business: true, unread_by_team: false }).eq("id", thread.id);
    await notifyOperator(thread.organization_id, `💬 RoveHQ replied: ${firstLine(body) || thread.subject}`, "support_reply", `/help/${thread.id}`);
  } else {
    await admin.from("support_threads").update({ last_message_at: now, status: "open", unread_by_team: true }).eq("id", thread.id);
    const { data: org } = await admin.from("organizations").select("name").eq("id", thread.organization_id).maybeSingle();
    await alertTeam(`${org?.name || "A business"} replied: ${firstLine(body) || thread.subject}`, thread.id);
  }
  revalidatePath(`/help/${thread.id}`);
  revalidatePath(`/help/team/${thread.id}`);
  return { ok: true };
}

/** Sorted, or opened again. Either side may do it. */
export async function setSupportThreadStatus(input: { threadId: string; status: "open" | "closed" }): Promise<Result> {
  const me = await who();
  if (!me) return { ok: false, error: await said("Please sign in first.") };
  const admin = createSupabaseAdminClient() as any;
  const { data: thread } = await admin.from("support_threads").select("id, organization_id").eq("id", input.threadId).maybeSingle();
  if (!thread || (!me.team && thread.organization_id !== me.membership.organizationId)) return { ok: false, error: await said("This conversation was not found.") };
  await admin.from("support_threads").update({ status: input.status === "closed" ? "closed" : "open" }).eq("id", thread.id);
  revalidatePath(`/help/${thread.id}`);
  revalidatePath(`/help/team/${thread.id}`);
  revalidatePath("/help");
  revalidatePath("/help/team");
  return { ok: true };
}

/** How the business prefers to hear back from RoveHQ. */
export async function saveSupportPreference(input: { channel: string; handle: string }): Promise<Result> {
  const me = await who();
  if (!me) return { ok: false, error: await said("Please sign in first.") };
  if (me.membership.role !== "owner") return { ok: false, error: await said("Only the business owner can change this.") };
  const channel = (SUPPORT_CHANNELS as readonly string[]).includes(input.channel) ? input.channel : "app";
  const handle = String(input.handle || "").trim().slice(0, 120);
  if (channel !== "app" && !handle) return { ok: false, error: await said(channel === "email" ? "Add the email address to reply to." : channel === "line" ? "Add your LINE ID." : "Add your WhatsApp number.") };
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: org } = await supabase.from("organizations").select("settings").eq("id", me.membership.organizationId).maybeSingle();
  const current = (org?.settings && typeof org.settings === "object" ? org.settings : {}) as Record<string, unknown>;
  const { error } = await supabase.from("organizations").update({ settings: { ...current, support: { channel, handle } } }).eq("id", me.membership.organizationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/help");
  return { ok: true };
}
