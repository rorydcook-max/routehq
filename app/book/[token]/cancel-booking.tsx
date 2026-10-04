"use client";

import { useState, useTransition } from "react";
import { cancelBookingByCustomer } from "@/app/actions/customer-cancel";

/** A quiet way out for a customer who can no longer take the vehicle. */
export function CancelBooking({ token, organizationName }: { token: string; organizationName: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function cancel(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        formData.set("token", token);
        const result = await cancelBookingByCustomer(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        // The page now shows the booking as cancelled.
        window.location.reload();
      } catch {
        setError("We couldn't cancel the booking. Please try again.");
      }
    });
  }

  if (!open) {
    return (
      <p className="pb-4 text-center text-sm text-[var(--muted)]">
        Plans changed?{" "}
        <button className="min-h-11 font-semibold text-[var(--foreground-secondary)] underline underline-offset-2" onClick={() => setOpen(true)} type="button">
          Cancel this booking
        </button>
      </p>
    );
  }

  return (
    <form action={cancel} className="space-y-3 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">Cancel this booking?</h2>
      <p className="text-sm leading-6 text-[var(--muted)]">
        The vehicle will be released for someone else to book. If you have already paid anything, {organizationName} will contact you about it.
      </p>
      <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
        Reason (optional)
        <textarea className="mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)]" maxLength={500} name="reason" rows={2} />
      </label>
      {error ? <p className="text-sm font-semibold text-[#dc2626]">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <button className="pressable min-h-12 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--foreground)]" disabled={isPending} onClick={() => setOpen(false)} type="button">
          Keep my booking
        </button>
        <button className="pressable min-h-12 rounded-xl bg-[#dc2626] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
          {isPending ? "Cancelling…" : "Yes, cancel it"}
        </button>
      </div>
    </form>
  );
}
