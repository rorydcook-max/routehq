"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { ADMIN_STATUSES, PURGE_AFTER_DAYS, logAdminAction, requirePlatformAdmin } from "@/lib/admin";
import { endViewSession, SUPPORT_DISPLAY_NAME, VIEW_SESSION_HOURS, viewSessionsAvailable, type ViewSession } from "@/lib/admin-view";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/auth/active-organization";
import { getActiveMembership } from "@/lib/auth/active-organization-server";
import { sendEmail } from "@/lib/email";
import { parseCustomLimits, type CustomLimits } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** RouteHQ admin console actions. Each one checks the person is a platform admin, makes the change, and logs it. */

const TIERS = ["free", "starter", "pro", "business"] as const;
// Typed as never so the code after a `back(...)` knows it stopped there.
const back: (organizationId: string, notice: string) => never = (organizationId, notice) => redirect(`/platform/businesses/${organizationId}?done=${encodeURIComponent(notice)}` as Route);

async function current(organizationId: string) {
  const db = createSupabaseAdminClient() as any;
  const { data } = await db.from("organizations").select("*").eq("id", organizationId).maybeSingle();
  if (!data) throw new Error("Business not found");
  return { db, org: data as any };
}

/** Change plan, billing interval and status in one go. */
export async function adminSetPlan(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const tier = String(formData.get("tier") || "");
  const interval = String(formData.get("interval") || "monthly") === "yearly" ? "yearly" : "monthly";
  const status = String(formData.get("status") || "");
  if (!TIERS.includes(tier as never) || !ADMIN_STATUSES.includes(status as never)) back(organizationId, "error");
  const { db, org } = await current(organizationId);
  const update: Record<string, unknown> = { subscription_tier: tier, billing_interval: interval, subscription_status: status };
  // Turning a business to paying starts its first period now if it has none yet.
  if (status === "active" && !org.next_payment_due) {
    const next = new Date();
    next.setMonth(next.getMonth() + (interval === "yearly" ? 12 : 1));
    update.next_payment_due = next.toISOString();
    update.subscription_started_at = org.subscription_started_at || new Date().toISOString();
  }
  const { error } = await db.from("organizations").update(update).eq("id", organizationId);
  if (error) back(organizationId, "error");
  await logAdminAction(admin, {
    action: "plan_changed",
    organizationId,
    details: { from: { tier: org.subscription_tier, interval: org.billing_interval, status: org.subscription_status }, to: { tier, interval, status } }
  });
  revalidatePath("/platform", "layout");
  back(organizationId, "plan");
}

/** Move the trial end: a number of days from the later of now and the current end, or an exact date. */
export async function adminExtendTrial(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const days = Number(formData.get("days") || 0);
  const date = String(formData.get("date") || "");
  const { db, org } = await current(organizationId);
  let ends: Date;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    ends = new Date(`${date}T16:59:59Z`); // end of that day in Thailand
  } else if (days > 0 && days <= 365) {
    const from = Math.max(Date.now(), org.trial_ends_at ? Date.parse(org.trial_ends_at) : 0);
    ends = new Date(from + days * 86_400_000);
  } else {
    back(organizationId, "error");
    return;
  }
  // A trial that had run out comes back to life when extended.
  const update: Record<string, unknown> = { trial_ends_at: ends.toISOString() };
  if (["expired", "trial"].includes(org.subscription_status || "trial")) update.subscription_status = "trial";
  const { error } = await db.from("organizations").update(update).eq("id", organizationId);
  if (error) back(organizationId, "error");
  await logAdminAction(admin, { action: "trial_extended", organizationId, details: { from: org.trial_ends_at, to: ends.toISOString() } });
  revalidatePath("/platform", "layout");
  back(organizationId, "trial");
}

/* ------------------------------------------------------------------ People (Users page and business Team table) */

export type PersonActionState = { ok?: string; error?: string; link?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function appOrigin() {
  const fromEnv = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const list = await headers();
  const origin = list.get("origin");
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  const host = list.get("host");
  return host ? `${host.startsWith("localhost") ? "http" : "https"}://${host}` : "";
}

async function authUser(userId: string) {
  const db = createSupabaseAdminClient() as any;
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data?.user) return null;
  return { db, user: data.user as { id: string; email?: string | null } };
}

