"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, ArrowLeft, Check, RotateCcw, Send, Sparkles } from "lucide-react";
import { linkConversationCustomer, markConversationRead, sendInboxMessage, setConversationStatus, suggestInboxReply } from "@/app/actions/inbox";
import type { InboxConversation, InboxMessage } from "@/lib/inbox/store";
import { intlLocale, shortDate as dateInWords } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;

const PROVIDER: Record<string, { label: string; className: string }> = {
  line: { label: "LINE", className: "bg-[#e6f6ea] text-[#12813a]" },
  telegram: { label: "Telegram", className: "bg-[#e7f1fb] text-[#1c6fb5]" },
  whatsapp: { label: "WhatsApp", className: "bg-[#e6f6ea] text-[#12813a]" },
  messenger: { label: "Messenger", className: "bg-[#eef0fd] text-[#4252d6]" },
  instagram: { label: "Instagram", className: "bg-[#fbeaf3] text-[#b02a73]" }
};

function ProviderTag({ provider }: { provider: string }) {
  const tag = PROVIDER[provider] || { label: provider, className: "bg-[#f1efeb] text-[#6b675f]" };
  return <span className={`inline-flex flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tag.className}`}>{tag.label}</span>;
}

/** Why a message did not go, in words that say what to do about it. */
function plainSendError(error: string | null | undefined, provider: string | null | undefined, say: Say) {
  const app = provider === "line" ? "LINE" : provider === "telegram" ? "Telegram" : null;
  const text = String(error || "").toLowerCase();
  if (/auth|token|unauthor|401|403|credential/.test(text)) return say("err_auth", { app: app || say("chatApp") });
  if (/block|not found|404|friend|deactivat/.test(text)) return say("err_blocked");
  if (/limit|quota|429/.test(text)) return say("err_limit", { app: app || say("chatAppCap") });
  return say("err_retry");
}

function initials(name: string | null) {
  const parts = String(name || "Customer").trim().split(/\s+/);
  return (parts[0]?.[0] || "?").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
}

/** "14:05" today, "Yesterday", or "28 Sep" for older. */
function when(iso: string | null, say: Say, locale: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return say("yesterday");
  return date.toLocaleDateString(intlLocale(locale), { day: "numeric", month: "short" });
}

function dayLabel(iso: string, say: Say, locale: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return say("today");
  return date.toLocaleDateString(intlLocale(locale), { weekday: "short", day: "numeric", month: "short" });
}

function shortDate(value: string | null, say: Say, locale: string) {
  if (!value) return say("openEnded");
  return dateInWords(value.slice(0, 10), locale);
}

