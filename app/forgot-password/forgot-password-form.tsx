"use client";

import { useEffect, useState, useActionState } from "react";
import { useTranslations } from "next-intl";
import { requestPasswordReset, type AuthActionState } from "@/app/actions/auth";
import { authError, authInput, authLabel, authSuccess } from "@/components/auth-card";

const initialState: AuthActionState = {};

export function ForgotPasswordForm({ defaultEmail = "", signedIn = false }: { defaultEmail?: string; signedIn?: boolean }) {
  const say = useTranslations("auth") as unknown as (key: string) => string;
  const [origin, setOrigin] = useState("");
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <form action={formAction} className="space-y-4">
      <input name="origin" type="hidden" value={origin} />
      <label className="block">
        <span className={authLabel}>{say("email")}</span>
        <input autoComplete="email" className={authInput} defaultValue={defaultEmail} inputMode="email" name="email" required type="email" />
      </label>
      {state.error ? <p className={authError}>{state.error}</p> : null}
      {state.success ? <p className={authSuccess}>{state.success}</p> : null}
      <button className="primary-action w-full" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            {say("sending")}
          </>
        ) : (
          say("sendLink")
        )}
      </button>
      <a className="secondary-action w-full" href={signedIn ? "/account" : "/login"}>
        {signedIn ? say("backToAccount") : say("backToSignIn")}
      </a>
    </form>
  );
}
