"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
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
  startAsCost = false
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
  const [type, setType] = useState(prefill?.type || (startAsCost ? "repair" : "rental_income"));
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
  const [matches, setMatches] = useState<MatchResult[]>(startsLinked || startAsCost ? [] : waitingHere);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [dismissedMatches, setDismissedMatches] = useState(false);
  // While there are payments being waited for, they are the whole screen; the form opens when one is chosen or it is something else.
  const [formOpen, setFormOpen] = useState(startsLinked || startAsCost || waitingHere.length === 0);
  const [isMatching, startMatchTransition] = useTransition();

  // A booking is told apart by its dates as much as by its number.
  const bookingOption = (rental: TransactionFormOptions["rentals"][number]) =>
    rental.startDate ? `${rental.label} · ${shortDate(rental.startDate, locale)}–${rental.endDate ? shortDate(rental.endDate, locale) : "…"}` : rental.label;
  const rentalsForVehicle = useMemo(
    () => options.rentals.filter((rental) => rental.vehicleId === vehicleId),
    [options.rentals, vehicleId]
  );
  // Billing the renter for this cost: off unless chosen. The booking offered first is the one the vehicle was on that day.
  const [billCustomer, setBillCustomer] = useState(startAsCost && Boolean(defaultRentalId));
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

  const isMoneyIn = MONEY_IN.includes(type);
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
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--panel-secondary)] p-1">
        {[true, false].map((moneyIn) => (
          <button
            aria-pressed={isMoneyIn === moneyIn}
            className={`min-h-11 rounded-lg text-[15px] font-semibold transition ${isMoneyIn === moneyIn ? "bg-white text-[var(--foreground)] shadow-[var(--shadow-sm)]" : "text-[var(--muted)]"}`}
            key={String(moneyIn)}
            onClick={() => chooseDirection(moneyIn)}
            type="button"
          >
            {moneyIn ? say("moneyIn") : say("moneyOut")}
          </button>
        ))}
      </div>

      {linkedBadge ? (
        <div className="rounded-xl border border-[var(--success-line)] bg-[var(--success-light)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          {linkedBadge}
        </div>
      ) : null}

      {matches.length > 0 ? (
        <div className="rounded-xl border border-[var(--primary)] bg-[var(--primary-light)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[var(--foreground)]">
                {matches.length === 1 ? say("matchOne") : say("matchMany")}
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--foreground-secondary)]">{say("matchHint")}</p>
            </div>
            {isMatching ? <span className="text-xs font-semibold text-[var(--muted)]">{say("checking")}</span> : null}
          </div>
          <div className="mt-3 space-y-2">
            {(showAllMatches ? matches : matches.slice(0, 5)).map((match) => (
              <div className="rounded-lg border border-[var(--info-line)] bg-white p-3" key={match.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{matchLabel(match)}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {[match.customerName, matchWhen(match)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button className="primary-action pressable min-h-9 px-3 text-xs" onClick={() => acceptMatch(match)} type="button">
                    {say("yesThis")}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!showAllMatches && matches.length > 5 ? (
            <button className="mt-3 block text-sm font-semibold text-[var(--primary)]" onClick={() => setShowAllMatches(true)} type="button">
              {say("showMore", { count: matches.length - 5 })}
            </button>
          ) : null}
          <button
            className="mt-3 text-sm font-semibold text-[var(--primary)]"
            onClick={() => {
              setDismissedMatches(true);
              setMatches([]);
              setFormOpen(true);
            }}
            type="button"
          >
            {say("somethingElse")}
          </button>
        </div>
      ) : null}

      {formOpen ? (
        <>
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
              value={vehicleId}
            >
              <option value="">{say("selectVehicle")}</option>
              {options.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                </option>
              ))}
            </select>
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
            <details className="sm:col-span-2">
              <summary className="cursor-pointer py-1 text-[14px] font-semibold text-[var(--primary)]">{t.has("moreDetails") ? say("moreDetails") : "Who you paid and the mileage (optional)"}</summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("paidTo")}</span>
                <input className={inputClass} name="supplier" placeholder={say("paidToPlaceholder")} />
              </label>

              <label className="block">
                <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("mileage")}</span>
                <input className={inputClass} min="0" name="mileage" type="number" />
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
                    <select className={inputClass} name="billRentalId" onChange={(event) => setBillRentalId(event.target.value)} required value={billRentalId}>
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
            <input accept="image/*,application/pdf" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-[var(--primary-light)] file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-[var(--primary)]`} name="receipt" type="file" />
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
