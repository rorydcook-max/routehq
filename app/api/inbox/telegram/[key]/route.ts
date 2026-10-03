import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { channelByWebhookKey, describeNonText, recordInbound } from "@/lib/inbox/store";

export const runtime = "nodejs";

function sameSecret(expected: string, given: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Messages sent to a business's own Telegram bot. Telegram echoes the secret we gave it when the bot was connected. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const channel = await channelByWebhookKey("telegram", key);
  if (!channel) return NextResponse.json({ error: "Unknown channel" }, { status: 404 });
  if (!sameSecret(channel.signingSecret, request.headers.get("x-telegram-bot-api-secret-token") ?? "")) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  let update: Record<string, any>;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = update.message;
  // Private chats only; a bot added to a group isn't a customer conversation.
  if (!message || message.chat?.type !== "private" || message.from?.is_bot) return NextResponse.json({ ok: true });

  const kind = message.text ? "text" : message.photo ? "image" : message.video ? "video" : message.voice || message.audio ? "audio" : message.document ? "file" : message.location ? "location" : message.sticker ? "sticker" : "other";
  const caption = typeof message.caption === "string" && message.caption ? ` · ${message.caption}` : "";
  const body = kind === "text" ? String(message.text) : `${describeNonText(kind)}${caption}`;
  // "/start" is what Telegram sends when someone first opens the bot; it isn't a message from them.
  if (body.trim() === "/start") return NextResponse.json({ ok: true });

  const name = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || (message.from?.username ? `@${message.from.username}` : null);
  await recordInbound({
    channel,
    externalUserId: String(message.chat.id),
    displayName: name,
    body,
    messageType: kind,
    externalId: String(message.message_id)
  });

  return NextResponse.json({ ok: true });
}
