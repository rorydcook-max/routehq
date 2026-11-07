import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { getLegalDoc, LEGAL_LOCALE } from "@/lib/site/legal";
import { LEGAL_SLUGS } from "@/lib/site/legal-slugs";
import { siteLocale } from "@/lib/site/static-page";
import { siteMetadata, siteUrl } from "@/lib/site/seo";
import { breadcrumbLd, schemaDateTime } from "@/lib/site/schema";
import { contentDate, JsonLd } from "../../_components/content-ui";
import { Container, SiteLink } from "../../_components/site-ui";
import s from "../../site.module.css";
import c from "../../content.module.css";
import l from "../legal.module.css";

type Props = { params: Promise<{ locale: string; slug: string }> };

// Every legal page in every language, drawn at build time (English text for now: lib/site/legal.ts).
export function generateStaticParams() {
  return supportedLocaleCodes.flatMap((locale) => LEGAL_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await siteLocale(params);
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const doc = getLegalDoc(locale, slug);
  if (!doc) notFound();
  const meta = siteMetadata({ path: `/legal/${slug}`, locale, title: doc.title, description: doc.description, available: [doc.locale] });
  // Written in English for now: the English address is the one to index.
  return { ...meta, alternates: { ...meta.alternates, canonical: siteUrl(`/legal/${slug}`, doc.locale) } };
}

/** A legal page: privacy policy, terms of service, data processing agreement, sub-processors or cookie policy. */
export default async function LegalPage({ params }: Props) {
  await siteLocale(params);
  const [{ slug }, locale, m] = await Promise.all([params, getLocale(), getTranslations("marketing")]);
  const doc = getLegalDoc(locale, slug);
  if (!doc) notFound();
  const url = siteUrl(`/legal/${slug}`, doc.locale);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: doc.title,
            description: doc.description,
            inLanguage: doc.locale,
            dateModified: schemaDateTime(doc.updated),
            url
          },
          breadcrumbLd(
            [
              { name: m("breadcrumbHome"), path: "/" },
              { name: m("footerLegal"), path: "/legal" },
              { name: doc.title, path: `/legal/${slug}` }
            ],
            doc.locale
          )
        ]}
      />

      <section className={`${s.dark} ${s.hero} ${s.heroPlain} ${c.articleHero}`}>
        <Container>
          <div className={s.rise}>
            <nav aria-label={m("footerLegal")} className={c.crumbs}>
              <SiteLink href="/legal">{m("footerLegal")}</SiteLink>
            </nav>
            <h1 className={c.articleTitle}>{doc.title}</h1>
            <p className={`${s.lede} ${c.articleLede}`}>{doc.description}</p>
            {doc.updated ? (
              <div className={c.byline}>
                <span className={c.bylineFacts}>
                  <time dateTime={doc.updated}>{m("legalUpdated", { date: contentDate(doc.updated, locale) })}</time>
                </span>
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      <section className={s.section}>
        <Container className={c.articleLayout}>
          {doc.headings.length > 1 ? (
            <nav aria-labelledby="toc-title" className={c.toc}>
              <p className={c.tocTitle} id="toc-title">
                {m("onThisPage")}
              </p>
              <ul>
                {doc.headings.map((heading) => (
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
            {doc.locale !== locale && locale !== LEGAL_LOCALE ? <p className={l.notice}>{m("legalEnglishOnly")}</p> : null}
            <div className={c.prose} dangerouslySetInnerHTML={{ __html: doc.html }} />
          </article>
        </Container>
      </section>
    </>
  );
}
