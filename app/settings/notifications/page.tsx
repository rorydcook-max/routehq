import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { SwitchField } from "@/components/switch-field";
import { BackLink } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { saveNotificationSettings } from "@/app/actions/settings";
import { LineTestButton } from "@/app/settings/line-test-button";

/** One alert type: a row in a divided list (title, then a short line on what it covers). */
function NotificationToggle({ name, label, description, defaultChecked }: { name: string; label: string; description: string; defaultChecked: boolean }) {
  return (
    <SwitchField
      className="py-2"
      defaultChecked={defaultChecked}
      description={<span className="text-sm">{description}</span>}
      label={label}
      labelClassName="font-semibold text-[var(--foreground)]"
      name={name}
      value="on"
    />
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
      <div className="page-form">
        <div className="page-hero mb-4">
          <BackLink href="/settings?tab=notifications" label={say("title")} />
          <h1 className="page-title">{say("nt_title")}</h1>
          <p className="page-subtitle page-subtitle-keep mt-1">{say("nt_subtitle")}</p>
        </div>

        <section className="card p-4">
          <h2 className="card-title">{connected ? say("nt_connected") : say("nt_notConnected")}</h2>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{connected ? say("nt_connectedBody") : say("nt_notConnectedBody")}</p>
          <div className="mt-3">
            {connected ? (
              <LineTestButton />
            ) : (
              <Link className="primary-action pressable" href={"/settings?tab=notifications#line" as Route}>
                {say("nt_connect")}
              </Link>
            )}
          </div>
        </section>

        <form action={saveNotificationSettings} className="mt-3">
          <input name="organizationId" type="hidden" value={organization.id} />
          <input name="daily_summary_time" type="hidden" value={settings.daily_summary_time || "08:00"} />

          {/* Nothing can be delivered until LINE is connected: the choices are shown, dimmed and locked, so it's clear what you'll get. */}
          <fieldset className={`space-y-3 ${connected ? "" : "opacity-50"}`} disabled={!connected}>
            <section className="card p-4">
              <h2 className="card-title">{say("nt_morning")}</h2>
              <div className="mt-2 divide-y divide-[var(--border)]">
                {MORNING.map((key) => (
                  <NotificationToggle defaultChecked={isOn(key)} description={say(`nt_${key}Body`)} key={key} label={say(`nt_${key}`)} name={key} />
                ))}
              </div>
            </section>

            <section className="card p-4">
              <h2 className="card-title">{say("nt_instant")}</h2>
              <div className="mt-2 divide-y divide-[var(--border)]">
                {INSTANT.map((key) => (
                  <NotificationToggle defaultChecked={isOn(key)} description={say(`nt_${key}Body`)} key={key} label={say(`nt_${key}`)} name={key} />
                ))}
              </div>
              <PendingButton className="primary-action mt-4 w-full sm:w-auto" pendingLabel={say("saving")} savedLabel={say("saved")}>
                {say("save")}
              </PendingButton>
            </section>
          </fieldset>
        </form>
      </div>
    </AppShell>
  );
}
