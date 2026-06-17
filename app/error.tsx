"use client";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <AppShell>
      <Card>
        <p className="text-xs font-semibold uppercase text-[#be123c]">Data error</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#10252b]">Dashboard data could not load</h1>
        <p className="mt-2 text-sm text-[#667085]">{error.message}</p>
        <button className="mt-4 rounded-md bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white" onClick={reset}>
          Try again
        </button>
      </Card>
    </AppShell>
  );
}
