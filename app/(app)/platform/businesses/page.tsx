import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { ADMIN_STATUS_LABEL, ADMIN_TIER_LABEL, adminDate, daysFromNow, listBusinesses, requirePlatformAdmin } from "@/lib/admin";
import { AdminHeader, StatusPill } from "../admin-nav";

export const dynamic = "force-dynamic";

type Query = { q?: string; plan?: string; status?: string; soon?: string; deleted?: string };

/** Every business on RoveHQ: search by name or owner email, filter by plan and status. Platform admins only. */
export default async function AdminBusinessesPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requirePlatformAdmin();
  const [query, userEmail, all] = await Promise.all([searchParams, getCurrentUserEmail(), listBusinesses()]);
  const q = (query.q || "").trim().toLowerCase();
  const rows = all.filter((b) => {
    if (!query.deleted && b.deletedAt) return false;
    if (q && !`${b.name} ${b.owners.map((o) => o.email).join(" ")}`.toLowerCase().includes(q)) return false;
    if (query.plan && (b.tier === "growth" ? "pro" : b.tier) !== query.plan) return false;
    if (query.status && b.status !== query.status) return false;
    if (query.soon && !(b.status === "trial" && (daysFromNow(b.trialEndsAt) ?? 99) <= 7)) return false;
    return true;
  });

  return (
    <AppShell userEmail={userEmail}>
      <AdminHeader active="/platform/businesses" subtitle={`${all.filter((b) => !b.deletedAt).length} businesses. Open one to change its plan, extend its trial or help its team.`} title="Businesses" />

      <form className="card mb-4 grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_170px_170px_auto_auto] md:items-center" method="get">
        <input aria-label="Search" className="w-full" defaultValue={query.q || ""} name="q" placeholder="Business name or owner email" type="search" />
        <select aria-label="Plan" defaultValue={query.plan || ""} name="plan">
          <option value="">Any plan</option>
          {["free", "starter", "pro", "business"].map((tier) => (
            <option key={tier} value={tier}>
              {ADMIN_TIER_LABEL[tier]}
            </option>
          ))}
        </select>
        <select aria-label="Status" defaultValue={query.status || ""} name="status">
          <option value="">Any status</option>
          {Object.entries(ADMIN_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="checkbox-label !mb-0 whitespace-nowrap px-1 text-[14px]">
          <input defaultChecked={!!query.soon} name="soon" type="checkbox" value="1" />
          Trial ends within 7 days
        </label>
        <button className="primary-action pressable" type="submit">
          Search
        </button>
      </form>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left">
            <thead>
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trial ends / next payment</th>
                <th className="px-4 py-3 text-right">Vehicles</th>
                <th className="px-4 py-3">Last sign-in</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center font-medium text-[var(--muted)]" colSpan={7}>
                    No businesses match.
                  </td>
                </tr>
              ) : (
                rows.map((b) => {
                  const left = daysFromNow(b.trialEndsAt);
                  return (
                    <tr className="hover:bg-[var(--panel-secondary)]" key={b.id}>
                      <td className="px-4 py-3">
                        <Link className="block font-bold text-[var(--foreground)] hover:text-[var(--primary)]" href={`/platform/businesses/${b.id}` as Route}>
                          {b.name}
                          {b.deletedAt ? <span className="ms-2 text-[13px] font-bold text-[var(--danger)]">Deleted</span> : null}
                        </Link>
                        <span className="block text-[13px] font-medium text-[var(--muted)]">{b.owners[0]?.email || "No owner"}{b.country ? ` · ${b.country}` : ""}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {ADMIN_TIER_LABEL[b.tier] || b.tier}
                        {b.customLimits || b.customPrice !== null ? <span className="ms-1.5 text-[13px] font-bold text-[var(--primary)]">custom</span> : null}
                        {b.pendingPlan ? <span className="block text-[13px] font-bold text-[var(--warning)]">Wants {ADMIN_TIER_LABEL[b.pendingPlan] || b.pendingPlan}</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={b.status} />
                      </td>
                      <td className="px-4 py-3 text-[14px] font-medium text-[var(--foreground-secondary)]">
                        {b.status === "trial" ? (
                          <span className={left !== null && left <= 7 ? "font-bold text-[var(--warning)]" : ""}>
                            {adminDate(b.trialEndsAt)}
                            {left !== null ? ` · ${left < 0 ? "ended" : `${left} days`}` : ""}
                          </span>
                        ) : (
                          adminDate(b.nextPaymentDue)
                        )}
                      </td>
                      <td className="num px-4 py-3 text-right font-semibold">{b.vehicles}</td>
                      <td className="px-4 py-3 text-[14px] font-medium text-[var(--foreground-secondary)]">{adminDate(b.lastActive)}</td>
                      <td className="px-4 py-3 text-[14px] font-medium text-[var(--foreground-secondary)]">{adminDate(b.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
