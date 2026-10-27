import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { ACTION_LABEL, ADMIN_TIER_LABEL, adminDate, daysFromNow, listBusinesses, requirePlatformAdmin } from "@/lib/admin";
import { planById } from "@/lib/plans";
import { formatPlanPrice } from "@/lib/plan-currency";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminHeader, StatusPill } from "./admin-nav";

export const dynamic = "force-dynamic";

/** RouteHQ admin console: the state of the whole platform at a glance. Platform admins only. */
export default async function AdminOverviewPage() {
  await requirePlatformAdmin();
  const db = createSupabaseAdminClient() as any;
  const [userEmail, businesses, { data: log }] = await Promise.all([
    getCurrentUserEmail(),
    listBusinesses(),
    db.from("admin_audit_log").select("id, action, organization_id, details, created_at").order("created_at", { ascending: false }).limit(8)
  ]);
  const live = businesses.filter((b) => !b.deletedAt);
  const count = (fn: (b: (typeof live)[number]) => boolean) => live.filter(fn).length;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const monthAgo = Date.now() - 30 * 86_400_000;
  const endingSoon = live
    .filter((b) => b.status === "trial" && (daysFromNow(b.trialEndsAt) ?? 99) <= 7 && (daysFromNow(b.trialEndsAt) ?? -1) >= 0)
    .sort((a, b) => String(a.trialEndsAt).localeCompare(String(b.trialEndsAt)));
  const waiting = live.filter((b) => b.pendingPlan);
  // Monthly revenue in baht: list price (or custom price) of every paying business, yearly plans spread over 12 months.
  const mrr = live
    .filter((b) => b.status === "active")
    .reduce((sum, b) => {
      const monthly = b.customPrice ?? planById(b.tier).monthly;
      return sum + (b.foundingMember ? monthly / 2 : monthly) * (b.interval === "yearly" ? 11 / 12 : 1);
    }, 0);
  const names = new Map(businesses.map((b) => [b.id, b.name]));

  const stats: Array<[string, string, string?]> = [
    ["Businesses", String(live.length), `${count((b) => Date.parse(b.createdAt || "") >= weekAgo)} new this week · ${count((b) => Date.parse(b.createdAt || "") >= monthAgo)} in 30 days`],
    ["On a free trial", String(count((b) => b.status === "trial")), `${endingSoon.length} ending in 7 days`],
    ["Paying", String(count((b) => b.status === "active")), `${count((b) => b.status === "past_due")} payment late`],
    ["Monthly revenue", formatPlanPrice(Math.round(mrr), "THB", "en-GB"), "List prices, founding discount applied"]
  ];

  return (
    <AppShell userEmail={userEmail}>
      <AdminHeader active="/platform" subtitle="Every business on RouteHQ, their plans and trials. Only RouteHQ admins can see this." title="Overview" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([label, value, note]) => (
          <div className="card p-5" key={label}>
            <p className="text-[14px] font-semibold text-[var(--muted)]">{label}</p>
            <p className="num mt-1 text-[30px] leading-tight text-[var(--foreground)]">{value}</p>
            {note ? <p className="mt-1 text-[13px] font-medium text-[var(--foreground-secondary)]">{note}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="card-title">Waiting for payment</h2>
          {waiting.length === 0 ? (
            <p className="mt-2 font-medium text-[var(--muted)]">No plan requests waiting.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {waiting.map((b) => (
                <li key={b.id}>
                  <Link className="flex items-center justify-between gap-3 py-3 hover:text-[var(--primary)]" href={`/platform/businesses/${b.id}` as Route}>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{b.name}</span>
                      <span className="block text-[13px] font-medium text-[var(--muted)]">Wants {ADMIN_TIER_LABEL[b.pendingPlan || ""] || b.pendingPlan}</span>
                    </span>
                    <StatusPill status={b.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="card-title">Trials ending in the next 7 days</h2>
          {endingSoon.length === 0 ? (
            <p className="mt-2 font-medium text-[var(--muted)]">None this week.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {endingSoon.map((b) => (
                <li key={b.id}>
                  <Link className="flex items-center justify-between gap-3 py-3 hover:text-[var(--primary)]" href={`/platform/businesses/${b.id}` as Route}>
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{b.name}</span>
                      <span className="block text-[13px] font-medium text-[var(--muted)]">
                        {ADMIN_TIER_LABEL[b.tier] || b.tier} · {b.vehicles} vehicles · {b.owners[0]?.email || "no owner"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[14px] font-bold text-[var(--warning)]">{adminDate(b.trialEndsAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card mt-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="card-title">Recent admin actions</h2>
          <Link className="text-[14px] font-bold text-[var(--primary)] hover:underline" href={"/platform/log" as Route}>
            Full log
          </Link>
        </div>
        {(log || []).length === 0 ? (
          <p className="mt-2 font-medium text-[var(--muted)]">Nothing yet. Every change made here is recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {((log || []) as any[]).map((row) => (
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5" key={row.id}>
                <span className="font-semibold text-[var(--foreground)]">
                  {ACTION_LABEL[row.action] || row.action}
                  {row.organization_id ? <span className="font-medium text-[var(--foreground-secondary)]"> · {names.get(row.organization_id) || "deleted business"}</span> : null}
                </span>
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
