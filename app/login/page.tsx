import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage() {
  const isConfigured = hasSupabaseEnv();

  if (isConfigured) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/");
    }
  }

  return (
    <AuthCard eyebrow="RouteHQ" title="Sign in">
      {!isConfigured ? (
        <p className="mb-4 rounded-lg bg-[var(--warning-light)] px-3 py-2 text-sm font-semibold text-[var(--warning)]">
          Supabase is not configured for this local app. Add `.env.local` and restart the dev server.
        </p>
      ) : null}
      <LoginForm />
    </AuthCard>
  );
}
