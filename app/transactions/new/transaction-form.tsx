"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Camera, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { shortDate } from "@/lib/i18n/dates";
import { createTransaction, findTransactionMatches } from "@/app/actions/transactions";
import { PendingButton } from "@/components/pending-button";
import { Card } from "@/components/ui";
import { TRANSACTION_TYPE_OPTIONS } from "@/lib/transaction-options";
import type { MatchResult } from "@/lib/transaction-matching";
import type { TransactionFormOptions, TransactionFormPrefill } from "@/lib/transactions";

const MONEY_IN: string[] = ["rental_income", "charge_recovered", "deposit_received", "deposit_forfeited", "deposit_deduction"];
// Costs a renter can be responsible for. Insurance, tax and finance are the owner's own.
const BILLABLE: string[] = ["repair", "maintenance", "servicing", "fine", "fuel", "accessories", "other"];

/** Letters and digits only, so "กข-1234" on a receipt finds "กข 1234" in the fleet. */
const plateKey = (value: string | null | undefined) => String(value || "").toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");

type ReadReceipt = { isReceipt: boolean; amount: number | null; date: string | null; paidTo: string | null; costType: string | null; plate: string | null; odometer: number | null; reference: string | null; summary: string | null; confidence: number; savedBefore?: string | null };

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-[15px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus-ring)]";