function refreshPeople(organizationId?: string | null) {
  revalidatePath("/platform/users");
  if (organizationId) revalidatePath(`/platform/businesses/${organizationId}`);
}

/**
 * A password reset link for one person (Supabase generateLink, type "recovery"). It is emailed to them when an
 * email service is set up; otherwise it is handed to the admin to pass on, with a clear warning. The admin never
 * sees or sets the password itself.
 */
export async function adminSendPasswordReset(_state: PersonActionState, formData: FormData): Promise<PersonActionState> {
  const admin = await requirePlatformAdmin();
  const userId = String(formData.get("userId") || "");
  const organizationId = String(formData.get("organizationId") || "") || null;
  const found = await authUser(userId);
  if (!found?.user.email) return { error: "Couldn't find that person's email address. Try again." };
  const email = found.user.email;
  const origin = await appOrigin();
  const { data, error } = await found.db.auth.admin.generateLink({
    type: "recovery",
    email,
    options: origin ? { redirectTo: `${origin}/auth/callback?next=/reset-password` } : undefined
  });
  const link = data?.properties?.action_link as string | undefined;
  if (error || !link) return { error: "Couldn't create a reset link. Try again." };

  const sent = await sendEmail({
    to: email,
    subject: "Reset your RouteHQ password",
    text: `Hello,\n\nRouteHQ support has sent you a link to choose a new password:\n\n${link}\n\nThe link works once and stops working after a short while. If you didn't ask for this, you can ignore this email: your password stays the same.\n\nRouteHQ`,
    metadata: { kind: "admin_password_reset" }
  });
  if (sent.status === "sent") {
    await logAdminAction(admin, { action: "password_reset_sent", organizationId, targetUserId: userId, details: { email } });
    refreshPeople(organizationId);
    return { ok: `Reset link emailed to ${email}.` };
  }
  await logAdminAction(admin, {
    action: "password_reset_link",
    organizationId,
    targetUserId: userId,
    details: { email, why: sent.status === "failed" ? `email failed: ${sent.error}` : "no email service set up" }
  });
  refreshPeople(organizationId);
  return {
    link,
    ok:
      sent.status === "failed"
        ? `The email to ${email} didn't send, so here is the link to pass on yourself.`
        : `No email service is set up yet, so nothing was emailed. Copy this link and send it to ${email} yourself.`
  };
}

/** Change someone's sign-in email. Typed twice; both the old and the new address get a notice when email is set up. */
export async function adminChangeEmail(_state: PersonActionState, formData: FormData): Promise<PersonActionState> {
  const admin = await requirePlatformAdmin();
  const userId = String(formData.get("userId") || "");
  const organizationId = String(formData.get("organizationId") || "") || null;
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const confirm = String(formData.get("confirmEmail") || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: "That doesn't look like an email address. Check it and try again." };
  if (email !== confirm) return { error: "The two email addresses don't match. Type the new address twice." };
  const found = await authUser(userId);
  if (!found) return { error: "Couldn't find that person. Try again." };
  const before = found.user.email || null;
  if (before && before.toLowerCase() === email) return { error: "That's already their email address." };

  const { data: taken } = await found.db.rpc("find_auth_user_id_by_email", { p_email: email });
  if (taken && taken !== userId) return { error: "Another account already uses that email address." };

  const { error } = await found.db.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) return { error: "Couldn't change the email address. Try again." };
  // Team lists show the invited address for people who haven't set a name: keep it in step.
  if (before) await found.db.from("organization_members").update({ invited_email: email }).eq("user_id", userId).eq("invited_email", before);

  const notice = (to: string) =>
    sendEmail({
      to,
      subject: "Your RouteHQ email address was changed",
      text: `Hello,\n\nRouteHQ support changed the email address you sign in with${before ? ` from ${before}` : ""} to ${email}.\n\nIf you didn't ask for this, reply to this email or contact RouteHQ support straight away.\n\nRouteHQ`,
      metadata: { kind: "admin_email_changed" }
    });
  const results = await Promise.all([notice(email), ...(before ? [notice(before)] : [])]);
  const emailed = results.every((result) => result.status === "sent");
  await logAdminAction(admin, { action: "email_changed", organizationId, targetUserId: userId, details: { from: before, to: email, notices: emailed ? "sent" : "not sent" } });
  refreshPeople(organizationId);
  return { ok: emailed ? `Email changed to ${email}. Both addresses were told.` : `Email changed to ${email}. No notice was emailed (no email service set up), so let them know yourself.` };
}

