import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AdminHeader } from "@/app/platform/admin-nav";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/support";
import { listTeamThreads } from "@/lib/support-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BANGKOK = "Asia/Bangkok";

/** RoveHQ's own view: every business's Help conversations. Platform admins only. */
export default async function HelpTeamPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const [{ show }, userEmail, membership, t, locale, tr] = await Promise.all([searchParams, getCurrentUserEmail(), getCurrentMembership(), getTranslations("help"), getLocale(), getTranslations("renters")]);
  const supabase = (await createSupabaseServerClient()) as any;
  if (!(await isPlatformAdmin(supabase, membership?.userId))) notFound();
  const filter = show === "all" ? "all" : "waiting";
  const threads = await listTeamThreads(filter);
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { timeZone: BANGKOK, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <AppShell userEmail={userEmail}>
      <div className="space-y-4">
        {/* Part of the RoveHQ admin console: the same header and tabs as the other admin pages. */}
        <AdminHeader active="/help/team" subtitle={t("teamSubtitle")} title={t("teamTitle")} />
        <div className="chip-row flex flex-wrap gap-2">
          {(["waiting", "all"] as const).map((value) => (
            <Link
              className={`rounded-full border px-3.5 py-1.5 text-[15px] font-semibold ${filter === value ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)]"}`}
              href={(value === "all" ? "/help/team?show=all" : "/help/team") as Route}
              key={value}
            >
              {t(`teamFilter_${value}`)}
            </Link>
          ))}
        </div>
        <section className="card p-2 sm:p-3">
          {threads.length ? (
            <ul className="divide-y divide-[var(--border)]">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <Link className="flex items-center gap-3 px-2 py-3" href={`/help/team/${thread.id}` as Route}>
                    {thread.unread ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--primary)]" /> : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-bold text-[var(--foreground)]">{thread.subject}</span>
                      <span className="block truncate font-medium text-[var(--muted)]">
                        {thread.businessName} · {t(`topic_${thread.topic}`)} · {date(thread.lastMessageAt)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-[var(--panel-secondary)] px-2.5 py-0.5 text-[13px] font-bold text-[var(--foreground-secondary)]">{t(`teamStatus_${thread.status}`)}</span>
                    <ChevronRight className="shrink-0 text-[var(--muted)]" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-3 font-medium text-[var(--foreground-secondary)]">{filter === "waiting" ? t("teamNothingWaiting") : t("noConversations")}</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
