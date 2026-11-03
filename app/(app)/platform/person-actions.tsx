"use client";

import { useActionState, useState } from "react";
import { adminChangeEmail, adminRemoveMember, adminSendPasswordReset, type PersonActionState } from "@/app/actions/admin";
import { PendingButton } from "@/components/pending-button";

/**
 * What a RoveHQ admin can do for one person: send a password reset link, change their sign-in email, take them
 * out of a business. Used on the Users page and in a business's Team table. Every action is checked and logged
 * on the server.
 */
export function PersonActions({
  userId,
  email,
  memberships,
  contextOrganizationId
}: {
  userId: string;
  email: string | null;
  /** Businesses they are active in; each gets a "Remove from …" button. */
  memberships: Array<{ organizationId: string; name: string; role: string }>;
  /** The business page this is shown on, so the log line lands on that business too. */
  contextOrganizationId?: string;
}) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[14px] font-bold text-[var(--primary)] hover:underline">Manage</summary>
      <div className="mt-3 grid min-w-[260px] max-w-[420px] gap-4 rounded-2xl bg-[var(--panel-secondary)] p-4">
        <ResetPassword contextOrganizationId={contextOrganizationId} email={email} userId={userId} />
        <ChangeEmail contextOrganizationId={contextOrganizationId} userId={userId} />
        {memberships.map((membership) => (
          <RemoveMember key={membership.organizationId} name={membership.name} organizationId={membership.organizationId} role={membership.role} userId={userId} />
        ))}
      </div>
    </details>
  );
}

function Result({ state }: { state: PersonActionState }) {
  if (state.error) return <p className="mt-2 text-[14px] font-semibold text-[var(--danger)]" role="alert">{state.error}</p>;
  if (state.ok) return <p className="mt-2 text-[14px] font-semibold text-[var(--success)]" role="status">{state.ok}</p>;
  return null;
}

function ResetPassword({ userId, email, contextOrganizationId }: { userId: string; email: string | null; contextOrganizationId?: string }) {
  const [state, action] = useActionState(adminSendPasswordReset, {} as PersonActionState);
  const [copied, setCopied] = useState(false);
  return (
    <form action={action}>
      <input name="userId" type="hidden" value={userId} />
      {contextOrganizationId ? <input name="organizationId" type="hidden" value={contextOrganizationId} /> : null}
      <p className="text-[14px] font-bold text-[var(--foreground)]">Password</p>
      <p className="measure text-[13px] font-medium text-[var(--foreground-secondary)]">Sends {email || "them"} a link to choose a new password. You never see their password.</p>
      <PendingButton className="secondary-action pressable mt-2" pendingLabel="Sending…" type="submit">
        Send password reset
      </PendingButton>
      {state.link ? (
        <div className="mt-2 rounded-xl bg-[var(--warning-light)] p-3">
          <p className="text-[14px] font-semibold text-[var(--foreground)]">{state.ok}</p>
          <p className="mt-1 text-[13px] font-medium text-[var(--foreground-secondary)]">
            Anyone with this link can sign in as them, so send it only to {email || "them"}, privately. It works once and stops working after a short while.
          </p>
          <div className="mt-2 flex gap-2">
            <input aria-label="Password reset link" className="min-w-0 flex-1 text-[13px]" onFocus={(event) => event.currentTarget.select()} readOnly value={state.link} />
            <button
              className="secondary-action pressable shrink-0"
              onClick={() => {
                navigator.clipboard?.writeText(state.link || "").then(() => setCopied(true), () => setCopied(false));
              }}
              type="button"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : (
        <Result state={state} />
      )}
    </form>
  );
}

function ChangeEmail({ userId, contextOrganizationId }: { userId: string; contextOrganizationId?: string }) {
  const [state, action] = useActionState(adminChangeEmail, {} as PersonActionState);
  return (
    <form action={action} className="border-t border-[var(--border)] pt-4">
      <input name="userId" type="hidden" value={userId} />
      {contextOrganizationId ? <input name="organizationId" type="hidden" value={contextOrganizationId} /> : null}
      <p className="text-[14px] font-bold text-[var(--foreground)]">Change sign-in email</p>
      <label className="!mb-0 mt-2 block text-[14px]">
        New email
        <input autoComplete="off" className="mt-1 w-full" name="email" required type="email" />
      </label>
      <label className="!mb-0 mt-2 block text-[14px]">
        New email again
        <input autoComplete="off" className="mt-1 w-full" name="confirmEmail" required type="email" />
      </label>
      <PendingButton className="secondary-action pressable mt-2" pendingLabel="Saving…" type="submit">
        Change email
      </PendingButton>
      <Result state={state} />
    </form>
  );
}

function RemoveMember({ userId, organizationId, name, role }: { userId: string; organizationId: string; name: string; role: string }) {
  const [state, action] = useActionState(adminRemoveMember, {} as PersonActionState);
  return (
    <form
      action={action}
      className="border-t border-[var(--border)] pt-4"
      onSubmit={(event) => {
        if (!window.confirm(`Remove them from ${name}? Their account stays; they just lose access to this business.`)) event.preventDefault();
      }}
    >
      <input name="userId" type="hidden" value={userId} />
      <input name="organizationId" type="hidden" value={organizationId} />
      <p className="text-[14px] font-bold text-[var(--foreground)]">
        {name} <span className="font-medium capitalize text-[var(--muted)]">· {role}</span>
      </p>
      <PendingButton className="secondary-action pressable mt-2 !text-[var(--danger)]" pendingLabel="Removing…" type="submit">
        Remove from {name}
      </PendingButton>
      <Result state={state} />
    </form>
  );
}
