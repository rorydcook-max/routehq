"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { updateContractBrandingSettings } from "@/app/actions/settings";

/** When the last save finished: the page is drawn again after a save, which starts this button afresh. */
let savedAt = 0;
const SAVED_FOR_MS = 2500;

/**
 * The brand card's Save (build-s, 8 Nov 2026). The card's fields belong to the business details form (form="…"),
 * so the form's own pending button can't see this click: this sends that form itself and shows Saving… then Saved.
 */
export function BrandSaveButton({ form, label, pendingLabel, savedLabel, failedLabel }: { form: string; label: string; pendingLabel: string; savedLabel: string; failedLabel: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<"" | "saved" | "failed">(() => (Date.now() - savedAt < SAVED_FOR_MS ? "saved" : ""));

  useEffect(() => {
    if (state !== "saved") return;
    const timer = window.setTimeout(() => setState(""), Math.max(500, SAVED_FOR_MS - (Date.now() - savedAt)));
    return () => window.clearTimeout(timer);
  }, [state]);

  function save() {
    const element = document.getElementById(form);
    if (!(element instanceof HTMLFormElement) || !element.reportValidity()) return;
    setState("");
    start(async () => {
      try {
        // The action refreshes the page (and the app's colours) itself.
        await updateContractBrandingSettings(new FormData(element));
        savedAt = Date.now();
        setState("saved");
      } catch {
        setState("failed");
      }
    });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button className="primary-action pressable w-full sm:w-auto" disabled={pending} onClick={save} type="button">
        {pending ? <Loader2 className="animate-spin" size={18} /> : state === "saved" ? <Check size={18} /> : null}
        {pending ? pendingLabel : state === "saved" ? savedLabel : label}
      </button>
      {state === "failed" ? <span className="text-sm font-semibold text-[var(--danger)]">{failedLabel}</span> : null}
    </div>
  );
}
