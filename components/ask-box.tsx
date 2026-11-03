"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, BookOpen, Check, Copy, LifeBuoy, Search, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { askRouteHq, confirmAssistantAction } from "@/app/actions/ask";
import { sendToTeam } from "@/app/actions/support-assistant";
import type { ProposedAction } from "@/lib/assistant-actions";

// Starter questions, worded in the reader's language (askExample1…4 in the locale files). Two more show what it can
// change, and the last two are about using the app itself (answered from the help centre).
const EXAMPLE_KEYS = ["askExample1", "askExample2", "askExample3", "askExample4", "askExample5", "askExample6", "askExample7", "askExample8"];
// Teammates can't see the figures, so they only get the how-to starters.
const SUPPORT_EXAMPLE_KEYS = ["askExample7", "askExample8"];

type Turn = {
  question: string;
  answer?: string;
  links?: Array<{ label: string; href: string }>;
  error?: string;
  /** Answered from the help centre rather than the records: shows articles and a way to reach the team. */
  support?: boolean;
  articles?: Array<{ slug: string; title: string; href: string }>;
  handoff?: boolean;
  /** The page the question was asked from, kept so the team knows where they were. */
  pathname?: string;
  sending?: boolean;
  sent?: { id: string };
  sendError?: string;
  /** A change waiting for the owner's go-ahead. */
  proposal?: ProposedAction;
  proposalState?: "waiting" | "saving" | "done" | "cancelled";
  result?: { message: string; link?: { label: string; href: string }; copy?: string };
  resultError?: string;
};

/**
 * "Ask RoveHQ": a question box available on every page. It answers from the
 * business's own records, and can make a few changes when asked. Every change
 * is shown first and saved only when the owner presses Confirm. "How do I…"
 * questions are answered from the help centre instead, for owners and
 * teammates alike, with a way to pass the question on to the RoveHQ team.
 *
 * `support` is set for teammates: they see the how-to intro and starters only.
 * The "button" variant is the sidebar look without the Ctrl+K shortcut, for the
 * Help page.
 */
