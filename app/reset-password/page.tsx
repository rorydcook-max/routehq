import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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

  const say = (await getTranslations("auth")) as unknown as (key: string) => string;

  return (
    <AuthCard language={false} title={say("resetTitle")}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
