"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink } from "lucide-react";
import { savePublicBookingSettings } from "@/app/actions/online-booking";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * Switch for the public booking page, the link to share, the deposit online
 * bookings ask for, and how long a customer has to start their booking form.
 */
export function PublicBookingPanel({ slug, enabled, holdHours, deposit, offer = "both_monthly", pricedVehicles, totalVehicles }: { slug: string; enabled: boolean; holdHours: number; deposit: number; offer?: string; pricedVehicles: number; totalVehicles: number }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [hours, setHours] = useState(holdHours);
  const [offerValue, setOfferValue] = useState(offer);
  const [depositValue, setDepositValue] = useState(String(deposit || ""));
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/rent/${slug}`;

  function save(next: { enabled: boolean; holdHours: number; deposit?: number; offer?: string }) {
    setFailed(false);
    setOn(next.enabled);
    setHours(next.holdHours);
    startTransition(async () => {
      const result = await savePublicBookingSettings({ ...next, deposit: next.deposit ?? Number(depositValue || 0), offer: next.offer ?? offerValue }).catch(() => ({ ok: false as const }));
      if (!result.ok) {
        setFailed(true);
        setOn(enabled);
        setHours(holdHours);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input checked={on} className="mt-1 h-5 w-5 shrink-0" disabled={isPending} onChange={(event) => save({ enabled: event.target.checked, holdHours: hours })} type="checkbox" />
        <span>
          <span className="block text-[16px] font-bold text-[var(--foreground)]">{say("pb_title")}</span>
          <span className="mt-1 block font-medium text-[var(--foreground-secondary)]">{say("pb_body")}</span>
        </span>
      </label>

      {on ? (
        <>
          <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
            <p className="font-semibold text-[var(--muted)]">{say("pb_link")}</p>
            <p className="mt-0.5 break-all text-[16px] font-bold text-[var(--foreground)]">{link}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                className="secondary-action pressable"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(link)
                    .then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    })
                    .catch(() => null);
                }}
                type="button"
              >
                <Copy size={17} />
                {copied ? say("copied") : say("pb_copy")}
              </button>
              <a className="secondary-action pressable" href={`/rent/${slug}`} rel="noreferrer" target="_blank">
                <ExternalLink size={17} />
                {say("pb_open")}
              </a>
            </div>
          </div>

          <p className={pricedVehicles < totalVehicles ? "font-bold text-[var(--warning)]" : "font-medium text-[var(--foreground-secondary)]"}>{say("pb_shown", { priced: pricedVehicles, total: totalVehicles })}</p>

          <label className="block sm:max-w-md">
            <span className="font-semibold text-[var(--foreground)]">{say("pb_offer")}</span>
            <select
              className="mt-1 block w-full"
              disabled={isPending}
              onChange={(event) => {
                setOfferValue(event.target.value);
                save({ enabled: on, holdHours: hours, offer: event.target.value });
              }}
              value={offerValue}
            >
              {["both_monthly", "both_dates", "monthly", "dates"].map((value) => (
                <option key={value} value={value}>
                  {say(`pb_offer_${value}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:max-w-xs">
            <span className="font-semibold text-[var(--foreground)]">{say("pb_deposit")}</span>
            <input
              className="mt-1 block w-full"
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
            <span className="mt-1 block font-medium text-[var(--muted)]">{say("pb_depositHelp")}</span>
          </label>
        </>
      ) : null}
      {failed ? <p className="font-bold text-[var(--danger)]">{say("saveFailed")}</p> : null}
    </div>
  );
}
