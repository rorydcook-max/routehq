"use client";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";

/**
 * Shown when a page or a form save fails. In production Next.js replaces the
 * real error text with a generic sentence, so that sentence is swapped for
 * plain advice and the reference code people can quote to support.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const generic = !error.message || /Server Components render|digest property|omitted in production/i.test(error.message);
  return (
    <AppShell>
      <Card>
        <p className="text-xs font-semibold uppercase text-[var(--danger)]">Something went wrong</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--foreground)]">That didn&apos;t work</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {generic
            ? "This page couldn't load or your last change couldn't be saved. Check the details and try again; if it keeps happening, send us the reference below."
            : error.message}
        </p>
        {error.digest ? <p className="mt-2 font-mono text-xs text-[var(--muted)]">Reference: {error.digest}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" onClick={reset} type="button">
            Try again
          </button>
          <button className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground-secondary)]" onClick={() => window.history.back()} type="button">
            Go back
          </button>
        </div>
      </Card>
    </AppShell>
  );
}
