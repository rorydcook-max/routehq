import Link from "next/link";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";

export default async function SubscriptionRequiredPage() {
  const userEmail = await getCurrentUserEmail();
  const say = (await getTranslations("auth")) as unknown as (key: string) => string;

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-xl">
        <section className="card p-4">
          <h1 className="text-[26px] font-bold leading-tight text-[var(--foreground)]">{say("subTitle")}</h1>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("subBody")}</p>
          <div className="mt-4 grid gap-2">
            <Link className="primary-action pressable w-full" href={"/settings/billing" as Route}>
              {say("seePlans")}
            </Link>
            {process.env.LINE_OA_ID ? (
              <a className="secondary-action pressable w-full" href={`https://line.me/R/ti/p/${encodeURIComponent(process.env.LINE_OA_ID)}`} rel="noreferrer" target="_blank">
                {say("lineUs")}
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
