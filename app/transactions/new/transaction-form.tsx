"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createTransaction, findTransactionMatches } from "@/app/actions/transactions";
import { PendingButton } from "@/components/pending-button";
import { Card } from "@/components/ui";
import { TRANSACTION_TYPE_OPTIONS } from "@/lib/transaction-options";
import type { MatchResult } from "@/lib/transaction-matching";
import type { TransactionFormOptions, TransactionFormPrefill } from "@/lib/transactions";

const MONEY_IN: string[] = ["rental_income", "deposit_received", "deposit_forfeited", "deposit_deduction"];

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-[15px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]";

export function TransactionForm({
  organizationId,
  options,
  defaultVehicleId = "",
  defaultRentalId = "",
  defaultCustomerId = "",
  prefill = null,
  waiting = []
}: {
  organizationId: string;
  options: TransactionFormOptions;
  defaultVehicleId?: string;
  defaultRentalId?: string;
  defaultCustomerId?: string;
  prefill?: TransactionFormPrefill | null;
  /** Payments the business is waiting for, shown first so the usual case is one tap. */
  waiting?: MatchResult[];
}) {
  const [type, setType] = useState(prefill?.type || "rental_income");
  const [amount, setAmount] = useState(prefill?.amount || "");
  // Today in business time: toISOString() is UTC, which is still "yesterday" in Thailand before 7am.
  const [transactionDate, setTransactionDate] = useState(
    prefill?.transactionDate || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date())
  );
  const [notes, setNotes] = useState(prefill?.notes || "");
  // No vehicle is preselected: a money entry silently booked against the first car in the list is worse than a required field.
  const [vehicleId, setVehicleId] = useState(prefill?.vehicleId || defaultVehicleId || "");
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
  const [matches, setMatches] = useState<MatchResult[]>(startsLinked ? [] : waitingHere);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [dismissedMatches, setDismissedMatches] = useState(false);
  const [isMatching, startMatchTransition] = useTransition();

  const rentalsForVehicle = useMemo(
    () => options.rentals.filter((rental) => rental.vehicleId === vehicleId),
    [options.rentals, vehicleId]
  );

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
  }

  const isMoneyIn = MONEY_IN.includes(type);
  const linkedBadge = linkedRentalPaymentId ? "Check the amount and date, then save. That payment is marked as paid on the booking." : linkedTaskId ? "Saving this ticks off the matching job on your To do list." : "";
  const chooseDirection = (moneyIn: boolean) => {
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
            {moneyIn ? "Money in" : "Money out"}
          </button>
        ))}
      </div>

      {linkedBadge ? (
        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-semibold text-[#166534]">
          {linkedBadge}
        </div>
      ) : null}

      {matches.length > 0 ? (
        <div className="rounded-xl border border-[var(--primary)] bg-[var(--primary-light)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[var(--foreground)]">
                {matches.length === 1 ? "Is it this payment you are waiting for?" : "Is it one of these payments you are waiting for?"}
              </p>
              <p className="mt-0.5 text-[13px] text-[var(--foreground-secondary)]">Choose it and the booking is marked as paid too.</p>
            </div>
            {isMatching ? <span className="text-xs font-semibold text-[var(--muted)]">Checking...</span> : null}
          </div>
          <div className="mt-3 space-y-2">
            {(showAllMatches ? matches : matches.slice(0, 5)).map((match) => (
              <div className="rounded-lg border border-[#bfe0db] bg-white p-3" key={match.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{match.label}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {[match.customerName, match.subLabel].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button className="primary-action pressable min-h-9 px-3 text-xs" onClick={() => acceptMatch(match)} type="button">
                    Yes, this one
                  </button>
                </div>
              </div>
            ))}
          </div>
          {!showAllMatches && matches.length > 5 ? (
            <button className="mt-3 block text-sm font-semibold text-[var(--primary)]" onClick={() => setShowAllMatches(true)} type="button">
              Show {matches.length - 5} more
            </button>
          ) : null}
          <button
            className="mt-3 text-sm font-semibold text-[var(--primary)]"
            onClick={() => {
              setDismissedMatches(true);
              setMatches([]);
            }}
            type="button"
          >
            No, it is something else
          </button>
        </div>
      ) : null}

      <Card>
        <div className="card-section grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">What was it for?</span>
            <select className={inputClass} name="type" onChange={(event) => setType(event.target.value)} required value={type}>
              {TRANSACTION_TYPE_OPTIONS.filter((option) => option.value !== "deposit" && MONEY_IN.includes(option.value) === isMoneyIn).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">Vehicle</span>
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
              <option value="">Select vehicle</option>
              {options.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">Booking (optional)</span>
            <select
              className={inputClass}
              name="rentalId"
              onChange={(event) => handleRentalChange(event.target.value)}
              value={rentalId}
            >
              <option value="">No booking</option>
              {rentalsForVehicle.map((rental) => (
                <option key={rental.id} value={rental.id}>
                  {rental.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">Customer (optional)</span>
            <select className={inputClass} name="customerId" onChange={(event) => setCustomerId(event.target.value)} value={customerId}>
              <option value="">No customer</option>
              {options.customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">Amount (฿)</span>
            <input className={inputClass} inputMode="decimal" min="0" name="amount" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} />
          </label>

          <label className="block">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">Date</span>
            <input className={inputClass} name="transactionDate" onChange={(event) => setTransactionDate(event.target.value)} required type="date" value={transactionDate} />
          </label>

          {isMoneyIn ? null : (
            <>
              <label className="block">
                <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">Paid to (optional)</span>
                <input className={inputClass} name="supplier" placeholder="Garage, fuel station, insurer" />
              </label>

              <label className="block">
                <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">Mileage (optional)</span>
                <input className={inputClass} min="0" name="mileage" type="number" />
              </label>
            </>
          )}

          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">Notes (optional)</span>
            <textarea className={inputClass} name="notes" onChange={(event) => setNotes(event.target.value)} placeholder="Anything worth remembering" rows={3} value={notes} />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[var(--foreground-secondary)]">Receipt photo (optional)</span>
            {/* No forced camera: a receipt is as often a screenshot or a photo taken earlier. The phone offers camera or library. */}
            <input accept="image/*,application/pdf" className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-[var(--primary-light)] file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-[var(--primary)]`} name="receipt" type="file" />
          </label>
        </div>
      </Card>

      <div className="sticky-actions sticky z-10 -mx-1 flex flex-col-reverse gap-2 bg-[var(--background)] px-1 py-3 sm:flex-row sm:justify-end">
        <Link className="secondary-action pressable justify-center text-center" href="/transactions">
          Cancel
        </Link>
        <PendingButton className="primary-action justify-center" pendingLabel="Saving…" type="submit">
          Save
        </PendingButton>
      </div>
    </form>
  );
}
