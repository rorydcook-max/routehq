/**
 * Telegram alerts for operators, through one Lokalfleet bot (Integrations, 27 Oct 2026).
 * Setup (once, by Lokalfleet): create a bot with @BotFather, then set
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME (without @) and TELEGRAM_WEBHOOK_SECRET (any long random string),
 * and open /api/telegram/setup while signed in as a platform admin to point the bot at /api/telegram/webhook.
 * An operator connects by tapping a t.me link with a one-time code; the bot's /start message carries the code
 * and the webhook saves their chat id on the business (settings.telegram_chat_id).
 */

export function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME);
}

export function telegramBotUsername() {
  return String(process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "");
}

/** Sends a plain-text message. Never throws: returns whether it went. */
export async function sendTelegram(chatId: string | number, text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return { ok: false, error: "not configured" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    return json.ok ? { ok: true } : { ok: false, error: json.description || `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Points the bot's updates at this app. Called once from /api/telegram/setup. */
export async function setTelegramWebhook(appUrl: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not set" };
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET || undefined,
      allowed_updates: ["message"]
    })
  });
  return (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as { ok: boolean; description?: string };
}
