"use client";

import { useActionState } from "react";
import { completeInvite, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(completeInvite, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-[#344054]">New password</span>
        <input
          className="mt-1 w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <input name="preferredLocale" type="hidden" value="en" />
      {state.error ? <p className="rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{state.error}</p> : null}
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 font-bold text-white disabled:opacity-60" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            Saving...
          </>
        ) : (
          "Set new password"
        )}
      </button>
    </form>
  );
}
