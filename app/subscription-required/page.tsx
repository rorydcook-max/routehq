import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";

export default async function SubscriptionRequiredPage() {
  const userEmail = await getCurrentUserEmail();

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl">
        <Card className="border-[var(--danger-line)] bg-[var(--danger-light)]">
          <p className="text-sm font-semibold uppercase text-[var(--danger)]">Subscription required</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">Reactivate your RouteHQ account</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            This account needs an active subscription before the workspace can be used again. Your data remains in place, and we can reactivate access after confirming payment.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link className="pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white" href={"/settings/billing" as Route}>
              View billing options
            </Link>
            {process.env.LINE_OA_ID ? (
              <a className="pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-semibold text-[var(--foreground-secondary)]" href={`https://line.me/R/ti/p/${encodeURIComponent(process.env.LINE_OA_ID)}`} rel="noreferrer" target="_blank">
                Contact RouteHQ on LINE
              </a>
            ) : null}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
