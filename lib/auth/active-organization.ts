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

/** Returns the same { data, error } shape as a Supabase single-row query. */
export async function loadActiveMembership(supabase: any, userId: string, preferredOrganizationId?: string | null) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role, is_active, created_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) return { data: null as ActiveMembership | null, error };
  return { data: pickActiveMembership((data || []) as ActiveMembership[], preferredOrganizationId), error: null };
}
