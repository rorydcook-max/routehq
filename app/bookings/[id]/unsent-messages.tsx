"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Copy, Send } from "lucide-react";
import { markCustomerMessageSent } from "@/app/actions/communication";

type Say = (key: string, values?: Record<string, string | number>) => string;

export type UnsentMessage = { id: string; content: string; url: string | null };

/** Which app a ready-made link opens, read from the link itself. */
function appOf(url: string | null) {
  if (!url) return "copy";
  if (url.startsWith("https://wa.me/")) return "whatsapp";
  if (url.startsWith("https://t.me/")) return "telegram";
  if (url.startsWith("mailto:")) return "email";
  if (url.startsWith("sms:")) return "sms";
  return "copy";
}

/**
 * Messages the app wrote for the customer but could not deliver itself (no
 * chat with them yet). The owner sends each one in a tap, then ticks it off.
 */
export function UnsentMessages({ messages, customerName, bare = false }: { messages: UnsentMessage[]; customerName: string; bare?: boolean }) {
  const say = useTranslations("booking") as unknown as Say;
  const router = useRouter();
  const [done, setDone] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = messages.filter((message) => !done.includes(message.id));
  if (open.length === 0) return null;

  function finish(...ids: string[]) {
    setDone((current) => [...current, ...ids]);
    startTransition(async () => {
      await Promise.all(ids.map((id) => markCustomerMessageSent(id).catch(() => null)));
      router.refresh();
    });
  }
  // The newest message says what's current; older ones for the same booking fold away under it.
  const [latest, ...earlier] = open;

  async function copy(message: UnsentMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className={bare ? "" : "scroll-mt-4 rounded-[24px] bg-[var(--messages-light)] p-4 shadow-[var(--shadow-card)]"} id={bare ? undefined : "unsent-messages"}>
      {bare ? null : (
        <>
          <p className="text-sm font-semibold text-[var(--warning)]">{say("unsentTitle", { count: open.length, name: customerName })}</p>
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{say("unsentWhy")}</p>
        </>
      )}
      <div className={bare ? "space-y-3" : "mt-3 space-y-3"}>
        {[latest].map((message) => {
          const app = appOf(message.url);
          return (
            <div className="rounded-2xl bg-white p-3.5" key={message.id}>
              <p className="whitespace-pre-line text-[15px] leading-6 text-[var(--foreground)] [overflow-wrap:anywhere]">
                <bdi>{message.content}</bdi>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {message.url ? (
                  <a className="primary-action pressable min-h-11 px-3 text-sm" href={message.url} rel="noreferrer" target="_blank">
                    <Send size={16} />
                    {say(`unsent_${app}`)}
                  </a>
                ) : null}
                <button className={`${message.url ? "secondary-action" : "primary-action"} pressable min-h-11 px-3 text-sm`} onClick={() => copy(message)} type="button">
                  <Copy size={16} />
                  {copied === message.id ? say("unsentCopied") : say("unsentCopy")}
                </button>
                <button className="secondary-action pressable min-h-11 px-3 text-sm" disabled={pending} onClick={() => finish(message.id)} type="button">
                  <Check size={16} />
                  {say("unsentDone")}
                </button>
              </div>
            </div>
          );
        })}
        {earlier.length ? (
          <details className="group rounded-2xl bg-white/70 px-3 py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[var(--foreground-secondary)]">
              <span>{say("unsentEarlier", { count: earlier.length })}</span>
              <span aria-hidden="true" className="ti ti-chevron-down transition group-open:rotate-180" />
            </summary>
            <p className="mt-1 text-[14px] text-[var(--muted)]">{say("unsentEarlierHint")}</p>
            <div className="mt-2 space-y-2">
              {earlier.map((message) => (
                <p className="line-clamp-3 whitespace-pre-line rounded-xl bg-white p-3 text-[14px] leading-6 text-[var(--foreground-secondary)] [overflow-wrap:anywhere]" key={message.id}>
                  <bdi>{message.content}</bdi>
                </p>
              ))}
            </div>
            <button className="secondary-action pressable mt-2.5 min-h-10 whitespace-nowrap px-4 text-[14px]" disabled={pending} onClick={() => finish(...earlier.map((message) => message.id))} type="button">
              <Check size={16} />
              {say("unsentClearEarlier")}
            </button>
          </details>
        ) : null}
      </div>
    </div>
  );
}
