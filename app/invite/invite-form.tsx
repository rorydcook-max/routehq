"use client";

import { useActionState } from "react";
import { inviteUser, type AuthActionState } from "@/app/actions/auth";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { APP_ROLES } from "@/lib/auth/role-types";

const initialState: AuthActionState = {};

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteUser, initialState);

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
      <fieldset className="block">
        <legend className="text-sm font-semibold text-[var(--foreground-secondary)]">Role</legend>
        <div className="mt-1 space-y-2">
          {APP_ROLES.map((role) => (
            <label
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-white px-3 py-3 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[#fbfaf8]"
              key={role.value}
            >
              <input className="mt-1" defaultChecked={role.value === "teammate"} name="role" type="radio" value={role.value} />
              <span>
                <span className="block text-sm font-bold text-[var(--foreground)]">{role.label}</span>
                <span className="block text-xs text-[var(--muted)]">{role.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Default language</span>
        <select
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
          name="preferredLocale"
          defaultValue="th"
        >
          {supportedLocaleOptions.map((locale) => (
            <option key={locale.code} value={locale.code}>
              {locale.label}
            </option>
          ))}
        </select>
      </label>
      {state.error ? <p className="rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-[#dcfce7] px-3 py-2 text-sm font-semibold text-[#166534]">{state.success}</p> : null}
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-bold text-white disabled:opacity-60" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            Sending invite...
          </>
        ) : (
          "Send invite"
        )}
      </button>
    </form>
  );
}