export function TransactionForm({
  organizationId,
  options,
  defaultVehicleId = "",
  defaultRentalId = "",
  defaultCustomerId = "",
  prefill = null,
  waiting = [],
  startAsCost = false,
  startAsFine = false
}: {
  organizationId: string;
  options: TransactionFormOptions;
  defaultVehicleId?: string;
  defaultRentalId?: string;
  defaultCustomerId?: string;
  prefill?: TransactionFormPrefill | null;
  /** Payments the business is waiting for, shown first so the usual case is one tap. */
  waiting?: MatchResult[];
  /** Opened from a booking's "Add a cost": money out, charged to that booking. */
  startAsCost?: boolean;
  /** A fine: dated the day of the offence, billed to whoever had the vehicle then. */
  startAsFine?: boolean;
}) {
  const t = useTranslations("money");
  const say = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  const locale = useLocale();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  // A scheduled payment is named here, in the reader's language; anything else keeps the name it came with.
  const matchLabel = (match: MatchResult) =>
    match.kind ? say(`match_${match.kind}`, { amount: `฿${Math.round(match.amount || 0).toLocaleString("en-US")}`, vehicle: match.vehicleName || match.vehicleLabel || "" }) : match.label;
  const matchWhen = (match: MatchResult) =>
    !match.kind
      ? match.subLabel
      : !match.dueDate
        ? ""
        : match.dueDate === today
          ? say("dueToday")
          : say(match.dueDate < today ? "wasDueOn" : "dueOn", { date: shortDate(match.dueDate, locale) });
  const [type, setType] = useState(prefill?.type || (startAsCost ? "repair" : startAsFine ? "fine" : "rental_income"));
  const [amount, setAmount] = useState(prefill?.amount || "");
  // Today in business time: toISOString() is UTC, which is still "yesterday" in Thailand before 7am.
  const [transactionDate, setTransactionDate] = useState(
    prefill?.transactionDate || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date())
  );
  const [notes, setNotes] = useState(prefill?.notes || "");
  // No vehicle is preselected: a money entry silently booked against the first car in the list is worse than a required field.
  // One vehicle in the business: it is the one.
  const [vehicleId, setVehicleId] = useState(prefill?.vehicleId || defaultVehicleId || (options.vehicles.length === 1 ? options.vehicles[0].id : ""));
  const [rentalId, setRentalId] = useState(prefill?.rentalId || defaultRentalId);
  const [customerId, setCustomerId] = useState(prefill?.customerId || defaultCustomerId);
  const [linkedRentalPaymentId, setLinkedRentalPaymentId] = useState(prefill?.rentalPaymentId || "");
  const [linkedTaskId, setLinkedTaskId] = useState(prefill?.taskId || "");
  const startsLinked = Boolean(prefill?.rentalPaymentId || prefill?.taskId);
  // Opened from a vehicle, booking or customer: only that one's payments are offered.
  const waitingHere = useMemo(
    () => waiting.filter((item) => (!defaultVehicleId || item.prefilledData.vehicleId === defaultVehicleId) && (!defaultRentalId || item.rentalId === defaultRentalId) && (!defaultCustomerId || item.customerId === defaultCustomerId)),
    [waiting, defaultVehicleId, defaultRentalId, defaultCustomerId]
  );
  const [matches, setMatches] = useState<MatchResult[]>(startsLinked || startAsCost || startAsFine ? [] : waitingHere);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [dismissedMatches, setDismissedMatches] = useState(false);
  // Which waiting payment is picked; the first one until someone chooses.
  const [pickedMatchId, setPickedMatchId] = useState("");
  // While there are payments being waited for, they are the whole screen; the form opens when one is chosen or it is something else.
  const [formOpen, setFormOpen] = useState(startsLinked || startAsCost || startAsFine || waitingHere.length === 0);
  const [isMatching, startMatchTransition] = useTransition();

  // A booking is told apart by its dates as much as by its number.
  const bookingOption = (rental: TransactionFormOptions["rentals"][number]) =>
    rental.startDate ? `${rental.label} · ${shortDate(rental.startDate, locale)}–${rental.endDate ? shortDate(rental.endDate, locale) : "…"}` : rental.label;
  const rentalsForVehicle = useMemo(
    () => options.rentals.filter((rental) => rental.vehicleId === vehicleId),
    [options.rentals, vehicleId]
  );
  // Billing the renter for this cost: off unless chosen. The booking offered first is the one the vehicle was on that day.
  const [billCustomer, setBillCustomer] = useState((startAsCost && Boolean(defaultRentalId)) || startAsFine);
  // Picked by hand: the date no longer moves it.
  const [billPicked, setBillPicked] = useState(false);
  const [billRentalId, setBillRentalId] = useState(startAsCost ? defaultRentalId : "");
  // Above what the deposit covers: billed unless the owner unticks it (insurance pays above the excess, say).
  const [billRemainder, setBillRemainder] = useState(true);
  const [billAmountTyped, setBillAmount] = useState("");
  // The whole cost, until the owner types a different amount to charge.
  const billAmount = billAmountTyped || amount;
  const likelyBooking = useMemo(() => {
    const onTheDay = rentalsForVehicle.find((rental) => (rental.startDate || "") <= transactionDate && (!rental.endDate || rental.endDate >= transactionDate));
    return onTheDay || rentalsForVehicle[0] || null;
  }, [rentalsForVehicle, transactionDate]);
  // Changing the date of the offence moves the bill to whoever had the vehicle that day.
  useEffect(() => {
    if (billCustomer && !billPicked && likelyBooking && (startAsFine || !billRentalId)) setBillRentalId(likelyBooking.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [likelyBooking, billCustomer]);

  useEffect(() => {
    // Only money coming in can be a payment a customer owes.
    if (!type || !MONEY_IN.includes(type) || linkedRentalPaymentId || linkedTaskId || dismissedMatches) {
      setMatches([]);
      return;
    }
    // Nothing typed yet: offer everything that is being waited for.
    if (!amount && (!vehicleId || vehicleId === defaultVehicleId) && type === "rental_income") {
      setMatches(waitingHere);
      return;
    }

    const timer = window.setTimeout(() => {
      const formData = new FormData();
      formData.set("organizationId", organizationId);
      formData.set("type", type);
      formData.set("amount", amount);
      formData.set("vehicleId", vehicleId);
      formData.set("transactionDate", transactionDate);

      startMatchTransition(async () => {
        try {
          const result = await findTransactionMatches(formData);
          setMatches(result);
        } catch {
          setMatches([]);
        }
      });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [amount, defaultVehicleId, dismissedMatches, linkedRentalPaymentId, linkedTaskId, organizationId, transactionDate, type, vehicleId, waitingHere]);

  function handleRentalChange(nextRentalId: string) {
    setRentalId(nextRentalId);
    const rental = options.rentals.find((entry) => entry.id === nextRentalId);
    if (rental?.customerId) {
      setCustomerId(rental.customerId);
    }
  }

  function acceptMatch(match: MatchResult) {
    setAmount(String(match.prefilledData.amount || ""));
    if (match.prefilledData.vehicleId) {
      setVehicleId(match.prefilledData.vehicleId);
    }
    setNotes(match.prefilledData.description);
    if (!transactionDate) {
      setTransactionDate(match.prefilledData.date);
    }
    if (match.rentalId) {
      setRentalId(match.rentalId);
    }
    if (match.customerId) {
      setCustomerId(match.customerId);
    }
    if (match.suggestedType) setType(match.suggestedType);
    setLinkedRentalPaymentId(match.rentalPaymentId || "");
    setLinkedTaskId(match.taskId || "");
    setMatches([]);
    setFormOpen(true);
  }

  // A receipt photo fills the cost in: amount, date, who was paid, what for, and the vehicle when its plate is printed.
  const [supplier, setSupplier] = useState("");
  const [mileage, setMileage] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState("");
  const [read, setRead] = useState<ReadReceipt | null>(null);
  const [receiptPreview, setReceiptPreview] = useState("");
  const receiptInput = useRef<HTMLInputElement>(null);
  const snapInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (receiptPreview) URL.revokeObjectURL(receiptPreview); }, [receiptPreview]);

  async function readReceiptPhoto(file: File) {
    setReadError("");
    setRead(null);
    // The same picture is kept as the cost's receipt.
    if (receiptInput.current && receiptInput.current.files?.[0] !== file) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      receiptInput.current.files = transfer.files;
    }
    setReceiptPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
    setReading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/ocr/receipt", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setReadError(data.error || say("receiptReadFailed"));
        return;
      }
      if (!data.isReceipt) {
        setReadError(say("receiptNotReceipt"));
        return;
      }
      const found = data as ReadReceipt;
      if (found.amount) setAmount(String(found.amount));
      if (found.date) setTransactionDate(found.date);
      if (found.costType && !linkedTaskId) setType(found.costType);
      if (found.paidTo) setSupplier(found.paidTo);
      if (found.odometer) setMileage(String(found.odometer));
      if (found.paidTo || found.odometer) setMoreOpen(true);
      if (found.summary && !notes) setNotes(found.summary);
      const plate = plateKey(found.plate).match(/\d?\p{L}{1,3}\d{1,4}/u)?.[0];
      const vehicle = plate ? options.vehicles.find((entry) => plateKey(entry.label).startsWith(plate) || plateKey(entry.label).includes(plate)) : null;
      if (vehicle) setVehicleId(vehicle.id);
      setRead(found);
    } catch {
      setReadError(say("receiptReadFailed"));
    } finally {
      setReading(false);
    }
  }

  const isMoneyIn = MONEY_IN.includes(type);
  // A shop's rent or a phone bill belongs to the business, not to one vehicle.
  const canSkipVehicle = !isMoneyIn && !/refund|deposit/.test(type);
  const noVehicle = vehicleId === "none";
  const linkedBadge = linkedRentalPaymentId ? say("linkedPayment") : linkedTaskId ? say("linkedTask") : "";
  const chooseDirection = (moneyIn: boolean) => {
    setFormOpen(true);
    if (moneyIn === isMoneyIn) return;
    setType(moneyIn ? "rental_income" : "repair");
    setLinkedRentalPaymentId("");
    setLinkedTaskId("");
  };

  return (
    <form action={createTransaction} className="space-y-3">
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="rentalPaymentId" type="hidden" value={linkedRentalPaymentId} />
      <input name="taskId" type="hidden" value={linkedTaskId} />

      {/* The first question is the simplest one: did money come in or go out? */}
      {/* A segmented control: one 44px track, the chosen side a raised white pill in the brand teal. */}
      <div aria-label={`${say("moneyIn")} / ${say("moneyOut")}`} className="grid h-11 grid-cols-2 gap-1 rounded-full bg-[var(--panel-tertiary)] p-1" role="group">
        {[true, false].map((moneyIn) => {
          const chosen = isMoneyIn === moneyIn;
          return (
            <button
              aria-pressed={chosen}
              className={`pressable flex h-9 items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition ${chosen ? "bg-white text-[var(--primary)] shadow-[var(--shadow-sm)]" : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"}`}
              key={String(moneyIn)}
              onClick={() => chooseDirection(moneyIn)}
              type="button"
            >
              {moneyIn ? <ArrowDownLeft aria-hidden="true" size={18} /> : <ArrowUpRight aria-hidden="true" size={18} />}
              {moneyIn ? say("moneyIn") : say("moneyOut")}
            </button>
          );
        })}
      </div>

      {linkedBadge ? (
        <div className="rounded-xl border border-[var(--success-line)] bg-[var(--success-light)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          {linkedBadge}
        </div>
      ) : null}

      {matches.length > 0 ? (
        // The standard card. Each payment is a row you pick (the whole row is the target), then one primary button.
        <div className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="card-title">{matches.length === 1 ? say("matchOne") : say("matchMany")}</p>
              <p className="mt-0.5 text-[14px] text-[var(--foreground-secondary)]">{say("matchHint")}</p>
            </div>
            {isMatching ? <span className="text-xs font-semibold text-[var(--muted)]">{say("checking")}</span> : null}
          </div>
          <div className="mt-3 space-y-2" role="radiogroup">
            {(showAllMatches ? matches : matches.slice(0, 5)).map((match) => {
              const picked = (pickedMatchId || matches[0]?.id) === match.id;
              return (
                <label className={`pressable flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 ${picked ? "border-[var(--primary)] bg-[var(--primary-light)]" : "border-transparent bg-[var(--panel-secondary)]"}`} key={match.id}>
                  <input checked={picked} className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]" name="waitingPayment" onChange={() => setPickedMatchId(match.id)} type="radio" value={match.id} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-[var(--foreground)]">{matchLabel(match)}</span>
                    <span className="mt-0.5 block text-sm text-[var(--foreground-secondary)]">{[match.customerName, matchWhen(match)].filter(Boolean).join(" · ")}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {!showAllMatches && matches.length > 5 ? (
            <button className="mt-3 block text-sm font-semibold text-[var(--primary)]" onClick={() => setShowAllMatches(true)} type="button">
              {say("showMore", { count: matches.length - 5 })}
            </button>
          ) : null}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="secondary-action pressable"
              onClick={() => {
                setDismissedMatches(true);
                setMatches([]);
                setFormOpen(true);
              }}
              type="button"
            >
              {say("somethingElse")}
            </button>
            <button
              className="primary-action pressable"
              onClick={() => {
                const match = matches.find((item) => item.id === (pickedMatchId || matches[0]?.id));
                if (match) acceptMatch(match);
              }}
              type="button"
            >
              {say("useThisPayment")}
            </button>
          </div>
        </div>
      ) : null}

      {formOpen && !isMoneyIn ? (
        <div className="card p-4">
          <input
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void readReceiptPhoto(file);
            }}
            ref={snapInput}
            type="file"
          />
          <div className="flex flex-wrap items-center gap-3">
            {receiptPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="h-14 w-14 flex-shrink-0 rounded-lg border border-[var(--border)] object-cover" src={receiptPreview} />
            ) : (
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
                <Camera aria-hidden="true" size={24} />
              </span>
            )}
            <div className="min-w-[11rem] flex-1">
              <p className="text-[15px] font-bold text-[var(--foreground)]">{reading ? say("receiptReading") : read ? say("receiptFilled") : say("receiptSnapTitle")}</p>
              <p className="mt-0.5 text-[13px] font-medium text-[var(--muted)]">
                {reading ? say("receiptReadingHint") : read ? say("receiptFilledHint") : say("receiptSnapHint")}
              </p>
            </div>
            <button className="secondary-action pressable w-full justify-center sm:w-auto" disabled={reading} onClick={() => snapInput.current?.click()} type="button">
              {reading ? <Loader2 aria-hidden="true" className="animate-spin" size={17} /> : <Camera aria-hidden="true" size={17} />}
              {read || readError ? say("receiptAnother") : say("receiptSnap")}
            </button>
          </div>
          {readError ? <p className="mt-3 text-[14px] font-semibold text-[var(--danger)]">{readError}</p> : null}
          {read?.savedBefore ? (
            <p className="mt-3 rounded-lg border border-[var(--warning-line,var(--border))] bg-[var(--warning-light,var(--panel-secondary))] px-3 py-2 text-[14px] font-semibold text-[var(--warning)]">
              {say("receiptSavedBefore", { date: shortDate(read.savedBefore, locale) })}
            </p>
          ) : null}
        </div>
      ) : null}

      {formOpen ? (
        <>
      <input name="receiptRead" type="hidden" value={read ? JSON.stringify(read) : ""} />
      <Card>
        <div className="card-section grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("whatFor")}</span>
            <select className={inputClass} name="type" onChange={(event) => setType(event.target.value)} required value={type}>
              {TRANSACTION_TYPE_OPTIONS.filter((option) => option.value !== "deposit" && MONEY_IN.includes(option.value) === isMoneyIn).map((option) => (
                <option key={option.value} value={option.value}>
                  {t.has(`type_${option.value}`) ? say(`type_${option.value}`) : option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("vehicle")}</span>
            <select
              className={inputClass}
              name="vehicleId"
              onChange={(event) => {
                setVehicleId(event.target.value);
                setRentalId("");
              }}
              required
              value={canSkipVehicle || !noVehicle ? vehicleId : ""}
            >
              <option value="">{say("selectVehicle")}</option>
              {canSkipVehicle ? <option value="none">{say("noVehicle")}</option> : null}
              {options.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                </option>
              ))}
            </select>
            {noVehicle && canSkipVehicle ? <span className="mt-1 block text-[14px] text-[var(--muted)]">{say("noVehicleHint")}</span> : null}
          </label>

          {/* A repair or a tank of fuel belongs to the vehicle, not to a booking or a customer: those two are only asked for money in and refunds. */}
          <label className={isMoneyIn || /refund|deposit/.test(type) ? "block" : "hidden"}>
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("booking")}</span>
            <select
              className={inputClass}
              name="rentalId"
              onChange={(event) => handleRentalChange(event.target.value)}
              value={rentalId}
            >
              <option value="">{say("noBooking")}</option>
              {rentalsForVehicle.map((rental) => (
                <option key={rental.id} value={rental.id}>
                  {bookingOption(rental)}
                </option>
              ))}
            </select>
          </label>

          <label className={isMoneyIn || /refund|deposit/.test(type) ? "block" : "hidden"}>
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("customer")}</span>
            <select className={inputClass} name="customerId" onChange={(event) => setCustomerId(event.target.value)} value={customerId}>
              <option value="">{say("noCustomer")}</option>
              {options.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("amount")}</span>
            <input className={inputClass} inputMode="decimal" min="0" name="amount" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} />
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("date")}</span>
            <input className={inputClass} name="transactionDate" onChange={(event) => setTransactionDate(event.target.value)} required type="date" value={transactionDate} />
          </label>

          {isMoneyIn ? null : (
            <details className="sm:col-span-2" onToggle={(event) => setMoreOpen((event.currentTarget as HTMLDetailsElement).open)} open={moreOpen}>
              <summary className="cursor-pointer py-1 text-[14px] font-semibold text-[var(--primary)]">{t.has("moreDetails") ? say("moreDetails") : "Who you paid and the mileage (optional)"}</summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("paidTo")}</span>
                <input className={inputClass} name="supplier" onChange={(event) => setSupplier(event.target.value)} placeholder={say("paidToPlaceholder")} value={supplier} />
              </label>

              <label className="block">
                <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("mileage")}</span>
                <input className={inputClass} min="0" name="mileage" onChange={(event) => setMileage(event.target.value)} type="number" value={mileage} />
              </label>
              </div>
            </details>
          )}

          {!isMoneyIn && BILLABLE.includes(type) && rentalsForVehicle.length > 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3 sm:col-span-2">
              <label className="flex items-start gap-3 text-[14px] font-semibold text-[var(--foreground)]">
                <input
                  checked={billCustomer}
                  className="mt-0.5 h-5 w-5 flex-shrink-0"
                  name="billCustomer"
                  onChange={(event) => {
                    setBillCustomer(event.target.checked);
                    if (event.target.checked) {
                      if (!billRentalId && likelyBooking) setBillRentalId(likelyBooking.id);
                    }
                  }}
                  type="checkbox"
                  value="true"
                />
                <span>
                  {say("billTitle")}
                  <span className="mt-0.5 block text-[13px] font-medium text-[var(--muted)]">{say("billHint")}</span>
                </span>
              </label>
              {billCustomer ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("billBooking")}</span>
                    <select
                      className={inputClass}
                      name="billRentalId"
                      onChange={(event) => {
                        setBillPicked(true);
                        setBillRentalId(event.target.value);
                      }}
                      required
                      value={billRentalId}
                    >
                      {rentalsForVehicle.map((rental) => (
                        <option key={rental.id} value={rental.id}>
                          {bookingOption(rental)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("billAmount")}</span>
                    <input className={inputClass} inputMode="decimal" min="0" name="billAmount" onChange={(event) => setBillAmount(event.target.value)} required step="0.01" type="number" value={billAmount} />
                  </label>
                  {(() => {
                    const booking = rentalsForVehicle.find((rental) => rental.id === billRentalId);
                    const charge = Number(billAmount || 0);
                    const held = Number(booking?.depositHeld || 0);
                    const fromDeposit = Math.min(held, charge);
                    const rest = Math.max(0, charge - fromDeposit);
                    const baht = (value: number) => `฿${Math.round(value).toLocaleString("en-US")}`;
                    return (
                      <div className="space-y-2 sm:col-span-2">
                        {fromDeposit > 0 ? <p className="text-[14px] font-semibold text-[var(--foreground)]">{say("billFromDeposit", { amount: baht(fromDeposit), held: baht(held) })}</p> : null}
                        {rest > 0 ? (
                          <label className="flex items-start gap-3 text-[14px] font-semibold text-[var(--foreground)]">
                            <input checked={billRemainder} className="mt-0.5 h-5 w-5 flex-shrink-0" onChange={(event) => setBillRemainder(event.target.checked)} type="checkbox" />
                            <span>
                              {say(fromDeposit > 0 ? "billRest" : "billAll", { amount: baht(rest) })}
                              <span className="mt-0.5 block text-[13px] font-medium text-[var(--muted)]">{say("billRestHint")}</span>
                            </span>
                          </label>
                        ) : null}
                        <input name="billRemainder" type="hidden" value={billRemainder ? "true" : ""} />
                        {rest > 0 && billRemainder ? (
                          <p className="text-[13px] text-[var(--muted)]">{say("billWhatHappens")}</p>
                        ) : fromDeposit > 0 && held > fromDeposit ? (
                          <p className="text-[13px] text-[var(--muted)]">{say("depositLeftAfter", { amount: baht(held - fromDeposit) })}</p>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          ) : null}

          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("notes")}</span>
            <textarea className={inputClass} name="notes" onChange={(event) => setNotes(event.target.value)} placeholder={say("notesPlaceholder")} rows={3} value={notes} />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("receipt")}</span>
            {/* No forced camera: a receipt is as often a screenshot or a photo taken earlier. The phone offers camera or library. */}
            <input accept="image/*,application/pdf" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-[var(--primary-light)] file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-[var(--primary)]`} name="receipt"
              onChange={(event) => {
                // Picked here with nothing typed yet: read it, the same as the button at the top.
                const file = event.target.files?.[0];
                if (file && !isMoneyIn && !amount && !reading) void readReceiptPhoto(file);
              }}
              ref={receiptInput}
              type="file"
            />
          </label>
        </div>
      </Card>

      <div className="sticky-actions sticky z-10 -mx-1 flex flex-col-reverse gap-2 bg-[var(--background)] px-1 py-3 sm:flex-row sm:justify-end">
        <Link className="secondary-action pressable justify-center text-center" href="/transactions">
          {say("cancel")}
        </Link>
        <PendingButton className="primary-action justify-center" pendingLabel={say("saving")} type="submit">
          {say("save")}
        </PendingButton>
      </div>
        </>
      ) : null}
    </form>
  );
}
