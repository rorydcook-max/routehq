"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { assignCustomerToBooking } from "@/app/actions/bookings";
import { CustomerSelector } from "@/components/customer-selector";

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
  const router = useRouter();

  function handleSubmit() {
    if (!selectedCustomer) {
      setError("Please select a customer first.");
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
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to assign customer.");
      }
    });
  }

  return (
    <>
      <button
        className="pressable inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-black text-[var(--foreground-secondary)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <UserPlus size={16} />
        Assign customer manually
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3 p-6 pb-3">
              <div>
                <h2 className="text-xl font-black text-[#10252b]">Assign customer</h2>
                <p className="mt-1 text-sm leading-6 text-[#667085]">
                  Select an existing customer to link to this booking. Their details will be pre-populated when they open the booking link.
                </p>
              </div>
              <button
                className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[#667085]"
                onClick={() => { setOpen(false); setSelectedCustomer(null); setError(""); }}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 px-6 pb-6">
              <CustomerSelector
                customers={customers}
                organizationId={organizationId}
                name="customerId"
                onSelect={(customer) => { setSelectedCustomer(customer); setError(""); }}
              />
              {error ? (
                <p className="rounded-xl bg-[#ffe4e6] px-4 py-3 text-sm font-semibold text-[#be123c]">{error}</p>
              ) : null}
              <button
                className="pressable inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-black text-white disabled:opacity-70"
                disabled={isPending || !selectedCustomer}
                onClick={handleSubmit}
                type="button"
              >
                {isPending ? <span className="spinner" /> : <UserPlus size={16} />}
                {isPending ? "Assigning..." : "Assign customer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
