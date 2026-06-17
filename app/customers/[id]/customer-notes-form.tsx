"use client";

import { useRef, useTransition } from "react";
import { updateCustomer } from "@/app/actions/customers";

export function CustomerNotesForm({
  customerId,
  organizationId,
  notes
}: {
  customerId: string;
  organizationId: string;
  notes: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={updateCustomer}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          startTransition(() => formRef.current?.requestSubmit());
        }
      }}
    >
      <input name="customerId" type="hidden" value={customerId} />
      <input name="organizationId" type="hidden" value={organizationId} />
      <textarea
        className="min-h-32 w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-3 text-sm text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
        defaultValue={notes}
        name="notes"
        placeholder="Customer notes, preferences, payment habits, document reminders..."
      />
      <p className="mt-2 text-xs text-[#667085]">{isPending ? "Saving notes..." : "Saves automatically when you leave the notes field."}</p>
    </form>
  );
}
