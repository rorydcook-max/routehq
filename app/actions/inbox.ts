"use server";

import { said } from "@/lib/i18n/server-text";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { OWNER_ONLY_MESSAGE } from "@/lib/auth/role-types";
import { draftReply } from "@/lib/inbox/assistant";
import { lineBotInfo, linePush, lineReply, lineSetWebhook, telegramDeleteWebhook, telegramGetMe, telegramSend, telegramSetWebhook } from "@/lib/inbox/providers";
import { webhookReachable, webhookUrl } from "@/lib/inbox/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ActionResult<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const SIGNED_OUT = "Please sign in again.";

/**
 * Connects a business's own LINE Official Account or Telegram bot. The token
 * is checked with the platform first, so a typo is caught here rather than
 * showing up later as messages that never arrive.
 */
export async function connectChannel(input: { provider: "line" | "telegram"; accessToken: string; channelSecret?: string }): Promise<ActionResult<{ name: string; webhook: string; webhookSet: boolean }>> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said(SIGNED_OUT) };
  if (membership.role !== "owner") return { ok: false, error: await said(OWNER_ONLY_MESSAGE) };

  const accessToken = String(input.accessToken || "").trim();
  const channelSecret = String(input.channelSecret || "").trim();
  if (!accessToken) return { ok: false, error: await said("Paste the access token first.") };

  let externalId = "";
  let name = "";
  let publicHandle: string | null = null;
  let signingSecret = channelSecret;

  if (input.provider === "line") {
    if (!channelSecret) return { ok: false, error: await said("Paste the channel secret as well. It's on the Basic settings tab in LINE Developers.") };
    const info = await lineBotInfo(accessToken);
    if (!info.ok) return { ok: false, error: `LINE didn't accept that access token. ${info.error}` };
    externalId = info.data.userId;
    name = info.data.displayName || info.data.basicId || "LINE Official Account";
    publicHandle = info.data.basicId || null;
  } else {
    const me = await telegramGetMe(accessToken);
    if (!me.ok) return { ok: false, error: await said(`Telegram didn't accept that bot token. ${me.error}`) };
    externalId = String(me.data.result.id);
    name = me.data.result.username ? `@${me.data.result.username}` : me.data.result.first_name || "Telegram bot";
    publicHandle = me.data.result.username || null;
    signingSecret = crypto.randomBytes(24).toString("hex");
  }

  const supabase = createSupabaseAdminClient() as any;
  const { data: channel, error } = await supabase
    .from("messaging_channels")
    .upsert(
      {
        organization_id: membership.organizationId,
        provider: input.provider,
        display_name: name,
        external_id: externalId,
        public_handle: publicHandle,
        status: "connected",
        last_error: null,
        connected_by: membership.userId,
        updated_at: new Date().toISOString()
      },
      { onConflict: "organization_id,provider,external_id" }
    )
    .select("id, webhook_key")
    .single();
  if (error || !channel) return { ok: false, error: await said("Couldn't save the connection. Please try again.") };

  const { error: secretError } = await supabase
    .from("messaging_channel_secrets")
    .upsert({ channel_id: channel.id, access_token: accessToken, signing_secret: signingSecret, updated_at: new Date().toISOString() });
  if (secretError) return { ok: false, error: await said("Couldn't save the connection. Please try again.") };

  // Tell the platform where to deliver messages, so there's no URL to copy around.
  const webhook = webhookUrl(input.provider, channel.webhook_key);
  let webhookSet = false;
  if (webhookReachable()) {
    const set = input.provider === "line" ? await lineSetWebhook(accessToken, webhook) : await telegramSetWebhook(accessToken, webhook, signingSecret);
    webhookSet = set.ok;
    if (!set.ok) await supabase.from("messaging_channels").update({ last_error: set.error }).eq("id", channel.id);
  }

  revalidatePath("/settings");
  revalidatePath("/inbox");
  return { ok: true, name, webhook, webhookSet };
}

export async function disconnectChannel(channelId: string): Promise<ActionResult> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said(SIGNED_OUT) };
  if (membership.role !== "owner") return { ok: false, error: await said(OWNER_ONLY_MESSAGE) };

  const supabase = createSupabaseAdminClient() as any;
  const { data: channel } = await supabase.from("messaging_channels").select("id, provider").eq("id", channelId).eq("organization_id", membership.organizationId).maybeSingle();
  if (!channel) return { ok: false, error: await said("That connection no longer exists.") };

  if (channel.provider === "telegram") {
    const { data: secrets } = await supabase.from("messaging_channel_secrets").select("access_token").eq("channel_id", channel.id).maybeSingle();
    if (secrets?.access_token) await telegramDeleteWebhook(String(secrets.access_token));
  }
  // The token is deleted; past conversations stay as the business's own record.
  await supabase.from("messaging_channel_secrets").delete().eq("channel_id", channel.id);
  await supabase.from("messaging_channels").update({ status: "disconnected", updated_at: new Date().toISOString() }).eq("id", channel.id);

  revalidatePath("/settings");
  revalidatePath("/inbox");
  return { ok: true };
}

