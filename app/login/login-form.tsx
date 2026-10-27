"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { signInWithEmail, type AuthActionState } from "@/app/actions/auth";
import { authError, authInput, authLabel, authStack } from "@/components/auth-card";

const initialState: AuthActionState = {};

export function LoginForm() {
  const say = useTranslations("auth") as unknown as (key: string) => string;
  const [state, formAction, pending] = useActionState(signInWithEmail, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className={authStack}>
      <label className="block">
        <span className={authLabel}>{say("email")}</span>
        <input autoComplete="email" className={authInput} inputMode="email" name="email" required type="email" />
      </label>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label className={authLabel} htmlFor="login-password">
            {say("password")}
          </label>
          {/* A quiet link, so it never competes with Sign in. */}
          <a className="text-sm font-semibold text-[var(--primary)] hover:underline" href="/forgot-password">
            {say("forgot")}
          </a>
        </div>
        <span className="relative block">
          <input autoComplete="current-password" className={`${authInput} pr-20`} id="login-password" name="password" required type={showPassword ? "text" : "password"} />
          <button
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-1 my-auto h-10 rounded-full px-3 text-sm font-bold text-[var(--primary)]"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? say("hidePassword") : say("showPassword")}
          </button>
        </span>
      </div>
      {state.error ? <p className={authError}>{state.error}</p> : null}
      <button className="primary-action w-full" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            {say("signingIn")}
          </>
        ) : (
          say("signIn")
        )}
      </button>
      <p className="text-center font-medium text-[var(--foreground-secondary)]">
        {say("newHere")}{" "}
        <a className="font-bold text-[var(--primary)]" href="/signup">
          {say("createAccount")}
        </a>
      </p>
    </form>
  );
}
