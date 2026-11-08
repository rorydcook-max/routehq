"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { saveDirectoryListing } from "@/app/actions/partners";
import { legalUrl } from "@/lib/site/legal-slugs";

/**
 * Asked once, when a new business has its first vehicle (build-p, 8 Nov 2026): list the fleet on rove.rent? Listing
 * is opt-in (migration 0140). Yes turns it on (the same setting as Settings › Listing on rove.rent); Not now leaves
 * it off. Either answer, or closing it, means it isn't asked again.
 */
export function RoveListingPrompt() {
  const say = useTranslations("roveListing");
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const yesRef = useRef<HTMLButtonElement>(null);

  function answer(enabled: boolean | null) {
    setFailed(false);
    start(async () => {
      const result = await saveDirectoryListing({ enabled }).catch(() => ({ ok: false as const }));
      if (!result.ok && enabled) {
        setFailed(true);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  useEffect(() => {
    if (!open) return;
    yesRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) answer(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pending]);

  if (!open) return null;
  return (
    <div aria-labelledby="rove-listing-title" aria-modal="true" className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(10,20,25,0.55)] p-0 sm:items-center sm:p-6" role="dialog">
      <div className="w-full max-w-md rounded-t-[28px] bg-[var(--panel)] p-6 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px] sm:pb-6">
        <p className="text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--primary)]">rove.rent</p>
        <h2 className="mt-1 text-[22px] font-bold leading-tight text-[var(--foreground)] [text-wrap:balance]" id="rove-listing-title">
          {say("title")}
        </h2>
        <a className="mt-2 inline-flex text-sm font-semibold text-[var(--primary)] underline" href={legalUrl("terms")} rel="noopener noreferrer" target="_blank">
          {say("terms")}
        </a>
        {failed ? <p className="mt-3 font-bold text-[var(--danger)]">{say("failed")}</p> : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="secondary-action pressable whitespace-nowrap" disabled={pending} onClick={() => answer(null)} type="button">
            {say("notNow")}
          </button>
          <button className="primary-action pressable whitespace-nowrap" disabled={pending} onClick={() => answer(true)} ref={yesRef} type="button">
            {say("yes")}
          </button>
        </div>
      </div>
    </div>
  );
}
