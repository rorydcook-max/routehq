"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyDepositDeduction, returnDeposit } from "@/app/actions/deposits";
import { recordPaymentRefund } from "@/app/actions/bookings";

type Props = {
  rentalId: string;
  organizationId: string;
  vehicleId: string;
  depositHeld: number;
  depositRefunded: number;
  depositForfeited: number;
  depositStatus: string;
  totalPaid: number;
  currency: string;
  rentalStatus: string;
};

type ActiveForm = "return" | "deduction" | "refund" | null;

function money(value: number, currency = "THB") {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function statusLabel(status: string) {
  return String(status || "pending").replace(/_/g, " ");
}

export function RefundDepositPanel({
  rentalId,
  organizationId,
  vehicleId,
  depositHeld,
  depositRefunded,
  depositForfeited,
  depositStatus,
  totalPaid,
  currency,
  rentalStatus
}: Props) {
  const router = useRouter();
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const available = useMemo(
    () => Math.max(0, Number(depositHeld || 0) - Number(depositRefunded || 0) - Number(depositForfeited || 0)),
    [depositHeld, depositRefunded, depositForfeited]
  );
  const canUseDeposit = depositHeld > 0 && available > 0;
  const canRefundPayment = totalPaid > 0;

  function openForm(form: ActiveForm) {
    setError(null);
    setMessage(null);
    setActiveForm((current) => (current === form ? null : form));
    setCollapsed(false);
  }

  function submit(formData: FormData, successMessage: string, action: (formData: FormData) => Promise<void>) {
    formData.set("organizationId", organizationId);
    formData.set("rentalId", rentalId);
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        await action(formData);
        setActiveForm(null);
        setMessage(successMessage);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Something went wrong.");
      }
    });
  }

  return (
    <div
      className="rounded-xl border border-[var(--border)] bg-white p-3"
      data-rental-status={rentalStatus}
      data-vehicle-id={vehicleId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Refunds & deposit</p>
          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
            Deposit held: {money(depositHeld, currency)} <span className="text-[var(--muted)]">·</span> Returned: {money(depositRefunded, currency)}{" "}
            <span className="text-[var(--muted)]">·</span> Available: {money(available, currency)}
          </p>
          <p className="mt-1 text-xs font-semibold capitalize text-[var(--muted)]">Deposit status: {statusLabel(depositStatus)}</p>
        </div>
        <button
          className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground-secondary)]"
          type="button"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? "Manage" : "Hide"}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {canUseDeposit ? (
              <>
                <button
                  className="pressable rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white"
                  type="button"
                  onClick={() => openForm("return")}
                >
                  Return deposit
                </button>
                <button
                  className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)]"
                  type="button"
                  onClick={() => openForm("deduction")}
                >
                  Record deduction
                </button>
              </>
            ) : null}
            {canRefundPayment ? (
              <button
                className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)]"
                type="button"
                onClick={() => openForm("refund")}
              >
                Refund payment
              </button>
            ) : null}
            {!canUseDeposit && !canRefundPayment ? (
              <p className="text-sm font-semibold text-[var(--muted)]">No deposit balance or rental payment is available to refund.</p>
            ) : null}
          </div>

          {activeForm === "return" ? (
            <form
              className="mt-3 rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                submit(new FormData(event.currentTarget), "Deposit returned", returnDeposit);
              }}
            >
              <label className="block text-xs font-bold text-[var(--foreground-secondary)]">
                Amount to return
                <input
                  className="mt-1 w-full"
                  defaultValue={available}
                  max={available}
                  min={0.01}
                  name="returnAmount"
                  step="0.01"
                  type="number"
                />
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--foreground-secondary)]">
                Notes
                <textarea className="mt-1 w-full" name="notes" placeholder="Optional notes" />
              </label>
              <FormActions isPending={isPending} label="Confirm return" onCancel={() => setActiveForm(null)} />
            </form>
          ) : null}

          {activeForm === "deduction" ? (
            <form
              className="mt-3 rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                submit(new FormData(event.currentTarget), "Deduction recorded", applyDepositDeduction);
              }}
            >
              <label className="block text-xs font-bold text-[var(--foreground-secondary)]">
                Deduction amount
                <input
                  className="mt-1 w-full"
                  max={available}
                  min={0.01}
                  name="deductionAmount"
                  step="0.01"
                  type="number"
                />
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--foreground-secondary)]">
                Reason
                <input className="mt-1 w-full" name="reason" placeholder="Damage, late return, unpaid rent..." required type="text" />
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--foreground-secondary)]">
                Notes
                <textarea className="mt-1 w-full" name="notes" placeholder="Optional notes" />
              </label>
              <FormActions isPending={isPending} label="Confirm deduction" onCancel={() => setActiveForm(null)} />
            </form>
          ) : null}

          {activeForm === "refund" ? (
            <form
              className="mt-3 rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                submit(new FormData(event.currentTarget), "Refund recorded", recordPaymentRefund);
              }}
            >
              <label className="block text-xs font-bold text-[var(--foreground-secondary)]">
                Refund amount
                <input
                  className="mt-1 w-full"
                  defaultValue={totalPaid}
                  max={totalPaid}
                  min={0.01}
                  name="amount"
                  step="0.01"
                  type="number"
                />
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--foreground-secondary)]">
                Reason / notes
                <textarea className="mt-1 w-full" name="notes" placeholder="Optional reason for this refund" />
              </label>
              <FormActions isPending={isPending} label="Confirm refund" onCancel={() => setActiveForm(null)} />
            </form>
          ) : null}

          {message ? <p className="mt-3 rounded-lg bg-[#ecfdf3] px-3 py-2 text-sm font-semibold text-[#027a48]">{message}</p> : null}
          {error ? <p className="mt-3 rounded-lg bg-[#fef2f2] px-3 py-2 text-sm font-semibold text-[#be123c]">{error}</p> : null}
        </>
      ) : null}
    </div>
  );
}

function FormActions({
  isPending,
  label,
  onCancel
}: {
  isPending: boolean;
  label: string;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        className="pressable rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Saving..." : label}
      </button>
      <button
        className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground-secondary)]"
        disabled={isPending}
        type="button"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}
