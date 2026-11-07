/**
 * Operator notifications (Integrations, 27 Oct 2026): which events reach the business, and through which channels.
 * Stored on organizations.settings.alerts so no table is needed:
 *   { matrix: { [event]: { push?: boolean, line?: boolean, email?: boolean, telegram?: boolean } }, email_to?: string }
 * A missing entry falls back to the defaults below. The older per-event switches
 * (settings.line_notifications.event_<type> === false) still turn an event off everywhere.
 */

/**
 * Where alerts and the morning summary go (Rory, 7 Nov 2026): push to devices and email. LINE is only the optional
 * morning summary (Thailand), switched on its own card; Telegram and WhatsApp are no longer alert channels (they stay
 * for customer chats in the Inbox). Older choices for "line" and "telegram" stay stored but are no longer used.
 */
export const ALERT_CHANNELS = ["push", "email"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number] | "line" | "telegram";

/** Events an operator can be told about, in the order they're shown. `type` matches notifyOperator's type. */
export const ALERT_EVENTS = ["contract_signed", "payment_received", "portal_action", "new_message", "return_inspection", "plan_activated"] as const;
/** On unless switched off: device alerts. Email is opt-in (it's the noisiest place). */
const DEFAULT_ON: Record<AlertChannel, boolean> = { push: true, line: true, email: false, telegram: false };

export type AlertSettings = {
  matrix?: Partial<Record<string, Partial<Record<AlertChannel, boolean>>>>;
  email_to?: string | null;
  /** The morning summary (08:00 local): push and email. LINE has its own switch (organizations.line_daily_summary_enabled). */
  summary?: Partial<Record<AlertChannel, boolean>>;
};

export function alertSettings(settings: unknown): AlertSettings {
  const s = settings && typeof settings === "object" ? (settings as Record<string, any>) : {};
  return s.alerts && typeof s.alerts === "object" ? (s.alerts as AlertSettings) : {};
}

/** Whether `event` should go out on `channel` for a business with these settings. */
export function wantsAlert(settings: unknown, event: string, channel: AlertChannel): boolean {
  const s = settings && typeof settings === "object" ? (settings as Record<string, any>) : {};
  if (s.line_notifications?.[`event_${event}`] === false) return false;
  const chosen = alertSettings(settings).matrix?.[event]?.[channel];
  return typeof chosen === "boolean" ? chosen : DEFAULT_ON[channel];
}

export function wantsSummary(settings: unknown, channel: AlertChannel): boolean {
  const chosen = alertSettings(settings).summary?.[channel];
  // Push is on unless switched off (it only reaches devices where someone turned alerts on); email is opt-in.
  return typeof chosen === "boolean" ? chosen : channel === "push" || channel === "line";
}
