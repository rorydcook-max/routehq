"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Ban } from "lucide-react";
import { updateCustomer } from "@/app/actions/customers";

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

  const save = (value: boolean) =>
    start(async () => {
      const data = new FormData();
      data.set("customerId", customerId);
      data.set("organizationId", organizationId);
      data.set("doNotRent", value ? "true" : "false");
      if (value) data.set("doNotRentReason", text.trim());
      await updateCustomer(data);
      setOpen(false);
    });

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
      </div>
    );
  }

  if (!open) {
    return (
      <button className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--danger)]" onClick={() => setOpen(true)} type="button">
        <Ban size={15} />
        {say("dnr_add")}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
      <label className="block">
        <span className="font-semibold text-[var(--foreground-secondary)]">{say("dnr_reason")}</span>
        <input autoFocus className="mt-1 w-full" maxLength={200} onChange={(event) => setText(event.target.value)} placeholder={say("dnr_placeholder")} value={text} />
      </label>
      <p className="mt-2 text-sm text-[var(--muted)]">{say("dnr_hint")}</p>
      <div className="mt-3 flex gap-2">
        <button className="pressable min-h-11 flex-1 rounded-lg bg-[var(--danger)] px-3 font-bold text-white disabled:opacity-60" disabled={pending} onClick={() => save(true)} type="button">
          {say("dnr_save")}
        </button>
        <button className="secondary-action pressable flex-1" onClick={() => setOpen(false)} type="button">
          {say("dnr_cancel")}
        </button>
      </div>
    </div>
  );
}
