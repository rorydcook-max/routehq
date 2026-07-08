"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, X } from "lucide-react";
import { undoCancellation } from "@/app/actions/bookings";

type Props = {
  rentalId: string;
  organizationId: string;
  vehicleId: string;
  customerName: string | null;
};

export function UndoCancellationButton({
  rentalId,
  organizationId,
  vehicleId,
  customerName,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("organizationId", organizationId);
        fd.set("rentalId", rentalId);
        fd.set("vehicleId", vehicleId);
        await undoCancellation(fd);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to undo cancellation.");
      }
    });
  }

  return (
    <>
      <button
        className="pressable inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#d6e5e2] bg-white px-3 py-2 text-sm font-black text-[#0f766e]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <RotateCcw size={15} />
        Undo cancellation
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[#10252b]/60 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-2xl border border-[#d6e5e2] bg-white shadow-2xl">

            <div className="flex items-start gap-3 rounded-t-2xl border-b border-[#d6e5e2] bg-[#f0fdf9] p-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ccfbf1] text-[#0d9488]">
                <RotateCcw size={17} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black uppercase text-[#0d9488]">Undo cancellation</p>
                <h3 className="text-lg font-black text-[#10252b]">
                  {customerName || "This booking"}
                </h3>
              </div>
              <button
                className="pressable rounded-lg p-1.5 text-[#667085]"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="space-y-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                <p className="text-xs font-black uppercase text-[#667085]">This will restore:</p>
                {[
                  "Booking status → active",
                  "Vehicle re-assigned to this booking",
                  "Future scheduled payments reinstated",
                  "Booking link restored to active",
                ].map((line, i) => (
                  <div className="flex items-start gap-2 text-sm text-[#10252b]" key={i}>
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0d9488]" />
                    {line}
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
                <p className="text-xs font-bold text-[#92400e]">
                  ⚠️ Any refund transactions created during cancellation will remain in your
                  transaction records — reverse those manually if needed.
                </p>
              </div>

              {error && (
                <p className="rounded-xl bg-[#ffe4e6] px-3 py-2 text-sm font-bold text-[#be123c]">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  className="pressable inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white px-4 text-sm font-bold text-[#475569]"
                  disabled={isPending}
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Back
                </button>
                <button
                  className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0d9488] px-4 text-sm font-black text-white disabled:opacity-70"
                  disabled={isPending}
                  onClick={submit}
                  type="button"
                >
                  {isPending ? "Restoring…" : "Confirm — restore booking"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
