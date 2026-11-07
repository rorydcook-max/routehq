import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildDailySummaryMessages, fetchSummaryData, sendDailySummary } from "@/lib/line/daily-summary";
import { alertSettings, wantsSummary } from "@/lib/alerts";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { sendPushToOrganization } from "@/lib/push";
import { lineSummaryText as plainText, morningSummaryEmail } from "@/lib/email/templates";
import { emailWords } from "@/lib/email/words";
import { operatorAlertText } from "@/lib/operator-alert-text";
import { runDailyJob, supabaseRunStore } from "@/lib/scheduled-runs";

export const runtime = "nodejs";

type Result = { org: string; channel: string; success: boolean; error?: string };

/**
 * The morning summary at 08:00 on each business's own clock (lib/scheduled-runs.ts): Vercel Cron calls this every
 * hour, and each call sends it only to the businesses whose local time is 08:00 (or a missed hour shortly after),
 * once a day each. On LINE for businesses that connected it and left it on, and by push / email where
 * Settings › Notifications says so.
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
    .select("id, name, timezone, country_code, line_user_id, line_notifications_enabled, line_daily_summary_enabled, settings")
    .is("deleted_at", null);

  if (orgsError) {
    return NextResponse.json({ error: orgsError.message }, { status: 500 });
  }

  const results: Result[] = [];
  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  const run = await runDailyJob({
    job: "morning_summary",
    orgs: (orgs ?? []) as any[],
    store: supabaseRunStore(supabase),
    work: async ({ orgs: due }) => {
      for (const org of due) {
        await sendMorningSummary(supabase, org, appUrl, results).catch((error: unknown) => {
          results.push({ org: org.name, channel: "all", success: false, error: error instanceof Error ? error.message : String(error) });
        });
      }
    }
  });

  return NextResponse.json({ ran: run.ran, alreadyDone: run.alreadyDone, guard: run.guard, results });
}

async function sendMorningSummary(supabase: any, org: any, appUrl: string, results: Result[]) {
  const settings = org.settings || {};
  // LINE carries only the morning summary now (7 Nov 2026), so its own switch decides; the old "pause all LINE"
  // switch is gone from Settings and no longer stops it.
  if (org.line_user_id && org.line_daily_summary_enabled !== false) {
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

  // Push and email (Settings › Notifications). Telegram no longer gets the summary (Rory, 7 Nov 2026).
  const toPush = wantsSummary(settings, "push");
  const toEmail = isEmailConfigured() && wantsSummary(settings, "email");
  if (!toPush && !toEmail) return;
  const data = await fetchSummaryData(org.id).catch(() => null);
  if (!data) return;
  const messages = buildDailySummaryMessages(data);
  const text = plainText(messages);
  if (!text) return;
  if (toPush) {
    // A short version on the lock screen (its first few lines); tapping it opens the dashboard.
    const alertText = await operatorAlertText(data.locale);
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const delivered = await sendPushToOrganization(supabase, org.id, {
      title: alertText.say("summarySubject", { business: data.orgName || org.name || "RoveHQ" }),
      body: lines.slice(1, 5).join(" · ") || lines[0] || "",
      url: "/",
      tag: "morning-summary"
    }).catch(() => 0);
    if (delivered) results.push({ org: org.name, channel: "push", success: true });
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
    // In the summary's own language (the owner's, English or Thai): subject, button and footer match it.
    const [words, alertText] = await Promise.all([emailWords(data.locale), operatorAlertText(data.locale)]);
    const subject = alertText.say("summarySubject", { business: data.orgName || org.name || "RoveHQ" });
    const email = morningSummaryEmail({ orgName: org.name, messages: messages as any[], appUrl, words, subject });
    for (const recipient of email ? recipients : []) {
      const sent = await sendEmail({ to: recipient, ...email!, metadata: { kind: "daily_summary" } });
      results.push({ org: org.name, channel: "email", success: sent.status === "sent", error: sent.status === "failed" ? sent.error : undefined });
    }
  }
}

// Vercel Cron calls with GET (see vercel.json); POST stays for manual runs (which follow the same schedule).
export const GET = POST;
