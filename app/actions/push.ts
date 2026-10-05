"use server";

import { getCurrentMembership } from "@/lib/auth/roles";
import { pushConfigured, sendPushToOrganization } from "@/lib/push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type BrowserSubscription = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Remember this device for alerts. A device belongs to whoever is signed in on it, in the business they are working in. */
export async function savePushSubscription(subscription: BrowserSubscription, userAgent?: string): Promise<{ ok: boolean }> {
  const membership = await getCurrentMembership();
  const endpoint = String(subscription?.endpoint || "");
  const p256dh = String(subscription?.keys?.p256dh || "");
  const auth = String(subscription?.keys?.auth || "");
  if (!membership || !endpoint.startsWith("https://") || !p256dh || !auth) return { ok: false };
  const admin = createSupabaseAdminClient() as any;
  const { error } = await admin
    .from("push_subscriptions")
    .upsert({ organization_id: membership.organizationId, user_id: membership.userId, endpoint, p256dh, auth, user_agent: String(userAgent || "").slice(0, 200) || null }, { onConflict: "endpoint" });
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const membership = await getCurrentMembership();
  if (!membership || !endpoint) return { ok: false };
  const admin = createSupabaseAdminClient() as any;
  await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", membership.userId);
  return { ok: true };
}

/** "Send a test" on the account page: one alert to this person's own devices. */
export async function sendTestPush(): Promise<{ ok: boolean; sent: number }> {
  const membership = await getCurrentMembership();
  if (!membership || !pushConfigured()) return { ok: false, sent: 0 };
  const admin = createSupabaseAdminClient() as any;
  const sent = await sendPushToOrganization(admin, membership.organizationId, { title: "RouteHQ", body: "Alerts are working on this device.", url: "/tasks", tag: "test" }, { onlyUserId: membership.userId });
  return { ok: sent > 0, sent };
}
