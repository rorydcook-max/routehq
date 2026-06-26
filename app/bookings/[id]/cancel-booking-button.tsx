"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, XCircle } from "lucide-react";
import { cancelBookingWithDisposition } from "@/app/actions/bookings";

type CancelReason =
  | "customer_cancelled_before_delivery"
  | "customer_cancelled_early"
  | "vehicle_breakdown"
  | "operator_cancelled"
  | "other";

// Multiple reasons can apply simultaneously (e.g. vehicle broke down AND
// customer wanted to cancel). We store as an array and join for the record.

type RefundOption =
  | "full_refund_deposit_returned"
  | "full_refund_deposit_retained"
  | "partial_refund_deposit_returned"
  | "partial_refund_deposit_retained"
  | "no_refund_deposit_returned"
  | "no_refund_deposit_retained";

type Props = {
  rentalId: string;
  organizationId: string;
  vehicleId: string;
  totalPaid: number;
  depositHeld: number;
  currency: string;
  rentalRate: number;
  rentalStatus: string;
  customerName: string | null;
};

const REASONS: { value: CancelReason; label: string; detail: string }[] = [
  {
    value: "customer_cancelled_before_delivery",
    label: "Customer cancelled before delivery",
    detail: "Car never collected or delivered — rental did not start."
  },
  {
    value: "customer_cancelled_early",
    label: "Customer ended rental early",
    detail: "Car was returned before the agreed end date."
  },
  {
    value: "vehicle_breakdown",
    label: "Vehicle breakdown or mechanical issue",
    detail: "Rental cut short due to vehicle fault — not the customer's fault."
  },
  {
    value: "operator_cancelled",
    label: "Operator cancelled",
    detail: "Cancelled at the operator's discretion."
  },
  {
    value: "other",
    label: "Other reason",
    detail: "Specify in the notes field below."
  }
];

function money(amount: number, currency = "THB") {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(amount);
}

