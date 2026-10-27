import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
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
  // The saved signature, shown on the "saved" card (served from storage, or an older stored URL).
  const signatureUrl = organization?.authorised_signature_storage_bucket && organization?.authorised_signature_storage_path
    ? "/api/branding-assets/signature"
    : /^(https?:|data:)/.test(String(organization?.owner_signature_url || "")) ? String(organization.owner_signature_url) : null;

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-form">
        <div className="page-hero mb-4">
          {/* Named after where it goes back to: Settings (the usual way in), or simply "Back" from a booking flow. */}
          <BackLink href={backHref} label={backHref.startsWith("/settings") ? say("title") : say("sig_back")} />
          <h1 className="page-title">{say("sig_pageTitle")}</h1>
          <p className="page-subtitle page-subtitle-keep mt-1">{say("sig_pageBody")}</p>
        </div>
        <SignatureForm
          signatureUrl={signatureUrl}
          backHref={backHref}
          defaultName={String(organization?.authorised_signatory_name || profile?.full_name || user?.user_metadata?.full_name || "")}
          defaultTitle={String(organization?.authorised_signatory_title || say("sig_ownerTitle"))}
          ready={ready}
        />
      </div>
    </AppShell>
  );
}
