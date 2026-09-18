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
        <Card className="border-[#fecdd3] bg-[#fff7f8]">
          <p className="text-sm font-black uppercase text-[#be123c]">Subscription required</p>
          <h1 className="mt-2 text-3xl font-black text-[#10252b]">Reactivate your RouteHQ account</h1>
          <p className="mt-3 text-sm leading-6 text-[#667085]">
            This account needs an active subscription before the workspace can be used again. Your data remains in place, and we can reactivate access after confirming payment.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link className="pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-black text-white" href={"/settings/billing" as Route}>
              View billing options
            </Link>
            <a className="pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-[#d6e5e2] bg-white px-5 py-3 text-sm font-black text-[#344054]" href="https://line.me/R/ti/p/@fleetos" rel="noreferrer" target="_blank">
              Contact RouteHQ
            </a>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
