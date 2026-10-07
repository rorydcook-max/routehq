"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { inviteUser, removeTeammate, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

/** For the owner, beside each other person: send the invite again if they have not joined yet, or take them off the team. */
export function TeamMemberActions({ memberId, email, role, waiting }: { memberId: string; email: string | null; role: "owner" | "teammate"; waiting: boolean }) {
  const say = useTranslations("settingsPage") as unknown as (key: string) => string;
  const locale = useLocale();
  const router = useRouter();
  const [state, resend, sending] = useActionState(inviteUser, initialState);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState("");
  const [removing, startRemove] = useTransition();

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
