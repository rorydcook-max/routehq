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
        className="min-h-32 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
        defaultValue={notes}
        name="notes"
        placeholder="Customer notes, preferences, payment habits, document reminders..."
      />
      <p className="mt-2 text-xs text-[var(--muted)]">{isPending ? "Saving notes..." : "Saves automatically when you leave the notes field."}</p>
    </form>
  );
}