export function CancelBookingButton({
  rentalId,
  organizationId,
  vehicleId,
  totalPaid,
  depositHeld,
  currency,
  rentalRate,
  rentalStatus,
  customerName
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"reason" | "disposition" | "confirm">("reason");
  const [reasons, setReasons] = useState<CancelReason[]>([]);
  const [refundOption, setRefundOption] = useState<RefundOption | "">("");
  const [partialRefundAmount, setPartialRefundAmount] = useState("");
  const [partialDepositReturn, setPartialDepositReturn] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const hasPayment = totalPaid > 0;
  const hasDeposit = depositHeld > 0;
  const isPreDelivery = rentalStatus === "booked";
  const needsFullFlow = !isPreDelivery || hasPayment || hasDeposit;

  function reset() {
    setStep("reason");
    setReasons([]);
    setRefundOption("");
    setPartialRefundAmount("");
    setPartialDepositReturn("");
    setNotes("");
    setError("");
    setOpen(false);
  }

  function handleReasonNext() {
    if (reasons.length === 0) { setError("Please select at least one reason."); return; }
    setError("");
    if (needsFullFlow) {
      setStep("disposition");
    } else {
      setStep("confirm");
    }
  }

  function handleDispositionNext() {
    if (!refundOption) { setError("Please select a refund option."); return; }
    if (refundOption.startsWith("partial_refund") && !partialRefundAmount) {
      setError("Please enter the refund amount."); return;
    }
    setError("");
    setStep("confirm");
  }

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("organizationId", organizationId);
        fd.set("rentalId", rentalId);
        fd.set("vehicleId", vehicleId);
        fd.set("reason", reasons.join(","));
        fd.set("refundOption", refundOption);
        fd.set("partialRefundAmount", partialRefundAmount);
        fd.set("partialDepositReturn", partialDepositReturn);
        fd.set("notes", notes);
        await cancelBookingWithDisposition(fd);
        reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cancellation failed.");
      }
    });
  }

  function dispositionSummary() {
    if (!needsFullFlow) return null;
    const lines: string[] = [];
    if (!refundOption) return null;

    const giveBackRental = refundOption.startsWith("full_refund")
      ? totalPaid
      : refundOption.startsWith("partial_refund")
        ? Number(partialRefundAmount || 0)
        : 0;

    const giveBackDeposit = refundOption.endsWith("deposit_returned")
      ? (refundOption.startsWith("partial_refund") && partialDepositReturn
          ? Number(partialDepositReturn)
          : depositHeld)
      : 0;

    if (giveBackRental > 0) lines.push(`Refund ${money(giveBackRental, currency)} to customer`);
    if (giveBackDeposit > 0) lines.push(`Return deposit ${money(giveBackDeposit, currency)}`);
    if (giveBackDeposit === 0 && hasDeposit) lines.push(`Retain deposit ${money(depositHeld, currency)}`);
    if (giveBackRental === 0 && hasPayment) lines.push(`No rental refund — ${money(totalPaid, currency)} retained`);
    lines.push("Mark all unpaid scheduled payments as cancelled");
    lines.push("Release vehicle back to available");

    return lines;
  }

  const selectedReasons = REASONS.filter(r => reasons.includes(r.value));

  const REFUND_OPTIONS = ([
    {
      value: "full_refund_deposit_returned",
      label: "Full refund + deposit returned",
      detail: `Customer receives ${money(totalPaid, currency)} refund and ${money(depositHeld, currency)} deposit back.`,
      show: hasPayment || hasDeposit
    },
    {
      value: "full_refund_deposit_retained",
      label: "Full refund, retain deposit",
      detail: `Customer receives ${money(totalPaid, currency)} refund. Deposit ${money(depositHeld, currency)} kept by operator.`,
      show: hasPayment && hasDeposit
    },
    {
      value: "partial_refund_deposit_returned",
      label: "Partial refund + deposit returned",
      detail: "Operator retains part of the rental payment. Deposit returned in full.",
      show: hasPayment || hasDeposit
    },
    {
      value: "partial_refund_deposit_retained",
      label: "Partial refund, partial/no deposit return",
      detail: "Operator retains part of rental and part or all of deposit.",
      show: hasPayment && hasDeposit
    },
    {
      value: "no_refund_deposit_returned",
      label: "No refund, deposit returned",
      detail: `No rental refund. Deposit ${money(depositHeld, currency)} returned to customer.`,
      show: hasDeposit
    },
    {
      value: "no_refund_deposit_retained",
      label: "No refund, deposit retained",
      detail: `Customer receives nothing back. All funds retained by operator.`,
      show: hasPayment || hasDeposit
    },
    {
      value: "no_refund_deposit_returned",
      label: "No payment to refund — just cancel",
      detail: "No financial transactions to process. Cancel booking and release vehicle.",
      show: !hasPayment && !hasDeposit
    },
  ] as { value: RefundOption; label: string; detail: string; show: boolean }[]).filter((o, i, arr) => o.show && arr.findIndex(x => x.value === o.value && x.label === o.label) === i);

  return (
    <>
      <button
        className="pressable inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-sm font-black text-[#be123c]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <XCircle size={16} />
        Cancel booking
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[#10252b]/60 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-[#fecdd3] bg-white shadow-2xl">

            <div className="flex items-start gap-3 border-b border-[#fecdd3] bg-[#fff1f2] p-4 rounded-t-2xl">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fecdd3] text-[#be123c]">
                <AlertTriangle size={18} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black uppercase text-[#be123c]">Cancel booking</p>
                <h3 className="text-lg font-black text-[#10252b]">
                  {customerName || "This booking"}
                </h3>
                <div className="mt-1 flex gap-3 text-xs text-[#667085]">
                  {hasPayment && <span>Paid: {money(totalPaid, currency)}</span>}
                  {hasDeposit && <span>Deposit held: {money(depositHeld, currency)}</span>}
                  {!hasPayment && !hasDeposit && <span>No payment recorded</span>}
                </div>
              </div>
              <button
                className="pressable rounded-lg border border-[#fecdd3] bg-white p-1.5 text-[#be123c]"
                onClick={reset}
                type="button"
              >
                <XCircle size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">

              {step === "reason" && (
                <>
                  <div>
                    <p className="text-sm font-black text-[#10252b] mb-1">Why is this booking being cancelled?</p>
                    <p className="text-xs text-[#667085] mb-3">Select all that apply.</p>
                    <div className="space-y-2">
                      {REASONS.map(r => (
                        <label
                          key={r.value}
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                            reasons.includes(r.value)
                              ? "border-[#be123c] bg-[#fff1f2]"
                              : "border-[#e2e8f0] bg-white hover:border-[#fecdd3]"
                          }`}
                        >
                          <input
                            checked={reasons.includes(r.value)}
                            className="mt-0.5 accent-[#be123c]"
                            name="reason"
                            onChange={() => {
                              setReasons(prev =>
                                prev.includes(r.value)
                                  ? prev.filter(v => v !== r.value)
                                  : [...prev, r.value]
                              );
                              setError("");
                            }}
                            type="checkbox"
                            value={r.value}
                          />
                          <div>
                            <p className="text-sm font-bold text-[#10252b]">{r.label}</p>
                            <p className="text-xs text-[#667085]">{r.detail}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <span className="text-xs font-bold text-[#475569]">Notes (optional)</span>
                    <textarea
                      className="mt-1 w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#10252b] outline-none focus:border-[#be123c] focus:ring-2 focus:ring-[#be123c]/10"
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Any additional context about this cancellation..."
                      rows={2}
                      value={notes}
                    />
                  </label>
                </>
              )}

              {step === "disposition" && (
                <div>
                  <p className="text-sm font-black text-[#10252b] mb-1">How should payments be handled?</p>
                  <p className="text-xs text-[#667085] mb-3">
                    This records the financial outcome. Actual refund transfers happen outside RouteHQ — this just updates the records.
                  </p>
                  <div className="space-y-2">
                    {REFUND_OPTIONS.map(opt => (
                      <label
                        key={opt.value + opt.label}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                          refundOption === opt.value && opt.label === REFUND_OPTIONS.find(o => o.value === refundOption)?.label
                            ? "border-[#be123c] bg-[#fff1f2]"
                            : "border-[#e2e8f0] bg-white hover:border-[#fecdd3]"
                        }`}
                      >
                        <input
                          checked={refundOption === opt.value}
                          className="mt-0.5 accent-[#be123c]"
                          name="refundOption"
                          onChange={() => { setRefundOption(opt.value); setError(""); }}
                          type="radio"
                          value={opt.value}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-[#10252b]">{opt.label}</p>
                          <p className="text-xs text-[#667085]">{opt.detail}</p>
                          {refundOption === opt.value && opt.value.startsWith("partial_refund") && (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-xs font-bold text-[#475569]">Refund amount ({currency})</span>
                                <input
                                  className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#be123c]"
                                  max={totalPaid}
                                  min="0"
                                  onChange={e => setPartialRefundAmount(e.target.value)}
                                  placeholder={`0 – ${totalPaid}`}
                                  step="1"
                                  type="number"
                                  value={partialRefundAmount}
                                />
                              </label>
                              {opt.value === "partial_refund_deposit_retained" && hasDeposit && (
                                <label className="block">
                                  <span className="text-xs font-bold text-[#475569]">Deposit returned ({currency})</span>
                                  <input
                                    className="mt-1 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm outline-none focus:border-[#be123c]"
                                    max={depositHeld}
                                    min="0"
                                    onChange={e => setPartialDepositReturn(e.target.value)}
                                    placeholder={`0 – ${depositHeld}`}
                                    step="1"
                                    type="number"
                                    value={partialDepositReturn}
                                  />
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {step === "confirm" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-2">
                    <p className="text-xs font-black uppercase text-[#667085]">Reason</p>
                    <ul className="space-y-0.5">
                      {selectedReasons.map(r => (
                        <li className="text-sm font-bold text-[#10252b]" key={r.value}>• {r.label}</li>
                      ))}
                    </ul>
                    {notes && <p className="text-xs text-[#667085]">"{notes}"</p>}
                  </div>
                  {needsFullFlow && dispositionSummary() && (
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3">
                      <p className="text-xs font-black uppercase text-[#667085] mb-2">What will happen</p>
                      <ul className="space-y-1">
                        {dispositionSummary()!.map((line, i) => (
                          <li className="flex items-start gap-2 text-sm text-[#10252b]" key={i}>
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#be123c]" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
                    <p className="text-xs font-bold text-[#92400e]">
                      ⚠️ This cannot be undone. The booking will be permanently cancelled.
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-xl bg-[#ffe4e6] px-3 py-2 text-sm font-bold text-[#be123c]">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                {step !== "reason" && (
                  <button
                    className="pressable inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white px-4 text-sm font-bold text-[#475569]"
                    disabled={isPending}
                    onClick={() => {
                      setError("");
                      setStep(step === "confirm" ? (needsFullFlow ? "disposition" : "reason") : "reason");
                    }}
                    type="button"
                  >
                    Back
                  </button>
                )}
                <button
                  className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 text-sm font-bold text-[#475569]"
                  disabled={isPending}
                  onClick={reset}
                  type="button"
                >
                  Keep booking
                </button>
                {step === "confirm" ? (
                  <button
                    className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#be123c] px-4 text-sm font-black text-white disabled:opacity-70"
                    disabled={isPending}
                    onClick={submit}
                    type="button"
                  >
                    {isPending ? (
                      <><span className="spinner" /> Cancelling…</>
                    ) : (
                      "Confirm cancellation"
                    )}
                  </button>
                ) : (
                  <button
                    className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#be123c] px-4 text-sm font-black text-white"
                    onClick={step === "reason" ? handleReasonNext : handleDispositionNext}
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
