/**
 * Which business is this person working in right now?
 *
 * One person can belong to several businesses (for example a driver who works
 * for two rental companies). The business they are currently working in is
 * remembered per browser in a cookie, but the cookie is only ever a
 * preference: it is honoured only if it names a business they are an active
 * member of right now. Otherwise - no cookie, a stale one, or one they have
 * since been removed from - they get their earliest business.
 *
 * This file has no server-only imports so the middleware can use it too.
 */

export const ACTIVE_ORGANIZATION_COOKIE = "rhq_active_org";

export type ActiveMembership = {
  organization_id: string;
  role: string;
  is_active: boolean;
  created_at?: string;
};

export function pickActiveMembership(memberships: ActiveMembership[], preferredOrganizationId?: string | null) {
  const active = memberships.filter((membership) => membership.is_active && membership.organization_id);
  if (!active.length) return null;
  if (preferredOrganizationId) {
    const preferred = active.find((membership) => membership.organization_id === preferredOrganizationId);
    if (preferred) return preferred;
  }
  return [...active].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")))[0];
}

/**
 * The name on the temporary membership a RoveHQ admin gets while viewing a business ("View as this business"
 * in the admin console). Such a membership only counts while its admin_view_sessions row is live.
 */
export const SUPPORT_DISPLAY_NAME = "RoveHQ support";

type MembershipRow = ActiveMembership & { display_name?: string | null; organizations?: { deleted_at?: string | null } | null };

const isSupportMembership = (row: MembershipRow) => row.display_name === SUPPORT_DISPLAY_NAME && row.role === "manager";

/**
 * Returns the same { data, error } shape as a Supabase single-row query, plus `closed`: true when the person's
 * only businesses have been closed (soft-deleted by RoveHQ), so the app can say so instead of offering setup.
 *
 * Two kinds of membership never count: one in a closed business, and a RoveHQ support membership whose viewing
 * session has ended or run out (checked here, on every request, so an expired session can't keep access).
 */
export async function loadActiveMembership(supabase: any, userId: string, preferredOrganizationId?: string | null) {
  let { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, is_active, created_at, display_name, organizations(deleted_at)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    // Older schema or a join problem: fall back to the plain list rather than lock everyone out.
    ({ data, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, is_active, created_at, display_name")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true }));
  }
  if (error) return { data: null as ActiveMembership | null, error, closed: false };

  const rows = (data || []) as MembershipRow[];
  const open = rows.filter((row) => !row.organizations?.deleted_at);

  let usable = open;
  if (open.some(isSupportMembership)) {
    const { data: sessions, error: sessionError } = await supabase
      .from("admin_view_sessions")
      .select("organization_id")
      .eq("admin_user_id", userId)
      .is("ended_at", null)
      .gt("ends_at", new Date().toISOString());
    const live = new Set(sessionError ? [] : ((sessions || []) as Array<{ organization_id: string }>).map((row) => row.organization_id));
    usable = open.filter((row) => !isSupportMembership(row) || live.has(row.organization_id));
  }

  const closed = rows.length > 0 && open.length === 0;
  return { data: pickActiveMembership(usable.map(({ organizations: _org, display_name: _name, ...rest }) => rest), preferredOrganizationId), error: null, closed };
}
