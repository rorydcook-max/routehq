"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { answerExtensionRequest } from "@/app/actions/portal-actions";
import type { ExtensionPicture } from "@/lib/extension-picture";
import { niceDate } from "@/lib/nice-date";

/**
 * The owner's side of a request to stay longer. When nothing is in the way it
 * is a one-tap approval. When another booking is on the vehicle it shows both
 * sides, and the ways through: move the other booking to a free vehicle,
 * extend only as far as the vehicle is free, or decline (alongside).
 */
export function ExtensionRequestAnswer({ actionId, rentalId, picture, requestedEnd, openEnded }: { actionId: string; rentalId: string; picture: ExtensionPicture | null; requestedEnd: string | null; openEnded: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const blockers = picture?.blockers || [];
  const blocked = blockers.length > 0;
  const blocker = blockers.length === 1 ? blockers[0] : null;
  const freeUntil = picture?.freeUntil || null;
  const [endDate, setEndDate] = useState(blocked ? freeUntil || "" : requestedEnd || "");
  const [moveTo, setMoveTo] = useState(blocker?.options[0]?.vehicleId || "");

  const money = (amount: number) => `${!picture || picture.currency === "THB" ? "฿" : `${picture.currency} `}${Math.round(amount).toLocaleString("en-US")}`;

  function answer(key: string, input: { newEndDate?: string | null; openEnded?: boolean; move?: { rentalId: string; vehicleId: string } | null }) {
    setError("");
    setBusy(key);
    startTransition(async () => {
      const result = await answerExtensionRequest({ actionId, rentalId, ...input });
      setBusy(null);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const primary = "primary-action pressable w-full justify-center px-3 py-2 disabled:opacity-60";
  const secondary = "pressable w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] disabled:opacity-60";
  const worth = picture?.worth;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[#fbfaf8] p-3">
      {worth ? (
        <p className="text-sm text-[var(--foreground-secondary)]">
          Saying yes is worth <span className="font-semibold text-[var(--foreground)]">{worth.perMonth ? `${money(worth.amount)} a month, for as long as they stay` : money(worth.amount)}</span>
          {!worth.perMonth && worth.explain ? ` (${worth.explain})` : ""}.
        </p>
      ) : null}

      {!blocked ? (
        <div className="mt-3">
          {openEnded ? (
            <p className="text-sm text-[var(--foreground-secondary)]">Changes the rental to monthly with no end date and schedules the monthly rent. The customer is told.</p>
          ) : (
            <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
              New return date
              <input className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" min={picture?.currentEnd || undefined} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
              <span className="mt-1 block text-xs font-normal text-[var(--muted)]">The extra days are priced from your rates and added as a payment. The customer is told.</span>
            </label>
          )}
          <button className={`${primary} mt-3`} disabled={pending || (!openEnded && !endDate)} onClick={() => answer("approve", openEnded ? { openEnded: true } : { newEndDate: endDate })} type="button">
            {busy === "approve" ? "Approving..." : openEnded ? "Approve monthly, open-ended" : "Approve extension"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
            <p className="text-xs font-bold uppercase text-[#92400e]">{blockers.length === 1 ? "Another booking is in the way" : `${blockers.length} bookings are in the way`}</p>
            {blockers.map((item) => (
              <div className="mt-2 text-sm text-[var(--foreground)]" key={item.rentalId}>
                <Link className="font-semibold text-[var(--primary)]" href={`/bookings/${item.rentalId}` as Route}>
                  {item.customerName || "No customer yet"}
                  {item.code ? ` (${item.code})` : ""}
                </Link>
                <span className="text-[var(--foreground-secondary)]">
                  {" "}
                  has the {item.vehicle} from {niceDate(item.startDate)} {item.endDate ? `to ${niceDate(item.endDate)}` : "with no end date"}.{" "}
                  {item.total > 0 ? `Worth ${money(item.total)}${item.paid > 0 ? `, ${money(item.paid)} paid` : ", nothing paid yet"}. ` : "No price set. "}
                  {item.signed ? "Agreement signed." : "Not signed yet."}
                </span>
              </div>
            ))}
          </div>

          {blocker && blocker.signed ? (
            <p className="rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--foreground-secondary)]">
              {blocker.customerName || "That customer"} has signed for the {blocker.vehicle}, so moving them needs their signature.{" "}
              <Link className="font-semibold text-[var(--primary)] underline" href={`/bookings/${blocker.rentalId}` as Route}>
                Open their booking
              </Link>{" "}
              and use More &gt; Change vehicle. Once they have signed, come back and approve this.
            </p>
          ) : blocker && blocker.options.length > 0 ? (
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
                Move {blocker.customerName || "the other booking"} to another vehicle
                <select className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal" onChange={(event) => setMoveTo(event.target.value)} value={moveTo}>
                  {blocker.options.map((option) => (
                    <option key={option.vehicleId} value={option.vehicleId}>
                      {option.label}
                      {option.plate ? ` · ${option.plate}` : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
                  These are free for all of their dates. {blocker.customerName ? "They keep their dates and price, and both customers are told." : "The booking keeps its dates and price."}
                </span>
              </label>
              <button
                className={`${primary} mt-3`}
                disabled={pending || !moveTo}
                onClick={() => answer("move", { ...(openEnded ? { openEnded: true } : { newEndDate: requestedEnd }), move: { rentalId: blocker.rentalId, vehicleId: moveTo } })}
                type="button"
              >
                {busy === "move" ? "Moving and approving..." : `Move it and approve ${openEnded ? "monthly, open-ended" : `to ${niceDate(requestedEnd)}`}`}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--foreground-secondary)]">
              {blockers.length > 1
                ? "With more than one booking in the way, open each one and use More > Change vehicle, then come back."
                : blocker && blocker.options.length === 0
                  ? "No other vehicle is free for all of that booking's dates, so it can't be moved."
                  : ""}
            </p>
          )}

          {freeUntil ? (
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
                Or extend only as far as the vehicle is free
                <input className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal" max={freeUntil} min={picture?.currentEnd || undefined} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
                <span className="mt-1 block text-xs font-normal text-[var(--muted)]">Free until {niceDate(freeUntil)}. Nothing else changes.</span>
              </label>
              <button className={`${secondary} mt-3`} disabled={pending || !endDate} onClick={() => answer("partial", { newEndDate: endDate })} type="button">
                {busy === "partial" ? "Extending..." : `Extend to ${endDate ? niceDate(endDate) : "this date"}`}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-3 rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{error}</p> : null}
    </div>
  );
}
