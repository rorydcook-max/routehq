import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { adminStartViewing } from "@/app/actions/admin";
import { adminSetSetupRequestStatus, type SetupFile } from "@/app/actions/setup-request";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { adminDate, requirePlatformAdmin } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminHeader } from "../admin-nav";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { new: "New", in_progress: "Working on it", done: "Done" };

/**
 * "We'll set it up for you" requests (2 Nov 2026). For each: what the business sent, then
 * 1. View as the business, 2. Fleet > Import a list with the files (the AI reads them; check every card), 3. Mark done.
 */
export default async function AdminSetupRequestsPage() {
  await requirePlatformAdmin();
  const db = createSupabaseAdminClient() as any;
  const [userEmail, { data: rows }] = await Promise.all([
    getCurrentUserEmail(),
    db.from("setup_requests").select("id, organization_id, note, files, status, created_at, handled_at, admin_note, organizations(name, slug)").order("created_at", { ascending: false }).limit(200)
  ]);
  const requests = ((rows || []) as any[]).sort((a, b) => Number(a.status === "done") - Number(b.status === "done"));
  // Links to each file, good for an hour.
  const links = new Map<string, string>();
  const paths = requests.flatMap((row) => ((row.files || []) as SetupFile[]).map((file) => file.path));
  if (paths.length) {
    const { data: signed } = await db.storage.from("documents").createSignedUrls(paths, 3600);
    for (const entry of (signed || []) as Array<{ path: string; signedUrl: string }>) if (entry.signedUrl) links.set(entry.path, entry.signedUrl);
  }

  return (
    <AppShell userEmail={userEmail}>
      <AdminHeader active="/platform/setup" subtitle="Businesses that sent their records for us to bring in. View as the business, use Fleet › Import a list with these files (the AI reads them; check every card before bringing it in), then mark it done: the owner is notified." title="Set it up for me" />
      {requests.length === 0 ? (
        <p className="card p-5 font-medium text-[var(--muted)]">No requests yet.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((row) => {
            const files = (row.files || []) as SetupFile[];
            return (
              <li className="card p-4" key={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="text-[17px] font-bold text-[var(--foreground)] hover:underline" href={`/platform/businesses/${row.organization_id}` as Route}>
                      {row.organizations?.name || "Business"}
                    </Link>
                    <p className="text-[14px] text-[var(--muted)]">
                      Sent {adminDate(row.created_at, true)} · {files.length} file{files.length === 1 ? "" : "s"}
                      {row.handled_at ? ` · updated ${adminDate(row.handled_at, true)}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${row.status === "done" ? "bg-[var(--success-light)] text-[var(--success)]" : row.status === "in_progress" ? "bg-[var(--info-light)] text-[var(--info)]" : "bg-[var(--warning-light)] text-[var(--warning)]"}`}>
                    {STATUS_LABEL[row.status] || row.status}
                  </span>
                </div>
                {row.note ? <p className="mt-2 whitespace-pre-wrap rounded-xl bg-[var(--panel-secondary)] p-3 font-medium text-[var(--foreground)]">{row.note}</p> : null}
                {files.length ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {files.map((file) => (
                      <li key={file.path}>
                        <a className="inline-flex min-h-9 items-center rounded-full bg-white px-3 text-[14px] font-semibold text-[var(--primary)] shadow-[0_0_0_1px_var(--border)]" download={file.name} href={links.get(file.path) || "#"} rel="noreferrer" target="_blank">
                          {file.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {row.admin_note ? <p className="mt-2 text-[14px] text-[var(--foreground-secondary)]">Note: {row.admin_note}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {row.status !== "done" ? (
                    <form action={adminStartViewing} className="flex flex-wrap gap-2">
                      <input name="organizationId" type="hidden" value={row.organization_id} />
                      <input name="reason" type="hidden" value={`Setting up their records (setup request ${String(row.id).slice(0, 8)})`} />
                      <button className="primary-action pressable min-h-10 px-4 text-[14px]" type="submit">View as business to import</button>
                    </form>
                  ) : null}
                  {row.status === "new" ? (
                    <form action={adminSetSetupRequestStatus}>
                      <input name="id" type="hidden" value={row.id} />
                      <input name="status" type="hidden" value="in_progress" />
                      <button className="secondary-action pressable min-h-10 px-4 text-[14px]" type="submit">Mark working on it</button>
                    </form>
                  ) : null}
                  {row.status !== "done" ? (
                    <form action={adminSetSetupRequestStatus} className="flex flex-wrap gap-2">
                      <input name="id" type="hidden" value={row.id} />
                      <input name="status" type="hidden" value="done" />
                      <input className="min-h-10 rounded-full px-3 text-[14px]" name="adminNote" placeholder="Note (optional)" />
                      <button className="secondary-action pressable min-h-10 px-4 text-[14px]" type="submit">Mark done and tell the owner</button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
