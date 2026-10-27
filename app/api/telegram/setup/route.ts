import { requirePlatformAdmin } from "@/lib/admin";
import { setTelegramWebhook } from "@/lib/telegram";

/** One-time setup by a RouteHQ platform admin: points the Telegram bot at this app's webhook. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePlatformAdmin();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const result = await setTelegramWebhook(appUrl);
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
