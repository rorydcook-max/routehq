import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignupForm } from "@/app/signup/signup-form";

export default async function SignupPage() {
  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/");
    }
  }

  const say = (await getTranslations("auth")) as unknown as (key: string) => string;

  return (
    <AuthCard title={say("signUpTitle")}>
      <SignupForm />
    </AuthCard>
  );
}
