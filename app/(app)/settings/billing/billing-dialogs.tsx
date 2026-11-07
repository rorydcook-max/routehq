"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Badge } from "@/components/ui";

type Say = (key: string, values?: Record<string, string | number>) => string;

export type FleetVehicleRow = { id: string; label: string; registration: string | null; motorbike: boolean; parked: boolean; busy: boolean };

/** A plain overlay: a sheet on phones, a centered panel on larger screens. */
export function Overlay({ title, onClose, wide = false, children }: { title: string; onClose: () => void; wide?: boolean; children: ReactNode }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  if (!mounted) return null;
  return createPortal(
    <div aria-modal="true" className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog">
      <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-[var(--panel)] shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <h2 className="card-title">{title}</h2>
          <button aria-label={say("sb_close")} className="pressable inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)]" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

let stripePromise: Promise<StripeJs | null> | null = null;
function stripeJs() {
  if (!stripePromise) stripePromise = loadStripe(String(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""));
  return stripePromise;
}

/** Stripe Embedded Checkout for a plan, in the app. */
export function CheckoutDialog({ clientSecret, onComplete, onClose }: { clientSecret: string; onComplete: (sessionId: string) => void; onClose: () => void }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  // Stripe allows the options to be set once: the latest callback is read through a ref.
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const options = useMemo(() => ({ clientSecret, onComplete: () => completeRef.current(clientSecret.split("_secret_")[0]) }), [clientSecret]);
  return (
    <Overlay onClose={onClose} title={say("sb_checkout")} wide>
      <div className="min-h-[420px]" id="plan-checkout">
        <EmbeddedCheckoutProvider options={options} stripe={stripeJs()}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </Overlay>
  );
}

/** Which vehicles stay active on a plan with room for fewer; the rest are parked. */
export function KeepVehiclesDialog({
  vehicles,
  limits,
  title,
  busy,
  onConfirm,
  onClose
}: {
  vehicles: FleetVehicleRow[];
  limits: { cars: number | null; motorbikes: number | null };
  title: string;
  busy: boolean;
  onConfirm: (keep: string[]) => void;
  onClose: () => void;
}) {
  const say = useTranslations("settingsPage") as unknown as Say;
  // Start from what is out on a rental, then what is active now, up to each limit.
  const initial = useMemo(() => {
    const picked = new Set<string>();
    for (const motorbike of [false, true]) {
      const limit = motorbike ? limits.motorbikes : limits.cars;
      const group = vehicles.filter((vehicle) => vehicle.motorbike === motorbike);
      const ranked = [...group].sort((a, b) => Number(b.busy) - Number(a.busy) || Number(a.parked) - Number(b.parked));
      (limit === null ? ranked : ranked.slice(0, limit)).forEach((vehicle) => picked.add(vehicle.id));
    }
    return picked;
  }, [vehicles, limits]);
  const [picked, setPicked] = useState<Set<string>>(initial);
  const groups = [
    { motorbike: false, label: say("kv_cars"), limit: limits.cars },
    { motorbike: true, label: say("kv_motorbikes"), limit: limits.motorbikes }
  ].map((group) => ({ ...group, list: vehicles.filter((vehicle) => vehicle.motorbike === group.motorbike) }));
  const toggle = (vehicle: FleetVehicleRow, limit: number | null) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(vehicle.id)) next.delete(vehicle.id);
      else {
        const count = vehicles.filter((entry) => entry.motorbike === vehicle.motorbike && next.has(entry.id)).length;
        if (limit !== null && count >= limit) return current;
        next.add(vehicle.id);
      }
      return next;
    });
  };
  return (
    <Overlay onClose={onClose} title={title}>
      <div className="space-y-5">
        {groups
          .filter((group) => group.list.length)
          .map((group) => {
            const count = group.list.filter((vehicle) => picked.has(vehicle.id)).length;
            return (
              <div key={group.label}>
                <p className="flex items-center justify-between font-semibold text-[var(--foreground)]">
                  <span>{group.label}</span>
                  <span className="num text-[var(--muted)]">
                    {count} / {group.limit === null ? say("use_noLimit") : group.limit}
                  </span>
                </p>
                <ul className="mt-2 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                  {group.list.map((vehicle) => {
                    const on = picked.has(vehicle.id);
                    const full = !on && group.limit !== null && count >= group.limit;
                    return (
                      <li key={vehicle.id}>
                        <label className={`flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 ${full ? "opacity-50" : ""}`}>
                          <input checked={on} className="h-5 w-5" disabled={full} onChange={() => toggle(vehicle, group.limit)} type="checkbox" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-[var(--foreground)]">{vehicle.label}</span>
                            {vehicle.registration ? <span className="block text-sm text-[var(--muted)]">{vehicle.registration}</span> : null}
                          </span>
                          {vehicle.busy ? <Badge tone="blue">{say("kv_onRental")}</Badge> : null}
                          {!on ? <Badge tone="neutral">{say("kv_parked")}</Badge> : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        <button className="primary-action pressable w-full disabled:opacity-60" disabled={busy} onClick={() => onConfirm([...picked])} type="button">
          {busy ? say("pl_saving") : say("kv_confirm")}
        </button>
      </div>
    </Overlay>
  );
}

/** Whether moving to a plan means parking vehicles: cars or motorbikes over its limit. */
export function needsParking(vehicles: FleetVehicleRow[], limits: { cars: number | null; motorbikes: number | null }) {
  const motorbikes = vehicles.filter((vehicle) => vehicle.motorbike).length;
  const cars = vehicles.length - motorbikes;
  return (limits.cars !== null && cars > limits.cars) || (limits.motorbikes !== null && motorbikes > limits.motorbikes);
}
