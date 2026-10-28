import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import {
  adminClearCustomPlan,
  adminDeleteBusiness,
  adminExtendTrial,
  adminPurgeBusiness,
  adminRestoreBusiness,
  adminSetCustomPlan,
  adminSetPlan,
  adminStartViewing,
  adminStopViewing
} from "@/app/actions/admin";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { ACTION_LABEL, ADMIN_STATUS_LABEL, ADMIN_TIER_LABEL, PURGE_AFTER_DAYS, adminDate, daysFromNow, listAuthUsers, requirePlatformAdmin } from "@/lib/admin";
import { endExpiredViewSessions, SUPPORT_DISPLAY_NAME, viewSessionsAvailable, viewTime, type ViewSession } from "@/lib/admin-view";
import { effectiveLimits, parseCustomLimits, planById } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { StatusPill } from "../../admin-nav";
import { PersonActions } from "../../person-actions";

export const dynamic = "force-dynamic";

const NOTICE: Record<string, { text: string; good: boolean }> = {
  plan: { text: "Plan saved.", good: true },
  trial: { text: "Trial end moved.", good: true },
  custom: { text: "Custom plan saved. It applies straight away.", good: true },
  custom_cleared: { text: "Custom plan cleared: they're back on the plan's own price and limits.", good: true },
  custom_error: { text: "Couldn't save the custom plan. Use whole numbers of 0 or more and try again.", good: false },
  custom_unavailable: { text: "Custom plans aren't available yet: database update 0107 hasn't been applied.", good: false },
  view_reason: { text: "Write a short reason before viewing their business.", good: false },
  view_deleted: { text: "This business is closed, so it can't be viewed. Restore it first.", good: false },
  view_member: { text: "You're already a member of this business. Switch to it from the business menu instead.", good: false },
  view_unavailable: { text: "View as this business isn't available yet: database update 0108 hasn't been applied.", good: false },
  view_error: { text: "Couldn't start viewing their business. Try again.", good: false },
  view_stopped: { text: "You've stopped viewing their business. Your access has been removed.", good: true },
  deleted: { text: "Business closed. Its team can't sign in to it and its booking pages are offline. You can restore it.", good: true },
  delete_name: { text: "The name didn't match. Type the business name exactly to confirm.", good: false },
  delete_paid: { text: "They've paid for time they haven't used yet. Tick the box to confirm you still want to close it.", good: false },
  restored: { text: "Business restored. Everything is back as it was.", good: true },
  restore_taken: { text: "Couldn't restore it: another business now uses its booking address. Clear that address first, then try again.", good: false },
  purge_early: { text: `A business can only be deleted permanently ${PURGE_AFTER_DAYS} days after it was closed.`, good: false },
  purge_unavailable: { text: "Permanent delete isn't available yet: database update 0108 hasn't been applied.", good: false },
  purge_failed: { text: "Couldn't delete it permanently: some of its records are protected. Nothing was deleted. Check the server log and try again.", good: false },
  error: { text: "That didn't save. Check the values and try again.", good: false }
};

const limitText = (value: number | null) => (value === null ? "No limit" : value.toLocaleString("en-GB"));

