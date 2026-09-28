"use client";

import { useActionState } from "react";
import { signInWithEmail, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithEmail, initialState);

  return (
    <form action={formAction} className="space-y-4">
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
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Password</span>
        <input
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <a className="mt-1 inline-block text-xs font-semibold text-[var(--primary)]" href="/forgot-password">
          Forgot password?
        </a>
      </label>
      {state.error ? <p className="rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{state.error}</p> : null}
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-bold text-white disabled:opacity-60" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </button>
      <p className="text-center text-sm text-[var(--muted)]">
        New to RouteHQ?{" "}
        <a className="font-semibold text-[var(--primary)]" href="/signup">
          Create an account
        </a>
      </p>
    </form>
  );
}
