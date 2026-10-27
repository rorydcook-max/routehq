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
 * not only on each booking. One row per booking; open it to send.
 * A plain card in the brand colours (no accent of its own), rows the full width of the card.
 */
export function MessagesToSend({ groups }: { groups: ToSendGroup[] }) {
  const say = useTranslations("inbox") as unknown as Say;
  const total = groups.reduce((sum, group) => sum + group.messages.length, 0);
  return (
    <section className="card mb-4 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="num inline-flex h-9 min-w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-2.5 text-[16px] font-bold text-white">{total}</span>
        <h2 className="card-title">{say("toSendTitle", { count: total })}</h2>
      </div>
      <p className="measure mt-2 font-medium text-[var(--foreground-secondary)]">{say("toSendWhy")}</p>
      <div className="mt-4 grid gap-2">
        {groups.map((group) => (
          <details className="rounded-2xl bg-[var(--panel-secondary)]" key={group.key}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="num inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[15px] text-[var(--primary)]">
                {initialsOf(group.customerName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-[var(--foreground)]">{group.customerName || say("toSendNoName")}</span>
                <span className="block truncate text-sm text-[var(--foreground-secondary)]">
                  {[group.bookingRef, say("toSendCount", { count: group.messages.length })].filter(Boolean).join(" · ")}
                </span>
              </span>
              {/* The standard outline button, as on the dashboard. */}
              <span className="secondary-action pointer-events-none min-h-9 shrink-0 px-4 text-sm">{say("toSendOpen")}</span>
            </summary>
            <div className="border-t border-[var(--border)] p-3">
              <UnsentMessages bare customerName={group.customerName} messages={group.messages} />
              {group.rentalId ? (
                <Link className="mt-3 inline-block text-sm font-semibold text-[var(--primary)] hover:underline" href={`/bookings/${group.rentalId}`}>
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
