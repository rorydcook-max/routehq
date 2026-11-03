"use server";

import { cookies } from "next/headers";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { askFleetAssistant, type AssistantTurn } from "@/app/actions/fleet-assistant";
import type { AskTurn } from "@/lib/ask";
import { runAssistant, runToolDirectly, type AssistantInput, type AssistantResult } from "@/lib/assistant/agent";
import { assistantRole, mayUseFleet as roleMayUseFleet, type ToolName } from "@/lib/assistant/permissions";
import { paperworkFor } from "@/lib/country-paperwork";
import { withoutAdded, type ChatFleet } from "@/lib/fleet-chat";
import { getDefaultOrganization } from "@/lib/organization";
import {
  VISITOR_COOKIE,
  chatFolder,
  chatMessages,
  chatWho,
  fileHint,
  loadChatThread,
  readChatFiles,
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
import { isContentRequest } from "@/lib/support-assistant";
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
export async function chatContext(): Promise<{ signedIn: boolean; owner: boolean; organizationId?: string; fleet?: boolean }> {
  const who = await chatWho();
  if (who?.kind !== "member") return { signedIn: false, owner: false };
  // The business and whether they may add vehicles: the fleet cards' Add and Save send them with the photos.
  return { signedIn: true, owner: who.role === "owner", organizationId: who.organizationId, fleet: mayUseFleet(who) };
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

/** What a reply showed besides its words (a card, a button), so a follow-up ("make it 500", "the plate is…") makes sense. */
function shownNote(meta: any) {
  if (!meta || typeof meta !== "object") return "";
  if (meta.fleet) return " [vehicle and paperwork cards shown]";
  if (meta.proposal) return ` [card: ${meta.proposal.title}, ${meta.proposalState === "done" ? "saved" : meta.proposalState === "cancelled" ? "cancelled" : "not saved yet"}]`;
  if (meta.action) return ` [button: ${meta.action.label}]`;
  return "";
}

/** Earlier turns, so a follow-up ("the red one") makes sense. Team replies aren't sent to the models. */
async function historyFor(admin: any, threadId: string, beforeId: string): Promise<AskTurn[]> {
  const { data } = await admin
    .from("support_messages")
    .select("id, from_team, from_assistant, internal, body, meta, attachments, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(10);
  return ((data || []) as any[])
    .filter((row) => row.id !== beforeId && !row.internal && !row.from_team && (String(row.body || "").trim() || (Array.isArray(row.attachments) && row.attachments.length)))
    .reverse()
    .slice(-8)
    .map((row) => ({
      role: row.from_assistant ? ("assistant" as const) : ("user" as const),
      content: `${String(row.body || "").slice(0, 1500)}${row.from_assistant ? shownNote(row.meta) : Array.isArray(row.attachments) && row.attachments.length ? ` [sent ${row.attachments.length} file(s)]` : ""}`
    }));
}

/** A chip's files go straight to the tool for them: no model call to work out what they are. */
const CHIP_TOOLS: Partial<Record<ChatFileKind, ToolName>> = { receipt: "record_cost", vehicle: "add_vehicles", contract: "contract_upload", spreadsheet: "import_sheet", damage: "damage_photos" };

/**
 * One message from the chat panel. The first one creates the chat. Then, in order:
 * - handed over already: it goes to the team, no AI reply;
 * - asks for a person (in words, or the Talk to a person chip): hand over;
 * - a website visitor's files: a person can open them (the assistant never does for visitors);
 * - files picked with a chip ("Record a receipt"): straight to that tool, no model call to say what they are;
 * - photos only, mid-way through the vehicle cards: back to the fleet assistant, as before;
 * - anything else: the one assistant (lib/assistant/agent.ts), which answers, looks things up or makes a card.
 * Its vehicle and paperwork tools hand the turn to the fleet assistant (fleetTurn, below), whose cards show here.
 */
export async function chatSend(input: {
  threadId?: string | null;
  text: string;
  files?: Array<{ path: string; name?: string; type?: string; size?: number }>;
  pathname?: string | null;
  /** Kept for older panels still open in a browser; the assistant decides now. */
  route?: "records" | "support" | "fleet" | null;
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

    if (who.kind === "visitor" && files.length) {
      await addMessage(admin, thread, who, { body: await said("Thanks. I can't open files here on the website, but the RoveHQ team can. Tap Talk to a person and we'll look at them."), fromAssistant: true, meta: { offerHandoff: true } });
      return finish();
    }

    const role = who.kind === "member" ? assistantRole(who.role) : "visitor";
    const chosen: ChatFileKind | null = files.length && input.action && input.action !== "other" ? input.action : null;
    const hint = files.length ? chosen || fileHint(files, text) : null;
    const base: AssistantInput = {
      role,
      organizationId: who.kind === "member" ? who.organizationId : null,
      text,
      files,
      fileHint: hint,
      images: [],
      pathname,
      language: await readerLanguage(),
      history: await historyFor(admin, thread.id, userMessage.id),
      admin
    };

    let result: AssistantResult | null = null;
    const chipTool = chosen ? CHIP_TOOLS[chosen] : undefined;
    if (chipTool) result = await runToolDirectly(chipTool, base);
    // Photos and nothing else while the vehicle cards are open: more of the same, as before.
    const imagesOnly = files.length > 0 && files.every((file) => file.type.startsWith("image/"));
    if (!result && imagesOnly && !text && !hint && roleMayUseFleet(role) && (await inFleetConversation(admin, thread.id))) result = { type: "fleet" };
    if (!result) {
      // The model looks at the photos only when nothing else says what they are.
      const images = files.length && !hint ? (await photoDataUrls(admin, files)).urls : [];
      result = await runAssistant({ ...base, images });
    }

    if (result.type === "fleet") {
      if (roleMayUseFleet(role)) await fleetTurn(admin, thread, who, text, files, userMessage.id);
      else await addMessage(admin, thread, who, { body: await said("Adding vehicles and renewing their paperwork is done by the owner or a manager. Ask them to send these here."), fromAssistant: true });
    } else if (result.type === "handoff") {
      await handOver(admin, thread, who);
    } else if (result.type === "error") {
      await addMessage(admin, thread, who, { body: await said(result.error), fromAssistant: true, meta: { error: true, offerHandoff: true } });
    } else {
      await addMessage(admin, thread, who, { body: result.body, fromAssistant: true, meta: result.meta });
      // Help questions are kept for the team's content queue, as before. After the reply, so it never slows it down.
      if (result.helpUsed) {
        const logged = {
          organizationId: who.kind === "member" ? who.organizationId : null,
          userId: who.kind === "member" ? who.userId : null,
          question: text.slice(0, 500),
          pathname,
          articles: result.helpUsed.articles,
          handoff: result.helpUsed.handoff,
          request: result.helpUsed.request || isContentRequest(text)
        };
        try {
          after(() => logSupportQuestion(logged));
        } catch {
          // after() only fails outside a request; the answer matters more than the log.
        }
      }
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
export async function chatMarkProposal(input: {
  threadId: string;
  messageId: string;
  state: "done" | "cancelled";
  result?: ChatMeta["proposalResult"];
  /** What was on the card's fields when it was saved, so a reload shows what was saved. */
  values?: Record<string, string>;
}): Promise<{ ok: boolean }> {
  const who = await chatWho();
  if (who?.kind !== "member") return { ok: false };
  const admin = createSupabaseAdminClient() as any;
  const thread = await loadChatThread(admin, input.threadId, who);
  if (!thread) return { ok: false };
  const { data: message } = await admin.from("support_messages").select("id, meta").eq("id", input.messageId).eq("thread_id", thread.id).eq("from_assistant", true).maybeSingle();
  if (!message) return { ok: false };
  const proposal = message.meta?.proposal;
  const values = input.state === "done" && input.values && typeof input.values === "object" ? input.values : null;
  const fields = Array.isArray(proposal?.fields) && values
    ? proposal.fields.map((field: any) => (typeof values[field.key] === "string" ? { ...field, value: String(values[field.key]).slice(0, 200) } : field))
    : proposal?.fields;
  const meta = { ...(message.meta || {}), ...(proposal ? { proposal: { ...proposal, fields } } : {}), proposalState: input.state === "done" ? "done" : "cancelled", proposalResult: input.state === "done" ? input.result : undefined };
  await admin.from("support_messages").update({ meta }).eq("id", message.id);
  return { ok: true };
}

/* ------------------------------------------------------------------------------------------------------------------
 * The fleet assistant in the chat (lib/fleet-chat.ts). One assistant for everything: vehicle and paperwork photos,
 * "add a 2022 Honda Click", a Google Sheet of vehicles, who's renting now. askFleetAssistant does the reading; its
 * lists are kept in the meta of the chat's latest fleet reply, and the panel shows them as cards under it.
 * ------------------------------------------------------------------------------------------------------------------ */

const emptyFleet = (): ChatFleet => ({ draft: [], rentals: [], paperwork: [], photos: [], notes: [], added: [] });

/** The chat's latest fleet reply and its lists (empty lists when the fleet assistant hasn't been used in it yet). */
async function latestFleet(admin: any, threadId: string): Promise<{ messageId: string | null; fleet: ChatFleet }> {
  const { data } = await admin
    .from("support_messages")
    .select("id, meta")
    .eq("thread_id", threadId)
    .eq("from_assistant", true)
    .not("meta->fleet", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const fleet = data?.meta?.fleet;
  return fleet && typeof fleet === "object" ? { messageId: data.id, fleet: { ...emptyFleet(), ...fleet } } : { messageId: null, fleet: emptyFleet() };
}

/** Whether the chat's last assistant reply was the fleet assistant's: a follow-up ("the plate is 1กก 1234") goes back to it. */
async function inFleetConversation(admin: any, threadId: string) {
  const { data } = await admin.from("support_messages").select("meta").eq("thread_id", threadId).eq("from_assistant", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return Boolean(data?.meta?.fleet || data?.meta?.fleetDone);
}

/** Whoever may add vehicles here: the owner and managers (lib/assistant/permissions.ts). */
function mayUseFleet(who: ChatWho) {
  return who.kind === "member" && roleMayUseFleet(assistantRole(who.role));
}

/** Photos from the support bucket as data URLs for the model. The browser already shrank them (about 1600 px JPEG). */
async function photoDataUrls(admin: any, files: SupportAttachment[]) {
  const urls: string[] = [];
  const used: string[] = [];
  for (const file of files.filter((item) => /^image\/(jpeg|png|webp)$/.test(item.type)).slice(0, 4)) {
    try {
      const { data } = await admin.storage.from(SUPPORT_BUCKET).download(file.path);
      if (!data) continue;
      const bytes = Buffer.from(await data.arrayBuffer());
      if (bytes.length > 6 * 1024 * 1024) continue;
      urls.push(`data:${file.type};base64,${bytes.toString("base64")}`);
      used.push(file.path);
    } catch {
      // A photo that can't be read is skipped; the rest still go.
    }
  }
  return { urls, used };
}

/** Each paperwork kind's name as the vehicle page shows it in this business's country ("Road tax (LKM)"). */
async function paperNamesFor() {
  try {
    const [organization, tv] = await Promise.all([getDefaultOrganization(), getTranslations("vehiclePage")]);
    const country = (organization as any).country_code || (organization as any).settings?.main_location?.country;
    return {
      currency: String(organization.currency || "THB"),
      paperNames: Object.fromEntries(paperworkFor(country).map((item) => [item.key, `${tv(item.nameKey as never)}${item.local ? ` (${item.local})` : ""}`])) as Record<string, string>
    };
  } catch {
    return { currency: "THB", paperNames: {} as Record<string, string> };
  }
}

/** One turn of the fleet assistant: what they wrote and any photos, with the chat so far. The reply carries the lists. */
async function fleetTurn(admin: any, thread: any, who: ChatWho, text: string, files: SupportAttachment[], userMessageId: string) {
  const { fleet } = await latestFleet(admin, thread.id);
  const { urls, used } = await photoDataUrls(admin, files);
  if (files.length && !urls.length) {
    // A PDF or a photo type the model can't read: say what to send instead.
    await addMessage(admin, thread, who, { body: await said("I can read photos (JPEG or PNG). Take a photo of the page and send it here."), fromAssistant: true, meta: { fleetDone: true } });
    return;
  }
  const history = await historyFor(admin, thread.id, userMessageId);
  const turns: AssistantTurn[] = [
    ...history.map((turn) => ({ role: turn.role, text: turn.content })),
    ...(fleet.notes || []).slice(-10).map((note) => ({ role: "assistant" as const, text: note })),
    // The cards can be corrected by hand: what's on them now wins over what was typed earlier in the chat.
    ...(fleet.draft.length || fleet.paperwork.length || fleet.rentals.length
      ? [{ role: "assistant" as const, text: "The lists below are as the owner left them on screen; they may have corrected details by hand. Keep their values unless they now say otherwise." }]
      : []),
    { role: "user", text: text || "(photos)" }
  ];
  const locale = await getLocale().catch(() => "en");
  const [result, names] = await Promise.all([
    askFleetAssistant({ turns, images: urls, photosBefore: fleet.photos.length, draft: fleet.draft, rentals: fleet.rentals, paperwork: fleet.paperwork, locale }).catch(() => ({ ok: false as const, error: "failed" })),
    paperNamesFor()
  ]);
  if (!result.ok) {
    const body = result.error === "unavailable" ? "The assistant isn't available right now. Please try again later." : "Sorry, I couldn't read that. Please try again.";
    await addMessage(admin, thread, who, { body: await said(body), fromAssistant: true, meta: { error: true, offerHandoff: true } });
    return;
  }
  const next: ChatFleet = {
    ...fleet,
    draft: withoutAdded(result.draft, fleet.added),
    rentals: result.rentals,
    paperwork: result.paperwork,
    photos: [...fleet.photos, ...used].slice(-60),
    currency: names.currency,
    paperNames: names.paperNames
  };
  await addMessage(admin, thread, who, { body: result.reply || (await said("Done.")), fromAssistant: true, meta: { fleet: next } });
}

/** Keeps the cards' lists as the owner left them (a detail corrected, a wrong renewal dismissed). */
async function fleetMessageFor(admin: any, who: ChatWho | null, threadId: string, messageId: string) {
  if (!who || who.kind !== "member") return null;
  const thread = await loadChatThread(admin, threadId, who);
  if (!thread) return null;
  const { data: message } = await admin.from("support_messages").select("id, meta").eq("id", messageId).eq("thread_id", thread.id).eq("from_assistant", true).maybeSingle();
  if (!message?.meta?.fleet) return null;
  return { thread, message };
}

function cleanFleet(previous: ChatFleet, next: Partial<ChatFleet>): ChatFleet {
  return {
    ...previous,
    draft: Array.isArray(next.draft) ? next.draft.slice(0, 60) : previous.draft,
    rentals: Array.isArray(next.rentals) ? next.rentals.slice(0, 60) : previous.rentals,
    paperwork: Array.isArray(next.paperwork) ? next.paperwork.slice(0, 40) : previous.paperwork,
    notes: Array.isArray(next.notes) ? next.notes.map((note) => String(note).slice(0, 600)).slice(-20) : previous.notes,
    added: Array.isArray(next.added) ? next.added.map((key) => String(key).slice(0, 200)).slice(-120) : previous.added,
    // The photos are the chat's own; never taken from the browser.
    photos: previous.photos
  };
}

export async function chatFleetUpdate(input: { threadId: string; messageId: string; fleet: Partial<ChatFleet> }): Promise<{ ok: boolean }> {
  const who = await chatWho();
  const admin = createSupabaseAdminClient() as any;
  const found = await fleetMessageFor(admin, who, input.threadId, input.messageId);
  if (!found) return { ok: false };
  const fleet = cleanFleet({ ...emptyFleet(), ...found.message.meta.fleet }, input.fleet || {});
  await admin.from("support_messages").update({ meta: { ...found.message.meta, fleet } }).eq("id", found.message.id);
  return { ok: true };
}

/**
 * After the cards' Add or Save worked (the browser did the adding with addAssistantVehicles, renewVehicleCompliance or
 * addAssistantRentals, which check everything again): the lists as they are now, and a short reply saying it's done,
 * with the next question, so the chat carries on from there.
 */
export async function chatFleetDone(input: {
  threadId: string;
  messageId: string;
  fleet: Partial<ChatFleet>;
  done: { kind: "vehicles" | "paperwork" | "rentals"; count: number; failed?: string[]; reminders?: boolean };
}): Promise<ChatResult> {
  try {
    const who = await chatWho();
    const admin = createSupabaseAdminClient() as any;
    const found = await fleetMessageFor(admin, who, input.threadId, input.messageId);
    if (!found || !who) return { ok: false, error: await said("This conversation was not found.") };
    const fleet = cleanFleet({ ...emptyFleet(), ...found.message.meta.fleet }, input.fleet || {});
    await admin.from("support_messages").update({ meta: { ...found.message.meta, fleet } }).eq("id", found.message.id);
    const count = Math.max(0, Math.round(Number(input.done.count) || 0));
    const failed = (input.done.failed || []).map((name) => String(name).slice(0, 80)).slice(0, 10);
    const parts: string[] = [];
    const links: Array<{ label: string; href: string }> = [];
    if (input.done.kind === "vehicles") {
      if (count) {
        parts.push(count === 1 ? await said("Added 1 vehicle to your fleet.") : await said(`Added ${count} vehicles to your fleet.`));
        parts.push(count === 1 ? await said("Is anyone renting it now? Tell me who, what they pay and when.") : await said("Is anyone renting them now? Tell me who, what they pay and when."));
        links.push({ label: await said("Open Fleet"), href: "/fleet" });
      }
      if (failed.length || !count) parts.push(await said("Some vehicles couldn't be added. Check them and try again."));
    } else if (input.done.kind === "paperwork") {
      if (count) parts.push(count === 1 ? await said("Saved 1 renewal: the date and cost are updated.") : await said(`Saved ${count} renewals: the dates and costs are updated.`));
      if (failed.length) parts.push(await said(`Couldn't save: ${failed.join(", ")}`));
    } else {
      if (count) {
        parts.push(count === 1 ? await said("Added 1 rental. What's due shows on your dashboard.") : await said(`Added ${count} rentals. What's due shows on your dashboard.`));
        if (input.done.reminders) {
          links.push({ label: await said("Connect LINE or WhatsApp"), href: "/settings?tab=messaging" });
          links.push({ label: await said("Add payment details"), href: "/settings?tab=rentals#payment-methods" });
        }
      }
      if (failed.length) parts.push(await said(`Couldn't add: ${failed.join(", ")}`));
    }
    const reply = await addMessage(admin, found.thread, who, { body: parts.join(" "), fromAssistant: true, meta: { fleetDone: true, links: links.length ? links : undefined } });
    return { ok: true, thread: threadInfo(found.thread), messages: await chatMessages(admin, found.thread.id, new Date(Date.parse(reply.created_at) - 1).toISOString()) };
  } catch (error) {
    console.warn("[chat] fleet done failed:", error instanceof Error ? error.message : error);
    return { ok: false, error: await said("Could not send. Please try again.") };
  }
}
