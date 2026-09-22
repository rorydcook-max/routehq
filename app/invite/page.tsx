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
          <SectionHeader eyebrow="Settings" title="Invite a team member" />
          <p className="mt-2 text-sm text-[#667085]">Invite someone to your business. Owners have full control; teammates can run day-to-day work but cannot change business settings, billing or the team.</p>
          <div className="mt-5">
            <InviteForm />
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
