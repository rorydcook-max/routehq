"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveCustomerMessages } from "@/app/actions/online-booking";

/** One switch for the messages RouteHQ sends customers on the business's behalf. Saves on change. */
export function CustomerMessagesPanel({ enabled, hasChannel }: { enabled: boolean; hasChannel: boolean }) {
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
      {failed ? <p className="mt-2 font-bold text-[var(--danger)]">{say("saveFailed")}</p> : null}
    </div>
  );
}
