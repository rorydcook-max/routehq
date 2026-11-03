"use client";

import { useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
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
  const say = useTranslations("customerPage") as unknown as (key: string) => string;
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
      <textarea className="min-h-32 w-full" defaultValue={notes} name="notes" placeholder={say("n_placeholder")} />
      <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{isPending ? say("saving") : say("n_auto")}</p>
    </form>
  );
}
