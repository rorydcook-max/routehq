"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dbRoleFromApp, getCurrentMembership, OWNER_ONLY_MESSAGE, requireOwner, type AppRole } from "@/lib/auth/roles";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/auth/active-organization";

export type AuthActionState = {
  error?: string;
  success?: string;
};

const supportedLocales = new Set<string>(supportedLocaleCodes);

/** Messages shown on the sign-in pages, in the reader's language. Raw sign-in service errors are never shown: they are English and technical. */
async function authText() {
  return (await getTranslations("auth")) as unknown as (key: string, values?: Record<string, string>) => string;
}

function localeFromForm(formData: FormData) {
  const preferredLocale = String(formData.get("preferredLocale") || "en");
  return supportedLocales.has(preferredLocale) ? preferredLocale : "en";
}

export async function signInWithEmail(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const say = await authText();
    return { error: /confirm/i.test(error.message) ? say("confirmFirst") : say("signInFailed") };
  }

  redirect("/");
}

export async function requestPasswordReset(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") || "").trim();
  const origin = String(formData.get("origin") || "");

  const say = await authText();
  if (!email) {
    return { error: say("needEmail") };
  }

  const supabase = await createSupabaseServerClient();
  const redirectTo = origin ? `${origin}/auth/callback?next=/reset-password` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return { success: say("resetSent") };
  }

  return { success: say("resetSent") };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type ShellContext = {
  role: AppRole | null;
  organizations: { id: string; name: string; active: boolean }[];
  /** Customer chats with unread messages, plus messages waiting to be sent by hand: the badge on Inbox. */
  unreadChats: number;
  /** Payments and jobs due today or overdue, shown as a badge on To do. */
  dueTasks: number;
};

/** Used by the app shell for navigation and the business switcher. Display only - access is enforced on the server. */
export async function getShellContext(): Promise<ShellContext> {
  const membership = await getCurrentMembership();
  if (!membership) return { role: null, organizations: [], unreadChats: 0, dueTasks: 0 };

  const supabase = (await createSupabaseServerClient()) as any;
  // Only what needs doing now counts: later jobs would make the badge permanent noise.
  const countDueTasks = async () => {
    try {
      const { getTaskList } = await import("@/lib/tasks");
      const { businessToday } = await import("@/lib/business-time");
      const today = businessToday();
      return (await getTaskList(membership.organizationId)).filter((task) => !task.completedAt && !task.coveredBy && !!task.dueDate && task.dueDate <= today).length;
    } catch {
      return 0;
    }
  };
  // The lookups do not depend on each other, so they run together.
  const [{ data }, { count }, dueTasks, { count: toSend }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("organization_id, organizations(name)")
      .eq("user_id", membership.userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", membership.organizationId)
      .eq("status", "open")
      .gt("unread_count", 0),
    countDueTasks(),
    // Messages the app wrote for customers with no chat open: they wait in the inbox for the owner to send.
    supabase
      .from("communication_log")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", membership.organizationId)
      .eq("type", "automated_reminder")
      .in("status", ["pending", "failed"])
      .not("metadata->handoff_label", "is", null)
      .or("metadata->>superseded.is.null,metadata->>superseded.eq.false")
      .gte("created_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
  ]);

  const organizations = ((data || []) as any[]).map((row) => ({
    id: row.organization_id as string,
    name: String(row.organizations?.name || "Business"),
    active: row.organization_id === membership.organizationId
  }));
  return { role: membership.role, organizations, unreadChats: (count || 0) + (toSend || 0), dueTasks };
}

/** Switch the business this person is working in. Only businesses they actively belong to are accepted. */
export async function switchActiveOrganization(formData: FormData) {
  const organizationId = String(formData.get("organizationId") || "");
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();

  if (membership?.organization_id) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, membership.organization_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  revalidatePath("/", "layout");
  redirect("/");
}

async function requestOrigin() {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  return String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "") || undefined;
}

export async function signUpWithEmail(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const businessName = String(formData.get("businessName") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  const say = await authText();
  if (businessName.length < 2 || businessName.length > 120) {
    return { error: say("needBusiness") };
  }
  if (!fullName) {
    return { error: say("needName") };
  }
  if (!email) {
    return { error: say("needEmail") };
  }
  if (password.length < 8) {
    return { error: say("passwordShort") };
  }

  const origin = await requestOrigin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: origin ? `${origin}/auth/callback?next=/onboarding` : undefined,
      data: { full_name: fullName, business_name: businessName }
    }
  });

  if (error) {
    return { error: /password/i.test(error.message) ? say("passwordShort") : say("signUpFailed") };
  }

  // If email confirmation is switched off in Supabase, a session comes back
  // straight away and the user can go directly to setting up their business.
  if (data.session) {
    redirect("/onboarding");
  }

  // Same message whether or not the email was already registered, so the form
  // cannot be used to find out who has an account.
  return { success: say("signUpSent") };
}

export async function createMyOrganization(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const businessName = String(formData.get("businessName") || "").trim();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = String(user.user_metadata?.full_name || "").trim() || null;
  const { error } = await (supabase as any).rpc("create_my_organization", {
    p_name: businessName,
    p_full_name: fullName
  });

  if (error) {
    return { error: (await authText())("orgFailed") };
  }

  redirect("/onboarding");
}

