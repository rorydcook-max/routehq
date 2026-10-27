"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { activatePlanRequest } from "@/app/actions/plan";

/** RouteHQ team: the business's payment arrived, switch its plan on. */
export function PlanActivateButton({ organizationId }: { organizationId: string }) {
  const t = useTranslations("help");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="primary-action pressable disabled:opacity-60"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await activatePlanRequest({ organizationId }).catch(() => ({ ok: false as const, error: "…" }));
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
        type="button"
      >
        {pending ? t("teamActivating") : t("teamActivate")}
      </button>
      {error ? (
        <p className="mt-2 text-sm font-semibold text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