async function conversationForMember(conversationId: string) {
  const membership = await getCurrentMembership();
  if (!membership) return { error: await said(SIGNED_OUT) } as const;
  const supabase = createSupabaseAdminClient() as any;
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, organization_id, channel_id, provider, external_user_id, display_name, customer_id, reply_token, reply_token_at")
    .eq("id", conversationId)
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (!conversation) return { error: await said("That conversation no longer exists.") } as const;
  return { membership, supabase, conversation } as const;
}

/** Sends a reply to the customer on whichever platform they wrote from. */
export async function sendInboxMessage(conversationId: string, text: string): Promise<ActionResult> {
  const body = String(text || "").trim();
  if (!body) return { ok: false, error: await said("Type a message first.") };
  if (body.length > 4000) return { ok: false, error: await said("That message is too long. Keep it under 4,000 characters.") };

  const found = await conversationForMember(conversationId);
  if ("error" in found) return { ok: false, error: found.error as string };
  const { membership, supabase, conversation } = found;

  const { data: channel } = await supabase.from("messaging_channels").select("id, status").eq("id", conversation.channel_id).maybeSingle();
  const { data: secrets } = await supabase.from("messaging_channel_secrets").select("access_token").eq("channel_id", conversation.channel_id).maybeSingle();
  if (!channel || channel.status === "disconnected" || !secrets?.access_token) {
    return { ok: false, error: await said("This account is no longer connected. Reconnect it in Settings → Messaging to reply.") };
  }
  const token = String(secrets.access_token);

  let result: { ok: boolean; error?: string };
  if (conversation.provider === "line") {
    // LINE's reply token is single-use and short-lived; within that window the reply is free.
    const fresh = conversation.reply_token && conversation.reply_token_at && Date.now() - new Date(conversation.reply_token_at).getTime() < 45_000;
    result = fresh ? await lineReply(token, conversation.reply_token, body) : { ok: false };
    if (!result.ok) result = await linePush(token, conversation.external_user_id, body);
  } else if (conversation.provider === "telegram") {
    result = await telegramSend(token, conversation.external_user_id, body);
  } else {
    result = { ok: false, error: await said("Replies on this platform aren't supported yet.") };
  }

  const now = new Date().toISOString();
  await supabase.from("conversation_messages").insert({
    organization_id: conversation.organization_id,
    conversation_id: conversation.id,
    direction: "out",
    body,
    sent_by: membership.userId,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error || "Not delivered"
  });
  if (result.ok) {
    await supabase
      .from("conversations")
      .update({ last_message_at: now, last_message_preview: body.slice(0, 140), last_message_direction: "out", unread_count: 0, reply_token: null, reply_token_at: null })
      .eq("id", conversation.id);
  }

  revalidatePath("/inbox");
  return result.ok ? { ok: true } : { ok: false, error: await said(`The message wasn't delivered. ${result.error || ""}`.trim()) };
}

export async function markConversationRead(conversationId: string): Promise<ActionResult> {
  const found = await conversationForMember(conversationId);
  if ("error" in found) return { ok: false, error: found.error as string };
  await found.supabase.from("conversations").update({ unread_count: 0 }).eq("id", conversationId);
  revalidatePath("/inbox");
  return { ok: true };
}

export async function setConversationStatus(conversationId: string, status: "open" | "closed"): Promise<ActionResult> {
  const found = await conversationForMember(conversationId);
  if ("error" in found) return { ok: false, error: found.error as string };
  await found.supabase.from("conversations").update({ status: status === "closed" ? "closed" : "open", unread_count: 0 }).eq("id", conversationId);
  revalidatePath("/inbox");
  return { ok: true };
}

/** Ties a chat to a customer record, so their bookings show beside the conversation. */
export async function linkConversationCustomer(conversationId: string, customerId: string | null): Promise<ActionResult> {
  const found = await conversationForMember(conversationId);
  if ("error" in found) return { ok: false, error: found.error as string };
  if (customerId) {
    const { data: customer } = await found.supabase.from("customers").select("id").eq("id", customerId).eq("organization_id", found.membership.organizationId).maybeSingle();
    if (!customer) return { ok: false, error: await said("That customer wasn't found.") };
  }
  await found.supabase.from("conversations").update({ customer_id: customerId }).eq("id", conversationId);
  revalidatePath("/inbox");
  return { ok: true };
}

/** A suggested reply for staff to check and send; nothing goes to the customer automatically. */
export async function suggestInboxReply(conversationId: string): Promise<ActionResult<{ draft: string }>> {
  const found = await conversationForMember(conversationId);
  if ("error" in found) return { ok: false, error: found.error as string };
  const draft = await draftReply({ organizationId: found.membership.organizationId, conversationId, customerId: found.conversation.customer_id });
  if (!draft.ok) return { ok: false, error: draft.error };
  return { ok: true, draft: draft.text };
}
