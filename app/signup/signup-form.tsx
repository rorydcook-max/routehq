"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { signUpWithEmail, type AuthActionState } from "@/app/actions/auth";
import { authError, authInput, authLabel, authSuccess } from "@/components/auth-card";

const initialState: AuthActionState = {};

export function SignupForm() {
  const say = useTranslations("auth") as unknown as (key: string) => string;
  const [state, formAction, pending] = useActionState(signUpWithEmail, initialState);
  const [showPassword, setShowPassword] = useState(false);

  if (state.success) {
    return (
      <div className="space-y-4">
        <p className={authSuccess}>{state.success}</p>
        <p className="text-center font-medium text-[var(--foreground-secondary)]">
          {say("confirmed")}{" "}
          <a className="font-bold text-[var(--primary)]" href="/login">
            {say("signIn")}
          </a>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* What they are signing up for, before anything is asked of them. */}
      <p className="rounded-xl bg-[var(--success-light)] px-3.5 py-2.5 font-semibold text-[var(--success)]">{say("trialNote")}</p>
      <label className="block">
        <span className={authLabel}>{say("businessName")}</span>
        <input autoComplete="organization" className={authInput} maxLength={120} name="businessName" required type="text" />
      </label>
      <label className="block">
        <span className={authLabel}>{say("yourName")}</span>
        <input autoComplete="name" className={authInput} name="fullName" required type="text" />
      </label>
      <label className="block">
        <span className={authLabel}>{say("email")}</span>
        <input autoComplete="email" className={authInput} inputMode="email" name="email" required type="email" />
      </label>
      <div>
        <label className="block">
          <span className={authLabel}>{say("password")}</span>
          <span className="relative block">
            <input autoComplete="new-password" className={`${authInput} pr-20`} minLength={8} name="password" required type={showPassword ? "text" : "password"} />
            {/* On a phone a mistyped password is easy to miss: let people see what they typed. */}
            <button
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-1 my-auto h-10 rounded-full px-3 text-sm font-bold text-[var(--primary)]"
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              {showPassword ? say("hidePassword") : say("showPassword")}
            </button>
          </span>
        </label>
        <span className="mt-1 block font-medium text-[var(--foreground-secondary)]">{say("passwordHelp")}</span>
      </div>
      {state.error ? <p className={authError}>{state.error}</p> : null}
      <button className="primary-action w-full" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            {say("creating")}
          </>
        ) : (
          say("create")
        )}
      </button>
      <p className="text-center font-medium text-[var(--foreground-secondary)]">
        {say("haveAccount")}{" "}
        <a className="font-bold text-[var(--primary)]" href="/login">
          {say("signIn")}
        </a>
      </p>
    </form>
  );
}
