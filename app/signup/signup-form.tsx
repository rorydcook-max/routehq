"use client";

import { useActionState } from "react";
import { signUpWithEmail, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpWithEmail, initialState);

  if (state.success) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-[var(--success-light)] px-3 py-3 text-sm font-semibold text-[var(--success)]">{state.success}</p>
        <p className="text-center text-sm text-[var(--muted)]">
          Already confirmed?{" "}
          <a className="font-semibold text-[var(--primary)]" href="/login">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Business name</span>
        <input className={inputClass} name="businessName" type="text" autoComplete="organization" maxLength={120} required />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Your name</span>
        <input className={inputClass} name="fullName" type="text" autoComplete="name" required />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Email</span>
        <input className={inputClass} name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Password</span>
        <input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={8} required />
        <span className="mt-1 block text-xs text-[var(--muted)]">At least 8 characters.</span>
      </label>
      {state.error ? <p className="rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{state.error}</p> : null}
      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-bold text-white disabled:opacity-60"
        disabled={pending}
      >
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            Creating account...
          </>
        ) : (
          "Create account"
        )}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        Already have an account?{" "}
        <a className="font-semibold text-[var(--primary)]" href="/login">
          Sign in
        </a>
      </p>
    </form>
  );
}
