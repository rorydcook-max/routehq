import { NextResponse, type NextRequest } from "next/server";
import { readEmailCheckToken } from "@/lib/email-check";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where the "Verify your email" link lands (after /auth/callback has signed them in). The token in the link was signed for
 * this person, so opening it proves the address is theirs: the step on the Get ready list ticks off.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userId = readEmailCheckToken(url.searchParams.get("t") || "");
  if (!userId) return NextResponse.redirect(new URL("/?notice=email-link-old", url.origin));

  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.auth.admin.getUserById(userId);
  const appMetadata = data?.user?.app_metadata || {};
  await admin.auth.admin.updateUserById(userId, { app_metadata: { ...appMetadata, email_check: "done", email_checked_at: new Date().toISOString() } });
  // A fresh sign-in token carries the change, so the tick shows straight away rather than within the hour.
  const supabase = await createSupabaseServerClient();
  await supabase.auth.refreshSession().catch(() => null);
  return NextResponse.redirect(new URL("/?notice=email-verified", url.origin));
}
