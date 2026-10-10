"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { UnsentMessages, type UnsentMessage } from "@/app/bookings/[id]/unsent-messages";

type Say = (key: string, values?: Record<string, string | number>) => string;

export type ToSendGroup = { key: string; customerName: string; bookingRef: string; rentalId: string | null; messages: UnsentMessage[] };

/**
 * Messages written for customers who have no chat open with the business yet.
 * Shown in the inbox so the owner finds them where they look for messages,
 * not only on each booking. One row per booking; tap to open and send.
 */
export function MessagesToSend({ groups }: { groups: ToSendGroup[] }) {
  const say = useTranslations("inbox") as unknown as Say;
  const total = groups.reduce((sum, group) => sum + group.messages.length, 0);
  return (
    <section className="mb-4 rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-4">
      <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("toSendTitle", { count: total })}</h2>
      <p className="mt-1 text-[var(--foreground-secondary)]">{say("toSendWhy")}</p>
      <div className="mt-3 space-y-2">
        {groups.map((group) => (
          <details className="rounded-lg bg-white" key={group.key}>
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3">
              <span className="min-w-0">
                <span className="block truncate font-bold text-[var(--foreground)]">{group.customerName || say("toSendNoName")}</span>
                <span className="block truncate text-sm text-[var(--foreground-secondary)]">
                  {[group.bookingRef, say("toSendCount", { count: group.messages.length })].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-[var(--primary)]">{say("toSendOpen")}</span>
            </summary>
            <div className="border-t border-[var(--border)] p-3">
              <UnsentMessages bare customerName={group.customerName} messages={group.messages} />
              {group.rentalId ? (
                <Link className="mt-3 inline-block text-sm font-semibold text-[var(--primary)]" href={`/bookings/${group.rentalId}`}>
                  {say("toSendBooking")}
                </Link>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
