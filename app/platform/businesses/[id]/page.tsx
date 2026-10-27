import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { adminExtendTrial, adminSetFounding, adminSetPlan } from "@/app/actions/admin";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { ACTION_LABEL, ADMIN_STATUS_LABEL, ADMIN_TIER_LABEL, adminDate, daysFromNow, listAuthUsers, requirePlatformAdmin } from "@/lib/admin";
import { planById } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { StatusPill } from "../../admin-nav";

export const dynamic = "force-dynamic";

const NOTICE: Record<string, { text: string; good: boolean }> = {
  plan: { text: "Plan saved.", good: true },
  trial: { text: "Trial end moved.", good: true },
  founding: { text: "Founding price updated.", good: true },
  error: { text: "That didn't save. Check the values and try again.", good: false }
};

/** One business, from RouteHQ's side: its plan and trial, its team, its size, and everything admins did to it. */
export default async function AdminBusinessPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  await requirePlatformAdmin();
  const [{ id }, { done }, userEmail] = await Promise.all([params, searchParams, getCurrentUserEmail()]);
  const db = createSupabaseAdminClient() as any;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  const [{ data: org }, { data: members }, { count: vehicleCount }, { count: bookingsThisMonth }, { data: log }, authUsers] = await Promise.all([
    db.from("organizations").select("*").eq("id", id).maybeSingle(),
    db.from("organization_members").select("user_id, role, display_name, invited_email, is_active, created_at").eq("organization_id", id).order("created_at"),
    db.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", id).is("deleted_at", null),
    db.from("rentals").select("id", { count: "exact", head: true }).eq("organization_id", id).gte("created_at", monthStart.toISOString().slice(0, 10)),
    db.from("admin_audit_log").select("id, action, details, created_at").eq("organization_id", id).order("created_at", { ascending: false }).limit(30),
    listAuthUsers()
  ]);
  if (!org) notFound();
  const tier = org.subscription_tier === "growth" ? "pro" : org.subscription_tier || "free";
  const status = org.subscription_status || "trial";
  const plan = planById(tier);
  const left = daysFromNow(org.trial_ends_at);
  const notice = done ? NOTICE[done] : null;
  const people = ((members || []) as any[]).map((m) => ({ ...m, auth: authUsers.get(m.user_id) }));

  return (
    <AppShell userEmail={userEmail}>
      <BackLink href="/platform/businesses" label="Businesses" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--primary)]">RouteHQ admin</p>
          <h1 className="page-title mt-1 flex flex-wrap items-center gap-3">
            {org.name}
            <StatusPill status={status} />
          </h1>
          <p className="mt-1.5 font-medium text-[var(--foreground-secondary)]">
            {ADMIN_TIER_LABEL[tier]} plan · {vehicleCount || 0} vehicles · {org.currency || "THB"} · joined {adminDate(org.created_at)}
            {org.deleted_at ? <span className="font-bold text-[var(--danger)]"> · deleted {adminDate(org.deleted_at)}</span> : null}
          </p>
        </div>
        {org.slug ? (
          <a className="secondary-action pressable" href={`/rent/${org.slug}`} rel="noreferrer" target="_blank">
            Open their booking page
          </a>
        ) : null}
      </header>

      {notice ? (
        <p className={`mb-5 rounded-2xl px-4 py-3 font-semibold ${notice.good ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--danger-light)] text-[var(--danger)]"}`} role="status">
          {notice.text}
        </p>
      ) : null}

      {org.pending_plan ? (
        <section className="card mb-5 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="card-title">Waiting for payment: {ADMIN_TIER_LABEL[org.pending_plan] || org.pending_plan}</h2>
            <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">
              Asked {adminDate(org.plan_requested_at)} · {org.pending_interval === "yearly" ? "yearly" : "monthly"}
              {org.pending_amount ? ` · ${org.pending_currency || "THB"} ${Number(org.pending_amount).toLocaleString("en-GB")}` : ""}
            </p>
          </div>
          {org.plan_request_thread_id ? (
            <Link className="primary-action pressable" href={`/help/team/${org.plan_request_thread_id}` as Route}>
              Open the request
            </Link>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="card-title">Plan and billing</h2>
          <p className="mt-0.5 text-[14px] font-medium text-[var(--muted)]">
            {status === "active" ? `Next payment ${adminDate(org.next_payment_due)}` : status === "trial" ? `Trial ends ${adminDate(org.trial_ends_at)}` : ADMIN_STATUS_LABEL[status] || status}
            {org.founding_member ? " · founding price (half)" : ""}
          </p>
          <form action={adminSetPlan} className="mt-4 grid gap-3 sm:grid-cols-3">
            <input name="organizationId" type="hidden" value={id} />
            <label className="!mb-0">
              Plan
              <select className="mt-1 w-full" defaultValue={tier} name="tier">
                {["free", "starter", "pro", "business"].map((value) => (
                  <option key={value} value={value}>
                    {ADMIN_TIER_LABEL[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="!mb-0">
              Billing
              <select className="mt-1 w-full" defaultValue={org.billing_interval === "yearly" ? "yearly" : "monthly"} name="interval">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
            <label className="!mb-0">
              Status
              <select className="mt-1 w-full" defaultValue={status} name="status">
                {Object.entries(ADMIN_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-3">
              <PendingButton className="primary-action pressable" pendingLabel="Saving…" type="submit">
                Save plan
              </PendingButton>
            </div>
          </form>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--border)] pt-4 text-[14px]">
            <dt className="font-medium text-[var(--muted)]">Cars included</dt>
            <dd className="text-right font-semibold">{plan.cars ?? "No limit"}</dd>
            <dt className="font-medium text-[var(--muted)]">Motorbikes included</dt>
            <dd className="text-right font-semibold">{plan.motorbikes ?? "No limit"}</dd>
            <dt className="font-medium text-[var(--muted)]">Team accounts</dt>
            <dd className="text-right font-semibold">{plan.team ?? "No limit"}</dd>
            <dt className="font-medium text-[var(--muted)]">List price</dt>
            <dd className="text-right font-semibold">฿{plan.monthly.toLocaleString("en-GB")} a month</dd>
          </dl>
        </section>

        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="card-title">Free trial</h2>
            <p className="mt-0.5 text-[14px] font-medium text-[var(--muted)]">
              {org.trial_ends_at ? `Ends ${adminDate(org.trial_ends_at)}${left !== null ? (left < 0 ? " · ended" : ` · ${left} days left`) : ""}` : "No trial date set"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[7, 14, 30].map((days) => (
                <form action={adminExtendTrial} key={days}>
                  <input name="organizationId" type="hidden" value={id} />
                  <input name="days" type="hidden" value={days} />
                  <PendingButton className="secondary-action pressable" pendingLabel="…" type="submit">
                    +{days} days
                  </PendingButton>
                </form>
              ))}
            </div>
            <form action={adminExtendTrial} className="mt-3 flex flex-wrap items-end gap-2">
              <input name="organizationId" type="hidden" value={id} />
              <label className="!mb-0">
                Or end it on
                <input className="mt-1" defaultValue={org.trial_ends_at ? String(org.trial_ends_at).slice(0, 10) : ""} name="date" required type="date" />
              </label>
              <PendingButton className="secondary-action pressable" pendingLabel="Saving…" type="submit">
                Set date
              </PendingButton>
            </form>
          </section>

          <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <h2 className="card-title">Founding price</h2>
              <p className="mt-0.5 text-[14px] font-medium text-[var(--muted)]">{org.founding_member ? "Enabled: half price for as long as they stay." : "Disabled: they pay the list price."}</p>
            </div>
            <form action={adminSetFounding}>
              <input name="organizationId" type="hidden" value={id} />
              <input name="on" type="hidden" value={org.founding_member ? "0" : "1"} />
              <PendingButton className="secondary-action pressable" pendingLabel="Saving…" type="submit">
                {org.founding_member ? "Turn off" : "Turn on"}
              </PendingButton>
            </form>
          </section>

          <section className="card p-5">
            <h2 className="card-title">This month</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[var(--panel-secondary)] p-3">
                <dt className="text-[13px] font-semibold text-[var(--muted)]">Vehicles</dt>
                <dd className="num text-[24px]">{vehicleCount || 0}</dd>
              </div>
              <div className="rounded-2xl bg-[var(--panel-secondary)] p-3">
                <dt className="text-[13px] font-semibold text-[var(--muted)]">New bookings</dt>
                <dd className="num text-[24px]">{bookingsThisMonth || 0}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <section className="card mt-5 overflow-hidden p-0">
        <h2 className="card-title px-5 pb-2 pt-5">Team</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr>
                <th className="px-5 py-2.5">Person</th>
                <th className="px-5 py-2.5">Role</th>
                <th className="px-5 py-2.5">Last sign-in</th>
                <th className="px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.user_id || person.invited_email}>
                  <td className="px-5 py-3">
                    <span className="block font-bold">{person.display_name || person.auth?.email || person.invited_email || "—"}</span>
                    <span className="block text-[13px] font-medium text-[var(--muted)]">{person.auth?.email || person.invited_email || ""}</span>
                  </td>
                  <td className="px-5 py-3 font-semibold capitalize">{person.role}</td>
                  <td className="px-5 py-3 text-[14px] font-medium text-[var(--foreground-secondary)]">{adminDate(person.auth?.lastSignIn, true)}</td>
                  <td className="px-5 py-3 text-[14px] font-semibold">{person.is_active ? "Active" : <span className="text-[var(--muted)]">Removed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-5 p-5">
        <h2 className="card-title">Admin activity</h2>
        {(log || []).length === 0 ? (
          <p className="mt-2 font-medium text-[var(--muted)]">No admin changes yet. Every change made here is recorded, and the business can see it.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {((log || []) as any[]).map((row) => (
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5" key={row.id}>
                <span className="font-semibold">{ACTION_LABEL[row.action] || row.action}</span>
                <span className="text-[13px] font-medium text-[var(--muted)]">
                  {adminDate(row.created_at, true)} · {row.details?.by || "admin"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
