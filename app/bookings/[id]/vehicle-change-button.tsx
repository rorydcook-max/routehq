"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw, X } from "lucide-react";
import { createVehicleChange, getVehicleChangeOptions, type VehicleChangeOptions } from "@/app/actions/amendments";
import { AmendmentLinkPanel } from "@/components/rental-adjustment-modal";

// These are saved on the form the customer signs, so the saved text stays as it is; only what staff see is translated.
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
  const say = useTranslations("booking") as unknown as (key: string, values?: Record<string, string | number>) => string;
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<VehicleChangeOptions | null>(null);
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState<"available" | "repair">("available");
  const [newRate, setNewRate] = useState("");
  const [topUp, setTopUp] = useState<"require" | "waive">("require");
  const [signLater, setSignLater] = useState(false);
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

  // The replacement normally carries a bigger deposit than this rental has.
  const depositGap = options && free && options.needsSignature ? Math.max(0, free.deposit - options.currentDeposit) : 0;

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
        newRate: newRate ? Number(newRate) : null,
        newDeposit: depositGap > 0 && topUp === "require" ? free!.deposit : null,
        signLater: signLater && !swap
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
        {say("vc_button")}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-[var(--foreground)]/60 p-3 text-left sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">{say("vc_button")}</p>
                {/* Once the change is prepared the "now on" line would name the old vehicle. */}
                {options && links.length === 0 ? <p className="mt-1 text-sm text-[var(--muted)]">{say("vc_current", { vehicle: options.currentVehicleLabel })}</p> : null}
              </div>
              <button aria-label={say("vc_close")} className="pressable rounded-lg p-1.5 text-[var(--muted)]" onClick={close} type="button">
                <X size={16} />
              </button>
            </div>

            {!options && !error ? <p className="mt-4 text-sm text-[var(--muted)]">{say("vc_checking")}</p> : null}

            {links.length > 0 ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-[var(--foreground-secondary)]">
                  {links.length > 1
                    ? say("vc_doneBoth")
                    : signLater
                      ? say("vc_doneLater")
                      : options?.handedOver
                      ? say("vc_doneHanded")
                      : say("vc_doneBooked")}
                </p>
                {links.map((link) => (
                  <div key={link.token}>
                    <p className="mb-1 text-xs font-bold uppercase text-[var(--muted)]">{say("vc_for", { name: link.customerName })}</p>
                    <AmendmentLinkPanel changedAlready={signLater && links.length === 1} token={link.token} />
                  </div>
                ))}
                <button className="secondary-action pressable w-full justify-center px-3 py-2" onClick={close} type="button">
                  {say("vc_done")}
                </button>
              </div>
            ) : options ? (
              options.free.length === 0 && options.swaps.length === 0 ? (
                <p className="mt-4 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3 text-sm text-[var(--warning)]">{say("vc_noneFree")}</p>
              ) : (
                <>
                  <label className={labelClass}>
                    {say("vc_replacement")}
                    <select className={field} onChange={(event) => setChoice(event.target.value)} value={choice}>
                      {options.free.length ? (
                        <optgroup label={say("vc_groupFree")}>
                          {options.free.map((item) => (
                            <option key={item.vehicleId} value={`free:${item.vehicleId}`}>
                              {item.label}
                              {item.plate ? ` · ${item.plate}` : ""}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {options.swaps.length ? (
                        <optgroup label={say("vc_groupSwap")}>
                          {options.swaps.map((item) => (
                            <option key={item.rentalId} value={`swap:${item.rentalId}`}>
                              {item.label}
                              {item.plate ? ` · ${item.plate}` : ""} {say("vc_with", { name: item.customerName })}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </select>
                  </label>
                  {swap ? (
                    <p className="mt-2 rounded-lg bg-[var(--panel-secondary)] p-3 text-xs leading-5 text-[var(--foreground-secondary)]">
                      {say("vc_swapNote", { name: swap.customerName, current: options.currentVehicleLabel, other: swap.label })}
                    </p>
                  ) : null}

                  {options.needsSignature ? (
                    <>
                      <label className={labelClass}>
                        {say("vc_reasonLabel")}
                        <select className={field} onChange={(event) => setReason(event.target.value)} value={reason}>
                          <option value="">{say("vc_notStated")}</option>
                          {REASONS.filter((item) => (swap ? true : item !== "Exchange between customers")).map((item) => (
                            <option key={item} value={item}>
                              {say(`vc_reason_${REASONS.indexOf(item)}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {options.handedOver && !swap ? (
                        <label className={labelClass}>
                          {say("vc_onceCollected", { vehicle: options.currentVehicleLabel })}
                          <select className={field} onChange={(event) => setDisposition(event.target.value as "available" | "repair")} value={disposition}>
                            <option value="available">{say("vc_available")}</option>
                            <option value="repair">{say("vc_repair")}</option>
                          </select>
                        </label>
                      ) : null}
                      {!swap ? (
                        <label className={labelClass}>
                          {say("vc_rateLabel", { amount: money(options.currentRate) })}
                          <input className={field} inputMode="numeric" min="0" onChange={(event) => setNewRate(event.target.value)} placeholder={String(options.currentRate)} type="number" value={newRate} />
                        </label>
                      ) : null}
                      {depositGap > 0 && free ? (
                        <label className={labelClass}>
                          {say("vc_depositLabel", { vehicle: free.label, normal: money(free.deposit), current: money(options.currentDeposit) })}
                          <select className={field} onChange={(event) => setTopUp(event.target.value as "require" | "waive")} value={topUp}>
                            <option value="require">{say("vc_askTopUp", { amount: money(depositGap) })}</option>
                            <option value="waive">{say("vc_waive", { amount: money(options.currentDeposit) })}</option>
                          </select>
                        </label>
                      ) : null}
                      {options.handedOver && !swap ? (
                        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
                          <input checked={signLater} className="mt-1 accent-[var(--primary)]" onChange={(event) => setSignLater(event.target.checked)} type="checkbox" />
                          <span className="text-sm text-[var(--foreground-secondary)]">
                            <span className="block font-semibold text-[var(--foreground)]">{say("vc_cantSign")}</span>
                            {say("vc_cantSignBody")}
                          </span>
                        </label>
                      ) : null}
                      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                        {signLater && !swap
                          ? say("vc_noteLater")
                          : options.handedOver
                          ? say("vc_noteHanded")
                          : say("vc_noteBooked")}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{say("vc_noteUnsigned")}</p>
                  )}

                  <button className="primary-action pressable mt-4 w-full justify-center px-3 py-2 disabled:opacity-60" disabled={pending || (!swap && !free)} onClick={submit} type="button">
                    {pending ? say("vc_working") : options.needsSignature ? (swap ? say("vc_prepareTwo") : signLater ? say("vc_changeNow") : say("vc_prepare")) : say("vc_move")}
                  </button>
                </>
              )
            ) : null}
            {error ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
