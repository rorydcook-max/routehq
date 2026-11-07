import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUPPORT_BUCKET, SUPPORT_MAX_FILES, signAttachments, type SupportAttachment } from "@/lib/support";

/**
 * The RoveHQ support helpdesk (/platform/support): the queue of conversations the team answers, and everything one
 * conversation page needs. Server only; every caller has already checked the viewer is a platform admin.
 * The admin console is RoveHQ's internal tool, so its words are English and live in the code.
 */

export * from "@/lib/helpdesk-shared";
import type { QueueRow, QueueView, HelpdeskCounts } from "@/lib/helpdesk-shared";

const THREAD_COLUMNS =
  "id, organization_id, visitor_id, visitor_email, visitor_name, subject, topic, channel, mode, status, priority, tags, assigned_to, handed_off_at, page, unread_by_team, unread_by_business, last_message_at, created_at, organizations(name)";

/** The team's names (platform admins), for the assignee column and the "Assign" control. */
export async function teamNames(): Promise<Map<string, string>> {
  const admin = createSupabaseAdminClient() as any;
  const { data: admins } = await admin.from("platform_admins").select("user_id");
  const ids = ((admins || []) as any[]).map((row) => row.user_id).filter(Boolean) as string[];
  if (!ids.length) return new Map();
  const { data: profiles } = await admin.from("users").select("id, full_name").in("id", ids);
  const names = new Map<string, string>();
  for (const id of ids) {
    const profile = ((profiles || []) as any[]).find((row) => row.id === id);
    let name = String(profile?.full_name || "").trim();
    // No name on the profile: fall back to the sign-in email so the column is never blank.
    if (!name) {
      const { data } = await admin.auth.admin.getUserById(id).catch(() => ({ data: null }));
      name = String(data?.user?.email || "RoveHQ team");
    }
    names.set(id, name);
  }
  return names;
}

/** PostgREST's or() filter is comma- and bracket-separated, so a search term must not contain those characters. */
function cleanSearch(text: string) {
  return text.replace(/[,()*%\\]/g, " ").trim().slice(0, 80);
}