export function InboxView({
  bookings,
  conversations,
  customers,
  filter,
  messages,
  selected
}: {
  bookings: any[];
  conversations: InboxConversation[];
  customers: Array<{ id: string; full_name: string | null; phone: string | null }>;
  filter: "open" | "closed";
  messages: InboxMessage[];
  selected: InboxConversation | null;
}) {
  const router = useRouter();
  const t = useTranslations("inbox");
  const say = t as unknown as Say;
  const locale = useLocale();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const [isSuggesting, startSuggesting] = useTransition();
  const [, startQuiet] = useTransition();
  const threadEnd = useRef<HTMLDivElement>(null);
  // A chat linked to a customer shows that customer's name, even when the chat app gave us none.
  const nameOf = (conversation: InboxConversation) =>
    conversation.display_name || customers.find((entry) => entry.id === conversation.customer_id)?.full_name || say("customer");

  // New messages arrive without a reload: check every few seconds while the tab is in view.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [router]);

  // Opening a chat marks it read and starts with an empty reply box.
  useEffect(() => {
    setDraft("");
    setError(null);
    if (selected && selected.unread_count > 0) {
      startQuiet(async () => {
        await markConversationRead(selected.id);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "end" });
  }, [selected?.id, messages.length]);

  function send() {
    if (!selected || !draft.trim()) return;
    setError(null);
    startSending(async () => {
      const result = await sendInboxMessage(selected.id, draft);
      if (result.ok) setDraft("");
      else setError(say("notSent", { reason: plainSendError(result.error, selected.provider, say) }));
      router.refresh();
    });
  }

  function suggest() {
    if (!selected) return;
    setError(null);
    startSuggesting(async () => {
      const result = await suggestInboxReply(selected.id);
      if (result.ok) setDraft(result.draft);
      else setError(result.error);
    });
  }

  const href = (id?: string | null, show: string = filter) => `/inbox?show=${show}${id ? `&c=${id}` : ""}` as Route;
  const customer = selected?.customer_id ? customers.find((entry) => entry.id === selected.customer_id) : null;
  const lastInbound = [...messages].reverse().find((message) => message.direction === "in");

  let previousDay = "";

  return (
    <div className="grid overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-sm)] lg:h-[calc(100vh-150px)] lg:min-h-[480px] lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* Conversation list */}
      <aside className={`min-h-0 flex-col border-[var(--border)] lg:flex lg:border-r ${selected ? "hidden" : "flex"}`}>
        <div className="flex gap-0.5 border-b border-[var(--border)] p-2">
          {(["open", "closed"] as const).map((entry) => (
            <Link
              className={`flex-1 rounded-[8px] px-3 py-1.5 text-center text-[13px] font-semibold ${filter === entry ? "bg-[var(--primary-light)] text-[var(--primary)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}
              href={href(null, entry)}
              key={entry}
            >
              {entry === "open" ? say("tabOpen") : say("tabDone")}
            </Link>
          ))}
        </div>
        {conversations.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--muted)]">{filter === "open" ? say("noOpen") : say("noDone")}</p>
        ) : (
          <ul className="min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto">
            {conversations.map((conversation) => {
              const active = selected?.id === conversation.id;
              const unread = conversation.unread_count > 0 && !active;
              return (
                <li key={conversation.id}>
                  <Link className={`flex items-center gap-3 px-3 py-3 ${active ? "bg-[var(--primary-light)]" : "hover:bg-[#fbfaf8]"}`} href={href(conversation.id)}>
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eeece7] text-[13px] font-semibold text-[var(--foreground-secondary)]">
                      {conversation.avatar_url ? <img alt="" className="h-full w-full object-cover" src={conversation.avatar_url} /> : initials(nameOf(conversation))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-[14px] ${unread ? "font-semibold text-[var(--foreground)]" : "font-medium text-[var(--foreground)]"}`}>{nameOf(conversation)}</span>
                        <ProviderTag provider={conversation.provider} />
                      </span>
                      <span className={`block truncate text-[13px] ${unread ? "font-medium text-[var(--foreground)]" : "text-[var(--muted)]"}`}>
                        {conversation.last_message_direction === "out" ? `${say("you")} ` : ""}
                        {conversation.last_message_preview || ""}
                      </span>
                    </span>
                    <span className="flex flex-shrink-0 flex-col items-end gap-1">
                      <span className="text-[11px] text-[var(--muted)]">{when(conversation.last_message_at, say, locale)}</span>
                      {unread ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--primary)] px-1.5 text-[11px] font-semibold text-white">{conversation.unread_count}</span> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Thread */}
      <section className={`min-h-0 flex-col lg:flex ${selected ? "flex h-[calc(100vh-230px)] min-h-[420px] lg:h-auto" : "hidden"}`}>
        {!selected ? (
          <p className="m-auto p-8 text-center text-sm text-[var(--muted)]">{say("chooseChat")}</p>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--border)] px-3 py-2.5">
              <Link aria-label={say("backToChats")} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--foreground-secondary)] hover:bg-[#f1efeb] lg:hidden" href={href(null)}>
                <ArrowLeft size={18} />
              </Link>
              {/* On a phone the name keeps the first line to itself; linking and "done" drop to the line below. */}
              <div className="min-w-[70%] flex-1 sm:min-w-0">
                <p className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-[var(--foreground)]">{nameOf(selected)}</span>
                  <ProviderTag provider={selected.provider} />
                </p>
                {customer ? (
                  <Link className="text-[13px] font-medium text-[var(--primary)] hover:underline" href={`/customers/${customer.id}` as Route}>
                    {customer.full_name || say("customerRecord")}
                  </Link>
                ) : (
                  <p className="text-[13px] text-[var(--muted)]">{say("notLinked")}</p>
                )}
              </div>
              <select
                aria-label={say("linkAria")}
                className="h-9 w-auto max-w-[190px] text-[13px]"
                onChange={(event) => {
                  const value = event.target.value || null;
                  startQuiet(async () => {
                    await linkConversationCustomer(selected.id, value);
                    router.refresh();
                  });
                }}
                value={selected.customer_id || ""}
              >
                <option value="">{selected.customer_id ? say("unlink") : say("linkTo")}</option>
                {customers.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.full_name || entry.phone || say("customer")}
                  </option>
                ))}
              </select>
              <button
                className="secondary-action pressable min-h-9 px-3 text-[13px]"
                onClick={() =>
                  startQuiet(async () => {
                    await setConversationStatus(selected.id, selected.status === "open" ? "closed" : "open");
                    router.push(href(null));
                    router.refresh();
                  })
                }
                type="button"
              >
                {selected.status === "open" ? <Check size={15} /> : <RotateCcw size={15} />}
                {selected.status === "open" ? say("markDone") : say("reopen")}
              </button>
            </header>

            {bookings.length > 0 ? (
              <div className="scrollbar-none flex gap-2 overflow-x-auto border-b border-[var(--border)] bg-[#fbfaf8] px-3 py-2">
                {bookings.map((booking) => (
                  <Link className="flex-shrink-0 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] hover:border-[var(--primary)]" href={`/bookings/${booking.id}` as Route} key={booking.id}>
                    <span className="block font-semibold text-[var(--foreground)]">
                      {[booking.vehicles?.make, booking.vehicles?.model].filter(Boolean).join(" ") || say("booking")} · {t.has(`status_${booking.status}`) ? say(`status_${booking.status}`) : booking.status}
                    </span>
                    <span className="block text-[var(--muted)]">
                      {shortDate(booking.start_date, say, locale)} – {shortDate(booking.end_date, say, locale)}
                      {Number(booking.balance_due || 0) > 0 ? ` · ${say("owed", { amount: `฿${Number(booking.balance_due).toLocaleString("en-US")}` })}` : ""}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#fbfaf8] px-3 py-4">
              {messages.map((message) => {
                const day = dayLabel(message.created_at, say, locale);
                const showDay = day !== previousDay;
                previousDay = day;
                const mine = message.direction === "out";
                return (
                  <div key={message.id}>
                    {showDay ? <p className="my-3 text-center text-[11px] font-semibold text-[var(--muted)]">{day}</p> : null}
                    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${mine ? "rounded-br-md bg-[var(--primary)] text-white" : "rounded-bl-md border border-[var(--border)] bg-white text-[var(--foreground)]"} ${message.status === "failed" ? "opacity-60" : ""}`}>
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        <p className={`mt-1 text-right text-[11px] ${mine ? "text-white/70" : "text-[var(--muted)]"}`}>{new Date(message.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                    {message.status === "failed" ? (
                      <p className="mt-1 flex items-center justify-end gap-1 text-[12px] text-[var(--danger)]">
                        <AlertCircle size={13} /> {say("notDelivered", { reason: plainSendError(message.error, selected?.provider, say) })}
                        {/auth|token|unauthor|401|403|credential/i.test(String(message.error || "")) ? (
                          <a className="font-semibold underline" href="/settings?tab=messaging">
                            {say("openMessaging")}
                          </a>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                );
              })}
              <div ref={threadEnd} />
            </div>

            <footer className="border-t border-[var(--border)] bg-white p-3">
              {error ? (
                <p className="mb-2 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-[13px] font-medium text-[var(--danger)]" role="alert">
                  {error}
                </p>
              ) : null}
              <textarea
                aria-label={say("replyAria")}
                className="block max-h-40 min-h-[72px] w-full resize-y"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
                }}
                placeholder={say("replyTo", { name: selected.display_name || customers.find((entry) => entry.id === selected.customer_id)?.full_name || say("theCustomer") })}
                value={draft}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  className="pressable inline-flex min-h-9 items-center gap-1.5 rounded-[9px] border border-[var(--border)] bg-white px-3 text-[13px] font-semibold text-[var(--primary)] hover:border-[var(--primary)] disabled:opacity-60"
                  disabled={isSuggesting || !lastInbound}
                  onClick={suggest}
                  title={say("suggestTitle")}
                  type="button"
                >
                  <Sparkles size={15} />
                  {isSuggesting ? say("thinking") : draft ? say("suggestAgain") : say("suggest")}
                </button>
                <button className="primary-action pressable min-h-9 px-4 text-[13px] disabled:opacity-60" disabled={isSending || !draft.trim()} onClick={send} type="button">
                  <Send size={15} />
                  {isSending ? say("sending") : say("send")}
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
