"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { savePartnerNetwork } from "@/app/actions/partners";
import { SwitchField } from "@/components/switch-field";
import { InfoTip } from "@/components/info-tip";
type PartnerNetworkSettings = { enabled: boolean; reach: "town" | "region" | "country"; blocked: string[] };

type Say = (key: string, values?: Record<string, string | number>) => string;

/** "Share my fleet with the partner network": the same switch as on the Partner network page. Saves on change. */
export function PartnerNetworkPanel({ initial, pct, canEdit = true }: { initial: PartnerNetworkSettings; pct: number; canEdit?: boolean }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [enabled, setEnabled] = useState(initial.enabled);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(next: boolean) {
    setFailed(false);
    startTransition(async () => {
      const result = await savePartnerNetwork({ enabled: next, blocked: initial.blocked }).catch(() => ({ ok: false as const }));
      if (!result.ok) {
        setFailed(true);
        setEnabled(initial.enabled);
      }
    });
  }

  return (
    <div>
      <SwitchField
        checked={enabled}
        disabled={isPending || !canEdit}
        label={
          <>
            {say("pn_share")} <InfoTip label={say("pn_share")} text={say("pn_shareBody", { pct })} />
          </>
        }
        onChange={(event) => {
          setEnabled(event.target.checked);
          save(event.target.checked);
        }}
      />
      <Link className="mt-3 inline-flex font-bold text-[var(--primary)]" href="/partners">
        {say("pn_open")}
      </Link>
      {failed ? <p className="mt-2 font-bold text-[var(--danger)]">{say("saveFailed")}</p> : null}
    </div>
  );
}
