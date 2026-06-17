"use client";

import { useRef, useTransition } from "react";
import { updateVehicleNotes } from "@/app/actions/vehicles";

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
      <textarea
        className="min-h-32 w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-3 text-sm text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
        defaultValue={notes}
        name="notes"
        placeholder="Add operating notes, customer quirks, service reminders, or internal comments..."
      />
      <p className="text-xs text-[#667085]">
        {isPending ? "Saving notes..." : updatedAt ? `Last edited ${new Date(updatedAt).toLocaleString("en-TH")}` : "Markdown-style notes are supported for simple formatting."}
      </p>
    </form>
  );
}
