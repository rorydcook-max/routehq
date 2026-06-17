import { AppShell } from "@/components/app-shell";
import { Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { InviteForm } from "@/app/invite/invite-form";

export default async function InvitePage() {
  const userEmail = await getCurrentUserEmail();

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-xl">
        <Card>
          <SectionHeader eyebrow="Settings" title="Invite user" />
          <p className="mt-2 text-sm text-[#667085]">Invite the partner or an owner-level user. Role restrictions are built for later; v1 invites use full owner access.</p>
          <div className="mt-5">
            <InviteForm />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
