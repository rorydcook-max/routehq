"use client";

import { InfoTip } from "@/components/info-tip";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { markCustomerMessageSent, sendApprovedCustomerMessage } from "@/app/actions/communication";

type Say = (key: string, values?: Record<string, string | number>) => string;

/** ask: waiting for the owner's say-so ("Ask me first"), so it can also be sent for them in one tap. */
export type UnsentMessage = { id: string; content: string; url: string | null; ask?: boolean };

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
  const [done, setDone] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  // Approved messages that had no chat or email to go out on: the owner sends those by hand.
  const [byHand, setByHand] = useState<string[]>([]);
  function approve(id: string) {
    startTransition(async () => {
      const result = await sendApprovedCustomerMessage(id).catch(() => ({ ok: false, sent: false }));
      if (result.sent) setDone((current) => [...current, id]);
      else setByHand((current) => [...current, id]);
      router.refresh();
    });
  }
  const open = messages.filter((message) => !done.includes(message.id));
  if (open.length === 0) return null;

  function finish(...ids: string[]) {
    setDone((current) => [...current, ...ids]);
    startTransition(async () => {
      await Promise.all(ids.map((id) => markCustomerMessageSent(id).catch(() => null)));
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
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--warning)]">
            {say("unsentTitle", { count: open.length, name: customerName })}
            <InfoTip label={say("unsentTitle", { count: open.length, name: customerName })} text={say("unsentWhy")} />
          </p>
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
              {byHand.includes(message.id) ? <p className="mt-2 text-[14px] font-semibold text-[var(--warning)]">{say("unsentNoRoute")}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {message.ask && !byHand.includes(message.id) ? (
                  <button className="primary-action pressable min-h-11 px-3 text-sm" data-approve={message.id} disabled={pending} onClick={() => approve(message.id)} type="button">
                    <Send size={16} />
                    {say("unsentSendForMe")}
                  </button>
                ) : null}
                {message.url ? (
                  <a className={`${message.ask && !byHand.includes(message.id) ? "secondary-action" : "primary-action"} pressable min-h-11 px-3 text-sm`} href={message.url} rel="noreferrer" target="_blank">
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
