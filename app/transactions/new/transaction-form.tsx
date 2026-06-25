"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createTransaction, findTransactionMatches } from "@/app/actions/transactions";
import { PendingButton } from "@/components/pending-button";
import { Card, SectionHeader } from "@/components/ui";
import { TRANSACTION_TYPE_OPTIONS } from "@/lib/transaction-options";
import type { MatchResult } from "@/lib/transaction-matching";
import type { TransactionFormOptions, TransactionFormPrefill } from "@/lib/transactions";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]";

export function TransactionForm({
  organizationId,
  options,
  defaultVehicleId = "",
  defaultRentalId = "",
  defaultCustomerId = "",
  prefill = null
}: {
  organizationId: string;
  options: TransactionFormOptions;
  defaultVehicleId?: string;
  defaultRentalId?: string;
  defaultCustomerId?: string;
  prefill?: TransactionFormPrefill | null;
}) {
  const [type, setType] = useState(prefill?.type || "rental_income");
  const [amount, setAmount] = useState(prefill?.amount || "");
  const [transactionDate, setTransactionDate] = useState(prefill?.transactionDate || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(prefill?.notes || "");
  const [vehicleId, setVehicleId] = useState(prefill?.vehicleId || defaultVehicleId || options.vehicles[0]?.id || "");
  const [rentalId, setRentalId] = useState(prefill?.rentalId || defaultRentalId);
  const [customerId, setCustomerId] = useState(prefill?.customerId || defaultCustomerId);
  const [linkedRentalPaymentId, setLinkedRentalPaymentId] = useState(prefill?.rentalPaymentId || "");
  const [linkedTaskId, setLinkedTaskId] = useState(prefill?.taskId || "");
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [dismissedMatches, setDismissedMatches] = useState(false);
  const [isMatching, startMatchTransition] = useTransition();

  const rentalsForVehicle = useMemo(
    () => options.rentals.filter((rental) => rental.vehicleId === vehicleId),
    [options.rentals, vehicleId]
  );

  useEffect(() => {
    if (!type || linkedRentalPaymentId || linkedTaskId || dismissedMatches) {
      setMatches([]);
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
  }, [amount, dismissedMatches, linkedRentalPaymentId, linkedTaskId, organizationId, transactionDate, type, vehicleId]);

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
    setLinkedRentalPaymentId(match.rentalPaymentId || "");
    setLinkedTaskId(match.taskId || "");
    setMatches([]);
  }

  const linkedBadge = linkedRentalPaymentId ? "Linked to rental payment" : linkedTaskId ? "Linked to task" : "";

  return (
    <form action={createTransaction} className="space-y-3">
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="rentalPaymentId" type="hidden" value={linkedRentalPaymentId} />
      <input name="taskId" type="hidden" value={linkedTaskId} />

      {linkedBadge ? (
        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-black text-[#166534]">
          {linkedBadge}
        </div>
      ) : null}

      {matches.length > 0 ? (
        <div className="rounded-xl border border-[var(--primary)] bg-[var(--primary-light)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--primary)]">Match found</p>
              <p className="mt-1 text-sm font-bold text-[var(--foreground)]">
                {matches.length === 1 && matches[0].confidence === "high"
                  ? "Looks like this might be for:"
                  : "Possible outstanding payments:"}
              </p>
            </div>
            {isMatching ? <span className="text-xs font-semibold text-[var(--muted)]">Checking...</span> : null}
          </div>
          <div className="mt-3 space-y-2">
            {matches.map((match) => (
              <div className="rounded-lg border border-[#a5f3fc] bg-white p-3" key={match.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-black text-[var(--foreground)]">{match.label}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {[match.customerName, match.subLabel].filter(Boolean).join(" - ")}
                    </p>
                  </div>
                  <button className="primary-action pressable min-h-9 px-3 text-xs" onClick={() => acceptMatch(match)} type="button">
                    {match.matchType === "rental_payment" ? "Link this payment" : "Link this task"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            className="mt-3 text-sm font-black text-[var(--primary)]"
            onClick={() => {
              setDismissedMatches(true);
              setMatches([]);
            }}
            type="button"
          >
            None of these
          </button>
        </div>
      ) : null}

      <Card>
        <SectionHeader eyebrow="Transaction" title="Record payment or expense" />
        <div className="card-section grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Type</span>
            <select className={inputClass} name="type" onChange={(event) => setType(event.target.value)} required value={type}>
              {TRANSACTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Vehicle</span>
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
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Booking (optional)</span>
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
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Customer (optional)</span>
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
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Amount (THB)</span>
            <input className={inputClass} min="0" name="amount" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Date</span>
            <input className={inputClass} name="transactionDate" onChange={(event) => setTransactionDate(event.target.value)} required type="date" value={transactionDate} />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Supplier</span>
            <input className={inputClass} name="supplier" placeholder="Garage, fuel station, insurer" />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Mileage (optional)</span>
            <input className={inputClass} min="0" name="mileage" type="number" />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Notes</span>
            <textarea className={inputClass} name="notes" onChange={(event) => setNotes(event.target.value)} placeholder="What was this payment for?" rows={3} value={notes} />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Receipt photo (optional)</span>
            <input accept="image/*,application/pdf" capture="environment" className={inputClass} name="receipt" type="file" />
          </label>
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Link className="secondary-action pressable text-center" href="/transactions">
          Cancel
        </Link>
        <PendingButton className="primary-action" pendingLabel="Saving…" type="submit">
          Save transaction
        </PendingButton>
      </div>
    </form>
  );
}
