import Link from "next/link";
import type { Route } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Mail, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageBand } from "@/components/page-band";
import { HelpPreference } from "@/components/help/help-actions";
import { HelpCompose } from "@/components/help/help-compose";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { planById } from "@/lib/plans";
import { importIncluded, isPlatformAdmin, supportContacts, supportPreference, SUPPORT_TOPICS, type SupportTopic } from "@/lib/support";
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
  const [threads, team] = await Promise.all([listBusinessThreads(supabase, organization.id), isPlatformAdmin(supabase, membership?.userId)]);
  const waiting = team ? await countWaitingForTeam() : 0;
  const contacts = supportContacts();
  const preference = supportPreference(organization.settings);
  const org = organization as any;
  const included = importIncluded(org);
  const plan = planById(org.subscription_tier);
  const initialTopic = (SUPPORT_TOPICS as readonly string[]).includes(String(askedTopic)) ? (askedTopic as SupportTopic) : "question";
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { timeZone: BANGKOK, day: "numeric", month: "short" }).format(new Date(iso));
  const hasDirect = Boolean(contacts.whatsappUrl || contacts.lineUrl || contacts.email);

  return (
    <AppShell hero={<PageBand keepSubtitle subtitle={t("subtitle")} title={t("title")} />} userEmail={userEmail}>
      <div className="max-w-3xl space-y-4">

        {team ? (
          <Link className="card pressable flex items-center gap-3 p-4" href={"/help/team" as Route}>
            <span className="font-bold text-[var(--foreground)]">{t("teamLink")}</span>
            <span className="ml-auto rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[14px] font-bold text-white">{waiting}</span>
            <ChevronRight size={18} />
          </Link>
        ) : null}

        <section className="card p-5" id="write">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t("newTitle")}</h2>
          <div className="mt-3">
            <HelpCompose
              hints={{ import: included ? t("importIncluded", { plan: t(`plan_${plan.id}`) }) : t("importHelp") }}
              initialTopic={initialTopic}
              mode="new"
            />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t("yourConversations")}</h2>
          {threads.length ? (
            <ul className="mt-2 divide-y divide-[var(--border)]">
              {threads.map((thread) => (
                <li key={thread.id}>
                  <Link className="flex items-center gap-3 py-3" href={`/help/${thread.id}` as Route}>
                    {thread.unread ? <span aria-label={t("newReply")} className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--primary)]" /> : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-bold text-[var(--foreground)]">{thread.subject}</span>
                      <span className="block font-medium text-[var(--muted)]">
                        {t(`topic_${thread.topic}`)} · {date(thread.lastMessageAt)}
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

        <section className="card p-5">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t("prefTitle")}</h2>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{t("prefBody")}</p>
          <div className="mt-3">
            <HelpPreference
              canEdit={membership?.role === "owner"}
              channel={preference.channel}
              handle={preference.handle}
              suggestions={{ whatsapp: String(org.whatsapp || org.business_phone || ""), line: String(org.line_id || ""), email: String(org.business_email || userEmail || "") }}
            />
          </div>
        </section>

        {hasDirect ? (
          <section className="card p-5">
            <h2 className="text-[17px] font-bold text-[var(--foreground)]">{t("directTitle")}</h2>
            <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{t("directBody")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {contacts.whatsappUrl ? (
                <a className="secondary-action pressable" href={contacts.whatsappUrl} rel="noreferrer" target="_blank">
                  <MessageCircle size={17} />
                  WhatsApp
                </a>
              ) : null}
              {contacts.lineUrl ? (
                <a className="secondary-action pressable" href={contacts.lineUrl} rel="noreferrer" target="_blank">
                  <MessageCircle size={17} />
                  LINE {contacts.line}
                </a>
              ) : null}
              {contacts.email ? (
                <a className="secondary-action pressable" href={`mailto:${contacts.email}`}>
                  <Mail size={17} />
                  {contacts.email}
                </a>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