/** The queue for one tab, with an optional search over business name, visitor email and subject. */
export async function listQueueRows(view: QueueView, search: string, meId: string): Promise<QueueRow[]> {
  const admin = createSupabaseAdminClient() as any;
  let query = admin.from("support_threads").select(THREAD_COLUMNS).limit(200);
  if (view === "waiting") query = query.eq("mode", "human").eq("status", "open");
  if (view === "mine") query = query.eq("assigned_to", meId).neq("status", "closed");
  if (view === "unassigned") query = query.eq("mode", "human").neq("status", "closed").is("assigned_to", null);
  if (view === "answered") query = query.eq("mode", "human").eq("status", "answered");
  if (view === "closed") query = query.eq("status", "closed");
  if (view === "ai") query = query.eq("mode", "ai").gte("last_message_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
  // Waiting: the oldest unanswered first, so nobody is left behind. Everything else: newest first.
  query = view === "waiting" ? query.order("last_message_at", { ascending: true }) : query.order("last_message_at", { ascending: false });

  const term = cleanSearch(search);
  if (term) {
    const { data: orgs } = await admin.from("organizations").select("id").ilike("name", `%${term}%`).limit(50);
    const orgIds = ((orgs || []) as any[]).map((row) => row.id);
    const parts = [`visitor_email.ilike.%${term}%`, `subject.ilike.%${term}%`, `visitor_name.ilike.%${term}%`];
    if (orgIds.length) parts.push(`organization_id.in.(${orgIds.join(",")})`);
    query = query.or(parts.join(","));
  }

  const [{ data: threads }, names] = await Promise.all([query, teamNames()]);
  const list = (threads || []) as any[];
  if (!list.length) return [];

  // The latest messages of these conversations, for the preview and the waiting time. Newest first, reduced below.
  const { data: messages } = await admin
    .from("support_messages")
    .select("thread_id, body, from_team, from_assistant, internal, attachments, created_at")
    .in(
      "thread_id",
      list.map((thread) => thread.id)
    )
    .order("created_at", { ascending: false })
    .limit(3000);
  const latest = new Map<string, any>();
  const latestCustomer = new Map<string, string>();
  const latestTeam = new Map<string, string>();
  for (const message of (messages || []) as any[]) {
    if (!latest.has(message.thread_id)) latest.set(message.thread_id, message);
    const fromCustomer = !message.from_team && !message.from_assistant && !message.internal;
    if (fromCustomer && !latestCustomer.has(message.thread_id)) latestCustomer.set(message.thread_id, message.created_at);
    if (message.from_team && !message.internal && !latestTeam.has(message.thread_id)) latestTeam.set(message.thread_id, message.created_at);
  }

  const rows = list.map((thread): QueueRow => {
    const last = latest.get(thread.id);
    const customerAt = latestCustomer.get(thread.id) || null;
    const teamAt = latestTeam.get(thread.id) || null;
    const files = Array.isArray(last?.attachments) ? last.attachments.length : 0;
    const owed = thread.status !== "closed" && customerAt && (!teamAt || teamAt < customerAt);
    return {
      id: thread.id,
      organizationId: thread.organization_id ?? null,
      businessName: String(thread.organizations?.name || ""),
      visitorEmail: thread.visitor_email ?? null,
      visitorName: thread.visitor_name ?? null,
      subject: String(thread.subject || "(no subject)"),
      channel: thread.channel === "chat" ? "chat" : "help",
      mode: thread.mode === "ai" ? "ai" : "human",
      status: thread.status,
      priority: thread.priority === "high" ? "high" : "normal",
      tags: Array.isArray(thread.tags) ? thread.tags : [],
      assignedTo: thread.assigned_to ?? null,
      assigneeName: thread.assigned_to ? names.get(thread.assigned_to) || "Someone" : null,
      // AI conversations aren't the team's to read yet, so they never show as unread.
      unread: thread.mode !== "ai" && Boolean(thread.unread_by_team),
      lastMessageAt: thread.last_message_at,
      preview: last ? String(last.body || "").replace(/\s+/g, " ").slice(0, 140) || (files ? `${files} file${files === 1 ? "" : "s"}` : "") : "",
      previewFrom: last ? (last.internal ? "note" : last.from_assistant ? "assistant" : last.from_team ? "team" : "customer") : null,
      waitingSince: owed ? customerAt : null
    };
  });
  // High priority goes to the top of the Waiting tab, keeping the oldest-first order within each priority.
  if (view === "waiting") rows.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "high" ? -1 : 1));
  return rows;
}

