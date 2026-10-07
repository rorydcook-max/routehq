"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";

/**
 * Shown when a page or a form save fails. In production Next.js replaces the
 * real error text with a generic sentence, so that sentence is swapped for
 * plain advice and the reference code people can quote to support.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPages");
  const generic = !error.message || /Server Components render|digest property|omitted in production/i.test(error.message);
  return (
    <AppShell>
      <Card>
        <p className="text-xs font-semibold uppercase text-[var(--danger)]">{t("eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{t("title")}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {generic
            ? t("generic")
            : error.message}
        </p>
        {error.digest ? <p className="mt-2 font-mono text-xs text-[var(--muted)]">{t("reference", { code: error.digest })}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" onClick={reset} type="button">
            {t("tryAgain")}
          </button>
          <button className="rounded-md border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground-secondary)]" onClick={() => window.history.back()} type="button">
            {t("goBack")}
          </button>
        </div>
      </Card>
    </AppShell>
  );
}