/** Take someone out of one business (their membership is switched off; their account stays). Never the last owner. */
export async function adminRemoveMember(_state: PersonActionState, formData: FormData): Promise<PersonActionState> {
  const admin = await requirePlatformAdmin();
  const userId = String(formData.get("userId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const db = createSupabaseAdminClient() as any;
  const { data: members } = await db.from("organization_members").select("id, user_id, role, is_active").eq("organization_id", organizationId).eq("is_active", true);
  const member = ((members || []) as any[]).find((row) => row.user_id === userId);
  if (!member) return { error: "They're not an active member of that business." };
  if (member.role === "owner" && ((members || []) as any[]).filter((row) => row.role === "owner").length <= 1) {
    return { error: "This is the business's only owner, so they can't be removed. Make someone else an owner first." };
  }
  const { error } = await db.from("organization_members").update({ is_active: false }).eq("id", member.id);
  if (error) return { error: "Couldn't remove them. Try again." };
  await logAdminAction(admin, { action: "member_removed", organizationId, targetUserId: userId, details: { role: member.role } });
  refreshPeople(organizationId);
  return { ok: "Removed from the business. Their account stays, and any other business they work for is unchanged." };
}

/* ------------------------------------------------------------------ Custom plan (organizations.custom_limits / custom_price, migration 0107) */

const missingColumn = (error: { message?: string; code?: string } | null) => Boolean(error && (error.code === "42703" || error.code === "PGRST204" || /custom_(limits|price)/.test(error.message || "")));

/** A whole number from the form, or undefined when left blank (= the plan's own value). */
function wholeNumber(value: FormDataEntryValue | null): number | undefined | "bad" {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const number = Number(text);
  return Number.isInteger(number) && number >= 0 && number <= 1_000_000 ? number : "bad";
}

/** Save a business's custom monthly price and limits. Blank fields keep the plan's own value. */
export async function adminSetCustomPlan(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const { db, org } = await current(organizationId);

  const limits: CustomLimits = {};
  for (const key of ["cars", "motorbikes", "team"] as const) {
    if (formData.get(`${key}Unlimited`) === "1") {
      limits[key] = null;
      continue;
    }
    const value = wholeNumber(formData.get(key));
    if (value === "bad") back(organizationId, "custom_error");
    if (typeof value === "number") limits[key] = value;
  }
  for (const key of ["docReads", "lookups"] as const) {
    const value = wholeNumber(formData.get(key));
    if (value === "bad") back(organizationId, "custom_error");
    if (typeof value === "number") limits[key] = value;
  }
  for (const key of ["customDomain", "prioritySupport"] as const) {
    const value = String(formData.get(key) || "");
    if (value === "yes") limits[key] = true;
    if (value === "no") limits[key] = false;
  }
  const priceText = String(formData.get("customPrice") || "").trim().replace(/,/g, "");
  const price = priceText ? Number(priceText) : null;
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 10_000_000)) back(organizationId, "custom_error");

  const customLimits = parseCustomLimits(limits);
  const { error } = await db.from("organizations").update({ custom_limits: customLimits, custom_price: price }).eq("id", organizationId);
  if (missingColumn(error)) back(organizationId, "custom_unavailable");
  if (error) back(organizationId, "custom_error");
  await logAdminAction(admin, {
    action: customLimits || price !== null ? "custom_plan_set" : "custom_plan_cleared",
    organizationId,
    details: { from: { limits: org.custom_limits ?? null, price: org.custom_price ?? null }, to: { limits: customLimits, price } }
  });
  revalidatePath("/platform", "layout");
  back(organizationId, customLimits || price !== null ? "custom" : "custom_cleared");
}

/** Back to the plan's own price and limits. */
export async function adminClearCustomPlan(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const { db, org } = await current(organizationId);
  const { error } = await db.from("organizations").update({ custom_limits: null, custom_price: null }).eq("id", organizationId);
  if (missingColumn(error)) back(organizationId, "custom_unavailable");
  if (error) back(organizationId, "custom_error");
  await logAdminAction(admin, { action: "custom_plan_cleared", organizationId, details: { was: { limits: org.custom_limits ?? null, price: org.custom_price ?? null } } });
  revalidatePath("/platform", "layout");
  back(organizationId, "custom_cleared");
}

