"use client";

import { useActionState } from "react";
import { signUpWithEmail, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

const inputClass =
  "mt-1 w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpWithEmail, initialState);

  if (state.success) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-[#ecfdf5] px-3 py-3 text-sm font-semibold text-[#047857]">{state.success}</p>
        <p className="text-center text-sm text-[#667085]">
          Already confirmed?{" "}
          <a className="font-semibold text-[#0f766e]" href="/login">
            Sign in
          </a>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold text-[#344054]">Business name</span>
        <input className={inputClass} name="businessName" type="text" autoComplete="organization" maxLength={120} required />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-[#344054]">Your name</span>
        <input className={inputClass} name="fullName" type="text" autoComplete="name" required />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-[#344054]">Email</span>
        <input className={inputClass} name="email" type="email" autoComplete="email" required />
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-[#344054]">Password</span>
        <input className={inputClass} name="password" type="password" autoComplete="new-password" minLength={8} required />
        <span className="mt-1 block text-xs text-[#667085]">At least 8 characters.</span>
      </label>
      {state.error ? <p className="rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{state.error}</p> : null}
      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 font-bold text-white disabled:opacity-60"
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
      <p className="text-center text-sm text-[#667085]">
        Already have an account?{" "}
        <a className="font-semibold text-[#0f766e]" href="/login">
          Sign in
        </a>
      </p>
    </form>
  );
}
