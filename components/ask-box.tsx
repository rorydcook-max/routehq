"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Check, Copy, Search, Sparkles, X } from "lucide-react";
import { askRouteHq, confirmAssistantAction } from "@/app/actions/ask";
import type { ProposedAction } from "@/lib/assistant-actions";

const EXAMPLES = [
  "Which of my vehicles is making the least money?",
  "What income can I expect over the next 6 months?",
  "Which tax, insurance or service is due next?",
  "Who owes me money right now?",
  "I paid 5,000 baht for a new windscreen on the Ford Ecosport",
  "Create a booking link for the Mazda 2 from 14 Oct, 11,000 a month, 5,000 deposit"
];

type Turn = {
  question: string;
  answer?: string;
  links?: Array<{ label: string; href: string }>;
  error?: string;
  /** A change waiting for the owner's go-ahead. */
  proposal?: ProposedAction;
  proposalState?: "waiting" | "saving" | "done" | "cancelled";
  result?: { message: string; link?: { label: string; href: string }; copy?: string };
  resultError?: string;
};

/**
 * "Ask RouteHQ": a question box available on every page. It answers from the
 * business's own records, and can make a few changes when asked. Every change
 * is shown first and saved only when the owner presses Confirm.
 */
export function AskBox({ variant }: { variant: "sidebar" | "icon" }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isPending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);

  // Ctrl/⌘ + K opens it from anywhere; Escape closes it.
  useEffect(() => {
    if (variant !== "sidebar") return;
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [variant]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [turns, isPending]);

  function ask(text: string) {
    const asked = text.trim();
    if (!asked || isPending) return;
    setQuestion("");
    // Earlier turns go along so a follow-up ("the red one", "make it 12,000") makes sense.
    const history = turns.flatMap((turn) => {
      const reply = turn.result?.message || turn.answer || turn.error || "";
      const proposed = turn.proposal ? ` Proposed: ${turn.proposal.title} (${turn.proposal.rows.map((row) => `${row.label}: ${row.value}`).join("; ")}). ${turn.proposalState === "done" ? "Confirmed and saved." : turn.proposalState === "cancelled" ? "Cancelled by the owner." : "Not confirmed yet."}` : "";
      return [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: `${reply}${proposed}`.trim() || "…" }
      ];
    });
    setTurns((current) => [...current, { question: asked }]);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof askRouteHq>>;
      try {
        result = await askRouteHq(asked, history);
      } catch {
        result = { ok: false, error: "Something went wrong. Try again in a moment." };
      }
      setTurns((current) => {
        const next = [...current];
        next[next.length - 1] = result.ok ? { question: asked, answer: result.answer, links: result.links, proposal: result.proposal, proposalState: result.proposal ? "waiting" : undefined } : { question: asked, error: result.error };
        return next;
      });
    });
  }

  function patch(index: number, changes: Partial<Turn>) {
    setTurns((current) => current.map((turn, position) => (position === index ? { ...turn, ...changes } : turn)));
  }

  function confirm(index: number) {
    const proposal = turns[index]?.proposal;
    if (!proposal) return;
    patch(index, { proposalState: "saving", resultError: undefined });
    startTransition(async () => {
      let outcome: Awaited<ReturnType<typeof confirmAssistantAction>>;
      try {
        outcome = await confirmAssistantAction(proposal.kind, proposal.args);
      } catch {
        outcome = { ok: false, error: "That couldn't be saved. Nothing was changed." };
      }
      if (outcome.ok) patch(index, { proposalState: "done", result: { message: outcome.message, link: outcome.link, copy: outcome.copy } });
      else patch(index, { proposalState: "waiting", resultError: outcome.error });
    });
  }

  return (
    <>
      {variant === "sidebar" ? (
        <button
          className="mb-3 flex w-full items-center gap-2 rounded-xl border border-[var(--sidebar-border)] bg-white px-3 py-2 text-left text-[13px] text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)]"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Search size={15} />
          <span className="flex-1">Ask anything…</span>
          <kbd className="rounded border border-[var(--border)] px-1 text-[10px] font-semibold text-[var(--muted)]">Ctrl K</kbd>
        </button>
      ) : (
        <button aria-label="Ask RouteHQ" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground-secondary)]" onClick={() => setOpen(true)} type="button">
          <Search size={17} />
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#1c1b18]/40 p-0 sm:items-start sm:p-6 sm:pt-[10vh]" onClick={() => setOpen(false)} role="presentation">
          <div aria-label="Ask RouteHQ" aria-modal="true" className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
            <form
              className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3"
              onSubmit={(event) => {
                event.preventDefault();
                ask(question);
              }}
            >
              <Sparkles className="flex-shrink-0 text-[var(--primary)]" size={18} />
              <input
                className="h-10 min-w-0 flex-1 border-0 bg-transparent px-0 text-[15px] shadow-none outline-none focus:ring-0"
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a question, or tell me what to add or change…"
                ref={input}
                style={{ boxShadow: "none", border: "none" }}
                value={question}
              />
              <button className="primary-action pressable min-h-9 px-3 text-[13px] disabled:opacity-60" disabled={isPending || !question.trim()} type="submit">
                Ask
              </button>
              <button aria-label="Close" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[#f1efeb]" onClick={() => setOpen(false)} type="button">
                <X size={18} />
              </button>
            </form>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {turns.length === 0 ? (
                <div>
                  <p className="text-[13px] text-[var(--muted)]">Answers come from your own records. Try one of these:</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {EXAMPLES.map((example) => (
                      <button className="pressable rounded-xl border border-[var(--border)] bg-[#fbfaf8] px-3 py-2.5 text-left text-[13px] font-medium text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]" key={example} onClick={() => ask(example)} type="button">
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {turns.map((turn, index) => (
                    <div key={index}>
                      <p className="text-[14px] font-semibold text-[var(--foreground)]">{turn.question}</p>
                      {turn.error ? (
                        <p className="mt-2 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-[13px] text-[var(--danger)]">{turn.error}</p>
                      ) : turn.answer ? (
                        <>
                          <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-[var(--foreground-secondary)]">{turn.answer}</p>
                          {turn.proposal ? (
                            <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
                              <p className="border-b border-[var(--border)] bg-[#fbfaf8] px-3 py-2 text-[13px] font-semibold text-[var(--foreground)]">{turn.proposal.title}</p>
                              <dl className="divide-y divide-[var(--border)]">
                                {turn.proposal.rows.map((row) => (
                                  <div className="flex gap-3 px-3 py-2 text-[13px]" key={row.label}>
                                    <dt className="w-28 flex-shrink-0 text-[var(--muted)]">{row.label}</dt>
                                    <dd className="min-w-0 flex-1 font-medium text-[var(--foreground)]">{row.value}</dd>
                                  </div>
                                ))}
                              </dl>
                              <div className="border-t border-[var(--border)] bg-[#fbfaf8] px-3 py-2.5">
                                {turn.proposalState === "done" && turn.result ? (
                                  <div>
                                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--success)]">
                                      <Check size={15} /> {turn.result.message}
                                    </p>
                                    {turn.result.copy ? (
                                      <button
                                        className="mt-2 flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-left font-mono text-[12px] text-[var(--foreground)]"
                                        onClick={() => navigator.clipboard.writeText(turn.result?.copy || "").catch(() => undefined)}
                                        title="Copy"
                                        type="button"
                                      >
                                        <span className="min-w-0 flex-1 truncate">{turn.result.copy}</span>
                                        <Copy className="flex-shrink-0 text-[var(--muted)]" size={14} />
                                      </button>
                                    ) : null}
                                    {turn.result.link ? (
                                      <Link className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--primary)]" href={turn.result.link.href as Route} onClick={() => setOpen(false)}>
                                        {turn.result.link.label}
                                        <ArrowRight size={13} />
                                      </Link>
                                    ) : null}
                                  </div>
                                ) : turn.proposalState === "cancelled" ? (
                                  <p className="text-[13px] text-[var(--muted)]">Cancelled. Nothing was saved.</p>
                                ) : (
                                  <div>
                                    {turn.resultError ? <p className="mb-2 text-[13px] font-medium text-[var(--danger)]">{turn.resultError}</p> : null}
                                    <div className="flex items-center gap-2">
                                      <button className="primary-action pressable min-h-9 px-4 text-[13px] disabled:opacity-60" disabled={turn.proposalState === "saving"} onClick={() => confirm(index)} type="button">
                                        {turn.proposalState === "saving" ? "Saving…" : "Confirm"}
                                      </button>
                                      <button className="secondary-action pressable min-h-9 px-3 text-[13px]" disabled={turn.proposalState === "saving"} onClick={() => patch(index, { proposalState: "cancelled" })} type="button">
                                        Cancel
                                      </button>
                                      <span className="text-[12px] text-[var(--muted)]">Wrong? Tell me what to change.</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                          {turn.links && turn.links.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {turn.links.map((link) => (
                                <Link className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--primary)] hover:border-[var(--primary)]" href={link.href as Route} key={link.href} onClick={() => setOpen(false)}>
                                  {link.label}
                                  <ArrowRight size={13} />
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="mt-2 animate-pulse text-[13px] text-[var(--muted)]">Looking through your records…</p>
                      )}
                    </div>
                  ))}
                  <div ref={end} />
                </div>
              )}
            </div>
            <p className="border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--muted)]">Written by AI from your records. Nothing is changed until you press Confirm.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
