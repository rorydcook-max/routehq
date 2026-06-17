"use client";

import { useTransition, useState } from "react";
import { sendPaymentReminder } from "@/app/actions/transactions";

export function PaymentReminderButton({ rentalId }: { rentalId: string }) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ success: boolean; message: string } | null>(null);

  function handleClick() {
    setToast(null);
    startTransition(async () => {
      const res = await sendPaymentReminder(rentalId);
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, "_blank", "noopener,noreferrer");
      }
      setToast({ success: res.success, message: res.message ?? (res.success ? "Reminder sent" : "No contact channel available") });
      setTimeout(() => setToast(null), 5000);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        className="pressable inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-[#0f766e] bg-white px-3 py-2 text-sm font-bold text-[#0f766e] hover:bg-[#f0fdf4]"
        disabled={isPending}
        onClick={handleClick}
        type="button"
      >
        {isPending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            <span>Sending…</span>
          </>
        ) : (
          "Send payment reminder"
        )}
      </button>

      {toast && (
        <p className={`text-xs font-semibold ${toast.success ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
          {toast.success ? "✓ " : "✕ "}
          {toast.message}
        </p>
      )}
    </div>
  );
}
