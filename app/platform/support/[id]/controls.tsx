"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Hand, X } from "lucide-react";
import { assign, markUnread, setPriority, setStatus, setTags, takeOver } from "@/app/actions/helpdesk";

type Result = { ok: true } | { ok: false; error: string };

/** Runs a helpdesk action, shows its error if it had one, and reloads the page's data either way (someone else may have changed it). */
function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (run: () => Promise<Result>) =>
    start(async () => {
      setError(null);
      const result = await run().catch(() => ({ ok: false as const, error: "That didn't work. Please try again." }));
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  return { pending, error, act };
}

/**
 * New messages arrive without a refresh: the page's server data is fetched again every 15 seconds while the tab is
 * visible. Whatever is typed in the reply box is kept (it lives in the browser, not in the server data).
 */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);
  return null;
}

/** "Take over from the assistant": the conversation moves to the team, assigned to whoever pressed it. */
export function TakeOverButton({ threadId }: { threadId: string }) {
  const { pending, error, act } = useAct();
  return (
    <div>
      <button className="primary-action pressable disabled:opacity-60" disabled={pending} onClick={() => act(() => takeOver(threadId))} type="button">
        <Hand size={17} />
        {pending ? "Taking over…" : "Take over from the assistant"}
      </button>
      {error ? <p className="mt-2 text-[14px] font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

const chip = (active: boolean) =>
  `pressable inline-flex min-h-9 items-center rounded-full px-3.5 text-[14px] font-bold ${active ? "bg-[var(--foreground)] text-white" : "bg-white text-[var(--foreground-secondary)] shadow-[0_0_0_1px_var(--border)] hover:text-[var(--foreground)]"}`;

/** Assignee, priority, status and tags: the side panel's controls. */
export function ConversationControls({
  threadId,
  meId,
  mode,
  status,
  priority,
  tags,
  assignedTo,
  assigneeName
}: {
  threadId: string;
  meId: string;
  mode: "ai" | "human";
  status: "open" | "answered" | "closed";
  priority: "normal" | "high";
  tags: string[];
  assignedTo: string | null;
  assigneeName: string | null;
}) {
  const router = useRouter();
  const { pending, error, act } = useAct();
  const [tagList, setTagList] = useState(tags);
  const [draft, setDraft] = useState("");
  useEffect(() => setTagList(tags), [tags]);

  function saveTags(next: string[]) {
    setTagList(next);
    act(async () => {
      const result = await setTags(threadId, next);
      if (result.ok) setTagList(result.tags);
      return result;
    });
  }

  function addTag() {
    const value = draft.trim().toLowerCase();
    setDraft("");
    if (!value || tagList.includes(value)) return;
    saveTags([...tagList, value]);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">Assignee</p>
        <p className="mt-1 font-semibold text-[var(--foreground)]">{assignedTo ? (assignedTo === meId ? "You" : assigneeName) : "Nobody yet"}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {assignedTo !== meId ? (
            <button className={chip(false)} disabled={pending} onClick={() => act(() => assign(threadId, meId))} type="button">
              Assign to me
            </button>
          ) : null}
          {assignedTo ? (
            <button className={chip(false)} disabled={pending} onClick={() => act(() => assign(threadId, null))} type="button">
              Unassign
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">Priority</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["normal", "high"] as const).map((value) => (
            <button aria-pressed={priority === value} className={chip(priority === value)} disabled={pending || priority === value} key={value} onClick={() => act(() => setPriority(threadId, value))} type="button">
              {value === "high" ? "High" : "Normal"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">Status</p>
        {/* Open = waiting for us; Answered = waiting on the customer; Close when it's sorted, Reopen if it isn't. */}
        <div className="mt-2 flex flex-wrap gap-2">
          {status === "closed" ? (
            <button className={chip(false)} disabled={pending} onClick={() => act(() => setStatus(threadId, "open"))} type="button">
              Reopen
            </button>
          ) : (
            <>
              <button aria-pressed={status === "open"} className={chip(status === "open")} disabled={pending || status === "open"} onClick={() => act(() => setStatus(threadId, "open"))} type="button">
                Open
              </button>
              <button aria-pressed={status === "answered"} className={chip(status === "answered")} disabled={pending || status === "answered"} onClick={() => act(() => setStatus(threadId, "answered"))} type="button">
                Answered
              </button>
              <button className={chip(false)} disabled={pending} onClick={() => act(() => setStatus(threadId, "closed"))} type="button">
                Close
              </button>
            </>
          )}
          {mode === "human" && status !== "closed" ? (
            // Back to the queue with the dot on: staying here would mark it read again on the next refresh.
            <button
              className={chip(false)}
              disabled={pending}
              onClick={() =>
                act(async () => {
                  const result = await markUnread(threadId);
                  if (result.ok) router.push("/platform/support" as Route);
                  return result;
                })
              }
              type="button"
            >
              Mark unread
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">Tags</p>
        {tagList.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {tagList.map((tag) => (
              <li className="flex items-center gap-1 rounded-full bg-[var(--panel-tertiary)] py-0.5 pl-2.5 pr-1 text-[13px] font-semibold text-[var(--foreground-secondary)]" key={tag}>
                {tag}
                <button aria-label={`Remove tag ${tag}`} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white" disabled={pending} onClick={() => saveTags(tagList.filter((item) => item !== tag))} type="button">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addTag();
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Add a tag</span>
            <input className="block w-full" maxLength={30} onChange={(event) => setDraft(event.target.value)} placeholder="Add a tag, e.g. billing" value={draft} />
          </label>
          <button className="secondary-action pressable min-h-10 px-3 text-[14px]" disabled={pending || !draft.trim()} type="submit">
            Add
          </button>
        </form>
      </div>
      {error ? <p className="text-[14px] font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
