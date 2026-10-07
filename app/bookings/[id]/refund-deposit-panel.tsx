"use client";

import { useMemo, useState, useTransition } from "react";
import { shownError } from "@/lib/error-text";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Say = (key: string, values?: Record<string, string | number>) => string;
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
  /** Returned before the paid time ran out: the pro-rata refund to consider. */
  earlyReturn?: { amount: number; unusedDays: number; periodDays: number; paid: number } | null;
};

type ActiveForm = "return" | "deduction" | "refund" | null;

function money(value: number, currency = "THB") {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

export function RefundDepositPanel({
  rentalId,
  organizationId,
  vehicleId,
  depositHeld,
  depositRefunded,
  depositForfeited,
  totalPaid,
  currency,
  rentalStatus,
  earlyReturn = null
}: Props) {
  const router = useRouter();
  const t = useTranslations("booking");
  const say = t as unknown as Say;
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
        setError(shownError(caught, say("ref_wrong")));
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
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">{say("ref_title")}</p>
          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">
            {depositHeld > 0
              ? [
                  say("ref_taken", { amount: money(depositHeld, currency) }),
                  depositRefunded > 0 ? say("ref_returned", { amount: money(depositRefunded, currency) }) : null,
                  depositForfeited > 0 ? say("ref_kept", { amount: money(depositForfeited, currency) }) : null,
                  say("ref_held", { amount: money(available, currency) })
                ]
                  .filter(Boolean)
                  .join(" · ")
              : say("ref_none")}
          </p>
          {depositHeld > 0 && available === 0 ? <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{say("ref_settled")}</p> : null}
        </div>
        <button
          className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground-secondary)]"
          type="button"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? say("ref_manage") : say("ref_hide")}
        </button>
      </div>

      {!collapsed ? (
        <>
          {earlyReturn && canRefundPayment ? (
            <div className="mt-3 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3 text-sm text-[var(--warning)]">
              <p>
                {t.rich("ref_early", {
                  days: earlyReturn.unusedDays,
                  amount: money(earlyReturn.amount, currency),
                  paid: money(earlyReturn.paid, currency),
                  unused: earlyReturn.unusedDays,
                  period: earlyReturn.periodDays,
                  b: (chunks: React.ReactNode) => <span className="font-semibold">{chunks}</span>
                })}
              </p>
              <button className="pressable mt-2 rounded-lg border border-[var(--warning-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--warning)]" onClick={() => openForm("refund")} type="button">
                {say("ref_earlyButton", { amount: money(earlyReturn.amount, currency) })}
              </button>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {canUseDeposit ? (
              <>
                <button
                  className="pressable rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white"
                  type="button"
                  onClick={() => openForm("return")}
                >
                  {say("ref_returnDeposit")}
                </button>
                <button
                  className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)]"
                  type="button"
                  onClick={() => openForm("deduction")}
                >
                  {say("ref_recordDeduction")}
                </button>
              </>
            ) : null}
            {canRefundPayment ? (
              <button
                className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground)]"
                type="button"
                onClick={() => openForm("refund")}
              >
                {say("ref_refundPayment")}
              </button>
            ) : null}
            {!canUseDeposit && !canRefundPayment ? (
              <p className="text-sm font-semibold text-[var(--muted)]">{say("ref_nothing")}</p>
            ) : null}
          </div>

          {activeForm === "return" ? (
            <form
              className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                submit(new FormData(event.currentTarget), say("ref_depositReturned"), returnDeposit);
              }}
            >
              <label className="block text-xs font-bold text-[var(--foreground-secondary)]">
                {say("ref_amountReturn")}
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
                {say("ref_how")}
                <select className="mt-1 w-full" defaultValue="cash" name="paymentMethod">
                  <option value="cash">{say("ref_cash")}</option>
                  <option value="bank_transfer">{say("ref_bank")}</option>
                  <option value="promptpay">{say("ref_promptpay")}</option>
                </select>
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--foreground-secondary)]">
                {say("ref_notes")}
                <textarea className="mt-1 w-full" name="notes" placeholder={say("ref_optionalNotes")} />
              </label>
              <FormActions isPending={isPending} label={say("ref_confirmReturn")} onCancel={() => setActiveForm(null)} />
            </form>
          ) : null}

          {activeForm === "deduction" ? (
            <form
              className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                submit(new FormData(event.currentTarget), say("ref_deductionRecorded"), applyDepositDeduction);
              }}
            >
              <label className="block text-xs font-bold text-[var(--foreground-secondary)]">
                {say("ref_deductionAmount")}
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
                {say("ref_reason")}
                <input className="mt-1 w-full" name="reason" placeholder={say("ref_reasonPlaceholder")} required type="text" />
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--foreground-secondary)]">
                {say("ref_notes")}
                <textarea className="mt-1 w-full" name="notes" placeholder={say("ref_optionalNotes")} />
              </label>
              <FormActions isPending={isPending} label={say("ref_confirmDeduction")} onCancel={() => setActiveForm(null)} />
            </form>
          ) : null}

          {activeForm === "refund" ? (
            <form
              className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                submit(new FormData(event.currentTarget), say("ref_refundRecorded"), recordPaymentRefund);
              }}
            >
              <label className="block text-xs font-bold text-[var(--foreground-secondary)]">
                {say("ref_refundAmount")}
                <input
                  className="mt-1 w-full"
                  defaultValue={earlyReturn ? Math.min(earlyReturn.amount, totalPaid) : totalPaid}
                  max={totalPaid}
                  min={0.01}
                  name="amount"
                  step="0.01"
                  type="number"
                />
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--foreground-secondary)]">
                {say("ref_how")}
                <select className="mt-1 w-full" defaultValue="cash" name="paymentMethod">
                  <option value="cash">{say("ref_cash")}</option>
                  <option value="bank_transfer">{say("ref_bank")}</option>
                  <option value="promptpay">{say("ref_promptpay")}</option>
                </select>
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--foreground-secondary)]">
                {say("ref_reasonNotes")}
                <textarea className="mt-1 w-full" defaultValue={earlyReturn ? say("ref_unusedNote", { unused: earlyReturn.unusedDays, period: earlyReturn.periodDays }) : ""} name="notes" placeholder={say("ref_refundReason")} />
              </label>
              <FormActions isPending={isPending} label={say("ref_confirmRefund")} onCancel={() => setActiveForm(null)} />
            </form>
          ) : null}

          {message ? <p className="mt-3 rounded-lg bg-[var(--success-light)] px-3 py-2 text-sm font-semibold text-[var(--success)]">{message}</p> : null}
          {error ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
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
  const say = useTranslations("booking") as unknown as Say;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        className="pressable rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? say("saving") : label}
      </button>
      <button
        className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground-secondary)]"
        disabled={isPending}
        type="button"
        onClick={onCancel}
      >
        {say("cancelBtn")}
      </button>
    </div>
  );
}
