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
        <p className="mb-4 rounded-lg bg-[#fef3c7] px-3 py-2 text-sm font-semibold text-[#92400e]">
          Supabase is not configured for this local app. Add `.env.local` and restart the dev server.
        </p>
      ) : null}
      <LoginForm />
    </AuthCard>
  );
}
