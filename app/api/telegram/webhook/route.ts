import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTelegram } from "@/lib/telegram";

/**
 * Messages to the RouteHQ Telegram bot. The only thing it does: link a chat to a business.
 * Settings › Integrations gives a t.me/<bot>?start=<code> link; Telegram sends "/start <code>" here and the chat id
 * is saved on that business (settings.telegram_chat_id). Codes are single use and last 30 minutes.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("forbidden", { status: 403 });
  const update = (await request.json().catch(() => null)) as { message?: { text?: string; chat?: { id?: number; title?: string; first_name?: string } } } | null;
  const text = String(update?.message?.text || "").trim();
  const chatId = update?.message?.chat?.id;
  if (!chatId) return Response.json({ ok: true });

  const match = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9]{6,64})$/);
  if (!match) {
    await sendTelegram(chatId, "Hello! To get RouteHQ alerts here, open RouteHQ › Settings › Integrations and tap \"Connect Telegram\".");
    return Response.json({ ok: true });
  }

  const db = createSupabaseAdminClient() as any;
  const { data: org } = await db.from("organizations").select("id, name, settings").eq("settings->>telegram_link_code", match[1]).maybeSingle();
  const settings = (org?.settings || {}) as Record<string, any>;
  const expired = !settings.telegram_link_expires || Date.parse(settings.telegram_link_expires) < Date.now();
  if (!org || expired) {
    await sendTelegram(chatId, "That link has expired. Open RouteHQ › Settings › Integrations and tap \"Connect Telegram\" again.");
    return Response.json({ ok: true });
  }

  const next: Record<string, any> = { ...settings, telegram_chat_id: String(chatId), telegram_connected_at: new Date().toISOString() };
  delete next.telegram_link_code;
  delete next.telegram_link_expires;
  await db.from("organizations").update({ settings: next }).eq("id", org.id);
  await sendTelegram(chatId, `✅ Connected. RouteHQ alerts for ${org.name || "your business"} will arrive here. Choose which ones in Settings › Notifications.`);
  return Response.json({ ok: true });
}
