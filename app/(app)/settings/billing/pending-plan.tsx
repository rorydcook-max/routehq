"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cancelPlanRequest } from "@/app/actions/plan";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * The plan a business chose and is paying for: what to pay and how, the slip, and a way to change its mind.
 * Paid plans are switched on by the RoveHQ team when the money arrives (no payment provider yet).
 */
export function PendingPlan({
  what,
  amount,
  qrSvg,
  bankDetails,
  currency,
  renewalDate,
  threadId,
  canChange
}: {
  what: string;
  amount: string;
  qrSvg: string | null;
  bankDetails: string | null;
  currency: string;
  /** Paid up and moving down: the change happens on this date, nothing to pay now. */
  renewalDate: string | null;
  threadId: string | null;
  canChange: boolean;
}) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const thai = currency === "THB";

  return (
    <section className="card mt-3 border-2 border-[var(--warning-line)] p-4" id="pending-plan">
      <h2 className="card-title">{renewalDate ? say("pl_renewalTitle") : say("pl_pendingTitle")}</h2>
      <p className="mt-1 text-[17px] font-bold text-[var(--foreground)]">{what}</p>

      {renewalDate ? (
        <p className="mt-3 font-medium text-[var(--foreground-secondary)]">{say("pl_renewalBody", { date: renewalDate })}</p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
          {thai && qrSvg ? (
            <div className="w-[200px] rounded-xl bg-white p-2 ring-1 ring-[var(--border)] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          ) : null}
          <div className="min-w-0 space-y-2 font-medium text-[var(--foreground-secondary)]">
            {thai && qrSvg ? <p>{say("pl_payPromptPay", { amount })}</p> : null}
            {thai && bankDetails ? (
              <div>
                <p className="font-semibold text-[var(--foreground)]">{qrSvg ? say("pl_payBankOr") : say("pl_payBank", { amount })}</p>
                <p className="whitespace-pre-line">{bankDetails}</p>
              </div>
            ) : null}
            {!thai || (!qrSvg && !bankDetails) ? <p>{say("pl_payOther", { amount })}</p> : null}
            <p>{say("pl_payAfter")}</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {threadId && !renewalDate ? (
          <Link className="primary-action pressable" href={`/help/${threadId}` as Route}>
            {say("pl_paySlip")}
          </Link>
        ) : null}
        {canChange ? (
          <button
            className="secondary-action pressable disabled:opacity-60"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await cancelPlanRequest().catch(() => ({ ok: false as const, error: say("pl_tryAgain") }));
                if (!result.ok) setError(result.error);
                else router.refresh();
              })
            }
            type="button"
          >
            {pending ? say("pl_saving") : say("pl_cancelRequest")}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm font-semibold text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
