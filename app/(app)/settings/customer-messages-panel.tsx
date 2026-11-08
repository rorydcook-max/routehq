"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveCustomerMessages, saveReminderKinds } from "@/app/actions/online-booking";
import { SwitchField } from "@/components/switch-field";
import { InfoTip } from "@/components/info-tip";

const KINDS = ["handover", "return", "rent_due", "rent_late", "vehicle_due", "signature", "review"];

/** One switch for the messages RoveHQ sends customers on the business's behalf. Saves on change. */
export function CustomerMessagesPanel({ enabled, hasChannel, emailOn = false, off: initialOff = [] }: { enabled: boolean; hasChannel: boolean; emailOn?: boolean; off?: string[] }) {
  const [off, setOff] = useState<string[]>(initialOff);
  function toggle(kind: string, on: boolean) {
    const next = on ? off.filter((item) => item !== kind) : [...off, kind];
    setOff(next);
    setFailed(false);
    startTransition(async () => {
      const result = await saveReminderKinds(next).catch(() => ({ ok: false as const }));
      if (!result.ok) {
        setFailed(true);
        setOff(off);
      }
    });
  }
  const say = useTranslations("settingsPage") as unknown as (key: string) => string;
  const [on, setOn] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function change(next: boolean) {
    setOn(next);
    setFailed(false);
    startTransition(async () => {
      const result = await saveCustomerMessages(next).catch(() => ({ ok: false as const }));
      if (!result.ok) {
        setFailed(true);
        setOn(!next);
        return;
      }
    });
  }

  return (
    <div>
      <SwitchField checked={on} disabled={isPending} label={<>{say("cm_title")} <InfoTip label={say("cm_title")} text={say("cm_bodyTip")} /></>} onChange={(event) => change(event.target.checked)} />
      {/* Lined up with the switch's label and description, with the way to fix it right there. */}
      {on && !hasChannel ? (
        <div className="mt-3 rounded-2xl bg-[var(--warning-light)] px-4 py-3 sm:ms-[54px]">
          <p className="measure font-medium text-[var(--foreground)]">{say(emailOn ? "cm_noChannelEmail" : "cm_noChannel")}</p>
          <a className="secondary-action pressable mt-3" href="#chat-accounts">
            {say("cm_connect")}
          </a>
        </div>
      ) : null}
      {on ? (
        <div className="mt-4 rounded-2xl bg-[var(--panel-secondary)] p-3.5 sm:ms-[54px]">
          <p className="card-subtitle flex items-center gap-1.5">
            {say("rem_title")}
            {hasChannel ? <InfoTip label={say("rem_title")} text={say("cm_firstMessage")} /> : null}
          </p>
          <div className="mt-2 grid gap-x-6 gap-y-1 lg:grid-cols-2">
            {KINDS.map((kind) => (
              <label className="flex min-h-10 cursor-pointer items-center gap-3 text-[15px] font-medium text-[var(--foreground)]" key={kind}>
                <input checked={!off.includes(kind)} className="h-5 w-5 shrink-0" disabled={isPending} onChange={(event) => toggle(kind, event.target.checked)} type="checkbox" />
                {say(`rem_${kind}`)}
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {failed ? <p className="mt-2 font-bold text-[var(--danger)]">{say("saveFailed")}</p> : null}
    </div>
  );
}
