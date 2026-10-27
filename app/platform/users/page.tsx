import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { adminDate, listAuthUsers, requirePlatformAdmin } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../admin-nav";
import { PersonActions } from "../person-actions";

export const dynamic = "force-dynamic";

const SHOWN = 100;

/** Every sign-in account on RouteHQ: which businesses each person is in, when they last signed in, and help for them. */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePlatformAdmin();
  const { q } = await searchParams;
  const query = String(q || "").trim().toLowerCase().slice(0, 120);
  const db = createSupabaseAdminClient() as any;
  const [userEmail, authUsers, { data: members }, { data: orgs }] = await Promise.all([
    getCurrentUserEmail(),
    listAuthUsers(),
    db.from("organization_members").select("organization_id, user_id, role, is_active, display_name"),
    db.from("organizations").select("id, name, deleted_at")
  ]);
  const orgById = new Map(((orgs || []) as any[]).map((org) => [org.id, org]));
  const byUser = new Map<string, any[]>();
  for (const member of (members || []) as any[]) byUser.set(member.user_id, [...(byUser.get(member.user_id) || []), member]);

  const everyone = [...authUsers.values()].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const matching = query ? everyone.filter((person) => String(person.email || "").toLowerCase().includes(query)) : everyone;
  const people = matching.slice(0, SHOWN);

  return (
    <AppShell userEmail={userEmail}>
      <AdminHeader active="/platform/users" subtitle="Every RouteHQ account. Search by email to find someone, see their businesses and help them sign in." title="Users" />

      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <label className="!mb-0 min-w-[240px] flex-1">
          Email
          <input className="mt-1 w-full" defaultValue={query} name="q" placeholder="name@example.com" type="search" />
        </label>
        <PendingButton className="primary-action pressable" pendingLabel="Searching…" type="submit">
          Search
        </PendingButton>
        {query ? (
          <Link className="secondary-action pressable" href={"/platform/users" as Route}>
            Clear
          </Link>
        ) : null}
      </form>

      <p className="mb-3 text-[14px] font-medium text-[var(--muted)]">
        {query ? `${matching.length} account${matching.length === 1 ? "" : "s"} matching “${query}”` : `${everyone.length} accounts, newest first`}
        {matching.length > SHOWN ? ` · showing the first ${SHOWN}` : ""}
      </p>

      <section className="card overflow-hidden p-0">
        {people.length === 0 ? (
          <p className="p-5 font-medium text-[var(--muted)]">No account with that email.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {people.map((person) => {
              const rows = byUser.get(person.id) || [];
              const active = rows.filter((row) => row.is_active && orgById.get(row.organization_id) && !orgById.get(row.organization_id)?.deleted_at);
              return (
                <li className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]" key={person.id}>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[var(--foreground)]">{person.email || "No email"}</p>
                    <p className="text-[13px] font-medium text-[var(--muted)]">
                      Joined {adminDate(person.createdAt)} · last signed in {person.lastSignIn ? adminDate(person.lastSignIn, true) : "never"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    {rows.length === 0 ? (
                      <p className="text-[14px] font-medium text-[var(--muted)]">Not in any business</p>
                    ) : (
                      <ul className="space-y-1">
                        {rows.map((row) => {
                          const org = orgById.get(row.organization_id);
                          return (
                            <li className="text-[14px]" key={row.organization_id}>
                              <Link className="font-semibold text-[var(--primary)] hover:underline" href={`/platform/businesses/${row.organization_id}` as Route}>
                                {org?.name || "Deleted business"}
                              </Link>
                              <span className="font-medium capitalize text-[var(--foreground-secondary)]"> · {row.display_name === "RouteHQ support" ? "RouteHQ support (temporary)" : row.role}</span>
                              {!row.is_active ? <span className="font-medium text-[var(--muted)]"> · removed</span> : null}
                              {org?.deleted_at ? <span className="font-bold text-[var(--danger)]"> · business closed</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <div>
                    <PersonActions
                      email={person.email}
                      memberships={active.map((row) => ({ organizationId: row.organization_id, name: String(orgById.get(row.organization_id)?.name || "Business"), role: row.role }))}
                      userId={person.id}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
