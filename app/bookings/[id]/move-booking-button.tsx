"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
import { moveBooking } from "@/app/actions/move-booking";
import type { MoveOption } from "@/lib/extension-picture";

/** For a booking not yet handed over: put it on another vehicle that is free for its dates. */
export function MoveBookingButton({ rentalId, currentVehicleLabel, signed, hasCustomer, options }: { rentalId: string; currentVehicleLabel: string; signed: boolean; hasCustomer: boolean; options: MoveOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState(options[0]?.vehicleId || "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await moveBooking(rentalId, vehicleId);
      if (!result.ok) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        className="pressable inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground-secondary)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <RefreshCw size={15} />
        Change vehicle
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[#10252b]/60 p-3 text-left sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">Change vehicle</p>
                <p className="mt-1 text-sm text-[var(--muted)]">Currently the {currentVehicleLabel}.</p>
              </div>
              <button aria-label="Close" className="pressable rounded-lg p-1.5 text-[var(--muted)]" onClick={() => setOpen(false)} type="button">
                <X size={16} />
              </button>
            </div>
            {options.length === 0 ? (
              <p className="mt-4 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-sm text-[#92400e]">No other vehicle is free for all of this booking&apos;s dates.</p>
            ) : (
              <>
                <label className="mt-4 block text-sm font-semibold text-[var(--foreground-secondary)]">
                  Move it to
                  <select className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal" onChange={(event) => setVehicleId(event.target.value)} value={vehicleId}>
                    {options.map((option) => (
                      <option key={option.vehicleId} value={option.vehicleId}>
                        {option.label}
                        {option.plate ? ` · ${option.plate}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                  These are free for all of the booking&apos;s dates. Dates and price stay the same{hasCustomer ? ", and the customer is told" : ""}.
                  {signed ? ` The signed agreement names the ${currentVehicleLabel}, so check the customer is happy with the change.` : ""}
                </p>
                <button className="primary-action pressable mt-4 w-full justify-center px-3 py-2 disabled:opacity-60" disabled={pending || !vehicleId} onClick={submit} type="button">
                  {pending ? "Moving..." : "Move booking"}
                </button>
              </>
            )}
            {error ? <p className="mt-3 rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
