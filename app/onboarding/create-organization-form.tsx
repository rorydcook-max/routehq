"use client";

import { useActionState } from "react";
import { createMyOrganization, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export function CreateOrganizationForm({ defaultBusinessName }: { defaultBusinessName: string }) {
  const [state, formAction, pending] = useActionState(createMyOrganization, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-[#667085]">
        Create your business on RouteHQ. You can add your address, logo and contract details in the next steps.
      </p>
      <label className="block">
        <span className="text-sm font-semibold text-[#344054]">Business name</span>
        <input
          className="mt-1 w-full rounded-lg border border-[#d6e5e2] bg-white px-3 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
          defaultValue={defaultBusinessName}
          maxLength={120}
          name="businessName"
          required
          type="text"
        />
      </label>
      {state.error ? <p className="rounded-lg bg-[#ffe4e6] px-3 py-2 text-sm font-semibold text-[#be123c]">{state.error}</p> : null}
      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 font-bold text-white disabled:opacity-60"
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
