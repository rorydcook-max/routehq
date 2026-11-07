"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { chooseFreePlan, keepCurrentPlan, openBillingPortal } from "@/app/actions/billing";
import { forgetSubscriptionStatus } from "@/components/trial-banner";
import { Overlay, KeepVehiclesDialog, needsParking, type FleetVehicleRow } from "./billing-dialogs";

type Say = (key: string, values?: Record<string, string | number>) => string;

/** Opens Stripe's Customer Portal (card, billing address, invoices). */
export function PortalButton({ label, primary = false }: { label: string; primary?: boolean }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className={`${primary ? "primary-action" : "secondary-action"} pressable disabled:opacity-60`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await openBillingPortal().catch(() => ({ ok: false as const, error: say("pl_tryAgain") }));
            if (result.ok) window.location.href = result.url;
            else setError(result.error);
          })
        }
        type="button"
      >
        {pending ? say("pl_saving") : label}
      </button>
      {error ? (
        <p className="w-full text-sm font-semibold text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** Change plan, Cancel (Free at the end of the period), Keep the current plan, card and address. Owners only. */
export function BillingActions({
  showChangePlan,
  canCancel,
  canKeep,
  keepLabel,
  hasCustomer,
  cancelDate,
  vehicles,
  freeLimits,
  trial
}: {
  showChangePlan: boolean;
  canCancel: boolean;
  canKeep: boolean;
  keepLabel: string;
  hasCustomer: boolean;
  cancelDate: string | null;
  vehicles: FleetVehicleRow[];
  freeLimits: { cars: number | null; motorbikes: number | null };
  trial: boolean;
}) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const after = (result: { ok: boolean; error?: string }) => {
    setConfirming(false);
    setChoosing(false);
    if (!result.ok) setError(result.error || say("pl_tryAgain"));
    forgetSubscriptionStatus();
    router.refresh();
  };
  const cancel = (keep: string[] | null) =>
    startTransition(async () => {
      setError(null);
      after(await chooseFreePlan({ keep }).catch(() => ({ ok: false as const, error: say("pl_tryAgain") })));
    });
  const askCancel = () => {
    setConfirming(false);
    if (!trial && needsParking(vehicles, freeLimits)) setChoosing(true);
    else cancel(null);
  };

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {showChangePlan ? (
        <Link className="primary-action pressable" href={"/settings/billing#plans" as Route}>
          {say("sb_changePlan")}
        </Link>
      ) : null}
      {canKeep ? (
        <button
          className="primary-action pressable disabled:opacity-60"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              after(await keepCurrentPlan().catch(() => ({ ok: false as const, error: say("pl_tryAgain") })));
            })
          }
          type="button"
        >
          {pending ? say("pl_saving") : keepLabel}
        </button>
      ) : null}
      {hasCustomer ? <PortalButton label={say("sb_updatePayment")} /> : null}
      {canCancel ? (
        <button className="secondary-action pressable disabled:opacity-60" disabled={pending} onClick={() => setConfirming(true)} type="button">
          {say("sb_cancel")}
        </button>
      ) : null}
      {error ? (
        <p className="w-full text-sm font-semibold text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <Overlay onClose={() => setConfirming(false)} title={say("sb_cancel")}>
          <p className="text-[17px] font-semibold text-[var(--foreground)]">{cancelDate ? say("sb_cancelOn", { date: cancelDate }) : say("sb_cancelNow")}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button className="secondary-action pressable flex-1 !border-[var(--danger)] !text-[var(--danger)] disabled:opacity-60" disabled={pending} onClick={askCancel} type="button">
              {pending ? say("pl_saving") : say("sb_cancelConfirm")}
            </button>
            <button className="secondary-action pressable flex-1" onClick={() => setConfirming(false)} type="button">
              {say("sb_back")}
            </button>
          </div>
        </Overlay>
      ) : null}
      {choosing ? (
        <KeepVehiclesDialog busy={pending} limits={freeLimits} onClose={() => setChoosing(false)} onConfirm={(keep) => cancel(keep)} title={say("kv_title", { plan: say("bl_free") })} vehicles={vehicles} />
      ) : null}
    </div>
  );
}
