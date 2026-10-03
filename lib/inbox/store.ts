import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type InboxChannel = {
  id: string;
  organization_id: string;
  provider: string;
  display_name: string | null;
  external_id: string | null;
  webhook_key: string;
  status: string;
  last_error: string | null;
  created_at: string;
};

export type InboxConversation = {
  id: string;
  channel_id: string;
  provider: string;
  external_user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  customer_id: string | null;
  status: "open" | "closed";
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_direction: string | null;
};

export type InboxMessage = {
  id: string;
  conversation_id: string;
  direction: "in" | "out";
  message_type: string;
  body: string | null;
  status: string;
  error: string | null;
  created_at: string;
};

/** Where a platform should deliver messages for this channel. */
export function webhookUrl(provider: string, key: string) {
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return `${base}/api/inbox/${provider}/${key}`;
}

/** Platforms only deliver to a public https address, so a local dev URL can't receive messages. */
export function webhookReachable() {
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "");
  return /^https:\/\//.test(base) && !/localhost|127\.0\.0\.1/.test(base);
}

export async function channelByWebhookKey(provider: string, key: string) {
  if (!/^[0-9a-f-]{36}$/i.test(key)) return null;
  const supabase = createSupabaseAdminClient() as any;
  const { data: channel } = await supabase
    .from("messaging_channels")
    .select("id, organization_id, provider, status")
    .eq("webhook_key", key)
    .eq("provider", provider)
    .maybeSingle();
  if (!channel || channel.status === "disconnected") return null;
  const { data: secrets } = await supabase.from("messaging_channel_secrets").select("access_token, signing_secret").eq("channel_id", channel.id).maybeSingle();
  if (!secrets) return null;
  return { ...channel, accessToken: String(secrets.access_token), signingSecret: String(secrets.signing_secret || "") } as {
    id: string;
    organization_id: string;
    provider: string;
    accessToken: string;
    signingSecret: string;
  };
}

/** What a non-text message shows as in the thread. */
export function describeNonText(type: string) {
  const names: Record<string, string> = {
    image: "📷 Photo",
    video: "🎬 Video",
    audio: "🎤 Voice message",
    file: "📎 File",
    location: "📍 Location",
    sticker: "Sticker"
  };
  return names[type] || "Message";
}

/**
 * Stores a message a customer sent, creating the conversation the first time
 * we hear from them. A message delivered twice by the platform is kept once.
 */
export async function recordInbound(input: {
  channel: { id: string; organization_id: string; provider: string };
  externalUserId: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  body: string;
  messageType?: string;
  externalId?: string | null;
  replyToken?: string | null;
}) {
  const supabase = createSupabaseAdminClient() as any;
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id, unread_count, display_name, avatar_url")
    .eq("channel_id", input.channel.id)
    .eq("external_user_id", input.externalUserId)
    .maybeSingle();

  let conversationId: string = existing?.id;
  if (!conversationId) {
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({
        organization_id: input.channel.organization_id,
        channel_id: input.channel.id,
        provider: input.channel.provider,
        external_user_id: input.externalUserId,
        display_name: input.displayName || null,
        avatar_url: input.avatarUrl || null
      })
      .select("id")
      .single();
    if (error || !created) return { ok: false as const, isNew: false };
    conversationId = created.id;
  }

  const { error: messageError } = await supabase.from("conversation_messages").insert({
    organization_id: input.channel.organization_id,
    conversation_id: conversationId,
    direction: "in",
    message_type: input.messageType || "text",
    body: input.body,
    external_id: input.externalId || null,
    status: "received"
  });
  // 23505: the platform retried a delivery we already stored.
  if (messageError) return { ok: messageError.code === "23505", isNew: false, conversationId };

  await supabase
    .from("conversations")
    .update({
      status: "open",
      unread_count: Number(existing?.unread_count || 0) + 1,
      last_message_at: now,
      last_message_preview: input.body.slice(0, 140),
      last_message_direction: "in",
      display_name: input.displayName || existing?.display_name || null,
      avatar_url: input.avatarUrl || existing?.avatar_url || null,
      reply_token: input.replyToken || null,
      reply_token_at: input.replyToken ? now : null
    })
    .eq("id", conversationId);

  return { ok: true as const, isNew: !existing, conversationId };
}