export async function inviteUser(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const preferredLocale = localeFromForm(formData);
  const role: AppRole = formData.get("role") === "owner" ? "owner" : "teammate";

  const say = await authText();
  if (!email) {
    return { error: say("iv_needEmail") };
  }

  // Only owners manage the team, and invitees always join the inviter's own
  // business - never a fixed default organisation.
  let inviter;
  try {
    inviter = await requireOwner();
  } catch (error) {
    return { error: error instanceof Error ? error.message : OWNER_ONLY_MESSAGE };
  }

  if (inviter.email && inviter.email.toLowerCase() === email) {
    return { error: say("iv_alreadyYou") };
  }

  const admin = createSupabaseAdminClient() as any;
  const label = say(role === "owner" ? "iv_roleOwner" : "iv_roleTeammate");

  // Someone who already has a RouteHQ account - perhaps working for another
  // business too - is added directly. There is no invite email to send them:
  // they switch to this business from the business menu after signing in.
  const { data: existingUserId, error: lookupError } = await admin.rpc("find_auth_user_id_by_email", { p_email: email });
  if (lookupError) {
    return { error: lookupError.message };
  }

  // Invited before but never finished setting up: the first link ran out or was lost, so send a fresh one.
  let unfinished = false;
  if (existingUserId) {
    const { data: found } = await admin.auth.admin.getUserById(existingUserId);
    unfinished = Boolean(found?.user?.invited_at && !found.user.email_confirmed_at);
  }

  if (existingUserId && !unfinished) {
    const { data: existingMembership } = await admin
      .from("organization_members")
      .select("id, is_active")
      .eq("organization_id", inviter.organizationId)
      .eq("user_id", existingUserId)
      .maybeSingle();

    if (existingMembership?.is_active) {
      return { error: say("iv_alreadyMember") };
    }

    const { error: addError } = existingMembership
      ? await admin
          .from("organization_members")
          .update({ is_active: true, role: dbRoleFromApp(role), invited_email: email })
          .eq("id", existingMembership.id)
      : await admin.from("organization_members").insert({
          organization_id: inviter.organizationId,
          user_id: existingUserId,
          role: dbRoleFromApp(role),
          invited_email: email,
          is_active: true
        });

    if (addError) {
      return { error: addError.message };
    }

    return {
      success: say("iv_addedExisting", { email, role: label })
    };
  }

  const origin = await requestOrigin();
  const redirectTo = origin ? `${origin}/auth/callback?next=/accept-invite` : undefined;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      preferred_locale: preferredLocale
    }
  });

  if (error || !data.user) {
    const message = error?.message || "";
    if (/already been registered|already registered|already exists/i.test(message)) {
      return { error: say("iv_failed") };
    }
    return { error: say("iv_failed") };
  }
  revalidatePath("/settings");

  await admin.from("users").upsert({
    id: data.user.id,
    preferred_locale: preferredLocale
  });

  const { error: memberError } = await admin.from("organization_members").upsert(
    {
      organization_id: inviter.organizationId,
      user_id: data.user.id,
      role: dbRoleFromApp(role),
      invited_email: email,
      is_active: true
    },
    { onConflict: "organization_id,user_id" }
  );

  if (memberError) {
    return { error: memberError.message };
  }

  return { success: say("iv_sent", { email, role: label }) };
}

/** The owner takes someone off the team. Their account stays (they may work for another business); they just lose this one. */
export async function removeTeammate(formData: FormData): Promise<AuthActionState> {
  const say = await authText();
  let owner;
  try {
    owner = await requireOwner();
  } catch (error) {
    return { error: error instanceof Error ? error.message : OWNER_ONLY_MESSAGE };
  }
  const memberId = String(formData.get("memberId") || "");
  const admin = createSupabaseAdminClient() as any;
  const { data: member } = await admin.from("organization_members").select("id, user_id, organization_id").eq("id", memberId).maybeSingle();
  if (!member || member.organization_id !== owner.organizationId || member.user_id === owner.userId) {
    return { error: say("iv_removeFailed") };
  }
  const { error } = await admin.from("organization_members").update({ is_active: false }).eq("id", member.id);
  if (error) return { error: say("iv_removeFailed") };
  revalidatePath("/settings");
  return { success: "ok" };
}

export async function completeInvite(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const password = String(formData.get("password") || "");
  // Only the invite form asks for a language. Choosing a new password must not change it.
  const preferredLocale = formData.has("preferredLocale") ? localeFromForm(formData) : null;
  const say = await authText();

  if (password.length < 8) {
    return { error: say("passwordShort") };
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData, error } = await supabase.auth.updateUser({ password, data: { invite_completed: true } });

  if (error || !authData.user) {
    return { error: say("passwordFailed") };
  }

  const admin = createSupabaseAdminClient() as any;
  await admin.from("users").upsert({
    id: authData.user.id,
    full_name: authData.user.user_metadata?.full_name ?? null,
    ...(preferredLocale ? { preferred_locale: preferredLocale } : {})
  });

  redirect("/");
}
