"use client";

import { useActionState } from "react";
import { inviteUser, type AuthActionState } from "@/app/actions/auth";
import { supportedLocaleOptions } from "@/lib/i18n/locales";

const initialState: AuthActionState = {};

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteUser, initialState);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <form action={formAction} className="space-y-4">
      <input name="origin" type="hidden" value={origin} />
      <label className="block">
        <span className="text-sm font-semibold text-[#344054]">Email</span>
        <input
          className="mt-1 w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-[#344054]">Default language</span>
        <select
          className="mt-1 w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
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
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 font-bold text-white disabled:opacity-60" disabled={pending}>
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
