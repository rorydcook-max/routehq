import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendLineMessage } from "@/services/messaging/line";
import { sendPushToOrganization } from "@/lib/push";
import { alertSettings, wantsAlert } from "@/lib/alerts";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { operatorAlertEmail } from "@/lib/email/templates";
import { emailWords } from "@/lib/email/words";
import { isTelegramConfigured, sendTelegram } from "@/lib/telegram";
import { isAlertText, operatorAlertText, operatorLocale, type AlertText } from "@/lib/operator-alert-text";

export type { AlertText } from "@/lib/operator-alert-text";

/** Where an email alert goes: the address set in Integrations, else the business's owners. */
async function alertEmails(supabase: any, organisationId: string, emailTo: string | null | undefined): Promise<string[]> {
  if (emailTo && /.+@.+\..+/.test(emailTo)) return [emailTo.trim()];
  const { data: owners } = await supabase.from("organization_members").select("user_id").eq("organization_id", organisationId).eq("role", "owner").eq("is_active", true);
  const emails: string[] = [];
  for (const owner of (owners || []) as Array<{ user_id: string | null }>) {
    if (!owner.user_id) continue;
    const { data } = await supabase.auth.admin.getUserById(owner.user_id);
    if (data?.user?.email) emails.push(data.user.email);
  }
  return emails;
}

/**
 * Tells the business something happened: an alert on their devices, LINE, email and Telegram,
 * each only if switched on for this kind of event (Settings › Notifications).
 * `message` is a described alert (lib/operator-alert-text.ts), written in the operator's language on every channel:
 * the first active owner's app language, else the business's, else English. Ready-made words still work (as given;
 * only the title and the email's button and footer are translated).
 * Always fails silently - never throws - so it never breaks the main flow.
 */
export async function notifyOperator(
  organisationId: string,
  message: string | AlertText,
  type: string,
  /** Where tapping the alert on a phone opens. */
  url = "/tasks"
): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient() as any;

    const { data: org } = await supabase
      .from("organizations")
      .select("name, default_locale, line_user_id, line_channel_access_token, line_notifications_enabled, settings")
      .eq("id", organisationId)
      .maybeSingle();
    if (!org) return;
    const settings = org.settings || {};

    const toPush = wantsAlert(settings, type, "push");
    const accessToken: string = org.line_channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
    const toLine = Boolean(org.line_user_id && org.line_notifications_enabled !== false && wantsAlert(settings, type, "line") && accessToken);
    const toTelegram = Boolean(settings.telegram_chat_id && isTelegramConfigured() && wantsAlert(settings, type, "telegram"));
    const toEmail = isEmailConfigured() && wantsAlert(settings, type, "email");
    if (!toPush && !toLine && !toTelegram && !toEmail) return;

    const locale = await operatorLocale(supabase, organisationId, org.default_locale);
    const words = await operatorAlertText(locale);
    const text = isAlertText(message) ? words.render(message) : String(message || "");
    // The words without a leading emoji, for places that show their own title.
    const plain = isAlertText(message) ? words.render(message, false) : text.replace(/^[^\p{L}\p{N}฿$€£]+/u, "").trim();
    const title = words.title(type);
    const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const link = appUrl ? `${appUrl}${url}` : "";

    const jobs: Promise<unknown>[] = [];

    if (toPush) {
      jobs.push(sendPushToOrganization(supabase, organisationId, { title, body: plain, url }).catch(() => null));
    }

    if (toLine) {
      jobs.push(
        sendLineMessage(accessToken, org.line_user_id, [{ type: "text", text }]).then((result) =>
          supabase.from("line_messages").insert({
            organisation_id: organisationId,
            type,
            recipient_line_id: org.line_user_id,
            message_content: { type: "text", text },
            status: result.success ? "sent" : "failed",
            sent_at: result.success ? new Date().toISOString() : null,
            error: result.error ?? null
          })
        )
      );
    }

    if (toTelegram) {
      jobs.push(sendTelegram(settings.telegram_chat_id, link ? `${text}\n${link}` : text));
    }

    if (toEmail) {
      jobs.push(
        Promise.all([alertEmails(supabase, organisationId, alertSettings(settings).email_to), emailWords(locale)]).then(([emails, emailText]) =>
          Promise.all(
            emails.map((to) =>
              sendEmail({
                to,
                ...operatorAlertEmail({ title, plain, link, orgName: org.name, appUrl, words: emailText }),
                metadata: { kind: "operator_alert", type }
              })
            )
          )
        )
      );
    }

    await Promise.allSettled(jobs);
  } catch {
    // Silent - never surface to caller
  }
}
