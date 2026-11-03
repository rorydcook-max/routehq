"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { Bot, MessageCircle, Search } from "lucide-react";
import { listQueue } from "@/app/actions/helpdesk";
import { QUEUE_VIEWS, QUEUE_VIEW_LABEL, QUEUE_VIEW_NOTE, STATUS_LABEL, waitingLabel, type HelpdeskCounts, type QueueRow, type QueueView } from "@/lib/helpdesk-shared";

const POLL_MS = 15_000;
const BANGKOK = "Asia/Bangkok";

function when(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: BANGKOK, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function hrefFor(view: QueueView, search: string) {
  const params = new URLSearchParams();
  if (view !== "waiting") params.set("view", view);
  if (search) params.set("q", search);
  const query = params.toString();
  return `/platform/support${query ? `?${query}` : ""}`;
}

/**
 * The helpdesk queue. The first page comes from the server; after that it asks again every 15 seconds (only while the
 * tab is visible), so new hand-overs appear without anyone pressing refresh.
 */
export function HelpdeskInbox({ view, search, initialRows, initialCounts }: { view: QueueView; search: string; initialRows: QueueRow[]; initialCounts: HelpdeskCounts }) {
  const [rows, setRows] = useState(initialRows);
  const [counts, setCounts] = useState(initialCounts);
  const [now, setNow] = useState(() => Date.now());

  // A new tab or search arrives as new server data: start again from it.
  useEffect(() => {
    setRows(initialRows);
    setCounts(initialCounts);
  }, [initialRows, initialCounts]);

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      setNow(Date.now());
      if (document.visibilityState !== "visible") return;
      const result = await listQueue({ view, search }).catch(() => null);
      if (!stopped && result?.ok) {
        setRows(result.rows);
        setCounts(result.counts);
      }
    };
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [view, search]);

  const tabCount: Partial<Record<QueueView, number>> = { waiting: counts.waiting, mine: counts.mine, unassigned: counts.unassigned, ai: counts.ai };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter conversations" className="chip-row flex flex-wrap gap-2">
          {QUEUE_VIEWS.map((key) => (
            <Link
              aria-current={key === view ? "page" : undefined}
              className={`pressable inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-bold ${key === view ? "bg-[var(--foreground)] text-white" : "bg-white text-[var(--foreground-secondary)] shadow-[0_0_0_1px_var(--border)] hover:text-[var(--foreground)]"}`}
              href={hrefFor(key, search) as Route}
              key={key}
            >
              {QUEUE_VIEW_LABEL[key]}
              {tabCount[key] ? <span className={`num rounded-full px-1.5 text-[12px] ${key === view ? "bg-white/20" : "bg-[var(--panel-secondary)]"}`}>{tabCount[key]}</span> : null}
            </Link>
          ))}
        </nav>
        {/* A plain GET form: the search lives in the address, so a filtered queue can be bookmarked or shared. */}
        <form action="/platform/support" className="flex w-full items-center gap-2 lg:w-auto" method="get" role="search">
          {view !== "waiting" ? <input name="view" type="hidden" value={view} /> : null}
          <label className="relative block min-w-0 flex-1 lg:w-72">
            <span className="sr-only">Search conversations</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <input className="block w-full pl-9" defaultValue={search} name="q" placeholder="Business, email or subject" type="search" />
          </label>
          <button className="secondary-action pressable min-h-10 px-4 text-[14px]" type="submit">
            Search
          </button>
        </form>
      </div>
      <p className="text-[14px] font-medium text-[var(--foreground-secondary)]">
        {QUEUE_VIEW_NOTE[view]}
        {search ? (
          <>
            {" "}
            Showing matches for &ldquo;{search}&rdquo;.{" "}
            <Link className="font-bold text-[var(--primary)] hover:underline" href={hrefFor(view, "") as Route}>
              Clear
            </Link>
          </>
        ) : null}
      </p>

      <section className="card overflow-hidden p-0">
        {/* Column headings on wide screens; on a phone each conversation is a stacked card. */}
        <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,2.2fr)_5rem_6.5rem_8rem] gap-4 border-b border-[var(--border)] px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.04em] text-[var(--muted)] lg:grid">
          <span>Who</span>
          <span>Conversation</span>
          <span>Channel</span>
          <span>Waiting</span>
          <span>Assignee</span>
        </div>
        {rows.length === 0 ? (
          <p className="p-5 font-medium text-[var(--muted)]">{search ? "Nothing matches that search." : view === "waiting" ? "Nobody is waiting. Nice." : "Nothing here."}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((row) => {
              const who = row.organizationId ? row.businessName || "Business" : "Website visitor";
              const whoNote = row.organizationId ? null : row.visitorEmail || row.visitorName || "No email left";
              const waiting = waitingLabel(row.waitingSince, now);
              return (
                <li key={row.id}>
                  <Link className="grid gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-[var(--panel-secondary)] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2.2fr)_5rem_6.5rem_8rem] lg:items-center" href={`/platform/support/${row.id}` as Route}>
                    <span className="flex min-w-0 items-center gap-2">
                      {/* Unread: something new from the customer since the team last opened it. */}
                      <span aria-label={row.unread ? "Unread" : undefined} className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.unread ? "bg-[var(--primary)]" : "bg-transparent"}`} />
                      <span className="min-w-0">
                        <span className={`block truncate ${row.unread ? "font-extrabold" : "font-bold"} text-[var(--foreground)]`}>{who}</span>
                        {whoNote ? <span className="block truncate text-[13px] font-medium text-[var(--muted)]">{whoNote}</span> : null}
                      </span>
                    </span>
                    <span className="min-w-0 pl-[18px] lg:pl-0">
                      <span className="flex min-w-0 items-center gap-2">
                        {row.priority === "high" ? <span className="shrink-0 rounded-full bg-[var(--danger-light)] px-2 py-0.5 text-[12px] font-bold text-[var(--danger)]">High</span> : null}
                        <span className="truncate font-semibold text-[var(--foreground)]">{row.subject}</span>
                        {view !== "waiting" && view !== "answered" ? <span className="shrink-0 text-[12px] font-bold text-[var(--muted)]">{row.mode === "ai" ? "Assistant" : STATUS_LABEL[row.status]}</span> : null}
                      </span>
                      <span className="block truncate text-[14px] font-medium text-[var(--muted)]">
                        {row.previewFrom === "assistant" ? "Assistant: " : row.previewFrom === "team" ? "RoveHQ: " : row.previewFrom === "note" ? "Note: " : ""}
                        {row.preview || "—"}
                      </span>
                      {row.tags.length ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {row.tags.map((tag) => (
                            <span className="rounded-full bg-[var(--panel-tertiary)] px-2 py-0.5 text-[12px] font-semibold text-[var(--foreground-secondary)]" key={tag}>
                              {tag}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1.5 pl-[18px] text-[14px] font-semibold text-[var(--foreground-secondary)] lg:pl-0">
                      {row.channel === "chat" ? <Bot size={15} /> : <MessageCircle size={15} />}
                      {row.channel === "chat" ? "Chat" : "Help"}
                    </span>
                    <span className={`pl-[18px] text-[14px] font-bold lg:pl-0 ${row.waitingSince && now - Date.parse(row.waitingSince) > 2 * 3_600_000 ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`} suppressHydrationWarning title={when(row.lastMessageAt)}>
                      {waiting || <span className="font-medium text-[var(--muted)]">{when(row.lastMessageAt)}</span>}
                    </span>
                    <span className="truncate pl-[18px] text-[14px] font-medium text-[var(--foreground-secondary)] lg:pl-0">{row.assigneeName || <span className="text-[var(--muted)]">Unassigned</span>}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
