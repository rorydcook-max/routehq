"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
import { changeVehicle } from "@/app/actions/bookings";

type VehicleOption = {
  id: string;
  make: string;
  model: string;
  trim: string | null;
  year: number | null;
  registration_number: string;
  monthly_rate: number;
};

type Props = {
  rentalId: string;
  organizationId: string;
  currentVehicleId: string;
  currentVehicleLabel: string;
  currentRate: number;
  currency: string;
  availableVehicles: VehicleOption[];
};

type Step = "reason" | "disposition" | "replacement" | "rate" | "confirm";

type Reason = "breakdown" | "customer_swap" | "scheduled_service" | "other";

const REASONS = [
  { value: "breakdown" as Reason, label: "Vehicle breakdown / mechanical failure", detail: "Vehicle is inoperable and a replacement must be provided." },
  { value: "customer_swap" as Reason, label: "Customer requested swap", detail: "Customer prefers a different vehicle." },
  { value: "scheduled_service" as Reason, label: "Scheduled service / temporary replacement", detail: "Vehicle going for service — temp replacement while it's away." },
  { value: "other" as Reason, label: "Other reason", detail: "Specify in notes below." },
];

type Disposition = "repair" | "available" | "keep_assigned";

const DISPOSITIONS = [
  { value: "repair" as Disposition, label: "Send to repair / maintenance", detail: "Vehicle needs work before it can be rented again." },
  { value: "available" as Disposition, label: "Return to available", detail: "Vehicle is in good order and can be rented immediately." },
  { value: "keep_assigned" as Disposition, label: "Keep current status", detail: "No change — I'll manage the vehicle status manually." },
];

const STEPS: Step[] = ["reason", "disposition", "replacement", "rate", "confirm"];

function vehicleLabel(v: VehicleOption) {
  return `${v.make} ${v.model}${v.trim ? " " + v.trim : ""} ${v.year || ""} · ${v.registration_number}`.trim();
}

