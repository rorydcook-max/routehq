"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generatePaymentScheduleForRental } from "@/app/actions/bookings";

const primaryBtnStyle = {
  background: "var(--primary)",
  color: "var(--primary-text)",
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 16px",
  borderRadius: 7,
  border: "none",
  cursor: "pointer"
} as const;

export function GeneratePaymentScheduleButton({ rentalId }: { rentalId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  function handleGenerateSchedule() {
    setMessage("");
    setError("");
    startTransition(async () => {
      try {
        const result = await generatePaymentScheduleForRental(rentalId);
        const count = result?.count || 0;
        setMessage(`Payment schedule generated — ${count} upcoming payments added`);
        router.refresh();
      } catch (scheduleError) {
        setError(scheduleError instanceof Error ? scheduleError.message : "Unable to generate payment schedule.");
      }
    });
  }

  return (
    <div>
      <button disabled={isPending} onClick={handleGenerateSchedule} style={{ ...primaryBtnStyle, opacity: isPending ? 0.7 : 1 }} type="button">
        {isPending ? "Generating..." : "Generate payment schedule from rental rate"}
      </button>
      {message ? (
        <div className="fixed right-4 top-4 z-[100] max-w-sm rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-xs font-semibold text-[#166534] shadow-lg" role="status">
          {message}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs font-semibold text-[#dc2626]">{error}</p> : null}
    </div>
  );
}
