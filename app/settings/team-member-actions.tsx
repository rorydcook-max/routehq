"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { inviteUser, removeTeammate, setTeamLevel, type AuthActionState } from "@/app/actions/auth";
import type { AppRole } from "@/lib/auth/role-types";

const initialState: AuthActionState = {};

/** For the owner, beside each other person: send the invite again if they have not joined yet, or take them off the team. */
export function TeamMemberActions({ memberId, email, role, waiting }: { memberId: string; email: string | null; role: AppRole; waiting: boolean }) {
  const say = useTranslations("settingsPage") as unknown as (key: string) => string;
  const locale = useLocale();
  const router = useRouter();
  const [state, resend, sending] = useActionState(inviteUser, initialState);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState("");
  const [removing, startRemove] = useTransition();
  const [level, setLevel] = useState<AppRole>(role);
  const [saving, startSave] = useTransition();

  function changeLevel(next: AppRole) {
    setLevel(next);
    setError("");
    startSave(async () => {
      const data = new FormData();
      data.set("memberId", memberId);
      data.set("role", next);
      const result = await setTeamLevel(data);
      if (result.error) {
        setError(result.error);
        setLevel(role);
      } else router.refresh();
    });
  }

  function remove() {
    startRemove(async () => {
      const data = new FormData();
      data.set("memberId", memberId);
      const result = await removeTeammate(data);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="w-full">
      {role !== "owner" ? (
        <label className="mb-2 block">
          <span className="font-semibold text-[var(--foreground-secondary)]">{say("team_level")}</span>
          <select className="mt-1 w-full" disabled={saving} onChange={(event) => changeLevel(event.target.value as AppRole)} value={level}>
            <option value="manager">{say("iv_manager")}</option>
            <option value="teammate">{say("iv_teammate")}</option>
          </select>
          <span className="mt-1 block text-sm font-medium text-[var(--foreground-secondary)]">{say(level === "manager" ? "iv_managerBody" : "iv_teammateBody")}</span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {waiting && email ? (
          <form action={resend}>
            <input name="email" type="hidden" value={email} />
            <input name="role" type="hidden" value={role} />
            <input name="preferredLocale" type="hidden" value={locale} />
            <button className="secondary-action pressable px-3 py-2 text-sm" disabled={sending}>
              {sending ? say("team_sending") : say("team_resend")}
            </button>
          </form>
        ) : null}
        {sure ? (
          <>
            <button className="pressable rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]" disabled={removing} onClick={remove} type="button">
              {say("team_removeSure")}
            </button>
            <button className="px-2 py-2 text-sm font-semibold text-[var(--muted)]" onClick={() => setSure(false)} type="button">
              {say("team_keep")}
            </button>
          </>
        ) : (
          <button className="px-2 py-2 text-sm font-semibold text-[var(--muted)] underline" onClick={() => setSure(true)} type="button">
            {say("team_remove")}
          </button>
        )}
      </div>
      {state.success ? <p className="mt-2 text-sm font-semibold text-[var(--success)]">{state.success}</p> : null}
      {state.error || error ? <p className="mt-2 text-sm font-semibold text-[var(--danger)]">{state.error || error}</p> : null}
    </div>
  );
}
