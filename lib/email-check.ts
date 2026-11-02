import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checking a new account's email address after they are already in (Rory, 2 Nov 2026). The link we send carries a
 * token signed with a server-only secret, so only someone who opened that email can mark the address as checked.
 */
function signature(payload: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "rove-dev").update(`email-check|${payload}`).digest("hex");
}

export function emailCheckToken(userId: string) {
  const payload = `${userId}.${Math.floor(Date.now() / 1000) + 7 * 86_400}`;
  return `${payload}.${signature(payload)}`;
}

/** The person the token was made for, when it is genuine and less than a week old; otherwise null. */
export function readEmailCheckToken(token: string) {
  const [userId, expires, given] = String(token || "").split(".");
  if (!userId || !expires || !given || Number(expires) < Date.now() / 1000) return null;
  const expected = signature(`${userId}.${expires}`);
  if (expected.length !== given.length) return null;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given)) ? userId : null;
}

/** Still waiting for the address to be checked: only accounts made since sign-up stopped asking first. */
export function emailCheckPending(user: { app_metadata?: Record<string, unknown> | null } | null | undefined) {
  return user?.app_metadata?.email_check === "pending";
}
