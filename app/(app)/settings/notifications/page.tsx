import type { Route } from "next";
import { redirect } from "next/navigation";

/**
 * The notification grid now lives on the Notifications tab of Settings (7 Nov 2026,
 * app/(app)/settings/notification-grid.tsx). Old links and older emails still land in the right place.
 */
export default function NotificationsPage() {
  redirect("/settings?tab=notifications" as Route);
}
