"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
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

function money(value: unknown, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));
}

function dateInput(value: string | null | undefined) {
  return String(value || "").slice(0, 10);
}

function dateLabel(value: string | null | undefined) {
  const normalized = dateInput(value);
  if (!normalized) return "Open";
  return new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(normalized));
}

function amountInput(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

function paymentDescription(payment: RentalPayment) {
  const metadata = payment.metadata || {};
  const isExtension = metadata.type === "extension" || metadata.adjustment_type === "extension";
  return metadata.description || (isExtension ? `Extension ${metadata.previous_end_date || ""} to ${metadata.new_end_date || ""}` : "Scheduled payment");
}

function isPaymentVoided(payment: RentalPayment) {
  return payment.status === "voided" || Boolean(payment.metadata?.voided);
}

function isTransactionVoided(transaction: BookingTransaction) {
  return Boolean(transaction.voided || transaction.metadata?.voided);
}

function toneClass(tone: "green" | "amber" | "red" | "blue" | "neutral") {
  const tones = {
    green: "bg-[var(--success-light)] text-[var(--success)] ring-[#bbf7d0]",
    amber: "bg-[var(--warning-light)] text-[var(--warning)] ring-[#fde68a]",
    red: "bg-[var(--danger-light)] text-[var(--danger)] ring-[#fecaca]",
    blue: "bg-[var(--primary-light)] text-[var(--primary)] ring-[#a5f3fc]",
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
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("Rental payment");
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
        setMessage(error instanceof Error ? error.message : "Unable to add this charge.");
      }
    });
  }

  return (
    <div className="sub-surface p-3" id="add-payment-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black text-[#10252b]">Add charge</p>
          <p className="text-sm text-[#667085]">Add a new charge or scheduled amount due to this rental.</p>
        </div>
        <ActionButton onClick={() => setOpen((current) => !current)}>{open ? "Close" : "Add charge"}</ActionButton>
      </div>
      {open ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              Amount
              <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                <span className="font-mono-data px-3 text-sm font-black text-[var(--muted)]">{currency === "THB" ? "฿" : currency}</span>
                <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" min="0" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
            </label>
            <label>
              Due date
              <input className="mt-1 w-full" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label>
              Status
              <select className="mt-1 w-full" value={status} onChange={(event) => setStatus(event.target.value)}>
                {editablePaymentStatuses.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label>
              Description
              <input className="mt-1 w-full" type="text" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
          </div>
          {message ? <p className="mt-3 rounded-lg bg-[#fef2f2] p-2 text-xs font-semibold text-[#dc2626]">{message}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton disabled={isPending} onClick={save} tone="primary">{isPending ? "Saving..." : "Save charge"}</ActionButton>
            <ActionButton disabled={isPending} onClick={() => setOpen(false)}>Cancel</ActionButton>
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
  const [firstPaymentMode, setFirstPaymentMode] = useState<"collected" | "outstanding">("outstanding");
  const [depositMode, setDepositMode] = useState<"collected" | "pending" | "none">(depositAmount > 0 ? "pending" : "none");
  const [firstPaymentAmount, setFirstPaymentAmount] = useState(String(Math.max(0, Math.round(rentalRate || 0))));
  const [depositPaymentAmount, setDepositPaymentAmount] = useState(String(Math.max(0, Math.round(depositAmount || 0))));
  const [firstPaymentDate, setFirstPaymentDate] = useState(dateInput(startDate) || new Date().toISOString().slice(0, 10));
  const [depositDate, setDepositDate] = useState(dateInput(startDate) || new Date().toISOString().slice(0, 10));
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
        setMessage(error instanceof Error ? error.message : "Unable to set up payment records.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-black text-[#92400e]">Set up payment records for this rental</p>
          <p className="mt-1 text-sm leading-5 text-[#b45309]">
            Since this rental was entered directly, payment records were not auto-generated. Choose how to set up the first rent payment and security deposit.
          </p>
        </div>
        <Link className="pressable inline-flex min-h-8 items-center justify-center rounded-lg border border-[#fde68a] bg-white px-3 text-xs font-black text-[#92400e]" href={`/bookings/${rentalId}/edit#payments`}>
          Set up manually
        </Link>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[#fde68a] bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#b45309]">First rental payment</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              className={`pressable rounded-lg border px-3 py-2 text-left text-xs font-black ${firstPaymentMode === "collected" ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
              onClick={() => setFirstPaymentMode("collected")}
              type="button"
            >
              First payment already collected
            </button>
            <button
              className={`pressable rounded-lg border px-3 py-2 text-left text-xs font-black ${firstPaymentMode === "outstanding" ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
              onClick={() => setFirstPaymentMode("outstanding")}
              type="button"
            >
              First payment is outstanding
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label>
              Amount
              <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                <span className="font-mono-data px-3 text-sm font-black text-[var(--muted)]">{currency === "THB" ? "฿" : currency}</span>
                <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" min="0" step="0.01" type="number" value={firstPaymentAmount} onChange={(event) => setFirstPaymentAmount(event.target.value)} />
              </div>
            </label>
            <label>
              {firstPaymentMode === "collected" ? "Date collected" : "Due date"}
              <input className="mt-1 w-full" type="date" value={firstPaymentDate} onChange={(event) => setFirstPaymentDate(event.target.value)} />
            </label>
            {firstPaymentMode === "collected" ? (
              <label className="sm:col-span-2">
                Payment method
                <select className="mt-1 w-full" value={firstPaymentMethod} onChange={(event) => setFirstPaymentMethod(event.target.value)}>
                  {paymentMethodOptions.map((option) => (
                    <option key={option} value={option}>{option.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-[#fde68a] bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#b45309]">Security deposit</p>
          <div className="mt-3 grid gap-2">
            {[
              ["collected", "Deposit already collected"],
              ["pending", "Deposit not yet collected"],
              ["none", "No deposit for this rental"]
            ].map(([value, label]) => (
              <button
                className={`pressable rounded-lg border px-3 py-2 text-left text-xs font-black ${depositMode === value ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
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
                Deposit amount
                <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                  <span className="font-mono-data px-3 text-sm font-black text-[var(--muted)]">{currency === "THB" ? "฿" : currency}</span>
                  <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" min="0" step="0.01" type="number" value={depositPaymentAmount} onChange={(event) => setDepositPaymentAmount(event.target.value)} />
                </div>
              </label>
              <label>
                {depositMode === "collected" ? "Date collected" : "Due date"}
                <input className="mt-1 w-full" type="date" value={depositDate} onChange={(event) => setDepositDate(event.target.value)} />
              </label>
              {depositMode === "collected" ? (
                <label className="sm:col-span-2">
                  Payment method
                  <select className="mt-1 w-full" value={depositMethod} onChange={(event) => setDepositMethod(event.target.value)}>
                    {paymentMethodOptions.map((option) => (
                      <option key={option} value={option}>{option.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {message ? <p className="mt-3 rounded-lg bg-[#fef2f2] p-2 text-xs font-semibold text-[#dc2626]">{message}</p> : null}
      <div className="mt-3 flex justify-end">
        <ActionButton disabled={isPending} onClick={submit} tone="primary">
          {isPending ? "Setting up..." : "Create payment records"}
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
        ? "border border-[#fecaca] bg-[#fef2f2] text-[#dc2626]"
        : "border border-[var(--border)] bg-white text-[var(--foreground-secondary)]";

  return (
    <button
      className={`pressable inline-flex min-h-8 items-center justify-center rounded-lg px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
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
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(dateInput(currentEndDate));
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    if (!value) {
      setMessage("Choose an end date.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        await updateRentalEndDate(rentalId, value);
        setEditing(false);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update the end date.");
      }
    });
  }

  if (editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <input className="font-mono-data h-8 rounded-lg border border-[var(--border)] bg-white px-2 text-xs font-black" type="date" value={value} onChange={(event) => setValue(event.target.value)} />
        <ActionButton disabled={isPending} onClick={save} tone="primary">
          {isPending ? "Saving..." : "Save"}
        </ActionButton>
        <ActionButton disabled={isPending} onClick={() => { setValue(dateInput(currentEndDate)); setMessage(null); setEditing(false); }}>
          Cancel
        </ActionButton>
        {message ? <span className="basis-full text-xs font-semibold text-[#dc2626]">{message}</span> : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span>{dateLabel(currentEndDate)}</span>
      <button
        aria-label="Edit rental end date"
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
  const metadata = payment.metadata || {};
  const isExtension = metadata.type === "extension" || metadata.adjustment_type === "extension";
  const voided = isPaymentVoided(payment);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(amountInput(payment.amount));
  const [dueDate, setDueDate] = useState(dateInput(payment.due_date));
  const [description, setDescription] = useState(paymentDescription(payment));
  const [status, setStatus] = useState(String(payment.status || "pending"));
  const [paidDate, setPaidDate] = useState(dateInput(payment.paid_at));
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [recordAmount, setRecordAmount] = useState(amountInput(payment.amount));
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10));
  const [recordMethod, setRecordMethod] = useState("cash");
  const [recordNote, setRecordNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const badgeTone = voided ? "neutral" : status === "paid" ? "green" : status === "overdue" ? "red" : status === "waived" ? "blue" : "amber";
  const canRecordPayment = !voided && ["pending", "overdue"].includes(status);

  useEffect(() => {
    if (!canRecordPayment) return;
    function openFromHash() {
      if (window.location.hash === `#record-payment-${payment.id}`) {
        setRecordAmount(amountInput(payment.amount));
        setRecordDate(new Date().toISOString().slice(0, 10));
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
        setMessage(error instanceof Error ? error.message : "Unable to update this payment.");
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
        setMessage(error instanceof Error ? error.message : "Unable to record this payment.");
      }
    });
  }

  return (
    <div className={`sub-surface p-3 ${voided ? "opacity-70" : ""}`} id={`record-payment-${payment.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-mono-data font-black ${voided ? "text-[var(--muted)] line-through" : "text-[#10252b]"}`}>{money(payment.amount, payment.currency || "THB")}</p>
            {isExtension ? <SmallBadge tone="blue">Extension</SmallBadge> : null}
            {voided ? <SmallBadge tone="neutral">Voided</SmallBadge> : null}
          </div>
          <p className={`text-sm ${voided ? "text-[var(--muted)]" : "text-[#667085]"}`}>{paymentDescription(payment)}</p>
          <p className="text-sm text-[#667085]">Due {dateLabel(payment.due_date)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SmallBadge tone={badgeTone as any}>{voided ? "voided" : payment.status || "pending"}</SmallBadge>
          {canRecordPayment ? (
            <button
              className="pressable inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-black text-white"
              onClick={() => {
                setRecordAmount(amountInput(payment.amount));
                setRecordDate(new Date().toISOString().slice(0, 10));
                setRecordingPayment(true);
              }}
              type="button"
            >
              <i aria-hidden="true" className="ti ti-cash text-[14px]" />
              Record payment received
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
              Amount received
              <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                <span className="font-mono-data px-3 text-sm font-black text-[var(--muted)]">฿</span>
                <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" min="0" step="0.01" type="number" value={recordAmount} onChange={(event) => setRecordAmount(event.target.value)} />
              </div>
            </label>
            <label>
              Date received
              <input className="mt-1 w-full" type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} />
            </label>
            <label>
              Payment method
              <select className="mt-1 w-full" value={recordMethod} onChange={(event) => setRecordMethod(event.target.value)}>
                {paymentMethodOptions.map((option) => (
                  <option key={option} value={option}>{option.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>
            <label>
              Note
              <input className="mt-1 w-full" placeholder="Optional receipt or reference note" type="text" value={recordNote} onChange={(event) => setRecordNote(event.target.value)} />
            </label>
          </div>
          {message ? <p className="mt-3 rounded-lg bg-[#fef2f2] p-2 text-xs font-semibold text-[#dc2626]">{message}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton disabled={isPending} onClick={saveReceivedPayment} tone="primary">{isPending ? "Recording..." : "Confirm received"}</ActionButton>
            <ActionButton disabled={isPending} onClick={() => setRecordingPayment(false)}>Cancel</ActionButton>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              Amount
              <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                <span className="font-mono-data px-3 text-sm font-black text-[var(--muted)]">฿</span>
                <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" min="0" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
            </label>
            <label>
              Due date
              <input className="mt-1 w-full" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label className="sm:col-span-2">
              Description
              <input className="mt-1 w-full" type="text" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label>
              Status
              <select className="mt-1 w-full" value={status} onChange={(event) => setStatus(event.target.value)}>
                {editablePaymentStatuses.map((option) => (
                  <option key={option} value={option}>{option.replace(/_/g, " ")}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--muted)]">
                To record a payment as received, use "Record payment" - this correctly updates income totals.
              </p>
            </label>
            {status === "paid" ? (
              <label>
                Paid date
                <input className="mt-1 w-full" type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
              </label>
            ) : null}
          </div>
          {message ? <p className="mt-3 rounded-lg bg-[#fef2f2] p-2 text-xs font-semibold text-[#dc2626]">{message}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton disabled={isPending} onClick={save} tone="primary">{isPending ? "Saving..." : "Save changes"}</ActionButton>
            <ActionButton disabled={isPending} onClick={() => setEditing(false)}>Cancel</ActionButton>
          </div>
          {!showDeleteConfirm ? (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 5,
                  border: "0.5px solid #fecaca", background: "#fef2f2",
                  color: "#dc2626", cursor: "pointer", fontWeight: 500
                }}
              >
                Delete this payment
              </button>
            </div>
          ) : (
            <div style={{
              background: "#fef2f2", border: "0.5px solid #fecaca",
              borderRadius: 7, padding: "10px 12px", marginTop: 8
            }}>
              <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 500, margin: "0 0 6px" }}>
                Delete this payment? This cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 5,
                    border: "0.5px solid #e2e8f0", background: "#fff",
                    color: "#64748b", cursor: "pointer"
                  }}
                >
                  Cancel
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
                        setMessage(error instanceof Error ? error.message : "Failed to delete payment");
                      }
                    });
                  }}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 5,
                    border: "none", background: "#dc2626",
                    color: "#fff", cursor: "pointer", fontWeight: 500
                  }}
                >
                  Confirm delete
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
    if (isRefund) return "text-[#d97706]";
    return Number(transaction.amount) >= 0 ? "text-[#16a34a]" : "text-[#be123c]";
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
        setMessage(error instanceof Error ? error.message : "Unable to update this transaction.");
      }
    });
  }

  return (
    <div className={`sub-surface p-3 ${voided ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-black ${voided ? "text-[var(--muted)]" : "text-[#10252b]"}`}>{String(transaction.type || "other").replace(/_/g, " ")}</p>
            {isRefund ? <SmallBadge tone="amber">Refund</SmallBadge> : null}
            {voided ? <SmallBadge tone="neutral">Voided</SmallBadge> : null}
          </div>
          <p className={`text-sm ${voided ? "text-[var(--muted)]" : "text-[#667085]"}`}>{dateLabel(transaction.transaction_date)} {transaction.notes ? `/ ${transaction.notes}` : ""}</p>
          {isRefund && transaction.metadata?.refund_reason ? <p className="mt-1 text-sm font-semibold text-[#b45309]">{transaction.metadata.refund_reason}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`font-mono-data font-black ${amountClass}`}>{money(transaction.amount, transaction.currency || "THB")}</span>
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
              Amount
              <div className="mt-1 flex items-center rounded-lg border border-[var(--border-strong)] bg-white">
                <span className="font-mono-data px-3 text-sm font-black text-[var(--muted)]">฿</span>
                <input className="font-mono-data h-9 min-w-0 flex-1 border-0 bg-transparent px-0 pr-3 text-sm outline-none" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </div>
            </label>
            <label>
              Date
              <input className="mt-1 w-full" type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} />
            </label>
            <label>
              Type
              <select className="mt-1 w-full" value={type} onChange={(event) => setType(event.target.value)}>
                {transactionTypeOptions.map((option) => (
                  <option key={option} value={option}>{option.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              Description
              <input className="mt-1 w-full" type="text" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
          </div>
          {message ? <p className="mt-3 rounded-lg bg-[#fef2f2] p-2 text-xs font-semibold text-[#dc2626]">{message}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton disabled={isPending} onClick={save} tone="primary">{isPending ? "Saving..." : "Save changes"}</ActionButton>
            <ActionButton disabled={isPending} onClick={() => setEditing(false)}>Cancel</ActionButton>
          </div>
          {!showDeleteConfirm ? (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 5,
                  border: "0.5px solid #fecaca", background: "#fef2f2",
                  color: "#dc2626", cursor: "pointer", fontWeight: 500
                }}
              >
                Delete this transaction
              </button>
            </div>
          ) : (
            <div style={{
              background: "#fef2f2", border: "0.5px solid #fecaca",
              borderRadius: 7, padding: "10px 12px", marginTop: 8
            }}>
              <p style={{ fontSize: 12, color: "#dc2626", fontWeight: 500, margin: "0 0 6px" }}>
                Delete this transaction? This cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 5,
                    border: "0.5px solid #e2e8f0", background: "#fff",
                    color: "#64748b", cursor: "pointer"
                  }}
                >
                  Cancel
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
                        setMessage(error instanceof Error ? error.message : "Failed to delete transaction");
                      }
                    });
                  }}
                  style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 5,
                    border: "none", background: "#dc2626",
                    color: "#fff", cursor: "pointer", fontWeight: 500
                  }}
                >
                  Confirm delete
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
