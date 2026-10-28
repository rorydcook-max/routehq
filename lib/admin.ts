import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/support";

/**
 * RouteHQ admin console: helpers for platform admins only (table platform_admins).
 * The console is RouteHQ's internal tool, so its words are English only and live in the code, not the locale files.
 */

export type AdminUser = { userId: string; email: string | null };

/** Every admin page and action starts here. Anyone else gets a plain 404, never a hint the page exists. */
export async function requirePlatformAdmin(): Promise<AdminUser> {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || !(await isPlatformAdmin(supabase, user.id))) notFound();
  return { userId: user.id, email: user.email ?? null };
}

/** Whether the person signed in is a platform admin (for showing the menu item). Never throws. */
export async function viewerIsPlatformAdmin(): Promise<boolean> {
  try {
    const supabase = (await createSupabaseServerClient()) as any;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    return !!user && (await isPlatformAdmin(supabase, user.id));
  } catch {
    return false;
  }
}

/** Written for every admin change. Best effort: a failed log line never blocks the change itself, but is reported in the server log. */
export async function logAdminAction(
  admin: AdminUser,
  entry: { action: string; organizationId?: string | null; targetUserId?: string | null; details?: Record<string, unknown> }
) {
  const db = createSupabaseAdminClient() as any;
  const { error } = await db.from("admin_audit_log").insert({
    actor_user_id: admin.userId,
    action: entry.action,
    organization_id: entry.organizationId ?? null,
    target_user_id: entry.targetUserId ?? null,
    details: { ...(entry.details || {}), by: admin.email }
  });
  if (error) console.error("admin_audit_log insert failed", error.message);
}

export type AdminAuthUser = { id: string; email: string | null; lastSignIn: string | null; createdAt: string | null };

/** Every sign-in account (email, last sign-in). Paged through the auth admin API; fine into the low thousands. */
export async function listAuthUsers(): Promise<Map<string, AdminAuthUser>> {
  const db = createSupabaseAdminClient() as any;
  const users = new Map<string, AdminAuthUser>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) users.set(u.id, { id: u.id, email: u.email ?? null, lastSignIn: u.last_sign_in_at ?? null, createdAt: u.created_at ?? null });
    if (data.users.length < 1000) break;
  }
  return users;
}

export type AdminBusiness = {
  id: string;
  name: string;
  country: string | null;
  currency: string | null;
  tier: string;
  status: string;
  interval: string;
  trialEndsAt: string | null;
  nextPaymentDue: string | null;
  createdAt: string | null;
  deletedAt: string | null;
  pendingPlan: string | null;
  customPrice: number | null;
  customLimits: Record<string, unknown> | null;
  vehicles: number;
  owners: Array<{ userId: string; email: string | null }>;
  members: number;
  lastActive: string | null;
};

/** All businesses with what the admin list needs: plan, status, size, owner, last sign-in of anyone in it. */
export async function listBusinesses(): Promise<AdminBusiness[]> {
  const db = createSupabaseAdminClient() as any;
  const [{ data: orgs }, { data: vehicles }, { data: members }, authUsers] = await Promise.all([
    db.from("organizations").select("*").order("created_at", { ascending: false }),
    db.from("vehicles").select("organization_id").is("deleted_at", null),
    db.from("organization_members").select("organization_id, user_id, role, is_active"),
    listAuthUsers()
  ]);
  const vehicleCount = new Map<string, number>();
  for (const v of (vehicles || []) as any[]) vehicleCount.set(v.organization_id, (vehicleCount.get(v.organization_id) || 0) + 1);
  return ((orgs || []) as any[]).map((org) => {
    const people = ((members || []) as any[]).filter((m) => m.organization_id === org.id && m.is_active);
    const lastActive = people.map((m) => authUsers.get(m.user_id)?.lastSignIn || "").filter(Boolean).sort().pop() || null;
    return {
      id: org.id,
      name: org.name || "Unnamed business",
      country: org.country_code ?? null,
      currency: org.currency ?? null,
      tier: org.subscription_tier || "free",
      status: org.subscription_status || "trial",
      interval: org.billing_interval || "monthly",
      trialEndsAt: org.trial_ends_at ?? null,
      nextPaymentDue: org.next_payment_due ?? null,
      createdAt: org.created_at ?? null,
      deletedAt: org.deleted_at ?? null,
      pendingPlan: org.pending_plan ?? null,
      customPrice: org.custom_price ?? null,
      customLimits: org.custom_limits ?? null,
      vehicles: vehicleCount.get(org.id) || 0,
      owners: people.filter((m) => m.role === "owner").map((m) => ({ userId: m.user_id, email: authUsers.get(m.user_id)?.email ?? null })),
      members: people.length,
      lastActive
    };
  });
}

export const ADMIN_STATUSES = ["trial", "active", "past_due", "expired", "cancelled"] as const;
export const ADMIN_STATUS_LABEL: Record<string, string> = { trial: "Free trial", active: "Paying", past_due: "Payment late", expired: "Trial ended", cancelled: "Cancelled" };
export const ADMIN_TIER_LABEL: Record<string, string> = { free: "Free", starter: "Starter", pro: "Pro", growth: "Pro", business: "Business" };

export const ACTION_LABEL: Record<string, string> = {
  plan_changed: "Plan changed",
  trial_extended: "Trial extended",
  // Kept so old log rows still read: the founding offer was dropped on 28 Oct 2026.
  founding_on: "Founding price turned on",
  founding_off: "Founding price turned off",
  plan_activated: "Plan request activated",
  password_reset_sent: "Password reset emailed",
  password_reset_link: "Password reset link given to admin",
  email_changed: "Email address changed",
  member_removed: "Removed from business",
  custom_plan_set: "Custom plan saved",
  custom_plan_cleared: "Custom plan cleared",
  view_started: "RouteHQ support started viewing",
  view_ended: "RouteHQ support stopped viewing",
  view_expired: "RouteHQ support access ran out",
  business_deleted: "Business closed",
  business_restored: "Business restored",
  business_purged: "Business deleted permanently"
};

/** Days a closed (soft-deleted) business waits before it can be deleted for good. */
export const PURGE_AFTER_DAYS = 30;

export function adminDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Asia/Bangkok" }).format(new Date(iso));
}

export function daysFromNow(iso: string | null | undefined) {
  if (!iso) return null;
  return Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
}
