"use client";

import { useState, useTransition } from "react";
import { shownError } from "@/lib/error-text";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  compact?: boolean;
  label?: string;
};

// The words for each reason are in the language files (cn_r_<value> and cn_r_<value>_d).
const REASONS: { value: CancelReason }[] = [
  { value: "customer_cancelled_before_delivery" },
  { value: "customer_cancelled_early" },
  { value: "vehicle_breakdown" },
  { value: "operator_cancelled" },
  { value: "other" }
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
  customerName,
  compact = false,
  label
}: Props) {
  const router = useRouter();
  const say = useTranslations("booking") as unknown as (key: string, values?: Record<string, string | number>) => string;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"reason" | "disposition" | "vehicle" | "confirm">("reason");
  const [reasons, setReasons] = useState<CancelReason[]>([]);
  const [refundOption, setRefundOption] = useState<RefundOption | "">("");
  const [partialRefundAmount, setPartialRefundAmount] = useState("");
  const [partialDepositReturn, setPartialDepositReturn] = useState("");
  const [notes, setNotes] = useState("");
  const [cancelledAt, setCancelledAt] = useState("");
  const [collectionDatetime, setCollectionDatetime] = useState("");
  const [vehicleDisposition, setVehicleDisposition] = useState<"available" | "repair" | "keep_assigned">(rentalStatus === "booked" ? "keep_assigned" : "available");
  const [repairNotes, setRepairNotes] = useState("");
  const [repairExpectedEnd, setRepairExpectedEnd] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const hasPayment = totalPaid > 0;
  const hasDeposit = depositHeld > 0;
  const isPreDelivery = rentalStatus === "booked";
  // Before the handover the vehicle never left, so the reasons about ending a rental do not apply.
  const reasonOptions = isPreDelivery ? REASONS.filter((r) => !["customer_cancelled_early", "vehicle_breakdown"].includes(r.value)) : REASONS.filter((r) => r.value !== "customer_cancelled_before_delivery");
  const needsFullFlow = !isPreDelivery || hasPayment || hasDeposit;

  function reset() {
    setStep("reason");
    setReasons([]);
    setRefundOption("");
    setPartialRefundAmount("");
    setPartialDepositReturn("");
    setNotes("");
    setCancelledAt("");
    setCollectionDatetime("");
    setVehicleDisposition("available");
    setRepairNotes("");
    setRepairExpectedEnd("");
    setError("");
    setOpen(false);
  }

  function handleReasonNext() {
    if (reasons.length === 0) { setError(say("cn_pickReason")); return; }
    setError("");
    if (needsFullFlow) {
      setStep("disposition");
    } else {
      setStep(isPreDelivery ? "confirm" : "vehicle");
    }
  }

  function handleDispositionNext() {
    if (!refundOption) { setError(say("cn_pickRefund")); return; }
    if (refundOption.startsWith("partial_refund") && !partialRefundAmount) {
      setError(say("cn_enterRefund")); return;
    }
    setError("");
    setStep(isPreDelivery ? "confirm" : "vehicle");
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
        fd.set("cancelledAt", cancelledAt);
        fd.set("collectionDatetime", collectionDatetime);
        fd.set("vehicleDisposition", vehicleDisposition);
        fd.set("repairNotes", repairNotes);
        fd.set("repairExpectedEnd", repairExpectedEnd);
        await cancelBookingWithDisposition(fd);
        reset();
        router.refresh();
      } catch (err) {
        setError(shownError(err, say("cn_failed")));
      }
    });
  }

  function dispositionSummary() {
    const lines: string[] = [];

    if (needsFullFlow && refundOption) {
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

    if (giveBackRental > 0) lines.push(say("cn_s_refund", { amount: money(giveBackRental, currency) }));
    if (giveBackDeposit > 0) lines.push(say("cn_s_returnDeposit", { amount: money(giveBackDeposit, currency) }));
    if (giveBackDeposit === 0 && hasDeposit) lines.push(say("cn_s_keepDeposit", { amount: money(depositHeld, currency) }));
    if (giveBackRental === 0 && hasPayment) lines.push(say("cn_s_noRefund", { amount: money(totalPaid, currency) }));
    }
    lines.push(say("cn_s_cancelPayments"));
    if (isPreDelivery) {
      // The vehicle never left; nothing to say about it.
    } else if (vehicleDisposition === "available") lines.push(say("cn_s_release"));
    else if (vehicleDisposition === "repair") lines.push(`${say("cn_s_repair")}${repairNotes ? `: ${repairNotes}` : ""}`);
    else lines.push(say("cn_s_unchanged"));

    return lines;
  }

  const selectedReasons = REASONS.filter(r => reasons.includes(r.value));

  const REFUND_OPTIONS = ([
    {
      value: "full_refund_deposit_returned",
      label: say("cn_o1"),
      detail: say("cn_o1_d", { paid: money(totalPaid, currency), deposit: money(depositHeld, currency) }),
      show: hasPayment || hasDeposit
    },
    {
      value: "full_refund_deposit_retained",
      label: say("cn_o2"),
      detail: say("cn_o2_d", { paid: money(totalPaid, currency), deposit: money(depositHeld, currency) }),
      show: hasPayment && hasDeposit
    },
    {
      value: "partial_refund_deposit_returned",
      label: say("cn_o3"),
      detail: say("cn_o3_d"),
      show: hasPayment || hasDeposit
    },
    {
      value: "partial_refund_deposit_retained",
      label: say("cn_o4"),
      detail: say("cn_o4_d"),
      show: hasPayment && hasDeposit
    },
    {
      value: "no_refund_deposit_returned",
      label: say("cn_o5"),
      detail: say("cn_o5_d", { deposit: money(depositHeld, currency) }),
      show: hasDeposit
    },
    {
      value: "no_refund_deposit_retained",
      label: say("cn_o6"),
      detail: say("cn_o6_d"),
      show: hasPayment || hasDeposit
    },
    {
      value: "no_refund_deposit_returned",
      label: say("cn_o7"),
      detail: say("cn_o7_d"),
      show: !hasPayment && !hasDeposit
    },
  ] as { value: RefundOption; label: string; detail: string; show: boolean }[]).filter((o, i, arr) => o.show && arr.findIndex(x => x.value === o.value && x.label === o.label) === i);

  return (
    <>
      <button
        className={
          compact
            ? "pressable inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--danger-line)] bg-[var(--danger-light)] px-3 py-1.5 text-[12px] font-semibold text-[var(--danger)]"
            : "pressable inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]"
        }
        onClick={() => setOpen(true)}
        type="button"
      >
        <XCircle size={compact ? 14 : 16} />
        {label || say("cn_label")}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[var(--foreground)]/60 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--danger-line)] bg-white shadow-2xl">

            <div className="flex items-start gap-3 border-b border-[var(--danger-line)] bg-[var(--danger-light)] p-4 rounded-t-2xl">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--danger-line)] text-[var(--danger)]">
                <AlertTriangle size={18} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase text-[var(--danger)]">{say("cn_label")}</p>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">
                  {customerName ? say("cn_for", { name: customerName }) : say("cn_noCustomer")}
                </h3>
                <div className="mt-1 flex gap-3 text-xs text-[var(--muted)]">
                  {hasPayment && <span>{say("cn_paid", { amount: money(totalPaid, currency) })}</span>}
                  {hasDeposit && <span>{say("cn_depositHeld", { amount: money(depositHeld, currency) })}</span>}
                  {!hasPayment && !hasDeposit && <span>{say("cn_noPayment")}</span>}
                </div>
              </div>
              <button
                className="pressable rounded-lg border border-[var(--danger-line)] bg-white p-1.5 text-[var(--danger)]"
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
                    <p className="text-sm font-semibold text-[var(--foreground)] mb-1">{say("cn_why")}</p>
                    <p className="text-xs text-[var(--muted)] mb-3">{say("cn_selectAll")}</p>
                    <div className="space-y-2">
                      {reasonOptions.map(r => (
                        <button
                          aria-pressed={reasons.includes(r.value)}
                          key={r.value}
                          className={`block w-full cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                            reasons.includes(r.value)
                              ? "border-[var(--danger)] bg-[var(--danger-light)] ring-1 ring-[var(--danger)]/20"
                              : "border-[var(--border)] bg-white hover:border-[var(--danger-line)]"
                          }`}
                          onClick={() => {
                            setReasons(prev =>
                              prev.includes(r.value)
                                ? prev.filter(v => v !== r.value)
                                : [...prev, r.value]
                            );
                            setError("");
                          }}
                          type="button"
                        >
                          <span className="block text-sm font-bold text-[var(--foreground)]">{say(`cn_r_${r.value}`)}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">{say(`cn_r_${r.value}_d`)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <span className="text-xs font-bold text-[var(--foreground-secondary)]">{say("cn_notes")}</span>
                    <textarea
                      className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--danger)] focus:ring-2 focus:ring-[var(--danger)]/10"
                      onChange={e => setNotes(e.target.value)}
                      placeholder={say("cn_notesPlaceholder")}
                      rows={2}
                      value={notes}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-bold text-[var(--foreground-secondary)]">{say("cn_when")}</span>
                      <p className="mb-1 text-[11px] text-[var(--muted)]">
                        {say("cn_whenHint")}
                      </p>
                      <input
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--danger)]"
                        onChange={(event) => setCancelledAt(event.target.value)}
                        type="datetime-local"
                        value={cancelledAt}
                      />
                    </label>
                    {isPreDelivery ? null : (
                    <label className="block">
                      <span className="text-xs font-bold text-[var(--foreground-secondary)]">{say("cn_collect")}</span>
                      <p className="mb-1 text-[11px] text-[var(--muted)]">
                        {say("cn_collectHint")}
                      </p>
                      <input
                        className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--danger)]"
                        onChange={(event) => setCollectionDatetime(event.target.value)}
                        type="datetime-local"
                        value={collectionDatetime}
                      />
                    </label>
                    )}
                  </div>
                </>
              )}

              {step === "disposition" && (
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)] mb-1">{say("cn_how")}</p>
                  <p className="text-xs text-[var(--muted)] mb-3">
                    {say("cn_howHint")}
                  </p>
                  <div className="space-y-2">
                    {REFUND_OPTIONS.map(opt => (
                      <div
                        key={opt.value + opt.label}
                        className={`rounded-xl border transition-colors ${
                          refundOption === opt.value
                            ? "border-[var(--danger)] bg-[var(--danger-light)] ring-1 ring-[var(--danger)]/20"
                            : "border-[var(--border)] bg-white hover:border-[var(--danger-line)]"
                        }`}
                      >
                        <button
                          aria-pressed={refundOption === opt.value}
                          className="block w-full p-3 text-left"
                          onClick={() => {
                            setRefundOption(opt.value);
                            setError("");
                          }}
                          type="button"
                        >
                          <span className="block text-sm font-bold text-[var(--foreground)]">{opt.label}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">{opt.detail}</span>
                        </button>
                        {refundOption === opt.value && opt.value.startsWith("partial_refund") ? (
                          <div className="grid gap-2 border-t border-[var(--danger-line)] px-3 pb-3 pt-3 sm:grid-cols-2">
                            <label className="block">
                              <span className="text-xs font-bold text-[var(--foreground-secondary)]">{say("cn_refundAmount", { currency })}</span>
                              <input
                                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--danger)]"
                                max={totalPaid}
                                min="0"
                                onChange={e => setPartialRefundAmount(e.target.value)}
                                placeholder={`0 – ${totalPaid}`}
                                step="1"
                                type="number"
                                value={partialRefundAmount}
                              />
                            </label>
                            {opt.value === "partial_refund_deposit_retained" && hasDeposit ? (
                              <label className="block">
                                <span className="text-xs font-bold text-[var(--foreground-secondary)]">{say("cn_depositReturned", { currency })}</span>
                                <input
                                  className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--danger)]"
                                  max={depositHeld}
                                  min="0"
                                  onChange={e => setPartialDepositReturn(e.target.value)}
                                  placeholder={`0 – ${depositHeld}`}
                                  step="1"
                                  type="number"
                                  value={partialDepositReturn}
                                />
                              </label>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === "vehicle" && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-[var(--foreground)]">{say("cn_vehQ")}</p>
                  <p className="mb-3 text-xs text-[var(--muted)]">{say("cn_vehHint")}</p>
                  <div className="space-y-2">
                    {([
                      {
                        value: "available" as const,
                        label: say("cn_v_available"),
                        detail: say("cn_v_available_d")
                      },
                      {
                        value: "repair" as const,
                        label: say("cn_v_repair"),
                        detail: say("cn_v_repair_d")
                      },
                      {
                        value: "keep_assigned" as const,
                        label: say("cn_v_keep_assigned"),
                        detail: say("cn_v_keep_assigned_d")
                      }
                    ]).map((option) => (
                      <div
                        className={`rounded-xl border transition-colors ${
                          vehicleDisposition === option.value
                            ? "border-[var(--danger)] bg-[var(--danger-light)] ring-1 ring-[var(--danger)]/20"
                            : "border-[var(--border)] bg-white hover:border-[var(--danger-line)]"
                        }`}
                        key={option.value}
                      >
                        <button
                          aria-pressed={vehicleDisposition === option.value}
                          className="block w-full p-3 text-left"
                          onClick={() => setVehicleDisposition(option.value)}
                          type="button"
                        >
                          <span className="block text-sm font-bold text-[var(--foreground)]">{option.label}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">{option.detail}</span>
                        </button>

                        {vehicleDisposition === "repair" && option.value === "repair" ? (
                          <div className="grid gap-2 border-t border-[var(--danger-line)] px-3 pb-3 pt-3 sm:grid-cols-2">
                            <label className="block">
                              <span className="text-xs font-bold text-[var(--foreground-secondary)]">{say("cn_expectedBack")}</span>
                              <input
                                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--danger)]"
                                onChange={(event) => setRepairExpectedEnd(event.target.value)}
                                type="datetime-local"
                                value={repairExpectedEnd}
                              />
                            </label>
                            <label className="block">
                              <span className="text-xs font-bold text-[var(--foreground-secondary)]">{say("cn_repairNotes")}</span>
                              <input
                                className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-[var(--danger)]"
                                onChange={(event) => setRepairNotes(event.target.value)}
                                placeholder={say("cn_repairPlaceholder")}
                                type="text"
                                value={repairNotes}
                              />
                            </label>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === "confirm" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase text-[var(--muted)]">{say("cn_reason")}</p>
                    <ul className="space-y-0.5">
                      {selectedReasons.map(r => (
                        <li className="text-sm font-bold text-[var(--foreground)]" key={r.value}>• {say(`cn_r_${r.value}`)}</li>
                      ))}
                    </ul>
                    {notes && <p className="text-xs text-[var(--muted)]">"{notes}"</p>}
                  </div>
                  {dispositionSummary().length > 0 && (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
                      <p className="text-xs font-semibold uppercase text-[var(--muted)] mb-2">{say("cn_whatHappens")}</p>
                      <ul className="space-y-1">
                        {dispositionSummary().map((line, i) => (
                          <li className="flex items-start gap-2 text-sm text-[var(--foreground)]" key={i}>
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--danger)]" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
                    <p className="text-xs font-bold text-[var(--warning)]">
                      ⚠️ {say("cn_warning")}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <p className="rounded-xl bg-[var(--danger-light)] px-3 py-2 text-sm font-bold text-[var(--danger)]">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                {step !== "reason" && (
                  <button
                    className="pressable inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-bold text-[var(--foreground-secondary)]"
                    disabled={isPending}
                    onClick={() => {
                      setError("");
                      if (step === "confirm") setStep(isPreDelivery ? (needsFullFlow ? "disposition" : "reason") : "vehicle");
                      else if (step === "vehicle") setStep(needsFullFlow ? "disposition" : "reason");
                      else setStep("reason");
                    }}
                    type="button"
                  >
                    {say("cn_back")}
                  </button>
                )}
                <button
                  className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-bold text-[var(--foreground-secondary)]"
                  disabled={isPending}
                  onClick={reset}
                  type="button"
                >
                  {say("cn_keep")}
                </button>
                {step === "confirm" ? (
                  <button
                    className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--danger)] px-4 text-sm font-semibold text-white disabled:opacity-70"
                    disabled={isPending}
                    onClick={submit}
                    type="button"
                  >
                    {isPending ? (
                      <><span className="spinner" /> {say("cn_cancelling")}</>
                    ) : (
                      say("cn_confirm")
                    )}
                  </button>
                ) : (
                  <button
                    className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--danger)] px-4 text-sm font-semibold text-white"
                    onClick={
                      step === "reason"
                        ? handleReasonNext
                        : step === "disposition"
                          ? handleDispositionNext
                          : () => {
                              setError("");
                              setStep("confirm");
                            }
                    }
                    type="button"
                  >
                    {say("cn_next")}
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
