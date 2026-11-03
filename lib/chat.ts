import { cookies } from "next/headers";
import { readFileAsJson } from "@/lib/ai-vision";
import type { ProposedAction } from "@/lib/assistant-actions";
import { getCurrentMembership } from "@/lib/auth/roles";
import { fileKindFromName, type ChatFileKind } from "@/lib/chat-suggestions";
import { SUPPORT_BUCKET, SUPPORT_MAX_FILES, signAttachments, type SupportAttachment } from "@/lib/support";

/**
 * The live chat's server side (the floating chat button on every app and website page). A chat is a
 * support_threads row with channel 'chat': it starts in mode 'ai' (the assistant answers; the team doesn't see it in
 * their queue) and moves to mode 'human' when the person asks for a person. See the shared spec (chat-spec.md).
 *
 * Who is chatting is either a signed-in member of a business, or a website visitor known only by a random id in an
 * httpOnly cookie. Visitors never reach the records assistant: they only get the help-centre assistant.
 */

export const VISITOR_COOKIE = "rove_visitor";
/** Each visitor message costs an AI call; 20 an hour is plenty for a real question and stops a script running up a bill. */
export const VISITOR_LIMIT_PER_HOUR = 20;
/** Where visitors' files go in the support bucket: their own folder, never a business's. */
export const VISITOR_FOLDER = "visitors";

export type ChatWho =
  | { kind: "member"; userId: string; organizationId: string; role: string; email: string | null }
  | { kind: "visitor"; visitorId: string };

/** A link to the right place for a file, with how the file travels there (the browser hands it over where it can). */
export type ChatAction = {
  kind: ChatFileKind;
  href: string;
  label: string;
  /** Storage paths of the files this card is about, so the browser can fetch them again after a reload. */
  paths?: string[];
  /** receipt / photos / sheet: the browser passes the File itself to the next screen; url: the href already carries it. */
  handover?: "receipt" | "photos" | "sheet" | "url" | null;
};

export type ChatMeta = {
  articles?: Array<{ slug: string; title: string; href: string }>;
  links?: Array<{ label: string; href: string }>;
  proposal?: ProposedAction;
  proposalState?: "done" | "cancelled";
  proposalResult?: { message: string; link?: { label: string; href: string }; copy?: string };
  action?: ChatAction;
  /** This message is the "passed to the team" note. */
  handoff?: boolean;
  /** The assistant couldn't answer: show a "Talk to a person" button under it. */
  offerHandoff?: boolean;
  /** The reply is an error message (shown in the danger colour). */
  error?: boolean;
};

export type ChatAttachment = SupportAttachment & { url: string | null };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "team";
  body: string;
  createdAt: string;
  attachments: ChatAttachment[];
  meta: ChatMeta;
};

export type ChatThreadInfo = { id: string; mode: "ai" | "human"; status: "open" | "answered" | "closed"; subject: string; visitorEmail: string | null };

const THREAD_COLUMNS = "id, organization_id, visitor_id, created_by, mode, status, subject, visitor_email, channel, unread_by_business";
const MESSAGE_COLUMNS = "id, author_id, from_team, from_assistant, internal, body, attachments, meta, created_at";

/** The signed-in member, or the visitor from their cookie (null when neither: a visitor who hasn't written yet). */
export async function chatWho(): Promise<ChatWho | null> {
  const membership = await getCurrentMembership().catch(() => null);
  if (membership) return { kind: "member", userId: membership.userId, organizationId: membership.organizationId, role: membership.role, email: membership.email };
  const jar = await cookies();
  const visitorId = jar.get(VISITOR_COOKIE)?.value || "";
  return /^[0-9a-f-]{36}$/i.test(visitorId) ? { kind: "visitor", visitorId } : null;
}

/** Whether this person may see this thread: their business's, or (for a visitor) the one tied to their cookie. */
export function canSee(thread: any, who: ChatWho | null) {
  if (!thread || !who) return false;
  if (who.kind === "member") return thread.organization_id === who.organizationId;
  return !thread.organization_id && thread.visitor_id === who.visitorId;
}

