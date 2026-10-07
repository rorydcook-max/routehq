"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { sendTestLineSummary } from "@/app/actions/settings";

export function LineTestButton() {
  const say = useTranslations("settingsPage") as unknown as (key: string) => string;
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<"ok" | "failed" | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await sendTestLineSummary().catch(() => ({ success: false }));
      setResult(res.success ? "ok" : "failed");
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <button className="pressable secondary-action" disabled={isPending} onClick={handleClick} type="button">
        {isPending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            <span>{say("tb_sending")}</span>
          </>
        ) : (
          say("tb_send")
        )}
      </button>
      {result ? <p className={`font-bold ${result === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{result === "ok" ? say("tb_ok") : say("tb_failed")}</p> : null}
    </div>
  );
}
