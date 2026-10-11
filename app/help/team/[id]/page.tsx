import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { HelpStatusButton } from "@/components/help/help-actions";
import { HelpCompose } from "@/components/help/help-compose";
import { HelpThread } from "@/components/help/help-thread";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { isPlatformAdmin, replyLinkFor } from "@/lib/support";
import { loadThread } from "@/lib/support-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** One conversation, answered by the RouteHQ team. */
export default async function HelpTeamConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, userEmail, membership, t, locale] = await Promise.all([params, getCurrentUserEmail(), getCurrentMembership(), getTranslations("help"), getLocale()]);
  const supabase = (await createSupabaseServerClient()) as any;
  if (!(await isPlatformAdmin(supabase, membership?.userId))) notFound();
  const loaded = await loadThread(id, { side: "team", organizationId: null });
  if (!loaded) notFound();
  const { business, thread } = loaded;
  const closed = thread.status === "closed";
  const outside = business.preference.channel !== "app" ? replyLinkFor(business.preference.channel, business.preference.handle, business.preference.channel === "email" ? `RouteHQ: ${thread.subject}` : "") : null;

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl space-y-4">
        <Link className="inline-flex items-center gap-1 font-semibold text-[var(--primary)]" href={"/help/team" as Route}>
          <ChevronLeft size={18} />
          {t("teamTitle")}
        </Link>
        <div className="page-hero">
          <h1 className="page-title break-words">{thread.subject}</h1>
          <p className="page-subtitle mt-2">
            {business.name} · {t(`topic_${thread.topic}`)} · {t(`teamStatus_${thread.status}`)}
          </p>
        </div>

        <section className="card grid gap-2 p-5 sm:grid-cols-2">
          <p className="font-medium text-[var(--foreground-secondary)]">
            <span className="font-bold text-[var(--foreground)]">{t("teamPlan")}</span> {t(`plan_${business.plan}`)} · {business.yearly ? t("teamYearly") : t("teamMonthly")} · {business.status}
          </p>
          <p className="font-medium text-[var(--foreground-secondary)]">
            <span className="font-bold text-[var(--foreground)]">{t("teamImport")}</span> {business.importIncluded ? t("teamImportIncluded") : t("teamImportNot")}
          </p>
          <p className="font-medium text-[var(--foreground-secondary)] sm:col-span-2">
            <span className="font-bold text-[var(--foreground)]">{t("teamPrefers")}</span> {t(`channel_${business.preference.channel}`)}
            {business.preference.handle ? ` · ${business.preference.handle}` : ""}
          </p>
          <p className="font-medium text-[var(--foreground-secondary)] sm:col-span-2">
            {[business.phone, business.email, business.lineId ? `LINE ${business.lineId}` : ""].filter(Boolean).join(" · ")}
          </p>
          {outside ? (
            <a className="secondary-action pressable w-fit" href={outside} rel="noreferrer" target="_blank">
              <ExternalLink size={17} />
              {t("teamReplyOn", { channel: t(`channel_${business.preference.channel}`) })}
            </a>
          ) : null}
        </section>

        <section className="card p-4 sm:p-5">
          <HelpThread businessName={business.name} locale={locale} messages={loaded.messages} side="team" />
        </section>
        <section className="card p-5">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t("teamReplyTitle")}</h2>
          <p className="mt-1 font-medium text-[var(--muted)]">{t("teamReplyNote")}</p>
          <div className="mt-3">
            <HelpCompose asTeam mode="reply" threadId={thread.id} />
          </div>
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <HelpStatusButton closed={closed} threadId={thread.id} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
