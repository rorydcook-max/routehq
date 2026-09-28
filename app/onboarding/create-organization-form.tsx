"use client";

import { useActionState } from "react";
import { createMyOrganization, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export function CreateOrganizationForm({ defaultBusinessName }: { defaultBusinessName: string }) {
  const [state, formAction, pending] = useActionState(createMyOrganization, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Create your business on RouteHQ. You can add your address, logo and contract details in the next steps.
      </p>
      <label className="block">
        <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Business name</span>
        <input
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
          defaultValue={defaultBusinessName}
          maxLength={120}
          name="businessName"
          required
          type="text"
        />
      </label>
      {state.error ? <p className="rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{state.error}</p> : null}
      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-3 font-bold text-white disabled:opacity-60"
        disabled={pending}
      >
        {pending ? (
          <>
            <span aria-hidden="true" className="spinner" />
            Setting up...
          </>
        ) : (
          "Create business"
        )}
      </button>
    </form>
  );
}
