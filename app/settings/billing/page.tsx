import type { Route } from "next";
import { Check } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { planById, planForFleet, vehiclesOverLimit } from "@/lib/plans";
import { supportContacts } from "@/lib/support";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlanCards } from "./plan-cards";

type Say = (key: string, values?: Record<string, string | number>) => string;

// What every plan includes: the product, sold properly. Each key is an inc_* line.
const INCLUDED = [
  "bookings",
  "links",
  "forms",
  "payments",
  "extras",
  "seasons",
  "reminders",
  "inbox",
  "calendar",
  "reports",
  "online",
  "directory",
  "brand",
  "partners",
  "calculator",
  "languages",
  "phone"
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
  const [{ data: organization }, { count: vehicleCount }] = await Promise.all([
    supabase
      .from("organizations")
      .select("subscription_status, subscription_tier, trial_started_at, trial_ends_at, subscription_started_at, next_payment_due, payment_method")
      .eq("id", baseOrganization.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", baseOrganization.id).is("deleted_at", null)
  ]);

  const trialDays = daysUntil(organization?.trial_ends_at);
  const contacts = supportContacts();
  const status = String(organization?.subscription_status || "trial");
  const plan = planById(organization?.subscription_tier);
  const vehicles = Number(vehicleCount || 0);
  const over = vehiclesOverLimit(plan, vehicles, status);
  const suggested = planForFleet(vehicles);
  const statusName = t.has(`bl_st_${status}` as never) ? say(`bl_st_${status}`) : status.replace(/_/g, " ");

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-4">
        <Link className="font-bold text-[var(--primary)]" href={"/settings?tab=more" as Route}>
          {say("backToSettings")}
        </Link>
        <h1 className="page-title mt-2">{say("bl_title")}</h1>
        <p className="page-subtitle mt-2">{say("pl_subtitle")}</p>
      </div>

      <section className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-[var(--muted)]">{say("bl_current")}</p>
            <p className="text-[22px] font-bold leading-tight text-[var(--foreground)]">{say(`bl_${plan.id}`)}</p>
            <p className="mt-1 font-medium text-[var(--foreground-secondary)]">
              {plan.vehicles === null ? say("pl_fleetNoLimit", { count: vehicles }) : say("pl_fleetOf", { count: vehicles, limit: plan.vehicles })}
            </p>
          </div>
          <Badge tone={status === "active" ? "green" : status === "trial" ? "blue" : "red"}>{statusName}</Badge>
        </div>
        {status === "trial" ? (
          <p className="mt-3 text-[17px] font-bold text-[var(--foreground)]">
            {trialDays === null ? say("bl_trialNoDate") : say("bl_trialLeft", { days: trialDays })}
            <span className="block text-sm font-medium text-[var(--foreground-secondary)]">{say("pl_trialAll", { plan: say(`bl_${suggested.id}`) })}</span>
          </p>
        ) : null}
        {over > 0 ? (
          <p className="mt-3 rounded-xl bg-[var(--warning-light)] px-4 py-3 font-medium text-[var(--foreground)]">
            {say("pl_over", { count: over, plan: say(`bl_${suggested.id}`) })}
          </p>
        ) : null}
      </section>

      <section className="card mt-3 p-4">
        <h2 className="text-[20px] font-bold text-[var(--foreground)]">{say("pl_everyTitle")}</h2>
        <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("pl_everyBody")}</p>
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {INCLUDED.map((key) => (
            <li className="flex items-start gap-2 font-medium text-[var(--foreground)]" key={key}>
              <Check className="mt-1 shrink-0 text-[var(--success)]" size={16} />
              <span>{say(`inc_${key}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="card mt-3 p-4">
        <PlanCards currentTier={plan.id} vehicles={vehicles} />
      </div>

      <section className="card mt-3 p-4">
        <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("bl_howTitle")}</h2>
        <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("bl_howBody")}</p>
        {/* Support channels come from the environment so no placeholder number or address ships. */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link className="primary-action pressable" href={"/help?topic=billing" as Route}>
            {say("bl_help")}
          </Link>
          {contacts.lineUrl ? (
            <a className="secondary-action pressable" href={contacts.lineUrl} rel="noreferrer" target="_blank">
              {say("bl_line")}
            </a>
          ) : null}
          {contacts.whatsappUrl ? (
            <a className="secondary-action pressable" href={contacts.whatsappUrl} rel="noreferrer" target="_blank">
              {say("bl_whatsapp")}
            </a>
          ) : null}
          {contacts.email ? (
            <a className="secondary-action pressable" href={`mailto:${contacts.email}?subject=${encodeURIComponent("RouteHQ subscription")}`}>
              {say("bl_email")}
            </a>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
