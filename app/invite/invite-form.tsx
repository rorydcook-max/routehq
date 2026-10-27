"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { inviteUser, type AuthActionState } from "@/app/actions/auth";
import { operatorLocaleOptions } from "@/lib/i18n/locales";
import { APP_ROLES } from "@/lib/auth/role-types";

const initialState: AuthActionState = {};
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

export function InviteForm() {
  const say = useTranslations("settingsPage") as unknown as (key: string) => string;
  const [state, formAction, pending] = useActionState(inviteUser, initialState);
  // Kept in state so a failed invite doesn't wipe the address (the form resets plain fields after
  // every submit); it is only cleared once the invite has gone.
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (state.success) setEmail("");
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className={labelClass}>{say("iv_email")}</span>
        <input autoComplete="email" className="mt-1 w-full" name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
      </label>
      <fieldset className="block">
        <legend className={labelClass}>{say("iv_role")}</legend>
        <div className="mt-1.5 space-y-2">
          {APP_ROLES.map((role) => (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5 has-[:checked]:bg-[var(--primary-light)] has-[:checked]:ring-2 has-[:checked]:ring-[var(--primary)]" key={role.value}>
              <input className="mt-0.5 h-5 w-5 shrink-0" defaultChecked={role.value === "teammate"} name="role" type="radio" value={role.value} />
              <span>
                <span className="block font-bold text-[var(--foreground)]">{say(`iv_${role.value}`)}</span>
                <span className="mt-0.5 block font-medium text-[var(--foreground-secondary)]">{say(`iv_${role.value}Body`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className={labelClass}>{say("iv_language")}</span>
        <select className="mt-1 w-full" defaultValue="th" name="preferredLocale">
          {operatorLocaleOptions.map((locale) => (
            <option key={locale.code} value={locale.code}>
              {locale.label}
            </option>
          ))}
        </select>
      </label>
      {state.error ? <p className="rounded-xl bg-[var(--danger-light)] px-4 py-3 font-bold text-[var(--danger)]">{state.error}</p> : null}
      {state.success ? <p className="rounded-xl bg-[var(--success-light)] px-4 py-3 font-bold text-[var(--success)]">{state.success}</p> : null}
      <button className="primary-action w-full" disabled={pending}>
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            {say("iv_sending")}
          </>
        ) : (
          say("iv_send")
        )}
      </button>
    </form>
  );
}
