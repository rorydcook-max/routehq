import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUPPORT_DISPLAY_NAME } from "@/lib/auth/active-organization";

/**
 * "View as this business" (admin console, migration 0108). A platform admin gets a temporary membership in the
 * business (role manager, display name "RoveHQ support") and an admin_view_sessions row saying why and until
 * when. lib/auth/active-organization.ts ignores the membership once the session has ended or run out, on every
 * request; the helpers here tidy up afterwards (membership removed, session closed, admin log written).
 */

export const VIEW_SESSION_HOURS = 2;
export { SUPPORT_DISPLAY_NAME };

export type ViewSession = {
  id: string;
  admin_user_id: string;
  organization_id: string;
  reason?: string | null;
  started_at?: string | null;
  ends_at: string;
  ended_at?: string | null;
  return_organization_id?: string | null;
  previous_membership?: { role?: string; display_name?: string | null; is_active?: boolean } | null;
};

/** Whether migration 0108 is applied (the sessions table exists). */
export async function viewSessionsAvailable(): Promise<boolean> {
  try {
    const db = createSupabaseAdminClient() as any;
    const { error } = await db.from("admin_view_sessions").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * End one session: close it (only once, even if two requests race), then take the support membership away, or
 * put back the admin's own earlier membership of that business if they had one, and log it.
 */
export async function endViewSession(session: ViewSession, how: "stopped" | "expired", actorEmail: string | null = null) {
  const db = createSupabaseAdminClient() as any;
  const { data: closed } = await db
    .from("admin_view_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", session.id)
    .is("ended_at", null)
    .select("id");
  if (!closed?.length) return false;

  const previous = session.previous_membership;
  if (previous && previous.role) {
    await db
      .from("organization_members")
      .update({ role: previous.role, display_name: previous.display_name ?? null, is_active: Boolean(previous.is_active) })
      .eq("organization_id", session.organization_id)
      .eq("user_id", session.admin_user_id);
  } else {
    await db
      .from("organization_members")
      .delete()
      .eq("organization_id", session.organization_id)
      .eq("user_id", session.admin_user_id)
      .eq("display_name", SUPPORT_DISPLAY_NAME);
  }

  const { error } = await db.from("admin_audit_log").insert({
    actor_user_id: session.admin_user_id,
    action: how === "expired" ? "view_expired" : "view_ended",
    organization_id: session.organization_id,
    target_user_id: null,
    details: { session_id: session.id, started_at: session.started_at ?? null, ends_at: session.ends_at, by: how === "expired" ? "automatic (2 hours)" : actorEmail }
  });
  if (error) console.error("admin_audit_log insert failed", error.message);
  return true;
}

/** Close every session in the list that has run out. Never throws: it runs while pages load. */
export async function endExpiredViewSessions(sessions: ViewSession[]) {
  const now = Date.now();
  for (const session of sessions) {
    if (session.ended_at || Date.parse(session.ends_at) > now) continue;
    try {
      await endViewSession(session, "expired");
    } catch (error) {
      console.error("ending an expired view session failed", error);
    }
  }
}

/** "14:30", in Thailand time (where RoveHQ's businesses are). */
export function viewTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso));
}
