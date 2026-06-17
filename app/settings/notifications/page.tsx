import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { saveNotificationSettings } from "@/app/actions/settings";

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]";

type NotificationToggleProps = {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
};

function NotificationToggle({ name, label, description, defaultChecked }: NotificationToggleProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-[#dfe4ea] p-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#172026]">{label}</p>
        <p className="mt-0.5 text-xs text-[#667085]">{description}</p>
      </div>
      <div className="relative mt-0.5 flex-shrink-0">
        <input
          className="peer sr-only"
          defaultChecked={defaultChecked}
          name={name}
          type="checkbox"
          value="on"
        />
        <div className="h-6 w-11 rounded-full bg-[#cbd5e1] transition-colors peer-checked:bg-[#0f766e]" />
        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </div>
    </label>
  );
}

export default async function NotificationsPage() {
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const settings = organization.settings || {};
  const ns: Record<string, boolean> = settings.line_notifications || {};
  const lineUserId: string | null = settings.line_user_id || null;
  const lineConnectedAt: string | null = settings.line_connected_at || null;
  const dailySummaryTime: string = settings.daily_summary_time || "08:00";
  const lineOaId = process.env.LINE_OA_ID || "";

  function isOn(key: string) {
    return key in ns ? ns[key] : true;
  }

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5">
        <p className="page-eyebrow">Settings</p>
        <h1 className="page-title">Notifications</h1>
        <p className="page-subtitle mt-2">Configure LINE alerts and your daily fleet summary.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card>
          <SectionHeader eyebrow="LINE connection" title="LINE Official Account" />
          <p className="mt-2 text-sm text-[#667085]">
            Add <strong>{lineOaId || "@your-oa"}</strong> as a friend on LINE, then send any message to connect your
            account. FleetOS will send daily summaries and event alerts to your LINE.
          </p>

          <div className="mt-5 rounded-xl border border-[#dfe4ea] bg-[#f8fafc] p-4">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full flex-shrink-0 ${lineUserId ? "bg-[#16a34a]" : "bg-[#94a3b8]"}`} />
              <div>
                <p className="text-sm font-semibold text-[#172026]">
                  {lineUserId ? "Connected" : "Not connected"}
                </p>
                {lineUserId ? (
                  <p className="text-xs text-[#667085]">
                    LINE user ID captured
                    {lineConnectedAt
                      ? ` on ${new Date(lineConnectedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                      : ""}
                  </p>
                ) : (
                  <p className="text-xs text-[#667085]">
                    Message <strong>{lineOaId || "the FleetOS OA"}</strong> on LINE to connect
                  </p>
                )}
              </div>
              <div className="ml-auto">
                <Badge tone={lineUserId ? "green" : "neutral"}>{lineUserId ? "Active" : "Setup required"}</Badge>
              </div>
            </div>
          </div>

          {!lineUserId && (
            <div className="mt-4 rounded-xl border border-[#fef3c7] bg-[#fffbeb] p-4">
              <p className="text-sm font-semibold text-[#92400e]">How to connect</p>
              <ol className="mt-2 list-decimal pl-4 text-sm text-[#78350f] space-y-1">
                <li>Open LINE on your phone</li>
                <li>Search for <strong>{lineOaId || "@your-oa"}</strong> and add as a friend</li>
                <li>Send any message (e.g. "hello")</li>
                <li>FleetOS will confirm and send you a welcome message</li>
                <li>Refresh this page to see your connection status</li>
              </ol>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader eyebrow="Webhook" title="LINE webhook URL" />
          <p className="mt-2 text-sm text-[#667085]">
            Register this URL in your LINE Developers Console under your Messaging API channel.
          </p>
          <div className="mt-4 rounded-xl border border-[#dfe4ea] bg-[#f1f5f9] p-3">
            <p className="break-all font-mono text-xs text-[#334155]">
              {process.env.NEXT_PUBLIC_APP_URL
                ? `${process.env.NEXT_PUBLIC_APP_URL}/api/line/webhook`
                : "https://your-domain.com/api/line/webhook"}
            </p>
          </div>
          <div className="mt-3 space-y-1 text-xs text-[#667085]">
            <p>1. Go to LINE Developers Console → your channel → Messaging API</p>
            <p>2. Paste the URL above as the Webhook URL</p>
            <p>3. Enable "Use webhook"</p>
            <p>4. Disable "Auto-reply messages" to avoid double-replies</p>
          </div>
        </Card>
      </div>

      <form action={saveNotificationSettings} className="mt-4">
        <input name="organizationId" type="hidden" value={organization.id} />

        <Card>
          <SectionHeader eyebrow="Daily summary" title="Morning summary settings" />
          <p className="mt-2 text-sm text-[#667085]">
            FleetOS sends a personalised daily summary to your LINE every morning. Choose what to include and when it
            arrives.
          </p>

          <div className="mt-5">
            <label className="block">
              <span className="text-sm font-semibold text-[#344054]">Send time (local time)</span>
              <input
                className={inputClass}
                defaultValue={dailySummaryTime}
                max="23:59"
                min="00:00"
                name="daily_summary_time"
                type="time"
              />
            </label>
            <p className="mt-1 text-xs text-[#667085]">
              Timezone: <strong>{organization.timezone || "Asia/Bangkok"}</strong>. Schedule a cron job to call{" "}
              <span className="font-mono">POST /api/line/daily-summary</span> at this time.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Include in daily summary</p>
            <NotificationToggle
              defaultChecked={isOn("daily_active_rentals")}
              description="Customer names, vehicles, and return dates"
              label="Active rentals"
              name="daily_active_rentals"
            />
            <NotificationToggle
              defaultChecked={isOn("daily_overdue")}
              description="Vehicles that haven't been returned on time"
              label="Overdue returns"
              name="daily_overdue"
            />
            <NotificationToggle
              defaultChecked={isOn("daily_payments")}
              description="Payments expected from customers today"
              label="Payments due today"
              name="daily_payments"
            />
            <NotificationToggle
              defaultChecked={isOn("daily_compliance")}
              description="Tax, insurance, and service expiries within 7 days"
              label="Compliance alerts"
              name="daily_compliance"
            />
            <NotificationToggle
              defaultChecked={isOn("daily_revenue")}
              description="Month-to-date fleet revenue"
              label="Monthly revenue metric"
              name="daily_revenue"
            />
          </div>
        </Card>

        <div className="mt-4">
          <Card>
            <SectionHeader eyebrow="Event alerts" title="Real-time notifications" />
            <p className="mt-2 text-sm text-[#667085]">
              Sent immediately when specific events happen. Defaults are all on.
            </p>
            <div className="mt-5 space-y-3">
              <NotificationToggle
                defaultChecked={isOn("event_payment_received")}
                description="When a rental income transaction is recorded"
                label="Payment received"
                name="event_payment_received"
              />
              <NotificationToggle
                defaultChecked={isOn("event_contract_signed")}
                description="When a customer signs their rental contract"
                label="Contract signed"
                name="event_contract_signed"
              />
              <NotificationToggle
                defaultChecked={isOn("event_gps_offline")}
                description="When a vehicle GPS tracker goes offline for more than 1 hour"
                label="GPS offline"
                name="event_gps_offline"
              />
              <NotificationToggle
                defaultChecked={isOn("event_compliance_expiry")}
                description="When a tax, insurance, or service date is approaching"
                label="Compliance expiry"
                name="event_compliance_expiry"
              />
              <NotificationToggle
                defaultChecked={isOn("event_rental_overdue")}
                description="When a vehicle was due back but hasn't been returned"
                label="Rental overdue"
                name="event_rental_overdue"
              />
              <NotificationToggle
                defaultChecked={isOn("event_new_booking")}
                description="When a new booking request is created"
                label="New booking request"
                name="event_new_booking"
              />
            </div>
          </Card>
        </div>

        <div className="mt-4">
          <PendingButton className="primary-action w-full sm:w-auto" pendingLabel="Saving...">
            Save notification settings
          </PendingButton>
        </div>
      </form>

      <div className="mt-4">
        <Card>
          <SectionHeader eyebrow="Test" title="Send test summary" />
          <p className="mt-2 text-sm text-[#667085]">
            {lineUserId
              ? "Send the daily summary to your LINE right now to preview it."
              : "Connect your LINE account first, then you can test the summary here."}
          </p>
          {lineUserId && (
            <div className="mt-4">
              <a
                className="primary-action inline-flex"
                href="/api/line/daily-summary"
                rel="noreferrer"
                target="_blank"
              >
                Send test summary now
              </a>
              <p className="mt-2 text-xs text-[#667085]">
                Opens the summary API in a new tab. The summary will be sent to your LINE immediately.
              </p>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
