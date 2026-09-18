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
        <span className="text-sm font-semibold text-[#344054]">Email</span>
        <input
          className="mt-1 w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      {state.error ? <p className="rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{state.error}</p> : null}
      {state.success ? <p className="rounded-lg bg-[#f0fdf4] px-3 py-2 text-sm font-semibold text-[#166534]">{state.success}</p> : null}
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 font-bold text-white disabled:opacity-60" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            Sending...
          </>
        ) : (
          "Send reset link"
        )}
      </button>
      <p className="text-center text-xs text-[#667085]">
        <a className="font-semibold text-[#0f766e]" href="/login">Back to sign in</a>
      </p>
    </form>
  );
}
