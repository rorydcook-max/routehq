"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronLeft, ChevronRight, Pencil, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;
/** The words for this screen, the name of each kind of money entry, and the language for dates. */
type Tx = { say: Say; typeName: (type: string, fallback?: string) => string; locale: string };

function useTx(): Tx {
  const t = useTranslations("money");
  const locale = useLocale();
  return { say: t as unknown as Say, typeName: (type, fallback) => (t.has(`type_${type}`) ? t(`type_${type}`) : fallback || type.replace(/_/g, " ")), locale };
}
import { bulkDeleteTransactions, deleteTransaction, updateTransaction } from "@/app/actions/transactions";
import { isIncomeTransactionType, TRANSACTION_TYPE_OPTIONS } from "@/lib/transaction-options";
import type { TransactionListItem } from "@/lib/transactions";

type VehicleOption = { id: string; label: string };
type TransactionKind = "income" | "expense" | "deposit_received" | "deposit_refunded";

function money(value: number, currency = "THB") {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.abs(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
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
  if (kind === "deposit_received") return { label: "Deposit received", className: "border-[var(--warning-line)] bg-[var(--warning-light)] text-[var(--warning)]" };
  if (kind === "deposit_refunded") return { label: "Deposit refunded", className: "border-[var(--warning-line)] bg-[var(--warning-light)] text-[var(--warning)]" };
  if (kind === "income") return { label: "Income", className: "border-[var(--success-line)] bg-[var(--success-light)] text-[var(--success)]" };
  return { label: "Expense", className: "border-[var(--border)] bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]" };
}

function amountPresentation(transaction: TransactionListItem) {
  const kind = transactionKind(transaction);
  if (kind === "deposit_received") {
    return { prefix: "", className: "text-[var(--warning)]" };
  }
  if (kind === "deposit_refunded") {
    return { prefix: "-", className: "text-[var(--warning)]" };
  }
  if (kind === "income") {
    return { prefix: "+", className: "text-[var(--success)]" };
  }
  return { prefix: "−", className: "text-[var(--foreground)]" };
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
  const tx = useTx();
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
        onSaved(tx.say("updated"));
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : tx.say("updateFailed"));
      }
    });
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
      <div className="grid gap-3 md:grid-cols-[120px_150px_1fr]">
        <label>
          {tx.say("f_amount")}
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
          {tx.say("date")}
          <input className="mt-1 w-full" onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </label>
        <label>
          {tx.say("f_type")}
          <select className="mt-1 w-full" onChange={(event) => setType(event.target.value)} value={type}>
            {TRANSACTION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {tx.typeName(option.value, option.label)}
              </option>
            ))}
          </select>
        </label>
        <label className="md:col-span-2">
          {tx.say("vehicle")}
          <input
            className="mt-1 w-full"
            list={datalistId}
            onChange={(event) => setVehicleLabel(event.target.value)}
            placeholder={tx.say("searchVehicle")}
            value={vehicleLabel}
          />
          <datalist id={datalistId}>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.label} />
            ))}
          </datalist>
        </label>
        <label>
          {tx.say("f_notes")}
          <input className="mt-1 w-full" onChange={(event) => setNotes(event.target.value)} value={notes} />
        </label>
      </div>
      {error ? <p className="mt-2 rounded-md bg-[var(--danger-light)] px-3 py-2 text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button className="secondary-action pressable min-h-9 px-3 text-xs" disabled={isPending} onClick={onCancel} type="button">
          {tx.say("cancel")}
        </button>
        <button className="primary-action pressable min-h-9 px-3 text-xs" disabled={isPending} onClick={save} type="button">
          {isPending ? tx.say("saving") : tx.say("saveChanges")}
        </button>
      </div>
    </div>
  );
}

// ── Period helpers (plain YYYY-MM-DD strings, no time zones involved) ─────────

type PeriodMode = "day" | "week" | "month" | "year" | "custom";

