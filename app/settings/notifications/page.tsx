import type { Route } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { saveNotificationSettings } from "@/app/actions/settings";
import { LineTestButton } from "@/app/settings/line-test-button";

type NotificationToggleProps = {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
};

function NotificationToggle({ name, label, description, defaultChecked }: NotificationToggleProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-[var(--border)] p-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-[var(--foreground)]">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p>
      </div>
      <div className="relative mt-0.5 flex-shrink-0">
        <input className="peer sr-only" defaultChecked={defaultChecked} name={name} type="checkbox" value="on" />
        <div className="h-6 w-11 rounded-full bg-[var(--border)] transition-colors peer-checked:bg-[var(--primary)]" />
        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </div>
    </label>
  );
}

export default async function NotificationsPage() {
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const settings = (organization.settings || {}) as Record<string, any>;
  const ns: Record<string, boolean> = settings.line_notifications || {};
  const connected = Boolean(organization.line_user_id || settings.line_user_id);

  function isOn(key: string) {
    return key in ns ? ns[key] : true;
  }

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5">
        <Link className="text-sm font-bold text-[var(--primary)]" href={"/settings?tab=notifications" as Route}>
          Back to settings
        </Link>
        <p className="page-eyebrow mt-4">Settings</p>
        <h1 className="page-title">LINE alerts</h1>
        <p className="page-subtitle mt-2">Choose what RouteHQ sends to your LINE.</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">{connected ? "LINE is connected" : "LINE is not connected yet"}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {connected ? "Alerts and the morning summary go to the LINE account you connected." : "Connect LINE in Settings first; it takes a minute."}
            </p>
          </div>
          {connected ? (
            <Badge tone="green">Connected</Badge>
          ) : (
            <Link className="primary-action pressable min-h-10 px-4 text-sm" href={"/settings?tab=notifications" as Route}>
              Connect LINE
            </Link>
          )}
        </div>
        {connected ? (
          <div className="mt-4">
            <LineTestButton />
          </div>
        ) : null}
      </Card>

      <form action={saveNotificationSettings} className="mt-4">
        <input name="organizationId" type="hidden" value={organization.id} />
        <input name="daily_summary_time" type="hidden" value={settings.daily_summary_time || "08:00"} />

        <Card>
          <SectionHeader eyebrow="Morning summary" title="What the 8:00 summary includes" />
          <div className="mt-5 space-y-3">
            <NotificationToggle defaultChecked={isOn("daily_active_rentals")} description="Who has which vehicle and when it comes back" label="Rentals out" name="daily_active_rentals" />
            <NotificationToggle defaultChecked={isOn("daily_overdue")} description="Vehicles that should have been returned" label="Late returns" name="daily_overdue" />
            <NotificationToggle defaultChecked={isOn("daily_payments")} description="Payments due from customers today" label="Payments due today" name="daily_payments" />
            <NotificationToggle defaultChecked={isOn("daily_compliance")} description="Road tax, insurance and services expiring within 7 days, or already expired" label="Expiring documents" name="daily_compliance" />
            <NotificationToggle defaultChecked={isOn("daily_revenue")} description="Rent received so far this month" label="This month's rent" name="daily_revenue" />
          </div>
        </Card>

        <div className="mt-4">
          <Card>
            <SectionHeader eyebrow="As it happens" title="Instant alerts" />
            <div className="mt-5 space-y-3">
              <NotificationToggle defaultChecked={isOn("event_contract_signed")} description="A customer completes their booking link and signs" label="Agreement signed" name="event_contract_signed" />
              <NotificationToggle defaultChecked={isOn("event_payment_received")} description="Rent is recorded, including at a handover" label="Payment received" name="event_payment_received" />
              <NotificationToggle defaultChecked={isOn("event_return_inspection")} description="A return handover is completed" label="Vehicle returned" name="event_return_inspection" />
              <NotificationToggle defaultChecked={isOn("event_portal_action")} description="A customer asks for something from their rental page (extension, issue report…)" label="Customer requests" name="event_portal_action" />
            </div>
          </Card>
        </div>

        <div className="mt-4">
          <PendingButton className="primary-action w-full sm:w-auto" pendingLabel="Saving…" savedLabel="Saved">
            Save
          </PendingButton>
        </div>
      </form>
    </AppShell>
  );
}
