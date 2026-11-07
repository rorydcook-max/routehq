"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import { releaseExtensionHold } from "@/app/actions/extension-hold";
import { dateFormat } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * "Held for extension until 12 Dec": the days after this monthly rental are kept off new bookings in case the renter
 * extends (lib/extension-hold.ts). The team can let them go by hand.
 */
export function ExtensionHoldNote({ rentalId, holdUntil, stage }: { rentalId: string; holdUntil: string; stage: "waiting" | "asked" | "extend" }) {
  const say = useTranslations("booking") as unknown as Say;
  const locale = useLocale();
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  // extension_hold_until is the first free day; the note names the last held one.
  const last = new Date(`${holdUntil}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() - 1);
  const date = dateFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(last);

  function release() {
    setFailed(false);
    startTransition(async () => {
      const result = await releaseExtensionHold(rentalId).catch(() => ({ ok: false }));
      if (!result.ok) {
        setFailed(true);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="scroll-mt-4 rounded-xl border border-dashed border-[var(--warning)] bg-[var(--warning-light)] p-3" id="extension-hold">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <CalendarClock aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--warning)]" size={18} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">{say("holdExtUntil", { date })}</p>
            <p className="mt-0.5 text-sm text-[var(--foreground-secondary)]">{say(stage === "extend" ? "holdExtWantsToExtend" : stage === "asked" ? "holdExtAsked" : "holdExtWaiting")}</p>
          </div>
        </div>
        <button className="pressable inline-flex min-h-9 items-center justify-center rounded-full border border-[var(--border-strong)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground)]" disabled={isPending} onClick={release} type="button">
          {isPending ? say("holdExtReleasing") : say("holdExtRelease")}
        </button>
      </div>
      {failed ? <p className="mt-2 text-sm font-bold text-[var(--danger)]">{say("holdExtFailed")}</p> : null}
    </div>
  );
}
