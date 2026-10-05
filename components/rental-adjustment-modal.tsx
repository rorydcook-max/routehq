"use client";

import { quoteStay, type Rates } from "@/lib/rental-estimate";
import { useEffect, useMemo, useState, useTransition } from "react";
import { adjustRental } from "@/app/actions/bookings";
import { cancelRentalAmendment, createRentalAmendment, getRentalAmendmentContext, makeRentalOpenEnded, type AmendmentSummary } from "@/app/actions/amendments";

type AdjustmentType = "extension" | "early_return" | "terms";

type AmendmentContext = {
  agreementSigned: boolean;
  signingGaps: string[];
  pending: AmendmentSummary | null;
  currentRate: number;
  currentDeposit: number;
  currency: string;
  billingPeriod: string;
  rates?: Rates;
  onRent?: boolean;
};

/** The link the customer signs, with ways to send it. */
export function AmendmentLinkPanel({ token, onCancel, cancelling, changedAlready = false }: { token: string; onCancel?: () => void; cancelling?: boolean; /** The vehicle was changed ahead of the signature. */ changedAlready?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/amend/${token}`;
  const message = `Please review and sign the change to your rental: ${url}`;
  return (
    <div className="rounded-xl border border-[#bfe0db] bg-[var(--primary-light)] p-3 text-sm">
      <p className="font-bold text-[var(--primary)]">Waiting for the customer to sign</p>
      <p className="mt-1 text-[12px] text-[var(--foreground-secondary)]">{changedAlready ? "The vehicle has already been changed; they still need to sign for it. Send them this link:" : "Nothing changes on the rental until they sign. Send them this link:"}</p>
      <p className="font-mono-data mt-2 break-all rounded-lg bg-white px-2 py-1.5 text-[12px]">{url}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          className="pressable rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white"
          onClick={() => {
            navigator.clipboard?.writeText(url).then(() => setCopied(true), () => undefined);
          }}
          type="button"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground-secondary)]" href={`https://wa.me/?text=${encodeURIComponent(message)}`} rel="noreferrer" target="_blank">
          Send on WhatsApp
        </a>
        <a className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground-secondary)]" href={url} rel="noreferrer" target="_blank">
          Preview
        </a>
        {onCancel ? (
          <button className="pressable rounded-lg border border-[#fecdd3] bg-white px-3 py-2 text-xs font-semibold text-[#be123c] disabled:opacity-60" disabled={cancelling} onClick={onCancel} type="button">
            {cancelling ? "Cancelling..." : "Cancel amendment"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

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
  const activeClass = tone === "teal" ? "border-[var(--primary)] bg-[var(--primary-light)]" : "border-[var(--warning)] bg-[#fffbeb]";

  return (
    <button
      className={`pressable flex min-h-24 flex-1 items-start gap-3 rounded-xl border p-3 text-left transition ${selected ? activeClass : "border-[var(--border)] bg-white hover:border-[var(--border-strong)]"}`}
      onClick={onClick}
      type="button"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone === "teal" ? "bg-[var(--primary-light)] text-[var(--primary)]" : "bg-[#fef3c7] text-[var(--warning)]"}`}>
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
  const [context, setContext] = useState<AmendmentContext | null>(null);
  const [needsSignature, setNeedsSignature] = useState(true);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [newRate, setNewRate] = useState("");
  const [rateFrom, setRateFrom] = useState(() => isoDate(new Date()));
  const [newDeposit, setNewDeposit] = useState("");
  const [depositDueDate, setDepositDueDate] = useState(() => isoDate(new Date()));
  const [additionalTerms, setAdditionalTerms] = useState("");
  const [cancelling, startCancel] = useTransition();

  useEffect(() => {
    let live = true;
    getRentalAmendmentContext(rentalId).then((result) => {
      if (!live || !result.ok) return;
      setContext(result);
      if (result.pending) {
        setPendingToken(result.pending.token);
        setPendingId(result.pending.id);
      }
    });
    return () => {
      live = false;
    };
  }, [rentalId]);

  const agreementSigned = Boolean(context?.agreementSigned);
  const signingBlocked = agreementSigned && (context?.signingGaps.length || 0) > 0;
  const useAmendment = agreementSigned && (adjustmentType === "terms" || (adjustmentType === "extension" && needsSignature));

  function cancelPending() {
    if (!pendingId) return;
    startCancel(async () => {
      const result = await cancelRentalAmendment(pendingId);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setPendingId(null);
      setPendingToken(null);
      onSuccess?.();
    });
  }

  function submitAmendment() {
    setMessage("");
    startTransition(async () => {
      const isTerms = adjustmentType === "terms";
      const result = await createRentalAmendment({
        rentalId,
        newEndDate: isTerms ? null : extensionEndDate,
        extensionAmount: isTerms ? null : parseAmount(extensionAmount),
        extensionDueDate: isTerms ? null : extensionDueDate,
        newRate: isTerms && newRate.trim() ? parseAmount(newRate) : null,
        rateFrom: isTerms ? rateFrom : null,
        newDeposit: isTerms && newDeposit.trim() ? parseAmount(newDeposit) : null,
        depositDueDate: isTerms ? depositDueDate : null,
        additionalTerms
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setPendingToken(result.token);
      const refreshed = await getRentalAmendmentContext(rentalId);
      if (refreshed.ok) {
        setContext(refreshed);
        setPendingId(refreshed.pending?.id || null);
      }
    });
  }

  function makeOpenEnded() {
    setMessage("");
    startTransition(async () => {
      const result = await makeRentalOpenEnded(rentalId).catch(() => ({ ok: false as const, error: "Unable to change the rental." }));
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Now monthly, open-ended");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    });
  }

  const tomorrow = useMemo(() => isoDate(tomorrowDate()), []);
  const startDate = dateInputValue(currentStartDate);
  const originalEndDate = dateInputValue(currentEndDate);
  const extensionDays = daysBetween(currentEndDate, extensionEndDate);
  const earlyReturnDays = daysBetween(earlyReturnDate, currentEndDate);
  const extensionQuote = context?.rates && extensionDays > 0 ? quoteStay(context.rates, extensionDays) : null;
  const dailyRate = Math.round(Number(currentRate || 0) / 30);
  const suggestedRefund = Math.round(earlyReturnDays * (Number(currentRate || 0) / 30));

  function updateAdvanceAmount(value: string) {
    setAdvancePaidAmount(value);
    setRefundAmount(formatAmountInput(value));
  }

  function submit() {
    if (useAmendment) {
      submitAmendment();
      return;
    }
    if (adjustmentType === "terms") return;
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
          setMessage(result?.error || "Unable to adjust rental.");
          return;
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
  const isTerms = adjustmentType === "terms";
  const showPendingPanel = Boolean(pendingToken) && adjustmentType !== "early_return";
  const submitDisabled =
    isPending ||
    showPendingPanel ||
    (useAmendment && signingBlocked) ||
    (isTerms ? !newRate.trim() && !newDeposit.trim() : isExtension ? !extensionEndDate : !earlyReturnDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/35 px-4 py-6" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-[var(--foreground)]">{agreementSigned ? "Change rental" : "Adjust rental period"}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {customerName || "Customer"} - {vehicleLabel || "Vehicle"}
            </p>
          </div>
          <button className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--muted)]" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className={`mt-4 grid gap-3 ${agreementSigned ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
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
            selected={adjustmentType === "early_return"}
            title="Early return / Reduce period"
            tone="amber"
          />
          {agreementSigned ? (
            <OptionCard
              description="Change the rate or deposit. The customer signs an amendment"
              icon="ti-file-pencil"
              onClick={() => setAdjustmentType("terms")}
              selected={isTerms}
              title="Change rate or deposit"
              tone="teal"
            />
          ) : null}
        </div>

        {signingBlocked && adjustmentType !== "early_return" ? (
          <p className="mt-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[12px] font-bold text-[#92400e]">
            Customers can&apos;t sign online until you add {context?.signingGaps.join(", ")} in Settings.
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {showPendingPanel && pendingToken ? (
            <AmendmentLinkPanel cancelling={cancelling} onCancel={pendingId ? cancelPending : undefined} token={pendingToken} />
          ) : isTerms ? (
            <>
              <label className="block">
                New rate ({context?.billingPeriod || "monthly"})
                <CurrencyInput onChange={setNewRate} placeholder={String(context?.currentRate ?? currentRate ?? "")} value={newRate} />
                <span className="mt-1 block text-[11px] text-[var(--muted)]">
                  Now {money(context?.currentRate ?? currentRate)}. Leave blank to keep it.
                </span>
              </label>
              {newRate.trim() ? (
                <label className="block">
                  New rate applies to payments due from
                  <input className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setRateFrom(event.target.value)} type="date" value={rateFrom} />
                </label>
              ) : null}
              <label className="block">
                New deposit
                <CurrencyInput onChange={setNewDeposit} placeholder={String(context?.currentDeposit ?? "")} value={newDeposit} />
                <span className="mt-1 block text-[11px] text-[var(--muted)]">
                  Now {money(context?.currentDeposit)}. Leave blank to keep it. An increase is added as a payment due; a decrease is returned at the end of the rental.
                </span>
              </label>
              {parseAmount(newDeposit) > Number(context?.currentDeposit || 0) ? (
                <label className="block">
                  Extra deposit due
                  <input className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setDepositDueDate(event.target.value)} type="date" value={depositDueDate} />
                </label>
              ) : null}
              <label className="block">
                Extra terms for the customer to agree (optional)
                <textarea className="mt-1 min-h-16 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-[13px]" maxLength={2000} onChange={(event) => setAdditionalTerms(event.target.value)} value={additionalTerms} />
              </label>
              <p className="rounded-xl border border-[#bfe0db] bg-[var(--primary-light)] p-3 text-[12px] font-bold text-[var(--primary)]">
                You&apos;ll get a link for the customer. The change applies once they sign.
              </p>
            </>
          ) : isExtension ? (
            <>
              <label className="block">
                New return date
                <input className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" min={tomorrow} onChange={(event) => setExtensionEndDate(event.target.value)} type="date" value={extensionEndDate} />
              </label>
              {originalEndDate && context?.onRent && (context?.rates?.monthlyRate || 0) > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-white p-3 text-[13px] text-[var(--foreground-secondary)]">
                  <span>
                    No return date in mind? Make it <span className="font-semibold text-[var(--foreground)]">monthly, open-ended</span> at {money(context?.rates?.monthlyRate || 0)} a month. Applies now and the customer is told.
                  </span>
                  <button className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--primary)] disabled:opacity-60" disabled={isPending} onClick={makeOpenEnded} type="button">
                    Make it monthly
                  </button>
                </div>
              ) : null}

              <div className="rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3 text-sm text-[var(--foreground-secondary)]">
                Extension: <span className="font-mono-data font-bold">{originalEndDate || "Open"}</span> to <span className="font-mono-data font-bold">{extensionEndDate}</span> ({extensionDays} days)
              </div>

              <label className="block">
                Agreed payment for this extension
                <CurrencyInput onChange={setExtensionAmount} value={extensionAmount} />
                {extensionQuote ? (
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--foreground-secondary)]">
                    From your rates: <span className="font-semibold text-[var(--foreground)]">{money(extensionQuote.amount)}</span> ({extensionQuote.explain})
                    <button className="rounded-md border border-[var(--border)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)]" onClick={() => setExtensionAmount(String(extensionQuote.amount))} type="button">
                      Use this
                    </button>
                  </span>
                ) : null}
                <span className="mt-1 block text-[11px] text-[var(--muted)]">Total amount agreed for this specific period - not a recurring rate. If 0 or blank, no payment record is created.</span>
              </label>

              <label className="block">
                Payment due
                <input className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setExtensionDueDate(event.target.value)} type="date" value={extensionDueDate} />
                <span className="mt-1 block text-[11px] text-[var(--muted)]">Typically the day the current period ends.</span>
              </label>

              {agreementSigned ? (
                <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3 text-[13px]">
                  <input checked={needsSignature} className="mt-0.5 h-4 w-4" onChange={(event) => setNeedsSignature(event.target.checked)} type="checkbox" />
                  <span>
                    <span className="block font-bold">Customer signs an amendment (recommended)</span>
                    <span className="block text-[11px] text-[var(--muted)]">
                      They get a short link showing the new return date and price. The extension applies once they sign. Untick to just record it.
                    </span>
                  </span>
                </label>
              ) : null}

              {useAmendment ? (
                <label className="block">
                  Extra terms for the customer to agree (optional)
                  <textarea className="mt-1 min-h-16 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-[13px]" maxLength={2000} onChange={(event) => setAdditionalTerms(event.target.value)} value={additionalTerms} />
                </label>
              ) : (
                <label className="block">
                  Internal note
                  <input className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setNote(event.target.value)} placeholder="Optional" type="text" value={note} />
                </label>
              )}

              <div className="rounded-xl border border-[#bfe0db] bg-[var(--primary-light)] p-3 text-sm font-bold text-[var(--primary)]">
                Extending {extensionDays} days - {money(parseAmount(extensionAmount))} due {extensionDueDate || "not set"}
                {useAmendment ? <span className="mt-1 block text-[12px] font-normal">Applies when the customer signs.</span> : null}
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
                  <button className={`pressable rounded-lg border px-3 py-2 text-sm font-bold ${advancePaid ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`} onClick={() => setAdvancePaid(true)} type="button">
                    Yes
                  </button>
                  <button className={`pressable rounded-lg border px-3 py-2 text-sm font-bold ${!advancePaid ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`} onClick={() => setAdvancePaid(false)} type="button">
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
                    <span className="mt-1 block text-[11px] font-bold text-[var(--primary)]">
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
          {showPendingPanel ? (
            <button
              className="pressable min-h-11 flex-1 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white"
              onClick={() => {
                onSuccess?.();
                onClose();
              }}
              type="button"
            >
              Done
            </button>
          ) : (
            <>
              <button className="pressable min-h-11 flex-1 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-[var(--foreground-secondary)]" onClick={onClose} type="button">
                Cancel
              </button>
              <button
                className="pressable min-h-11 flex-1 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                disabled={submitDisabled}
                onClick={submit}
                type="button"
              >
                {isPending ? "Saving..." : useAmendment ? "Create link for customer to sign" : isExtension ? "Extend rental" : "Record early return"}
              </button>
            </>
          )}
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
  className = "pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground-secondary)]"
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
