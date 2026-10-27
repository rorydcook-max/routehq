"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { savePartnerNetwork } from "@/app/actions/partners";
import { SwitchField } from "@/components/switch-field";
type PartnerNetworkSettings = { enabled: boolean; reach: "town" | "region" | "country"; blocked: string[] };

type Say = (key: string, values?: Record<string, string | number>) => string;

/** On or off, and how far to look. Saves on change, like the other switches. */
export function PartnerNetworkPanel({ initial, pct }: { initial: PartnerNetworkSettings; pct: number }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [enabled, setEnabled] = useState(initial.enabled);
  const [reach, setReach] = useState(initial.reach);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(next: { enabled: boolean; reach: string }) {
    setFailed(false);
    startTransition(async () => {
      const result = await savePartnerNetwork({ ...next, blocked: initial.blocked }).catch(() => ({ ok: false as const }));
      if (!result.ok) {
        setFailed(true);
        setEnabled(initial.enabled);
        setReach(initial.reach);
      }
    });
  }

  return (
    <div>
      <SwitchField
        checked={enabled}
        description={say("pn_body", { pct })}
        disabled={isPending}
        label={say("pn_switch")}
        onChange={(event) => {
          setEnabled(event.target.checked);
          save({ enabled: event.target.checked, reach });
        }}
      />
      {enabled ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="font-semibold text-[var(--foreground-secondary)]">{say("pn_reach")}</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-[15px] text-[var(--foreground)] sm:max-w-sm"
              disabled={isPending}
              onChange={(event) => {
                setReach(event.target.value as PartnerNetworkSettings["reach"]);
                save({ enabled, reach: event.target.value });
              }}
              value={reach}
            >
              <option value="town">{say("pn_reachTown")}</option>
              <option value="region">{say("pn_reachRegion")}</option>
              <option value="country">{say("pn_reachCountry")}</option>
            </select>
          </label>
          <p className="text-sm text-[var(--muted)]">{say("pn_fee", { pct })}</p>
          <Link className="inline-flex font-bold text-[var(--primary)]" href="/partners">
            {say("pn_open")}
          </Link>
        </div>
      ) : null}
      {failed ? <p className="mt-2 font-bold text-[var(--danger)]">{say("saveFailed")}</p> : null}
    </div>
  );
}
