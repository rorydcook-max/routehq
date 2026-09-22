"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dbRoleFromApp, getCurrentMembership, OWNER_ONLY_MESSAGE, requireOwner, type AppRole } from "@/lib/auth/roles";

export type AuthActionState = {
  error?: string;
  success?: string;
};

const supportedLocales = new Set<string>(supportedLocaleCodes);

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
    return { error: error.message };
  }

  redirect("/");
}

export async function requestPasswordReset(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") || "").trim();
  const origin = String(formData.get("origin") || "");

  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createSupabaseServerClient();
  const redirectTo = origin ? `${origin}/auth/callback?next=/reset-password` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return { success: "If an account exists for that email, a reset link has been sent." };
  }

  return { success: "If an account exists for that email, a reset link has been sent." };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Used by the app shell to decide which navigation to show. Display only - access is enforced on the server. */
export async function getMyAppRole(): Promise<AppRole | null> {
  const membership = await getCurrentMembership();
  return membership?.role ?? null;
}

async function requestOrigin() {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  return String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "") || undefined;
}

const SIGN_UP_SENT =
  "Check your email to confirm your account. The link will bring you back here to set up your business.";

export async function signUpWithEmail(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const businessName = String(formData.get("businessName") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (businessName.length < 2 || businessName.length > 120) {
    return { error: "Enter your business name (2 to 120 characters)." };
  }
  if (!fullName) {
    return { error: "Enter your name." };
  }
  if (!email) {
    return { error: "Enter your email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
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
    return { error: error.message };
  }

  // If email confirmation is switched off in Supabase, a session comes back
  // straight away and the user can go directly to setting up their business.
  if (data.session) {
    redirect("/onboarding");
  }

  // Same message whether or not the email was already registered, so the form
  // cannot be used to find out who has an account.
  return { success: SIGN_UP_SENT };
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
    return { error: error.message };
  }

  redirect("/onboarding");
}

export async function inviteUser(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const preferredLocale = localeFromForm(formData);
  const role: AppRole = formData.get("role") === "owner" ? "owner" : "teammate";

  if (!email) {
    return { error: "Enter an email address." };
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
    return { error: "You are already a member of this business." };
  }

  const origin = await requestOrigin();
  const admin = createSupabaseAdminClient() as any;
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
      return {
        error:
          "That email already has a RouteHQ account. Adding an existing account to a second business is not supported yet."
      };
    }
    return { error: message || "Unable to send invite." };
  }

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

  const label = role === "owner" ? "an owner" : "a teammate";
  return { success: `Invite sent to ${email} as ${label}.` };
}

export async function completeInvite(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const password = String(formData.get("password") || "");
  const preferredLocale = localeFromForm(formData);

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData, error } = await supabase.auth.updateUser({ password });

  if (error || !authData.user) {
    return { error: error?.message || "Unable to set password." };
  }

  const admin = createSupabaseAdminClient() as any;
  await admin.from("users").upsert({
    id: authData.user.id,
    full_name: authData.user.user_metadata?.full_name ?? null,
    preferred_locale: preferredLocale
  });

  redirect("/");
}
