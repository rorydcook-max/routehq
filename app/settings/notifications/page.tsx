import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { saveNotificationSettings } from "@/app/actions/settings";
import { LineTestButton } from "@/app/settings/line-test-button";

function NotificationToggle({ name, label, description, defaultChecked }: { name: string; label: string; description: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-[var(--panel-secondary)] p-3.5">
      <div className="flex-1">
        <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{label}</p>
        <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{description}</p>
      </div>
      <div className="relative mt-0.5 flex-shrink-0">
        <input className="peer sr-only" defaultChecked={defaultChecked} name={name} type="checkbox" value="on" />
        <div className="h-7 w-12 rounded-full bg-[var(--border-strong)] transition-colors peer-checked:bg-[var(--primary)]" />
        <div className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </div>
    </label>
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
