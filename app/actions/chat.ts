"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { answerQuestion, type AskTurn } from "@/lib/ask";
import {
  VISITOR_COOKIE,
  chatFolder,
  chatMessages,
  chatWho,
  classifyFiles,
  isHowTo,
  loadChatThread,
  readChatFiles,
  replyForFiles,
  subjectFrom,
  threadInfo,
  visitorOverLimit,
  wantsPerson,
  type ChatMessage,
  type ChatMeta,
  type ChatThreadInfo,
  type ChatWho
} from "@/lib/chat";
import type { ChatActionChip, ChatFileKind } from "@/lib/chat-suggestions";
import { logSupportQuestion } from "@/lib/content-requests";
import type { PreparedUploads, UploadRequest } from "@/lib/direct-uploads";
import { said } from "@/lib/i18n/server-text";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { answerSupportQuestion, isContentRequest } from "@/lib/support-assistant";
import { SUPPORT_BUCKET, SUPPORT_MAX_FILE_MB, SUPPORT_MAX_FILES, alertTeam, cleanFileName, type SupportAttachment } from "@/lib/support";

type Fail = { ok: false; error: string };
type ChatResult = { ok: true; thread: ChatThreadInfo; messages: ChatMessage[] } | Fail;

/** The reader's language, in English, for the models ("Thai"). */
async function readerLanguage() {
  try {
    const locale = await getLocale();
    return supportedLocaleOptions.find((option) => option.code === locale)?.english || "English";
  } catch {
    return "English";
  }
}

/**
 * The person chatting, giving a website visitor their cookie on their first message or upload (an action is the only
 * place a cookie can be set). Signed-in people never get one: they chat as their business.
 */
