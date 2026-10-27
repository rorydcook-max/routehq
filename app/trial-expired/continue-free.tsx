"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { choosePlan } from "@/app/actions/plan";

/** Trial over: carry on with the Free plan straight away, no payment. */
export function ContinueFree() {
  const say = useTranslations("auth");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="secondary-action pressable w-full disabled:opacity-60"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await choosePlan({ plan: "free", interval: "monthly" }).catch(() => ({ ok: false as const, error: say("continueFreeError") }));
            if (!result.ok) setError(result.error);
            else router.push("/");
          })
        }
        type="button"
      >
        {say("continueFree")}
      </button>
      {error ? (
        <p className="text-sm font-semibold text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
