/**
 * Operator notifications (Integrations, 27 Oct 2026): which events reach the business, and through which channels.
 * Stored on organizations.settings.alerts so no table is needed:
 *   { matrix: { [event]: { push?: boolean, line?: boolean, email?: boolean, telegram?: boolean } }, email_to?: string }
 * A missing entry falls back to the defaults below. The older per-event switches
 * (settings.line_notifications.event_<type> === false) still turn an event off everywhere.
 */

export const ALERT_CHANNELS = ["push", "line", "email", "telegram"] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

/** Events an operator can be told about, in the order they're shown. `type` matches notifyOperator's type. */
export const ALERT_EVENTS = ["contract_signed", "payment_received", "portal_action", "new_message", "return_inspection", "plan_activated"] as const;
export type AlertEvent = (typeof ALERT_EVENTS)[number];

/** On unless switched off: device alerts, LINE and Telegram. Email is opt-in (it's the noisiest place). */
const DEFAULT_ON: Record<AlertChannel, boolean> = { push: true, line: true, email: false, telegram: true };

export type AlertSettings = {
  matrix?: Partial<Record<string, Partial<Record<AlertChannel, boolean>>>>;
  email_to?: string | null;
  /** The morning summary (08:00 Bangkok): which channels it goes to besides LINE. */
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
  return typeof chosen === "boolean" ? chosen : channel === "line" || channel === "telegram";
}
