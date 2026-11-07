import { Bot, FileText, Lock } from "lucide-react";
import { fileSizeLabel } from "@/lib/support-shared";
import type { HelpdeskMessage } from "@/lib/helpdesk";

const BANGKOK = "Asia/Bangkok";

function when(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: BANGKOK, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * The whole conversation as the team sees it: the customer on the left, the assistant on the left in its own tint
 * (labelled "Assistant"), the team on the right, and internal notes shaded across the width so nobody mistakes one
 * for something the customer saw.
 */
export function HelpdeskTranscript({ messages }: { messages: HelpdeskMessage[] }) {
  if (!messages.length) return <p className="font-medium text-[var(--muted)]">No messages yet.</p>;
  const earlierFrom = messages.find((message) => message.fromThread)?.fromThread || null;
  return (
    <ol className="space-y-3">
      {/* Pulled in from the chat just before an empty handover (lib/helpdesk.ts), so the team sees what was asked. */}
      {earlierFrom ? (
        <li className="text-center text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">
          From their chat just before ·{" "}
          <a className="normal-case tracking-normal text-[var(--primary)] hover:underline" href={`/platform/support/${earlierFrom}`}>
            open it
          </a>
        </li>
      ) : null}
      {messages.map((message, index) => {
        const handoff = Boolean(message.meta?.handoff);
        const articles: Array<{ slug: string; title: string }> = Array.isArray(message.meta?.articles) ? message.meta.articles : [];
        const action = message.meta?.action && typeof message.meta.action === "object" ? message.meta.action : null;
        const bubble =
          message.kind === "note"
            ? "w-full border border-dashed border-[var(--warning-line)] bg-[var(--warning-light)] text-[var(--foreground)]"
            : message.kind === "team"
              ? "bg-[var(--primary)] text-white"
              : message.kind === "assistant"
                ? "bg-[var(--info-light)] text-[var(--foreground)]"
                : "border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)]";
        const onRight = message.kind === "team" || message.kind === "note";
        const light = message.kind === "team";
        const firstOfThisChat = earlierFrom && !message.fromThread && messages[index - 1]?.fromThread;
        return (
          <li key={`${message.fromThread || ""}${message.id}`}>
            {firstOfThisChat ? <p className="mb-3 text-center text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">This conversation</p> : null}
            <div className={`flex ${onRight ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[78%] ${bubble}`}>
                <p className={`flex items-center gap-1.5 text-[13px] font-semibold ${light ? "text-white/80" : "text-[var(--muted)]"}`}>
                  {message.kind === "note" ? <Lock size={13} /> : message.kind === "assistant" ? <Bot size={13} /> : null}
                  {message.kind === "note" ? `Internal note · ${message.authorName}` : message.authorName} · {when(message.createdAt)}
                </p>
                {message.body ? <p className="mt-1 whitespace-pre-wrap break-words text-[16px] font-medium">{message.body}</p> : null}
                {articles.length ? (
                  <ul className="mt-2 space-y-1 text-[14px] font-semibold">
                    {articles.map((article) => (
                      <li key={article.slug}>
                        <a className="text-[var(--primary)] hover:underline" href={`/docs/${article.slug}`} rel="noreferrer" target="_blank">
                          {article.title || article.slug}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {action?.href ? (
                  <p className="mt-2 text-[14px] font-semibold text-[var(--foreground-secondary)]">
                    Suggested: {String(action.label || action.kind || "action")} ({String(action.href)})
                  </p>
                ) : null}
                {message.attachments.length ? (
                  <ul className="mt-2 grid gap-2">
                    {message.attachments.map((file) =>
                      file.type.startsWith("image/") && file.url ? (
                        <li key={file.path}>
                          <a href={file.url} rel="noreferrer" target="_blank">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt={file.name} className="max-h-56 rounded-xl object-cover" src={file.url} />
                          </a>
                        </li>
                      ) : (
                        <li key={file.path}>
                          <a
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[15px] font-semibold ${light ? "bg-white/15 text-white" : "bg-[var(--panel-secondary)] text-[var(--foreground)]"}`}
                            href={file.url || undefined}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <FileText className="shrink-0" size={18} />
                            <span className="min-w-0 truncate">{file.name}</span>
                            <span className={`ml-auto shrink-0 font-medium ${light ? "text-white/75" : "text-[var(--muted)]"}`}>{fileSizeLabel(file.size)}</span>
                          </a>
                        </li>
                      )
                    )}
                  </ul>
                ) : null}
              </div>
            </div>
            {/* The moment the conversation reached the team, marked in the flow like a divider. */}
            {handoff ? <p className="mt-3 text-center text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">Handed over to the team</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
