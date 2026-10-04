"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
import { createVehicleChange, getVehicleChangeOptions, type VehicleChangeOptions } from "@/app/actions/amendments";
import { AmendmentLinkPanel } from "@/components/rental-adjustment-modal";

const REASONS = ["Breakdown or fault", "Customer asked for a different vehicle", "Service or repair due", "Exchange between customers", "Other"];

/**
 * Change the vehicle on a booking or a rental, on one screen. Once the customer
 * has signed anything they sign a short change form first; after a handover
 * that is followed by a handover form for the replacement and a collection
 * form for the original. A vehicle out with another customer can be exchanged:
 * both customers sign.
 */
export function VehicleChangeButton({ rentalId }: { rentalId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<VehicleChangeOptions | null>(null);
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState<"available" | "repair">("available");
  const [newRate, setNewRate] = useState("");
  const [links, setLinks] = useState<Array<{ token: string; customerName: string }>>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function load() {
    setOpen(true);
    setError("");
    setLinks([]);
    setOptions(null);
    startTransition(async () => {
      const result = await getVehicleChangeOptions(rentalId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOptions(result);
      setChoice(result.free[0] ? `free:${result.free[0].vehicleId}` : result.swaps[0] ? `swap:${result.swaps[0].rentalId}` : "");
    });
  }

  function close() {
    setOpen(false);
    if (links.length) router.refresh();
  }

  const swap = choice.startsWith("swap:") ? options?.swaps.find((item) => item.rentalId === choice.slice(5)) : null;
  const free = choice.startsWith("free:") ? options?.free.find((item) => item.vehicleId === choice.slice(5)) : null;
  const money = (amount: number) => `${!options || options.currency === "THB" ? "฿" : `${options.currency} `}${Math.round(amount).toLocaleString("en-US")}`;

  function submit() {
    if (!options || (!swap && !free)) return;
    setError("");
    startTransition(async () => {
      const result = await createVehicleChange({
        rentalId,
        vehicleId: swap ? swap.vehicleId : free!.vehicleId,
        swapRentalId: swap ? swap.rentalId : null,
        reason: reason || (swap ? "Exchange between customers" : null),
        disposition,
        newRate: newRate ? Number(newRate) : null
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.applied) {
        setOpen(false);
        router.refresh();
        return;
      }
      setLinks(result.links);
    });
  }

  const field = "mt-2 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal";
  const labelClass = "mt-4 block text-sm font-semibold text-[var(--foreground-secondary)]";

  return (
    <>
      <button
        className="pressable inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground-secondary)]"
        onClick={load}
        type="button"
      >
        <RefreshCw size={15} />
        Change vehicle
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-[#10252b]/60 p-3 text-left sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">Change vehicle</p>
                {options ? <p className="mt-1 text-sm text-[var(--muted)]">Currently the {options.currentVehicleLabel}.</p> : null}
              </div>
              <button aria-label="Close" className="pressable rounded-lg p-1.5 text-[var(--muted)]" onClick={close} type="button">
                <X size={16} />
              </button>
            </div>

            {!options && !error ? <p className="mt-4 text-sm text-[var(--muted)]">Checking which vehicles are free...</p> : null}

            {links.length > 0 ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {links.length > 1
                    ? "Each customer signs a short change form. The vehicles are exchanged in RouteHQ once both have signed; then you complete a handover and a collection form with each of them."
                    : options?.handedOver
                      ? "The customer signs a short change form. Once they have, you complete a handover form for the replacement and a collection form for the original."
                      : "The customer signs a short change form. The booking moves to the new vehicle once they have."}
                </p>
                {links.map((link) => (
                  <div key={link.token}>
                    <p className="mb-1 text-xs font-bold uppercase text-[var(--muted)]">For {link.customerName}</p>
                    <AmendmentLinkPanel token={link.token} />
                  </div>
                ))}
                <button className="secondary-action pressable w-full justify-center px-3 py-2" onClick={close} type="button">
                  Done
                </button>
              </div>
            ) : options ? (
              options.free.length === 0 && options.swaps.length === 0 ? (
                <p className="mt-4 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-sm text-[#92400e]">No other vehicle is free for all of this rental&apos;s dates.</p>
              ) : (
                <>
                  <label className={labelClass}>
                    Replacement
                    <select className={field} onChange={(event) => setChoice(event.target.value)} value={choice}>
                      {options.free.length ? (
                        <optgroup label="Free for these dates">
                          {options.free.map((item) => (
                            <option key={item.vehicleId} value={`free:${item.vehicleId}`}>
                              {item.label}
                              {item.plate ? ` · ${item.plate}` : ""}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {options.swaps.length ? (
                        <optgroup label="Exchange with another customer">
                          {options.swaps.map((item) => (
                            <option key={item.rentalId} value={`swap:${item.rentalId}`}>
                              {item.label}
                              {item.plate ? ` · ${item.plate}` : ""} (with {item.customerName})
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </select>
                  </label>
                  {swap ? (
                    <p className="mt-2 rounded-lg bg-[#fbfaf8] p-3 text-xs leading-5 text-[var(--foreground-secondary)]">
                      {swap.customerName} gets the {options.currentVehicleLabel} and this customer gets the {swap.label}. Both keep their dates and prices, and both sign.
                    </p>
                  ) : null}

                  {options.needsSignature ? (
                    <>
                      <label className={labelClass}>
                        Reason (shown on the form the customer signs)
                        <select className={field} onChange={(event) => setReason(event.target.value)} value={reason}>
                          <option value="">Not stated</option>
                          {REASONS.filter((item) => (swap ? true : item !== "Exchange between customers")).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>
                      {options.handedOver && !swap ? (
                        <label className={labelClass}>
                          The {options.currentVehicleLabel}, once collected
                          <select className={field} onChange={(event) => setDisposition(event.target.value as "available" | "repair")} value={disposition}>
                            <option value="available">Is available to rent again</option>
                            <option value="repair">Goes for repair</option>
                          </select>
                        </label>
                      ) : null}
                      {!swap ? (
                        <label className={labelClass}>
                          Rate from now on (leave empty to keep {money(options.currentRate)})
                          <input className={field} inputMode="numeric" min="0" onChange={(event) => setNewRate(event.target.value)} placeholder={String(options.currentRate)} type="number" value={newRate} />
                        </label>
                      ) : null}
                      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                        {options.handedOver
                          ? "The customer signs a short form with only this change on it. Nothing changes until they sign. Then a handover form for the replacement and a collection form for the original appear on To do."
                          : "The customer has signed for the current vehicle, so they sign a short form with only this change on it. The booking moves once they sign."}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Nothing has been signed yet, so the booking simply moves. Dates and price stay the same.</p>
                  )}

                  <button className="primary-action pressable mt-4 w-full justify-center px-3 py-2 disabled:opacity-60" disabled={pending || (!swap && !free)} onClick={submit} type="button">
                    {pending ? "Working..." : options.needsSignature ? (swap ? "Prepare the two change forms" : "Prepare the change form") : "Move booking"}
                  </button>
                </>
              )
            ) : null}
            {error ? <p className="mt-3 rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
