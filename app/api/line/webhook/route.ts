import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const LINK_CODE = /\bRHQ-[A-Z0-9]{6}\b/i;

async function reply(replyToken: unknown, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || typeof replyToken !== "string" || !replyToken) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] })
  }).catch(() => null);
}

/**
 * Connects a business's LINE alerts: the owner sends the code shown in
 * Settings, and the LINE user who sent it becomes the alert recipient.
 */
async function linkWithCode(userId: string, code: string) {
  const supabase = createSupabaseAdminClient() as any;
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, trading_name, line_link_code_expires_at")
    .eq("line_link_code", code.toUpperCase())
    .is("deleted_at", null)
    .maybeSingle();
  if (!org) return { ok: false as const, reason: "unknown" };
  if (!org.line_link_code_expires_at || new Date(org.line_link_code_expires_at).getTime() < Date.now()) {
    return { ok: false as const, reason: "expired" };
  }
  const { error } = await supabase
    .from("organizations")
    .update({
      line_user_id: userId,
      line_notifications_enabled: true,
      line_daily_summary_enabled: true,
      line_link_code: null,
      line_link_code_expires_at: null
    })
    .eq("id", org.id);
  if (error) return { ok: false as const, reason: "error" };
  return { ok: true as const, name: String(org.trading_name || org.name || "your business") };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  const secret = process.env.LINE_CHANNEL_SECRET ?? "";
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  if (!secret || expected !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { events?: unknown[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const event of Array.isArray(payload.events) ? payload.events : []) {
    const e = event as Record<string, any>;
    const userId = typeof e.source?.userId === "string" ? e.source.userId : "";
    if (!userId) continue;

    if (e.type === "follow") {
      await reply(
        e.replyToken,
        "Welcome to RouteHQ! To get your fleet alerts here, open RouteHQ → Settings → LINE, tap “Get a connection code” and send the code to this chat."
      );
      continue;
    }

    if (e.type === "message" && e.message?.type === "text") {
      const match = String(e.message.text || "").match(LINK_CODE);
      if (!match) continue;
      const result = await linkWithCode(userId, match[0]);
      if (result.ok) {
        await reply(e.replyToken, `✅ Connected. RouteHQ alerts and your morning summary for ${result.name} will arrive in this chat.`);
      } else if (result.reason === "expired") {
        await reply(e.replyToken, "That code has expired. Get a new one in RouteHQ → Settings → LINE and send it here.");
      } else {
        await reply(e.replyToken, "That code wasn't recognised. Check it in RouteHQ → Settings → LINE and try again.");
      }
    }
  }

  return NextResponse.json({ ok: true });
}