async function ensureWho(): Promise<ChatWho> {
  const who = await chatWho();
  if (who) return who;
  const visitorId = crypto.randomUUID();
  const jar = await cookies();
  jar.set(VISITOR_COOKIE, visitorId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return { kind: "visitor", visitorId };
}

/** What the panel needs to pick its starters: signed in or not, and whether they're the owner (records questions). */
export async function chatContext(): Promise<{ signedIn: boolean; owner: boolean }> {
  const who = await chatWho();
  return { signedIn: who?.kind === "member", owner: who?.kind === "member" && who.role === "owner" };
}

/** Signed upload links for the chat's files, straight from the phone to storage, in this person's own folder. */
export async function prepareChatUploads(files: UploadRequest[]): Promise<PreparedUploads> {
  const who = await ensureWho();
  if (!Array.isArray(files) || files.length > SUPPORT_MAX_FILES) return { uploads: [], error: await said(`Send up to ${SUPPORT_MAX_FILES} files at a time.`) };
  const admin = createSupabaseAdminClient() as any;
  if (who.kind === "visitor" && (await visitorOverLimit(admin, who.visitorId))) return { uploads: [], error: await said("You've sent a lot of messages in the last hour. Please try again a little later.") };
  const batch = crypto.randomUUID();
  const uploads = [];
  for (const [index, file] of files.entries()) {
    if (!(file.size > 0)) return { uploads: [], error: await said(`${file.name || "A file"} is empty.`) };
    if (file.size > SUPPORT_MAX_FILE_MB * 1024 * 1024) return { uploads: [], error: await said(`${file.name || "A file"} is larger than ${SUPPORT_MAX_FILE_MB} MB.`) };
    const path = `${chatFolder(who)}/${batch}/${index}-${cleanFileName(file.name).replace(/\s+/g, "_")}`;
    const { data, error } = await admin.storage.from(SUPPORT_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) return { uploads: [], error: error?.message || (await said("Could not prepare the upload.")) };
    uploads.push({ field: file.field || "file", path, token: data.token });
  }
  return { uploads };
}

async function createThread(admin: any, who: ChatWho, subject: string, pathname: string | null, human: boolean) {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("support_threads")
    .insert({
      organization_id: who.kind === "member" ? who.organizationId : null,
      visitor_id: who.kind === "visitor" ? who.visitorId : null,
      created_by: who.kind === "member" ? who.userId : null,
      topic: "question",
      subject: subject.slice(0, 120),
      status: "open",
      channel: "chat",
      mode: human ? "human" : "ai",
      handed_off_at: human ? now : null,
      // Not in the team's queue until it's handed over.
      unread_by_team: human,
      unread_by_business: false,
      page: pathname,
      last_message_at: now
    })
    .select("id, organization_id, visitor_id, created_by, mode, status, subject, visitor_email, channel, unread_by_business")
    .single();
  if (error) console.warn("[chat] thread insert failed:", error.message);
  return data || null;
}

async function addMessage(admin: any, thread: any, who: ChatWho | null, row: { body: string; fromAssistant?: boolean; attachments?: SupportAttachment[]; meta?: ChatMeta }) {
  const { data, error } = await admin
    .from("support_messages")
    .insert({
      thread_id: thread.id,
      organization_id: thread.organization_id || null,
      author_id: !row.fromAssistant && who?.kind === "member" ? who.userId : null,
      from_team: false,
      from_assistant: Boolean(row.fromAssistant),
      internal: false,
      body: row.body.slice(0, 8000),
      attachments: row.attachments || [],
      meta: row.meta || {}
    })
    .select("id, created_at")
    .single();
  if (error) throw new Error(error.message);
  await admin.from("support_threads").update({ last_message_at: new Date().toISOString() }).eq("id", thread.id);
  return data as { id: string; created_at: string };
}

/** Who to name in the team's alert. */
async function senderName(admin: any, who: ChatWho, thread: any) {
  if (who.kind === "visitor") return thread.visitor_email ? `Website visitor (${thread.visitor_email})` : "Website visitor";
  const { data: org } = await admin.from("organizations").select("name").eq("id", who.organizationId).maybeSingle();
  return String(org?.name || "A business");
}

/** Passes the chat to the RoveHQ team: into their queue, an alert, and a note in the chat saying a person will reply. */
async function handOver(admin: any, thread: any, who: ChatWho) {
  if (thread.mode !== "human") {
    await admin
      .from("support_threads")
      .update({ mode: "human", handed_off_at: new Date().toISOString(), status: "open", unread_by_team: true })
      .eq("id", thread.id);
    thread.mode = "human";
    await addMessage(admin, thread, who, {
      body: await said("I've passed this to the RoveHQ team. A person will reply here, usually within a few hours. You can close this and come back."),
      fromAssistant: true,
      meta: { handoff: true }
    });
    await alertTeam(`${await senderName(admin, who, thread)} (live chat): ${thread.subject}`, thread.id);
  }
}

/** Earlier turns, so a follow-up ("the red one") makes sense. Team replies aren't sent to the models. */
async function historyFor(admin: any, threadId: string, beforeId: string): Promise<AskTurn[]> {
  const { data } = await admin
    .from("support_messages")
    .select("id, from_team, from_assistant, internal, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(10);
  return ((data || []) as any[])
    .filter((row) => row.id !== beforeId && !row.internal && !row.from_team && String(row.body || "").trim())
    .reverse()
    .slice(-8)
    .map((row) => ({ role: row.from_assistant ? ("assistant" as const) : ("user" as const), content: String(row.body).slice(0, 1500) }));
}

/** A record question about the thing on screen ("When does its tax run out?") needs to know which thing. */
function withPageContext(text: string, pathname: string | null) {
  const vehicle = String(pathname || "").match(/^\/fleet\/([0-9a-f-]{36})/i)?.[1];
  if (vehicle) return `${text} (about the vehicle on screen, id ${vehicle})`.slice(0, 500);
  const booking = String(pathname || "").match(/^\/bookings\/([0-9a-f-]{36})/i)?.[1];
  if (booking) return `${text} (about the booking on screen, id ${booking})`.slice(0, 500);
  return text;
}

/**
 * One message from the chat panel. The first one creates the chat. Then, in order:
 * - handed over already: it goes to the team, no AI reply;
 * - asks for a person (in words, or the Talk to a person chip): hand over;
 * - has files: say where they go, with a card to that screen (the file handed over where it can be);
 * - an owner's question about their business: the records assistant (proposals confirmed with confirmAssistantAction);
 * - anything else, any teammate, any visitor: the help-centre assistant, logged for the content queue as before.
 */
export async function chatSend(input: {
  threadId?: string | null;
  text: string;
  files?: Array<{ path: string; name?: string; type?: string; size?: number }>;
  pathname?: string | null;
  route?: "records" | "support" | null;
  action?: ChatActionChip | null;
}): Promise<ChatResult> {
  try {
    const who = await ensureWho();
    const admin = createSupabaseAdminClient() as any;
    const text = String(input.text || "").trim().slice(0, 4000);
    const pathname = typeof input.pathname === "string" && input.pathname.startsWith("/") ? input.pathname.slice(0, 200) : null;
    const files = await readChatFiles(admin, input.files, chatFolder(who));
    if (!text && !files.length) return { ok: false, error: await said("Write a message or add a file.") };
    if (who.kind === "visitor" && (await visitorOverLimit(admin, who.visitorId))) {
      return { ok: false, error: await said("You've sent a lot of messages in the last hour. Please try again a little later.") };
    }

    let thread = input.threadId ? await loadChatThread(admin, input.threadId, who) : null;
    if (!thread) thread = await createThread(admin, who, subjectFrom(text, files.length ? await said("Files") : await said("Live chat")), pathname, false);
    if (!thread) return { ok: false, error: await said("Could not send. Please try again.") };

    const userMessage = await addMessage(admin, thread, who, { body: text, attachments: files });
    const since = new Date(Date.parse(userMessage.created_at) - 1).toISOString();
    const finish = async (): Promise<ChatResult> => ({ ok: true, thread: threadInfo(thread), messages: await chatMessages(admin, thread.id, since) });

    // With the team: they answer, not the assistant. Back in their queue as waiting.
    if (thread.mode === "human") {
      await admin.from("support_threads").update({ status: "open", unread_by_team: true }).eq("id", thread.id);
      thread.status = "open";
      await alertTeam(`${await senderName(admin, who, thread)} (live chat): ${subjectFrom(text, thread.subject)}`, thread.id);
      return finish();
    }

    if (input.action === "handoff" || wantsPerson(text)) {
      await handOver(admin, thread, who);
      return finish();
    }

    if (files.length) {
      // The chip they picked ("Record a receipt") says what the files are; "handoff" was dealt with above.
      const chosen: ChatFileKind | null = input.action || null;
      const kind = await classifyFiles(admin, files, text, chosen);
      const reply = replyForFiles(kind, files, who, pathname);
      const action = reply.action ? { ...reply.action, label: await said(reply.action.label) } : undefined;
      await addMessage(admin, thread, who, { body: await said(reply.body), fromAssistant: true, meta: { action, offerHandoff: reply.offerHandoff } });
      return finish();
    }

    const language = await readerLanguage();
    const history = await historyFor(admin, thread.id, userMessage.id);
    const owner = who.kind === "member" && who.role === "owner";
    // The records assistant reads the figures: owners only, and not for how-to questions (unless a chip said so).
    const records = owner && input.route !== "support" && (input.route === "records" || !isHowTo(text));
    if (records) {
      const answer = await answerQuestion(withPageContext(text, pathname), language, history);
      if (answer.ok) await addMessage(admin, thread, who, { body: answer.answer, fromAssistant: true, meta: { links: answer.links, proposal: answer.proposal } });
      else await addMessage(admin, thread, who, { body: await said(answer.error), fromAssistant: true, meta: { error: true, offerHandoff: true } });
      return finish();
    }

    const answer = await answerSupportQuestion({ question: text, pathname, history, language, role: who.kind === "member" ? who.role : "visitor" });
    if (answer.ok) {
      await addMessage(admin, thread, who, { body: answer.answer, fromAssistant: true, meta: { articles: answer.articles, offerHandoff: answer.handoff } });
      // Kept for the team's content queue, as the old question box did. After the reply, so it never slows it down.
      const logged = {
        organizationId: who.kind === "member" ? who.organizationId : null,
        userId: who.kind === "member" ? who.userId : null,
        question: text.slice(0, 500),
        pathname,
        articles: answer.articles.map((article) => article.slug),
        handoff: answer.handoff,
        request: answer.request === true || isContentRequest(text)
      };
      try {
        after(() => logSupportQuestion(logged));
      } catch {
        // after() only fails outside a request; the answer matters more than the log.
      }
    } else {
      await addMessage(admin, thread, who, { body: await said(answer.error), fromAssistant: true, meta: { error: true, offerHandoff: true } });
    }
    return finish();
  } catch (error) {
    console.warn("[chat] send failed:", error instanceof Error ? error.message : error);
    return { ok: false, error: await said("Could not send. Please try again.") };
  }
}

/** "Talk to a person": hands the chat over (starting one if they haven't written yet). */
export async function chatHandoff(input: { threadId?: string | null; pathname?: string | null }): Promise<ChatResult> {
  try {
    const who = await ensureWho();
    const admin = createSupabaseAdminClient() as any;
    const pathname = typeof input.pathname === "string" && input.pathname.startsWith("/") ? input.pathname.slice(0, 200) : null;
    let thread = input.threadId ? await loadChatThread(admin, input.threadId, who) : null;
    if (!thread) thread = await createThread(admin, who, await said("Talk to a person"), pathname, false);
    if (!thread) return { ok: false, error: await said("Could not send. Please try again.") };
    await handOver(admin, thread, who);
    // The whole chat: the panel replaces what it shows (and a chat started by this tap is just the note).
    return { ok: true, thread: threadInfo(thread), messages: await chatMessages(admin, thread.id) };
  } catch (error) {
    console.warn("[chat] handoff failed:", error instanceof Error ? error.message : error);
    return { ok: false, error: await said("Could not send. Please try again.") };
  }
}

/** A chat with its messages (never the team's internal notes). Opening it marks the team's replies as read. */
export async function chatLoad(threadId: string): Promise<ChatResult> {
  const who = await chatWho();
  const admin = createSupabaseAdminClient() as any;
  const thread = await loadChatThread(admin, threadId, who);
  if (!thread) return { ok: false, error: await said("This conversation was not found.") };
  if (thread.unread_by_business) await admin.from("support_threads").update({ unread_by_business: false }).eq("id", thread.id);
  return { ok: true, thread: threadInfo(thread), messages: await chatMessages(admin, thread.id) };
}

/**
 * New messages since the last one the panel has (every 5 s while it's open), or with `peek` just whether there's an
 * unread team reply (every 60 s while it's closed, for the dot). Never sets a cookie, so polling leaves the page alone.
 */
export async function chatPoll(threadId: string, since?: string | null, peek = false): Promise<{ ok: true; thread: ChatThreadInfo; messages: ChatMessage[]; unread: boolean } | Fail> {
  const who = await chatWho();
  const admin = createSupabaseAdminClient() as any;
  const thread = await loadChatThread(admin, threadId, who);
  if (!thread) return { ok: false, error: "not-found" };
  if (peek) return { ok: true, thread: threadInfo(thread), messages: [], unread: Boolean(thread.unread_by_business) };
  const messages = await chatMessages(admin, thread.id, since || null);
  // The panel is open and showing them: they've been read.
  if (thread.unread_by_business) await admin.from("support_threads").update({ unread_by_business: false }).eq("id", thread.id);
  return { ok: true, thread: threadInfo(thread), messages, unread: false };
}

/** This person's recent chats, for "Previous conversations". A member sees the chats they started; a visitor theirs. */
export async function chatThreads(): Promise<Array<{ id: string; subject: string; lastMessageAt: string; mode: "ai" | "human"; unread: boolean }>> {
  const who = await chatWho();
  if (!who) return [];
  const admin = createSupabaseAdminClient() as any;
  let query = admin.from("support_threads").select("id, subject, last_message_at, mode, unread_by_business").eq("channel", "chat").order("last_message_at", { ascending: false }).limit(10);
  query = who.kind === "member" ? query.eq("organization_id", who.organizationId).eq("created_by", who.userId) : query.eq("visitor_id", who.visitorId).is("organization_id", null);
  const { data } = await query;
  return ((data || []) as any[]).map((row) => ({ id: row.id, subject: String(row.subject || ""), lastMessageAt: row.last_message_at, mode: row.mode === "human" ? "human" : "ai", unread: Boolean(row.unread_by_business) }));
}

/** A website visitor leaves an email so the team can tell them when they've replied (optional). */
export async function chatSetEmail(threadId: string, email: string): Promise<{ ok: true } | Fail> {
  const who = await chatWho();
  if (who?.kind !== "visitor") return { ok: false, error: await said("This conversation was not found.") };
  const value = String(email || "").trim().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { ok: false, error: await said("Check the email address.") };
  const admin = createSupabaseAdminClient() as any;
  const thread = await loadChatThread(admin, threadId, who);
  if (!thread) return { ok: false, error: await said("This conversation was not found.") };
  await admin.from("support_threads").update({ visitor_email: value }).eq("id", thread.id);
  return { ok: true };
}

/**
 * Remembers what happened to a records change card (confirmed or cancelled), so it shows the same after a reload.
 * The change itself is saved by confirmAssistantAction in app/actions/ask.ts, which checks everything again.
 */
export async function chatMarkProposal(input: { threadId: string; messageId: string; state: "done" | "cancelled"; result?: ChatMeta["proposalResult"] }): Promise<{ ok: boolean }> {
  const who = await chatWho();
  if (who?.kind !== "member") return { ok: false };
  const admin = createSupabaseAdminClient() as any;
  const thread = await loadChatThread(admin, input.threadId, who);
  if (!thread) return { ok: false };
  const { data: message } = await admin.from("support_messages").select("id, meta").eq("id", input.messageId).eq("thread_id", thread.id).eq("from_assistant", true).maybeSingle();
  if (!message) return { ok: false };
  const meta = { ...(message.meta || {}), proposalState: input.state === "done" ? "done" : "cancelled", proposalResult: input.state === "done" ? input.result : undefined };
  await admin.from("support_messages").update({ meta }).eq("id", message.id);
  return { ok: true };
}
