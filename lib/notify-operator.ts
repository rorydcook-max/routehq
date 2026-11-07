import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendPushToOrganization } from "@/lib/push";
import { alertSettings, wantsAlert } from "@/lib/alerts";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { operatorAlertEmail } from "@/lib/email/templates";
import { emailWords } from "@/lib/email/words";
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
 * Tells the business something happened: an alert on their devices and by email,
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
      .select("name, default_locale, settings")
      .eq("id", organisationId)
      .maybeSingle();
    if (!org) return;
    const settings = org.settings || {};

    // Alerts go by push and email only (Rory, 7 Nov 2026). LINE carries just the optional morning summary
    // (app/api/line/daily-summary); Telegram and WhatsApp are for customer chats, not alerts.
    const toPush = wantsAlert(settings, type, "push");
    const toEmail = isEmailConfigured() && wantsAlert(settings, type, "email");
    if (!toPush && !toEmail) return;

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
