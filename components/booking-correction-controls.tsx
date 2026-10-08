"use client";

import { businessToday } from "@/lib/business-time";
import { shownError } from "@/lib/error-text";
import { typedNote } from "@/lib/transaction-notes";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { longDate } from "@/lib/i18n/dates";
import { monthPeriod } from "@/lib/i18n/period";
import { addRentalPayment, deleteRentalPayment, recordPaymentReceived, setupExistingRentalPayments, updateRentalEndDate, updateRentalPayment } from "@/app/actions/bookings";
import { deleteTransaction, updateTransaction } from "@/app/actions/transactions";

type RentalPayment = {
  id: string;
  amount: number | string | null;
  currency?: string | null;
  due_date?: string | null;
  status?: string | null;
  paid_at?: string | null;
  metadata?: Record<string, any> | null;
};

type BookingTransaction = {
  id: string;
  amount: number | string | null;
  currency?: string | null;
  transaction_date?: string | null;
  type?: string | null;
  notes?: string | null;
  voided?: boolean | null;
  metadata?: Record<string, any> | null;
};

const editablePaymentStatuses = ["pending", "scheduled", "overdue", "waived", "voided"];
const paymentMethodOptions = ["cash", "promptpay", "bank_transfer", "wise", "revolut", "other"];

const transactionTypeOptions = [
  "rental_income",
  "charge_recovered",
  "refund",
  "deposit",
  "deposit_received",
  "deposit_refunded",
  "deposit_forfeited",
  "deposit_deduction",
  "repair",
  "servicing",
  "maintenance",
  "fuel",
  "insurance",
  "tax",
  "finance",
  "fine",
  "accessories",
  "other"
];

type Say = (key: string, values?: Record<string, string | number>) => string;
/** The words for these controls in the reader's language, and the language itself for dates. */
type Ctl = { say: Say; optionName: (option: string) => string; typeName: (type: string) => string; locale: string };

function useCtl(): Ctl {
  const t = useTranslations("booking");
  const m = useTranslations("money");
  const locale = useLocale();
  const say = t as unknown as Say;
  const typeName = (type: string) => (m.has(`type_${type}`) ? m(`type_${type}`) : type.replace(/_/g, " "));
  // One name for every choice in the lists below: a payment's status, how it was paid, or what a money entry was for.
  const optionName = (option: string) =>
    editablePaymentStatuses.includes(option) || option === "paid" ? say(`pc_st_${option}`) : paymentMethodOptions.includes(option) ? say(`pm_${option}`) : typeName(option);
  return { say, optionName, typeName, locale };
}

