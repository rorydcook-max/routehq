import { getTranslations } from "next-intl/server";
import { PendingButton } from "@/components/pending-button";
import { saveNotificationMatrix } from "@/app/actions/integrations";
import { ALERT_CHANNELS, ALERT_EVENTS, wantsAlert, wantsSummary, type AlertChannel } from "@/lib/alerts";
import { isEmailConfigured } from "@/lib/email";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * Settings › Notifications (7 Nov 2026): one grid of what the business hears about, by push and by email.
 * Rows are the alerts and the morning summary; columns are the two channels. Email that isn't set up on this
 * server yet is shown dimmed with "Coming soon", so the grid never promises something that can't arrive.
 */
export async function NotificationGrid({ settings }: { settings: Record<string, unknown> }) {
  const say = (await getTranslations("settingsPage")) as unknown as Say;
  const ready: Record<(typeof ALERT_CHANNELS)[number], boolean> = { push: true, email: isEmailConfigured() };
  const label: Record<(typeof ALERT_CHANNELS)[number], string> = { push: say("nt_chPush"), email: say("ig_chEmail") };
  const cell = (name: string, channel: (typeof ALERT_CHANNELS)[number], checked: boolean) => (
    <td className="px-2 py-3 text-center" key={channel}>
      <input
        aria-label={label[channel]}
        className={`h-5 w-5 cursor-pointer accent-[var(--primary)] ${ready[channel] ? "" : "opacity-40"}`}
        defaultChecked={checked}
        name={`${name}__${channel}`}
        type="checkbox"
      />
    </td>
  );

  return (
    <form action={saveNotificationMatrix}>
      <section className="card overflow-hidden p-0">
        <div className="px-5 pt-5">
          <h2 className="card-title">{say("nt_gridTitle")}</h2>
          <p className="measure mt-1 font-medium text-[var(--foreground-secondary)]">{say("nt_gridBody")}</p>
        </div>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-5 py-3">{say("ig_colWhat")}</th>
                {ALERT_CHANNELS.map((channel) => (
                  <th className="w-[64px] px-1 py-3 text-center text-[13px] sm:w-[88px] sm:px-2 sm:text-[14px]" key={channel}>
                    <span className="block">{label[channel]}</span>
                    {ready[channel] ? null : <span className="block text-[12px] font-bold text-[var(--muted)]">{say("ig_soon")}</span>}
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
                  {ALERT_CHANNELS.map((channel) => cell(event, channel, wantsAlert(settings, event, channel as AlertChannel)))}
                </tr>
              ))}
              <tr>
                <td className="px-5 py-3">
                  <span className="block font-semibold text-[var(--foreground)]">{say("ig_ev_summary")}</span>
                  <span className="hidden text-[14px] font-medium text-[var(--muted)] sm:block">{say("ig_ev_summaryBody")}</span>
                </td>
                {ALERT_CHANNELS.map((channel) => cell("summary", channel, wantsSummary(settings, channel as AlertChannel)))}
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
  );
}
