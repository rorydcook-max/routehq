"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Ban } from "lucide-react";
import { updateCustomer as updateCustomerAction } from "@/app/actions/customers";
import { unwrap } from "@/lib/action-result";
import { shownError } from "@/lib/error-text";

// A save that fails hands back its reason (lib/action-error.ts); these throw it, for the catch blocks below to show.
const updateCustomer = (...args: Parameters<typeof updateCustomerAction>) => unwrap(updateCustomerAction(...args));

/**
 * "Don't rent to them again", with a reason. Shown on the customer's page; when
 * set, the booking form and the booking warn whoever picks this customer.
 */
export function DoNotRent({
  customerId,
  organizationId,
  on,
  reason,
  place
}: {
  customerId: string;
  organizationId: string;
  on: boolean;
  reason: string | null;
  /** The warning sits under the name; the quiet link to set it sits under the actions. */
  place: "banner" | "control";
}) {
  const say = useTranslations("customerPage") as unknown as (key: string, values?: Record<string, string>) => string;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const save = (value: boolean) =>
    start(async () => {
      const data = new FormData();
      data.set("customerId", customerId);
      data.set("organizationId", organizationId);
      data.set("doNotRent", value ? "true" : "false");
      if (value) data.set("doNotRentReason", text.trim());
      setError("");
      // A save that fails says why (it used to fail without a word).
      try {
        await updateCustomer(data);
      } catch (caught) {
        setError(shownError(caught, say("dnr_failed")));
        return;
      }
      setOpen(false);
    });
  const errorLine = error ? (
    <p className="mt-2 w-full font-semibold text-[var(--danger)]" role="alert">
      {error}
    </p>
  ) : null;

  if (place === "banner" && !on) return null;
  if (place === "control" && on) return null;

  if (on) {
    return (
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-light)] p-3" role="alert">
        <p className="flex items-start gap-2 font-bold text-[var(--danger)]">
          <Ban className="mt-0.5 shrink-0" size={18} />
          <span>
            {say("dnr_on")}
            {reason ? <span className="block font-semibold">{reason}</span> : null}
          </span>
        </p>
        <button className="font-bold text-[var(--primary)] underline" disabled={pending} onClick={() => save(false)} type="button">
          {say("dnr_remove")}
        </button>
        {errorLine}
      </div>
    );
  }

  if (!open) {
    return (
      <button className="tap-target inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--danger)]" onClick={() => setOpen(true)} type="button">
        <Ban size={15} />
        {say("dnr_add")}
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl bg-[var(--panel-secondary)] p-3">
      <label className="block">
        <span className="font-semibold text-[var(--foreground-secondary)]">{say("dnr_reason")}</span>
        <input autoFocus className="mt-1 w-full" maxLength={200} onChange={(event) => setText(event.target.value)} placeholder={say("dnr_placeholder")} value={text} />
      </label>
      <div className="mt-3 flex gap-2">
        <button className="pressable min-h-11 flex-1 rounded-full bg-[var(--danger)] px-3 font-bold text-white disabled:opacity-60" disabled={pending} onClick={() => save(true)} type="button">
          {say("dnr_save")}
        </button>
        <button className="secondary-action pressable flex-1" onClick={() => setOpen(false)} type="button">
          {say("dnr_cancel")}
        </button>
      </div>
      {errorLine}
    </div>
  );
}
