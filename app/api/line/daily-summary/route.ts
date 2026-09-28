import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendDailySummary } from "@/lib/line/daily-summary";

export const runtime = "nodejs";

/**
 * Morning LINE summary for every business that has connected LINE and left
 * the daily summary on. Runs once a day from Vercel Cron (08:00 Bangkok).
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
    .select("id, name, line_user_id, line_notifications_enabled, line_daily_summary_enabled")
    .not("line_user_id", "is", null)
    .is("deleted_at", null);

  if (orgsError) {
    return NextResponse.json({ error: orgsError.message }, { status: 500 });
  }

  const results: Array<{ org: string; success: boolean; error?: string }> = [];

  for (const org of orgs ?? []) {
    if (org.line_notifications_enabled === false || org.line_daily_summary_enabled === false) {
      results.push({ org: org.name, success: false, error: "Daily summary turned off" });
      continue;
    }

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

    results.push({ org: org.name, success: result.sent, ...(result.sent ? {} : { error: result.reason }) });
  }

  return NextResponse.json({ results });
}

// Vercel Cron calls with GET (see vercel.json); POST stays for manual runs.
export const GET = POST;
