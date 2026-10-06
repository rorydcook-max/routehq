"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { sendPaymentReminder } from "@/app/actions/transactions";

export function PaymentReminderButton({ rentalId }: { rentalId: string }) {
  const say = useTranslations("booking") as unknown as (key: string) => string;
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ success: boolean; message: string } | null>(null);

  function handleClick() {
    setToast(null);
    startTransition(async () => {
      const res = await sendPaymentReminder(rentalId);
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, "_blank", "noopener,noreferrer");
      }
      setToast({ success: res.success, message: res.message ?? (res.success ? say("remind_sent") : say("remind_noChannel")) });
      setTimeout(() => setToast(null), 5000);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        className="pressable inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-[var(--primary)] bg-white px-3 py-2 text-sm font-bold text-[var(--primary)] hover:bg-[var(--success-light)]"
        disabled={isPending}
        onClick={handleClick}
        type="button"
      >
        {isPending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            <span>{say("sending")}</span>
          </>
        ) : (
          say("remind_send")
        )}
      </button>

      {toast && (
        <p className={`text-xs font-semibold ${toast.success ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {toast.success ? "✓ " : "✕ "}
          {toast.message}
        </p>
      )}
    </div>
  );
}