/* ------------------------------------------------------------------ View as a business (admin_view_sessions, migration 0108) */

async function setActiveOrganizationCookie(organizationId: string | null) {
  const cookieStore = await cookies();
  if (!organizationId) {
    cookieStore.delete(ACTIVE_ORGANIZATION_COOKIE);
    return;
  }
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365
  });
}

/**
 * Start viewing a business as RouteHQ support: a short reason, a temporary manager membership named
 * "RouteHQ support", a session that ends after 2 hours, and the app switched to that business.
 */
export async function adminStartViewing(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const reason = String(formData.get("reason") || "").trim().slice(0, 500);
  if (reason.length < 3) back(organizationId, "view_reason");
  const { db, org } = await current(organizationId);
  if (org.deleted_at) back(organizationId, "view_deleted");
  if (!(await viewSessionsAvailable())) back(organizationId, "view_unavailable");

  const { data: existing } = await db.from("organization_members").select("id, role, display_name, is_active").eq("organization_id", organizationId).eq("user_id", admin.userId).maybeSingle();
  const isSupportRow = existing && existing.display_name === SUPPORT_DISPLAY_NAME && existing.role === "manager";
  if (existing?.is_active && !isSupportRow) back(organizationId, "view_member");

  // One business at a time: any other session of this admin ends first.
  const { data: open } = await db.from("admin_view_sessions").select("*").eq("admin_user_id", admin.userId).is("ended_at", null);
  for (const session of (open || []) as ViewSession[]) await endViewSession(session, "stopped", admin.email);

  // Where to come back to: the business they're in now (never the one about to be viewed).
  const serverClient = (await createSupabaseServerClient()) as any;
  const { data: here } = await getActiveMembership(serverClient, admin.userId);
  const returnOrganizationId = here?.organization_id && here.organization_id !== organizationId ? here.organization_id : null;

  const { data: again } = await db.from("organization_members").select("id, role, display_name, is_active").eq("organization_id", organizationId).eq("user_id", admin.userId).maybeSingle();
  const previous = again && !(again.display_name === SUPPORT_DISPLAY_NAME && again.role === "manager") ? { role: again.role, display_name: again.display_name, is_active: again.is_active } : null;
  const membership = { role: "manager", display_name: SUPPORT_DISPLAY_NAME, is_active: true };
  const { error: memberError } = again
    ? await db.from("organization_members").update(membership).eq("id", again.id)
    : await db.from("organization_members").insert({ organization_id: organizationId, user_id: admin.userId, ...membership });
  if (memberError) back(organizationId, "view_error");

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + VIEW_SESSION_HOURS * 3_600_000);
  const { data: session, error: sessionError } = await db
    .from("admin_view_sessions")
    .insert({
      admin_user_id: admin.userId,
      organization_id: organizationId,
      reason,
      started_at: startedAt.toISOString(),
      ends_at: endsAt.toISOString(),
      return_organization_id: returnOrganizationId,
      previous_membership: previous
    })
    .select("id")
    .single();
  if (sessionError || !session) {
    // Put the membership back as it was: no session, no access.
    if (previous) await db.from("organization_members").update(previous).eq("organization_id", organizationId).eq("user_id", admin.userId);
    else await db.from("organization_members").delete().eq("organization_id", organizationId).eq("user_id", admin.userId).eq("display_name", SUPPORT_DISPLAY_NAME);
    back(organizationId, "view_error");
  }

  await logAdminAction(admin, { action: "view_started", organizationId, details: { reason, session_id: session.id, ends_at: endsAt.toISOString() } });
  await setActiveOrganizationCookie(organizationId);
  revalidatePath("/", "layout");
  redirect("/");
}

