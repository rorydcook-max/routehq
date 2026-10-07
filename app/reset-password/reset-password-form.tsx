"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { completeInvite, type AuthActionState } from "@/app/actions/auth";
import { authError, authInput, authLabel } from "@/components/auth-card";

const initialState: AuthActionState = {};

export function ResetPasswordForm() {
  const say = useTranslations("auth") as unknown as (key: string) => string;
  const [state, formAction, pending] = useActionState(completeInvite, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className={authLabel}>{say("newPassword")}</span>
        <input autoComplete="new-password" className={authInput} minLength={8} name="password" required type="password" />
        <span className="mt-1 block font-medium text-[var(--foreground-secondary)]">{say("passwordHelp")}</span>
      </label>
      {/* No language field here: choosing a new password used to switch the person's language back to English. */}
      {state.error ? <p className={authError}>{state.error}</p> : null}
      <button className="primary-action w-full" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            {say("saving")}
          </>
        ) : (
          say("saveNewPassword")
        )}
      </button>
    </form>
  );
}
