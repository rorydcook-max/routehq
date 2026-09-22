import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * RouteHQ has two roles for now:
 *
 *   owner    - full control, including business settings, billing and the team
 *   teammate - day-to-day work (bookings, fleet, customers, inspections,
 *              payments) but no account-altering settings
 *
 * They map onto the existing organization_role enum as "owner" and "operator".
 * The enum's other values (manager, accountant, driver) are left in place for
 * later and are treated as teammates until they are given their own meaning.
 *
 * The database already enforces the core rule: only owners may update the
 * organizations row or manage organization_members (RLS). These helpers make
 * the app check the role itself, because a blocked RLS update fails silently
 * by affecting zero rows - a teammate would otherwise see "saved" and nothing
 * would change.
 */

import { appRoleFromDb, OWNER_ONLY_MESSAGE } from "@/lib/auth/role-types";

export { APP_ROLES, appRoleFromDb, dbRoleFromApp, OWNER_ONLY_MESSAGE } from "@/lib/auth/role-types";
export type { AppRole } from "@/lib/auth/role-types";

export async function getCurrentMembership() {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) return null;

  return {
    userId: user.id as string,
    email: (user.email || null) as string | null,
    organizationId: membership.organization_id as string,
    role: appRoleFromDb(membership.role)
  };
}

/** For server actions that change the business. Redirects if signed out; throws a clear message for teammates. */
export async function requireOwner() {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (membership.role !== "owner") throw new Error(OWNER_ONLY_MESSAGE);
  return membership;
}