export async function loadChatThread(admin: any, threadId: string, who: ChatWho | null) {
  if (!threadId || !/^[0-9a-f-]{36}$/i.test(threadId)) return null;
  const { data } = await admin.from("support_threads").select(THREAD_COLUMNS).eq("id", threadId).maybeSingle();
  return canSee(data, who) ? data : null;
}

export function threadInfo(thread: any): ChatThreadInfo {
  return { id: thread.id, mode: thread.mode === "human" ? "human" : "ai", status: thread.status, subject: String(thread.subject || ""), visitorEmail: thread.visitor_email || null };
}

/**
 * A thread's messages for the person chatting, oldest first. Team-only notes (internal) are never included: this is
 * the business/visitor side. `since` returns only newer messages, for polling.
 */
export async function chatMessages(admin: any, threadId: string, since?: string | null): Promise<ChatMessage[]> {
  let query = admin.from("support_messages").select(MESSAGE_COLUMNS).eq("thread_id", threadId).or("internal.is.null,internal.eq.false").order("created_at", { ascending: true }).limit(200);
  if (since) query = query.gt("created_at", since);
  const { data } = await query;
  return Promise.all(
    ((data || []) as any[]).map(async (row) => ({
      id: row.id,
      role: row.from_team ? ("team" as const) : row.from_assistant ? ("assistant" as const) : ("user" as const),
      body: String(row.body || ""),
      createdAt: row.created_at,
      attachments: await signAttachments(admin, Array.isArray(row.attachments) ? row.attachments : []),
      meta: (row.meta && typeof row.meta === "object" ? row.meta : {}) as ChatMeta
    }))
  );
}

/** The folder in the support bucket this person's files go in. Businesses use the same folder as Help uploads. */
export function chatFolder(who: ChatWho) {
  return who.kind === "member" ? who.organizationId : `${VISITOR_FOLDER}/${who.visitorId}`;
}

/** Files the browser says it uploaded, kept only if they're in this person's folder and really in storage. */
export async function readChatFiles(admin: any, raw: unknown, folder: string): Promise<SupportAttachment[]> {
  if (!Array.isArray(raw)) return [];
  const files: SupportAttachment[] = [];
  for (const entry of raw.slice(0, SUPPORT_MAX_FILES)) {
    const path = String((entry as any)?.path || "");
    if (!path.startsWith(`${folder}/`) || path.includes("..")) continue;
    const dir = path.slice(0, path.lastIndexOf("/"));
    const fileName = path.slice(path.lastIndexOf("/") + 1);
    const { data } = await admin.storage.from(SUPPORT_BUCKET).list(dir, { search: fileName, limit: 1 });
    const stored = (data || []).find((item: any) => item.name === fileName);
    if (!stored) continue;
    files.push({
      path,
      name: String((entry as any)?.name || fileName).slice(0, 200),
      size: Number(stored.metadata?.size || (entry as any)?.size || 0),
      type: String(stored.metadata?.mimetype || (entry as any)?.type || "")
    });
  }
  return files;
}

/** "Can I talk to a person?", "real human please": asked for a person in so many words. */
export function wantsPerson(text: string) {
  return /\b(talk|speak|chat) (to|with) (a |an |someone|somebody|a real |the )?(person|human|someone|somebody|agent|team|support|staff)\b|\breal (person|human)\b|\bhuman (please|agent)\b|ขอคุยกับ(คน|เจ้าหน้าที่|พนักงาน)|ติดต่อเจ้าหน้าที่/i.test(String(text || ""));
}

/**
 * A how-to question rather than a question about the business's figures. The same word check as askRouteHq in
 * app/actions/ask.ts (a "use server" file can only export actions, so it is repeated here rather than shared).
 */
