"use client";

import { useTransition, useState } from "react";
import { sendTestLineSummary } from "@/app/actions/settings";

export function LineTestButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const res = await sendTestLineSummary();
      setResult(res);
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <button
        className="pressable primary-action"
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
          "Send test summary now"
        )}
      </button>

      {result && (
        <p
          className={`text-sm font-semibold ${
            result.success ? "text-[#16a34a]" : "text-[#dc2626]"
          }`}
        >
          {result.success ? "✓ " : "✕ "}
          {result.message}
        </p>
      )}
    </div>
  );
}
