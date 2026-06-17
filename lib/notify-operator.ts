import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendLineMessage } from "@/services/messaging/line";

/**
 * Sends a text notification to the operator's LINE account.
 * Always fails silently — never throws — so it never breaks the main flow.
 */
export async function notifyOperator(
  organisationId: string,
  message: string,
  type: string
): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient() as any;

    const { data: org } = await supabase
      .from("organizations")
      .select("line_user_id, line_channel_access_token, line_notifications_enabled")
      .eq("id", organisationId)
      .maybeSingle();

    if (!org?.line_user_id) return;
    if (org.line_notifications_enabled === false) return;

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