export function ChangeVehicleButton({
  rentalId,
  organizationId,
  currentVehicleId,
  currentVehicleLabel,
  currentRate,
  currency,
  availableVehicles,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("reason");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  // Step 1 — Reason
  const [reasons, setReasons] = useState<Reason[]>([]);
  const [reasonNotes, setReasonNotes] = useState("");
  const [changedAt, setChangedAt] = useState("");

  // Step 2 — Original vehicle disposition
  const [disposition, setDisposition] = useState<Disposition>("repair");
  const [repairNotes, setRepairNotes] = useState("");
  const [repairExpectedEnd, setRepairExpectedEnd] = useState("");

  // Step 3 — Replacement vehicle
  const [replacementId, setReplacementId] = useState("");

  // Step 4 — Rate
  const [keepRate, setKeepRate] = useState(true);
  const [newRate, setNewRate] = useState(String(currentRate));

  const replacement = availableVehicles.find((v) => v.id === replacementId);

  function reset() {
    setOpen(false);
    setStep("reason");
    setReasons([]);
    setReasonNotes("");
    setChangedAt("");
    setDisposition("repair");
    setRepairNotes("");
    setRepairExpectedEnd("");
    setReplacementId("");
    setKeepRate(true);
    setNewRate(String(currentRate));
    setError("");
  }

  function next() {
    setError("");
    if (step === "reason") {
      if (reasons.length === 0) { setError("Select at least one reason."); return; }
      setStep("disposition");
    } else if (step === "disposition") {
      setStep("replacement");
    } else if (step === "replacement") {
      if (!replacementId) { setError("Select a replacement vehicle."); return; }
      setStep("rate");
    } else if (step === "rate") {
      if (!keepRate && (!newRate || Number(newRate) <= 0)) { setError("Enter a valid rate."); return; }
      setStep("confirm");
    }
  }

  function back() {
    setError("");
    if (step === "disposition") setStep("reason");
    else if (step === "replacement") setStep("disposition");
    else if (step === "rate") setStep("replacement");
    else if (step === "confirm") setStep("rate");
  }

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("rentalId", rentalId);
        fd.set("organizationId", organizationId);
        fd.set("replacementVehicleId", replacementId);
        fd.set("reason", reasons.join(","));
        fd.set("reasonNotes", reasonNotes);
        fd.set("changedAt", changedAt);
        fd.set("originalVehicleDisposition", disposition);
        fd.set("repairNotes", repairNotes);
        fd.set("repairExpectedEnd", repairExpectedEnd);
        fd.set("keepRate", String(keepRate));
        fd.set("newRate", keepRate ? String(currentRate) : newRate);
        await changeVehicle(fd);
        reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to change vehicle.");
      }
    });
  }

  const rateAfter = keepRate ? currentRate : Number(newRate || currentRate);

  return (
    <>
      <button
        className="pressable inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-black text-[var(--foreground-secondary)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <RefreshCw size={15} />
        Change vehicle
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[#10252b]/60 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-[#d6e5e2] bg-white shadow-2xl">

            {/* Header */}
            <div className="flex items-start gap-3 rounded-t-2xl border-b border-[#d6e5e2] bg-[#f0fdf9] p-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ccfbf1] text-[#0d9488]">
                <RefreshCw size={17} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black uppercase text-[#0d9488]">Change vehicle</p>
                <p className="text-lg font-black text-[#10252b]">{currentVehicleLabel}</p>
                <p className="text-xs text-[#667085]">
                  Step {STEPS.indexOf(step) + 1} of {STEPS.length}
                </p>
              </div>
              <button className="pressable rounded-lg p-1.5 text-[#667085]" onClick={reset} type="button">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-4">

              {/* Step 1 — Reason */}
              {step === "reason" && (
                <>
                  <div>
                    <p className="mb-1 text-sm font-black text-[#10252b]">Why is the vehicle being changed?</p>
                    <p className="mb-3 text-xs text-[#667085]">Select all that apply.</p>
                    <div className="space-y-2">
                      {REASONS.map((r) => (
                        <label key={r.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${reasons.includes(r.value) ? "border-[#0d9488] bg-[#f0fdf9]" : "border-[#e2e8f0] bg-white hover:border-[#99f6e4]"}`}>
                          <input
                            checked={reasons.includes(r.value)}
                            className="mt-0.5 accent-[#0d9488]"
                            onChange={() => setReasons((prev) => prev.includes(r.value) ? prev.filter((v) => v !== r.value) : [...prev, r.value])}
                            type="checkbox"
                          />
                          <div>
                            <p className="text-sm font-bold text-[#10252b]">{r.label}</p>
                            <p className="text-xs text-[#667085]">{r.detail}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold text-[#475569]">Date & time of change</span>
                      <p className="text-[11px] text-[#667085]">Leave blank for now. Set if recording retrospectively.</p>
                      <input className="mt-1 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0d9488]" onChange={(e) => setChangedAt(e.target.value)} type="datetime-local" value={changedAt} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-bold text-[#475569]">Notes (optional)</span>
                      <textarea className="mt-1 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0d9488]" onChange={(e) => setReasonNotes(e.target.value)} placeholder="Any additional context..." rows={3} value={reasonNotes} />
                    </label>
                  </div>
                </>
              )}

              {/* Step 2 — Original vehicle disposition */}
              {step === "disposition" && (
                <div>
                  <p className="mb-1 text-sm font-black text-[#10252b]">What happens to <span className="text-[#0d9488]">{currentVehicleLabel}</span>?</p>
                  <p className="mb-3 text-xs text-[#667085]">This updates its status in your fleet.</p>
                  <div className="space-y-2">
                    {DISPOSITIONS.map((d) => (
                      <label key={d.value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${disposition === d.value ? "border-[#0d9488] bg-[#f0fdf9]" : "border-[#e2e8f0] bg-white hover:border-[#99f6e4]"}`}>
                        <input checked={disposition === d.value} className="mt-0.5 accent-[#0d9488]" onChange={() => setDisposition(d.value)} type="radio" />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-[#10252b]">{d.label}</p>
                          <p className="text-xs text-[#667085]">{d.detail}</p>
                          {disposition === "repair" && d.value === "repair" && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-xs font-bold text-[#475569]">Expected back</span>
                                <input className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0d9488]" onChange={(e) => setRepairExpectedEnd(e.target.value)} type="datetime-local" value={repairExpectedEnd} />
                              </label>
                              <label className="block">
                                <span className="text-xs font-bold text-[#475569]">Repair notes</span>
                                <input className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none" onChange={(e) => setRepairNotes(e.target.value)} placeholder="e.g. Gearbox replacement" type="text" value={repairNotes} />
                              </label>
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3 — Select replacement */}
              {step === "replacement" && (
                <div>
                  <p className="mb-1 text-sm font-black text-[#10252b]">Select replacement vehicle</p>
                  <p className="mb-3 text-xs text-[#667085]">Showing vehicles not currently on active rentals.</p>
                  {availableVehicles.length === 0 ? (
                    <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
                      <p className="text-sm font-bold text-[#92400e]">No available vehicles</p>
                      <p className="mt-1 text-xs text-[#667085]">All other vehicles are currently assigned. Return a vehicle to available first.</p>
                    </div>
                  ) : (
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {availableVehicles.map((v) => (
                        <label key={v.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${replacementId === v.id ? "border-[#0d9488] bg-[#f0fdf9]" : "border-[#e2e8f0] bg-white hover:border-[#99f6e4]"}`}>
                          <input checked={replacementId === v.id} className="accent-[#0d9488]" onChange={() => setReplacementId(v.id)} type="radio" />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-[#10252b]">{vehicleLabel(v)}</p>
                            <p className="text-xs text-[#667085]">฿{Number(v.monthly_rate || 0).toLocaleString()}/month</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 4 — Rate */}
              {step === "rate" && (
                <div>
                  <p className="mb-1 text-sm font-black text-[#10252b]">Rental rate for the replacement</p>
                  <p className="mb-3 text-xs text-[#667085]">Current rate: <strong>฿{currentRate.toLocaleString()} {currency}</strong></p>
                  <div className="space-y-2">
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${keepRate ? "border-[#0d9488] bg-[#f0fdf9]" : "border-[#e2e8f0] bg-white hover:border-[#99f6e4]"}`}>
                      <input checked={keepRate} className="mt-0.5 accent-[#0d9488]" onChange={() => setKeepRate(true)} type="radio" />
                      <div>
                        <p className="text-sm font-bold text-[#10252b]">Keep existing rate — ฿{currentRate.toLocaleString()} {currency}</p>
                        <p className="text-xs text-[#667085]">Rate stays the same. Typical for breakdown replacements.</p>
                      </div>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${!keepRate ? "border-[#0d9488] bg-[#f0fdf9]" : "border-[#e2e8f0] bg-white hover:border-[#99f6e4]"}`}>
                      <input checked={!keepRate} className="mt-0.5 accent-[#0d9488]" onChange={() => setKeepRate(false)} type="radio" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[#10252b]">Update rate</p>
                        <p className="text-xs text-[#667085]">Adjust for upgrade, downgrade, or different vehicle class.</p>
                        {!keepRate && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm text-[#475569]">฿</span>
                            <input
                              className="w-36 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#0d9488]"
                              min="0"
                              onChange={(e) => setNewRate(e.target.value)}
                              placeholder="New rate"
                              step="1"
                              type="number"
                              value={newRate}
                            />
                            <span className="text-sm text-[#475569]">{currency}</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Step 5 — Confirm */}
              {step === "confirm" && (
                <div className="space-y-3">
                  <div className="space-y-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                    <p className="text-xs font-black uppercase text-[#667085]">Summary</p>
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2 text-sm text-[#10252b]">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0d9488]" />
                        Remove <strong>{currentVehicleLabel}</strong> from this booking
                      </li>
                      <li className="flex items-start gap-2 text-sm text-[#10252b]">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0d9488]" />
                        {disposition === "repair"
                          ? `Send ${currentVehicleLabel} to repair${repairNotes ? `: ${repairNotes}` : ""}`
                          : disposition === "available"
                          ? `Return ${currentVehicleLabel} to available`
                          : `${currentVehicleLabel} — status unchanged`}
                      </li>
                      <li className="flex items-start gap-2 text-sm text-[#10252b]">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0d9488]" />
                        Assign <strong>{replacement ? vehicleLabel(replacement) : replacementId}</strong> to this booking
                      </li>
                      {rateAfter !== currentRate && (
                        <li className="flex items-start gap-2 text-sm text-[#10252b]">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0d9488]" />
                          Update future payments: ฿{currentRate.toLocaleString()} → ฿{rateAfter.toLocaleString()} {currency}
                        </li>
                      )}
                      <li className="flex items-start gap-2 text-sm text-[#10252b]">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0d9488]" />
                        Reason: {reasons.map((r) => REASONS.find((x) => x.value === r)?.label).join(" + ")}
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-xl bg-[#ffe4e6] px-3 py-2 text-sm font-bold text-[#be123c]">{error}</p>
              )}

              {/* Footer */}
              <div className="flex gap-2 pt-1">
                {step !== "reason" && (
                  <button className="pressable inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white px-4 text-sm font-bold text-[#475569]" disabled={isPending} onClick={back} type="button">
                    Back
                  </button>
                )}
                <button className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 text-sm font-bold text-[#475569]" disabled={isPending} onClick={reset} type="button">
                  Cancel
                </button>
                {step === "confirm" ? (
                  <button
                    className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0d9488] px-4 text-sm font-black text-white disabled:opacity-70"
                    disabled={isPending}
                    onClick={submit}
                    type="button"
                  >
                    {isPending ? "Changing…" : "Confirm change"}
                  </button>
                ) : (
                  <button
                    className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#0d9488] px-4 text-sm font-black text-white"
                    disabled={availableVehicles.length === 0 && step === "replacement"}
                    onClick={next}
                    type="button"
                  >
                    Next →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