/** Stop viewing: the session ends, the support membership goes, and the admin is back in their own business. */
export async function adminStopViewing() {
  const admin = await requirePlatformAdmin();
  const db = createSupabaseAdminClient() as any;
  const { data: open } = await db.from("admin_view_sessions").select("*").eq("admin_user_id", admin.userId).is("ended_at", null).order("started_at", { ascending: false });
  const sessions = (open || []) as ViewSession[];
  for (const session of sessions) await endViewSession(session, "stopped", admin.email);

  // Back to the business they came from, if they still belong to it; otherwise their earliest business.
  const wanted = sessions[0]?.return_organization_id || null;
  let returnTo: string | null = null;
  if (wanted) {
    const { data: still } = await db.from("organization_members").select("organization_id").eq("organization_id", wanted).eq("user_id", admin.userId).eq("is_active", true).maybeSingle();
    returnTo = still?.organization_id || null;
  }
  await setActiveOrganizationCookie(returnTo);
  revalidatePath("/", "layout");
  redirect((sessions[0] ? `/platform/businesses/${sessions[0].organization_id}?done=view_stopped` : "/platform") as Route);
}

/* ------------------------------------------------------------------ Delete business (soft delete, restore, purge) */

const sameName = (typed: string, name: string) => typed.trim().toLowerCase() === String(name || "").trim().toLowerCase() && typed.trim() !== "";

/** Close a business: organizations.deleted_at = now. Its team can't use it and its booking pages go offline. Undoable. */
export async function adminDeleteBusiness(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const { db, org } = await current(organizationId);
  if (org.deleted_at) back(organizationId, "deleted");
  if (!sameName(String(formData.get("confirmName") || ""), org.name)) back(organizationId, "delete_name");
  // A business that has paid for time it hasn't used yet needs a second, deliberate tick.
  const paidUp = org.subscription_status === "active" && org.next_payment_due && Date.parse(org.next_payment_due) > Date.now();
  if (paidUp && formData.get("confirmPaid") !== "1") back(organizationId, "delete_paid");

  const { error } = await db.from("organizations").update({ deleted_at: new Date().toISOString() }).eq("id", organizationId).is("deleted_at", null);
  if (error) back(organizationId, "error");
  // Anyone from RouteHQ viewing it loses access now.
  const { data: open } = await db.from("admin_view_sessions").select("*").eq("organization_id", organizationId).is("ended_at", null);
  for (const session of (open || []) as ViewSession[]) await endViewSession(session, "stopped", admin.email);
  await logAdminAction(admin, { action: "business_deleted", organizationId, details: { name: org.name, paid_until: paidUp ? org.next_payment_due : null } });
  revalidatePath("/platform", "layout");
  revalidatePath(`/rent/${org.slug}`);
  back(organizationId, "deleted");
}

/** Bring a closed business back exactly as it was. */
export async function adminRestoreBusiness(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const { db, org } = await current(organizationId);
  if (!org.deleted_at) back(organizationId, "restored");
  const { error } = await db.from("organizations").update({ deleted_at: null }).eq("id", organizationId);
  // Most likely its booking address was taken by another business while it was closed.
  if (error) back(organizationId, error.code === "23505" ? "restore_taken" : "error");
  await logAdminAction(admin, { action: "business_restored", organizationId, details: { name: org.name, closed_at: org.deleted_at } });
  revalidatePath("/platform", "layout");
  revalidatePath(`/rent/${org.slug}`);
  back(organizationId, "restored");
}

/**
 * Delete a business for good, 30 days or more after it was closed. Its data goes (admin_purge_organization,
 * migration 0108); people's sign-in accounts stay, so anyone who works for another business is untouched.
 */
export async function adminPurgeBusiness(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") || "");
  const { db, org } = await current(organizationId);
  if (!org.deleted_at || Date.parse(org.deleted_at) > Date.now() - PURGE_AFTER_DAYS * 86_400_000) back(organizationId, "purge_early");
  if (!sameName(String(formData.get("confirmName") || ""), org.name)) back(organizationId, "delete_name");
  const { error } = await db.rpc("admin_purge_organization", { p_organization_id: organizationId });
  if (error) {
    console.error("admin_purge_organization failed", error.message);
    back(organizationId, error.code === "PGRST202" || /admin_purge_organization/.test(error.message || "") ? "purge_unavailable" : "purge_failed");
  }
  // The business row is gone, so the log line keeps its id and name in the details.
  await logAdminAction(admin, { action: "business_purged", organizationId: null, details: { organization_id: organizationId, name: org.name, closed_at: org.deleted_at } });
  revalidatePath("/platform", "layout");
  redirect("/platform/businesses" as Route);
}
