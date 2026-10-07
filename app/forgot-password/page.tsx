import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/app/forgot-password/forgot-password-form";
import { AuthCard } from "@/components/auth-card";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ForgotPasswordPage() {
  const say = (await getTranslations("auth")) as unknown as (key: string) => string;

  // Reached from "Change password" on My account as well: then the email is already known and the language is the person's own.
  let email = "";
  if (hasSupabaseEnv()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      email = user?.email || "";
    } catch {
      email = "";
    }
  }

  return (
    <AuthCard body={say("forgotBody")} language={!email} title={say("forgotTitle")}>
      <ForgotPasswordForm defaultEmail={email} signedIn={Boolean(email)} />
    </AuthCard>
  );
}
