import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendLineMessage } from "@/services/messaging/line";
import { sendPushToUsers } from "@/lib/push";
import { planById } from "@/lib/plans";

/**
 * Help: a conversation between a business and the RouteHQ team, with files.
 * The business chooses how it prefers to hear back (in RouteHQ, WhatsApp, LINE
 * or email); the in-app conversation is always there either way.
 */

export * from "@/lib/support-shared";
import { SUPPORT_BUCKET, type SupportAttachment } from "@/lib/support-shared";

/** RouteHQ's own contact details, set at launch (launch checklist: "Support contact details"). Only those set are shown. */
export function supportContacts() {
  const whatsapp = String(process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || process.env.SUPPORT_WHATSAPP || "").replace(/[^\d+]/g, "");
  const line = String(process.env.NEXT_PUBLIC_SUPPORT_LINE || process.env.LINE_OA_ID || "").trim();
  const email = String(process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || "").trim();
  return {
    whatsapp: whatsapp || null,
    whatsappUrl: whatsapp ? `https://wa.me/${whatsapp.replace(/^\+/, "")}` : null,
    line: line || null,
    lineUrl: line ? `https://line.me/R/ti/p/${encodeURIComponent(line.startsWith("@") ? line : `@${line}`)}` : null,
    email: email || null
  };
}

/** Yearly Growth and above: the import is done for them. */
export function importIncluded(organization: { subscription_tier?: string | null; subscription_status?: string | null; billing_interval?: string | null }) {
  return planById(organization.subscription_tier).setupService && organization.billing_interval === "yearly";
}

export async function isPlatformAdmin(supabase: any, userId: string | null | undefined) {
  if (!userId) return false;
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

export function cleanFileName(name: string) {
  return (name || "file").replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(-80) || "file";
}

/** Signed links for a message's files, valid for an hour. */
export async function signAttachments(admin: any, attachments: SupportAttachment[]) {
  if (!attachments?.length) return [] as (SupportAttachment & { url: string | null })[];
  const { data } = await admin.storage.from(SUPPORT_BUCKET).createSignedUrls(
    attachments.map((file) => file.path),
    3600
  );
  return attachments.map((file, index) => ({ ...file, url: data?.[index]?.signedUrl || null }));
}

/**
 * Tells the RouteHQ team someone wrote in: a phone alert to every platform admin who turned alerts on,
 * plus LINE and Telegram when those are set up. Never throws.
 */
export async function alertTeam(text: string, threadId: string) {
  try {
    const admin = createSupabaseAdminClient() as any;
    const url = `/help/team/${threadId}`;
    const { data: admins } = await admin.from("platform_admins").select("user_id");
    const ids = ((admins || []) as any[]).map((row) => row.user_id).filter(Boolean);
    if (ids.length) await sendPushToUsers(admin, ids, { title: "RouteHQ Help", body: text, url, tag: `support-${threadId}` });

    const base = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const full = `${text}${base ? `\n${base}${url}` : ""}`;
    const lineTo = process.env.SUPPORT_ALERT_LINE_USER_ID;
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (lineTo && lineToken) await sendLineMessage(lineToken, lineTo, [{ type: "text", text: full }]).catch(() => null);
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChat = process.env.SUPPORT_ALERT_TELEGRAM_CHAT_ID;
    if (telegramToken && telegramChat) {
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: telegramChat, text: full })
      }).catch(() => null);
    }
  } catch {
    // An alert that fails must not lose the message: it is saved already.
  }
}
