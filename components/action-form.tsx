"use client";

import { createContext, useContext, useRef, useState, type FormHTMLAttributes, type ReactNode } from "react";
import { isActionFailure } from "@/lib/action-result";

type ActionFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (formData: FormData) => Promise<unknown>;
  children: ReactNode;
};

/** The reason the last save failed ("" when it worked), so a Save button doesn't also say "Saved". */
const ActionFormError = createContext("");
export function useActionFormError() {
  return useContext(ActionFormError);
}

/**
 * A form whose server action may hand back `{ actionError }` (lib/action-error.ts `guard`): the reason is shown
 * above the buttons and everything typed stays in place, instead of a "Something went wrong" page.
 */
export function ActionForm({ action, children, ...props }: ActionFormProps) {
  const [error, setError] = useState("");
  const failed = useRef(false);
  return (
    <form
      {...props}
      action={async (formData) => {
        failed.current = false;
        setError("");
        const result = await action(formData);
        if (isActionFailure(result)) {
          failed.current = true;
          setError(result.actionError);
        }
      }}
      onReset={(event) => {
        // React clears a form after its action; keep what was typed when the save failed.
        if (failed.current) event.preventDefault();
      }}
    >
      {error ? (
        <p
          className="rounded-xl border border-[var(--danger-line)] bg-[var(--danger-light)] px-3.5 py-2.5 font-semibold text-[var(--danger)] sm:col-span-2"
          ref={(element) => element?.scrollIntoView({ behavior: "smooth", block: "center" })}
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <ActionFormError.Provider value={error}>{children}</ActionFormError.Provider>
    </form>
  );
}
