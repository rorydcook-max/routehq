"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { initialsOf } from "@/components/glance";
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
    <section className="mb-4 rounded-[24px] bg-[var(--messages-light)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <span className="num inline-flex h-12 min-w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[var(--messages)] px-2 text-[22px] text-white">{total}</span>
        <h2 className="text-[19px] leading-tight text-[var(--messages-ink)]">{say("toSendTitle", { count: total })}</h2>
      </div>
      <p className="mt-2 text-[var(--messages-ink)]">{say("toSendWhy")}</p>
      <div className="mt-3 grid gap-2 lg:grid-cols-2 lg:items-start">
        {groups.map((group) => (
          <details className="rounded-2xl bg-white" key={group.key}>
            <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3">
              <span aria-hidden="true" className="num inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--messages-light)] text-[15px] text-[var(--messages-ink)]">
                {initialsOf(group.customerName)}
              </span>
              <span className="min-w-0 flex-1">
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