// Their names are in the language files (money.mode_<key>).
const PERIOD_MODES: PeriodMode[] = ["day", "week", "month", "year", "custom"];

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function fromIso(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

function shiftDays(iso: string, days: number) {
  const date = fromIso(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

function periodRange(mode: PeriodMode, anchor: string, custom: { from: string; to: string }) {
  const date = fromIso(anchor);
  if (mode === "day") return { from: anchor, to: anchor };
  if (mode === "week") {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    const from = shiftDays(anchor, -mondayOffset);
    return { from, to: shiftDays(from, 6) };
  }
  if (mode === "month") {
    const from = toIso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
    const to = toIso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
    return { from, to };
  }
  if (mode === "year") return { from: `${date.getUTCFullYear()}-01-01`, to: `${date.getUTCFullYear()}-12-31` };
  return custom.from <= custom.to ? custom : { from: custom.to, to: custom.from };
}

function shiftAnchor(mode: PeriodMode, anchor: string, direction: 1 | -1) {
  const date = fromIso(anchor);
  if (mode === "day") return shiftDays(anchor, direction);
  if (mode === "week") return shiftDays(anchor, 7 * direction);
  if (mode === "month") return toIso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1)));
  return toIso(new Date(Date.UTC(date.getUTCFullYear() + direction, 0, 1)));
}

function fmt(iso: string, options: Intl.DateTimeFormatOptions, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", ...options }).format(fromIso(iso));
}

function periodLabel(mode: PeriodMode, range: { from: string; to: string }, today: string, tx: Tx) {
  if (mode === "day") {
    if (range.from === today) return tx.say("today");
    if (range.from === shiftDays(today, -1)) return tx.say("yesterday");
    return fmt(range.from, { weekday: "short", day: "numeric", month: "short", year: "numeric" }, tx.locale);
  }
  if (mode === "month") return fmt(range.from, { month: "long", year: "numeric" }, tx.locale);
  if (mode === "year") return range.from.slice(0, 4);
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  return `${fmt(range.from, sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" }, tx.locale)} – ${fmt(range.to, { day: "numeric", month: "short", year: "numeric" }, tx.locale)}`;
}

function dayHeading(iso: string, today: string, tx: Tx) {
  if (iso === today) return tx.say("today");
  if (iso === shiftDays(today, -1)) return tx.say("yesterday");
  return fmt(iso, { weekday: "short", day: "numeric", month: "short" }, tx.locale);
}

