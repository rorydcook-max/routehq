import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { onlineSigningGaps } from "@/lib/online-signing-readiness";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignatureForm } from "./signature-form";

/** Only ever send the person back to a page inside the app. */
function safeBack(value: string | undefined) {
  return value && /^\/[a-z0-9/_?=&#-]*$/i.test(value) && !value.startsWith("//") ? value : "/";
}

export default async function SignaturePage({ searchParams }: { searchParams: Promise<{ back?: string }> }) {
  const [userEmail, defaultOrganization, params] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), searchParams]);
  const say = (await getTranslations("settingsPage")) as unknown as (key: string) => string;
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const [{ data: organization }, { data: profile }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", defaultOrganization.id).maybeSingle(),
    supabase.from("users").select("full_name").eq("id", user?.id).maybeSingle()
  ]);
  const ready = organization ? onlineSigningGaps(organization).length === 0 : false;
  const backHref = safeBack(params.back);

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-xl">
        <div className="page-hero mb-4">
          <Link className="font-bold text-[var(--primary)]" href={backHref as never}>
            {say("sig_back")}
          </Link>
          <h1 className="page-title mt-2">{say("sig_pageTitle")}</h1>
          <p className="page-subtitle page-subtitle-keep mt-1">{say("sig_pageBody")}</p>
        </div>
        <SignatureForm
          backHref={backHref}
          defaultName={String(organization?.authorised_signatory_name || profile?.full_name || user?.user_metadata?.full_name || "")}
          defaultTitle={String(organization?.authorised_signatory_title || say("sig_ownerTitle"))}
          ready={ready}
        />
      </div>
    </AppShell>
  );
}
