"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Inbox } from "lucide-react";
import { approveBookingRequest, declineBookingRequest } from "@/app/actions/booking-requests";
import type { BookingRequestRow } from "@/lib/public-catalog";

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits.startsWith("0") ? `66${digits.slice(1)}` : digits}`;
}

function holdLabel(holdUntil: string) {
  const hours = Math.round((new Date(holdUntil).getTime() - Date.now()) / 3_600_000);
  if (hours <= 0) return "Hold has run out — the dates are open to others again";
  return hours < 2 ? "Held for about another hour" : `Held for another ${hours} hours`;
}

/** Requests from the public booking page, waiting for a yes or no. */
export function BookingRequests({ requests }: { requests: BookingRequestRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  if (requests.length === 0) return null;

  function answer(id: string, accept: boolean) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const result = accept ? await approveBookingRequest(id) : await declineBookingRequest(id);
        if (!result.ok) {
          setError(result.error);
        } else if (accept && "href" in result) {
          router.push(result.href as Route);
          return;
        } else {
          router.refresh();
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
      setBusyId(null);
    });
  }

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-[var(--primary)] bg-white">
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--primary-light)] px-4 py-2">
        <Inbox className="text-[var(--primary)]" size={16} />
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--primary)]">
          {requests.length === 1 ? "1 booking request" : `${requests.length} booking requests`}
        </p>
      </div>
      {error ? <p className="px-4 pt-3 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
      <div className="divide-y divide-[var(--border)]">
        {requests.map((request) => {
          const wa = waLink(request.phone);
          const busy = busyId === request.id;
          return (
            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start" key={request.id}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--foreground)]">
                  {request.customerName} <span className="font-normal text-[var(--foreground-secondary)]">wants the</span> {request.vehicleName}
                </p>
                <p className="mt-0.5 text-sm text-[var(--foreground-secondary)]">
                  {request.endDate ? `${shortDate(request.startDate)} to ${shortDate(request.endDate)}` : `From ${shortDate(request.startDate)}, long term`}
                  {request.estimatedTotal ? ` · about ฿${Math.round(request.estimatedTotal).toLocaleString("en-US")}` : ""}
                  {" · "}
                  {wa ? (
                    <a className="font-semibold text-[var(--primary)] hover:underline" href={wa} rel="noreferrer" target="_blank">
                      {request.phone}
                    </a>
                  ) : (
                    request.phone
                  )}
                </p>
                {request.message ? <p className="mt-1 text-sm text-[var(--foreground)]">“{request.message}”</p> : null}
                <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{holdLabel(request.holdUntil)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button className="primary-action pressable min-h-9 px-4 text-xs" disabled={busy} onClick={() => answer(request.id, true)} type="button">
                  {busy ? "Opening…" : "Accept & create booking"}
                </button>
                <button className="secondary-action pressable min-h-9 px-4 text-xs" disabled={busy} onClick={() => answer(request.id, false)} type="button">
                  Decline
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
