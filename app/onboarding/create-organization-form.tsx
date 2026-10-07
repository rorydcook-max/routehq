"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createMyOrganization, type AuthActionState } from "@/app/actions/auth";
import { authError, authInput, authLabel } from "@/components/auth-card";

const initialState: AuthActionState = {};

export function CreateOrganizationForm({ defaultBusinessName }: { defaultBusinessName: string }) {
  const say = useTranslations("auth") as unknown as (key: string) => string;
  const [state, formAction, pending] = useActionState(createMyOrganization, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className={authLabel}>{say("businessName")}</span>
        <input className={authInput} defaultValue={defaultBusinessName} maxLength={120} minLength={2} name="businessName" required type="text" />
      </label>
      {state.error ? <p className={authError}>{state.error}</p> : null}
      <button className="primary-action w-full" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            {say("settingUp")}
          </>
        ) : (
          say("createBusiness")
        )}
      </button>
    </form>
  );
}
