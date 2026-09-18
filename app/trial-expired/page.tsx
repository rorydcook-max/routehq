import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const tiers = [
  { name: "Starter", price: "฿590", note: "Small fleets getting organized" },
  { name: "Growth", price: "฿990", note: "Most rental operators" },
  { name: "Pro", price: "฿2,490", note: "Automation and reporting" },
  { name: "Business", price: "฿4,990", note: "Larger teams and branches" }
];

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

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-4xl">
        <Card className="border-[#fecdd3] bg-[#fff7f8]">
          <p className="text-sm font-black uppercase text-[#be123c]">Trial ended</p>
          <h1 className="mt-2 text-3xl font-black text-[#10252b]">Your trial has ended</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#667085]">
            Your RouteHQ data is safe. Subscribe to continue managing your vehicles, customers, rentals, reminders, and documents.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Vehicles", summary.vehicles],
              ["Customers", summary.customers],
              ["Rentals", summary.rentals]
            ].map(([label, value]) => (
              <div className="rounded-lg border border-white bg-white/80 p-4 shadow-sm" key={String(label)}>
                <p className="text-xs font-bold uppercase text-[#667085]">{label}</p>
                <p className="mt-1 text-3xl font-black text-[#10252b]">{value}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="mt-4 grid gap-4 md:grid-cols-4">
          {tiers.map((tier) => (
            <Card className="bg-white" key={tier.name}>
              <p className="font-black text-[#10252b]">{tier.name}</p>
              <p className="mt-2 text-2xl font-black text-[#0f766e]">{tier.price}</p>
              <p className="mt-1 text-xs font-semibold text-[#667085]">per month</p>
              <p className="mt-3 text-sm text-[#667085]">{tier.note}</p>
            </Card>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link className="pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-black text-white" href={"/settings/billing" as Route}>
            Subscribe to continue
          </Link>
          <a className="pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-[#d6e5e2] bg-white px-5 py-3 text-sm font-black text-[#344054]" href="/api/export/account">
            Export my data
          </a>
          <a className="pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-[#d6e5e2] bg-white px-5 py-3 text-sm font-black text-[#344054]" href="https://line.me/R/ti/p/@fleetos" rel="noreferrer" target="_blank">
            Need more time? Contact us
          </a>
        </div>
      </div>
    </AppShell>
  );
}
