import webpush from "web-push";

/**
 * Alerts on the owner's and team's own phones and computers (web push).
 * Works in the installed app and in browsers that allow notifications.
 * LINE alerts are separate (see notify-operator.ts); a business can have both.
 */

export type PushMessage = {
  title: string;
  body: string;
  /** Where tapping the alert opens. */
  url?: string;
  /** Alerts with the same tag replace each other instead of stacking. */
  tag?: string;
};

let configured: boolean | null = null;

function configure() {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${process.env.SUPPORT_EMAIL || "support@routehq.app"}`, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushConfigured() {
  return configure();
}

/** Sends to every device in the business that asked for alerts. Never throws. */
export async function sendPushToOrganization(admin: any, organizationId: string, message: PushMessage, options: { onlyUserId?: string } = {}): Promise<number> {
  try {
    if (!configure()) return 0;
    let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("organization_id", organizationId);
    if (options.onlyUserId) query = query.eq("user_id", options.onlyUserId);
    const { data: subscriptions } = await query;
    if (!subscriptions?.length) return 0;

    const payload = JSON.stringify({ title: message.title, body: message.body.slice(0, 240), url: message.url || "/tasks", tag: message.tag || undefined });
    const gone: string[] = [];
    const delivered: string[] = [];
    await Promise.all(
      (subscriptions as any[]).map(async (row) => {
        try {
          await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 60 * 60 * 12 });
          delivered.push(row.id);
        } catch (error: any) {
          // The browser was uninstalled or alerts were switched off there.
          if (error?.statusCode === 404 || error?.statusCode === 410) gone.push(row.id);
        }
      })
    );
    if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
    if (delivered.length) await admin.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).in("id", delivered);
    return delivered.length;
  } catch {
    return 0;
  }
}
