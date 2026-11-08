"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useActionFormError } from "@/components/action-form";

type PendingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingLabel?: string;
  /**
   * Shown for a moment once the save finishes, so the person knows it worked.
   * Only for forms whose action throws or redirects on failure: a form that
   * returns its own error message must not also say "Saved".
   */
  savedLabel?: string;
};

export function PendingButton({ children, className = "", pendingLabel, savedLabel, ...props }: PendingButtonProps) {
  const { pending } = useFormStatus();
  // Inside an ActionForm: the reason the save failed, if it did (then no "Saved").
  const failure = useActionFormError();
  const wasPending = useRef(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current || !savedLabel) return;
    wasPending.current = false;
    if (failure) return;
    setJustSaved(true);
    const timer = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [pending, savedLabel, failure]);

  return (
    <button {...props} className={`pressable ${className}`} disabled={pending || props.disabled}>
      {pending ? (
        <>
          <span aria-hidden="true" className="spinner" />
          {pendingLabel ? <span>{pendingLabel}</span> : null}
        </>
      ) : justSaved ? (
        <span aria-live="polite">✓ {savedLabel}</span>
      ) : (
        children
      )}
    </button>
  );
}
