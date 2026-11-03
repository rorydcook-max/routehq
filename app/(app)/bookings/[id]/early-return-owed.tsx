"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { decideEarlyReturnOwed } from "@/app/actions/early-return";

/**
 * Back early with rent still to pay: part of it is for days the customer didn't have the vehicle. The owner takes
 * that part off or keeps the booking as it was; the customer is told what is still to pay after either.
 */
export function EarlyReturnOwedPanel({ rentalId, days, unused, owed, canDecide = true }: { rentalId: string; days: number; unused: string; owed: string; canDecide?: boolean }) {
  const t = useTranslations("booking") as unknown as (key: string, values?: Record<string, string | number>) => string;
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const decide = (decision: "take_off" | "keep") =>
    start(async () => {
      setError("");
      const result = await decideEarlyReturnOwed(rentalId, decision);
      if (!result.ok) setError(result.error || t("earlyOwedFailed"));
    });
  return (
    <div className="rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
      <p className="font-semibold text-[var(--warning)]">{t("earlyOwedTitle", { days, amount: unused })}</p>
      <p className="mt-1 text-sm text-[var(--warning)]">{t("earlyOwedBody", { owed })}</p>
      {canDecide ? null : <p className="mt-2 font-semibold text-[var(--foreground)]">{t("earlyOwedOwner")}</p>}
      <div className={`mt-3 gap-2 sm:grid-cols-2 ${canDecide ? "grid" : "hidden"}`}>
        <button className="pressable inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} onClick={() => decide("take_off")} type="button">
          {t("earlyOwedTakeOff", { amount: unused })}
        </button>
        <button className="pressable inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--foreground)] disabled:opacity-60" disabled={pending} onClick={() => decide("keep")} type="button">
          {t("earlyOwedKeep")}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
