---
name: project-line-integration
description: LINE Messaging API integration — provider library, webhook, daily summary, event notifications, settings UI. Built 2026-06-04.
metadata:
  type: project
---

LINE integration (SPEC.md §26) fully built and build-clean as of 2026-06-04.

**Files created:**
- `lib/providers/messaging/line.ts` — Core provider: `sendLinePushMessage`, `lineText`, `lineFlex`, `verifyLineSignature`
- `lib/line/daily-summary.ts` — Fetches org data, builds Flex Message carousel for morning summary
- `lib/line/notifications.ts` — Event notification functions for payments, contracts, GPS, compliance, overdue, bookings, and customer payment reminders
- `app/api/line/webhook/route.ts` — Webhook endpoint (POST); verifies HMAC-SHA256 signature, captures operator LINE userId to `org.settings.line_user_id`, handles "summary" keyword reply
- `app/api/line/daily-summary/route.ts` — Cron endpoint (POST + GET); protected by `CRON_SECRET` header/query param
- `app/settings/notifications/page.tsx` — Settings UI with LINE connection status, notification toggles, daily summary time, test button

**Modified files:**
- `app/actions/transactions.ts` — Fire-and-forget `notifyPaymentReceived` when type=rental_income
- `app/actions/public-booking.ts` — Fire-and-forget `notifyContractSigned` after customer signs
- `app/actions/settings.ts` — Added `saveNotificationSettings` action (stores `settings.line_notifications` + `daily_summary_time`)
- `app/settings/page.tsx` — Added "Notifications" card linking to `/settings/notifications`

**Operator setup flow:**
1. Add LINE OA (`LINE_OA_ID=@591zcqnq`) as friend
2. Send any message → webhook captures userId → stored in `org.settings.line_user_id`
3. Register webhook URL `https://your-domain/api/line/webhook` in LINE Developers Console

**Daily summary cron:** Call `POST /api/line/daily-summary` with header `x-cron-secret: $CRON_SECRET` at 8am Bangkok time. Can reply to "summary" message from operator for on-demand.

**Why:** SPEC §26 requires daily 8am LINE summary and event-triggered operator notifications. Notification settings are stored in `org.settings.line_notifications` (JSONB).

**How to apply:** Notifications are fire-and-forget (`.catch(() => null)`) — never let LINE errors break existing flows. Admin client used for org lookup (service role key). Operator LINE userId must be stored before any push messages work.
