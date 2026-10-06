"use client";

import { useEffect, useState, useActionState } from "react";
import { requestPasswordReset, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export function ForgotPasswordForm() {
  const [origin, setOrigin] = useState("");
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <form action={formAction} className="space-y-4">
      <input name="origin" type="hidden" value={origin} />
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Email</span>
        <input
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      {state.error ? <p className="rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-[var(--success-light)] px-3 py-2 text-sm font-semibold text-[var(--success)]">{state.success}</p> : null}
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-bold text-white disabled:opacity-60" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            Sending...
          </>
        ) : (
          "Send reset link"
        )}
      </button>
      <p className="text-center text-xs text-[var(--muted)]">
        <a className="font-semibold text-[var(--primary)]" href="/login">Back to sign in</a>
      </p>
    </form>
  );
}