export function AskBox({ variant, support = false }: { variant: "sidebar" | "icon" | "button"; support?: boolean }) {
  const t = useTranslations("shell");
  const EXAMPLES = (support ? SUPPORT_EXAMPLE_KEYS : EXAMPLE_KEYS).map((key) => t(key));
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
    // The page they're on, so a how-to question about "this screen" finds the right article.
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    setTurns((current) => [...current, { question: asked, pathname }]);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof askRouteHq>>;
      try {
        result = await askRouteHq(asked, history, pathname);
      } catch {
        result = { ok: false, error: t("askFailed") };
      }
      setTurns((current) => {
        const next = [...current];
        next[next.length - 1] = !result.ok
          ? { question: asked, pathname, error: result.error }
          : "links" in result
            ? { question: asked, pathname, answer: result.answer, links: result.links, proposal: result.proposal, proposalState: result.proposal ? "waiting" : undefined }
            : { question: asked, pathname, answer: result.answer, support: true, articles: result.articles, handoff: result.handoff };
        return next;
      });
    });
  }

  function patch(index: number, changes: Partial<Turn>) {
    setTurns((current) => current.map((turn, position) => (position === index ? { ...turn, ...changes } : turn)));
  }

  /** Passes a how-to question (and the conversation before it) to the RoveHQ team as a Help conversation. */
  function send(index: number) {
    const turn = turns[index];
    if (!turn || turn.sending || turn.sent) return;
    patch(index, { sending: true, sendError: undefined });
    const history = turns.slice(0, index).flatMap((earlier) => [
      { role: "user" as const, content: earlier.question },
      { role: "assistant" as const, content: earlier.answer || earlier.error || "…" }
    ]);
    startTransition(async () => {
      let outcome: Awaited<ReturnType<typeof sendToTeam>>;
      try {
        outcome = await sendToTeam({ question: turn.question, answer: turn.answer, history, pathname: turn.pathname });
      } catch {
        outcome = { ok: false, error: t("askFailed") };
      }
      if (outcome.ok) patch(index, { sending: false, sent: { id: outcome.id } });
      else patch(index, { sending: false, sendError: outcome.error });
    });
  }

  /** The articles write button names in **bold**; the answer keeps them that way. */
  function emphasised(text: string) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (part.startsWith("**") && part.endsWith("**") ? <strong className="font-semibold text-[var(--foreground)]" key={index}>{part.slice(2, -2)}</strong> : part));
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
        outcome = { ok: false, error: t("askNotSaved") };
      }
      if (outcome.ok) patch(index, { proposalState: "done", result: { message: outcome.message, link: outcome.link, copy: outcome.copy } });
      else patch(index, { proposalState: "waiting", resultError: outcome.error });
    });
  }

  return (
    <>
      {variant === "sidebar" || variant === "button" ? (
        <button
          className="flex h-10 w-full items-center gap-2 rounded-xl border border-[var(--sidebar-border)] bg-white px-3 text-left text-[14px] text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)]"
          title={variant === "sidebar" ? "Ctrl K" : undefined}
          onClick={() => setOpen(true)}
          type="button"
        >
          <Search size={16} />
          <span className="min-w-0 flex-1 truncate font-medium">{support ? t("askHowTo") : t("askAnything")}</span>
        </button>
      ) : (
        <button aria-label={t("askTitle")} className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground-secondary)]" onClick={() => setOpen(true)} type="button">
          <Search size={17} />
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[var(--foreground)]/40 p-0 sm:items-start sm:p-6 sm:pt-[10vh]" onClick={() => setOpen(false)} role="presentation">
          <div aria-label={t("askTitle")} aria-modal="true" className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
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
                placeholder={t("askPlaceholder")}
                ref={input}
                style={{ boxShadow: "none", border: "none" }}
                value={question}
              />
              <button className="primary-action pressable min-h-9 px-3 text-[13px] disabled:opacity-60" disabled={isPending || !question.trim()} type="submit">
                {t("ask")}
              </button>
              <button aria-label={t("close")} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--panel-tertiary)]" onClick={() => setOpen(false)} type="button">
                <X size={18} />
              </button>
            </form>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {turns.length === 0 ? (
                <div>
                  <p className="text-[13px] text-[var(--muted)]">{support ? t("askIntroSupport") : t("askIntro")}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {EXAMPLES.map((example) => (
                      <button className="pressable rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] px-3 py-2.5 text-left text-[13px] font-medium text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]" key={example} onClick={() => ask(example)} type="button">
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
                          <p className="mt-2 whitespace-pre-line [overflow-wrap:anywhere] text-[14px] leading-relaxed text-[var(--foreground-secondary)]">{emphasised(turn.answer)}</p>
                          {turn.proposal ? (
                            <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
                              <p className="border-b border-[var(--border)] bg-[var(--panel-secondary)] px-3 py-2 text-[13px] font-semibold text-[var(--foreground)]">{turn.proposal.title}</p>
                              <dl className="divide-y divide-[var(--border)]">
                                {turn.proposal.rows.map((row) => (
                                  <div className="flex gap-3 px-3 py-2 text-[13px]" key={row.label}>
                                    <dt className="w-28 flex-shrink-0 text-[var(--muted)]">{row.label}</dt>
                                    <dd className="min-w-0 flex-1 font-medium text-[var(--foreground)]">{row.value}</dd>
                                  </div>
                                ))}
                              </dl>
                              <div className="border-t border-[var(--border)] bg-[var(--panel-secondary)] px-3 py-2.5">
                                {turn.proposalState === "done" && turn.result ? (
                                  <div>
                                    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--success)]">
                                      <Check size={15} /> {turn.result.message}
                                    </p>
                                    {turn.result.copy ? (
                                      <button
                                        className="mt-2 flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-left font-mono text-[12px] text-[var(--foreground)]"
                                        onClick={() => navigator.clipboard.writeText(turn.result?.copy || "").catch(() => undefined)}
                                        title={t("copy")}
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
                                  <p className="text-[13px] text-[var(--muted)]">{t("askCancelled")}</p>
                                ) : (
                                  <div>
                                    {turn.resultError ? <p className="mb-2 text-[13px] font-medium text-[var(--danger)]">{turn.resultError}</p> : null}
                                    <div className="flex items-center gap-2">
                                      <button className="primary-action pressable min-h-9 px-4 text-[13px] disabled:opacity-60" disabled={turn.proposalState === "saving"} onClick={() => confirm(index)} type="button">
                                        {turn.proposalState === "saving" ? t("saving") : t("confirm")}
                                      </button>
                                      <button className="secondary-action pressable min-h-9 px-3 text-[13px]" disabled={turn.proposalState === "saving"} onClick={() => patch(index, { proposalState: "cancelled" })} type="button">
                                        {t("cancel")}
                                      </button>
                                      <span className="text-[12px] text-[var(--muted)]">{t("askWrong")}</span>
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
                          {turn.support ? (
                            <div className="mt-3">
                              {turn.articles && turn.articles.length > 0 ? (
                                // Help articles open in a new tab so the question box, and the page under it, stay put.
                                <div className="flex flex-wrap gap-2">
                                  {turn.articles.map((article) => (
                                    <a className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--primary)] hover:border-[var(--primary)]" href={article.href} key={article.slug} rel="noreferrer" target="_blank">
                                      <BookOpen size={13} />
                                      {article.title}
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                              {turn.sent ? (
                                <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-[var(--success)]">
                                  <Check size={15} /> {t("askSent")}
                                  <Link className="inline-flex items-center gap-1 font-semibold text-[var(--primary)]" href={`/help/${turn.sent.id}` as Route} onClick={() => setOpen(false)}>
                                    {t("askOpenConversation")}
                                    <ArrowRight size={13} />
                                  </Link>
                                </p>
                              ) : (
                                <div className={turn.handoff ? "mt-3" : "mt-2"}>
                                  {turn.sendError ? <p className="mb-1.5 text-[13px] font-medium text-[var(--danger)]">{turn.sendError}</p> : null}
                                  <button
                                    className={turn.handoff ? "secondary-action pressable min-h-9 px-3 text-[13px] disabled:opacity-60" : "inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--primary)] disabled:opacity-60"}
                                    disabled={turn.sending}
                                    onClick={() => send(index)}
                                    type="button"
                                  >
                                    <LifeBuoy size={turn.handoff ? 15 : 13} />
                                    {turn.sending ? t("askSending") : t("askSendToTeam")}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className="mt-2 animate-pulse text-[13px] text-[var(--muted)]">{t("askLooking")}</p>
                      )}
                    </div>
                  ))}
                  <div ref={end} />
                </div>
              )}
            </div>
            <p className="border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--muted)]">{support || turns[turns.length - 1]?.support ? t("askFooterSupport") : t("askFooter")}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
