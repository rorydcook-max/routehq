"use client";

import { useActionState } from "react";
import { completeInvite, type AuthActionState } from "@/app/actions/auth";
import { supportedLocaleOptions } from "@/lib/i18n/locales";

const initialState: AuthActionState = {};

export function AcceptInviteForm() {
  const [state, formAction, pending] = useActionState(completeInvite, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Create password</span>
        <input
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Preferred language</span>
        <select
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
          name="preferredLocale"
          defaultValue="en"
        >
          {supportedLocaleOptions.map((locale) => (
            <option key={locale.code} value={locale.code}>
              {locale.label}
            </option>
          ))}
        </select>
      </label>
      {state.error ? <p className="rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{state.error}</p> : null}
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-bold text-white disabled:opacity-60" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            Saving...
          </>
        ) : (
          "Finish setup"
        )}
      </button>
    </form>
  );
}