function money(value: unknown, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function dateInput(value: string | null | undefined) {
  return String(value || "").slice(0, 10);
}

function dateLabel(value: string | null | undefined, locale: string) {
  const normalized = dateInput(value);
  if (!normalized) return "";
  return longDate(normalized, locale);
}

function amountInput(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

/** What a payment is for. Words someone typed are shown as typed; otherwise it is named from what the payment is. */
function paymentDescription(payment: RentalPayment, tx: Ctl) {
  const metadata = payment.metadata || {};
  // The app's own English descriptions ("Security deposit", "First rental payment - due at handover") are
  // not words someone typed: those payments are named in the reader's language below.
  const appWritten = /^(security deposit|first rental payment|rental payment|rent payment|remaining balance|\d+ days? rent)\b/i.test(String(metadata.description || "").trim());
  if (metadata.description && !appWritten) return metadata.type === "charge" ? tx.say("pc_chargeFor", { reasons: String(metadata.description) }) : String(metadata.description);
  const isExtension = metadata.type === "extension" || metadata.adjustment_type === "extension";
  if (isExtension) return tx.say("pc_extensionDesc", { from: dateLabel(metadata.previous_end_date, tx.locale), to: dateLabel(metadata.new_end_date, tx.locale) });
  // A bill from the return form names its reasons; one added by hand keeps the words it was given (above).
  if (metadata.type === "charge") {
    const reasons = (Array.isArray(metadata.charge_reasons) ? metadata.charge_reasons : []).map((reason: string) => tx.say(`chg_${reason}`));
    return reasons.length ? tx.say("pc_chargeFor", { reasons: reasons.join(", ") }) : tx.say("pc_charge");
  }
  if (metadata.type === "deposit" || metadata.is_deposit === true) return tx.say("pc_deposit");
  return metadata.period_label ? tx.say("pc_rentFor", { period: monthPeriod(metadata.period_label, tx.locale) }) : tx.say("pc_rent");
}

function isPaymentVoided(payment: RentalPayment) {
  return payment.status === "voided" || Boolean(payment.metadata?.voided);
}

function isTransactionVoided(transaction: BookingTransaction) {
  return Boolean(transaction.voided || transaction.metadata?.voided);
}

function toneClass(tone: "green" | "amber" | "red" | "blue" | "neutral") {
  const tones = {
    green: "bg-[var(--success-light)] text-[var(--success)] ring-[var(--success-line)]",
    amber: "bg-[var(--warning-light)] text-[var(--warning)] ring-[var(--warning-line)]",
    red: "bg-[var(--danger-light)] text-[var(--danger)] ring-[var(--danger-line)]",
    blue: "bg-[var(--primary-light)] text-[var(--primary)] ring-[var(--primary-light)]",
    neutral: "bg-[var(--panel-secondary)] text-[var(--foreground-secondary)] ring-[var(--border)]"
  };
  return tones[tone];
}

function SmallBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "green" | "amber" | "red" | "blue" | "neutral" }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] ring-1 ${toneClass(tone)}`}>
      {children}
    </span>
  );
}

export function AddRentalPaymentInlineForm({ organizationId, rentalId, currency = "THB" }: { organizationId: string; rentalId: string; currency?: string | null }) {
  const router = useRouter();
  const tx = useCtl();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState(businessToday());
  const [description, setDescription] = useState(tx.say("pc_defaultDesc"));
  const [status, setStatus] = useState("pending");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    function openFromHash() {
      if (window.location.hash === "#add-payment-row") {
        setOpen(true);
      }
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("organizationId", organizationId);
        formData.set("rentalId", rentalId);
        formData.set("amount", amount);
        formData.set("dueDate", dueDate);
        formData.set("description", description);
        formData.set("status", status);
        await addRentalPayment(formData);
        setOpen(false);
        router.refresh();
      } catch (error) {
        setMessage(shownError(error, tx.say("pc_addFailed")));
      }
    });
  }

  return (
    <div className="sub-surface p-3" id="add-payment-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--foreground)]">{tx.say("pc_addCharge")}</p>
          <p className="text-sm text-[var(--muted)]">{tx.say("pc_addChargeHint")}</p>
        </div>
        <ActionButton onClick={() => setOpen((current) => !current)}>{open ? tx.say("pc_close") : tx.say("pc_addCharge")}</ActionButton>
      </div>
      {open ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              {tx.say("pc_amount")}
              <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                <span className="font-mono-data px-3 text-sm font-semibold text-[var(--muted)]">{currency === "THB" ? "฿" : currency}</span>
                <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" min="0" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
            </label>
            <label>
              {tx.say("pc_dueDate")}
              <input className="mt-1 w-full" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label>
              {tx.say("pc_status")}
              <select className="mt-1 w-full" value={status} onChange={(event) => setStatus(event.target.value)}>
                {editablePaymentStatuses.map((option) => (
                  <option key={option} value={option}>{tx.optionName(option)}</option>
                ))}
              </select>
            </label>
            <label>
              {tx.say("pc_description")}
              <input className="mt-1 w-full" type="text" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
          </div>
          {message ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] p-2 text-xs font-semibold text-[var(--danger)]">{message}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton disabled={isPending} onClick={save} tone="primary">{isPending ? tx.say("saving") : tx.say("pc_saveCharge")}</ActionButton>
            <ActionButton disabled={isPending} onClick={() => setOpen(false)}>{tx.say("cancelBtn")}</ActionButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ExistingRentalPaymentSetupCard({
  currency = "THB",
  depositAmount,
  rentalId,
  rentalRate,
  startDate
}: {
  currency?: string | null;
  depositAmount: number;
  rentalId: string;
  rentalRate: number;
  startDate?: string | null;
}) {
  const router = useRouter();
  const tx = useCtl();
  const [firstPaymentMode, setFirstPaymentMode] = useState<"collected" | "outstanding">("outstanding");
  const [depositMode, setDepositMode] = useState<"collected" | "pending" | "none">(depositAmount > 0 ? "pending" : "none");
  const [firstPaymentAmount, setFirstPaymentAmount] = useState(String(Math.max(0, Math.round(rentalRate || 0))));
  const [depositPaymentAmount, setDepositPaymentAmount] = useState(String(Math.max(0, Math.round(depositAmount || 0))));
  const [firstPaymentDate, setFirstPaymentDate] = useState(dateInput(startDate) || businessToday());
  const [depositDate, setDepositDate] = useState(dateInput(startDate) || businessToday());
  const [firstPaymentMethod, setFirstPaymentMethod] = useState("cash");
  const [depositMethod, setDepositMethod] = useState("cash");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("rentalId", rentalId);
        formData.set("firstPaymentMode", firstPaymentMode);
        formData.set("firstPaymentAmount", firstPaymentAmount);
        formData.set("firstPaymentDate", firstPaymentDate);
        formData.set("firstPaymentMethod", firstPaymentMethod);
        formData.set("depositMode", depositMode);
        formData.set("depositAmount", depositPaymentAmount);
        formData.set("depositDate", depositDate);
        formData.set("depositMethod", depositMethod);
        await setupExistingRentalPayments(formData);
        router.refresh();
      } catch (error) {
        setMessage(shownError(error, tx.say("pc_setupFailed")));
      }
    });
  }

  return (
    <div className="rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-[var(--warning)]">{tx.say("pc_setupTitle")}</p>
          <p className="mt-1 text-sm leading-5 text-[var(--warning)]">
            {tx.say("pc_setupBody")}
          </p>
        </div>
        <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-lg border border-[var(--warning-line)] bg-white px-3 text-xs font-semibold text-[var(--warning)]" href={`/bookings/${rentalId}/edit#payments`}>
          {tx.say("pc_setupManual")}
        </Link>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--warning-line)] bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--warning)]">{tx.say("pc_firstPayment")}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              className={`pressable rounded-lg border px-3 py-2 text-left text-xs font-semibold ${firstPaymentMode === "collected" ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
              onClick={() => setFirstPaymentMode("collected")}
              type="button"
            >
              {tx.say("pc_firstCollected")}
            </button>
            <button
              className={`pressable rounded-lg border px-3 py-2 text-left text-xs font-semibold ${firstPaymentMode === "outstanding" ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
              onClick={() => setFirstPaymentMode("outstanding")}
              type="button"
            >
              {tx.say("pc_firstOutstanding")}
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              {tx.say("pc_amount")}
              <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                <span className="font-mono-data px-3 text-sm font-semibold text-[var(--muted)]">{currency === "THB" ? "฿" : currency}</span>
                <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" min="0" step="0.01" type="number" value={firstPaymentAmount} onChange={(event) => setFirstPaymentAmount(event.target.value)} />
              </div>
            </label>
            <label>
              {firstPaymentMode === "collected" ? tx.say("pc_dateCollected") : tx.say("pc_dueDate")}
              <input className="mt-1 w-full" type="date" value={firstPaymentDate} onChange={(event) => setFirstPaymentDate(event.target.value)} />
            </label>
            {firstPaymentMode === "collected" ? (
              <label className="sm:col-span-2">
                {tx.say("pc_method")}
                <select className="mt-1 w-full" value={firstPaymentMethod} onChange={(event) => setFirstPaymentMethod(event.target.value)}>
                  {paymentMethodOptions.map((option) => (
                    <option key={option} value={option}>{tx.optionName(option)}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--warning-line)] bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--warning)]">{tx.say("pc_securityDeposit")}</p>
          <div className="mt-3 grid gap-2">
            {[
              ["collected", tx.say("pc_depCollected")],
              ["pending", tx.say("pc_depPending")],
              ["none", tx.say("pc_depNone")]
            ].map(([value, label]) => (
              <button
                className={`pressable rounded-lg border px-3 py-2 text-left text-xs font-semibold ${depositMode === value ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
                key={value}
                onClick={() => setDepositMode(value as "collected" | "pending" | "none")}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          {depositMode !== "none" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label>
                {tx.say("pc_depositAmount")}
                <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                  <span className="font-mono-data px-3 text-sm font-semibold text-[var(--muted)]">{currency === "THB" ? "฿" : currency}</span>
                  <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" min="0" step="0.01" type="number" value={depositPaymentAmount} onChange={(event) => setDepositPaymentAmount(event.target.value)} />
                </div>
              </label>
              <label>
                {depositMode === "collected" ? tx.say("pc_dateCollected") : tx.say("pc_dueDate")}
                <input className="mt-1 w-full" type="date" value={depositDate} onChange={(event) => setDepositDate(event.target.value)} />
              </label>
              {depositMode === "collected" ? (
                <label className="sm:col-span-2">
                  {tx.say("pc_method")}
                  <select className="mt-1 w-full" value={depositMethod} onChange={(event) => setDepositMethod(event.target.value)}>
                    {paymentMethodOptions.map((option) => (
                      <option key={option} value={option}>{tx.optionName(option)}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {message ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] p-2 text-xs font-semibold text-[var(--danger)]">{message}</p> : null}
      <div className="mt-3 flex justify-end">
        <ActionButton disabled={isPending} onClick={submit} tone="primary">
          {isPending ? tx.say("pc_settingUp") : tx.say("pc_createRecords")}
        </ActionButton>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  tone = "neutral",
  disabled = false,
  type = "button"
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "primary" | "danger" | "neutral";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const className =
    tone === "primary"
      ? "bg-[var(--primary)] text-white"
      : tone === "danger"
        ? "border border-[var(--danger-line)] bg-[var(--danger-light)] text-[var(--danger)]"
        : "border border-[var(--border)] bg-white text-[var(--foreground-secondary)]";

  return (
    <button
      className={`pressable inline-flex min-h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

export function EditableEndDate({ rentalId, currentEndDate }: { rentalId: string; currentEndDate?: string | null }) {
  const router = useRouter();
  const tx = useCtl();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(dateInput(currentEndDate));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!value) {
      setMessage(tx.say("pc_chooseEnd"));
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await updateRentalEndDate(rentalId, value);
        if (!result.success) {
          setMessage(result.error || tx.say("pc_endFailed"));
          return;
        }
        setEditing(false);
        router.refresh();
      } catch (error) {
        setMessage(shownError(error, tx.say("pc_endFailed")));
      }
    });
  }

  if (editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <input className="font-mono-data h-8 rounded-lg border border-[var(--border)] bg-white px-2 text-xs font-semibold" type="date" value={value} onChange={(event) => setValue(event.target.value)} />
        <ActionButton disabled={isPending} onClick={save} tone="primary">
          {isPending ? tx.say("saving") : tx.say("pc_save")}
        </ActionButton>
        <ActionButton disabled={isPending} onClick={() => { setValue(dateInput(currentEndDate)); setMessage(null); setEditing(false); }}>
          {tx.say("cancelBtn")}
        </ActionButton>
        {message ? <span className="basis-full text-xs font-semibold text-[var(--danger)]">{message}</span> : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{dateLabel(currentEndDate, tx.locale)}</span>
      <button
        aria-label={tx.say("pc_editEnd")}
        className="pressable inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-secondary)] hover:text-[var(--primary)]"
        onClick={() => setEditing(true)}
        type="button"
      >
        <i aria-hidden="true" className="ti ti-pencil text-[13px]" />
      </button>
    </span>
  );
}

export function EditableRentalPaymentRow({ payment }: { payment: RentalPayment }) {
  const router = useRouter();
  const tx = useCtl();
  const metadata = payment.metadata || {};
  const isExtension = metadata.type === "extension" || metadata.adjustment_type === "extension";
  const voided = isPaymentVoided(payment);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(amountInput(payment.amount));
  const [dueDate, setDueDate] = useState(dateInput(payment.due_date));
  const [description, setDescription] = useState(String(metadata.description || ""));
  const [status, setStatus] = useState(String(payment.status || "pending"));
  const [paidDate, setPaidDate] = useState(dateInput(payment.paid_at));
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [recordAmount, setRecordAmount] = useState(amountInput(payment.amount));
  const [recordDate, setRecordDate] = useState(businessToday());
  const [recordMethod, setRecordMethod] = useState("cash");
  const [recordNote, setRecordNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const badgeTone = voided ? "neutral" : status === "paid" ? "green" : status === "overdue" ? "red" : status === "waived" ? "blue" : "amber";
  // Scheduled payments can be recorded too: customers often pay early.
  const canRecordPayment = !voided && ["scheduled", "pending", "overdue"].includes(status);

  useEffect(() => {
    if (!canRecordPayment) return;
    function openFromHash() {
      if (window.location.hash === `#record-payment-${payment.id}`) {
        setRecordAmount(amountInput(payment.amount));
        setRecordDate(businessToday());
        setRecordingPayment(true);
      }
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [canRecordPayment, payment.amount, payment.id]);

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateRentalPayment(payment.id, {
          amount: Number(amount || 0),
          dueDate,
          description,
          status: status as any,
          paidDate: status === "paid" ? paidDate : null
        });
        setEditing(false);
        router.refresh();
      } catch (error) {
        setMessage(shownError(error, tx.say("pc_updateFailed")));
      }
    });
  }

  // A bill the customer is not going to pay: written off in one tap (it can be put back from the pencil).
  function waiveCharge() {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateRentalPayment(payment.id, {
          amount: Number(payment.amount || 0),
          dueDate: dateInput(payment.due_date),
          description: String(payment.metadata?.description || ""),
          status: "waived" as any,
          paidDate: null
        });
        router.refresh();
      } catch (error) {
        setMessage(shownError(error, tx.say("pc_updateFailed")));
      }
    });
  }

  function saveReceivedPayment() {
    setMessage(null);
    startTransition(async () => {
      try {
        await recordPaymentReceived(payment.id, {
          amount: Number(recordAmount || 0),
          date: recordDate,
          method: recordMethod,
          note: recordNote
        });
        setRecordingPayment(false);
        router.refresh();
      } catch (error) {
        setMessage(shownError(error, tx.say("pc_recordFailed")));
      }
    });
  }

  return (
    <div className={`sub-surface p-3 ${voided ? "opacity-70" : ""}`} id={`record-payment-${payment.id}`}>
      {/* On a phone the button drops under the details instead of squeezing them. */}
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-[60%] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-mono-data font-semibold ${voided ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"}`}>{money(payment.amount, payment.currency || "THB")}</p>
            <SmallBadge tone={badgeTone as any}>
              {(() => {
                // Say where the payment stands in plain words, not the stored status.
                if (voided) return tx.say("pc_b_cancelled");
                if (status === "paid") return tx.say("pc_b_paid");
                if (status === "waived") return tx.say("pc_b_waived");
                const due = String(payment.due_date || "").slice(0, 10);
                const todayHere = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
                if (!due) return tx.say("pc_b_noDate");
                if (due < todayHere) return tx.say("pc_b_overdue");
                if (due === todayHere) return tx.say("pc_b_dueToday");
                return tx.say("pc_b_notDue");
              })()}
            </SmallBadge>
            {isExtension ? <SmallBadge tone="blue">{tx.say("pc_extension")}</SmallBadge> : null}
          </div>
          <p className={`text-sm ${voided ? "text-[var(--muted)]" : "text-[var(--muted)]"}`}>{paymentDescription(payment, tx)}</p>
          <p className="text-sm text-[var(--muted)]">{tx.say("pc_due", { date: dateLabel(payment.due_date, tx.locale) })}</p>
          {(payment as any).receipt_url ? (
            <a className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)] hover:underline" href={(payment as any).receipt_url} rel="noreferrer" target="_blank">
              <i aria-hidden="true" className="ti ti-receipt text-[14px]" />
              {status === "paid" ? tx.say("pc_viewReceipt") : tx.say("pc_receiptSent")}
            </a>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {canRecordPayment ? (
            <button
              className="pressable inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-white"
              onClick={() => {
                setRecordAmount(amountInput(payment.amount));
                setRecordDate(businessToday());
                setRecordingPayment(true);
              }}
              type="button"
            >
              <i aria-hidden="true" className="ti ti-cash text-[14px]" />
              {tx.say("pc_record")}
            </button>
          ) : null}
          {canRecordPayment && payment.metadata?.type === "charge" ? (
            <button className="pressable inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-semibold text-[var(--foreground-secondary)]" disabled={isPending} onClick={waiveCharge} type="button">
              {tx.say("pc_wontPay")}
            </button>
          ) : null}
          {!voided ? (
            <button className="pressable inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-secondary)] hover:text-[var(--primary)]" onClick={() => setEditing((open) => !open)} type="button">
              <i aria-hidden="true" className="ti ti-pencil text-[13px]" />
            </button>
          ) : null}
        </div>
      </div>

      {recordingPayment ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              {tx.say("pc_amountReceived")}
              <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                <span className="font-mono-data px-3 text-sm font-semibold text-[var(--muted)]">฿</span>
                <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" min="0" step="0.01" type="number" value={recordAmount} onChange={(event) => setRecordAmount(event.target.value)} />
              </div>
            </label>
            <label>
              {tx.say("pc_dateReceived")}
              <input className="mt-1 w-full" type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} />
            </label>
            <label>
              {tx.say("pc_method")}
              <select className="mt-1 w-full" value={recordMethod} onChange={(event) => setRecordMethod(event.target.value)}>
                {paymentMethodOptions.map((option) => (
                  <option key={option} value={option}>{tx.optionName(option)}</option>
                ))}
              </select>
            </label>
            <label>
              {tx.say("pc_note")}
              <input className="mt-1 w-full" placeholder={tx.say("pc_notePlaceholder")} type="text" value={recordNote} onChange={(event) => setRecordNote(event.target.value)} />
            </label>
          </div>
          {message ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] p-2 text-xs font-semibold text-[var(--danger)]">{message}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton disabled={isPending} onClick={saveReceivedPayment} tone="primary">{isPending ? tx.say("pc_recording") : tx.say("pc_confirmReceived")}</ActionButton>
            <ActionButton disabled={isPending} onClick={() => setRecordingPayment(false)}>{tx.say("cancelBtn")}</ActionButton>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              {tx.say("pc_amount")}
              <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                <span className="font-mono-data px-3 text-sm font-semibold text-[var(--muted)]">฿</span>
                <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" min="0" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
            </label>
            <label>
              {tx.say("pc_dueDate")}
              <input className="mt-1 w-full" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label className="sm:col-span-2">
              {tx.say("pc_description")}
              <input className="mt-1 w-full" type="text" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label>
              {tx.say("pc_status")}
              <select className="mt-1 w-full" value={status} onChange={(event) => setStatus(event.target.value)}>
                {editablePaymentStatuses.map((option) => (
                  <option key={option} value={option}>{tx.optionName(option)}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {tx.say("pc_statusHint")}
              </p>
            </label>
            {status === "paid" ? (
              <label>
                {tx.say("pc_paidDate")}
                <input className="mt-1 w-full" type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
              </label>
            ) : null}
          </div>
          {message ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] p-2 text-xs font-semibold text-[var(--danger)]">{message}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton disabled={isPending} onClick={save} tone="primary">{isPending ? tx.say("saving") : tx.say("pc_saveChanges")}</ActionButton>
            <ActionButton disabled={isPending} onClick={() => setEditing(false)}>{tx.say("cancelBtn")}</ActionButton>
          </div>
          {!showDeleteConfirm ? (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 5,
                  border: "0.5px solid var(--danger-line)", background: "var(--danger-light)",
                  color: "var(--danger)", cursor: "pointer", fontWeight: 500
                }}
              >
                {tx.say("pc_deletePayment")}
              </button>
            </div>
          ) : (
            <div style={{
              background: "var(--danger-light)", border: "0.5px solid var(--danger-line)",
              borderRadius: 7, padding: "10px 12px", marginTop: 8
            }}>
              <p style={{ fontSize: 12, color: "var(--danger)", fontWeight: 500, margin: "0 0 6px" }}>
                {tx.say("pc_deletePaymentConfirm")}
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 5,
                    border: "0.5px solid var(--border)", background: "#fff",
                    color: "var(--muted)", cursor: "pointer"
                  }}
                >
                  {tx.say("cancelBtn")}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    startTransition(async () => {
                      try {
                        await deleteRentalPayment(payment.id);
                        setEditing(false);
                        router.refresh();
                      } catch (error) {
                        setMessage(shownError(error, tx.say("pc_deletePaymentFailed")));
                      }
                    });
                  }}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 5,
                    border: "none", background: "var(--danger)",
                    color: "#fff", cursor: "pointer", fontWeight: 500
                  }}
                >
                  {tx.say("pc_confirmDelete")}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function EditableTransactionRow({ transaction }: { transaction: BookingTransaction }) {
  const router = useRouter();
  const tx = useCtl();
  const isRefund = transaction.type === "refund" || transaction.metadata?.adjustment_type === "early_return";
  const voided = isTransactionVoided(transaction);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(amountInput(transaction.amount));
  const [transactionDate, setTransactionDate] = useState(dateInput(transaction.transaction_date));
  const [description, setDescription] = useState(String(transaction.notes || ""));
  const [type, setType] = useState(String(transaction.type || "other"));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const amountClass = useMemo(() => {
    if (voided) return "text-[var(--muted)] line-through";
    if (isRefund) return "text-[var(--warning)]";
    return Number(transaction.amount) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  }, [isRefund, transaction.amount, voided]);

  function save() {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateTransaction(transaction.id, {
          amount: Number(amount || 0),
          date: transactionDate,
          description,
          type
        });
        setEditing(false);
        router.refresh();
      } catch (error) {
        setMessage(shownError(error, tx.say("pc_txFailed")));
      }
    });
  }

  return (
    <div className={`sub-surface p-3 ${voided ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-semibold ${voided ? "text-[var(--muted)]" : "text-[var(--foreground)]"}`}>{tx.typeName(String(transaction.type || "other"))}</p>
            {isRefund ? <SmallBadge tone="amber">{tx.say("pc_refund")}</SmallBadge> : null}
            {voided ? <SmallBadge tone="neutral">{tx.say("pc_voided")}</SmallBadge> : null}
          </div>
          <p className={`text-sm ${voided ? "text-[var(--muted)]" : "text-[var(--muted)]"}`}>{dateLabel(transaction.transaction_date, tx.locale)}{typedNote(transaction.notes) ? ` · ${typedNote(transaction.notes)}` : ""}</p>
          {isRefund && transaction.metadata?.refund_reason ? <p className="mt-1 text-sm font-semibold text-[var(--warning)]">{transaction.metadata.refund_reason}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`font-mono-data font-semibold ${amountClass}`}>{money(transaction.amount, transaction.currency || "THB")}</span>
          {!voided ? (
            <button className="pressable inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--panel-secondary)] hover:text-[var(--primary)]" onClick={() => setEditing((open) => !open)} type="button">
              <i aria-hidden="true" className="ti ti-pencil text-[13px]" />
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              {tx.say("pc_amount")}
              <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                <span className="font-mono-data px-3 text-sm font-semibold text-[var(--muted)]">฿</span>
                <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
            </label>
            <label>
              {tx.say("pc_date")}
              <input className="mt-1 w-full" type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} />
            </label>
            <label>
              {tx.say("pc_type")}
              <select className="mt-1 w-full" value={type} onChange={(event) => setType(event.target.value)}>
                {transactionTypeOptions.map((option) => (
                  <option key={option} value={option}>{tx.optionName(option)}</option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              {tx.say("pc_description")}
              <input className="mt-1 w-full" type="text" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
          </div>
          {message ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] p-2 text-xs font-semibold text-[var(--danger)]">{message}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton disabled={isPending} onClick={save} tone="primary">{isPending ? tx.say("saving") : tx.say("pc_saveChanges")}</ActionButton>
            <ActionButton disabled={isPending} onClick={() => setEditing(false)}>{tx.say("cancelBtn")}</ActionButton>
          </div>
          {!showDeleteConfirm ? (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 5,
                  border: "0.5px solid var(--danger-line)", background: "var(--danger-light)",
                  color: "var(--danger)", cursor: "pointer", fontWeight: 500
                }}
              >
                {tx.say("pc_deleteTx")}
              </button>
            </div>
          ) : (
            <div style={{
              background: "var(--danger-light)", border: "0.5px solid var(--danger-line)",
              borderRadius: 7, padding: "10px 12px", marginTop: 8
            }}>
              <p style={{ fontSize: 12, color: "var(--danger)", fontWeight: 500, margin: "0 0 6px" }}>
                {tx.say("pc_deleteTxConfirm")}
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 5,
                    border: "0.5px solid var(--border)", background: "#fff",
                    color: "var(--muted)", cursor: "pointer"
                  }}
                >
                  {tx.say("cancelBtn")}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    startTransition(async () => {
                      try {
                        await deleteTransaction(transaction.id);
                        setEditing(false);
                        router.refresh();
                      } catch (error) {
                        setMessage(shownError(error, tx.say("pc_deleteTxFailed")));
                      }
                    });
                  }}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 5,
                    border: "none", background: "var(--danger)",
                    color: "#fff", cursor: "pointer", fontWeight: 500
                  }}
                >
                  {tx.say("pc_confirmDelete")}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
