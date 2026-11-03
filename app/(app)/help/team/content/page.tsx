import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
import { CollateButton, ContentRequestCard, type ContentCardData } from "@/components/help/content-requests";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { listContentRequestsForTeam, type ArticleDraft, type ContentRequest, type FaqDraft } from "@/lib/content-requests";
import { renderMarkdown } from "@/lib/site/content";
import { isPlatformAdmin } from "@/lib/support";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BANGKOK = "Asia/Bangkok";

/**
 * The help centre's content queue, for the RoveHQ team (platform admins only, like the rest of /help/team): what
 * people asked the assistant that the help centre couldn't answer, and the articles, FAQs, videos and resources they
 * asked for, grouped into requests. Nothing is published from here without an Approve click.
 */
export default async function HelpContentPage() {
  const [userEmail, membership, t, locale] = await Promise.all([getCurrentUserEmail(), getCurrentMembership(), getTranslations("help"), getLocale()]);
  const supabase = (await createSupabaseServerClient()) as any;
  if (!(await isPlatformAdmin(supabase, membership?.userId))) notFound();
  const { requests, questions } = await listContentRequestsForTeam();
  const date = (iso: string) => (iso ? new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { timeZone: BANGKOK, day: "numeric", month: "short" }).format(new Date(iso)) : "");

  // Plain data for the cards; a drafted article's preview is rendered here with the help centre's own Markdown renderer.
  const card = (request: ContentRequest): ContentCardData => {
    const article = request.kind === "article" && request.draft ? (request.draft as ArticleDraft) : null;
    const faq = request.kind === "faq" && request.draft ? (request.draft as FaqDraft) : null;
    return {
      id: request.id,
      kind: request.kind,
      status: request.status,
      title: request.title,
      summary: request.summary,
      targetSlug: request.targetSlug,
      askCount: request.askCount || request.questionIds.length,
      date: date(request.updatedAt),
      questions: request.questionIds
        .map((id) => questions[id])
        .filter(Boolean)
        .map((question) => ({ id: question.id, text: question.question, page: question.pathname, date: date(question.createdAt) })),
      article: article
        ? { title: article.frontmatter?.title || request.title, description: article.frontmatter?.description || "", body: article.body || "", html: renderMarkdown(article.body || "", "en").html, slug: article.slug || null }
        : null,
      faq: faq ? { q: faq.q, a: faq.a } : null
    };
  };

  const groups = [
    { key: "suggested", items: requests.filter((request) => request.status === "suggested") },
    { key: "drafted", items: requests.filter((request) => request.status === "drafted") },
    { key: "approved", items: requests.filter((request) => request.status === "approved") }
  ] as const;
  const closed = requests.filter((request) => request.status === "published" || request.status === "rejected");

  return (
    <AppShell userEmail={userEmail}>
      <div className="space-y-4">
        <div className="page-hero">
          {/* The conversations queue now lives in the admin console's helpdesk; this page is linked from there. */}
          <BackLink href="/platform/support" label="Support" />
          <h1 className="page-title">{t("contentTitle")}</h1>
          <p className="page-subtitle mt-2">{t("contentSubtitle")}</p>
        </div>
        <section className="card p-4 sm:p-5">
          <CollateButton />
        </section>

        {groups.map((group) => (
          <section className="space-y-2" key={group.key}>
            <h2 className="card-title px-1">
              {t(`contentSection_${group.key}`)} <span className="text-[var(--muted)]">· {group.items.length}</span>
            </h2>
            {group.items.length ? (
              group.items.map((request) => <ContentRequestCard data={card(request)} key={`${request.id}-${request.updatedAt}`} />)
            ) : (
              <p className="card p-4 font-medium text-[var(--foreground-secondary)]">{t(`contentEmpty_${group.key}`)}</p>
            )}
          </section>
        ))}

        {/* Decided requests stay out of the way: folded unless someone wants to look back. */}
        <details className="card p-4 sm:p-5">
          <summary className="card-title cursor-pointer">
            {t("contentSection_closed")} <span className="text-[var(--muted)]">· {closed.length}</span>
          </summary>
          <div className="mt-3 space-y-2">
            {closed.length ? closed.map((request) => <ContentRequestCard data={card(request)} key={`${request.id}-${request.updatedAt}`} />) : <p className="font-medium text-[var(--foreground-secondary)]">{t("contentEmpty_closed")}</p>}
          </div>
        </details>
      </div>
    </AppShell>
  );
}
