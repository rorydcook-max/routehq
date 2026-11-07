"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarPlus, CornerDownLeft } from "lucide-react";
import { answerExtension } from "@/app/actions/extension-hold";

/** Extend (pick the new return date) or Returning. Either answer goes to the business at once. */
export function ExtensionCheckForm({ token, endDate, endLabel, defaultEnd }: { token: string; endDate: string; endLabel: string; defaultEnd: string }) {
  const t = useTranslations("customer");
  const router = useRouter();
  const [extending, setExtending] = useState(false);
  const [until, setUntil] = useState(defaultEnd);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const minimum = (() => {
    const date = new Date(`${endDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  })();

  function send(answer: "extend" | "returning") {
    setError(null);
    if (answer === "extend" && (!until || until <= endDate)) {
      setError(t("holdCheckDate", { date: endLabel }));
      return;
    }
    startTransition(async () => {
      const result = await answerExtension({ token, answer, newEndDate: answer === "extend" ? until : null }).catch(() => ({ ok: false as const, error: "failed" as const }));
      if (!result.ok) {
        setError(result.error === "date" ? t("holdCheckDate", { date: endLabel }) : t("holdCheckFailed"));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-5 space-y-3">
      {!extending ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-5 py-3 text-base font-semibold text-white" disabled={isPending} onClick={() => setExtending(true)} type="button">
            <CalendarPlus size={18} /> {t("holdCheckExtend")}
          </button>
          <button className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-white px-5 py-3 text-base font-semibold text-[var(--foreground)]" disabled={isPending} onClick={() => send("returning")} type="button">
            <CornerDownLeft size={18} /> {t("holdCheckReturning")}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--foreground)]">{t("holdCheckUntil")}</span>
            <input className="mt-1 block w-full" min={minimum} onChange={(event) => setUntil(event.target.value)} type="date" value={until} />
          </label>
          <div className="flex flex-wrap gap-3">
            <button className="pressable inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--primary)] px-5 py-3 text-base font-semibold text-white" disabled={isPending} onClick={() => send("extend")} type="button">
              {isPending ? t("holdCheckSending") : t("holdCheckSend")}
            </button>
            <button className="pressable inline-flex min-h-12 items-center justify-center rounded-full px-4 py-3 text-sm font-semibold text-[var(--muted)]" disabled={isPending} onClick={() => setExtending(false)} type="button">
              {t("holdCheckBack")}
            </button>
          </div>
        </div>
      )}
      {error ? <p className="text-sm font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
