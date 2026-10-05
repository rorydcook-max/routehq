import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendLineMessage } from "@/services/messaging/line";
import { sendPushToOrganization } from "@/lib/push";

const PUSH_TITLES: Record<string, string> = {
  portal_action: "Customer request",
  payment_received: "Payment",
  contract_signed: "Booking signed",
  return_inspection: "Vehicle returned",
  new_message: "New message"
};

/**
 * Sends a text notification to the operator's LINE account.
 * Always fails silently — never throws — so it never breaks the main flow.
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
      .select("line_user_id, line_channel_access_token, line_notifications_enabled, settings")
      .eq("id", organisationId)
      .maybeSingle();

    // Per-alert switches apply to both the phone alert and LINE.
    if (org?.settings?.line_notifications?.[`event_${type}`] === false) return;
    // Phones and computers that asked for alerts. Emoji that lead LINE messages are dropped from the alert text.
    await sendPushToOrganization(supabase, organisationId, {
      title: PUSH_TITLES[type] || "RouteHQ",
      body: message.replace(/^[^\p{L}\p{N}฿]+/u, ""),
      url
    });

    if (!org?.line_user_id) return;
    if (org.line_notifications_enabled === false) return;
    // Per-alert switches from Settings → Notifications (all on unless turned off).
    if (org.settings?.line_notifications?.[`event_${type}`] === false) return;

    const accessToken: string =
      org.line_channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
    if (!accessToken) return;

    const result = await sendLineMessage(accessToken, org.line_user_id, [
      { type: "text", text: message }
    ]);

    await supabase.from("line_messages").insert({
      organisation_id: organisationId,
      type,
      recipient_line_id: org.line_user_id,
      message_content: { type: "text", text: message },
      status: result.success ? "sent" : "failed",
      sent_at: result.success ? new Date().toISOString() : null,
      error: result.error ?? null
    });
  } catch {
    // Silent — never surface to caller
  }
}
