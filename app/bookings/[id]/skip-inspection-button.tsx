"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { manuallyActivateRental } from "@/app/actions/bookings";

export function SkipInspectionButton({ rentalId }: { rentalId: string }) {
  const say = useTranslations("booking") as unknown as (key: string) => string;
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await manuallyActivateRental(rentalId);
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
        <div className="flex gap-2">
          <button
            className="pressable inline-flex min-h-7 items-center rounded-lg bg-[var(--warning)] px-3 text-xs font-bold text-white disabled:opacity-60"
            disabled={isPending}
            onClick={handleConfirm}
            type="button"
          >
            {isPending ? say("saving") : say("skip_yes")}
          </button>
          <button
            className="pressable inline-flex min-h-7 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-bold text-[var(--foreground-secondary)]"
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
        className="pressable inline-flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)]"
        onClick={() => setShowConfirm(true)}
        type="button"
      >
        {say("skip_button")}
      </button>
      {error ? <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
    </>
  );
}
