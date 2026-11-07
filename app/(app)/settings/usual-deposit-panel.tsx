"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { savePublicBookingSettings } from "@/app/actions/online-booking";
import { MoneyInput } from "@/components/money-input";
import { businessCurrency } from "@/lib/business-units";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * The deposit a booking takes when its vehicle has no deposit of its own: on
 * bookings the owner makes and on online ones. It used to sit inside the
 * online booking settings, out of reach for a business with that switched off.
 */
export function UsualDepositPanel({ currency = "", currencyCode = businessCurrency(), deposit, enabled, holdHours, offer }: { currency?: string; currencyCode?: string; deposit: number; enabled: boolean; holdHours: number; offer: string }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const router = useRouter();
  const [value, setValue] = useState(deposit > 0 ? String(deposit) : "");
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");
  const [isPending, startTransition] = useTransition();

  function save() {
    const amount = Math.max(0, Math.round(Number(value || 0)));
    if (amount === deposit) return;
    setState("idle");
    startTransition(async () => {
      const result = await savePublicBookingSettings({ enabled, holdHours, offer, deposit: amount }).catch(() => ({ ok: false as const }));
      setState(result.ok ? "saved" : "failed");
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <p className="font-medium text-[var(--foreground-secondary)]">{say("ud_body")}</p>
      {/* The business's currency symbol sits inside the box (7 Nov 2026); saved when you leave the box or press Enter. */}
      <label
        className="block sm:max-w-xs"
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
        }}
      >
        <span className="font-semibold text-[var(--foreground)]">{say("ud_label", { currency })}</span>
        <MoneyInput
          currency={currencyCode}
          defaultValue={value}
          name="usual_deposit"
          onValueChange={(amount) => {
            setValue(amount);
            setState("idle");
          }}
        />
      </label>
      {state === "saved" ? <p className="font-semibold text-[var(--success)]">{say("saved")}</p> : null}
      {state === "failed" ? <p className="font-bold text-[var(--danger)]">{say("saveFailed")}</p> : null}
    </div>
  );
}
