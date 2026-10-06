"use client";

import { useState, useTransition } from "react";
import { manuallyActivateRental } from "@/app/actions/bookings";

export function SkipInspectionButton({ rentalId }: { rentalId: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await manuallyActivateRental(rentalId);
      if (!result.success) {
        setError(result.error || "That did not save. Please try again.");
        setShowConfirm(false);
      }
    });
  }

  if (showConfirm) {
    return (
      <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
        <p className="mb-2 text-xs font-semibold text-[#92400e]">
          Mark the vehicle as handed over without the form? You will have no photos, fuel level or signature to rely on if there is a dispute. The form can still be filled in later.
        </p>
        <div className="flex gap-2">
          <button
            className="pressable inline-flex min-h-7 items-center rounded-lg bg-[#d97706] px-3 text-xs font-bold text-white disabled:opacity-60"
            disabled={isPending}
            onClick={handleConfirm}
            type="button"
          >
            {isPending ? "Saving…" : "Yes, hand over without it"}
          </button>
          <button
            className="pressable inline-flex min-h-7 items-center rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-bold text-[var(--foreground-secondary)]"
            disabled={isPending}
            onClick={() => setShowConfirm(false)}
            type="button"
          >
            Cancel
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
        Hand over without the form
      </button>
      {error ? <p className="mt-1 text-xs font-semibold text-[#dc2626]">{error}</p> : null}
    </>
  );
}
