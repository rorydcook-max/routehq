import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { DOC_CATEGORY_KEY, DOCS_LOCALE, getDoc, listDocs, loadPublishedArticles } from "@/lib/site/docs";
import { siteLocale } from "@/lib/site/static-page";
import { siteMetadata, siteOrigin, siteUrl } from "@/lib/site/seo";
import { contentDate, JsonLd } from "../../_components/content-ui";
import { Arrow, Container, Plus, SITE_LINKS, SiteLink } from "../../_components/site-ui";
import s from "../../site.module.css";
import c from "../../content.module.css";
import d from "../docs.module.css";

type Props = { params: Promise<{ locale: string; slug: string }> };

// Approved articles and extra questions come from the database (lib/site/docs.ts): each article is drawn again at most
// hourly, and straight away when the content queue publishes (lib/content-requests.ts revalidates it).
export const revalidate = 3600;

// The English articles are drawn at build time (the addresses search engines index); the other languages' copies, and
// articles published from the queue since, the first time they are asked for, then kept. (The language is listed with
// each: see guides/[slug]/page.tsx.)
export async function generateStaticParams() {
  await loadPublishedArticles();
  return listDocs(DOCS_LOCALE).map((doc) => ({ locale: DOCS_LOCALE, slug: doc.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await siteLocale(params);
  // Articles and extra questions approved from the team's content queue live in the database: fetched first.
  const [{ slug }, locale] = await Promise.all([params, getLocale(), loadPublishedArticles()]);
  const doc = getDoc(locale, slug);
  if (!doc) notFound();
  // Shown in every language, written in English for now: the English address is the one to index.
  const meta = siteMetadata({ path: `/docs/${slug}`, locale, title: doc.title, description: doc.description, available: [doc.locale], type: "article" });
  return {
    ...meta,
    alternates: { ...meta.alternates, canonical: siteUrl(`/docs/${slug}`, doc.locale) },
    openGraph: { ...meta.openGraph, type: "article", modifiedTime: doc.updated || undefined, ...(doc.poster ? { images: [{ url: doc.poster }] } : {}) }
  };
}

/**
 * A help article: the topic and title, the screen recording when there is one, the steps with the contents beside them,
 * common questions, a button into that part of RoveHQ, related articles and where to ask if still stuck.
 * TechArticle, BreadcrumbList, FAQPage and VideoObject structured data.
 */
export default async function DocPage({ params }: Props) {
  await siteLocale(params);
  const [{ slug }, locale, m] = await Promise.all([params, getLocale(), getTranslations("marketing"), loadPublishedArticles()]);
  const doc = getDoc(locale, slug);
  if (!doc) notFound();
  const topic = m(DOC_CATEGORY_KEY[doc.category] as never);
  const all = listDocs(locale);
  const related = doc.related.map((item) => all.find((entry) => entry.slug === item)).filter((entry): entry is (typeof all)[number] => Boolean(entry)).slice(0, 4);
  const url = siteUrl(`/docs/${slug}`, doc.locale);
  // The app screen to open: only fixed addresses (a vehicle's own page needs a vehicle).
  const openPath = doc.appPath && !doc.appPath.includes("[") ? doc.appPath : "";
  // The questions have their own block below the steps.
  const headings = doc.faq.length ? doc.headings.filter((heading) => heading.id !== "common-questions") : doc.headings;

  const jsonLd: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: doc.title,
      description: doc.description,
      inLanguage: doc.locale,
      dateModified: doc.updated || undefined,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      about: { "@type": "SoftwareApplication", name: "RoveHQ", applicationCategory: "BusinessApplication", operatingSystem: "Web" },
      publisher: { "@type": "Organization", name: "RoveHQ", url: siteOrigin(), logo: { "@type": "ImageObject", url: `${siteOrigin()}/routehq-logo.svg` } }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: m("breadcrumbHome"), item: siteUrl("/", "en") },
        { "@type": "ListItem", position: 2, name: m("docsEyebrow"), item: siteUrl("/docs", "en") },
        { "@type": "ListItem", position: 3, name: doc.title, item: url }
      ]
    }
  ];
  if (doc.faq.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: doc.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } }))
    });
  }
  if (doc.video) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: doc.title,
      description: doc.description,
      contentUrl: doc.video,
      ...(doc.poster ? { thumbnailUrl: doc.poster } : {}),
      uploadDate: doc.updated || undefined
    });
  }

  return (
    <>
      <JsonLd data={jsonLd} />

      <section className={`${s.dark} ${s.hero} ${s.heroPlain} ${c.articleHero}`}>
        <Container>
          <div className={s.rise}>
            <nav aria-label={m("docsEyebrow")} className={c.crumbs}>
              <SiteLink href="/docs">{m("docsEyebrow")}</SiteLink>
              <span aria-hidden="true">/</span>
              <SiteLink href={`/docs#${doc.category}`}>{topic}</SiteLink>
            </nav>
            <h1 className={c.articleTitle}>{doc.title}</h1>
            <p className={`${s.lede} ${c.articleLede}`}>{doc.description}</p>
            <div className={c.byline}>
              <span className={c.bylineFacts}>
                {doc.updated ? <time dateTime={doc.updated}>{m("updatedOn", { date: contentDate(doc.updated, locale) })}</time> : null}
                <span>{m("readTime", { minutes: doc.readingMinutes })}</span>
              </span>
            </div>
            {openPath ? (
              <a className={d.appButton} href={openPath}>
                {m("docsOpenApp")} <Arrow />
              </a>
            ) : null}
          </div>
        </Container>
      </section>

      <section className={s.section}>
        <Container className={c.articleLayout}>
          {headings.length > 1 ? (
            <nav aria-labelledby="toc-title" className={c.toc}>
              <p className={c.tocTitle} id="toc-title">
                {m("onThisPage")}
              </p>
              <ul>
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a className={c.tocLink} dangerouslySetInnerHTML={{ __html: heading.html }} href={`#${heading.id}`} />
                  </li>
                ))}
              </ul>
            </nav>
          ) : (
            <div aria-hidden="true" className={c.toc} />
          )}
          <article className={c.articleMain} lang={doc.locale}>
            {doc.locale !== locale ? <p className={d.note}>{m("docsEnglishOnly")}</p> : null}
            {doc.video ? (
              <video aria-label={m("docsVideoLabel", { title: doc.title })} className={d.video} controls playsInline poster={doc.poster || undefined} preload="metadata" src={doc.video} />
            ) : null}
            <div className={c.prose} dangerouslySetInnerHTML={{ __html: doc.faq.length ? doc.html.replace(/<h2 id="common-questions">[\s\S]*$/, "") : doc.html }} />

            {doc.faq.length ? (
              <section aria-labelledby="doc-faq" className={c.afterBlock}>
                <h2 className={c.afterTitle} id="doc-faq">
                  {m("articleFaqTitle")}
                </h2>
                <div className={s.faq}>
                  {doc.faq.map((item) => (
                    <details className={s.faqItem} key={item.q}>
                      <summary>
                        {item.q}
                        <Plus />
                      </summary>
                      <p>{item.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            <aside className={d.stuck}>
              <p className={d.stuckTitle}>{m("docsStuck")}</p>
              <p className={d.stuckBody}>{m("docsStuckBody")}</p>
              <SiteLink className={`${s.link} mt-3`} href={SITE_LINKS.contact}>
                {m("docsContact")} <Arrow />
              </SiteLink>
            </aside>
          </article>
        </Container>
      </section>

      {related.length ? (
        <section aria-labelledby="related-title" className={`${s.mist} ${s.section}`}>
          <Container>
            <div className={c.relatedHead}>
              <h2 className={s.h3} id="related-title">
                {m("docsRelated")}
              </h2>
              <SiteLink className={s.link} href="/docs">
                {m("docsAll")} <Arrow />
              </SiteLink>
            </div>
            <div className={c.grid}>
              {related.map((item) => (
                <article className={c.card} key={item.slug}>
                  <span className={c.tag}>{m(DOC_CATEGORY_KEY[item.category] as never)}</span>
                  <h3 className={c.cardTitle}>
                    <SiteLink href={`/docs/${item.slug}`}>{item.title}</SiteLink>
                  </h3>
                  <p className={c.cardBody}>{item.description}</p>
                </article>
              ))}
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
