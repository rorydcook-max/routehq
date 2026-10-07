import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Only allow redirects to a path on this site. Without this, a crafted link
 * such as /auth/callback?next=https://evil.example would send someone from
 * RouteHQ's domain straight to an attacker's page. Protocol-relative paths
 * ("//evil.example") and backslash tricks are rejected for the same reason.
 */
function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  } else {
    // No code: the link's result (a sign-in, or "this link has expired") is after the "#", which only the
    // browser can read. The browser keeps that part when it follows this redirect.
    const landing = new URL("/auth/landing", url.origin);
    landing.searchParams.set("next", next);
    return NextResponse.redirect(landing);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
