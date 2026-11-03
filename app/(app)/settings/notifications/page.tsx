import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { BackLink } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { saveNotificationMatrix } from "@/app/actions/integrations";
import { ALERT_CHANNELS, ALERT_EVENTS, wantsAlert, wantsSummary, type AlertChannel } from "@/lib/alerts";
import { isEmailConfigured } from "@/lib/email";
import { isTelegramConfigured } from "@/lib/telegram";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * Settings › Notifications (27 Oct 2026): one grid of what the business hears about and where.
 * Rows are events, columns are channels (this device and the team's devices, LINE, email, Telegram).
 * A channel that isn't connected yet is shown dimmed with a link to connect it, so the grid never
 * promises something that can't arrive.
 */
export default async function NotificationsPage() {
  const [userEmail, organization, t] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getTranslations("settingsPage")]);
  const say = t as unknown as Say;
  const settings = (organization.settings || {}) as Record<string, any>;
  const ready: Record<AlertChannel, boolean> = {
    push: true,
    line: Boolean(organization.line_user_id || settings.line_user_id),
    email: isEmailConfigured(),
    telegram: isTelegramConfigured() && Boolean(settings.telegram_chat_id)
  };
  const label: Record<AlertChannel, string> = { push: say("ig_chPush"), line: "LINE", email: say("ig_chEmail"), telegram: "Telegram" };
  const cell = (name: string, channel: AlertChannel, checked: boolean) => (
    <td className="px-2 py-3 text-center" key={channel}>
      <input
        aria-label={`${label[channel]}`}
        className={`h-5 w-5 cursor-pointer accent-[var(--primary)] ${ready[channel] ? "" : "opacity-40"}`}
        defaultChecked={checked}
        name={`${name}__${channel}`}
        type="checkbox"
      />
    </td>
  );

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-form">
        <BackLink href="/settings?tab=notifications" label={say("title")} />
        <h1 className="page-title">{say("ig_notifTitle")}</h1>
        <p className="measure mt-1.5 font-medium text-[var(--foreground-secondary)]">{say("ig_notifPageBody")}</p>

        <form action={saveNotificationMatrix} className="mt-6">
          <section className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className="px-5 py-3">{say("ig_colWhat")}</th>
                    {ALERT_CHANNELS.map((channel) => (
                      <th className="w-[58px] px-1 py-3 text-center text-[13px] sm:w-[88px] sm:px-2 sm:text-[14px]" key={channel}>
                        <span className="block">{label[channel]}</span>
                        {ready[channel] ? null : (
                          <Link className="block text-[12px] font-bold text-[var(--primary)] hover:underline" href={"/settings?tab=notifications" as Route}>
                            {channel === "email" && !isEmailConfigured() ? say("ig_soon") : say("ig_connect")}
                          </Link>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ALERT_EVENTS.map((event) => (
                    <tr key={event}>
                      <td className="px-5 py-3">
                        <span className="block font-semibold text-[var(--foreground)]">{say(`ig_ev_${event}`)}</span>
                        <span className="hidden text-[14px] font-medium text-[var(--muted)] sm:block">{say(`ig_ev_${event}Body`)}</span>
                      </td>
                      {ALERT_CHANNELS.map((channel) => cell(event, channel, wantsAlert(settings, event, channel)))}
                    </tr>
                  ))}
                  <tr>
                    <td className="px-5 py-3">
                      <span className="block font-semibold text-[var(--foreground)]">{say("ig_ev_summary")}</span>
                      <span className="hidden text-[14px] font-medium text-[var(--muted)] sm:block">{say("ig_ev_summaryBody")}</span>
                    </td>
                    {ALERT_CHANNELS.map((channel) =>
                      channel === "push" ? (
                        <td className="px-2 py-3 text-center text-[var(--muted)]" key={channel}>
                          –
                        </td>
                      ) : (
                        cell("summary", channel, channel === "line" ? organization.line_daily_summary_enabled !== false && wantsSummary(settings, channel) : wantsSummary(settings, channel))
                      )
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PendingButton className="primary-action" pendingLabel={say("saving")} savedLabel={say("saved")}>
              {say("save")}
            </PendingButton>
            <p className="text-[14px] font-medium text-[var(--muted)]">{say("ig_notifFoot")}</p>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
