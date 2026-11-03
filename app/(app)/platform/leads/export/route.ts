import { NextResponse, type NextRequest } from "next/server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { isPlatformAdmin } from "@/lib/support";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The website's leads (free-resource downloads) as a spreadsheet, newest first. RoveHQ team only. */
export async function GET(request: NextRequest) {
  const membership = await getCurrentMembership();
  const supabase = (await createSupabaseServerClient()) as any;
  let userId = membership?.userId || null;
  if (!userId) userId = (await supabase.auth.getUser()).data?.user?.id || null;
  if (!(await isPlatformAdmin(supabase, userId))) return new NextResponse("Not found", { status: 404 });

  const resource = String(request.nextUrl.searchParams.get("resource") || "");
  const db = createSupabaseAdminClient() as any;
  let query = db.from("leads").select("created_at, email, name, business, country, fleet, resource, locale, consent, source_path").order("created_at", { ascending: false }).limit(20000);
  if (/^[a-z0-9-]{1,80}$/.test(resource)) query = query.eq("resource", resource);
  const { data } = await query;

  const header = ["created_at", "email", "name", "business", "country", "fleet", "resource", "language", "tips_consent", "page"];
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    // Quoted, and a leading = + - @ neutralised so a spreadsheet never runs it as a formula.
    const risky = /^[=+\-@]/.test(text);
    return `"${(risky ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  const lines = [header.join(",")];
  for (const row of (data || []) as any[]) {
    lines.push([row.created_at, row.email, row.name, row.business, row.country, row.fleet, row.resource, row.locale, row.consent ? "yes" : "no", row.source_path].map(cell).join(","));
  }
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="routehq-leads${resource ? `-${resource}` : ""}-${today}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