export function isHowTo(text: string) {
  const asked = String(text || "").trim();
  return (
    /\b(how (do|can|should) (i|we|you)|how to|where (is|are|do|can|does)|can i|could i|what does .{1,40} mean|why (can'?t|cannot|isn'?t|doesn'?t|won'?t|don'?t)|set ?up|turn (on|off)|switch (on|off)|enable|disable|connect|not working|doesn'?t work|isn'?t working|won'?t (load|save|open|work)|error|help|tutorial|guide|explain how)\b/i.test(asked) ||
    /(ทำยังไง|ทำอย่างไร|ตั้งค่า|อยู่ตรงไหน|ใช้ยังไง|ใช้อย่างไร|เปิดใช้|วิธี|ช่วยด้วย|ไม่ทำงาน|ใช้ไม่ได้|ยังไง\s*[?]?$|อย่างไร\s*[?]?$|ตรงไหน|ที่ไหน|เปิดยังไง|ปิดยังไง)/.test(asked)
  );
}

/** Visitors' messages in the last hour, across all their chats. */
export async function visitorOverLimit(admin: any, visitorId: string) {
  const { data: threads } = await admin.from("support_threads").select("id").eq("visitor_id", visitorId).limit(50);
  const ids = ((threads || []) as any[]).map((row) => row.id);
  if (!ids.length) return false;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("support_messages")
    .select("id", { count: "exact", head: true })
    .in("thread_id", ids)
    .eq("from_team", false)
    .eq("from_assistant", false)
    .gte("created_at", since);
  return (count || 0) >= VISITOR_LIMIT_PER_HOUR;
}

/** Words in the message that settle what the files are, before paying for a look at them. */
function kindFromWords(text: string): ChatFileKind | null {
  const words = String(text || "").toLowerCase();
  if (/\b(receipt|invoice|bill|fuel|petrol|repair cost|paid for)\b|ใบเสร็จ/.test(words)) return "receipt";
  if (/\b(contract|agreement|terms)\b|สัญญา/.test(words)) return "contract";
  if (/\b(damage|damaged|scratch|scratches|dent|dents|odometer|mileage|fuel gauge|km reading)\b|รอย|เลขไมล์/.test(words)) return "damage";
  if (/\b(registration|blue book|green book|policy|insurance|road tax|tax|logbook|inspection certificate|add (these|this|the) (car|cars|vehicle|vehicles|bike|bikes))\b|เล่มทะเบียน|ประกัน|ภาษี|พ\.ร\.บ/.test(words)) return "vehicle";
  if (/\b(spreadsheet|import|excel|csv)\b/.test(words)) return "spreadsheet";
  return null;
}

/**
 * What a set of files is, for routing them to the right screen: the chip they picked wins; then the file type
 * (spreadsheets, Word files); then words in their message; then one quick look at the first photo or PDF.
 * Anything still unclear is "other", which offers a person.
 */
export async function classifyFiles(admin: any, files: SupportAttachment[], text: string, chosen?: ChatFileKind | null): Promise<ChatFileKind> {
  if (chosen && chosen !== "other") return chosen;
  for (const file of files) {
    const byName = fileKindFromName(file.name, file.type);
    if (byName) return byName;
  }
  const byWords = kindFromWords(text);
  if (byWords) return byWords;
  const first = files.find((file) => file.type.startsWith("image/") || file.type === "application/pdf");
  // Very large files aren't worth sending for a one-word answer.
  if (!first || first.size > 8 * 1024 * 1024) return "other";
  try {
    const { data } = await admin.storage.from(SUPPORT_BUCKET).download(first.path);
    if (!data) return "other";
    const bytes = Buffer.from(await data.arrayBuffer());
    const read = await readFileAsJson({
      system: "You sort files sent to the support chat of an app for small vehicle rental businesses.",
      prompt: [
        "Which one is this file? Answer with one kind:",
        "receipt: a bill or receipt for something paid (fuel, repairs, parts, a car wash).",
        "vehicle: a vehicle registration book, an insurance policy, a road tax receipt or sticker, an inspection certificate, or a photo of a whole vehicle to add it to the fleet.",
        "contract: a rental agreement or contract.",
        "spreadsheet: a table or list of vehicles, customers or bookings (a photo of a notebook page or a printed list counts).",
        "damage: a close photo of damage (a scratch, dent, crack) or of an odometer or fuel gauge.",
        "other: anything else.",
        'Reply as {"kind": "receipt" | "vehicle" | "contract" | "spreadsheet" | "damage" | "other"}.'
      ].join("\n"),
      bytes,
      mediaType: first.type || "image/jpeg",
      maxTokens: 60,
      personal: true
    });
    const kind = String(read.kind || "");
    return (["receipt", "vehicle", "contract", "spreadsheet", "damage"] as const).find((value) => value === kind) || "other";
  } catch {
    return "other";
  }
}

/**
 * The reply to files: a sentence on where they go, and a card that opens that screen with the file handed over where
 * the screen can take it. Owner-only screens (contracts, imports) tell a teammate to ask the owner instead.
 * Text is English; the action translates it with said().
 */
export function replyForFiles(kind: ChatFileKind, files: SupportAttachment[], who: ChatWho, pathname: string | null): { body: string; action?: ChatAction; offerHandoff?: boolean } {
  const paths = files.map((file) => file.path);
  if (who.kind === "visitor") {
    return { body: "Thanks. I can't open files here on the website, but the RoveHQ team can. Tap Talk to a person and we'll look at them.", offerHandoff: true };
  }
  const owner = who.role === "owner";
  const images = files.filter((file) => file.type.startsWith("image/"));
  if (kind === "receipt") {
    return {
      body: "That looks like a receipt. Tap the button and I'll pass it over: the amount, date and who was paid are filled in from it, ready for you to check and save.",
      action: { kind, href: "/transactions/new", label: "Record this cost", paths: paths.slice(0, 1), handover: "receipt" }
    };
  }
  if (kind === "vehicle") {
    return {
      body: images.length
        ? "These go to the fleet assistant. It reads registration books, insurance policies and tax receipts, and adds the vehicles or renews their paperwork once you check them."
        : "The fleet assistant reads photos of registration books, policies and tax receipts. Take a photo of the page and send it there.",
      action: { kind, href: "/fleet/assistant", label: "Open the fleet assistant", paths: images.slice(0, 4).map((file) => file.path), handover: images.length ? "photos" : null }
    };
  }
  if (kind === "contract") {
    if (!owner) return { body: "Contracts are set up by the business owner in Settings. Ask them to send it in this chat, or to upload it under Settings, Rental agreement.", offerHandoff: false };
    const path = paths[0] || "";
    return {
      body: "That looks like your own contract. Tap the button and it's read in from this file under Rental agreement: you check the wording and where the details go before customers sign it.",
      action: { kind, href: `/settings/contracts?file=${encodeURIComponent(path)}`, label: "Set up this contract", paths: [path], handover: "url" }
    };
  }
  if (kind === "spreadsheet") {
    if (!owner) return { body: "Importing a spreadsheet is done by the business owner. Ask them to send it here, or the RoveHQ team can bring it in for you.", offerHandoff: true };
    const sheet = files.find((file) => fileKindFromName(file.name, file.type) === "spreadsheet") || files[0];
    return {
      body: "Spreadsheets go in Import. Open it and your file is ready to read: you see what it found before anything is added. If it's a mess, the RoveHQ team can import it for you, free.",
      action: { kind, href: "/fleet/import", label: "Import this spreadsheet", paths: sheet ? [sheet.path] : [], handover: sheet ? "sheet" : null }
    };
  }
  if (kind === "damage") {
    const booking = String(pathname || "").match(/^\/bookings\/([0-9a-f-]{36})/i)?.[1];
    return {
      body: "Damage and odometer photos belong in the booking's handover or return check, so they stay with the rental and are there if there's a dispute. Open the booking and add them in the check.",
      action: booking ? { kind, href: `/bookings/${booking}`, label: "Open this booking", paths } : { kind, href: "/bookings", label: "Open Bookings", paths }
    };
  }
  return { body: "I'm not sure where these go. A person from the RoveHQ team can take a look: tap Talk to a person.", offerHandoff: true };
}

/** A short title from the first message: its first line, cut at a word. */
export function subjectFrom(text: string, fallback: string) {
  const line = String(text || "").split(/\n/).map((part) => part.trim()).find(Boolean) || "";
  if (!line) return fallback;
  if (line.length <= 80) return line;
  const cut = line.slice(0, 80);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 50)).replace(/[,;:\s]+$/, "")}…`;
}
