"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type PendingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingLabel?: string;
};

export function PendingButton({ children, className = "", pendingLabel, ...props }: PendingButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button {...props} className={`pressable ${className}`} disabled={pending || props.disabled}>
      {pending ? (
        <>
          <span aria-hidden="true" className="spinner" />
          {pendingLabel ? <span>{pendingLabel}</span> : null}
        </>
      ) : (
        children
      )}
    </button>
  );
}
