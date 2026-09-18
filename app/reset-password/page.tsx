import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/app/reset-password/reset-password-form";
import { AuthCard } from "@/components/auth-card";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
  }

  return (
    <AuthCard eyebrow="RouteHQ" title="Set a new password">
      <ResetPasswordForm />
    </AuthCard>
  );
}
