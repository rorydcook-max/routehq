"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { manuallyActivateRental } from "@/app/actions/bookings";
import type { EarlyStart, EarlyStartChoice } from "@/lib/early-start";
import type { LateStart, LateStartChoice } from "@/lib/late-start";
import { longDate } from "@/lib/i18n/dates";
import { useLocale } from "next-intl";

export function SkipInspectionButton({ rentalId, early = null, late = null, canWaive = true }: { rentalId: string; early?: EarlyStart | null; late?: LateStart | null; canWaive?: boolean }) {
  const say = useTranslations("booking") as unknown as (key: string) => string;
  const ask = useTranslations("inspection") as unknown as (key: string, values?: Record<string, string | number>) => string;
  const locale = useLocale();
  const [earlyChoice, setEarlyChoice] = useState<EarlyStartChoice>(early && early.amount > 0 ? "charge" : "free");
  const [lateChoice, setLateChoice] = useState<LateStartChoice>("from_handover");
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await manuallyActivateRental(rentalId, early ? earlyChoice : undefined, late ? lateChoice : undefined);
      if (!result.success) {
        setError(result.error || say("skip_failed"));
        setShowConfirm(false);
      }
    });
  }

  if (showConfirm) {
    return (
      <div className="rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
        <p className="mb-2 text-xs font-semibold text-[var(--warning)]">
          {say("skip_confirm")}
        </p>
        {early ? (
          <fieldset className="mb-3">
            <legend className="text-xs font-bold text-[var(--foreground)]">{ask("earlyTitle", { days: early.days, date: longDate(early.bookedStart, locale) })}</legend>
            <div className="mt-1 space-y-1">
              {(
                [
                  early.amount > 0 ? { value: "charge", label: ask("earlyCharge", { days: early.days, amount: `฿${early.amount.toLocaleString("en-US")}` }) } : null,
                  early.shortenedEnd ? { value: "shorten", label: ask("earlyShorten", { date: longDate(early.shortenedEnd, locale) }) } : null,
                  { value: "free", label: canWaive || early.amount <= 0 ? (early.bookedEnd ? ask("earlyFreeBack", { date: longDate(early.bookedEnd, locale) }) : ask("earlyFree")) : ask("earlyAskFree") }
                ].filter(Boolean) as { value: EarlyStartChoice; label: string }[]
              ).map((option) => (
                <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[var(--foreground)]" key={option.value}>
                  <input checked={earlyChoice === option.value} className="h-4 w-4 accent-[var(--primary)]" name="skipEarlyStart" onChange={() => setEarlyChoice(option.value)} type="radio" value={option.value} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {late ? (
          <fieldset className="mb-3">
            <legend className="text-xs font-bold text-[var(--foreground)]">{ask("lateTitle", { days: late.days, date: longDate(late.bookedStart, locale) })}</legend>
            <div className="mt-1 space-y-1">
              {(
                [
                  {
                    value: "from_handover",
                    label: late.openEnded
                      ? ask("lateFromTodayMoves", { days: late.days })
                      : late.credit > 0
                        ? ask("lateFromToday", { date: longDate(late.bookedEnd || "", locale), amount: `฿${late.credit.toLocaleString("en-US")}` })
                        : ask("lateFromTodayPlain", { date: longDate(late.bookedEnd || "", locale) })
                  },
                  { value: "as_booked", label: ask("lateAsBooked", { date: longDate(late.bookedStart, locale) }) }
                ] as { value: LateStartChoice; label: string }[]
              ).map((option) => (
                <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-[var(--foreground)]" key={option.value}>
                  <input checked={lateChoice === option.value} className="h-4 w-4 accent-[var(--primary)]" name="skipLateStart" onChange={() => setLateChoice(option.value)} type="radio" value={option.value} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        <div className="flex gap-2">
          <button
            className="pressable inline-flex min-h-7 items-center rounded-full bg-[var(--warning)] px-3 text-xs font-bold text-white disabled:opacity-60"
            disabled={isPending}
            onClick={handleConfirm}
            type="button"
          >
            {isPending ? say("saving") : say("skip_yes")}
          </button>
          <button
            className="pressable inline-flex min-h-7 items-center rounded-full border border-[var(--border)] bg-white px-3 text-xs font-bold text-[var(--foreground-secondary)]"
            disabled={isPending}
            onClick={() => setShowConfirm(false)}
            type="button"
          >
            {say("cancelBtn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        className="pressable inline-flex w-full items-center justify-center rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)]"
        onClick={() => setShowConfirm(true)}
        type="button"
      >
        {say("skip_button")}
      </button>
      {error ? <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
    </>
  );
}
