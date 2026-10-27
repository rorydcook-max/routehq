import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { SwitchField } from "@/components/switch-field";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { saveNotificationSettings } from "@/app/actions/settings";
import { LineTestButton } from "@/app/settings/line-test-button";

function NotificationToggle({ name, label, description, defaultChecked }: { name: string; label: string; description: string; defaultChecked: boolean }) {
  return (
    <SwitchField className="rounded-xl bg-[var(--panel-secondary)] p-3.5" defaultChecked={defaultChecked} description={description} label={label} name={name} value="on" />
  );
}

const MORNING = ["daily_active_rentals", "daily_overdue", "daily_payments", "daily_compliance", "daily_revenue"];
const INSTANT = ["event_contract_signed", "event_payment_received", "event_return_inspection", "event_portal_action"];

export default async function NotificationsPage() {
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const say = (await getTranslations("settingsPage")) as unknown as (key: string) => string;
  const settings = (organization.settings || {}) as Record<string, any>;
  const ns: Record<string, boolean> = settings.line_notifications || {};
  const connected = Boolean(organization.line_user_id || settings.line_user_id);
  const isOn = (key: string) => (key in ns ? ns[key] : true);

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl">
        <div className="page-hero mb-4">
          <Link className="font-bold text-[var(--primary)]" href={"/settings?tab=notifications" as Route}>
            {say("backToSettings")}
          </Link>
          <h1 className="page-title mt-2">{say("nt_title")}</h1>
          <p className="page-subtitle page-subtitle-keep mt-1">{say("nt_subtitle")}</p>
        </div>

        <section className="card p-4">
          <p className="text-[17px] font-bold text-[var(--foreground)]">{connected ? say("nt_connected") : say("nt_notConnected")}</p>
          <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{connected ? say("nt_connectedBody") : say("nt_notConnectedBody")}</p>
          <div className="mt-3">
            {connected ? (
              <LineTestButton />
            ) : (
              <Link className="primary-action pressable" href={"/settings?tab=notifications" as Route}>
                {say("nt_connect")}
              </Link>
            )}
          </div>
        </section>

        <form action={saveNotificationSettings} className="mt-3 space-y-3">
          <input name="organizationId" type="hidden" value={organization.id} />
          <input name="daily_summary_time" type="hidden" value={settings.daily_summary_time || "08:00"} />

          <section className="card p-4">
            <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("nt_morning")}</h2>
            <div className="mt-3 space-y-2.5">
              {MORNING.map((key) => (
                <NotificationToggle defaultChecked={isOn(key)} description={say(`nt_${key}Body`)} key={key} label={say(`nt_${key}`)} name={key} />
              ))}
            </div>
          </section>

          <section className="card p-4">
            <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("nt_instant")}</h2>
            <div className="mt-3 space-y-2.5">
              {INSTANT.map((key) => (
                <NotificationToggle defaultChecked={isOn(key)} description={say(`nt_${key}Body`)} key={key} label={say(`nt_${key}`)} name={key} />
              ))}
            </div>
          </section>

          <PendingButton className="primary-action w-full sm:w-auto" pendingLabel={say("saving")} savedLabel={say("saved")}>
            {say("save")}
          </PendingButton>
        </form>
      </div>
    </AppShell>
  );
}
