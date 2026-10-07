"use client";

import { toWallTime } from "@/lib/business-time";
import { useRef, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { updateVehicleNotes } from "@/app/actions/vehicles";
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

  return (
    <form
      ref={formRef}
      action={updateVehicleNotes}
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
      <p className="font-medium text-[var(--foreground-secondary)]">
        {isPending ? say("saving") : updatedAt ? say("n_edited", { date: longDate(toWallTime(updatedAt).slice(0, 10), locale) }) : say("n_auto")}
      </p>
    </form>
  );
}
