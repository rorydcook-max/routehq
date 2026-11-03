"use server";

import { revalidatePath } from "next/cache";
import type { PreparedUploads, UploadRequest } from "@/lib/direct-uploads";
import { countsFor, isQueueView, listQueueRows, uploadFolderFor, verifyUploadedFiles, type HelpdeskCounts, type QueueRow } from "@/lib/helpdesk";
import { notifyOperator } from "@/lib/notify-operator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient, getRequestUser } from "@/lib/supabase/server";
import { SUPPORT_BUCKET, SUPPORT_MAX_FILE_MB, SUPPORT_MAX_FILES, cleanFileName, isPlatformAdmin } from "@/lib/support";

/**
 * The RoveHQ helpdesk's buttons (/platform/support). Every action checks the caller is a platform admin first and
 * answers "not found" otherwise: support conversations hold businesses' and visitors' private messages.
 * Words are English only, like the rest of the admin console.
 */

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const NOT_ALLOWED = "Not found.";

async function teamMember() {
  // From the signed sign-in token (getRequestUser), not a trip to the sign-in service: the queue and the open
  // conversation poll this every 15 seconds. The admin check below still asks the database.
  const [supabase, user] = (await Promise.all([createSupabaseServerClient(), getRequestUser()])) as [any, Awaited<ReturnType<typeof getRequestUser>>];
  if (!user || !(await isPlatformAdmin(supabase, user.id))) return null;
  return { userId: user.id as string, email: (user.email || null) as string | null };
}

async function findThread(id: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("support_threads")
    .select("id, organization_id, visitor_id, subject, mode, status, assigned_to, handed_off_at")
    .eq("id", String(id || ""))
    .maybeSingle();
  return data as any;
}

/** Both the old Help pages and the helpdesk show a conversation; refresh them all after a change. */
function refresh(threadId: string) {
  revalidatePath("/platform/support");
  revalidatePath(`/platform/support/${threadId}`);
  revalidatePath(`/help/${threadId}`);
  revalidatePath("/help");
}

/** A short line for a phone alert: the first line of the message. */
function firstLine(text: string) {
  const line = text.split(/\n/).map((part) => part.trim()).find(Boolean) || "";
  return line.length <= 80 ? line : `${line.slice(0, 77)}…`;
}

/** The queue for one tab. Polled every 15 seconds by the inbox. */
export async function listQueue(filters: { view?: string; search?: string }): Promise<Result<{ rows: QueueRow[]; counts: HelpdeskCounts }>> {
  const me = await teamMember();
  if (!me) return { ok: false, error: NOT_ALLOWED };
  const view = isQueueView(filters?.view) ? filters.view : "waiting";
  const [rows, counts] = await Promise.all([listQueueRows(view, String(filters?.search || ""), me.userId), countsFor(me.userId)]);
  return { ok: true, rows, counts };
}

/**
 * A short fingerprint of one conversation (its messages and its status, assignee, priority, tags), polled by the
 * conversation page: the page is only fetched again when this changes, instead of in full every 15 seconds.
 */
export async function conversationStamp(threadId: string): Promise<string> {
  const me = await teamMember();
  if (!me) return "";
  const admin = createSupabaseAdminClient() as any;
  const id = String(threadId || "");
  const [{ data: thread }, { data: latest, count }] = await Promise.all([
    admin.from("support_threads").select("mode, status, priority, tags, assigned_to, last_message_at").eq("id", id).maybeSingle(),
    admin.from("support_messages").select("id, created_at", { count: "exact" }).eq("thread_id", id).order("created_at", { ascending: false }).limit(1)
  ]);
  if (!thread) return "";
  const last = ((latest || []) as any[])[0];
  return JSON.stringify([thread.mode, thread.status, thread.priority, thread.tags, thread.assigned_to, thread.last_message_at, count || 0, last?.id || null]);
}

