"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { completeInvite, type AuthActionState } from "@/app/actions/auth";
import { authError, authInput, authLabel } from "@/components/auth-card";
import { supportedLocaleOptions } from "@/lib/i18n/locales";

const initialState: AuthActionState = {};

export function AcceptInviteForm() {
  const say = useTranslations("auth") as unknown as (key: string) => string;
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(completeInvite, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className={authLabel}>{say("createPassword")}</span>
        <input autoComplete="new-password" className={authInput} minLength={8} name="password" required type="password" />
        <span className="mt-1 block font-medium text-[var(--foreground-secondary)]">{say("passwordHelp")}</span>
      </label>
      <label className="block">
        <span className={authLabel}>{say("language")}</span>
        <select className={authInput} defaultValue={locale} name="preferredLocale">
          {supportedLocaleOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {state.error ? <p className={authError}>{state.error}</p> : null}
      <button className="primary-action w-full" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            {say("saving")}
          </>
        ) : (
          say("finishSetup")
        )}
      </button>
    </form>
  );
}
