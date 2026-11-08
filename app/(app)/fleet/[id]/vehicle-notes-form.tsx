"use client";

import { toWallTime } from "@/lib/business-time";
import { useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { updateVehicleNotes } from "@/app/actions/vehicles";
import { isActionFailure } from "@/lib/action-result";
import { longDate } from "@/lib/i18n/dates";

export function VehicleNotesForm({
  vehicleId,
  organizationId,
  notes,
  updatedAt
}: {
  vehicleId: string;
  organizationId: string;
  notes: string;
  updatedAt?: string | null;
}) {
  const say = useTranslations("vehicleForm") as unknown as (key: string, values?: Record<string, string>) => string;
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  // Why the last save failed, if it did (lib/action-error.ts); the typed text stays.
  const [error, setError] = useState("");
  const failed = useRef(false);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        const result = await updateVehicleNotes(formData);
        failed.current = isActionFailure(result);
        setError(isActionFailure(result) ? result.actionError : "");
      }}
      onReset={(event) => {
        if (failed.current) event.preventDefault();
      }}
      className="space-y-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          startTransition(() => {
            formRef.current?.requestSubmit();
          });
        }
      }}
    >
      <input name="vehicleId" type="hidden" value={vehicleId} />
      <input name="organizationId" type="hidden" value={organizationId} />
      <textarea className="min-h-32 w-full" defaultValue={notes} name="notes" placeholder={say("n_placeholder")} />
      {error ? (
        <p className="mt-2 font-semibold text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <p className="font-medium text-[var(--foreground-secondary)]">
        {isPending ? say("saving") : updatedAt ? say("n_edited", { date: longDate(toWallTime(updatedAt).slice(0, 10), locale) }) : say("n_auto")}
      </p>
    </form>
  );
}
