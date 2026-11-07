import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { siteLocale, type SiteParams } from "@/lib/site/static-page";
import { DOC_CATEGORIES, DOC_CATEGORY_KEY, docSearchIndex, listDocs, loadPublishedArticles } from "@/lib/site/docs";
import { localizeSitePath } from "@/lib/site/locale-path";
import { siteMetadata, siteUrl } from "@/lib/site/seo";
import { breadcrumbLd } from "@/lib/site/schema";
import { JsonLd } from "../_components/content-ui";
import { FinalCta } from "../_components/final-cta";
import { Container, Eyebrow, SiteLink } from "../_components/site-ui";
import { DocsSearch } from "./docs-search";
import s from "../site.module.css";
import d from "./docs.module.css";

// Articles approved from the team's content queue live in the database (lib/site/docs.ts): the page is drawn again at
// most hourly, and straight away when one is published (lib/content-requests.ts revalidates it).
export const revalidate = 3600;

export async function generateMetadata({ params }: SiteParams): Promise<Metadata> {
  await siteLocale(params);
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  // English only for now: every language's address points search engines at the English page.
  const meta = siteMetadata({ path: "/docs", locale, title: m("metaDocsTitle"), description: m("metaDocsDescription"), available: ["en"] });
  return { ...meta, alternates: { ...meta.alternates, canonical: siteUrl("/docs", "en") } };
}

/**
 * The help centre (Rory, 2 Nov 2026): a search box, then every article in its section, each with a play mark when it
 * has a video. Public, so search engines find "how do I…" answers; the app's Help page and "?" links open the same pages.
 */
export default async function DocsPage({ params }: SiteParams) {
  await siteLocale(params);
  // Articles approved from the team's content queue live in the database: fetched before the lists are built.
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale(), loadPublishedArticles()]);
  const docs = listDocs(locale);
  const href = (slug: string) => localizeSitePath(`/docs/${slug}`, locale);
  const entries = docSearchIndex(locale).map((entry) => ({ href: href(entry.slug), title: entry.title, description: entry.description, text: entry.text }));
  const sections = DOC_CATEGORIES.map((category) => ({ category, docs: docs.filter((doc) => doc.category === category) })).filter((section) => section.docs.length);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: m("metaDocsTitle"),
            description: m("metaDocsDescription"),
            url: siteUrl("/docs", "en"),
            hasPart: docs.map((doc) => ({ "@type": "TechArticle", headline: doc.title, url: siteUrl(`/docs/${doc.slug}`, "en") }))
          },
          breadcrumbLd(
            [
              { name: m("breadcrumbHome"), path: "/" },
              { name: m("docsEyebrow"), path: "/docs" }
            ],
            "en"
          )
        ]}
      />
      <section className={`${s.dark} ${s.hero} ${s.heroPlain}`}>
        <Container>
          <div className={s.rise}>
            <Eyebrow>{m("docsEyebrow")}</Eyebrow>
            <h1 className={`${s.h1} mt-6`}>{m("docsTitle")}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{m("docsBody")}</p>
            <DocsSearch empty={m("docsNoResults")} entries={entries} placeholder={m("docsSearch")} />
          </div>
        </Container>
      </section>

      <section className={s.section}>
        <Container>
          {locale !== "en" ? <p className={d.note}>{m("docsEnglishOnly")}</p> : null}
          <div className={d.sections}>
            {sections.map((section) => (
              <section aria-labelledby={`cat-${section.category}`} className={d.section} id={section.category} key={section.category}>
                <h2 className={d.sectionTitle} id={`cat-${section.category}`}>
                  {m(DOC_CATEGORY_KEY[section.category] as never)}
                </h2>
                <p className={d.sectionCount}>{m("docsArticles", { count: section.docs.length })}</p>
                <ul className={d.list}>
                  {section.docs.map((doc) => (
                    <li key={doc.slug}>
                      <SiteLink className={d.listLink} href={`/docs/${doc.slug}`}>
                        {doc.video ? (
                          <svg aria-label={m("docsHasVideo")} className={d.play} fill="currentColor" height="16" role="img" viewBox="0 0 24 24" width="16">
                            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
                          </svg>
                        ) : (
                          <svg aria-hidden="true" className={d.play} fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16">
                            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        <span>{doc.title}</span>
                      </SiteLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
