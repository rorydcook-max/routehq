"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateCustomer } from "@/app/actions/customers";
import { isActionFailure } from "@/lib/action-result";

export function CustomerNotesForm({
  customerId,
  organizationId,
  notes
}: {
  customerId: string;
  organizationId: string;
  notes: string;
}) {
  const say = useTranslations("customerPage") as unknown as (key: string) => string;
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  // Why the last save failed, if it did (lib/action-error.ts); the typed text stays.
  const [error, setError] = useState("");
  const failed = useRef(false);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        const result = await updateCustomer(formData);
        failed.current = isActionFailure(result);
        setError(isActionFailure(result) ? result.actionError : "");
      }}
      onReset={(event) => {
        if (failed.current) event.preventDefault();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          startTransition(() => formRef.current?.requestSubmit());
        }
      }}
    >
      <input name="customerId" type="hidden" value={customerId} />
      <input name="organizationId" type="hidden" value={organizationId} />
      <textarea className="min-h-32 w-full" defaultValue={notes} name="notes" placeholder={say("n_placeholder")} />
      {error ? (
        <p className="mt-2 font-semibold text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {isPending ? <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("saving")}</p> : null}
    </form>
  );
}
