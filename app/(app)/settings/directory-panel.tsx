"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveDirectoryListing } from "@/app/actions/partners";
import { SwitchField } from "@/components/switch-field";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * Listing on the RoveHQ booking site (rovehq.app/rent): on by default, in every plan.
 * Needs the online booking page on.
 */
export function DirectoryPanel({ enabled, allowed, bookingPageOn }: { enabled: boolean; allowed: boolean; bookingPageOn: boolean }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [on, setOn] = useState(enabled);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const usable = allowed && bookingPageOn;

  function change(next: boolean) {
    setOn(next);
    setFailed(false);
    startTransition(async () => {
      const result = await saveDirectoryListing({ enabled: next }).catch(() => ({ ok: false as const }));
      if (!result.ok) {
        setFailed(true);
        setOn(!next);
      }
    });
  }

  return (
    <div>
      <SwitchField
        checked={on && usable}
        className={usable ? "" : "opacity-70"}
        description={say("dir_body")}
        disabled={isPending || !usable}
        label={say("dir_switch")}
        onChange={(event) => change(event.target.checked)}
      />
      {!bookingPageOn ? <p className="mt-2 text-sm font-semibold text-[var(--warning)]">{say("dir_needsBookingPage")}</p> : null}
      {on && usable ? (
        <a className="mt-2 inline-flex text-sm font-bold text-[var(--primary)]" href="/rent" rel="noreferrer" target="_blank">
          {say("dir_open")}
        </a>
      ) : null}
      {failed ? <p className="mt-2 font-bold text-[var(--danger)]">{say("saveFailed")}</p> : null}
    </div>
  );
}
