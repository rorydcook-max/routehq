import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { InviteForm } from "@/app/invite/invite-form";

export default async function InvitePage() {
  const [userEmail, t] = await Promise.all([getCurrentUserEmail(), getTranslations("auth")]);

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-xl">
        {/* The two choices on the form say what each kind of person can do; no paragraph needed above them. */}
        <h1 className="page-title mb-4">{t.has("iv_pageTitle") ? t("iv_pageTitle") : "Invite someone to your team"}</h1>
        <Card>
          <div className="card-section">
            <InviteForm />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
