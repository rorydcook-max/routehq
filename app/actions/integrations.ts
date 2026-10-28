"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { ALERT_CHANNELS, ALERT_EVENTS, alertSettings, type AlertSettings } from "@/lib/alerts";
import { said } from "@/lib/i18n/server-text";
import { isTelegramConfigured, telegramBotUsername } from "@/lib/telegram";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Settings › Integrations and Settings › Notifications. Owners only, like the rest of Settings. */

type Result = { ok: true; url?: string } | { ok: false; error: string };

async function ownerOrg() {
  const membership = await getCurrentMembership();
  if (!membership || membership.role !== "owner") return null;
  const db = createSupabaseAdminClient() as any;
  const { data } = await db.from("organizations").select("id, settings").eq("id", membership.organizationId).maybeSingle();
  return data ? { db, org: data as { id: string; settings: Record<string, any> | null } } : null;
}

async function saveSettings(db: any, organizationId: string, settings: Record<string, any>) {
  const { error } = await db.from("organizations").update({ settings }).eq("id", organizationId);
  revalidatePath("/settings");
  revalidatePath("/settings/notifications");
  return error ? ({ ok: false, error: error.message } as Result) : ({ ok: true } as Result);
}

/** The grid on Settings › Notifications: which events reach which channels, plus the morning summary. */
export async function saveNotificationMatrix(formData: FormData): Promise<void> {
  const found = await ownerOrg();
  if (!found) return;
  const settings = { ...(found.org.settings || {}) };
  const current = alertSettings(settings);
  const matrix: NonNullable<AlertSettings["matrix"]> = {};
  for (const event of ALERT_EVENTS) {
    matrix[event] = {};
    for (const channel of ALERT_CHANNELS) matrix[event]![channel] = formData.get(`${event}__${channel}`) === "on";
  }
  const summary: NonNullable<AlertSettings["summary"]> = {};
  for (const channel of ALERT_CHANNELS) summary[channel] = formData.get(`summary__${channel}`) === "on";
  settings.alerts = { ...current, matrix, summary };
  // The older per-event switches would otherwise silence an event the grid has switched on.
  if (settings.line_notifications) {
    const legacy = { ...settings.line_notifications };
    for (const event of ALERT_EVENTS) delete legacy[`event_${event}`];
    settings.line_notifications = legacy;
  }
  // The morning summary on LINE follows the grid too.
  await found.db.from("organizations").update({ line_daily_summary_enabled: summary.line }).eq("id", found.org.id);
  await saveSettings(found.db, found.org.id, settings);
}

/** Email alerts: where they go (blank = the business's owners). */
export async function saveAlertEmail(formData: FormData): Promise<Result> {
  const found = await ownerOrg();
  if (!found) return { ok: false, error: await said("Only the owner can change this.") };
  const email = String(formData.get("email") || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: await said("Check the email address.") };
  const settings = { ...(found.org.settings || {}) };
  settings.alerts = { ...alertSettings(settings), email_to: email || null };
  return saveSettings(found.db, found.org.id, settings);
}

/** A one-time link that opens the Lokalfleet bot in Telegram; sending it links that chat to this business. */
export async function connectTelegram(): Promise<Result> {
  if (!isTelegramConfigured()) return { ok: false, error: await said("Telegram isn't available yet.") };
  const found = await ownerOrg();
  if (!found) return { ok: false, error: await said("Only the owner can change this.") };
  const code = randomBytes(12).toString("hex");
  const settings = { ...(found.org.settings || {}), telegram_link_code: code, telegram_link_expires: new Date(Date.now() + 30 * 60_000).toISOString() };
  const saved = await saveSettings(found.db, found.org.id, settings);
  if (!saved.ok) return saved;
  return { ok: true, url: `https://t.me/${telegramBotUsername()}?start=${code}` };
}

export async function disconnectTelegram(): Promise<Result> {
  const found = await ownerOrg();
  if (!found) return { ok: false, error: await said("Only the owner can change this.") };
  const settings = { ...(found.org.settings || {}) };
  delete settings.telegram_chat_id;
  delete settings.telegram_connected_at;
  return saveSettings(found.db, found.org.id, settings);
}

/** Makes (or replaces) the private calendar address. Replacing it stops the old address working. */
export async function makeCalendarFeed(): Promise<Result> {
  const found = await ownerOrg();
  if (!found) return { ok: false, error: await said("Only the owner can change this.") };
  const settings = { ...(found.org.settings || {}), calendar_feed_token: randomBytes(20).toString("hex") };
  return saveSettings(found.db, found.org.id, settings);
}
