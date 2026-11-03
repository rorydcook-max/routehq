import Link from "next/link";
import type { Route } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { OpenChatButton } from "@/components/chat/open-chat-button";
import { PageBand } from "@/components/page-band";
import { HelpCompose } from "@/components/help/help-compose";
import { HelpGuides } from "@/components/help/help-guides";
import { DOC_CATEGORIES, docSearchIndex, listDocs, loadPublishedArticles } from "@/lib/site/docs";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { planById } from "@/lib/plans";
import { importIncluded, isPlatformAdmin, SUPPORT_TOPICS, type SupportTopic } from "@/lib/support";
import { countWaitingForTeam, listBusinessThreads } from "@/lib/support-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BANGKOK = "Asia/Bangkok";

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const [{ topic: askedTopic }, userEmail, organization, membership, t, locale] = await Promise.all([
    searchParams,
    getCurrentUserEmail(),
    getDefaultOrganization(),
    getCurrentMembership(),
    getTranslations("help"),
    getLocale()
  ]);
  const supabase = (await createSupabaseServerClient()) as any;
  // Articles approved from the team's content queue are fetched alongside, before the guide list is built.
  const [threads, team] = await Promise.all([listBusinessThreads(supabase, organization.id), isPlatformAdmin(supabase, membership?.userId), loadPublishedArticles()]);
  const waiting = team ? await countWaitingForTeam() : 0;
  const org = organization as any;
  const included = importIncluded(org);
  const plan = planById(org.subscription_tier);
  const initialTopic = (SUPPORT_TOPICS as readonly string[]).includes(String(askedTopic)) ? (askedTopic as SupportTopic) : "question";
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { timeZone: BANGKOK, day: "numeric", month: "short" }).format(new Date(iso));
  // The time too, so two conversations on the same day with the same subject can be told apart.
  const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: BANGKOK, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  // The how-to guides (the help centre's articles), searchable here before writing to us.
  const guides = docSearchIndex("en").map((entry) => ({ ...entry, video: Boolean(listDocs("en").find((doc) => doc.slug === entry.slug)?.video) }));

  return (
    <AppShell hero={<PageBand keepSubtitle subtitle={t("subtitle")} title={t("title")} />} userEmail={userEmail}>
      {/* Support happens here only (Rory, 3 Nov 2026): no WhatsApp/LINE/email options, every reply is a Help conversation. */}
      <div className="min-w-0 max-w-5xl space-y-4">

        {team ? (
          <Link className="card pressable flex items-center gap-3 p-4" href={"/platform/support" as Route}>
            <span className="font-bold text-[var(--foreground)]">{t("teamLink")}</span>
            <span className="ml-auto rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[14px] font-bold text-white">{waiting}</span>
            <ChevronRight size={18} />
          </Link>
        ) : null}

        {/* The live chat (Rory, 3 Nov 2026): the same panel as the round chat button on every page. The assistant
            answers first; "Talk to a person" brings in the RoveHQ team, and those chats are listed below too. */}
        <section className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6" id="live-chat">
          <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)]">
            <MessageCircle size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="card-title">{t("liveTitle")}</h2>
            <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{t("liveBody")}</p>
          </div>
          <OpenChatButton className="primary-action pressable shrink-0 justify-center" label={t("liveButton")} />
        </section>

        {guides.length ? (
          <section className="card p-5" id="guides">
            <h2 className="card-title">{t("guidesTitle")}</h2>
            <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{t("guidesBody")}</p>
            <div className="mt-3">
              <HelpGuides categories={[...DOC_CATEGORIES]} guides={guides} />
            </div>
          </section>
        ) : null}

        <section className="card p-5" id="write">
          <h2 className="card-title">{t("newTitle")}</h2>
          <div className="mt-3">
            <HelpCompose
              hints={{ import: included ? t("importIncluded", { plan: t(`plan_${plan.id}`) }) : t("importHelp") }}
              initialTopic={initialTopic}
              mode="new"
            />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="card-title">{t("yourConversations")}</h2>
          {threads.length ? (
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <Link className="flex items-center gap-3 py-3" href={`/help/${thread.id}` as Route}>
                    {thread.unread ? <span aria-label={t("newReply")} className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--primary)]" /> : null}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[16px] font-bold text-[var(--foreground)]">{thread.subject}</span>
                      <span className="block font-medium text-[var(--muted)]">
                        {t(`topic_${thread.topic}`)} · {date(thread.lastMessageAt)}, {time(thread.lastMessageAt)}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-bold ${thread.status === "answered" ? "bg-[var(--primary)] text-white" : "bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]"}`}>{t(`status_${thread.status}`)}</span>
                    <ChevronRight className="shrink-0 text-[var(--muted)]" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{t("noConversations")}</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
