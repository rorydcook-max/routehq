import type { Route } from "next";
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
  const supportLine = process.env.LINE_OA_ID || "";
  const supportWhatsApp = (process.env.SUPPORT_WHATSAPP || "").replace(/\D/g, "");
  const supportEmail = process.env.SUPPORT_EMAIL || "";
  const status = organization?.subscription_status || "trial";
  const currentTier = organization?.subscription_tier || "growth";

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5">
        <Link className="text-sm font-bold text-[var(--primary)]" href={"/settings?tab=more" as Route}>
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
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white p-3">
              <span className="text-sm font-bold text-[var(--foreground-secondary)]">Status</span>
              <Badge tone={status === "active" ? "green" : status === "trial" ? "blue" : "red"}>{status.replace(/_/g, " ")}</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-white p-3">
              <span className="text-sm font-bold text-[var(--foreground-secondary)]">Tier</span>
              <span className="font-semibold capitalize text-[var(--foreground)]">{currentTier}</span>
            </div>
            {status === "trial" ? (
              <div className="rounded-lg border border-[#b7e2dc] bg-[#e8faf7] p-3">
                <p className="text-sm font-semibold text-[var(--primary)]">Trial status</p>
                <p className="mt-1 text-sm text-[var(--foreground-secondary)]">{trialDays === null ? "Trial date not set" : `${trialDays} day${trialDays === 1 ? "" : "s"} remaining`}</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <SectionHeader eyebrow="Manual billing" title="Subscribe with local support" />
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Subscriptions are set up personally for now: pay by bank transfer or PromptPay and we switch your plan on, usually the same day. Card payments are coming soon.
          </p>
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-white p-4">
            <p className="font-semibold text-[var(--foreground)]">How to activate</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Send payment confirmation to LINE or WhatsApp and we will activate your account within 24 hours.</p>
            {/* Support channels come from the environment so no placeholder number or address ships. */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {supportLine ? (
                <a className="primary-action pressable flex-1" href={`https://line.me/R/ti/p/${encodeURIComponent(supportLine)}`} rel="noreferrer" target="_blank">
                  Contact on LINE
                </a>
              ) : null}
              {supportWhatsApp ? (
                <a className="secondary-action pressable flex-1" href={`https://wa.me/${supportWhatsApp}`} rel="noreferrer" target="_blank">
                  WhatsApp
                </a>
              ) : null}
              {supportEmail ? (
                <a className="secondary-action pressable flex-1" href={`mailto:${supportEmail}?subject=${encodeURIComponent("RouteHQ subscription")}`}>
                  Email
                </a>
              ) : null}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => (
          <Card className={tier.tier === currentTier ? "border-[var(--primary)] bg-[#fbfaf8]" : "bg-white"} key={tier.tier}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-[var(--foreground)]">{tier.name}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{tier.bestFor}</p>
              </div>
              {tier.tier === currentTier ? <Badge tone="green">Current</Badge> : null}
            </div>
            <p className="mt-4 text-3xl font-semibold text-[var(--primary)]">{tier.price}</p>
            <p className="text-xs font-semibold text-[var(--muted)]">per month</p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--foreground-secondary)]">
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
