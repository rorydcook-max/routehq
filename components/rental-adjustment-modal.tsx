"use client";

import { quoteStay, type Rates } from "@/lib/rental-estimate";
import { useEffect, useMemo, useState, useTransition, useRef } from "react";
import { adjustRental } from "@/app/actions/bookings";
import { useLocale, useTranslations } from "next-intl";
import { longDate } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;
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
  const say = useTranslations("booking") as unknown as Say;
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  const url = `${origin}/amend/${token}`;
  // Sent to the customer, so not in the staff language. It stays in English until the customer's language is known here.
  const message = `Please review and sign the change to your rental: ${url}`;
  return (
    <div className="rounded-xl border border-[#bfe0db] bg-[var(--primary-light)] p-3 text-sm">
      <p className="font-bold text-[var(--primary)]">{say("al_waiting")}</p>
      <p className="mt-1 text-[12px] text-[var(--foreground-secondary)]">{changedAlready ? say("al_changed") : say("al_nothing")}</p>
      {canNativeShare ? (
        <button
          className="pressable mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white"
          onClick={() => {
            navigator.share({ text: message }).catch(() => undefined);
          }}
          type="button"
        >
          {say("al_send")}
        </button>
      ) : null}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <a className="pressable inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-2 text-xs font-semibold text-[var(--foreground-secondary)]" href={`https://wa.me/?text=${encodeURIComponent(message)}`} rel="noreferrer" target="_blank">
          WhatsApp
        </a>
        <a className="pressable inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-2 text-xs font-semibold text-[var(--foreground-secondary)]" href={`https://line.me/R/share?text=${encodeURIComponent(message)}`} rel="noreferrer" target="_blank">
          LINE
        </a>
        <button
          className="pressable inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-2 text-xs font-semibold text-[var(--foreground-secondary)]"
          onClick={() => {
            navigator.clipboard?.writeText(url).then(() => setCopied(true), () => undefined);
          }}
          type="button"
        >
          {copied ? say("al_copied") : say("al_copy")}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <a className="pressable inline-flex min-h-10 items-center rounded-lg px-2 text-xs font-semibold text-[var(--primary)] underline" href={url} rel="noreferrer" target="_blank">
          {say("al_preview")}
        </a>
        {onCancel ? (
          <button className="pressable ml-auto inline-flex min-h-10 items-center rounded-lg px-2 text-xs font-semibold text-[#be123c] underline disabled:opacity-60" disabled={cancelling} onClick={onCancel} type="button">
            {cancelling ? say("al_cancelling") : say("al_cancel")}
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

function defaultExtensionEndDate(currentEndDate?: string | null, days = 30) {
  const current = currentEndDate ? new Date(currentEndDate) : new Date();
  const base = Number.isNaN(current.getTime()) ? new Date() : current;
  const next = addDays(base, days);
  return isoDate(next < tomorrowDate() ? tomorrowDate() : next);
}

// The words for each are in the language files (adj_pick_<days>).
const EXTENSION_PICKS = [{ days: 1 }, { days: 3 }, { days: 7 }, { days: 30 }];

function defaultEarlyReturnDate(currentStartDate?: string | null, currentEndDate?: string | null) {
  // A planned date, so never today or earlier (a vehicle already back goes through Start return).
  const today = isoDate(tomorrowDate());
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
      className={`pressable flex min-h-12 flex-1 items-center gap-3 rounded-xl border px-3 py-2 text-left transition sm:min-h-24 sm:items-start sm:py-3 ${selected ? activeClass : "border-[var(--border)] bg-white hover:border-[var(--border-strong)]"}`}
      onClick={onClick}
      type="button"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone === "teal" ? "bg-[var(--primary-light)] text-[var(--primary)]" : "bg-[#fef3c7] text-[var(--warning)]"}`}>
        <i aria-hidden="true" className={`ti ${icon} text-base`} />
      </span>
      <span>
        <span className="block text-[13px] font-bold text-[var(--foreground)]">{title}</span>
        <span className={`mt-0.5 text-[11px] leading-4 text-[var(--muted)] sm:mt-1 sm:block sm:leading-5 ${selected ? "block" : "hidden"}`}>{description}</span>
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
    <div className="mt-1 flex h-11 items-center rounded-lg border border-[var(--border-strong)] bg-white focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[rgba(14,116,144,0.12)]">
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
  // An open-ended rental has no return date to extend; the useful change is to set one.
  const openEnded = !currentEndDate;
  const t = useTranslations("booking");
  const say = t as unknown as Say;
  const locale = useLocale();
  const niceDate = (value: string | null | undefined) => (value ? longDate(String(value).slice(0, 10), locale) : "");
  const strong = (chunks: React.ReactNode) => <span className="font-semibold text-[var(--foreground)]">{chunks}</span>;
  const bold = (chunks: React.ReactNode) => <span className="font-bold">{chunks}</span>;
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>(openEnded ? "early_return" : "extension");
  const [extensionEndDate, setExtensionEndDate] = useState(() => defaultExtensionEndDate(currentEndDate));
  const [earlyReturnDate, setEarlyReturnDate] = useState(() => defaultEarlyReturnDate(currentStartDate, currentEndDate));
  const [extensionAmount, setExtensionAmount] = useState("");
  // Until the operator changes them, the date follows the pricing period and the price follows the rates.
  const dateChosenByHand = useRef(false);
  const amountTypedByHand = useRef(false);
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
      if (!dateChosenByHand.current) {
        const period = String(result.billingPeriod || "").toLowerCase();
        setExtensionEndDate(defaultExtensionEndDate(currentEndDate, period.startsWith("da") ? 1 : period.startsWith("week") ? 7 : 30));
      }
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
      const result = await makeRentalOpenEnded(rentalId).catch(() => ({ ok: false as const, error: say("adj_failedChange") }));
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(say("adj_nowOpen"));
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
  const quotedAmount = extensionQuote?.amount ?? null;
  useEffect(() => {
    if (amountTypedByHand.current || quotedAmount === null) return;
    setExtensionAmount(quotedAmount > 0 ? quotedAmount.toLocaleString("en-US") : "");
  }, [quotedAmount]);
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
          setMessage(result?.error || say("adj_failed"));
          return;
        }

        setMessage(adjustmentType === "extension" ? say("adj_extended") : say("adj_adjusted"));
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1000);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : say("adj_failed"));
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
            <h2 className="text-[15px] font-medium text-[var(--foreground)]">{agreementSigned ? say("adj_titleSigned") : say("adj_title")}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {customerName || say("adj_customer")} - {vehicleLabel || say("adj_vehicle")}
            </p>
          </div>
          <button className="pressable rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--muted)]" onClick={onClose} type="button">
            {say("adj_close")}
          </button>
        </div>

        <div className={`mt-4 grid gap-2 sm:gap-3 ${agreementSigned && !openEnded ? "sm:grid-cols-3" : agreementSigned || !openEnded ? "sm:grid-cols-2" : ""}`}>
          {openEnded ? null : (
            <OptionCard
              description={say("adj_extendDesc")}
              icon="ti-calendar-plus"
              onClick={() => setAdjustmentType("extension")}
              selected={isExtension}
              title={say("adj_extendTitle")}
              tone="teal"
            />
          )}
          <OptionCard
            description={openEnded ? say("adj_setDesc") : say("adj_earlyDesc")}
            icon="ti-calendar-minus"
            onClick={() => setAdjustmentType("early_return")}
            selected={adjustmentType === "early_return"}
            title={openEnded ? say("adj_setTitle") : say("adj_earlyTitle")}
            tone="amber"
          />
          {agreementSigned ? (
            <OptionCard
              description={say("adj_termsDesc")}
              icon="ti-file-pencil"
              onClick={() => setAdjustmentType("terms")}
              selected={isTerms}
              title={say("adj_termsTitle")}
              tone="teal"
            />
          ) : null}
        </div>

        {signingBlocked && adjustmentType !== "early_return" ? (
          <p className="mt-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-[12px] font-bold text-[#92400e]">
            {say("adj_cantSign", { gaps: (context?.signingGaps || []).join(", ") })}
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          {showPendingPanel && pendingToken ? (
            <AmendmentLinkPanel cancelling={cancelling} onCancel={pendingId ? cancelPending : undefined} token={pendingToken} />
          ) : isTerms ? (
            <>
              <label className="block">
                {say("adj_newRate", { period: ["daily", "weekly", "monthly"].includes(String(context?.billingPeriod || "monthly")) ? say(`adj_period_${context?.billingPeriod || "monthly"}`) : String(context?.billingPeriod) })}
                <CurrencyInput onChange={setNewRate} placeholder={String(context?.currentRate ?? currentRate ?? "")} value={newRate} />
                <span className="mt-1 block text-[11px] text-[var(--muted)]">
                  {say("adj_nowKeep", { amount: money(context?.currentRate ?? currentRate) })}
                </span>
              </label>
              {newRate.trim() ? (
                <label className="block">
                  {say("adj_rateFrom")}
                  <input className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setRateFrom(event.target.value)} type="date" value={rateFrom} />
                </label>
              ) : null}
              <label className="block">
                {say("adj_newDeposit")}
                <CurrencyInput onChange={setNewDeposit} placeholder={String(context?.currentDeposit ?? "")} value={newDeposit} />
                <span className="mt-1 block text-[11px] text-[var(--muted)]">
                  {say("adj_depositNow", { amount: money(context?.currentDeposit) })}
                </span>
              </label>
              {parseAmount(newDeposit) > Number(context?.currentDeposit || 0) ? (
                <label className="block">
                  {say("adj_extraDepositDue")}
                  <input className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setDepositDueDate(event.target.value)} type="date" value={depositDueDate} />
                </label>
              ) : null}
              <label className="block">
                {say("adj_extraTerms")}
                <textarea className="mt-1 min-h-16 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-[13px]" maxLength={2000} onChange={(event) => setAdditionalTerms(event.target.value)} value={additionalTerms} />
              </label>
              <p className="rounded-xl border border-[#bfe0db] bg-[var(--primary-light)] p-3 text-[12px] font-bold text-[var(--primary)]">
                {say("adj_linkNote")}
              </p>
            </>
          ) : isExtension ? (
            <>
              <label className="block">
                {say("adj_newReturn")}
                <input className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" min={tomorrow} onChange={(event) => {
                  dateChosenByHand.current = true;
                  setExtensionEndDate(event.target.value);
                }} type="date" value={extensionEndDate} />
                <span className="mt-2 grid grid-cols-4 gap-1.5">
                  {EXTENSION_PICKS.map((pick) => {
                    const target = defaultExtensionEndDate(currentEndDate, pick.days);
                    return (
                      <button
                        className={`pressable min-h-10 rounded-lg border px-1 text-[12px] font-semibold ${extensionEndDate === target ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
                        key={pick.days}
                        onClick={() => {
                          dateChosenByHand.current = true;
                          setExtensionEndDate(target);
                        }}
                        type="button"
                      >
                        {say(`adj_pick_${pick.days}`)}
                      </button>
                    );
                  })}
                </span>
              </label>
              {originalEndDate && context?.onRent && (context?.rates?.monthlyRate || 0) > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-white p-3 text-[13px] text-[var(--foreground-secondary)]">
                  <span>
                    {t.rich("adj_noDate", { amount: money(context?.rates?.monthlyRate || 0), b: strong })}
                  </span>
                  <button className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--primary)] disabled:opacity-60" disabled={isPending} onClick={makeOpenEnded} type="button">
                    {say("adj_makeMonthly")}
                  </button>
                </div>
              ) : null}

              <div className="rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3 text-sm text-[var(--foreground-secondary)]">
                {t.rich("adj_extensionLine", { from: originalEndDate ? niceDate(originalEndDate) : say("adj_openEnded"), to: extensionEndDate ? niceDate(extensionEndDate) : say("adj_newDate"), days: extensionDays, b: bold })}
              </div>

              <label className="block">
                {say("adj_agreed")}
                <CurrencyInput
                  onChange={(value) => {
                    amountTypedByHand.current = true;
                    setExtensionAmount(value);
                  }}
                  value={extensionAmount}
                />
                {extensionQuote ? (
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--foreground-secondary)]">
                    {t.rich("adj_fromRates", { amount: money(extensionQuote.amount), explain: extensionQuote.explain, b: strong })}
                    <button className={`rounded-md border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-semibold text-[var(--primary)] ${parseAmount(extensionAmount) === extensionQuote.amount ? "hidden" : ""}`} onClick={() => {
                      amountTypedByHand.current = false;
                      setExtensionAmount(extensionQuote.amount.toLocaleString("en-US"));
                    }} type="button">
                      {say("adj_useThis")}
                    </button>
                  </span>
                ) : null}
                <span className="mt-1 block text-[11px] text-[var(--muted)]">{say("adj_onePrice")}</span>
              </label>

              <label className="block">
                {say("adj_paymentDue")}
                <input className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setExtensionDueDate(event.target.value)} type="date" value={extensionDueDate} />
                <span className="mt-1 block text-[11px] text-[var(--muted)]">{say("adj_typically")}</span>
              </label>

              {agreementSigned ? (
                <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3 text-[13px]">
                  <input checked={needsSignature} className="mt-0.5 h-4 w-4" onChange={(event) => setNeedsSignature(event.target.checked)} type="checkbox" />
                  <span>
                    <span className="block font-bold">{say("adj_signs")}</span>
                    <span className="block text-[11px] text-[var(--muted)]">
                      {say("adj_signsHint")}
                    </span>
                  </span>
                </label>
              ) : null}

              {useAmendment ? (
                <label className="block">
                  {say("adj_extraTerms")}
                  <textarea className="mt-1 min-h-16 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-[13px]" maxLength={2000} onChange={(event) => setAdditionalTerms(event.target.value)} value={additionalTerms} />
                </label>
              ) : (
                <label className="block">
                  {say("adj_internalNote")}
                  <input className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setNote(event.target.value)} placeholder={say("adj_optional")} type="text" value={note} />
                </label>
              )}

              <div className="rounded-xl border border-[#bfe0db] bg-[var(--primary-light)] p-3 text-sm font-bold text-[var(--primary)]">
                {say("adj_summary", { days: extensionDays, amount: money(parseAmount(extensionAmount)), date: extensionDueDate ? niceDate(extensionDueDate) : say("adj_notSet") })}
                {useAmendment ? <span className="mt-1 block text-[12px] font-normal">{say("adj_appliesWhen")}</span> : null}
              </div>
            </>
          ) : (
            <>
              <label className="block">
                {openEnded ? say("adj_returnDate") : say("adj_newReturn")}
                <input
                  className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]"
                  max={originalEndDate || undefined}
                  min={tomorrow}
                  onChange={(event) => setEarlyReturnDate(event.target.value)}
                  type="date"
                  value={earlyReturnDate}
                />
              </label>

              <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-sm text-[#92400e]">
                {openEnded
                  ? say("adj_endsOn", { date: earlyReturnDate ? niceDate(earlyReturnDate) : say("adj_dateYouChoose") })
                  : say("adj_sooner", { days: earlyReturnDays, from: niceDate(originalEndDate), to: earlyReturnDate ? niceDate(earlyReturnDate) : say("adj_dateYouChoose") })}
                <span className="mt-1 block text-[12px]">
                  {say("adj_unused")}
                </span>
              </div>

              <label className="block">
                {say("adj_internalNote")}
                <input className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-[13px]" onChange={(event) => setNote(event.target.value)} placeholder={say("adj_optional")} type="text" value={note} />
              </label>
            </>
          )}
        </div>

        {message ? (
          <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-bold ${[say("adj_extended"), say("adj_adjusted"), say("adj_nowOpen")].includes(message) ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--danger-light)] text-[var(--danger)]"}`}>
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
              {say("adj_done")}
            </button>
          ) : (
            <>
              <button className="pressable min-h-11 flex-1 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-bold text-[var(--foreground-secondary)]" onClick={onClose} type="button">
                {say("cancelBtn")}
              </button>
              <button
                className="pressable min-h-11 flex-1 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                disabled={submitDisabled}
                onClick={submit}
                type="button"
              >
                {isPending ? say("saving") : useAmendment ? say("adj_createLink") : isExtension ? say("adj_extendTitle") : say("adj_setReturn")}
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
  label,
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
  const say = useTranslations("booking") as unknown as Say;

  return (
    <>
      <button className={className} onClick={() => setOpen(true)} type="button">
        <i aria-hidden="true" className="ti ti-calendar-event text-sm" />
        {label || say("adj_defaultLabel")}
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