export function TransactionsList({
  today,
  transactions,
  vehicles,
  showProfit = true
}: {
  today: string;
  transactions: TransactionListItem[];
  vehicles: VehicleOption[];
  /** Off for teammates: they see what came in and went out, not how the business did. */
  showProfit?: boolean;
}) {
  const router = useRouter();
  const tx = useTx();
  const [mode, setMode] = useState<PeriodMode>("month");
  const [anchor, setAnchor] = useState(today);
  const [custom, setCustom] = useState({ from: `${today.slice(0, 8)}01`, to: today });
  const [search, setSearch] = useState("");
  const [phoneSide, setPhoneSide] = useState<"in" | "out">("in");
  const [selecting, setSelecting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const range = useMemo(() => periodRange(mode, anchor, custom), [mode, anchor, custom]);
  const isCurrentPeriod = mode !== "custom" && range.from <= today && today <= range.to;

  const inPeriod = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return transactions.filter((transaction) => {
      if (hiddenIds.has(transaction.id)) return false;
      const day = inputDate(transaction.transactionDate);
      if (day < range.from || day > range.to) return false;
      if (!needle) return true;
      return [transaction.typeLabel, transaction.vehicleLabel, transaction.customerName, transaction.notes, transaction.supplier, transaction.displayCode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [hiddenIds, range, search, transactions]);

  const { income, expenses, deposits } = useMemo(() => {
    const byDateDesc = (a: TransactionListItem, b: TransactionListItem) => String(b.transactionDate).localeCompare(String(a.transactionDate));
    return {
      income: inPeriod.filter((transaction) => transactionKind(transaction) === "income").sort(byDateDesc),
      expenses: inPeriod.filter((transaction) => transactionKind(transaction) === "expense").sort(byDateDesc),
      deposits: inPeriod.filter((transaction) => transactionKind(transaction).startsWith("deposit")).sort(byDateDesc)
    };
  }, [inPeriod]);

  const sum = (items: TransactionListItem[]) => items.reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
  const incomeTotal = sum(income);
  const expenseTotal = sum(expenses);
  const profit = incomeTotal - expenseTotal;
  const depositsIn = sum(deposits.filter((transaction) => transactionKind(transaction) === "deposit_received"));
  const depositsOut = sum(deposits.filter((transaction) => transactionKind(transaction) === "deposit_refunded"));

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

  function stopSelecting() {
    setSelecting(false);
    setSelectedIds(new Set());
    setBulkConfirm(false);
  }

  function handleDelete(id: string) {
    setError(null);
    setDeletingIds((current) => new Set(current).add(id));
    startTransition(async () => {
      try {
        await deleteTransaction(id);
        setHiddenIds((current) => new Set(current).add(id));
        setConfirmDeleteId(null);
        showToast(tx.say("deleted"));
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : tx.say("deleteFailed"));
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
        stopSelecting();
        showToast(tx.say("bulkDeleted", { count: result.deleted }));
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : tx.say("bulkFailed"));
      } finally {
        setDeletingIds(new Set());
      }
    });
  }

  function renderRow(transaction: TransactionListItem) {
    const kind = transactionKind(transaction);
    const amount = amountPresentation(transaction);
    const deleting = deletingIds.has(transaction.id);
    const selected = selectedIds.has(transaction.id);
    // One line under the title. Money in: who and which vehicle. Money out: the vehicle and what it was for; the plate stays on the vehicle page.
    const vehicleName = transaction.vehicleLabel.replace(/^\S*\d\S*\s+/, "");
    const who = kind === "expense"
      ? [vehicleName, transaction.notes || transaction.supplier].filter(Boolean).join(" · ")
      : [transaction.customerName || transaction.supplier, vehicleName].filter(Boolean).join(" · ");
    return (
      <li className={`group px-4 py-3.5 transition ${deleting ? "opacity-40" : ""} ${selected ? "bg-[var(--primary-light)]" : "hover:bg-[var(--panel-secondary)]"}`} key={transaction.id}>
        <div className="flex items-center gap-3">
          {selecting ? (
            <input
              aria-label={tx.say("selectAria", { name: tx.typeName(transaction.type, transaction.typeLabel) })}
              checked={selected}
              className="flex-shrink-0"
              onChange={() => toggleSelected(transaction.id)}
              type="checkbox"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold text-[var(--foreground)]">
              {tx.typeName(transaction.type, transaction.typeLabel)}
              {kind.startsWith("deposit") ? <span className="ml-2 font-medium text-[var(--muted)]">{kind === "deposit_refunded" ? tx.say("returned") : tx.say("held")}</span> : null}
            </p>
            {who ? <p className="truncate font-medium text-[var(--foreground-secondary)]">{who}</p> : null}
          </div>
          <p className={`flex-shrink-0 text-[17px] font-bold tabular-nums ${amount.className}`}>
            {amount.prefix}
            {money(transaction.amount, transaction.currency)}
          </p>
          <div className="flex flex-shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:focus-within:opacity-100">
            <button
              aria-label={tx.say("editAria")}
              className="pressable flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--panel-tertiary)] hover:text-[var(--primary)]"
              onClick={() => {
                setEditingId(editingId === transaction.id ? null : transaction.id);
                setConfirmDeleteId(null);
              }}
              type="button"
            >
              <Pencil size={14} />
            </button>
            <button
              aria-label={tx.say("deleteAria")}
              className="pressable flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--danger-light)] hover:text-[var(--danger)]"
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
          <div className="mt-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-3">
            <p className="text-sm font-semibold text-[var(--danger)]">{tx.say("deleteQ")}</p>
            <p className="mt-1 text-xs text-[var(--foreground-secondary)]">{tx.say("deleteBody")}</p>
            <div className="mt-3 flex justify-end gap-2">
              <button className="secondary-action pressable min-h-9 px-3 text-xs" onClick={() => setConfirmDeleteId(null)} type="button">
                {tx.say("keepIt")}
              </button>
              <button
                className="pressable min-h-9 rounded-lg bg-[var(--danger)] px-3 text-xs font-semibold text-white"
                disabled={isPending}
                onClick={() => handleDelete(transaction.id)}
                type="button"
              >
                {tx.say("delete")}
              </button>
            </div>
          </div>
        ) : null}
      </li>
    );
  }

  function renderDays(items: TransactionListItem[]) {
    const days: Array<{ day: string; items: TransactionListItem[] }> = [];
    for (const transaction of items) {
      const day = inputDate(transaction.transactionDate);
      const last = days[days.length - 1];
      if (last && last.day === day) last.items.push(transaction);
      else days.push({ day, items: [transaction] });
    }
    return days.map((group) => (
      <div key={group.day}>
        {mode !== "day" ? (
          <p className="flex items-center justify-between border-y border-[var(--border)] bg-[var(--panel-secondary)] px-4 py-1.5 text-[12px] font-semibold text-[var(--muted)]">
            <span>{dayHeading(group.day, today, tx)}</span>
            {group.items.length > 1 ? <span className="tabular-nums">{money(sum(group.items))}</span> : null}
          </p>
        ) : null}
        <ul className="divide-y divide-[var(--border)]">{group.items.map(renderRow)}</ul>
      </div>
    ));
  }

  function renderColumn(side: "in" | "out") {
    const items = side === "in" ? income : expenses;
    const total = side === "in" ? incomeTotal : expenseTotal;
    return (
      <section className={`overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-sm)] ${phoneSide === side ? "" : "hidden lg:block"}`}>
        {/* On a phone the tab above and the totals at the top already say this; the heading is for the two-column layout. */}
        <header className="hidden items-center justify-between gap-3 px-4 py-3 lg:flex">
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex h-8 w-8 items-center justify-center rounded-[9px] ${side === "in" ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--danger-light)] text-[var(--danger)]"}`}>
              {side === "in" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">{side === "in" ? tx.say("moneyIn") : tx.say("moneyOut")}</h2>
              <p className="text-[12px] text-[var(--muted)]">{items.length === 0 ? tx.say("nothingYet") : tx.say("entries", { count: items.length })}</p>
            </div>
          </div>
          <p className={`text-[18px] font-semibold tabular-nums ${side === "in" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{money(total)}</p>
        </header>
        {items.length === 0 ? (
          <p className="border-t border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--muted)]">
            {search.trim() ? tx.say("noMatch") : side === "in" ? tx.say("noIncome") : tx.say("noCosts")}
          </p>
        ) : (
          renderDays(items)
        )}
      </section>
    );
  }

  const chip = (active: boolean) =>
    `pressable whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition ${active ? "bg-white text-[var(--foreground)] shadow-[var(--shadow-sm)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`;

  return (
    <div className="space-y-4">
      {/* Period picker */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-none -mx-1 flex overflow-x-auto px-1">
          <div className="inline-flex gap-0.5 rounded-[10px] bg-[var(--panel-secondary)] p-1">
            {PERIOD_MODES.map((entry) => (
              <button aria-pressed={mode === entry} className={chip(mode === entry)} key={entry} onClick={() => setMode(entry)} type="button">
                {tx.say(`mode_${entry}`)}
              </button>
            ))}
          </div>
        </div>

        {mode === "custom" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-secondary)]">
            <input aria-label={tx.say("fromDate")} className="w-auto" max={custom.to} onChange={(event) => event.target.value && setCustom({ ...custom, from: event.target.value })} type="date" value={custom.from} />
            <span>{tx.say("to")}</span>
            <input aria-label={tx.say("toDate")} className="w-auto" min={custom.from} onChange={(event) => event.target.value && setCustom({ ...custom, to: event.target.value })} type="date" value={custom.to} />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button aria-label={tx.say("earlier")} className="pressable flex h-9 w-9 items-center justify-center rounded-[9px] border border-[var(--border)] bg-white text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]" onClick={() => setAnchor(shiftAnchor(mode, anchor, -1))} type="button">
              <ChevronLeft size={17} />
            </button>
            <p className="min-w-[150px] flex-1 text-center text-[15px] font-semibold text-[var(--foreground)] lg:flex-none">{periodLabel(mode, range, today, tx)}</p>
            <button aria-label={tx.say("later")} className="pressable flex h-9 w-9 items-center justify-center rounded-[9px] border border-[var(--border)] bg-white text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]" onClick={() => setAnchor(shiftAnchor(mode, anchor, 1))} type="button">
              <ChevronRight size={17} />
            </button>
            {!isCurrentPeriod ? (
              <button className="pressable rounded-[9px] border border-[var(--border)] bg-white px-3 py-2 text-[13px] font-semibold text-[var(--primary)]" onClick={() => setAnchor(today)} type="button">
                {mode === "day" ? tx.say("today") : tx.say(`this_${mode}`)}
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Totals for the period */}
      <div className={`grid ${showProfit ? "grid-cols-3" : "grid-cols-2"} divide-x divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]`}>
        <div className="px-3 py-3 sm:px-4">
          <p className="text-[12px] text-[var(--muted)]">{tx.say("moneyIn")}</p>
          <p className="text-[17px] font-semibold tabular-nums text-[var(--success)] sm:text-[22px]">{money(incomeTotal)}</p>
        </div>
        <div className="px-3 py-3 sm:px-4">
          <p className="text-[12px] text-[var(--muted)]">{tx.say("moneyOut")}</p>
          <p className="text-[17px] font-semibold tabular-nums text-[var(--danger)] sm:text-[22px]">{money(expenseTotal)}</p>
        </div>
        {showProfit ? (
        <div className="px-3 py-3 sm:px-4">
          <p className="text-[12px] text-[var(--muted)]">{profit < 0 ? tx.say("loss") : tx.say("profit")}</p>
          <p className={`text-[17px] font-semibold tabular-nums sm:text-[22px] ${profit < 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{money(profit)}</p>
        </div>
        ) : null}
      </div>

      {/* Search, and select-to-delete */}
      <div className="flex items-center gap-2">
        <label className="relative block min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
          <input className="input-with-leading-icon w-full" onChange={(event) => setSearch(event.target.value)} placeholder={tx.say("searchPlaceholder")} value={search} />
        </label>
        <button className="secondary-action pressable min-h-[38px] px-3 text-[13px]" onClick={() => (selecting ? stopSelecting() : setSelecting(true))} type="button">
          {selecting ? tx.say("done") : tx.say("select")}
        </button>
      </div>

      {/* Phones show one side at a time */}
      <div className="grid grid-cols-2 gap-0.5 rounded-[10px] bg-[var(--panel-secondary)] p-1 lg:hidden">
        <button aria-pressed={phoneSide === "in"} className={chip(phoneSide === "in")} onClick={() => setPhoneSide("in")} type="button">
          {tx.say("inCount", { count: income.length })}
        </button>
        <button aria-pressed={phoneSide === "out"} className={chip(phoneSide === "out")} onClick={() => setPhoneSide("out")} type="button">
          {tx.say("outCount", { count: expenses.length })}
        </button>
      </div>

      {error ? <p className="rounded-lg bg-[var(--danger-light)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {renderColumn("in")}
        {renderColumn("out")}
      </div>

      {deposits.length > 0 ? (
        <details className="group overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]">{tx.say("deposits", { count: deposits.length })}</h2>
              <p className="text-[12px] text-[var(--muted)]">{tx.say("depositsHint")}</p>
            </div>
            <p className="text-right text-[13px] text-[var(--foreground-secondary)]">
              <span className="block tabular-nums">{tx.say("taken", { amount: money(depositsIn) })}</span>
              <span className="block tabular-nums">{tx.say("returnedAmount", { amount: money(depositsOut) })}</span>
            </p>
          </summary>
          <div className="border-t border-[var(--border)]">{renderDays(deposits)}</div>
        </details>
      ) : null}

      {selecting ? (
        <div className="fixed inset-x-4 bottom-24 z-40 mx-auto max-w-2xl rounded-xl border border-[var(--border)] bg-white p-3 shadow-[var(--shadow-md)] lg:bottom-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {selectedIds.size === 0 ? tx.say("tick") : tx.say("selected", { count: selectedIds.size })}
              </p>
              {bulkConfirm ? <p className="mt-1 text-xs text-[var(--danger)]">{tx.say("deleteThem")}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="secondary-action pressable min-h-9 px-3 text-xs" onClick={stopSelecting} type="button">
                <X size={14} />
                {tx.say("cancel")}
              </button>
              {selectedIds.size > 0 ? (
                <button
                  className="pressable flex min-h-9 items-center gap-2 rounded-lg bg-[var(--danger)] px-3 text-xs font-semibold text-white"
                  disabled={isPending}
                  onClick={() => (bulkConfirm ? handleBulkDelete() : setBulkConfirm(true))}
                  type="button"
                >
                  {bulkConfirm ? <Check size={14} /> : <Trash2 size={14} />}
                  {bulkConfirm ? tx.say("yesDelete") : tx.say("deleteSelected")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="fixed bottom-24 right-4 z-50 rounded-xl bg-[var(--foreground)] px-4 py-3 text-sm font-semibold text-white shadow-xl lg:bottom-6">{toast}</div> : null}
    </div>
  );
}
