import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { adminDate, requirePlatformAdmin } from "@/lib/admin";
import { CONTACT_FLEET_LABEL, CONTACT_TOPIC_LABEL } from "@/lib/contact";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { setContactHandled } from "@/app/actions/contact-admin";
import { AdminHeader } from "../admin-nav";

export const dynamic = "force-dynamic";

/** Messages sent from the website's contact form (/contact), newest first. Open ones until someone marks them handled. */
export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requirePlatformAdmin();
  const show = (await searchParams).show === "handled" ? "handled" : "open";
  const db = createSupabaseAdminClient() as any;
  let query = db
    .from("contact_messages")
    .select("id, created_at, name, email, phone, business, fleet, topic, message, locale, handled_at")
    .order("created_at", { ascending: false })
    .limit(300);
  query = show === "handled" ? query.not("handled_at", "is", null) : query.is("handled_at", null);
  const [userEmail, { data: rows }, { count: openCount }] = await Promise.all([
    getCurrentUserEmail(),
    query,
    db.from("contact_messages").select("id", { count: "exact", head: true }).is("handled_at", null)
  ]);
  const messages = (rows || []) as any[];
  const tabs = [
    { key: "open", label: `Open${openCount ? ` (${openCount})` : ""}`, href: "/platform/messages" },
    { key: "handled", label: "Handled", href: "/platform/messages?show=handled" }
  ];

  return (
    <AppShell userEmail={userEmail}>
      <AdminHeader active="/platform/messages" subtitle="Sent from the contact form on the website. Reply by email, then mark them handled." title="Messages" />
      <nav aria-label="Filter messages" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Link
            aria-current={tab.key === show ? "page" : undefined}
            className={`pressable inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-bold ${tab.key === show ? "bg-[var(--foreground)] text-white" : "bg-white text-[var(--foreground-secondary)] shadow-[0_0_0_1px_var(--border)] hover:text-[var(--foreground)]"}`}
            href={tab.href as Route}
            key={tab.key}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <section className="card overflow-hidden p-0">
        {messages.length === 0 ? (
          <p className="p-5 font-medium text-[var(--muted)]">{show === "open" ? "No open messages." : "Nothing handled yet."}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {messages.map((row) => (
              <li className="px-5 py-4" key={row.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="min-w-0">
                    <span className="font-bold">{row.name}</span>
                    {" · "}
                    <a className="font-semibold text-[var(--primary)] hover:underline [overflow-wrap:anywhere]" href={`mailto:${row.email}`}>
                      {row.email}
                    </a>
                  </p>
                  <span className="text-[13px] font-medium text-[var(--muted)]">
                    {adminDate(row.created_at, true)}
                    {row.locale ? ` · ${String(row.locale).toUpperCase()}` : ""}
                  </span>
                </div>
                <p className="mt-1 text-[14px] font-medium text-[var(--foreground-secondary)]">
                  {[CONTACT_TOPIC_LABEL[row.topic] || row.topic, row.business, row.fleet ? CONTACT_FLEET_LABEL[row.fleet] || row.fleet : null, row.phone].filter(Boolean).join(" · ")}
                </p>
                <p className="measure mt-2 whitespace-pre-wrap font-medium [overflow-wrap:anywhere]">{row.message}</p>
                <form action={setContactHandled} className="mt-3">
                  <input name="id" type="hidden" value={row.id} />
                  <input name="handled" type="hidden" value={row.handled_at ? "0" : "1"} />
                  <button className="secondary-action pressable min-h-10 px-4 text-[14px]" type="submit">
                    {row.handled_at ? `Handled ${adminDate(row.handled_at)} · Reopen` : "Mark handled"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
