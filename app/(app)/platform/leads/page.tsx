import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { adminDate, requirePlatformAdmin } from "@/lib/admin";
import { LEAD_FLEET_LABEL } from "@/lib/leads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../admin-nav";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9-]{1,80}$/;

/** People who downloaded a free resource from the website (/resources/<slug>), newest first, with a CSV export. */
export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<{ resource?: string }> }) {
  await requirePlatformAdmin();
  const asked = String((await searchParams).resource || "");
  const resource = SLUG.test(asked) ? asked : "";
  const db = createSupabaseAdminClient() as any;
  let query = db.from("leads").select("id, created_at, email, name, business, country, fleet, resource, locale, consent, source_path").order("created_at", { ascending: false }).limit(500);
  if (resource) query = query.eq("resource", resource);
  const [userEmail, { data: rows }, { data: all }] = await Promise.all([
    getCurrentUserEmail(),
    query,
    // Which resources have leads, for the filter (a few thousand rows at most for a long time).
    db.from("leads").select("resource").order("created_at", { ascending: false }).limit(5000)
  ]);
  const leads = (rows || []) as any[];
  const counts = new Map<string, number>();
  for (const row of (all || []) as any[]) counts.set(row.resource, (counts.get(row.resource) || 0) + 1);
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  const tabs = [{ key: "", label: `All${total ? ` (${total})` : ""}`, href: "/platform/leads" }, ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, label: `${key} (${count})`, href: `/platform/leads?resource=${encodeURIComponent(key)}` }))];
  const exportHref = `/platform/leads/export${resource ? `?resource=${encodeURIComponent(resource)}` : ""}`;

  return (
    <AppShell userEmail={userEmail}>
      <AdminHeader active="/platform/leads" subtitle="People who downloaded a free resource from the website. Only email those who ticked “tips”." title="Leads" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by resource" className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              aria-current={tab.key === resource ? "page" : undefined}
              className={`pressable inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-bold ${tab.key === resource ? "bg-[var(--foreground)] text-white" : "bg-white text-[var(--foreground-secondary)] shadow-[0_0_0_1px_var(--border)] hover:text-[var(--foreground)]"}`}
              href={tab.href as Route}
              key={tab.key || "all"}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <a className="secondary-action pressable inline-flex min-h-10 items-center px-4 text-[14px]" href={exportHref}>
          Export CSV
        </a>
      </div>
      <section className="card overflow-hidden p-0">
        {leads.length === 0 ? (
          <p className="p-5 font-medium text-[var(--muted)]">No leads yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {leads.map((row) => (
              <li className="px-5 py-4" key={row.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0">
                    <a className="font-bold text-[var(--primary)] hover:underline [overflow-wrap:anywhere]" href={`mailto:${row.email}`}>
                      {row.email}
                    </a>
                    {row.name ? <span className="font-semibold"> · {row.name}</span> : null}
                  </p>
                  <span className="text-[13px] font-medium text-[var(--muted)]">
                    {adminDate(row.created_at, true)}
                    {row.locale ? ` · ${String(row.locale).toUpperCase()}` : ""}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-medium text-[var(--foreground-secondary)]">
                  <span className="rounded-full bg-[var(--panel-tertiary)] px-2.5 py-0.5 text-[13px] font-bold">{row.resource}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${row.consent ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--panel-tertiary)] text-[var(--muted)]"}`}>{row.consent ? "Tips: yes" : "Tips: no"}</span>
                  {[row.business, row.country, row.fleet ? LEAD_FLEET_LABEL[row.fleet] || row.fleet : null].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
