"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Trash2 } from "lucide-react";
import { deleteCustomerData, type PrivacyActionState } from "@/app/actions/privacy";

type Say = (key: string) => string;
const start: PrivacyActionState = { ok: false };

/**
 * A renter's privacy requests, answered from their page (GDPR Art. 15, 17, 20; PDPA): export everything held about
 * them, or delete their personal data. Bookings and payments stay as "Deleted customer" for the accounts.
 * Owner and managers only.
 */
export function CustomerPrivacy({ customerId }: { customerId: string }) {
  const say = useTranslations("privacy") as unknown as Say;
  const [state, run, pending] = useActionState(deleteCustomerData, start);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-3">
      <p className="font-medium text-[var(--foreground-secondary)]">{say("customerBody")}</p>
      <a className="secondary-action pressable whitespace-nowrap" download href={`/customers/${customerId}/export`}>
        <Download size={17} />
        {say("customerExport")}
      </a>
      <div className="rounded-xl border border-[var(--danger-line)] p-3">
        <p className="font-medium text-[var(--foreground-secondary)]">{say("customerDeleteBody")}</p>
        {confirming ? (
          <form action={run} className="mt-3 flex flex-wrap gap-2">
            <input name="customerId" type="hidden" value={customerId} />
            <button className="pressable min-h-11 rounded-full bg-[var(--danger)] px-4 font-bold text-white disabled:opacity-60" disabled={pending} type="submit">
              {say("customerDeleteConfirm")}
            </button>
            <button className="secondary-action pressable" onClick={() => setConfirming(false)} type="button">
              {say("deleteCancel")}
            </button>
          </form>
        ) : (
          <button className="pressable mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-bold text-[var(--danger)] hover:bg-[var(--danger-light)]" onClick={() => setConfirming(true)} type="button">
            <Trash2 size={17} />
            {say("customerDelete")}
          </button>
        )}
        {state.error ? <p className="mt-2 font-bold text-[var(--danger)]">{state.error}</p> : null}
      </div>
    </div>
  );
}
