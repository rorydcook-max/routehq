import Link from "next/link";
import type { Route } from "next";
import { after } from "next/server";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { requirePlatformAdmin } from "@/lib/admin";
import { countOpenContentRequests, maybeAutoCollate } from "@/lib/content-requests";
import { countsFor, isQueueView, listQueueRows } from "@/lib/helpdesk";
import { AdminHeader } from "../admin-nav";
import { HelpdeskInbox } from "./inbox";

export const dynamic = "force-dynamic";

/**
 * The RoveHQ support helpdesk: chats the assistant handed over, Help-page conversations, and (read-only) what the
 * assistant is handling right now. Platform admins only. The list refreshes itself every 15 seconds.
 */
export default async function SupportInboxPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const me = await requirePlatformAdmin();
  const params = await searchParams;
  const view = isQueueView(params.view) ? params.view : "waiting";
  const search = String(params.q || "").slice(0, 80);
  const [userEmail, rows, counts, contentWaiting] = await Promise.all([getCurrentUserEmail(), listQueueRows(view, search, me.userId), countsFor(me.userId), countOpenContentRequests()]);
  // The help centre's content queue fills itself at most once a day, after a team member opens the helpdesk
  // (this used to happen on /help/team, which now redirects here).
  after(() => maybeAutoCollate());

  return (
    <AppShell userEmail={userEmail}>
      <AdminHeader active="/platform/support" subtitle="Chats handed over by the assistant and messages from the Help page. Replies reach the customer in RoveHQ." title="Support" />
      {/* What the assistant couldn't answer and the guides people asked for: still its own page, linked from here. */}
      <Link className="card pressable mb-4 flex items-center gap-3 px-4 py-3" href={"/help/team/content" as Route}>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold text-[var(--foreground)]">Content requests</span>
          <span className="block truncate font-medium text-[var(--muted)]">Questions the help centre couldn&apos;t answer, and articles people asked for.</span>
        </span>
        {contentWaiting ? <span className="shrink-0 rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[13px] font-bold text-white">{contentWaiting} waiting</span> : null}
        <ChevronRight className="shrink-0 text-[var(--muted)]" size={18} />
      </Link>
      <HelpdeskInbox initialCounts={counts} initialRows={rows} search={search} view={view} />
    </AppShell>
  );
}
