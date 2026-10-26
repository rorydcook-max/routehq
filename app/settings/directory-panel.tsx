"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { saveDirectoryListing } from "@/app/actions/partners";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * Listing on the RouteHQ booking site (routehq.app/rent): on by default, in every plan.
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
      <label className={`flex min-h-11 items-start gap-3 ${usable ? "cursor-pointer" : "opacity-70"}`}>
        <input checked={on && usable} className="mt-1 h-5 w-5 shrink-0" disabled={isPending || !usable} onChange={(event) => change(event.target.checked)} type="checkbox" />
        <span>
          <span className="block text-[16px] font-bold text-[var(--foreground)]">{say("dir_switch")}</span>
          <span className="mt-1 block font-medium text-[var(--foreground-secondary)]">{say("dir_body")}</span>
        </span>
      </label>
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
