import Link from "next/link";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function getAccountSummary(organizationId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const [vehicles, customers, rentals] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("rentals").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).is("deleted_at", null)
  ]);

  return {
    vehicles: vehicles.count || 0,
    customers: customers.count || 0,
    rentals: rentals.count || 0
  };
}

export default async function TrialExpiredPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const summary = await getAccountSummary(organization.id);
  const say = (await getTranslations("auth")) as unknown as (key: string) => string;
  const saved: Array<[string, number]> = [
    [say("trialVehicles"), summary.vehicles],
    [say("trialCustomers"), summary.customers],
    [say("trialRentals"), summary.rentals]
  ];

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-xl">
        <section className="card p-4">
          <h1 className="text-[26px] font-bold leading-tight text-[var(--foreground)]">{say("trialTitle")}</h1>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("trialBody")}</p>
          {/* What they would be keeping: the reason to carry on. Prices live on the plans page, in one place. */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {saved.map(([label, value]) => (
              <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5" key={label}>
                <p className="text-[22px] font-bold text-[var(--foreground)]">{value}</p>
                <p className="font-medium text-[var(--foreground-secondary)]">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            <Link className="primary-action pressable w-full" href={"/settings/billing" as Route}>
              {say("choosePlan")}
            </Link>
            {process.env.LINE_OA_ID ? (
              <a className="secondary-action pressable w-full" href={`https://line.me/R/ti/p/${encodeURIComponent(process.env.LINE_OA_ID)}`} rel="noreferrer" target="_blank">
                {say("moreTime")}
              </a>
            ) : null}
            <a className="secondary-action pressable w-full" href="/api/export/account">
              {say("exportData")}
            </a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
