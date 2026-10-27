"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { KindChip, jobKind } from "@/components/kind-chip";
import { confirmReceiptPayment, declinePaymentReceipt } from "@/app/actions/bookings";
import { completeTask } from "@/app/actions/tasks";
import { decideEarlyWaiver } from "@/app/actions/early-start";
import { decideEarlyReturnOwed } from "@/app/actions/early-return";
import { PendingButton } from "@/components/pending-button";
import { EmptyState } from "@/components/ui";
import { dateFormat, longDate, shortDate } from "@/lib/i18n/dates";
import { allocatePayment, type OpenPayment } from "@/lib/payment-allocation";
import type { TaskListItem } from "@/lib/tasks";

type Filter = "open" | "done";

type Say = (key: string, values?: Record<string, string | number>) => string;
/** The words for this screen in the reader's language, and the language itself for dates. */
type Tx = { say: Say; has: (key: string) => boolean; locale: string };

function useTx(): Tx {
  const t = useTranslations("todo");
  const locale = useLocale();
  return { say: t as unknown as Say, has: (key) => (t as any).has(key), locale };
}

const money = (value: number) => `฿${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function plainDate(iso: string, today: string, locale: string) {
  return iso.slice(0, 4) === today.slice(0, 4) ? shortDate(iso, locale) : longDate(iso, locale);
}

function dayLabel(iso: string | null, today: string, tx: Tx) {
  if (!iso) return tx.say("noDate");
  if (iso === today) return tx.say("today");
  if (iso === addDays(today, 1)) return tx.say("tomorrow");
  if (iso === addDays(today, -1)) return tx.say("yesterday");
  return plainDate(iso, today, tx.locale);
}

/** The short note on the right of a job: "16 days late", "Today", "Tomorrow", "8 Oct". */
function whenShort(item: TaskListItem, today: string, overdue: boolean, tx: Tx) {
  if (item.completedAt) {
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(item.completedAt));
    return dayLabel(day, today, tx);
  }
  const due = item.dueDate;
  if (!due) return "";
  if (overdue) {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000);
    return tx.say("daysLate", { count: days });
  }
  return dayLabel(due, today, tx);
}

/** "฿9,500 rent": the amount leads, the kind follows. */
function payTitle(item: TaskListItem, tx: Tx) {
  const amount = money(item.receipt ? item.receipt.total : item.bundle ? item.bundle.total : item.amount || 0);
  const kind = item.pay?.kind || "rent";
  return tx.say(tx.has(`payTitle_${kind}`) ? `payTitle_${kind}` : "payTitle_rent", { amount });
}

/** The vehicle without its plate: "Honda CRF", not "Honda CRF · 1กฒ7756". The plate lives on the booking. */
function vehicleName(label: string | null) {
  return label ? label.split(" · ")[0] : null;
}

/** Rent periods are saved as English text ("October 2026", "3 days", "Whole rental"). */
function periodText(period: string, tx: Tx) {
  const month = period.match(/^([A-Za-z]+) (\d{4})$/);
  if (month) {
    const parsed = Date.parse(`1 ${month[1]} ${month[2]} UTC`);
    if (!Number.isNaN(parsed)) {
      try {
        return dateFormat(tx.locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(parsed));
      } catch {
        return period;
      }
    }
  }
  const days = period.match(/^(\d+) days?$/);
  if (days) return tx.say("periodDays", { count: Number(days[1]) });
  if (period === "Whole rental") return tx.say("periodWhole");
  return period;
}

/** "Collect rent · October 2026" for the list; "Rent · October 2026" where it is one line among several. */
function payText(item: TaskListItem, form: "collect" | "pay", tx: Tx) {
  const pay = item.pay;
  if (!pay) return (form === "pay" ? item.paymentLabel : null) || item.title;
  if (pay.kind === "charge") {
    // "#fuel,#damage" are the return form's reasons, named here; anything else is the owner's own words.
    const what = (pay.period || "").startsWith("#") ? pay.period!.split(",").map((reason) => tx.say(`chgr_${reason.slice(1)}`)).join(", ") : pay.period;
    return what ? `${tx.say(`${form}_charge`)} · ${what}` : tx.say(`${form}_charge`);
  }
  if (pay.kind !== "rent") return tx.say(`${form}_${pay.kind}`);
  return pay.period ? tx.say(`${form}_rent_period`, { period: periodText(pay.period, tx) }) : tx.say(`${form}_rent`);
}

/** A date written in English inside a saved job title ("18 Nov 2026" or "2026-11-10"). */
function savedDate(text: string, today: string, tx: Tx) {
  const parsed = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00Z` : `${text} UTC`);
  if (Number.isNaN(parsed)) return text;
  return plainDate(new Date(parsed).toISOString().slice(0, 10), today, tx.locale);
}

