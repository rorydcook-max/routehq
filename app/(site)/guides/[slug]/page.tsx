import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getGuide, guideLocales, listGuides } from "@/lib/site/content";
import { siteMetadata, siteOrigin, siteUrl } from "@/lib/site/seo";
import { Avatar, CATEGORY_KEY, contentDate, GuideCard, JsonLd, LeadCard } from "../../_components/content-ui";
import { FinalCta } from "../../_components/final-cta";
import { Arrow, Container, Plus, SITE_LINKS, SiteLink } from "../../_components/site-ui";
import s from "../../site.module.css";
import c from "../../content.module.css";

type Props = { params: Promise<{ slug: string }> };
type Say = (key: string, values?: Record<string, string | number>) => string;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const guide = getGuide(locale, slug);
  // Here as well as in the page, so a missing guide (or translation) answers 404 before anything is streamed.
  if (!guide) notFound();
  const meta = siteMetadata({ path: `/guides/${slug}`, locale, title: guide.title, description: guide.description, available: guideLocales(slug), type: "article" });
  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      type: "article",
      publishedTime: guide.date || undefined,
      modifiedTime: guide.updated || undefined,
      section: guide.category,
      ...(guide.cover ? { images: [{ url: guide.cover }] } : {})
    }
  };
}

/** Splits the article before the H2 nearest its middle, where the free resource is offered. */
function halves(html: string): [string, string] {
  const parts = html.split(/(?=<h2 )/);
  if (parts.length < 4) return [html, ""];
  const middle = Math.ceil(parts.length / 2);
  return [parts.slice(0, middle).join(""), parts.slice(middle).join("")];
}

/**
 * A guide: a compact dark hero (topic, title, description, author, updated, reading time), then the text in a 720px
 * column with the contents beside it from 1024px, the free resource mid-way and at the end, questions, the author,
 * related guides and the site's last word. Article, BreadcrumbList and (with questions) FAQPage structured data.
 */
export default async function GuidePage({ params }: Props) {
  const [{ slug }, locale, m] = await Promise.all([params, getLocale(), getTranslations("marketing")]);
  const guide = getGuide(locale, slug);
  if (!guide) notFound();
  const say = m as unknown as Say;
  const author = m("authorName");
  const topic = m(CATEGORY_KEY[guide.category]);
  const [first, second] = halves(guide.html);
  const related = listGuides(locale)
    .filter((item) => item.slug !== slug && item.category === guide.category)
    .slice(0, 3);
  const url = siteUrl(`/guides/${slug}`, locale);

  const jsonLd: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      inLanguage: locale,
      datePublished: guide.date || undefined,
      dateModified: guide.updated || undefined,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      ...(guide.cover ? { image: guide.cover.startsWith("http") ? guide.cover : `${siteOrigin()}${guide.cover}` } : {}),
      author: { "@type": "Person", name: author, jobTitle: m("authorRole"), description: m("authorBio") },
      publisher: { "@type": "Organization", name: "RoveHQ", url: siteOrigin(), logo: { "@type": "ImageObject", url: `${siteOrigin()}/routehq-logo.svg` } }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: m("breadcrumbHome"), item: siteUrl("/", locale) },
        { "@type": "ListItem", position: 2, name: m("navGuides"), item: siteUrl("/guides", locale) },
        { "@type": "ListItem", position: 3, name: topic, item: siteUrl(`/guides/category/${guide.category}`, locale) },
        { "@type": "ListItem", position: 4, name: guide.title, item: url }
      ]
    }
  ];
  if (guide.faq.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: guide.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } }))
    });
  }

  return (
    <>
      <JsonLd data={jsonLd} />

      <section className={`${s.dark} ${s.hero} ${s.heroPlain} ${c.articleHero}`}>
        <Container>
          <div className={s.rise}>
            <nav aria-label={m("navGuides")} className={c.crumbs}>
              <SiteLink href={SITE_LINKS.guides}>{m("navGuides")}</SiteLink>
              <span aria-hidden="true">/</span>
              <SiteLink href={`/guides/category/${guide.category}`}>{topic}</SiteLink>
            </nav>
            <h1 className={c.articleTitle}>{guide.title}</h1>
            <p className={`${s.lede} ${c.articleLede}`}>{guide.description}</p>
            <div className={c.byline}>
              <span className={c.bylineName}>
                <Avatar name={author} />
                {m("byAuthor", { name: author })}
              </span>
              <span className={c.bylineFacts}>
                <time dateTime={guide.updated}>{m("updatedOn", { date: contentDate(guide.updated, locale) })}</time>
                <span>{m("readTime", { minutes: guide.readingMinutes })}</span>
              </span>
            </div>
          </div>
        </Container>
      </section>

      <section className={s.section}>
        <Container className={c.articleLayout}>
          {guide.headings.length > 1 ? (
            <nav aria-labelledby="toc-title" className={c.toc}>
              <p className={c.tocTitle} id="toc-title">
                {m("onThisPage")}
              </p>
              <ul>
                {guide.headings.map((heading) => (
                  <li key={heading.id}>
                    <a className={c.tocLink} dangerouslySetInnerHTML={{ __html: heading.html }} href={`#${heading.id}`} />
                  </li>
                ))}
              </ul>
            </nav>
          ) : (
            <div aria-hidden="true" className={c.toc} />
          )}
          <article className={c.articleMain}>
            <div className={c.prose} dangerouslySetInnerHTML={{ __html: first }} />
            {second ? (
              <>
                {guide.leadMagnet ? <LeadCard slug={guide.leadMagnet} /> : null}
                <div className={c.prose} dangerouslySetInnerHTML={{ __html: second }} />
              </>
            ) : null}

            {guide.faq.length ? (
              <section aria-labelledby="guide-faq" className={c.afterBlock}>
                <h2 className={c.afterTitle} id="guide-faq">
                  {m("articleFaqTitle")}
                </h2>
                <div className={s.faq}>
                  {guide.faq.map((item) => (
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

            {guide.leadMagnet ? <LeadCard slug={guide.leadMagnet} /> : null}

            <aside aria-label={m("byAuthor", { name: author })} className={c.author}>
              <Avatar large name={author} />
              <div>
                <p className={c.authorName}>{author}</p>
                <p className={c.authorRole}>{m("authorRole")}</p>
                <p className={c.authorBio}>{m("authorBio")}</p>
              </div>
            </aside>
          </article>
        </Container>
      </section>

      {related.length ? (
        <section aria-labelledby="related-title" className={`${s.mist} ${s.section}`}>
          <Container>
            <div className={c.relatedHead}>
              <h2 className={s.h3} id="related-title">
                {m("relatedGuides")}
              </h2>
              <SiteLink className={s.link} href={SITE_LINKS.guides}>
                {m("guidesSeeAll")} <Arrow />
              </SiteLink>
            </div>
            <div className={c.grid}>
              {related.map((item) => (
                <GuideCard guide={item} key={item.slug} locale={locale} m={say} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      <FinalCta />
    </>
  );
}
