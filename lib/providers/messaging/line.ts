import crypto from "crypto";

const LINE_API_BASE = "https://api.line.me/v2/bot";

export interface LineTextMessage {
  type: "text";
  text: string;
}

export interface LineFlexMessage {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
}

export type LineMessage = LineTextMessage | LineFlexMessage;

export function verifyLineSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function sendLinePushMessage(userId: string, messages: LineMessage[]): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured.");

  const res = await fetch(`${LINE_API_BASE}/message/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ to: userId, messages })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE push failed (${res.status}): ${body}`);
  }
}

export function lineText(text: string): LineTextMessage {
  return { type: "text", text };
}

export function lineFlex(altText: string, contents: Record<string, unknown>): LineFlexMessage {
  return { type: "flex", altText, contents };
}

export async function sendLineText(userId: string, text: string): Promise<void> {
  await sendLinePushMessage(userId, [lineText(text)]);
}

export async function sendLineNotification(
  userId: string,
  title: string,
  body: string,
  emoji = "🔔"
): Promise<void> {
  await sendLineText(userId, `${emoji} *${title}*\n${body}`);
}