/** Signed upload links for files the team sends: straight from the browser to storage, in the conversation's folder. */
export async function prepareHelpdeskUploads(threadId: string, files: UploadRequest[]): Promise<PreparedUploads> {
  const me = await teamMember();
  if (!me) return { uploads: [], error: NOT_ALLOWED };
  if (!Array.isArray(files) || files.length > SUPPORT_MAX_FILES) return { uploads: [], error: `Send up to ${SUPPORT_MAX_FILES} files at a time.` };
  const thread = await findThread(threadId);
  const folder = thread ? uploadFolderFor(thread) : null;
  if (!folder) return { uploads: [], error: "This conversation was not found." };
  const admin = createSupabaseAdminClient() as any;
  const batch = crypto.randomUUID();
  const uploads = [];
  for (const [index, file] of files.entries()) {
    if (!(file.size > 0)) return { uploads: [], error: `${file.name || "A file"} is empty.` };
    if (file.size > SUPPORT_MAX_FILE_MB * 1024 * 1024) return { uploads: [], error: `${file.name || "A file"} is larger than ${SUPPORT_MAX_FILE_MB} MB.` };
    const path = `${folder}/${batch}/${index}-${cleanFileName(file.name).replace(/\s+/g, "_")}`;
    const { data, error } = await admin.storage.from(SUPPORT_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) return { uploads: [], error: error?.message || "Could not prepare the upload." };
    uploads.push({ field: file.field || "file", path, token: data.token });
  }
  return { uploads };
}

/**
 * A reply from the team, or an internal note (form fields: threadId, body, internal "1", uploadedFiles).
 * A reply is shown to the customer: business threads also get an alert (notifyOperator), visitors see it in the chat
 * widget next time it polls. A note is for the team only: never shown to the customer and never alerts anyone.
 */
export async function teamReply(formData: FormData): Promise<Result> {
  const me = await teamMember();
  if (!me) return { ok: false, error: NOT_ALLOWED };
  const thread = await findThread(String(formData.get("threadId") || ""));
  const folder = thread ? uploadFolderFor(thread) : null;
  if (!thread || !folder) return { ok: false, error: "This conversation was not found." };
  const internal = formData.get("internal") === "1";
  const body = String(formData.get("body") || "").trim().slice(0, 8000);
  const files = await verifyUploadedFiles(formData.get("uploadedFiles"), folder);
  if (!body && !files.length) return { ok: false, error: "Write a message or add a file." };

  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("support_messages").insert({
    thread_id: thread.id,
    organization_id: thread.organization_id ?? null,
    author_id: me.userId,
    from_team: true,
    from_assistant: false,
    internal,
    body,
    attachments: files
  });
  if (error) return { ok: false, error: error.message };

  if (internal) {
    // A note changes nothing the customer can see: no status change, no unread flag, no alert.
    refresh(thread.id);
    return { ok: true };
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { last_message_at: now, status: "answered", unread_by_business: true, unread_by_team: false };
  // Replying to a conversation the assistant still had means a person has taken it: stop the assistant answering.
  if (thread.mode === "ai") Object.assign(update, { mode: "human", handed_off_at: thread.handed_off_at || now });
  // Whoever answers an unclaimed conversation owns it, so two people don't both pick it up.
  if (!thread.assigned_to) update.assigned_to = me.userId;
  const { error: threadError } = await admin.from("support_threads").update(update).eq("id", thread.id);
  if (threadError) return { ok: false, error: `Sent, but the conversation couldn't be updated: ${threadError.message}` };
  if (thread.organization_id) await notifyOperator(thread.organization_id, `💬 RoveHQ replied: ${firstLine(body) || thread.subject}`, "support_reply", `/help/${thread.id}`);
  refresh(thread.id);
  return { ok: true };
}

/** Assign to someone on the team (a platform admin), or unassign with null. */
export async function assign(id: string, userId: string | null): Promise<Result> {
  const me = await teamMember();
  if (!me) return { ok: false, error: NOT_ALLOWED };
  const thread = await findThread(id);
  if (!thread) return { ok: false, error: "This conversation was not found." };
  const admin = createSupabaseAdminClient() as any;
  if (userId) {
    const { data } = await admin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    if (!data) return { ok: false, error: "Only someone on the RoveHQ team can be assigned." };
  }
  // Only change it from the state the page showed: two people pressing "Assign to me" at once can't both win.
  let update = admin.from("support_threads").update({ assigned_to: userId || null }).eq("id", thread.id);
  update = thread.assigned_to ? update.eq("assigned_to", thread.assigned_to) : update.is("assigned_to", null);
  const { data, error } = await update.select("id");
  if (error) return { ok: false, error: error.message };
  refresh(thread.id);
  if (!data?.length) return { ok: false, error: "Someone else just picked this up. The page has been refreshed." };
  return { ok: true };
}

export async function setPriority(id: string, priority: "normal" | "high"): Promise<Result> {
  const me = await teamMember();
  if (!me) return { ok: false, error: NOT_ALLOWED };
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("support_threads").update({ priority: priority === "high" ? "high" : "normal" }).eq("id", String(id || ""));
  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true };
}

