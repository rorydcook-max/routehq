"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { savePublicBookingSettings } from "@/app/actions/online-booking";

/**
 * Switch for the public booking page, the link to share, the deposit online
 * bookings ask for, and how long a customer has to start their booking form.
 */
export function PublicBookingPanel({ slug, enabled, holdHours, deposit, pricedVehicles, totalVehicles }: { slug: string; enabled: boolean; holdHours: number; deposit: number; pricedVehicles: number; totalVehicles: number }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [hours, setHours] = useState(holdHours);
  const [depositValue, setDepositValue] = useState(String(deposit || ""));
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/rent/${slug}`;

  function save(next: { enabled: boolean; holdHours: number; deposit?: number }) {
    setMessage(null);
    setOn(next.enabled);
    setHours(next.holdHours);
    startTransition(async () => {
      const result = await savePublicBookingSettings({ ...next, deposit: next.deposit ?? Number(depositValue || 0) }).catch(() => ({ ok: false as const, error: "Couldn't save. Please try again." }));
      if (!result.ok) {
        setMessage(result.error);
        setOn(enabled);
        setHours(holdHours);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input checked={on} className="mt-1 h-4 w-4" disabled={isPending} onChange={(event) => save({ enabled: event.target.checked, holdHours: hours })} type="checkbox" />
        <span>
          <span className="block text-sm font-semibold text-[var(--foreground)]">Let customers book online</span>
          <span className="block text-xs leading-5 text-[var(--muted)]">
            Anyone with your link sees your vehicles, prices and which dates are free, and can book one at the listed price. The vehicle is held for them while they fill in their details and sign, and booked once they have. You don&apos;t need to approve anything.
          </span>
        </span>
      </label>

      {on ? (
        <>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-3">
            <p className="text-xs font-semibold text-[var(--foreground-secondary)]">Your booking page</p>
            <p className="mt-1 break-all text-sm font-semibold text-[var(--foreground)]">{link}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                className="secondary-action pressable min-h-9 gap-1.5 px-3 text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(link).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }).catch(() => null);
                }}
                type="button"
              >
                <Copy size={14} />
                {copied ? "Copied" : "Copy link"}
              </button>
              <a className="secondary-action pressable min-h-9 gap-1.5 px-3 text-xs" href={`/rent/${slug}`} rel="noreferrer" target="_blank">
                <ExternalLink size={14} />
                Open
              </a>
            </div>
          </div>

          <p className={`text-xs leading-5 ${pricedVehicles < totalVehicles ? "font-semibold text-[var(--warning)]" : "text-[var(--muted)]"}`}>
            {pricedVehicles} of {totalVehicles} vehicles are shown. A vehicle appears once it has a daily, weekly or monthly price.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[var(--foreground-secondary)]">
              Deposit for online bookings (฿)
              <input
                className="mt-1 block h-10 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm"
                disabled={isPending}
                inputMode="numeric"
                min="0"
                onBlur={() => {
                  if (Number(depositValue || 0) !== deposit) save({ enabled: on, holdHours: hours, deposit: Number(depositValue || 0) });
                }}
                onChange={(event) => setDepositValue(event.target.value)}
                placeholder="0"
                type="number"
                value={depositValue}
              />
              <span className="mt-1 block font-normal text-[var(--muted)]">Shown on the page and added to the booking. Leave empty for no deposit.</span>
            </label>
          </div>
        </>
      ) : null}
      {message ? <p className="text-xs font-semibold text-[var(--danger)]">{message}</p> : null}
    </div>
  );
}
