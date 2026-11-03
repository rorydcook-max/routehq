import type { Route } from "next";
import { redirect } from "next/navigation";

/**
 * The old Help queue moved into the admin console's helpdesk (3 Nov 2026). Kept as a redirect so old links, phone
 * alerts and bookmarks still land in the right place; /platform/support checks the viewer is a platform admin.
 */
export default function HelpTeamPage() {
  redirect("/platform/support" as Route);
}
