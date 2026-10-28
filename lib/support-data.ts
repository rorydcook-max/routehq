import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { planById } from "@/lib/plans";
import { importIncluded, signAttachments, supportPreference, type SupportAttachment, type SupportChannel } from "@/lib/support";

export type SupportThreadRow = {
  id: string;
  organizationId: string;
  businessName: string;
  topic: string;
  subject: string;
  status: "open" | "answered" | "closed";
  lastMessageAt: string;
  unread: boolean;
};

export type SupportMessageRow = {
  id: string;
  fromTeam: boolean;
  authorName: string;
  body: string;
  createdAt: string;
  attachments: (SupportAttachment & { url: string | null })[];
};

function row(thread: any, side: "business" | "team"): SupportThreadRow {
  return {
    id: thread.id,
    organizationId: thread.organization_id,
    businessName: String(thread.organizations?.name || ""),
    topic: thread.topic,
    subject: thread.subject,
    status: thread.status,
    lastMessageAt: thread.last_message_at,
    unread: side === "team" ? Boolean(thread.unread_by_team) : Boolean(thread.unread_by_business)
  };
}

/** A business's own conversations, newest first. */
export async function listBusinessThreads(supabase: any, organizationId: string): Promise<SupportThreadRow[]> {
  const { data } = await supabase
    .from("support_threads")
    .select("id, organization_id, topic, subject, status, last_message_at, unread_by_business, unread_by_team")
    .eq("organization_id", organizationId)
    .order("last_message_at", { ascending: false })
    .limit(50);
  return ((data || []) as any[]).map((thread) => row(thread, "business"));
}

/** Every business's conversations, for the Lokalfleet team. */
export async function listTeamThreads(filter: "waiting" | "all"): Promise<SupportThreadRow[]> {
  const admin = createSupabaseAdminClient() as any;
  let query = admin
    .from("support_threads")
    .select("id, organization_id, topic, subject, status, last_message_at, unread_by_business, unread_by_team, organizations(name)")
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (filter === "waiting") query = query.eq("status", "open");
  const { data } = await query;
  return ((data || []) as any[]).map((thread) => row(thread, "team"));
}

export async function countUnreadForBusiness(supabase: any, organizationId: string) {
  const { count } = await supabase.from("support_threads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("unread_by_business", true);
  return count || 0;
}

export async function countWaitingForTeam() {
  const admin = createSupabaseAdminClient() as any;
  const { count } = await admin.from("support_threads").select("id", { count: "exact", head: true }).eq("status", "open");
  return count || 0;
}

/**
 * One conversation with its messages and file links. Opening it marks it read for whoever is looking.
 * `organizationId` limits a business to its own conversations; the team passes null.
 */
export async function loadThread(threadId: string, viewer: { side: "business" | "team"; organizationId: string | null }) {
  const admin = createSupabaseAdminClient() as any;
  const { data: thread } = await admin
    .from("support_threads")
    .select("id, organization_id, topic, subject, status, last_message_at, unread_by_business, unread_by_team, created_at, organizations(name, slug, subscription_tier, subscription_status, billing_interval, business_phone, business_email, whatsapp, line_id, settings)")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return null;
  if (viewer.side === "business" && thread.organization_id !== viewer.organizationId) return null;

  const { data: messages } = await admin.from("support_messages").select("id, author_id, from_team, body, attachments, created_at").eq("thread_id", thread.id).order("created_at", { ascending: true });
  const authorIds = Array.from(new Set(((messages || []) as any[]).map((message) => message.author_id).filter(Boolean)));
  const { data: profiles } = authorIds.length ? await admin.from("users").select("id, full_name").in("id", authorIds) : { data: [] };
  const names = new Map(((profiles || []) as any[]).map((profile) => [profile.id, String(profile.full_name || "")]));
  const rows: SupportMessageRow[] = await Promise.all(
    ((messages || []) as any[]).map(async (message) => ({
      id: message.id,
      fromTeam: Boolean(message.from_team),
      authorName: names.get(message.author_id) || "",
      body: String(message.body || ""),
      createdAt: message.created_at,
      attachments: await signAttachments(admin, Array.isArray(message.attachments) ? message.attachments : [])
    }))
  );

  if (viewer.side === "team" && thread.unread_by_team) await admin.from("support_threads").update({ unread_by_team: false }).eq("id", thread.id);
  if (viewer.side === "business" && thread.unread_by_business) await admin.from("support_threads").update({ unread_by_business: false }).eq("id", thread.id);

  const org = thread.organizations || {};
  const preference = supportPreference(org.settings);
  return {
    thread: row(thread, viewer.side),
    createdAt: thread.created_at as string,
    messages: rows,
    business: {
      name: String(org.name || ""),
      slug: String(org.slug || ""),
      plan: planById(org.subscription_tier).id,
      status: String(org.subscription_status || "trial"),
      yearly: org.billing_interval === "yearly",
      importIncluded: importIncluded(org),
      phone: String(org.business_phone || org.whatsapp || ""),
      email: String(org.business_email || ""),
      lineId: String(org.line_id || ""),
      preference: preference as { channel: SupportChannel; handle: string }
    }
  };
}

export type LoadedThread = NonNullable<Awaited<ReturnType<typeof loadThread>>>;
