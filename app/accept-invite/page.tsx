import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AcceptInviteForm } from "@/app/accept-invite/accept-invite-form";
import { AuthCard } from "@/components/auth-card";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AcceptInvitePage() {
  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
    // This page sets a password for whoever is signed in, so it is only for someone who came in on an invite
    // and has not finished it. Anyone else (for instance the owner opening a teammate's old link) goes home.
    if (!user.invited_at || user.user_metadata?.invite_completed) {
      redirect("/");
    }
  }

  const say = (await getTranslations("auth")) as unknown as (key: string) => string;

  return (
    <AuthCard language={false} title={say("inviteTitle")}>
      <AcceptInviteForm />
    </AuthCard>
  );
}
