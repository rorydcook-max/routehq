"use server";

import { redirect } from "next/navigation";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDefaultOrganizationSlug } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function inviteUser(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const preferredLocale = localeFromForm(formData);
  const origin = String(formData.get("origin") || "");

  if (!email) {
    return { error: "Enter an email address." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to invite a user." };
  }

  const admin = createSupabaseAdminClient() as any;
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", getDefaultOrganizationSlug())
    .single();

  if (organizationError || !organization) {
    return { error: organizationError?.message || "Default organization was not found." };
  }

  const redirectTo = origin ? `${origin}/auth/callback?next=/accept-invite` : undefined;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      preferred_locale: preferredLocale
    }
  });

  if (error || !data.user) {
    return { error: error?.message || "Unable to send invite." };
  }

  await admin.from("users").upsert({
    id: data.user.id,
    preferred_locale: preferredLocale
  });

  await admin.from("organization_members").upsert({
    organization_id: organization.id,
    user_id: data.user.id,
    role: "owner",
    invited_email: email,
    is_active: true
  });

  return { success: `Invite sent to ${email}.` };
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
