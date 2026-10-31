import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendLineMessage } from "@/services/messaging/line";
import { sendPushToOrganization } from "@/lib/push";
import { alertSettings, wantsAlert } from "@/lib/alerts";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { isTelegramConfigured, sendTelegram } from "@/lib/telegram";

const PUSH_TITLES: Record<string, string> = {
  portal_action: "Customer request",
  payment_received: "Payment",
  contract_signed: "Booking signed",
  return_inspection: "Vehicle returned",
  new_message: "New message",
  support_reply: "RoveHQ Help",
  plan_activated: "Your plan"
};

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
 * Always fails silently - never throws - so it never breaks the main flow.
 */
export async function notifyOperator(
  organisationId: string,
  message: string,
  type: string,
  /** Where tapping the alert on a phone opens. */
  url = "/tasks"
): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient() as any;

    const { data: org } = await supabase
      .from("organizations")
      .select("name, line_user_id, line_channel_access_token, line_notifications_enabled, settings")
      .eq("id", organisationId)
      .maybeSingle();
    if (!org) return;
    const settings = org.settings || {};
    // The words without a leading emoji, for places that show their own title.
    const plain = message.replace(/^[^\p{L}\p{N}฿$€£]+/u, "").trim();
    const title = PUSH_TITLES[type] || "RoveHQ";
    const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    const link = appUrl ? `${appUrl}${url}` : "";

    const jobs: Promise<unknown>[] = [];

    if (wantsAlert(settings, type, "push")) {
      jobs.push(sendPushToOrganization(supabase, organisationId, { title, body: plain, url }).catch(() => null));
    }

    if (org.line_user_id && org.line_notifications_enabled !== false && wantsAlert(settings, type, "line")) {
      const accessToken: string = org.line_channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
      if (accessToken) {
        jobs.push(
          sendLineMessage(accessToken, org.line_user_id, [{ type: "text", text: message }]).then((result) =>
            supabase.from("line_messages").insert({
              organisation_id: organisationId,
              type,
              recipient_line_id: org.line_user_id,
              message_content: { type: "text", text: message },
              status: result.success ? "sent" : "failed",
              sent_at: result.success ? new Date().toISOString() : null,
              error: result.error ?? null
            })
          )
        );
      }
    }

    if (settings.telegram_chat_id && isTelegramConfigured() && wantsAlert(settings, type, "telegram")) {
      jobs.push(sendTelegram(settings.telegram_chat_id, link ? `${message}\n${link}` : message));
    }

    if (isEmailConfigured() && wantsAlert(settings, type, "email")) {
      jobs.push(
        alertEmails(supabase, organisationId, alertSettings(settings).email_to).then((emails) =>
          Promise.all(
            emails.map((to) =>
              sendEmail({
                to,
                subject: `${title}: ${plain.slice(0, 80)}`,
                text: `${plain}\n\n${link ? `Open in RoveHQ: ${link}\n\n` : ""}You get this because email alerts are on for ${org.name || "your business"}. Change them in Settings › Notifications.`,
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
