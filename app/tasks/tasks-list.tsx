"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, Circle, ReceiptText, Wallet } from "lucide-react";
import { confirmReceiptPayment, declinePaymentReceipt, recordPaymentReceived } from "@/app/actions/bookings";
import { completeTask } from "@/app/actions/tasks";
import { PendingButton } from "@/components/pending-button";
import { Badge } from "@/components/ui";
import { taskTypeLabel } from "@/lib/task-types";
import { allocatePayment, type OpenPayment } from "@/lib/payment-allocation";
import type { TaskListItem } from "@/lib/tasks";

type Filter = "open" | "done";

const money = (value: number) => `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayLabel(iso: string | null, today: string) {
  if (!iso) return "No date";
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  if (iso === addDays(today, -1)) return "Yesterday";
  const date = new Date(`${iso}T00:00:00Z`);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" }).format(date);
}

function timeLabel(dueAt: string | null) {
  if (!dueAt) return null;
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(dueAt));
  // Tasks created with a date only are stored at midnight; showing "00:00" adds nothing.
  return time === "00:00" ? null : time;
}

type Group = { key: string; title: string; tone: "red" | "amber" | "neutral" | "teal"; items: TaskListItem[] };

function groupOpen(items: TaskListItem[], today: string): Group[] {
  const weekEnd = addDays(today, 7);
  const groups: Group[] = [
    { key: "receipts", title: "Receipts to check", tone: "teal", items: [] },
    { key: "overdue", title: "Overdue", tone: "red", items: [] },
    { key: "today", title: "Today", tone: "amber", items: [] },
    { key: "week", title: "Next 7 days", tone: "neutral", items: [] },
    { key: "later", title: "Later", tone: "neutral", items: [] }
  ];
  for (const item of items) {
    const due = item.dueDate;
    // A customer is waiting on these, whenever the payment falls due.
    if (item.receipt) groups[0].items.push(item);
    else if (due && due < today) groups[1].items.push(item);
    else if (due === today) groups[2].items.push(item);
    else if (due && due <= weekEnd) groups[3].items.push(item);
    else groups[4].items.push(item);
  }
  return groups.filter((group) => group.items.length > 0);
}

const METHODS = [
  ["cash", "Cash"],
  ["bank_transfer", "Bank transfer"],
  ["promptpay", "PromptPay"],
  ["wise", "Wise"],
  ["revolut", "Revolut"],
  ["other", "Other"]
] as const;

function methodLabel(method: string) {
  return METHODS.find(([key]) => key === method)?.[1] || "Other";
}

/**
 * Recording money received, with or without a receipt from the customer. Covers
 * the cases that aren't "the exact amount for one payment": short, too much, or
 * one transfer for several payments. Staff say what arrived and what it is for,
 * and see where every baht goes before confirming.
 */
function ReceivePaymentPanel({ item, siblings, today, onClose }: { item: TaskListItem; siblings: TaskListItem[]; today: string; onClose: () => void }) {
  const router = useRouter();
  const receipt = item.receipt;
  const openPayments: OpenPayment[] = useMemo(
    () =>
      [item, ...siblings]
        .filter((entry) => entry.rentalPaymentId)
        .map((entry) => ({ id: entry.rentalPaymentId as string, label: entry.paymentLabel || entry.title, amount: entry.amount || 0, dueDate: entry.dueDate || "9999-12-31" }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [item, siblings]
  );
  const [value, setValue] = useState(String(receipt?.total || item.amount || ""));
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState(receipt?.method || "cash");
  const [chosenIds, setChosenIds] = useState<string[]>(receipt?.paymentIds?.length ? receipt.paymentIds : [item.rentalPaymentId as string]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const received = Number(value || 0);
  const chosen = openPayments.filter((payment) => chosenIds.includes(payment.id));
  const others = openPayments.filter((payment) => !chosenIds.includes(payment.id));
  // A long rental has a year of payments; only the near ones are worth offering.
  const horizon = addDays(today, 35);
  const offered = openPayments.filter((payment) => payment.dueDate <= horizon || chosenIds.includes(payment.id));
  const lines = received > 0 ? allocatePayment(received, chosen, others) : [];

  function toggle(id: string) {
    // The payment the receipt was sent for always stays ticked.
    if (id === item.rentalPaymentId) return;
    setChosenIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  }

  function save() {
    setError(null);
    if (!(received > 0)) {
      setError("Enter the amount received.");
      return;
    }
    startTransition(async () => {
      try {
        await confirmReceiptPayment({ paymentId: item.rentalPaymentId as string, amount: received, date, method, paymentIds: chosenIds });
        onClose();
        router.refresh();
      } catch {
        setError("Couldn't record this payment. Please try again.");
      }
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      try {
        await declinePaymentReceipt(item.rentalPaymentId as string);
        onClose();
        router.refresh();
      } catch {
        setError("Couldn't update this payment. Please try again.");
      }
    });
  }

  const field = "mt-1 h-10 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm";
  return (
    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-semibold text-[var(--foreground-secondary)]">
          Amount that arrived (฿)
          <input autoFocus className={field} inputMode="decimal" min="0" onChange={(event) => setValue(event.target.value)} step="0.01" type="number" value={value} />
        </label>
        <label className="text-xs font-semibold text-[var(--foreground-secondary)]">
          Date received
          <input className={field} max={today} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </label>
        <label className="text-xs font-semibold text-[var(--foreground-secondary)]">
          Method
          <select className={field} onChange={(event) => setMethod(event.target.value)} value={method}>
            {METHODS.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {offered.length > 1 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--foreground-secondary)]">What is it for?</p>
          <div className="mt-1 space-y-1">
            {offered.map((payment) => (
              <label className="flex min-h-9 items-center gap-2 rounded-lg bg-white px-3 text-sm" key={payment.id}>
                <input checked={chosenIds.includes(payment.id)} disabled={payment.id === item.rentalPaymentId} onChange={() => toggle(payment.id)} type="checkbox" />
                <span className="min-w-0 flex-1 truncate">{payment.label}</span>
                <span className="text-xs text-[var(--muted)]">{dayLabel(payment.dueDate === "9999-12-31" ? null : payment.dueDate, today)}</span>
                <span className="font-semibold">{money(payment.amount)}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {lines.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
          <p className="text-xs font-semibold text-[var(--foreground-secondary)]">What will be recorded</p>
          <ul className="mt-1 space-y-1 text-sm">
            {lines.map((line) => (
              <li className="flex flex-wrap items-baseline justify-between gap-x-3" key={line.id}>
                <span className="font-semibold text-[var(--foreground)]">
                  {line.carried ? "Extra goes to " : ""}
                  {line.label}
                </span>
                <span className={line.stillDue > 0 || line.extra > 0 ? "font-semibold text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}>
                  {line.paid <= 0
                    ? "Nothing left for this · stays due"
                    : line.extra > 0
                      ? `${money(line.paid)} recorded · ${money(line.extra)} more than was due`
                      : line.stillDue > 0
                        ? `${money(line.paid)} paid · ${money(line.stillDue)} stays due`
                        : `${money(line.paid)} · paid in full`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="primary-action pressable min-h-9 px-4 text-xs" disabled={isPending} onClick={save} type="button">
          {isPending ? "Saving…" : `Record ${received > 0 ? money(received) : "payment"}`}
        </button>
        <button className="secondary-action pressable min-h-9 px-4 text-xs" disabled={isPending} onClick={onClose} type="button">
          Cancel
        </button>
        {receipt ? (
          <button className="pressable ml-auto min-h-9 px-2 text-xs font-semibold text-[var(--danger)]" disabled={isPending} onClick={decline} type="button">
            Nothing arrived
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TaskRow({ item, organizationId, today, siblings = [] }: { item: TaskListItem; organizationId: string; today: string; siblings?: TaskListItem[] }) {
  const [showNote, setShowNote] = useState(false);
  const [recording, setRecording] = useState(false);
  const router = useRouter();
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [isConfirming, startConfirm] = useTransition();
  const receipt = item.kind === "payment" ? item.receipt : null;

  function confirmReceipt() {
    if (!item.rentalPaymentId || !receipt) return;
    setReceiptError(null);
    startConfirm(async () => {
      try {
        await confirmReceiptPayment({ paymentId: item.rentalPaymentId as string, amount: receipt.total, date: today, method: receipt.method, paymentIds: receipt.paymentIds });
        router.refresh();
      } catch {
        setReceiptError("Couldn't confirm this payment. Please try again.");
      }
    });
  }

  const coversSeveral = !!receipt && receipt.paymentIds.length > 1;
  const overdue = !item.completedAt && !!item.dueDate && item.dueDate < today;
  const time = item.kind === "task" ? timeLabel(item.dueAt) : null;
  const context = [item.customerName, item.vehicleLabel, item.rentalLabel].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {receipt ? (
          <ReceiptText className="mt-0.5 shrink-0 text-[var(--primary)]" size={20} />
        ) : item.kind === "payment" ? (
          <Wallet className={`mt-0.5 shrink-0 ${overdue ? "text-[var(--danger)]" : "text-[var(--primary)]"}`} size={20} />
        ) : item.completedAt ? (
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
        ) : (
          <Circle className="mt-0.5 shrink-0 text-[var(--muted)]" size={20} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-bold text-[var(--foreground)]">{coversSeveral ? `Receipt for ${receipt.paymentIds.length} payments` : receipt ? item.paymentLabel || item.title : item.title}</p>
            {item.amount != null ? <span className="font-semibold text-[var(--foreground)]">{money(receipt ? receipt.total : item.amount)}</span> : null}
            {item.kind === "task" ? <Badge tone="neutral">{taskTypeLabel(item.taskType)}</Badge> : null}
          </div>
          {context ? <p className="mt-0.5 text-sm sm:truncate text-[var(--foreground-secondary)]">{context}</p> : null}
          <p className={`mt-0.5 text-xs font-semibold ${overdue ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
            {item.completedAt
              ? `Done ${dayLabel(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(item.completedAt)), today)}`
              : item.dueDate
                ? `${overdue ? "Was due" : "Due"} ${dayLabel(item.dueDate, today)}${time ? ` · ${time}` : ""}`
                : "No due date"}
          </p>
          {coversSeveral ? (
            <p className="mt-0.5 text-sm text-[var(--foreground-secondary)]">
              {[item, ...siblings].filter((entry) => receipt.paymentIds.includes(entry.rentalPaymentId || "")).map((entry) => `${entry.paymentLabel} ${money(entry.amount || 0)}`).join(" + ")}
            </p>
          ) : null}
          {receipt ? (
            <p className="mt-1 text-sm font-semibold text-[var(--primary)]">
              Customer sent a receipt · {methodLabel(receipt.method)} · {dayLabel(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(receipt.submittedAt)), today)}
            </p>
          ) : null}
          {receiptError ? <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{receiptError}</p> : null}
          {recording && item.rentalPaymentId ? (
            <ReceivePaymentPanel item={item} onClose={() => setRecording(false)} siblings={siblings} today={today} />
          ) : null}
          {showNote && !item.completedAt ? (
            <form action={completeTask} className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input name="organizationId" type="hidden" value={organizationId} />
              <input name="taskId" type="hidden" value={item.id} />
              <input
                aria-label="Note"
                autoFocus
                className="min-h-10 flex-1 rounded-lg border border-[var(--border)] px-3 text-sm"
                name="notes"
                placeholder="What was done (optional)"
              />
              <PendingButton className="primary-action min-h-10 px-4 text-sm" pendingLabel="Saving…" type="submit">
                Save & mark done
              </PendingButton>
            </form>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-8 sm:pl-0">
        {receipt?.url ? (
          <a className="secondary-action pressable min-h-9 px-3 text-xs" href={receipt.url} rel="noreferrer" target="_blank">
            View receipt
          </a>
        ) : null}
        {receipt && !recording ? (
          <>
            <button className="primary-action pressable min-h-9 px-3 text-xs" disabled={isConfirming} onClick={confirmReceipt} type="button">
              {isConfirming ? "Saving…" : "Confirm received"}
            </button>
            <button className="secondary-action pressable min-h-9 px-3 text-xs" disabled={isConfirming} onClick={() => setRecording(true)} type="button">
              Something&apos;s different
            </button>
          </>
        ) : item.kind === "payment" && item.rentalPaymentId && !recording ? (
          <button className="primary-action pressable min-h-9 px-3 text-xs" onClick={() => setRecording(true)} type="button">
            Record payment
          </button>
        ) : null}
        {item.kind === "task" && !item.completedAt && !showNote ? (
          <>
            <form action={completeTask}>
              <input name="organizationId" type="hidden" value={organizationId} />
              <input name="taskId" type="hidden" value={item.id} />
              <PendingButton className="primary-action min-h-9 px-3 text-xs" pendingLabel="Saving…" type="submit">
                Mark done
              </PendingButton>
            </form>
            <button className="secondary-action pressable min-h-9 px-3 text-xs" onClick={() => setShowNote(true)} type="button">
              Add note
            </button>
          </>
        ) : null}
        {item.rentalId ? (
          <Link className="secondary-action pressable min-h-9 px-3 text-xs" href={`/bookings/${item.rentalId}`}>
            Booking
          </Link>
        ) : item.vehicleId ? (
          <Link className="secondary-action pressable min-h-9 px-3 text-xs" href={`/fleet/${item.vehicleId}`}>
            Vehicle
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function TasksList({
  tasks,
  organizationId,
  today,
  laterLimit = 5
}: {
  tasks: TaskListItem[];
  organizationId: string;
  today: string;
  laterLimit?: number;
}) {
  const [filter, setFilter] = useState<Filter>("open");
  const [showAllLater, setShowAllLater] = useState(false);

  const open = useMemo(() => tasks.filter((task) => !task.completedAt && !task.coveredBy), [tasks]);
  const siblingsOf = useMemo(() => {
    const byRental = new Map<string, TaskListItem[]>();
    for (const task of tasks) {
      if (task.kind !== "payment" || !task.rentalId) continue;
      byRental.set(task.rentalId, [...(byRental.get(task.rentalId) || []), task]);
    }
    return (item: TaskListItem) => (item.rentalId ? (byRental.get(item.rentalId) || []).filter((entry) => entry.id !== item.id) : []);
  }, [tasks]);
  const done = useMemo(
    () => tasks.filter((task) => !!task.completedAt).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))),
    [tasks]
  );
  const groups = useMemo(() => groupOpen(open, today), [open, today]);

  const toneClass = { red: "text-[var(--danger)]", amber: "text-[var(--warning)]", neutral: "text-[var(--foreground-secondary)]", teal: "text-[var(--primary)]" };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([
          ["open", `To do (${open.length})`],
          ["done", "Done"]
        ] as const).map(([value, label]) => (
          <button
            className={`pressable min-h-10 rounded-xl border px-4 text-sm font-bold ${filter === value ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground)]"}`}
            key={value}
            onClick={() => setFilter(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {filter === "open" ? (
        groups.length === 0 ? (
          <div className="empty-state">
            <p className="text-lg font-semibold text-[var(--foreground)]">Nothing to do</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Payments due and tasks you add on a vehicle page will appear here.</p>
          </div>
        ) : (
          groups.map((group) => {
            const limited = group.key === "later" && !showAllLater && group.items.length > laterLimit;
            const items = limited ? group.items.slice(0, laterLimit) : group.items;
            return (
              <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-white" key={group.key}>
                <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--panel-secondary)] px-4 py-2">
                  <p className={`text-xs font-semibold uppercase tracking-[0.08em] ${toneClass[group.tone]}`}>{group.title}</p>
                  <p className="text-xs font-semibold text-[var(--muted)]">{group.items.length}</p>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {items.map((item) => (
                    <TaskRow item={item} key={item.id} organizationId={organizationId} siblings={item.kind === "payment" ? siblingsOf(item) : []} today={today} />
                  ))}
                </div>
                {limited ? (
                  <button
                    className="w-full border-t border-[var(--border)] px-4 py-2 text-left text-sm font-bold text-[var(--primary)]"
                    onClick={() => setShowAllLater(true)}
                    type="button"
                  >
                    Show {group.items.length - laterLimit} more
                  </button>
                ) : null}
              </section>
            );
          })
        )
      ) : done.length === 0 ? (
        <div className="empty-state">
          <p className="text-lg font-semibold text-[var(--foreground)]">No finished tasks yet</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <div className="divide-y divide-[var(--border)]">
            {done.slice(0, 50).map((item) => (
              <TaskRow item={item} key={item.id} organizationId={organizationId} today={today} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
