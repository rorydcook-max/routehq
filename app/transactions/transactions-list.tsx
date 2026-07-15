"use client";

import { useMemo, useState, useTransition } from "react";
import { Car, Check, Pencil, ReceiptText, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { bulkDeleteTransactions, deleteTransaction, updateTransaction } from "@/app/actions/transactions";
import { EmptyState } from "@/components/ui";
import { isIncomeTransactionType, TRANSACTION_TYPE_OPTIONS } from "@/lib/transaction-options";
import type { TransactionListItem } from "@/lib/transactions";

const filters = ["all", "income", "expense"] as const;

type VehicleOption = { id: string; label: string };
type TransactionKind = "income" | "expense" | "deposit_received" | "deposit_refunded";

function money(value: number, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.abs(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function inputDate(value: string) {
  return String(value || "").slice(0, 10);
}

function transactionKind(transaction: TransactionListItem): TransactionKind {
  if (transaction.type === "deposit_refunded") return "deposit_refunded";
  if (transaction.type === "deposit_received" || transaction.type === "deposit" || transaction.isDeposit) return "deposit_received";
  if (isIncomeTransactionType(transaction.type)) return "income";
  return "expense";
}

function badgeForKind(kind: TransactionKind) {
  if (kind === "deposit_received") return { label: "Deposit received", className: "border-amber-200 bg-amber-50 text-amber-700" };
  if (kind === "deposit_refunded") return { label: "Deposit refunded", className: "border-amber-200 bg-amber-50 text-amber-700" };
  if (kind === "income") return { label: "Income", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  return { label: "Expense", className: "border-slate-200 bg-slate-50 text-slate-600" };
}

function amountPresentation(transaction: TransactionListItem) {
  const kind = transactionKind(transaction);
  if (kind === "deposit_received") {
    return { prefix: "", className: "text-amber-600" };
  }
  if (kind === "deposit_refunded") {
    return { prefix: "-", className: "text-amber-600" };
  }
  if (kind === "income") {
    return { prefix: "+", className: "text-emerald-600" };
  }
  return { prefix: "-", className: "text-red-600" };
}

function vehicleLabelFromId(vehicles: VehicleOption[], id: string | null | undefined, fallback: string) {
  return vehicles.find((vehicle) => vehicle.id === id)?.label || fallback;
}

function TransactionEditForm({
  onCancel,
  onSaved,
  transaction,
  vehicles
}: {
  onCancel: () => void;
  onSaved: (message: string) => void;
  transaction: TransactionListItem;
  vehicles: VehicleOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(Math.abs(transaction.amount || 0)));
  const [date, setDate] = useState(inputDate(transaction.transactionDate));
  const [type, setType] = useState(transaction.type);
  const [notes, setNotes] = useState(transaction.notes || "");
  const [vehicleLabel, setVehicleLabel] = useState(vehicleLabelFromId(vehicles, transaction.vehicleId, transaction.vehicleLabel));

  const datalistId = `transaction-vehicle-${transaction.id}`;

  function save() {
    const selectedVehicle = vehicles.find((vehicle) => vehicle.label === vehicleLabel) || vehicles.find((vehicle) => vehicle.id === transaction.vehicleId);
    setError(null);
    startTransition(async () => {
      try {
        await updateTransaction(transaction.id, {
          amount: Number(amount || 0),
          date,
          description: notes,
          type,
          vehicleId: selectedVehicle?.id || transaction.vehicleId
        });
        onSaved("Transaction updated");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not update transaction.");
      }
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
      <div className="grid gap-3 md:grid-cols-[120px_150px_1fr]">
        <label>
          Amount
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">฿</span>
            <input
              className="w-full pl-8"
              min="0"
              onChange={(event) => setAmount(event.target.value)}
              step="0.01"
              type="number"
              value={amount}
            />
          </div>
        </label>
        <label>
          Date
          <input className="mt-1 w-full" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </label>
        <label>
          Type
          <select className="mt-1 w-full" onChange={(event) => setType(event.target.value)} value={type}>
            {TRANSACTION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2">
          Vehicle
          <input
            className="mt-1 w-full"
            list={datalistId}
            onChange={(event) => setVehicleLabel(event.target.value)}
            placeholder="Search vehicle"
            value={vehicleLabel}
          />
          <datalist id={datalistId}>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.label} />
            ))}
          </datalist>
        </label>
        <label>
          Notes
          <input className="mt-1 w-full" onChange={(event) => setNotes(event.target.value)} value={notes} />
        </label>
      </div>
      {error ? <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p> : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button className="secondary-action pressable min-h-9 px-3 text-xs" disabled={isPending} onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-action pressable min-h-9 px-3 text-xs" disabled={isPending} onClick={save} type="button">
          {isPending ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

export function TransactionsList({
  transactions,
  vehicles
}: {
  transactions: TransactionListItem[];
  vehicles: VehicleOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleTransactions = useMemo(() => transactions.filter((transaction) => !hiddenIds.has(transaction.id)), [hiddenIds, transactions]);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return visibleTransactions.filter((transaction) => {
      const kind = transactionKind(transaction);
      if (filter === "income" && kind !== "income") return false;
      if (filter === "expense" && kind !== "expense") return false;
      const haystack = [
        transaction.typeLabel,
        transaction.vehicleLabel,
        transaction.customerName,
        transaction.notes,
        transaction.supplier,
        transaction.displayCode
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [filter, search, visibleTransactions]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, transaction) => {
        const kind = transactionKind(transaction);
        if (kind === "income") acc.income += Math.abs(transaction.amount);
        if (kind === "expense") acc.expense += Math.abs(transaction.amount);
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [filtered]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((transaction) => selectedIds.has(transaction.id));

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filtered.forEach((transaction) => next.delete(transaction.id));
      } else {
        filtered.forEach((transaction) => next.add(transaction.id));
      }
      return next;
    });
  }

  function handleDelete(id: string) {
    setError(null);
    setDeletingIds((current) => new Set(current).add(id));
    startTransition(async () => {
      try {
        await deleteTransaction(id);
        setHiddenIds((current) => new Set(current).add(id));
        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        setConfirmDeleteId(null);
        showToast("Transaction deleted");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not delete transaction.");
      } finally {
        setDeletingIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setError(null);
    setDeletingIds((current) => new Set([...Array.from(current), ...ids]));
    startTransition(async () => {
      try {
        const result = await bulkDeleteTransactions(ids);
        setHiddenIds((current) => new Set([...Array.from(current), ...ids]));
        setSelectedIds(new Set());
        setBulkConfirm(false);
        showToast(`${result.deleted} transaction${result.deleted === 1 ? "" : "s"} deleted`);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not delete selected transactions.");
      } finally {
        setDeletingIds(new Set());
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid items-stretch gap-3 sm:grid-cols-3">
        <div className="content-section flex min-h-[84px] flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Income</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{money(totals.income)}</p>
        </div>
        <div className="content-section flex min-h-[84px] flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Expenses</p>
          <p className="mt-1 text-2xl font-black text-red-600">{money(totals.expense)}</p>
        </div>
        <div className="content-section flex min-h-[84px] flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">Net</p>
          <p className="mt-1 text-2xl font-black text-[var(--primary)]">{money(totals.income - totals.expense)}</p>
        </div>
      </div>

      <div className="content-section">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
            <label className="checkbox-label rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--foreground-secondary)] md:self-stretch">
              <input checked={allFilteredSelected} className="flex-shrink-0" onChange={toggleAllFiltered} type="checkbox" />
              <span>Select all</span>
            </label>
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" size={16} />
              <input
                className="input-with-leading-icon w-full rounded-xl border border-[var(--border)] bg-white pr-4 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search type, vehicle, supplier, notes"
                value={search}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.map((entry) => (
              <button
                className={`pressable min-h-9 rounded-xl border px-4 py-2 text-sm font-black capitalize ${filter === entry ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
                key={entry}
                onClick={() => setFilter(entry)}
                type="button"
              >
                {entry}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      {filtered.length === 0 ? (
        <EmptyState
          title="No transactions found"
          description={
            search.trim()
              ? `No results for "${search.trim()}". Try another search.`
              : "Record rental income, fuel, maintenance, or deposits from the button above."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((transaction) => {
            const kind = transactionKind(transaction);
            const badge = badgeForKind(kind);
            const amount = amountPresentation(transaction);
            const deleting = deletingIds.has(transaction.id);
            const selected = selectedIds.has(transaction.id);

            return (
              <div
                className={`content-section transition duration-150 ${deleting ? "scale-[0.99] opacity-40" : "opacity-100"} ${selected ? "ring-2 ring-[rgba(14,116,144,0.18)]" : ""}`}
                key={transaction.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <input
                      aria-label={`Select transaction ${transaction.typeLabel}`}
                      checked={selected}
                      className="mt-[14px] flex-shrink-0"
                      onChange={() => toggleSelected(transaction.id)}
                      type="checkbox"
                    />
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                      {kind === "income" || kind === "deposit_received" ? <ReceiptText size={20} /> : <Car size={20} />}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-[var(--foreground)]">{transaction.typeLabel}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground-secondary)]">{transaction.vehicleLabel}</p>
                      <p className="text-sm text-[var(--muted)]">
                        {formatDate(transaction.transactionDate)}
                        {transaction.customerName ? ` - ${transaction.customerName}` : ""}
                        {transaction.supplier ? ` - ${transaction.supplier}` : ""}
                      </p>
                      {transaction.notes ? <p className="mt-1 text-sm text-[var(--muted)]">{transaction.notes}</p> : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className={`text-xl font-black tabular-nums ${amount.className}`}>
                      {amount.prefix}
                      {money(transaction.amount, transaction.currency)}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Edit transaction"
                        className="pressable flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                        onClick={() => {
                          setEditingId(editingId === transaction.id ? null : transaction.id);
                          setConfirmDeleteId(null);
                        }}
                        type="button"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        aria-label="Delete transaction"
                        className="pressable flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-white text-red-500 hover:bg-red-50"
                        onClick={() => {
                          setConfirmDeleteId(confirmDeleteId === transaction.id ? null : transaction.id);
                          setEditingId(null);
                        }}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {editingId === transaction.id ? (
                  <TransactionEditForm
                    onCancel={() => setEditingId(null)}
                    onSaved={(message) => {
                      setEditingId(null);
                      showToast(message);
                    }}
                    transaction={transaction}
                    vehicles={vehicles}
                  />
                ) : null}

                {confirmDeleteId === transaction.id ? (
                  <div className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3">
                    <p className="text-sm font-semibold text-red-700">Delete this transaction?</p>
                    <p className="mt-1 text-xs text-red-600">This removes the transaction from totals. Deposit transactions will also be removed from deposit history.</p>
                    <div className="mt-3 flex justify-end gap-2">
                      <button className="secondary-action pressable min-h-9 px-3 text-xs" onClick={() => setConfirmDeleteId(null)} type="button">
                        Cancel
                      </button>
                      <button
                        className="pressable min-h-9 rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700"
                        disabled={isPending}
                        onClick={() => handleDelete(transaction.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {selectedIds.size > 0 ? (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-3xl rounded-2xl border border-[var(--border)] bg-white p-3 shadow-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[var(--foreground)]">
                {selectedIds.size} transaction{selectedIds.size === 1 ? "" : "s"} selected
              </p>
              {bulkConfirm ? <p className="mt-1 text-xs text-red-600">Delete selected transactions? This cannot be undone.</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="secondary-action pressable min-h-9 px-3 text-xs" onClick={() => setSelectedIds(new Set())} type="button">
                <X size={14} />
                Clear
              </button>
              {bulkConfirm ? (
                <>
                  <button className="secondary-action pressable min-h-9 px-3 text-xs" onClick={() => setBulkConfirm(false)} type="button">
                    Cancel
                  </button>
                  <button
                    className="pressable flex min-h-9 items-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700"
                    disabled={isPending}
                    onClick={handleBulkDelete}
                    type="button"
                  >
                    <Check size={14} />
                    Confirm delete
                  </button>
                </>
              ) : (
                <button
                  className="pressable flex min-h-9 items-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700"
                  onClick={() => setBulkConfirm(true)}
                  type="button"
                >
                  <Trash2 size={14} />
                  Delete selected
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-[var(--foreground)] px-4 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div> : null}
    </div>
  );
}