/** The numbers on the tabs and in the admin nav. */
export async function countsFor(meId: string): Promise<HelpdeskCounts> {
  const admin = createSupabaseAdminClient() as any;
  const head = () => admin.from("support_threads").select("id", { count: "exact", head: true });
  const [waiting, mine, unassigned, unread, ai] = await Promise.all([
    head().eq("mode", "human").eq("status", "open"),
    head().eq("assigned_to", meId).neq("status", "closed"),
    head().eq("mode", "human").neq("status", "closed").is("assigned_to", null),
    head().eq("mode", "human").eq("unread_by_team", true).neq("status", "closed"),
    head().eq("mode", "ai").gte("last_message_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
  ]);
  return { waiting: waiting.count || 0, mine: mine.count || 0, unassigned: unassigned.count || 0, unread: unread.count || 0, ai: ai.count || 0 };
}

/**
 * Conversations with the team that have something new from the customer: the number on the admin nav's Support tab.
 * Closed ones don't count: a plan request the business closed itself shouldn't keep the badge lit.
 */
export async function countUnreadForTeam() {
  const admin = createSupabaseAdminClient() as any;
  const { count } = await admin.from("support_threads").select("id", { count: "exact", head: true }).eq("mode", "human").eq("unread_by_team", true).neq("status", "closed");
  return count || 0;
}

export type HelpdeskMessage = {
  id: string;
  kind: "customer" | "assistant" | "team" | "note";
  authorName: string;
  body: string;
  createdAt: string;
  meta: Record<string, any>;
  attachments: (SupportAttachment & { url: string | null })[];
  /** Set on messages pulled in from the chat they had just before this one (see loadConversationData). */
  fromThread?: string;
};

/**
 * One conversation for the team: every message (the assistant's turns and internal notes included), the business or
 * visitor it belongs to, and their earlier conversations. Opening it marks it read for the team.
 */
export async function loadConversationData(threadId: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data: thread } = await admin.from("support_threads").select(THREAD_COLUMNS).eq("id", threadId).maybeSingle();
  if (!thread) return null;

  const [{ data: messages }, names] = await Promise.all([
    admin.from("support_messages").select("id, author_id, from_team, from_assistant, internal, body, attachments, meta, created_at").eq("thread_id", thread.id).order("created_at", { ascending: true }),
    teamNames()
  ]);
  /*
   * A chat handed over with nothing from the business in it (Rory, 7 Nov 2026: the team saw only the assistant's
   * "I've passed this to the RoveHQ team"). That happened when "Talk to a person" was tapped before the panel had
   * loaded the chat they were in, so the handover started a new, empty chat. The questions are in the chat they had
   * just before: show those messages first, so the team sees what was asked.
   */
  let earlierMessages: any[] = [];
  let earlierThreadId: string | null = null;
  const customerWrote = ((messages || []) as any[]).some((message) => !message.from_team && !message.from_assistant && !message.internal);
  if (!customerWrote && thread.channel === "chat" && (thread.organization_id || thread.visitor_id)) {
    const from = new Date(new Date(thread.created_at).getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { data: before } = await admin
      .from("support_threads")
      .select("id")
      .eq(thread.organization_id ? "organization_id" : "visitor_id", thread.organization_id || thread.visitor_id)
      .eq("channel", "chat")
      .neq("id", thread.id)
      .lte("created_at", thread.created_at)
      .gte("last_message_at", from)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (before?.id) {
      const { data: rowsBefore } = await admin
        .from("support_messages")
        .select("id, author_id, from_team, from_assistant, internal, body, attachments, meta, created_at")
        .eq("thread_id", before.id)
        .order("created_at", { ascending: true })
        .limit(200);
      earlierMessages = ((rowsBefore || []) as any[]).filter((message) => !message.internal);
      earlierThreadId = before.id;
    }
  }
  const allMessages = [...earlierMessages.map((message) => ({ ...message, fromThread: earlierThreadId })), ...((messages || []) as any[])];
  const authorIds = Array.from(new Set(allMessages.map((message) => message.author_id).filter(Boolean)));
  const { data: profiles } = authorIds.length ? await admin.from("users").select("id, full_name").in("id", authorIds) : { data: [] };
  const authors = new Map(((profiles || []) as any[]).map((profile) => [profile.id, String(profile.full_name || "")]));
  const customerName = thread.organizations?.name || thread.visitor_name || thread.visitor_email || "Website visitor";
  const rows: HelpdeskMessage[] = await Promise.all(
    allMessages.map(async (message) => {
      const kind: HelpdeskMessage["kind"] = message.internal ? "note" : message.from_assistant ? "assistant" : message.from_team ? "team" : "customer";
      const authorName =
        kind === "assistant" ? "Assistant" : kind === "customer" ? authors.get(message.author_id) || customerName : names.get(message.author_id) || authors.get(message.author_id) || "RoveHQ team";
      return {
        id: message.id,
        kind,
        authorName,
        body: String(message.body || ""),
        createdAt: message.created_at,
        meta: message.meta && typeof message.meta === "object" ? message.meta : {},
        attachments: await signAttachments(admin, Array.isArray(message.attachments) ? message.attachments : []),
        ...(message.fromThread ? { fromThread: String(message.fromThread) } : {})
      };
    })
  );

  if (thread.unread_by_team && thread.mode !== "ai") await admin.from("support_threads").update({ unread_by_team: false }).eq("id", thread.id);

  // Earlier conversations from the same business or the same browser, so the team sees the history.
  let previous: Array<{ id: string; subject: string; status: string; channel: string; lastMessageAt: string }> = [];
  if (thread.organization_id || thread.visitor_id) {
    const { data } = await admin
      .from("support_threads")
      .select("id, subject, status, channel, last_message_at")
      .eq(thread.organization_id ? "organization_id" : "visitor_id", thread.organization_id || thread.visitor_id)
      .neq("id", thread.id)
      .order("last_message_at", { ascending: false })
      .limit(10);
    previous = ((data || []) as any[]).map((row) => ({ id: row.id, subject: String(row.subject || "(no subject)"), status: row.status, channel: row.channel || "help", lastMessageAt: row.last_message_at }));
  }

  return {
    thread: {
      id: thread.id as string,
      organizationId: (thread.organization_id ?? null) as string | null,
      visitorId: (thread.visitor_id ?? null) as string | null,
      visitorEmail: (thread.visitor_email ?? null) as string | null,
      visitorName: (thread.visitor_name ?? null) as string | null,
      subject: String(thread.subject || "(no subject)"),
      topic: String(thread.topic || ""),
      channel: (thread.channel === "chat" ? "chat" : "help") as "chat" | "help",
      mode: (thread.mode === "ai" ? "ai" : "human") as "ai" | "human",
      status: thread.status as "open" | "answered" | "closed",
      priority: (thread.priority === "high" ? "high" : "normal") as "normal" | "high",
      tags: (Array.isArray(thread.tags) ? thread.tags : []) as string[],
      assignedTo: (thread.assigned_to ?? null) as string | null,
      assigneeName: thread.assigned_to ? names.get(thread.assigned_to) || "Someone" : null,
      handedOffAt: (thread.handed_off_at ?? null) as string | null,
      page: (thread.page ?? null) as string | null,
      createdAt: thread.created_at as string,
      businessName: String(thread.organizations?.name || "")
    },
    messages: rows,
    previous
  };
}

/** Who the business is: plan, size, owner and any plan request waiting for payment, for the side panel. */
export async function loadBusinessContext(organizationId: string) {
  const admin = createSupabaseAdminClient() as any;
  const [{ data: org }, { count: vehicles }, { data: owners }] = await Promise.all([
    admin
      .from("organizations")
      .select("id, name, country_code, subscription_tier, subscription_status, billing_interval, pending_plan, pending_interval, pending_amount, pending_currency, plan_requested_at")
      .eq("id", organizationId)
      .maybeSingle(),
    admin.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("deleted_at", null),
    admin.from("organization_members").select("user_id").eq("organization_id", organizationId).eq("role", "owner").eq("is_active", true).limit(1)
  ]);
  if (!org) return null;
  const ownerId = ((owners || []) as any[])[0]?.user_id;
  const { data: owner } = ownerId ? await admin.auth.admin.getUserById(ownerId).catch(() => ({ data: null })) : { data: null };
  return {
    id: org.id as string,
    name: String(org.name || "Unnamed business"),
    country: (org.country_code ?? null) as string | null,
    tier: String(org.subscription_tier || "free"),
    status: String(org.subscription_status || "trial"),
    interval: org.billing_interval === "yearly" ? "yearly" : "monthly",
    vehicles: vehicles || 0,
    ownerEmail: (owner?.user?.email ?? null) as string | null,
    planRequest: org.pending_plan
      ? {
          plan: String(org.pending_plan),
          interval: org.pending_interval === "yearly" ? "yearly" : "monthly",
          amount: Number(org.pending_amount || 0),
          currency: String(org.pending_currency || "THB"),
          requestedAt: (org.plan_requested_at ?? null) as string | null
        }
      : null
  };
}

/**
 * Where the team's files for a conversation go: the business's own folder (so the business can always open them, as
 * on the Help page), or a visitor folder for website visitors, who have no business.
 */
export function uploadFolderFor(thread: { organization_id?: string | null; visitor_id?: string | null }) {
  if (thread.organization_id) return String(thread.organization_id);
  if (thread.visitor_id) return `visitors/${thread.visitor_id}`;
  return null;
}

/** Files the browser says it uploaded, kept only if they are in this conversation's folder and really in storage. */
export async function verifyUploadedFiles(raw: unknown, folder: string): Promise<SupportAttachment[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw || "[]"));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const admin = createSupabaseAdminClient() as any;
  const checked = await Promise.all(
    parsed.slice(0, SUPPORT_MAX_FILES).map(async (entry: any): Promise<SupportAttachment | null> => {
      const path = String(entry?.path || "");
      if (!path.startsWith(`${folder}/`) || path.includes("..")) return null;
      const dir = path.slice(0, path.lastIndexOf("/"));
      const fileName = path.slice(path.lastIndexOf("/") + 1);
      const { data } = await admin.storage.from(SUPPORT_BUCKET).list(dir, { search: fileName, limit: 1 });
      const stored = (data || []).find((item: any) => item.name === fileName);
      if (!stored) return null;
      return { path, name: String(entry?.name || fileName).slice(0, 200), size: Number(stored.metadata?.size || entry?.size || 0), type: String(stored.metadata?.mimetype || entry?.type || "") };
    })
  );
  return checked.filter(Boolean) as SupportAttachment[];
}