/** One business, from RouteHQ's side: its plan and trial, its team, its size, and everything admins did to it. */
export default async function AdminBusinessPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const admin = await requirePlatformAdmin();
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

  // Custom plan (migration 0107): the plan's limits with the admin's overrides on top.
  const custom = parseCustomLimits(org.custom_limits);
  const customPrice = org.custom_price === null || org.custom_price === undefined ? null : Number(org.custom_price);
  const customAvailable = "custom_limits" in org;
  const limits = effectiveLimits(org);

  // View as this business (migration 0108): who from RouteHQ is in it right now. Ran-out sessions are tidied first.
  const viewAvailable = await viewSessionsAvailable();
  let liveSessions: ViewSession[] = [];
  if (viewAvailable) {
    const { data: openSessions } = await db.from("admin_view_sessions").select("*").eq("organization_id", id).is("ended_at", null);
    const sessions = (openSessions || []) as ViewSession[];
    await endExpiredViewSessions(sessions);
    liveSessions = sessions.filter((session) => Date.parse(session.ends_at) > Date.now());
  }
  const myLiveSession = liveSessions.find((session) => session.admin_user_id === admin.userId) || null;

  // Closed (soft-deleted): restore at any time; delete for good once it has been closed for 30 days.
  const closedDays = org.deleted_at ? Math.floor((Date.now() - Date.parse(org.deleted_at)) / 86_400_000) : null;
  const canPurge = closedDays !== null && closedDays >= PURGE_AFTER_DAYS;
  const paidUp = status === "active" && org.next_payment_due && Date.parse(org.next_payment_due) > Date.now();

  return (
    <AppShell userEmail={userEmail}>
      <BackLink href="/platform/businesses" label="Businesses" />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--primary)]">RouteHQ admin</p>
          <h1 className="page-title mt-1 flex flex-wrap items-center gap-3">
            {org.name}
            <StatusPill status={status} />
            {org.deleted_at ? <span className="inline-flex items-center rounded-full bg-[var(--danger)] px-2.5 py-0.5 text-[13px] font-bold text-white">Deleted</span> : null}
            {custom || customPrice !== null ? <span className="inline-flex items-center rounded-full bg-[var(--info-light)] px-2.5 py-0.5 text-[13px] font-bold text-[var(--info)]">Custom plan</span> : null}
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

      {org.deleted_at ? (
        <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--danger)] bg-[var(--danger-light)] p-5">
          <div className="min-w-0">
            <h2 className="card-title text-[var(--danger)]">Deleted on {adminDate(org.deleted_at, true)}</h2>
            <p className="measure mt-0.5 font-medium text-[var(--foreground)]">
              Its team can't use it and its booking pages are offline.{" "}
              {canPurge ? `It has been closed for ${closedDays} days, so it can now be deleted permanently (Danger zone below).` : `It can be restored at any time; it can be deleted permanently after ${PURGE_AFTER_DAYS} days (in ${PURGE_AFTER_DAYS - (closedDays || 0)} days).`}
            </p>
          </div>
          <form action={adminRestoreBusiness}>
            <input name="organizationId" type="hidden" value={id} />
            <PendingButton className="primary-action pressable" pendingLabel="Restoring…" type="submit">
              Restore
            </PendingButton>
          </form>
        </section>
      ) : null}

      {liveSessions.length ? (
        <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--warning-light)] p-4">
          <p className="font-semibold text-[var(--foreground)]">
            {liveSessions
              .map((session) => `${session.admin_user_id === admin.userId ? "You are" : `${authUsers.get(session.admin_user_id)?.email || "A RouteHQ admin"} is`} viewing this business until ${viewTime(session.ends_at)} · “${session.reason || ""}”`)
              .join(" · ")}
          </p>
          {myLiveSession ? (
            <div className="flex flex-wrap gap-2">
              <Link className="secondary-action pressable" href={"/" as Route}>
                Open their app
              </Link>
              <form action={adminStopViewing}>
                <PendingButton className="secondary-action pressable" pendingLabel="Stopping…" type="submit">
                  Stop viewing
                </PendingButton>
              </form>
            </div>
          ) : null}
        </section>
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
            <dd className="text-right font-semibold">{limitText(limits.cars)}</dd>
            <dt className="font-medium text-[var(--muted)]">Motorbikes included</dt>
            <dd className="text-right font-semibold">{limitText(limits.motorbikes)}</dd>
            <dt className="font-medium text-[var(--muted)]">Team accounts</dt>
            <dd className="text-right font-semibold">{limitText(limits.team)}</dd>
            <dt className="font-medium text-[var(--muted)]">{customPrice !== null ? "Custom price" : "List price"}</dt>
            <dd className="text-right font-semibold">
              {customPrice !== null ? `${org.currency || "THB"} ${customPrice.toLocaleString("en-GB")} a month` : `฿${plan.monthly.toLocaleString("en-GB")} a month`}
            </dd>
          </dl>
          {custom ? <p className="mt-2 text-[13px] font-medium text-[var(--muted)]">Limits include this business's custom plan.</p> : null}
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

      <section className="card mt-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="card-title">Custom plan</h2>
            <p className="measure mt-0.5 text-[14px] font-medium text-[var(--muted)]">
              A price and limits for this business only, on top of the {ADMIN_TIER_LABEL[tier]} plan. Leave a box empty to keep the plan&apos;s own value. Changes apply straight away.
            </p>
          </div>
          {custom || customPrice !== null ? (
            <form action={adminClearCustomPlan}>
              <input name="organizationId" type="hidden" value={id} />
              <PendingButton className="secondary-action pressable" pendingLabel="Clearing…" type="submit">
                Clear custom plan
              </PendingButton>
            </form>
          ) : null}
        </div>
        {!customAvailable ? (
          <p className="mt-3 rounded-xl bg-[var(--warning-light)] px-4 py-3 text-[14px] font-semibold text-[var(--foreground)]">
            Not available yet: database update 0107 (custom plans) hasn&apos;t been applied.
          </p>
        ) : (
          <form action={adminSetCustomPlan} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input name="organizationId" type="hidden" value={id} />
            <label className="!mb-0">
              Monthly price ({org.currency || "THB"})
              <input className="mt-1 w-full" defaultValue={customPrice ?? ""} inputMode="decimal" name="customPrice" placeholder={`List: ${plan.monthly.toLocaleString("en-GB")} THB`} />
            </label>
            {(
              [
                ["cars", "Cars", plan.cars],
                ["motorbikes", "Motorbikes", plan.motorbikes],
                ["team", "Team accounts", plan.team]
              ] as const
            ).map(([key, label, planValue]) => (
              <div key={key}>
                <label className="!mb-0">
                  {label}
                  <input className="mt-1 w-full" defaultValue={typeof custom?.[key] === "number" ? String(custom?.[key]) : ""} inputMode="numeric" min={0} name={key} placeholder={`Plan: ${limitText(planValue)}`} type="number" />
                </label>
                <label className="!mb-0 mt-1.5 flex items-center gap-2 text-[14px] font-medium">
                  <input defaultChecked={custom?.[key] === null} name={`${key}Unlimited`} type="checkbox" value="1" />
                  No limit
                </label>
              </div>
            ))}
            <label className="!mb-0">
              Document reads a month
              <input className="mt-1 w-full" defaultValue={custom?.docReads ?? ""} inputMode="numeric" min={0} name="docReads" placeholder={`Plan: ${plan.documentReads.toLocaleString("en-GB")}`} type="number" />
            </label>
            <label className="!mb-0">
              Look-ups a month
              <input className="mt-1 w-full" defaultValue={custom?.lookups ?? ""} inputMode="numeric" min={0} name="lookups" placeholder={`Plan: ${plan.comparisonLookups.toLocaleString("en-GB")}`} type="number" />
            </label>
            {(
              [
                ["customDomain", "Own domain", plan.customDomain],
                ["prioritySupport", "Priority help", plan.prioritySupport]
              ] as const
            ).map(([key, label, planValue]) => (
              <label className="!mb-0" key={key}>
                {label}
                <select className="mt-1 w-full" defaultValue={custom?.[key] === true ? "yes" : custom?.[key] === false ? "no" : ""} name={key}>
                  <option value="">Plan&apos;s own ({planValue ? "yes" : "no"})</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            ))}
            <div className="sm:col-span-2 lg:col-span-4">
              <PendingButton className="primary-action pressable" pendingLabel="Saving…" type="submit">
                Save custom plan
              </PendingButton>
            </div>
          </form>
        )}
      </section>

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
                <th className="px-5 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => {
                const isSupport = person.display_name === SUPPORT_DISPLAY_NAME && person.role === "manager";
                return (
                  <tr className="align-top" key={person.user_id || person.invited_email}>
                    <td className="px-5 py-3">
                      <span className="block font-bold">{isSupport ? "RouteHQ support (temporary)" : person.display_name || person.auth?.email || person.invited_email || "—"}</span>
                      <span className="block text-[13px] font-medium text-[var(--muted)]">{person.auth?.email || person.invited_email || ""}</span>
                    </td>
                    <td className="px-5 py-3 font-semibold capitalize">{person.role}</td>
                    <td className="px-5 py-3 text-[14px] font-medium text-[var(--foreground-secondary)]">{adminDate(person.auth?.lastSignIn, true)}</td>
                    <td className="px-5 py-3 text-[14px] font-semibold">{person.is_active ? "Active" : <span className="text-[var(--muted)]">Removed</span>}</td>
                    <td className="px-5 py-3">
                      {person.user_id && !isSupport ? (
                        <PersonActions
                          contextOrganizationId={id}
                          email={person.auth?.email || null}
                          memberships={person.is_active ? [{ organizationId: id, name: org.name, role: person.role }] : []}
                          userId={person.user_id}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
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

      <section className="mt-5 rounded-2xl border border-[var(--danger)] bg-white p-5">
        <h2 className="card-title text-[var(--danger)]">Danger zone</h2>

        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="text-[16px] font-bold text-[var(--foreground)]">View as this business</h3>
            <p className="measure mt-0.5 text-[14px] font-medium text-[var(--foreground-secondary)]">
              You join their team as “RouteHQ support” for 2 hours and see the app exactly as they do. They see a notice at the top of their app while you have access. Ends when you click Stop viewing, or after 2 hours.
            </p>
            {!viewAvailable ? (
              <p className="mt-3 rounded-xl bg-[var(--warning-light)] px-4 py-3 text-[14px] font-semibold text-[var(--foreground)]">
                Not available yet: database update 0108 hasn&apos;t been applied.
              </p>
            ) : org.deleted_at ? (
              <p className="mt-3 text-[14px] font-semibold text-[var(--muted)]">Restore the business first to view it.</p>
            ) : myLiveSession ? (
              <form action={adminStopViewing} className="mt-3">
                <PendingButton className="secondary-action pressable" pendingLabel="Stopping…" type="submit">
                  Stop viewing (until {viewTime(myLiveSession.ends_at)})
                </PendingButton>
              </form>
            ) : (
              <form action={adminStartViewing} className="mt-3 grid gap-2">
                <input name="organizationId" type="hidden" value={id} />
                <label className="!mb-0">
                  Reason (recorded in the admin log)
                  <input className="mt-1 w-full" maxLength={500} minLength={3} name="reason" placeholder="e.g. Help request about deposits" required />
                </label>
                <div>
                  <PendingButton className="secondary-action pressable" pendingLabel="Opening…" type="submit">
                    View as this business
                  </PendingButton>
                </div>
              </form>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-[16px] font-bold text-[var(--foreground)]">{org.deleted_at ? (canPurge ? "Delete permanently" : "Deleted") : "Delete business"}</h3>
            {!org.deleted_at ? (
              <>
                <p className="measure mt-0.5 text-[14px] font-medium text-[var(--foreground-secondary)]">
                  Closes the business: its team can&apos;t use it and its booking pages go offline. Nothing is erased: you can restore it at any time, and only after {PURGE_AFTER_DAYS} days can it be deleted for good.
                </p>
                <form action={adminDeleteBusiness} className="mt-3 grid gap-2">
                  <input name="organizationId" type="hidden" value={id} />
                  <label className="!mb-0">
                    Type <strong>{org.name}</strong> to confirm
                    <input autoComplete="off" className="mt-1 w-full" name="confirmName" required />
                  </label>
                  {paidUp ? (
                    <label className="!mb-0 flex items-start gap-2 text-[14px] font-medium">
                      <input className="mt-1" name="confirmPaid" required type="checkbox" value="1" />
                      They&apos;ve paid until {adminDate(org.next_payment_due)}. I still want to close it.
                    </label>
                  ) : null}
                  <div>
                    <PendingButton className="primary-action pressable !bg-[var(--danger)]" pendingLabel="Closing…" type="submit">
                      Delete business
                    </PendingButton>
                  </div>
                </form>
              </>
            ) : canPurge ? (
              <>
                <p className="measure mt-0.5 text-[14px] font-medium text-[var(--foreground-secondary)]">
                  Erases the business and all its records for good. This can&apos;t be undone. People&apos;s sign-in accounts stay, so anyone who works for another business is not affected. Stored files (photos, PDFs) are not removed by this.
                </p>
                <form action={adminPurgeBusiness} className="mt-3 grid gap-2">
                  <input name="organizationId" type="hidden" value={id} />
                  <label className="!mb-0">
                    Type <strong>{org.name}</strong> to confirm
                    <input autoComplete="off" className="mt-1 w-full" name="confirmName" required />
                  </label>
                  <div>
                    <PendingButton className="primary-action pressable !bg-[var(--danger)]" pendingLabel="Deleting…" type="submit">
                      Delete permanently
                    </PendingButton>
                  </div>
                </form>
              </>
            ) : (
              <p className="measure mt-0.5 text-[14px] font-medium text-[var(--foreground-secondary)]">
                Closed {closedDays} day{closedDays === 1 ? "" : "s"} ago. Use Restore above to bring it back. Permanent delete becomes possible after {PURGE_AFTER_DAYS} days.
              </p>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
