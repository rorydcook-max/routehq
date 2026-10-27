import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { ACTION_LABEL, adminDate, requirePlatformAdmin } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../admin-nav";

export const dynamic = "force-dynamic";

/** Every change made from the admin console, newest first. Nobody can edit or delete it. */
export default async function AdminLogPage() {
  await requirePlatformAdmin();
  const db = createSupabaseAdminClient() as any;
  const [userEmail, { data: log }, { data: orgs }] = await Promise.all([
    getCurrentUserEmail(),
    db.from("admin_audit_log").select("id, action, organization_id, details, created_at").order("created_at", { ascending: false }).limit(300),
    db.from("organizations").select("id, name")
  ]);
  const names = new Map(((orgs || []) as any[]).map((o) => [o.id, o.name]));
  const describe = (row: any) => {
    const d = row.details || {};
    if (row.action === "plan_changed" && d.from && d.to) return `${d.from.tier}/${d.from.status} → ${d.to.tier}/${d.to.status}${d.to.interval !== d.from.interval ? ` (${d.to.interval})` : ""}`;
    if (row.action === "trial_extended") return `to ${adminDate(d.to)}`;
    return "";
  };

  return (
    <AppShell userEmail={userEmail}>
      <AdminHeader active="/platform/log" subtitle="Every change made from the admin console. It can't be edited or deleted, and each business can see the entries about it." title="Admin log" />
      <section className="card overflow-hidden p-0">
        {(log || []).length === 0 ? (
          <p className="p-5 font-medium text-[var(--muted)]">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {((log || []) as any[]).map((row) => (
              <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3" key={row.id}>
                <span className="min-w-0">
                  <span className="font-bold">{ACTION_LABEL[row.action] || row.action}</span>
                  {row.organization_id ? (
                    <>
                      {" · "}
                      <Link className="font-semibold text-[var(--primary)] hover:underline" href={`/platform/businesses/${row.organization_id}` as Route}>
                        {names.get(row.organization_id) || "deleted business"}
                      </Link>
                    </>
                  ) : null}
                  {describe(row) ? <span className="block text-[14px] font-medium text-[var(--foreground-secondary)]">{describe(row)}</span> : null}
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
