import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const tiers = [
  { tier: "starter", name: "Starter", price: "฿590", bestFor: "1-5 vehicles", features: ["Fleet records", "Compliance reminders", "Basic reporting"] },
  { tier: "growth", name: "Growth", price: "฿990", bestFor: "Most operators", features: ["Bookings", "Customer records", "Documents", "Setup support"] },
  { tier: "pro", name: "Pro", price: "฿2,490", bestFor: "Growing teams", features: ["Advanced reports", "Automation-ready workflows", "Multiple branches"] },
  { tier: "business", name: "Business", price: "฿4,990", bestFor: "Larger fleets", features: ["Priority support", "Team onboarding", "Custom setup"] }
];

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default async function BillingPage() {
  const [userEmail, baseOrganization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: organization } = await supabase
    .from("organizations")
    .select("subscription_status, subscription_tier, trial_started_at, trial_ends_at, subscription_started_at, next_payment_due, payment_method")
    .eq("id", baseOrganization.id)
    .is("deleted_at", null)
    .maybeSingle();

  const trialDays = daysUntil(organization?.trial_ends_at);
  const status = organization?.subscription_status || "trial";
  const currentTier = organization?.subscription_tier || "growth";

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5">
        <Link className="text-sm font-bold text-[var(--primary)]" href="/settings">
          Back to settings
        </Link>
        <p className="page-eyebrow mt-4">Billing</p>
        <h1 className="page-title">Plan and subscription</h1>
        <p className="page-subtitle mt-2">Review trial status, plan tiers, and local subscription options.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <SectionHeader eyebrow="Current plan" title={baseOrganization.name} />
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-[#d6e5e2] bg-white p-3">
              <span className="text-sm font-bold text-[#344054]">Status</span>
              <Badge tone={status === "active" ? "green" : status === "trial" ? "blue" : "red"}>{status.replace(/_/g, " ")}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#d6e5e2] bg-white p-3">
              <span className="text-sm font-bold text-[#344054]">Tier</span>
              <span className="font-black capitalize text-[#10252b]">{currentTier}</span>
            </div>
            {status === "trial" ? (
              <div className="rounded-lg border border-[#b7e2dc] bg-[#e8faf7] p-3">
                <p className="text-sm font-black text-[#0f766e]">Trial status</p>
                <p className="mt-1 text-sm text-[#344054]">{trialDays === null ? "Trial date not set" : `${trialDays} day${trialDays === 1 ? "" : "s"} remaining`}</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <SectionHeader eyebrow="Manual billing" title="Subscribe with local support" />
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            Automated billing is coming soon. For v1, we currently process subscriptions manually, which works well for Thai operators using bank transfer, PromptPay, LINE, and WhatsApp.
          </p>
          <div className="mt-4 rounded-lg border border-[#d6e5e2] bg-white p-4">
            <p className="font-black text-[#10252b]">How to activate</p>
            <p className="mt-2 text-sm text-[#667085]">Send payment confirmation to LINE or WhatsApp and we will activate your account within 24 hours.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a className="primary-action pressable flex-1" href="https://line.me/R/ti/p/@fleetos" rel="noreferrer" target="_blank">
                Contact on LINE
              </a>
              <a className="secondary-action pressable flex-1" href="https://wa.me/66900000000" rel="noreferrer" target="_blank">
                WhatsApp
              </a>
              <a className="secondary-action pressable flex-1" href="mailto:billing@fleetos.app">
                Email
              </a>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => (
          <Card className={tier.tier === currentTier ? "border-[#0f766e] bg-[#f0fdfa]" : "bg-white"} key={tier.tier}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-[#10252b]">{tier.name}</p>
                <p className="mt-1 text-xs font-semibold text-[#667085]">{tier.bestFor}</p>
              </div>
              {tier.tier === currentTier ? <Badge tone="green">Current</Badge> : null}
            </div>
            <p className="mt-4 text-3xl font-black text-[#0f766e]">{tier.price}</p>
            <p className="text-xs font-semibold text-[#667085]">per month</p>
            <ul className="mt-4 space-y-2 text-sm text-[#344054]">
              {tier.features.map((feature) => (
                <li key={feature}>- {feature}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
