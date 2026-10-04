"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { savePublicBookingSettings } from "@/app/actions/booking-requests";

/**
 * Switch for the public booking page, the link to share, and how long a
 * request keeps a vehicle off the page while the business decides.
 */
export function PublicBookingPanel({ slug, enabled, holdHours, pricedVehicles, totalVehicles }: { slug: string; enabled: boolean; holdHours: number; pricedVehicles: number; totalVehicles: number }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [hours, setHours] = useState(holdHours);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/rent/${slug}`;

  function save(next: { enabled: boolean; holdHours: number }) {
    setMessage(null);
    setOn(next.enabled);
    setHours(next.holdHours);
    startTransition(async () => {
      const result = await savePublicBookingSettings(next).catch(() => ({ ok: false as const, error: "Couldn't save. Please try again." }));
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
          <span className="block text-sm font-semibold text-[var(--foreground)]">Let customers request a vehicle online</span>
          <span className="block text-xs leading-5 text-[var(--muted)]">
            Anyone with your link sees your vehicles, prices and which dates are free, and can send a request. Nothing is booked until you accept it.
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

          <label className="block text-xs font-semibold text-[var(--foreground-secondary)]">
            Hold a requested vehicle for
            <select className="mt-1 block h-10 rounded-lg border border-[var(--border-strong)] bg-white px-3 text-sm" disabled={isPending} onChange={(event) => save({ enabled: on, holdHours: Number(event.target.value) })} value={hours}>
              {[6, 12, 24, 48, 72].map((value) => (
                <option key={value} value={value}>{value} hours</option>
              ))}
            </select>
            <span className="mt-1 block font-normal text-[var(--muted)]">While you decide, those dates show as taken to other people.</span>
          </label>
        </>
      ) : null}
      {message ? <p className="text-xs font-semibold text-[var(--danger)]">{message}</p> : null}
    </div>
  );
}
