"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { sendPaymentReminder, type PaymentReminderCode } from "@/app/actions/transactions";

export function PaymentReminderButton({ rentalId }: { rentalId: string }) {
  const say = useTranslations("booking") as unknown as (key: string, values?: Record<string, string>) => string;
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ success: boolean; message: string } | null>(null);

  // The server says what happened as a code; the words are in the reader's language here.
  function messageFor(code: PaymentReminderCode, via?: string) {
    switch (code) {
      case "sent_chat":
        return via === "email" ? say("remind_sentEmail") : via ? say("remind_sentOn", { via }) : say("remind_sent");
      case "sent_line":
        return say("remind_sentOn", { via: "LINE" });
      case "whatsapp":
        return say("remind_openingWhatsApp");
      case "nothing_owed":
        return say("remind_nothingOwed");
      case "not_found":
        return say("remind_notFound");
      case "signed_out":
        return say("remind_signedOut");
      default:
        return say("remind_noChannel");
    }
  }

  function handleClick() {
    setToast(null);
    startTransition(async () => {
      const res = await sendPaymentReminder(rentalId);
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, "_blank", "noopener,noreferrer");
      }
      setToast({ success: res.success, message: messageFor(res.code, res.via) });
      setTimeout(() => setToast(null), 5000);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        className="pressable inline-flex min-h-9 items-center gap-2 text-left font-semibold text-[var(--primary)] underline underline-offset-2"
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
