"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { savePublicBookingSettings } from "@/app/actions/online-booking";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * The deposit a booking takes when its vehicle has no deposit of its own: on
 * bookings the owner makes and on online ones. It used to sit inside the
 * online booking settings, out of reach for a business with that switched off.
 */
export function UsualDepositPanel({ deposit, enabled, holdHours, offer }: { deposit: number; enabled: boolean; holdHours: number; offer: string }) {
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
      <label className="block sm:max-w-xs">
        <span className="font-semibold text-[var(--foreground)]">{say("ud_label")}</span>
        <input
          className="mt-1 block w-full"
          disabled={isPending}
          inputMode="numeric"
          min="0"
          onBlur={save}
          onChange={(event) => {
            setValue(event.target.value);
            setState("idle");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              save();
            }
          }}
          placeholder="0"
          type="number"
          value={value}
        />
      </label>
      {state === "saved" ? <p className="font-semibold text-[var(--success)]">{say("saved")}</p> : null}
      {state === "failed" ? <p className="font-bold text-[var(--danger)]">{say("saveFailed")}</p> : null}
    </div>
  );
}
