import { lineBotInfo, PROVIDER_LABELS, telegramGetMe } from "@/lib/inbox/providers";

/**
 * Getting a customer onto a chat the business can message them on.
 *
 * LINE and Telegram only let a business message someone who has written to
 * it first. So the customer's booking page offers "Get updates on LINE /
 * Telegram": one tap opens the business's account with a short code, the
 * customer sends it, and the webhook ties that chat to their customer record.
 * From then on every automatic message reaches them there.
 */

export type ChatInvite = { provider: string; label: string; url: string; preferred: boolean };

/** The code a customer sends from LINE: the start of their booking link's token. */
const codeOf = (token: string) => String(token || "").slice(0, 12);

/** The account's public name, looked up once and kept on the channel. */
async function handleFor(admin: any, channel: any): Promise<string | null> {
  if (channel.public_handle) return String(channel.public_handle);
  const { data: secrets } = await admin.from("messaging_channel_secrets").select("access_token").eq("channel_id", channel.id).maybeSingle();
  const token = String(secrets?.access_token || "");
  if (!token) return null;
  let handle: string | null = null;
  if (channel.provider === "line") {
    const info = await lineBotInfo(token);
    handle = info.ok && info.data.basicId ? String(info.data.basicId) : null;
  } else if (channel.provider === "telegram") {
    const me = await telegramGetMe(token);
    handle = me.ok && me.data.result.username ? String(me.data.result.username) : null;
  }
  if (handle) await admin.from("messaging_channels").update({ public_handle: handle }).eq("id", channel.id).then(() => null, () => null);
  return handle;
}

/**
 * The chats this customer could open, for their booking page. Empty once they
 * already have one, or when the business has no account connected.
 */
export async function chatInvites(admin: any, input: { organizationId: string; customerId: string | null | undefined; token: string; organizationName?: string | null }): Promise<ChatInvite[]> {
  if (!input.customerId || !input.token) return [];
  const [{ data: linked }, { data: channels }, { data: customer }] = await Promise.all([
    admin.from("conversations").select("id").eq("organization_id", input.organizationId).eq("customer_id", input.customerId).limit(1),
    admin.from("messaging_channels").select("id, provider, public_handle, status").eq("organization_id", input.organizationId).neq("status", "disconnected"),
    admin.from("customers").select("preferred_contact_method").eq("id", input.customerId).maybeSingle()
  ]);
  if (linked?.length) return [];

  const preferred = String(customer?.preferred_contact_method || "").toLowerCase();
  const invites: ChatInvite[] = [];
  for (const channel of channels || []) {
    const handle = await handleFor(admin, channel).catch(() => null);
    if (!handle) continue;
    if (channel.provider === "line") {
      const text = `Booking ${codeOf(input.token)}`;
      invites.push({ provider: "line", label: PROVIDER_LABELS.line, url: `https://line.me/R/oaMessage/${encodeURIComponent(handle)}/?${encodeURIComponent(text)}`, preferred: preferred === "line" });
    } else if (channel.provider === "telegram") {
      invites.push({ provider: "telegram", label: PROVIDER_LABELS.telegram, url: `https://t.me/${encodeURIComponent(handle.replace(/^@/, ""))}?start=${input.token}`, preferred: preferred === "telegram" });
    }
  }
  return invites.sort((a, b) => Number(b.preferred) - Number(a.preferred));
}

/**
 * A message arrived that may carry a booking code (LINE: "Booking 1a2b3c4d5e6f";
 * Telegram: the token after /start). Ties the chat to that booking's customer.
 * Returns the customer's first name when it did.
 */
export async function linkChatFromCode(admin: any, input: { channel: { id: string; organization_id: string }; externalUserId: string; text: string }): Promise<string | null> {
  const match = String(input.text || "").match(/\b([0-9a-f]{12,64})\b/i);
  if (!match) return null;
  const code = match[1].toLowerCase();
  const { data: links } = await admin
    .from("booking_links")
    .select("customer_id, customers(full_name)")
    .eq("organization_id", input.channel.organization_id)
    .like("token", `${code}%`)
    .is("deleted_at", null)
    .not("customer_id", "is", null)
    .limit(2);
  // An ambiguous code ties nothing: better no link than the wrong customer.
  if (!links || links.length !== 1) return null;
  const link = links[0];
  const { data: updated } = await admin
    .from("conversations")
    .update({ customer_id: link.customer_id })
    .eq("channel_id", input.channel.id)
    .eq("external_user_id", input.externalUserId)
    .is("customer_id", null)
    .select("id");
  if (!updated?.length) return null;
  return String(link.customers?.full_name || "").trim().split(/\s+/)[0] || "there";
}

export const chatLinkedReply = (firstName: string, businessName?: string | null) =>
  `Thanks ${firstName}, you're connected. ${businessName || "We"} will send updates about your rental here, and you can message us any time.`;
