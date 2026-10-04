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
            Reminders before a handover, a return and a rent payment, a nudge when rent is late, and a heads-up when their vehicle is due a service or renewal. Plus what just happened: an extension applied, a
            request answered, a payment received, a refund, a cancellation. Each goes to the chat that customer first messaged you on; without one, by email if they gave it, otherwise it waits on the booking for
            you to send in one tap.
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
          LINE and Telegram only let you message someone who has messaged you first. Each customer's booking page invites them to open a chat with you, and it connects itself to their booking when they do.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm font-semibold text-[#dc2626]">{error}</p> : null}
    </div>
  );
}
