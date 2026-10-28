import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildDailySummaryMessages, fetchSummaryData, sendDailySummary } from "@/lib/line/daily-summary";
import { alertSettings, wantsSummary } from "@/lib/alerts";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { isTelegramConfigured, sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";

/** The words of a LINE summary (its cards), as plain lines for Telegram and email. */
function plainText(messages: unknown): string {
  const lines: string[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === "box" && node.layout === "horizontal" && Array.isArray(node.contents)) {
      const row = node.contents.filter((child: any) => child?.type === "text" && child.text).map((child: any) => child.text).join("  ·  ");
      if (row) lines.push(row);
      return;
    }
    if (node.type === "text" && typeof node.text === "string" && node.text !== "Lokalfleet") lines.push(node.text);
    for (const key of ["contents", "header", "body", "footer"]) if (node[key]) walk(node[key]);
  };
  walk(messages);
  return lines.join("\n");
}

/**
 * The morning summary (08:00 Bangkok, Vercel Cron): on LINE for businesses that connected it and left it on,
 * and on Telegram / by email where Settings › Notifications says so.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient() as any;
  const { data: orgs, error: orgsError } = await supabase
    .from("organizations")
    .select("id, name, line_user_id, line_notifications_enabled, line_daily_summary_enabled, settings")
    .is("deleted_at", null);

  if (orgsError) {
    return NextResponse.json({ error: orgsError.message }, { status: 500 });
  }

  const results: Array<{ org: string; channel: string; success: boolean; error?: string }> = [];
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  for (const org of orgs ?? []) {
    const settings = org.settings || {};
    if (org.line_user_id && org.line_notifications_enabled !== false && org.line_daily_summary_enabled !== false) {
      const result = await sendDailySummary(org.id);
      await supabase.from("line_messages").insert({
        organisation_id: org.id,
        type: "daily_summary",
        recipient_line_id: result.lineUserId || org.line_user_id,
        message_content: result.messages ? { messages: result.messages } : {},
        status: result.sent ? "sent" : "failed",
        sent_at: result.sent ? new Date().toISOString() : null,
        error: result.sent ? null : result.reason || null
      });
      results.push({ org: org.name, channel: "line", success: result.sent, ...(result.sent ? {} : { error: result.reason }) });
    }

    const toTelegram = isTelegramConfigured() && settings.telegram_chat_id && wantsSummary(settings, "telegram");
    const toEmail = isEmailConfigured() && wantsSummary(settings, "email");
    if (!toTelegram && !toEmail) continue;
    const data = await fetchSummaryData(org.id).catch(() => null);
    if (!data) continue;
    const text = plainText(buildDailySummaryMessages(data));
    if (!text) continue;
    if (toTelegram) {
      const sent = await sendTelegram(settings.telegram_chat_id, `${text}${appUrl ? `\n\n${appUrl}` : ""}`);
      results.push({ org: org.name, channel: "telegram", success: sent.ok, error: sent.error });
    }
    if (toEmail) {
      const to = alertSettings(settings).email_to;
      const recipients: string[] = [];
      if (to) recipients.push(to);
      else {
        const { data: owners } = await supabase.from("organization_members").select("user_id").eq("organization_id", org.id).eq("role", "owner").eq("is_active", true);
        for (const owner of (owners || []) as Array<{ user_id: string | null }>) {
          if (!owner.user_id) continue;
          const { data: u } = await supabase.auth.admin.getUserById(owner.user_id);
          if (u?.user?.email) recipients.push(u.user.email);
        }
      }
      for (const recipient of recipients) {
        const sent = await sendEmail({ to: recipient, subject: `${org.name || "Lokalfleet"}: your morning summary`, text: `${text}${appUrl ? `\n\nOpen Lokalfleet: ${appUrl}` : ""}`, metadata: { kind: "daily_summary" } });
        results.push({ org: org.name, channel: "email", success: sent.status === "sent", error: sent.status === "failed" ? sent.error : undefined });
      }
    }
  }

  return NextResponse.json({ results });
}

// Vercel Cron calls with GET (see vercel.json); POST stays for manual runs.
export const GET = POST;
