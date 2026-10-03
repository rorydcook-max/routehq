import { NextRequest, NextResponse } from "next/server";
import { lineProfile, lineSignatureValid } from "@/lib/inbox/providers";
import { channelByWebhookKey, describeNonText, recordInbound } from "@/lib/inbox/store";

export const runtime = "nodejs";

/**
 * Messages sent to a business's own LINE Official Account. The key in the
 * URL finds the business; LINE's signature (made with that business's
 * channel secret) proves the call is genuine.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const rawBody = await request.text();
  const channel = await channelByWebhookKey("line", key);
  if (!channel) return NextResponse.json({ error: "Unknown channel" }, { status: 404 });
  if (!lineSignatureValid(channel.signingSecret, rawBody, request.headers.get("x-line-signature") ?? "")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { events?: unknown[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const raw of Array.isArray(payload.events) ? payload.events : []) {
    const event = raw as Record<string, any>;
    const userId = typeof event.source?.userId === "string" ? event.source.userId : "";
    // Group chats aren't a customer conversation; one-to-one only.
    if (!userId || event.source?.type !== "user" || event.type !== "message") continue;

    const message = event.message || {};
    const body = message.type === "text" ? String(message.text || "") : describeNonText(String(message.type || ""));
    if (!body) continue;

    const profile = await lineProfile(channel.accessToken, userId);
    await recordInbound({
      channel,
      externalUserId: userId,
      displayName: profile.ok ? profile.data.displayName : null,
      avatarUrl: profile.ok ? profile.data.pictureUrl : null,
      body,
      messageType: String(message.type || "text"),
      externalId: typeof message.id === "string" ? message.id : null,
      replyToken: typeof event.replyToken === "string" ? event.replyToken : null
    });
  }

  return NextResponse.json({ ok: true });
}
