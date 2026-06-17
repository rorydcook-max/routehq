"use client";

import { useMemo, useState, useTransition } from "react";
import { adjustRental } from "@/app/actions/bookings";

type AdjustmentType = "extension" | "early_return";

function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function parseAmount(value: string) {
  return Number(String(value || "").replace(/[^\d.-]/g, "")) || 0;
}

function formatAmountInput(value: string) {
  const amount = parseAmount(value);
  return amount ? amount.toLocaleString("en-US") : "";
}

function money(value: unknown) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function tomorrowDate() {
  return startOfDay(addDays(new Date(), 1));
}

function daysBetween(from: string | null | undefined, to: string | null | undefined) {
  if (!from || !to) return 0;
  const start = startOfDay(new Date(from));
  const end = startOfDay(new Date(to));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function defaultExtensionEndDate(currentEndDate?: string | null) {
  const current = currentEndDate ? new Date(currentEndDate) : new Date();
  const base = Number.isNaN(current.getTime()) ? new Date() : current;
  const next = addDays(base, 30);
  return isoDate(next < tomorrowDate() ? tomorrowDate() : next);
}

function defaultEarlyReturnDate(currentStartDate?: string | null, currentEndDate?: string | null) {
  const today = isoDate(new Date());
  const start = dateInputValue(currentStartDate);
  const end = dateInputValue(currentEndDate);
  if (end && today > end) return end;
  if (start && today < start) return start;
  return today;
}

function OptionCard({
  selected,
  title,
  description,
  icon,
  tone,
  onClick
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: string;
  tone: "teal" | "amber";
  onClick: () => void;
}) {
  const activeClass = tone === "teal" ? "border-[var(--primary)] bg-[#ecfeff]" : "border-[var(--warning)] bg-[#fffbeb]";

  return (
    <button
      className={`pressable flex min-h-24 flex-1 items-start gap-3 rounded-xl border p-3 text-left transition ${selected ? activeClass : "border-[var(--border)] bg-white hover:border-[var(--border-strong)]"}`}
      onClick={onClick}
      type="button"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone === "teal" ? "bg-[#ccfbf1] text-[var(--primary)]" : "bg-[#fef3c7] text-[var(--warning)]"}`}>
        <i aria-hidden="true" className={`ti ${icon} text-base`} />
      </span>
      <span>
        <span className="block text-[13px] font-bold text-[var(--foreground)]">{title}</span>
        <span className="mt-1 block text-[11px] leading-5 text-[var(--muted)]">{description}</span>
      </span>
    </button>
  );
}

function CurrencyInput({
  value,
  onChange,
  placeholder = "0"
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="mt-1 flex h-9 items-center rounded-lg border border-[var(--border-strong)] bg-white focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[rgba(14,116,144,0.12)]">
      <span className="shrink-0 pl-3 pr-1 font-mono-data text-[13px] font-bold text-[var(--foreground-secondary)]">THB</span>
      <input
        className="font-mono-data h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-[13px] text-[var(--foreground)] outline-none"
        inputMode="numeric"
        onBlur={() => onChange(formatAmountInput(value))}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}

export function RentalAdjustmentModal({
  rentalId,
  currentStartDate,
  currentEndDate,
  currentRate,
  vehicleLabel,
  customerName,
  onClose,
  onSuccess
}: {
  rentalId: string;
  currentStartDate?: string | null;
  currentEndDate?: string | null;
  currentRate?: number | null;
  vehicleLabel: string;
  customerName: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("extension");
  const [extensionEndDate, setExtensionEndDate] = useState(() => defaultExtensionEndDate(currentEndDate));
  const [earlyReturnDate, setEarlyReturnDate] = useState(() => defaultEarlyReturnDate(currentStartDate, currentEndDate));
  const [extensionAmount, setExtensionAmount] = useState("");
  const [extensionDueDate, setExtensionDueDate] = useState(() => dateInputValue(currentEndDate) || isoDate(new Date()));
  const [advancePaid, setAdvancePaid] = useState(false);
  const [advancePaidAmount, setAdvancePaidAmount] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const tomorrow = useMemo(() => isoDate(tomorrowDate()), []);
  const startDate = dateInputValue(currentStartDate);
  const originalEndDate = dateInputValue(currentEndDate);
  const extensionDays = daysBetween(currentEndDate, extensionEndDate);
  const earlyReturnDays = daysBetween(earlyReturnDate, currentEndDate);
  const dailyRate = Math.round(Number(currentRate || 0) / 30);
  const suggestedRefund = Math.round(earlyReturnDays * (Number(currentRate || 0) / 30));

  function updateAdvanceAmount(value: string) {
    setAdvancePaidAmount(value);
    setRefundAmount(formatAmountInput(value));
  }

  function submit() {
    setMessage("");
    const newEndDate = adjustmentType === "extension" ? extensionEndDate : earlyReturnDate;

    startTransition(async () => {
      try {
        const result = await adjustRental({
          rentalId,
          adjustmentType,
          newEndDate,
          extensionPaymentAmount: parseAmount(extensionAmount),
          extensionPaymentDueDate: extensionDueDate || undefined,
          advancePaidAmount: advancePaid ? parseAmount(advancePaidAmount) : 0,
          refundAmount: advancePaid ? parseAmount(refundAmount) : 0,
          refundReason,
          note
        });

        if (!result?.success) {
          throw new Error("Unable to adjust rental.");
        }

        setMessage(adjustmentType === "extension" ? "Rental extended" : "Rental adjusted");
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1000);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to adjust rental.");
      }
    });
  }

  const isExtension = adjustmentType === "extension";
  const submitDisabled = isPending || (isExtension ? !extensionEndDate : !earlyReturnDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/35 px-4 py-6" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-[var(--foreground)]">Adjust rental period</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {customerName || "Customer"} - {vehicleLabel || "Vehicle"}
            </p>
          </div>
          <button className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--muted)]" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <OptionCard
            description="Move the return date further out and record an extension payment"
            icon="ti-calendar-plus"
            onClick={() => setAdjustmentType("extension")}
            selected={isExtension}
            title="Extend rental"
            tone="teal"
          />
          <OptionCard
            description="Return the vehicle early and issue a partial refund if applicable"
            icon="ti-calendar-minus"
            onClick={() => setAdjustmentType("early_return")}
            selected={!isExtension}
            title="Early return / Reduce period"
            tone="amber"
          />
        </div>

        <div className="mt-4 space-y-3">
          {isExtension ? (
            <>
              <label className="block">
                New return date
                <input className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" min={tomorrow} onChange={(event) => setExtensionEndDate(event.target.value)} type="date" value={extensionEndDate} />
              </label>

              <div className="rounded-lg border border-[#d6e5e2] bg-[#f8fffd] p-3 text-sm text-[var(--foreground-secondary)]">
                Extension: <span className="font-mono-data font-bold">{originalEndDate || "Open"}</span> to <span className="font-mono-data font-bold">{extensionEndDate}</span> ({extensionDays} days)
              </div>

              <label className="block">
                Agreed payment for this extension
                <CurrencyInput onChange={setExtensionAmount} value={extensionAmount} />
                <span className="mt-1 block text-[11px] text-[var(--muted)]">Total amount agreed for this specific period - not a recurring rate. If 0 or blank, no payment record is created.</span>
              </label>

              <label className="block">
                Payment due
                <input className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setExtensionDueDate(event.target.value)} type="date" value={extensionDueDate} />
                <span className="mt-1 block text-[11px] text-[var(--muted)]">Typically the day the current period ends.</span>
              </label>

              <label className="block">
                Internal note
                <input className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setNote(event.target.value)} placeholder="Optional" type="text" value={note} />
              </label>

              <div className="rounded-xl border border-[#99f6e4] bg-[#ecfeff] p-3 text-sm font-bold text-[#0f766e]">
                Extending {extensionDays} days - {money(parseAmount(extensionAmount))} due {extensionDueDate || "not set"}
              </div>
            </>
          ) : (
            <>
              <label className="block">
                Actual return date
                <input
                  className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]"
                  max={originalEndDate || undefined}
                  min={startDate || undefined}
                  onChange={(event) => setEarlyReturnDate(event.target.value)}
                  type="date"
                  value={earlyReturnDate}
                />
              </label>

              <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-sm text-[#92400e]">
                Returning {earlyReturnDays} days early ({originalEndDate || "Open"} to {earlyReturnDate})
              </div>

              <div>
                <p className="text-[11px] font-medium text-[var(--foreground-secondary)]">Was rent paid in advance for the remaining period?</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button className={`pressable rounded-lg border px-3 py-2 text-sm font-bold ${advancePaid ? "border-[var(--primary)] bg-[#ecfeff] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`} onClick={() => setAdvancePaid(true)} type="button">
                    Yes
                  </button>
                  <button className={`pressable rounded-lg border px-3 py-2 text-sm font-bold ${!advancePaid ? "border-[var(--primary)] bg-[#ecfeff] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`} onClick={() => setAdvancePaid(false)} type="button">
                    No
                  </button>
                </div>
              </div>

              {advancePaid ? (
                <>
                  <label className="block">
                    Amount paid that covers the remaining {earlyReturnDays} days
                    <CurrencyInput onChange={updateAdvanceAmount} value={advancePaidAmount} />
                    <span className="mt-1 block text-[11px] text-[var(--muted)]">How much did the customer pay that covered the period after the actual return date?</span>
                    <span className="mt-1 block text-[11px] font-bold text-[#0f766e]">
                      Suggestion: {money(suggestedRefund)} ({earlyReturnDays} days x {money(dailyRate)}/day at current monthly rate)
                    </span>
                  </label>

                  <label className="block">
                    Refund to customer
                    <CurrencyInput onChange={setRefundAmount} value={refundAmount} />
                    <span className="mt-1 block text-[11px] text-[var(--muted)]">Amount to return to the customer. Can be less than the advance payment if deductions apply.</span>
                  </label>

                  <label className="block">
                    Reason or deductions note
                    <input className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setRefundReason(event.target.value)} placeholder="e.g. Full refund for unused period / Kept THB 2,000 early termination fee" type="text" value={refundReason} />
                  </label>
                </>
              ) : null}

              <label className="block">
                Internal note
                <input className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setNote(event.target.value)} placeholder="Optional" type="text" value={note} />
              </label>

              <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3 text-sm font-bold text-[#92400e]">
                Returning {earlyReturnDays} days early - {advancePaid && parseAmount(refundAmount) > 0 ? `Refunding ${money(parseAmount(refundAmount))} to customer` : "No refund"}
              </div>
            </>
          )}
        </div>

        {message ? (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-bold ${message.includes("extended") || message.includes("adjusted") ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--danger-light)] text-[var(--danger)]"}`}>
            {message}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button className="pressable min-h-11 flex-1 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-[var(--foreground-secondary)]" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="pressable min-h-11 flex-1 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            disabled={submitDisabled}
            onClick={submit}
            type="button"
          >
            {isPending ? "Saving..." : isExtension ? "Extend rental" : "Record early return"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RentalAdjustmentButton({
  rentalId,
  currentStartDate,
  currentEndDate,
  currentRate,
  vehicleLabel,
  customerName,
  label = "Adjust",
  className = "pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-black text-[var(--foreground-secondary)]"
}: {
  rentalId: string;
  currentStartDate?: string | null;
  currentEndDate?: string | null;
  currentRate?: number | null;
  vehicleLabel: string;
  customerName: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={className} onClick={() => setOpen(true)} type="button">
        <i aria-hidden="true" className="ti ti-calendar-event text-sm" />
        {label}
      </button>
      {open ? (
        <RentalAdjustmentModal
          currentEndDate={currentEndDate}
          currentRate={currentRate}
          currentStartDate={currentStartDate}
          customerName={customerName}
          rentalId={rentalId}
          vehicleLabel={vehicleLabel}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      ) : null}
    </>
  );
}
