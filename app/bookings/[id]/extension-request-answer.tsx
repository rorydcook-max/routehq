"use client";

import { useState, useTransition } from "react";
import { quoteExplainIn } from "@/lib/i18n/quote-text";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { answerExtensionRequest } from "@/app/actions/portal-actions";
import type { ExtensionPicture } from "@/lib/extension-picture";
import { useLocale, useTranslations } from "next-intl";
import { longDate } from "@/lib/i18n/dates";

/**
 * The owner's side of a request to stay longer. When nothing is in the way it
 * is a one-tap approval. When another booking is on the vehicle it shows both
 * sides, and the ways through: move the other booking to a free vehicle,
 * extend only as far as the vehicle is free, or decline (alongside).
 */
export function ExtensionRequestAnswer({ actionId, rentalId, picture, requestedEnd, openEnded }: { actionId: string; rentalId: string; picture: ExtensionPicture | null; requestedEnd: string | null; openEnded: boolean }) {
  const router = useRouter();
  const t = useTranslations("booking");
  const say = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  const locale = useLocale();
  const niceDate = (value: string | null | undefined) => (value ? longDate(String(value).slice(0, 10), locale) : "");
  const strong = (chunks: React.ReactNode) => <span className="font-semibold text-[var(--foreground)]">{chunks}</span>;
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
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
      {worth ? (
        <p className="text-sm text-[var(--foreground-secondary)]">
          {t.rich(worth.perMonth ? "ext_worthMonthly" : worth.explain ? "ext_worthExplained" : "ext_worth", { amount: money(worth.amount), explain: quoteExplainIn(worth.explain, t as unknown as (key: string, values?: Record<string, string | number>) => string), b: strong })}
        </p>
      ) : null}

      {!blocked ? (
        <div className="mt-3">
          {openEnded ? (
            <p className="text-sm text-[var(--foreground-secondary)]">{say("ext_openEndedNote")}</p>
          ) : (
            <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
              {say("ext_newReturn")}
              <input className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" min={picture?.currentEnd || undefined} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
              <span className="mt-1 block text-xs font-normal text-[var(--muted)]">{say("ext_priced")}</span>
            </label>
          )}
          <button className={`${primary} mt-3`} disabled={pending || (!openEnded && !endDate)} onClick={() => answer("approve", openEnded ? { openEnded: true } : { newEndDate: endDate })} type="button">
            {busy === "approve" ? say("ext_approving") : openEnded ? say("ext_approveOpen") : say("ext_approve")}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
            <p className="text-xs font-bold uppercase text-[var(--warning)]">{blockers.length === 1 ? say("ext_blockOne") : say("ext_blockMany", { count: blockers.length })}</p>
            {blockers.map((item) => (
              <div className="mt-2 text-sm text-[var(--foreground)]" key={item.rentalId}>
                <Link className="font-semibold text-[var(--primary)]" href={`/bookings/${item.rentalId}` as Route}>
                  {item.customerName || say("ext_noCustomer")}
                  {item.code ? ` (${item.code})` : ""}
                </Link>
                <span className="text-[var(--foreground-secondary)]">
                  {" "}
                  {item.endDate ? say("ext_hasTo", { vehicle: item.vehicle, start: niceDate(item.startDate), end: niceDate(item.endDate) }) : say("ext_hasOpen", { vehicle: item.vehicle, start: niceDate(item.startDate) })}{" "}
                  {item.total > 0 ? (item.paid > 0 ? say("ext_worthPaid", { total: money(item.total), paid: money(item.paid) }) : say("ext_worthUnpaid", { total: money(item.total) })) : say("ext_noPrice")}{" "}
                  {item.signed ? say("ext_signed") : say("ext_notSigned")}
                </span>
              </div>
            ))}
          </div>

          {blocker && blocker.signed ? (
            <p className="rounded-lg border border-[var(--border)] bg-white p-3 text-sm text-[var(--foreground-secondary)]">
              {t.rich("ext_signedMove", {
                name: blocker.customerName || say("ext_thatCustomer"),
                vehicle: blocker.vehicle,
                link: (chunks: React.ReactNode) => (
                  <Link className="font-semibold text-[var(--primary)] underline" href={`/bookings/${blocker.rentalId}` as Route}>
                    {chunks}
                  </Link>
                )
              })}
            </p>
          ) : blocker && blocker.options.length > 0 ? (
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
                {say("ext_moveLabel", { name: blocker.customerName || say("ext_otherBooking") })}
                <select className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal" onChange={(event) => setMoveTo(event.target.value)} value={moveTo}>
                  {blocker.options.map((option) => (
                    <option key={option.vehicleId} value={option.vehicleId}>
                      {option.label}
                      {option.plate ? ` · ${option.plate}` : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
                  {blocker.customerName ? say("ext_freeAllKeep") : say("ext_freeAllBooking")}
                </span>
              </label>
              <button
                className={`${primary} mt-3`}
                disabled={pending || !moveTo}
                onClick={() => answer("move", { ...(openEnded ? { openEnded: true } : { newEndDate: requestedEnd }), move: { rentalId: blocker.rentalId, vehicleId: moveTo } })}
                type="button"
              >
                {busy === "move" ? say("ext_moving") : openEnded ? say("ext_moveApproveOpen") : say("ext_moveApproveTo", { date: niceDate(requestedEnd) })}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--foreground-secondary)]">
              {blockers.length > 1
                ? say("ext_manyBlock")
                : blocker && blocker.options.length === 0
                  ? say("ext_noFree")
                  : ""}
            </p>
          )}

          {freeUntil ? (
            <div className="rounded-lg border border-[var(--border)] bg-white p-3">
              <label className="block text-sm font-bold text-[var(--foreground-secondary)]">
                {say("ext_partialLabel")}
                <input className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-normal" max={freeUntil} min={picture?.currentEnd || undefined} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
                <span className="mt-1 block text-xs font-normal text-[var(--muted)]">{say("ext_freeUntil", { date: niceDate(freeUntil) })}</span>
              </label>
              <button className={`${secondary} mt-3`} disabled={pending || !endDate} onClick={() => answer("partial", { newEndDate: endDate })} type="button">
                {busy === "partial" ? say("ext_extending") : say("ext_extendTo", { date: endDate ? niceDate(endDate) : say("ext_thisDate") })}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-3 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