/**
 * A job's heading in a few words, with the rest as a second line. Jobs are
 * saved with one long title ("Refund to decide - returned 15 days before the
 * paid time ran out (pro rata ฿4,750)"); the list reads better as a short
 * heading and a detail. The customer and vehicle are already on their own line.
 */
function headingOf(item: TaskListItem, today: string, tx: Tx): { title: string; detail: string | null } {
  const raw = String(item.title || "");
  if (item.kind === "payment") return { title: payText(item, "collect", tx), detail: null };
  // A request nobody has made a job for: named by its kind.
  if (item.request != null) return { title: tx.say(tx.has(`request_${item.request}`) ? `request_${item.request}` : "request_other"), detail: null };
  // An extension the customer asked for that couldn't be applied: saved as one long English sentence
  // ("Extension to 2026-11-10 needs your answer - Name - Vehicle (another booking … is in the way)").
  const extensionAsk = raw.match(/^Extension to (.+?) needs your answer/);
  if (extensionAsk) {
    const why = raw.match(/\(([^()]*in the way[^()]*)\)\s*$/);
    return { title: tx.say("job_extension", { date: savedDate(extensionAsk[1], today, tx) }), detail: why && tx.locale === "en" ? why[1].charAt(0).toUpperCase() + why[1].slice(1) : null };
  }
  if (/^Request to switch to monthly/.test(raw)) return { title: tx.say("job_openEnded"), detail: null };
  // Jobs people typed themselves stay exactly as typed.
  if (!item.action) return { title: raw, detail: null };
  // Jobs the app raised are saved as English sentences; the ones it knows are said again in the reader's language.
  // The customer and vehicle in the saved title are already on the context line.
  if (item.action === "settle_deposit") return { title: tx.say("job_settle_deposit"), detail: null };
  // A booking whose day has come and the vehicle hasn't gone out. Nothing is owed yet: what's due is taken at the handover.
  if (item.action === "handover") {
    return { title: tx.say("job_handover"), detail: item.amount ? tx.say("job_handover_collect", { amount: money(item.amount) }) : null };
  }
  if (item.action === "owed_early") {
    const early = raw.match(/returned (\d+) days? early \((.+?) of (.+?) owed/);
    return early ? { title: tx.say("job_owed_early", { amount: early[2] }), detail: tx.say("job_owed_early_detail", { days: Number(early[1]), owed: early[3] }) } : { title: tx.say("job_owed_early", { amount: "" }), detail: null };
  }
  if (item.action === "waive_early") {
    const asked = raw.match(/asked - (\d+) days? \((.+?)\)/);
    return { title: tx.say("job_waive_early"), detail: asked ? tx.say("job_waive_early_detail", { days: Number(asked[1]), amount: asked[2] }) : null };
  }
  if (item.action === "swap_handover" || item.action === "swap_collection" || item.action === "swap_signature") {
    return { title: tx.say(`job_${item.action}`), detail: null };
  }
  const [first, ...rest] = raw.split(" - ");
  const detail = rest.join(" - ").trim();
  if (item.action === "refund") {
    const early = detail.match(/^returned (\d+) days? before the paid time ran out \(pro rata (.+)\)$/);
    const cancelled = detail.match(/^(.+) cancelled the (.+) \((.+) paid\)$/);
    // The amount leads the heading; the reason is the one line under it.
    if (early) return { title: tx.say("refundTitle", { amount: early[2] }), detail: tx.say("refundEarlyShort", { days: Number(early[1]) }) };
    if (cancelled) return { title: tx.say("refundTitle", { amount: cancelled[3] }), detail: tx.say("refundCancelledShort", { name: cancelled[1] }) };
    return { title: tx.say("job_refund"), detail: detail ? detail.charAt(0).toUpperCase() + detail.slice(1) : null };
  }
  if (item.action === "request") {
    const extension = first.match(/^Extension to (.+) needs your answer$/);
    if (extension) return { title: tx.say("job_extension", { date: savedDate(extension[1], today, tx) }), detail: null };
    if (/no end date/.test(first)) return { title: tx.say("job_openEnded"), detail: null };
    // What the customer sent from their booking page (lib/portal-notifications.ts).
    if (/^URGENT customer problem$/i.test(first)) return { title: tx.say("job_problem"), detail: null };
    if (/^Customer question$/i.test(first)) return { title: tx.say("request_question"), detail: null };
    if (/^Confirmed return$/i.test(first)) return { title: tx.say("job_returnArranged"), detail: null };
    return { title: tx.locale === "en" ? first : tx.say("request_other"), detail: null };
  }
  // What follows the heading is the customer and vehicle again, and the working-out belongs on the booking.
  return { title: first, detail: null };
}

function timeLabel(dueAt: string | null) {
  if (!dueAt) return null;
  const when = new Date(dueAt);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(when);
  // Tasks created with a date only are stored at midnight (local or UTC, which reads as "07:00" here); neither is a real time.
  if (time === "00:00" || (when.getUTCHours() === 0 && when.getUTCMinutes() === 0)) return null;
  return time;
}

type Group = { key: string; tone: "red" | "amber" | "neutral" | "teal"; items: TaskListItem[] };

function groupOpen(items: TaskListItem[], today: string): Group[] {
  const weekEnd = addDays(today, 7);
  const groups: Group[] = [
    { key: "receipts", tone: "teal", items: [] },
    { key: "overdue", tone: "red", items: [] },
    { key: "today", tone: "amber", items: [] },
    { key: "week", tone: "neutral", items: [] },
    { key: "later", tone: "neutral", items: [] }
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

const METHODS = ["cash", "bank_transfer", "promptpay", "wise", "revolut", "other"] as const;

function methodLabel(method: string, tx: Tx) {
  return tx.say(`method_${(METHODS as readonly string[]).includes(method) ? method : "other"}`);
}

/**
 * Recording money received, with or without a receipt from the customer. Covers
 * the cases that aren't "the exact amount for one payment": short, too much, or
 * one transfer for several payments. Staff say what arrived and what it is for,
 * and see where every baht goes before confirming.
 */
function ReceivePaymentPanel({ item, siblings, today, onClose }: { item: TaskListItem; siblings: TaskListItem[]; today: string; onClose: () => void }) {
  const tx = useTx();
  const receipt = item.receipt;
  const openPayments: OpenPayment[] = [item, ...siblings]
    .filter((entry) => entry.rentalPaymentId)
    .map((entry) => ({ id: entry.rentalPaymentId as string, label: payText(entry, "pay", tx), amount: entry.amount || 0, dueDate: entry.dueDate || "9999-12-31" }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const [value, setValue] = useState(String(receipt?.total || item.bundle?.total || item.amount || ""));
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState(receipt?.method || "cash");
  const [chosenIds, setChosenIds] = useState<string[]>(receipt?.paymentIds?.length ? receipt.paymentIds : item.bundle?.ids.length ? item.bundle.ids : [item.rentalPaymentId as string]);
  const [error, setError] = useState<string | null>(null);
  const [tellCustomer, setTellCustomer] = useState(true);
  const [isPending, startTransition] = useTransition();
  // Saved: stays on "Saving…" until the refreshed list drops this job (the panel goes with it), so it never
  // closes onto the job still listed as unpaid. Closes anyway after a few seconds.
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (!sent) return;
    const fallback = window.setTimeout(onClose, 8000);
    return () => window.clearTimeout(fallback);
  }, [sent, onClose]);
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
      setError(tx.say("errEnterAmount"));
      return;
    }
    startTransition(async () => {
      try {
        await confirmReceiptPayment({ paymentId: item.rentalPaymentId as string, amount: received, date, method, paymentIds: chosenIds, tellCustomer });
        setSent(true);
      } catch {
        setError(tx.say("errRecord"));
      }
    });
  }

  function decline() {
    setError(null);
    startTransition(async () => {
      try {
        await declinePaymentReceipt(item.rentalPaymentId as string);
        onClose();
      } catch {
        setError(tx.say("errUpdate"));
      }
    });
  }

  // Fields take the app's standard 44px height; no one-off sizes here.
  const field = "mt-1 w-full";
  return (
    <div className="mt-2 rounded-2xl bg-[var(--panel-secondary)] p-3.5">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-semibold text-[var(--foreground-secondary)]">
          {tx.say("amountArrived")}
          {/* ฿ as a prefix, as in the app's other money fields; decimals stay allowed here (satang). */}
          <span className="relative mt-1 block">
            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm font-medium text-[var(--foreground-secondary)]">฿</span>
            <input autoFocus className="input-with-leading-symbol w-full" inputMode="decimal" min="0" onChange={(event) => setValue(event.target.value)} step="0.01" type="number" value={value} />
          </span>
        </label>
        <label className="text-xs font-semibold text-[var(--foreground-secondary)]">
          {tx.say("dateReceived")}
          <input className={field} max={today} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </label>
        <label className="text-xs font-semibold text-[var(--foreground-secondary)]">
          {tx.say("method")}
          <select className={field} onChange={(event) => setMethod(event.target.value)} value={method}>
            {METHODS.map((key) => (
              <option key={key} value={key}>{tx.say(`method_${key}`)}</option>
            ))}
          </select>
        </label>
      </div>

      {offered.length > 1 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-[var(--foreground-secondary)]">{tx.say("whatFor")}</p>
          <div className="mt-1 space-y-1">
            {offered.map((payment) => (
              <label className="flex min-h-9 items-center gap-2 rounded-lg bg-white px-3 text-sm" key={payment.id}>
                <input checked={chosenIds.includes(payment.id)} disabled={payment.id === item.rentalPaymentId} onChange={() => toggle(payment.id)} type="checkbox" />
                <span className="min-w-0 flex-1 truncate">{payment.label}</span>
                <span className="text-xs text-[var(--muted)]">{dayLabel(payment.dueDate === "9999-12-31" ? null : payment.dueDate, today, tx)}</span>
                <span className="font-semibold">{money(payment.amount)}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {lines.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-white p-3">
          <p className="text-xs font-semibold text-[var(--foreground-secondary)]">{tx.say("whatRecorded")}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {lines.map((line) => (
              <li className="flex flex-wrap items-baseline justify-between gap-x-3" key={line.id}>
                <span className="font-semibold text-[var(--foreground)]">
                  {line.carried ? tx.say("extraGoesTo", { label: line.label }) : line.label}
                </span>
                <span className={line.stillDue > 0 || line.extra > 0 ? "font-semibold text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}>
                  {line.paid <= 0
                    ? tx.say("nothingLeft")
                    : line.extra > 0
                      ? tx.say("recordedExtra", { paid: money(line.paid), extra: money(line.extra) })
                      : line.stillDue > 0
                        ? tx.say("paidStays", { paid: money(line.paid), due: money(line.stillDue) })
                        : tx.say("paidFull", { paid: money(line.paid) })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
      {/* No surprises: recording it here tells the customer too. */}
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-[var(--foreground-secondary)]">
        <input checked={tellCustomer} className="mt-0.5 flex-shrink-0" onChange={(event) => setTellCustomer(event.target.checked)} type="checkbox" />
        <span>{tx.say("tellCustomer")}</span>
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="primary-action stay-primary pressable min-h-10 whitespace-nowrap px-4 text-[14px]" disabled={isPending || sent} onClick={save} type="button">
          {isPending || sent ? tx.say("saving") : received > 0 ? tx.say("recordAmount", { amount: money(received) }) : tx.say("recordPayment")}
        </button>
        <button className="secondary-action pressable min-h-10 whitespace-nowrap px-4 text-[14px]" disabled={isPending} onClick={onClose} type="button">
          {tx.say("cancel")}
        </button>
        {receipt ? (
          <button className="pressable ml-auto min-h-9 px-2 text-xs font-semibold text-[var(--danger)]" disabled={isPending} onClick={decline} type="button">
            {tx.say("nothingArrived")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function TaskRow({ item, organizationId, today, siblings = [], canDecide = true }: { item: TaskListItem; organizationId: string; today: string; siblings?: TaskListItem[]; canDecide?: boolean }) {
  const tx = useTx();
  const [showNote, setShowNote] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [recording, setRecording] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [isConfirming, startConfirm] = useTransition();
  const receipt = item.kind === "payment" ? item.receipt : null;
  // Refunds and free days are the owner's or a manager's call; a teammate sees the job and who decides it.
  const moneyJob = item.kind === "task" && (item.action === "refund" || item.action === "waive_early" || item.action === "owed_early");
  const waitsForDecider = moneyJob && !canDecide && !item.completedAt;
  const [waiverError, setWaiverError] = useState<string | null>(null);
  const [deciding, startDeciding] = useTransition();
  function decideWaiver(decision: "waive" | "keep") {
    if (!item.rentalId) return;
    setWaiverError(null);
    startDeciding(async () => {
      const result = await decideEarlyWaiver(item.rentalId as string, decision);
      if (!result.ok) setWaiverError(result.error || tx.say("errConfirm"));
    });
  }

  // Back early with rent still owed: the owner takes the unused days off or keeps the booking, right here.
  const owedAmount = item.action === "owed_early" ? String(item.title || "").match(/returned \d+ days? early \((.+?) of/)?.[1] || "" : "";
  function decideOwed(decision: "take_off" | "keep") {
    if (!item.rentalId) return;
    setWaiverError(null);
    startDeciding(async () => {
      const result = await decideEarlyReturnOwed(item.rentalId as string, decision);
      if (!result.ok) setWaiverError(result.error || tx.say("errConfirm"));
    });
  }

  function confirmReceipt() {
    if (!item.rentalPaymentId || !receipt) return;
    setReceiptError(null);
    startConfirm(async () => {
      try {
        await confirmReceiptPayment({ paymentId: item.rentalPaymentId as string, amount: receipt.total, date: today, method: receipt.method, paymentIds: receipt.paymentIds });
      } catch {
        setReceiptError(tx.say("errConfirm"));
      }
    });
  }

  const coversSeveral = !!receipt && receipt.paymentIds.length > 1;
  // Older extension requests were saved without an action; they still need answering on the booking, not ticking off.
  const asksAnswer = item.kind === "task" && !item.action && !!item.rentalId && /needs your answer/.test(String(item.title || ""));
  const overdue = !item.completedAt && !!item.dueDate && item.dueDate < today;
  // A time of day only for jobs someone gave a time to; jobs the app raises carry the moment they were raised, which means nothing.
  const time = item.kind === "task" && !item.action ? timeLabel(item.dueAt) : null;
  // The booking number and the plate are on the booking; here the customer and the vehicle say which one it is.
  const context = [item.customerName, vehicleName(item.vehicleLabel)].filter(Boolean).join(" · ") || item.rentalLabel || "";
  const heading = headingOf(item, today, tx);
  const title = coversSeveral ? tx.say("receiptForSeveral", { count: receipt.paymentIds.length }) : item.kind === "payment" ? payTitle(item, tx) : heading.title;
  const when = whenShort(item, today, overdue, tx);
  const line = heading.detail && !receipt ? [heading.detail, context].filter(Boolean).join(" · ") : context;

  return (
    // While a payment is being recorded the card stacks on computers too: the form takes the full width
    // under the heading instead of sharing the row with the icon and running over it.
    <div className={`card flex flex-col gap-3.5 p-4 ${recording ? "" : "lg:flex-row lg:items-center lg:gap-6"}`}>
      <div className="flex items-center gap-3.5 lg:min-w-0 lg:flex-1">
        <KindChip kind={jobKind(item)} />
        <div className="min-w-0 flex-1">
          <p className="text-[19px] font-bold leading-tight text-[var(--foreground)]">{title}</p>
          {/* When it is due leads the line under the title ("4 days late · Playwright Tester · Honda City"), so it sits with the job it belongs to. */}
          {when || line ? (
            <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">
              {when ? (
                <span className={`whitespace-nowrap font-bold ${overdue ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
                  {when}
                  {time && !item.completedAt && item.dueDate ? ` · ${time}` : ""}
                </span>
              ) : null}
              {when && line ? <span aria-hidden="true"> · </span> : null}
              {line ? (
                item.rentalId || item.vehicleId ? (
                  <Link className="hover:underline" href={item.rentalId ? `/bookings/${item.rentalId}` : `/fleet/${item.vehicleId}`}>
                    {line}
                  </Link>
                ) : (
                  <span>{line}</span>
                )
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      <div className="min-w-0 empty:hidden">
          {coversSeveral ? (
            <p className="mt-0.5 text-sm text-[var(--foreground-secondary)]">
              {[item, ...siblings].filter((entry) => receipt.paymentIds.includes(entry.rentalPaymentId || "")).map((entry) => `${payText(entry, "pay", tx)} ${money(entry.amount || 0)}`).join(" + ")}
            </p>
          ) : null}
          {receipt ? (
            <p className="mt-1 text-sm font-semibold text-[var(--primary)]">
              {tx.say("receiptSent", { method: methodLabel(receipt.method, tx), day: dayLabel(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(receipt.submittedAt)), today, tx) })}
            </p>
          ) : null}
          {receipt?.slip?.amount ? (
            // What the slip itself says, read when the customer sent it: a match is one less thing to check.
            Math.abs(receipt.slip.amount - receipt.total) <= 1 ? (
              <p className="mt-0.5 text-sm font-semibold text-[var(--success)]">{tx.say("slipMatches", { amount: money(receipt.slip.amount) })}</p>
            ) : (
              <p className="mt-0.5 text-sm font-semibold text-[var(--warning)]">{tx.say("slipDiffers", { amount: money(receipt.slip.amount), total: money(receipt.total) })}</p>
            )
          ) : null}
          {receiptError ? <p className="mt-1 text-[14px] font-semibold text-[var(--danger)]">{receiptError}</p> : null}
          {waitsForDecider ? <p className="mt-1 font-semibold text-[var(--foreground-secondary)]">{tx.say("decidedByOwner")}</p> : null}
          {waiverError ? <p className="mt-1 font-semibold text-[var(--danger)]">{waiverError}</p> : null}
          {recording && item.rentalPaymentId ? (
            <ReceivePaymentPanel item={item} onClose={() => setRecording(false)} siblings={siblings} today={today} />
          ) : null}
          {showNote && !item.completedAt ? (
            <form action={completeTask} className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input name="organizationId" type="hidden" value={organizationId} />
              <input name="taskId" type="hidden" value={item.id} />
              <input
                aria-label={tx.say("noteLabel")}
                autoFocus
                className="flex-1"
                name="notes"
                placeholder={tx.say("notePlaceholder")}
              />
              <PendingButton className="primary-action min-h-11 px-4 text-sm" pendingLabel={tx.say("saving")} type="submit">
                {tx.say("saveDone")}
              </PendingButton>
            </form>
          ) : null}
      </div>

      {/* Buttons share the full card width. Three (a receipt to check) don't fit a phone: confirming takes its own row there. */}
      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap [&_a]:whitespace-nowrap [&_button]:whitespace-nowrap [&>*]:min-w-0 [&>*]:flex-1 [&>a]:justify-center [&>button]:justify-center [&_button]:w-full [&_form]:min-w-0 [&_form]:flex-1 lg:min-w-[19rem] lg:shrink-0 lg:justify-end lg:[&>*]:flex-none lg:[&_button]:w-auto">
        {receipt?.url ? (
          <a className="secondary-action pressable min-h-9 px-3 text-[14px]" href={receipt.url} rel="noreferrer" target="_blank">
            {tx.say("viewReceipt")}
          </a>
        ) : null}
        {receipt && !recording ? (
          <>
            <button className={`primary-action pressable min-h-9 px-3 text-xs ${receipt?.url ? "order-first basis-full! sm:order-none sm:basis-0!" : ""}`} disabled={isConfirming} onClick={confirmReceipt} type="button">
              {isConfirming ? tx.say("saving") : tx.say("confirmReceived")}
            </button>
            <button className="secondary-action pressable min-h-9 px-3 text-xs" disabled={isConfirming} onClick={() => setRecording(true)} type="button">
              {tx.say("somethingDifferent")}
            </button>
          </>
        ) : item.kind === "payment" && item.rentalPaymentId && !recording ? (
          <button className="primary-action pressable min-h-9 px-3 text-xs" onClick={() => setRecording(true)} type="button">
            {tx.say("recordPayment")}
          </button>
        ) : null}
        {/* A job with a next step of its own goes straight to it; doing that step closes the job. */}
        {item.kind === "task" && !item.completedAt && item.rentalId && item.action === "waive_early" && canDecide ? (
          <>
            <button className="primary-action pressable min-h-9 px-3 text-xs" disabled={deciding} onClick={() => decideWaiver("waive")} type="button">
              {tx.say("waiveEarly")}
            </button>
            <button className="secondary-action pressable min-h-9 px-3 text-xs" disabled={deciding} onClick={() => decideWaiver("keep")} type="button">
              {tx.say("keepCharge")}
            </button>
          </>
        ) : null}
        {item.kind === "task" && !item.completedAt && item.rentalId && item.action === "owed_early" && canDecide ? (
          <>
            <button className="primary-action pressable min-h-9 px-3 text-xs" disabled={deciding} onClick={() => decideOwed("take_off")} type="button">
              {owedAmount ? tx.say("owedTakeOff", { amount: owedAmount }) : tx.say("owedKeep")}
            </button>
            <button className="secondary-action pressable min-h-9 px-3 text-xs" disabled={deciding} onClick={() => decideOwed("keep")} type="button">
              {tx.say("owedKeep")}
            </button>
          </>
        ) : null}
        {item.kind === "task" && !item.completedAt && item.rentalId && (item.action === "refund" || item.action === "request" || item.action === "settle_deposit" || asksAnswer) && !waitsForDecider ? (
          <Link className="primary-action pressable min-h-9 px-3 text-xs" href={`/bookings/${item.rentalId}#${item.action === "request" || asksAnswer ? "customer-requests" : "refunds"}`}>
            {item.action === "refund" ? tx.say("recordRefund") : item.action === "settle_deposit" ? tx.say("settleDeposit") : tx.say("answer")}
          </Link>
        ) : null}
        {item.kind === "task" && !item.completedAt && item.rentalId && item.action === "handover" ? (
          <>
            <Link className="primary-action pressable min-h-9 px-3 text-xs" href={`/inspections/delivery/${item.rentalId}`}>
              {tx.say("handOver")}
            </Link>
            <Link className="secondary-action pressable min-h-9 px-3 text-xs" href={`/bookings/${item.rentalId}`}>
              {tx.say("openBooking")}
            </Link>
          </>
        ) : null}
        {item.kind === "task" && !item.completedAt && item.rentalId && item.action === "swap_signature" ? (
          <Link className="primary-action pressable min-h-9 px-3 text-xs" href={`/bookings/${item.rentalId}#amendment`}>
            {tx.say("sendForm")}
          </Link>
        ) : null}
        {item.kind === "task" && !item.completedAt && item.rentalId && (item.action === "swap_handover" || item.action === "swap_collection") ? (
          <Link
            className="primary-action pressable min-h-9 px-3 text-xs"
            href={item.action === "swap_handover" ? `/inspections/delivery/${item.rentalId}?swap=1` : `/inspections/return/${item.rentalId}?swap=1&vehicle=${item.vehicleId}`}
          >
            {tx.say("openForm")}
          </Link>
        ) : null}
        {item.kind === "task" && !item.completedAt && !showNote && !item.id.startsWith("request-") && !item.id.startsWith("handover-") && !waitsForDecider && !((item.action === "waive_early" || item.action === "owed_early") && canDecide) ? (
          <>
            {/* One main button per row. A job with its own next step keeps "mark done" and notes behind the dots. */}
            {(!item.action && !asksAnswer) || item.action === "refund" || showMore ? (
              <form action={completeTask}>
                <input name="organizationId" type="hidden" value={organizationId} />
                <input name="taskId" type="hidden" value={item.id} />
                <PendingButton className={`${item.action || asksAnswer ? "secondary-action" : "primary-action"} min-h-9 px-3 text-xs`} pendingLabel={tx.say("saving")} type="submit">
                  {item.action === "refund" ? tx.say("noRefund") : tx.say("markDone")}
                </PendingButton>
              </form>
            ) : null}
            {showMore ? (
              <button className="secondary-action pressable min-h-9 px-3 text-xs" onClick={() => setShowNote(true)} type="button">
                {tx.say("addNote")}
              </button>
            ) : (
              <button aria-label={tx.say("moreOptions")} className="pressable flex !w-12 !flex-none items-center justify-center rounded-full bg-[var(--panel-secondary)] text-[var(--foreground)]" onClick={() => setShowMore(true)} style={{ minHeight: 44 }} type="button">
                <MoreHorizontal size={20} />
              </button>
            )}
          </>
        ) : null}
        {!context && item.rentalId ? (
          <Link className="secondary-action pressable min-h-9 px-3 text-xs" href={`/bookings/${item.rentalId}`}>
            {tx.say("booking")}
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
  laterLimit = 5,
  canDecide = true
}: {
  tasks: TaskListItem[];
  organizationId: string;
  today: string;
  laterLimit?: number;
  /** Owner or manager: can decide refunds and free days. */
  canDecide?: boolean;
}) {
  const tx = useTx();
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


  return (
    <div className="space-y-4">
      {/* The same segmented control as the dashboard's Day / Week / Month: a tinted track, the chosen one white. */}
      <div className="inline-flex rounded-full bg-[var(--panel-tertiary)] p-1" role="tablist">
        {([
          ["open", tx.say("tabOpenShort")],
          ["done", tx.say("tabDone")]
        ] as const).map(([value, label]) => (
          <button
            aria-selected={filter === value}
            className={`pressable min-h-9 whitespace-nowrap rounded-full px-4 text-[14px] font-bold ${filter === value ? "bg-white text-[var(--foreground)] shadow-[0_1px_3px_rgba(19,38,43,0.12)]" : "text-[var(--foreground-secondary)]"}`}
            key={value}
            onClick={() => setFilter(value)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {filter === "open" ? (
        groups.length === 0 ? (
          <EmptyState description={tx.say("emptyBody")} title={tx.say("emptyTitle")} />
        ) : (
          groups.map((group) => {
            const limited = group.key === "later" && !showAllLater && group.items.length > laterLimit;
            const items = limited ? group.items.slice(0, laterLimit) : group.items;
            return (
              <section className={`space-y-2.5 ${group.key === "week" || group.key === "later" ? "calm-actions" : ""}`} key={group.key}>
                <div className="flex items-center gap-2.5 px-1 pt-1">
                  <h2 className="card-title">{tx.say(`group_${group.key}`)}</h2>
                  {/* One count pill in two tones: red tint for late work, neutral tint for the rest. */}
                  <span className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-[14px] font-bold tabular-nums ${group.tone === "red" ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--panel-tertiary)] text-[var(--foreground-secondary)]"}`}>{group.items.length}</span>
                </div>
                {items.map((item) => (
                  <TaskRow canDecide={canDecide} item={item} key={item.id} organizationId={organizationId} siblings={item.kind === "payment" ? siblingsOf(item) : []} today={today} />
                ))}
                {limited ? (
                  <button className="pressable w-full rounded-full bg-white px-4 py-3 font-bold text-[var(--primary)]" onClick={() => setShowAllLater(true)} type="button">
                    {tx.say("showMore", { count: group.items.length - laterLimit })}
                  </button>
                ) : null}
              </section>
            );
          })
        )
      ) : done.length === 0 ? (
        <EmptyState title={tx.say("noFinished")} />
      ) : (
        <section className="space-y-2.5">
          {done.slice(0, 50).map((item) => (
            <TaskRow item={item} key={item.id} organizationId={organizationId} today={today} />
          ))}
        </section>
      )}
    </div>
  );
}

/**
 * A vehicle's open jobs, worded as on To do. A job the app raised (a refund, rent to decide, a form) opens on To do,
 * where its own buttons are; a job someone typed can be marked done here.
 */
export function VehicleJobs({ items, today, organizationId, vehicleId }: { items: TaskListItem[]; today: string; organizationId: string; vehicleId: string }) {
  const tx = useTx();
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const heading = headingOf(item, today, tx);
        const overdue = !!item.dueDate && item.dueDate < today;
        const when = whenShort(item, today, overdue, tx);
        return (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5" key={item.id}>
            <div className="min-w-0">
              <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{heading.title}</p>
              {heading.detail ? <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{heading.detail}</p> : null}
              {when ? <p className={`mt-0.5 font-semibold ${overdue ? "text-[var(--danger)]" : "text-[var(--foreground-secondary)]"}`}>{when}</p> : null}
            </div>
            {item.action ? (
              <Link className="secondary-action pressable shrink-0 whitespace-nowrap px-4" href="/tasks">
                {tx.say("openJob")}
              </Link>
            ) : (
              <form action={completeTask} className="shrink-0">
                <input name="organizationId" type="hidden" value={organizationId} />
                <input name="taskId" type="hidden" value={item.id} />
                <input name="vehicleId" type="hidden" value={vehicleId} />
                <PendingButton className="secondary-action whitespace-nowrap" pendingLabel={tx.say("saving")} type="submit">
                  {tx.say("markDone")}
                </PendingButton>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
