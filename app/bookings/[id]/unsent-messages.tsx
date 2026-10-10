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

  function finish(id: string) {
    setDone((ids) => [...ids, id]);
    startTransition(async () => {
      await markCustomerMessageSent(id).catch(() => null);
      router.refresh();
    });
  }

  async function copy(message: UnsentMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(message.id);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className={bare ? "" : "scroll-mt-4 rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3"} id={bare ? undefined : "unsent-messages"}>
      {bare ? null : (
        <>
          <p className="text-sm font-semibold text-[var(--warning)]">{say("unsentTitle", { count: open.length, name: customerName })}</p>
          <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{say("unsentWhy")}</p>
        </>
      )}
      <div className={bare ? "space-y-3" : "mt-3 space-y-3"}>
        {open.map((message) => {
          const app = appOf(message.url);
          return (
            <div className="rounded-lg bg-white p-3" key={message.id}>
              <p className="whitespace-pre-line text-sm leading-6 text-[var(--foreground)] [overflow-wrap:anywhere]">
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
      </div>
    </div>
  );
}
