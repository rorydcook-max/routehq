"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveCustomerMessages, saveReminderKinds } from "@/app/actions/online-booking";

const KINDS = ["handover", "return", "rent_due", "rent_late", "vehicle_due", "signature"];

/** One switch for the messages RouteHQ sends customers on the business's behalf. Saves on change. */
export function CustomerMessagesPanel({ enabled, hasChannel, off: initialOff = [] }: { enabled: boolean; hasChannel: boolean; off?: string[] }) {
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
  const router = useRouter();
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
      router.refresh();
    });
  }

  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input checked={on} className="mt-1 h-5 w-5 shrink-0" disabled={isPending} onChange={(event) => change(event.target.checked)} type="checkbox" />
        <span>
          <span className="block text-[16px] font-bold text-[var(--foreground)]">{say("cm_title")}</span>
          <span className="mt-1 block font-medium text-[var(--foreground-secondary)]">{say("cm_body")}</span>
        </span>
      </label>
      {on && !hasChannel ? <p className="mt-3 rounded-xl bg-[var(--warning-light)] px-4 py-3 font-medium text-[var(--foreground)]">{say("cm_noChannel")}</p> : null}
      {on && hasChannel ? <p className="mt-3 font-medium text-[var(--foreground-secondary)]">{say("cm_firstMessage")}</p> : null}
      {on ? (
        <div className="mt-4 rounded-xl border border-[var(--border)] p-3">
          <p className="font-bold text-[var(--foreground)]">{say("rem_title")}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{say("rem_body")}</p>
          <div className="mt-2 grid gap-1">
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
