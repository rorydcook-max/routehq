"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveCustomerMessages } from "@/app/actions/online-booking";

/** One switch for the messages RouteHQ sends customers on the business's behalf. Saves on change. */
export function CustomerMessagesPanel({ enabled, hasChannel }: { enabled: boolean; hasChannel: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function change(next: boolean) {
    setOn(next);
    setError(null);
    startTransition(async () => {
      const result = await saveCustomerMessages(next).catch(() => ({ ok: false as const, error: "Couldn't save. Please try again." }));
      if (!result.ok) {
        setError(result.error);
        setOn(!next);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input checked={on} className="mt-1 h-4 w-4" disabled={isPending} onChange={(event) => change(event.target.checked)} type="checkbox" />
        <span>
          <span className="block text-sm font-semibold text-[var(--foreground)]">Tell customers automatically</span>
          <span className="mt-1 block text-[13px] leading-5 text-[var(--muted)]">
            When an extension is applied, a request is answered, a payment is received, a refund is made, a booking is cancelled, a hold ends, or rent is due tomorrow. Each message goes to the chat that customer
            first messaged you on.
          </span>
        </span>
      </label>
      {on && !hasChannel ? (
        <p className="mt-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-[13px] text-[#92400e]">
          No messaging account is connected yet, so nothing can be sent. Until one is, each message is kept on the booking marked "not sent" for you to pass on.
        </p>
      ) : null}
      {on && hasChannel ? (
        <p className="mt-3 text-[13px] leading-5 text-[var(--muted)]">
          A customer who has never messaged you has no chat to send to. Their messages are kept on the booking marked "not sent". Link a chat to a customer from the Inbox.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm font-semibold text-[#dc2626]">{error}</p> : null}
    </div>
  );
}
