import crypto from "crypto";

/**
 * Thin wrappers around each messaging platform's official API. Every call
 * returns { ok, error } rather than throwing, so one failed send never takes
 * a page down.
 */

export type InboxProvider = "line" | "telegram";

export const PROVIDER_LABELS: Record<string, string> = {
  line: "LINE",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  instagram: "Instagram"
};

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(url: string, init: RequestInit, pickError: (body: any) => string | undefined): Promise<Result<T>> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    const text = await response.text();
    let body: any = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    if (!response.ok || body?.ok === false) {
      return { ok: false, error: pickError(body) || `The platform answered ${response.status}.` };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "Couldn't reach the messaging platform. Try again in a moment." };
  }
}

// ── LINE Messaging API ──────────────────────────────────────────────────────

const lineHeaders = (token: string) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });
const lineError = (body: any) => (typeof body?.message === "string" ? body.message : undefined);

/** Who this channel token belongs to: confirms the token works and names the account. */
export function lineBotInfo(token: string) {
  return call<{ userId: string; basicId?: string; displayName?: string }>("https://api.line.me/v2/bot/info", { headers: lineHeaders(token) }, lineError);
}

/** Points the LINE channel at our webhook, so the operator doesn't have to paste a URL into LINE's console. */
export function lineSetWebhook(token: string, endpoint: string) {
  return call("https://api.line.me/v2/bot/channel/webhook/endpoint", { method: "PUT", headers: lineHeaders(token), body: JSON.stringify({ endpoint }) }, lineError);
}

export function lineProfile(token: string, userId: string) {
  return call<{ displayName?: string; pictureUrl?: string }>(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, { headers: lineHeaders(token) }, lineError);
}

/** A reply to a fresh message is free on LINE; a push counts against the account's monthly allowance. */
export function lineReply(token: string, replyToken: string, text: string) {
  return call("https://api.line.me/v2/bot/message/reply", { method: "POST", headers: lineHeaders(token), body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }) }, lineError);
}

export function linePush(token: string, userId: string, text: string) {
  return call("https://api.line.me/v2/bot/message/push", { method: "POST", headers: lineHeaders(token), body: JSON.stringify({ to: userId, messages: [{ type: "text", text }] }) }, lineError);
}

export function lineSignatureValid(secret: string, rawBody: string, signature: string) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Telegram Bot API ────────────────────────────────────────────────────────

const telegramUrl = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;
const telegramError = (body: any) => (typeof body?.description === "string" ? body.description : undefined);
const jsonPost = (payload: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

export function telegramGetMe(token: string) {
  return call<{ result: { id: number; username?: string; first_name?: string } }>(telegramUrl(token, "getMe"), {}, telegramError);
}

/** `secret` comes back on every webhook call in a header, which is how we know it's really Telegram. */
export function telegramSetWebhook(token: string, url: string, secret: string) {
  return call(telegramUrl(token, "setWebhook"), jsonPost({ url, secret_token: secret, allowed_updates: ["message"] }), telegramError);
}

export function telegramDeleteWebhook(token: string) {
  return call(telegramUrl(token, "deleteWebhook"), jsonPost({}), telegramError);
}

export function telegramSend(token: string, chatId: string, text: string) {
  return call<{ result: { message_id: number } }>(telegramUrl(token, "sendMessage"), jsonPost({ chat_id: chatId, text }), telegramError);
}
