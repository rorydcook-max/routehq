"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signInWithEmail, type AuthActionState } from "@/app/actions/auth";
import { authError, authInput, authLabel } from "@/components/auth-card";

const initialState: AuthActionState = {};

export function LoginForm() {
  const say = useTranslations("auth") as unknown as (key: string) => string;
  const [state, formAction, pending] = useActionState(signInWithEmail, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className={authLabel}>{say("email")}</span>
        <input autoComplete="email" className={authInput} inputMode="email" name="email" required type="email" />
      </label>
      <label className="block">
        <span className={authLabel}>{say("password")}</span>
        <input autoComplete="current-password" className={authInput} name="password" required type="password" />
      </label>
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
      <a className="secondary-action w-full" href="/forgot-password">
        {say("forgot")}
      </a>
      <p className="text-center font-medium text-[var(--foreground-secondary)]">
        {say("newHere")}{" "}
        <a className="font-bold text-[var(--primary)]" href="/signup">
          {say("createAccount")}
        </a>
      </p>
    </form>
  );
}