/** Puts the dot back on a conversation (to come back to it later). Only "human" conversations are ever unread. */
export async function markUnread(id: string): Promise<Result> {
  const me = await teamMember();
  if (!me) return { ok: false, error: NOT_ALLOWED };
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("support_threads").update({ unread_by_team: true }).eq("id", String(id || "")).eq("mode", "human");
  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true };
}

/** Free-text tags, tidied: trimmed, lower case, no duplicates, at most 10 of 30 characters. */
export async function setTags(id: string, tags: string[]): Promise<Result<{ tags: string[] }>> {
  const me = await teamMember();
  if (!me) return { ok: false, error: NOT_ALLOWED };
  const clean = Array.from(new Set((Array.isArray(tags) ? tags : []).map((tag) => String(tag || "").trim().toLowerCase().slice(0, 30)).filter(Boolean))).slice(0, 10);
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin.from("support_threads").update({ tags: clean }).eq("id", String(id || ""));
  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true, tags: clean };
}

/** Open (waiting for us), Answered (waiting on the customer) or Closed. Reopen is "open". */
export async function setStatus(id: string, status: "open" | "answered" | "closed"): Promise<Result> {
  const me = await teamMember();
  if (!me) return { ok: false, error: NOT_ALLOWED };
  const next = status === "closed" ? "closed" : status === "answered" ? "answered" : "open";
  const admin = createSupabaseAdminClient() as any;
  // Closing means "dealt with": the unread dot goes too, or the nav badge would keep counting it.
  const update: Record<string, unknown> = next === "closed" ? { status: next, unread_by_team: false } : { status: next };
  const { error } = await admin.from("support_threads").update(update).eq("id", String(id || ""));
  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true };
}

/**
 * A person takes a conversation from the assistant: it joins the team queue, is assigned to them, and the customer
 * sees a short hello in their name so they know a human is now replying. It stays "open" (waiting for us), because the
 * customer's question still needs a real answer.
 */
export async function takeOver(id: string): Promise<Result> {
  const me = await teamMember();
  if (!me) return { ok: false, error: NOT_ALLOWED };
  const thread = await findThread(id);
  if (!thread) return { ok: false, error: "This conversation was not found." };
  if (thread.mode !== "ai") return { ok: false, error: "A person is already handling this conversation." };
  const admin = createSupabaseAdminClient() as any;
  const { data: profile } = await admin.from("users").select("full_name").eq("id", me.userId).maybeSingle();
  const first = String(profile?.full_name || "").trim().split(/\s+/)[0];
  const body = first ? `Hi, I'm ${first} from the RoveHQ team. I'll take it from here.` : "Hi, I'm from the RoveHQ team. I'll take it from here.";
  const now = new Date().toISOString();
  const { error } = await admin.from("support_messages").insert({
    thread_id: thread.id,
    organization_id: thread.organization_id ?? null,
    author_id: me.userId,
    from_team: true,
    from_assistant: false,
    internal: false,
    body,
    attachments: [],
    meta: { takeover: true }
  });
  if (error) return { ok: false, error: error.message };
  await admin
    .from("support_threads")
    .update({ mode: "human", handed_off_at: thread.handed_off_at || now, assigned_to: me.userId, status: "open", unread_by_business: true, unread_by_team: false, last_message_at: now })
    .eq("id", thread.id);
  if (thread.organization_id) await notifyOperator(thread.organization_id, `💬 RoveHQ joined your chat: ${thread.subject}`, "support_reply", `/help/${thread.id}`);
  refresh(thread.id);
  return { ok: true };
}
