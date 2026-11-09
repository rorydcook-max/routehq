"use client";

import { useState, useTransition } from "react";
import { shownError } from "@/lib/error-text";
import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { assignCustomerToBooking as assignCustomerToBookingAction } from "@/app/actions/bookings";
import { CustomerSelector } from "@/components/customer-selector";
import { ModalSheet } from "@/components/modal-sheet";
import { unwrap } from "@/lib/action-result";

// A save that fails hands back its reason (lib/action-error.ts); these throw it, for the catch blocks below to show.
const assignCustomerToBooking = (...args: Parameters<typeof assignCustomerToBookingAction>) => unwrap(assignCustomerToBookingAction(...args));

type SelectorCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  nationality: string | null;
  document_status?: string | null;
};

export function AssignCustomerModal({
  customers,
  organizationId,
  rentalId
}: {
  customers: SelectorCustomer[];
  organizationId: string;
  rentalId: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectorCustomer | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const say = useTranslations("booking") as unknown as (key: string) => string;

  function handleSubmit() {
    if (!selectedCustomer) {
      setError(say("assign_pick"));
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("organizationId", organizationId);
        formData.set("rentalId", rentalId);
        formData.set("customerId", selectedCustomer.id);
        await assignCustomerToBooking(formData);
        setOpen(false);
      } catch (err) {
        setError(shownError(err, say("assign_failed")));
      }
    });
  }

  return (
    <>
      <button
        className="pressable inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground-secondary)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <UserPlus size={16} />
        {say("assign_open")}
      </button>

      {/* The shared dialog (components/modal-sheet.tsx). "Add a new customer" inside it opens its own dialog on top. */}
      {open ? (
        <ModalSheet
          closeLabel={say("closeLabel")}
          dismissable={!isPending}
          footer={
            <div className="space-y-2">
              {error ? (
                <p className="rounded-xl bg-[var(--danger-light)] px-4 py-3 text-sm font-semibold text-[var(--danger)]" role="alert">{error}</p>
              ) : null}
              <button
                className="pressable inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
                disabled={isPending || !selectedCustomer}
                onClick={handleSubmit}
                type="button"
              >
                {isPending ? <span className="spinner" /> : <UserPlus size={16} />}
                {isPending ? say("assign_busy") : say("assign_submit")}
              </button>
            </div>
          }
          onClose={() => { setOpen(false); setSelectedCustomer(null); setError(""); }}
          open
          title={say("assign_title")}
        >
          <CustomerSelector
            customers={customers}
            organizationId={organizationId}
            name="customerId"
            onSelect={(customer) => { setSelectedCustomer(customer); setError(""); }}
          />
        </ModalSheet>
      ) : null}
    </>
  );
}
