import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Say = (key: string, values?: Record<string, string | number>) => string;

// Names and prices; what each plan is for and includes is in "settingsPage" (bl_<tier>…).
const tiers = [
  { tier: "starter", price: 590, features: 3 },
  { tier: "growth", price: 990, features: 4 },
  { tier: "pro", price: 2490, features: 3 },
  { tier: "business", price: 4990, features: 3 }
];

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export default async function BillingPage() {
  const [userEmail, baseOrganization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const t = await getTranslations("settingsPage");
  const say = t as unknown as Say;
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
  const status = String(organization?.subscription_status || "trial");
  const currentTier = String(organization?.subscription_tier || "growth");
  const statusName = t.has(`bl_st_${status}` as never) ? say(`bl_st_${status}`) : status.replace(/_/g, " ");
  const tierName = t.has(`bl_${currentTier}` as never) ? say(`bl_${currentTier}`) : currentTier;

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-4">
        <Link className="font-bold text-[var(--primary)]" href={"/settings?tab=more" as Route}>
          {say("backToSettings")}
        </Link>
        <h1 className="page-title mt-2">{say("bl_title")}</h1>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        <section className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--muted)]">{say("bl_current")}</p>
              <p className="text-[22px] font-bold leading-tight text-[var(--foreground)]">{tierName}</p>
            </div>
            <Badge tone={status === "active" ? "green" : status === "trial" ? "blue" : "red"}>{statusName}</Badge>
          </div>
          {status === "trial" ? <p className="mt-2 text-[17px] font-bold text-[var(--foreground)]">{trialDays === null ? say("bl_trialNoDate") : say("bl_trialLeft", { days: trialDays })}</p> : null}
        </section>

        <section className="card p-4">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("bl_howTitle")}</h2>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("bl_howBody")}</p>
          {/* Support channels come from the environment so no placeholder number or address ships. */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {supportLine ? (
              <a className="primary-action pressable" href={`https://line.me/R/ti/p/${encodeURIComponent(supportLine)}`} rel="noreferrer" target="_blank">
                {say("bl_line")}
              </a>
            ) : null}
            {supportWhatsApp ? (
              <a className="secondary-action pressable" href={`https://wa.me/${supportWhatsApp}`} rel="noreferrer" target="_blank">
                {say("bl_whatsapp")}
              </a>
            ) : null}
            {supportEmail ? (
              <a className="secondary-action pressable" href={`mailto:${supportEmail}?subject=${encodeURIComponent("RouteHQ subscription")}`}>
                {say("bl_email")}
              </a>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => (
          <section className="card p-4" key={tier.tier} style={tier.tier === currentTier ? { boxShadow: "inset 0 0 0 2px var(--primary)" } : undefined}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-bold leading-tight text-[var(--foreground)]">{say(`bl_${tier.tier}`)}</p>
                <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{say(`bl_${tier.tier}For`)}</p>
              </div>
              {tier.tier === currentTier ? <Badge tone="blue">{say("bl_currentBadge")}</Badge> : null}
            </div>
            <p className="mt-3 text-[28px] font-bold leading-none text-[var(--foreground)]">
              {"฿"}
              {tier.price.toLocaleString("en-US")}
            </p>
            <p className="mt-1 font-medium text-[var(--muted)]">{say("bl_perMonth")}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 font-medium text-[var(--foreground)]">
              {Array.from({ length: tier.features }, (_, index) => (
                <li key={index}>{say(`bl_${tier.tier}${index + 1}`)}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
