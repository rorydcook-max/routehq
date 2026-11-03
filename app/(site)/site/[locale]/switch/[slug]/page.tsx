import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { siteLocale } from "@/lib/site/static-page";
import { siteMetadata, siteUrl } from "@/lib/site/seo";
import { getSwitchPage, listSwitchPages, SWITCH_LOCALE } from "@/lib/site/switch";
import { contentDate, JsonLd } from "../../_components/content-ui";
import { FinalCta } from "../../_components/final-cta";
import { Arrow, Container, Plus, SITE_LINKS, SiteLink } from "../../_components/site-ui";
import s from "../../site.module.css";
import c from "../../content.module.css";

type Props = { params: Promise<{ locale: string; slug: string }> };

// The English pages are drawn at build time (the addresses search engines index); other languages show the English
// page the first time they are asked for, then keep it (see docs/[slug]/page.tsx).
export function generateStaticParams() {
  return listSwitchPages(SWITCH_LOCALE).map((page) => ({ locale: SWITCH_LOCALE, slug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await siteLocale(params);
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const page = getSwitchPage(locale, slug);
  if (!page) notFound();
  const meta = siteMetadata({ path: `/switch/${slug}`, locale, title: page.title, description: page.description, available: [page.locale], type: "article" });
  return { ...meta, alternates: { ...meta.alternates, canonical: siteUrl(`/switch/${slug}`, page.locale) } };
}

/**
 * Moving from one rental software: how to get the data out of it (its own steps and help article), what comes across,
 * that RoveHQ imports it free, and common questions. Factual, plain names only, nothing said against the other product.
 */
export default async function SwitchFromPage({ params }: Props) {
  await siteLocale(params);
  const [{ slug }, locale, m] = await Promise.all([params, getLocale(), getTranslations("marketing")]);
  const page = getSwitchPage(locale, slug);
  if (!page) notFound();
  const name = page.software.name;
  const url = siteUrl(`/switch/${slug}`, page.locale);
  const jsonLd: unknown[] = [
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: page.title,
      description: page.description,
      inLanguage: page.locale,
      step: page.steps.map((text, index) => ({ "@type": "HowToStep", position: index + 1, text }))
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: m("breadcrumbHome"), item: siteUrl("/", "en") },
        { "@type": "ListItem", position: 2, name: m("switchEyebrow"), item: siteUrl("/switch", "en") },
        { "@type": "ListItem", position: 3, name: page.title, item: url }
      ]
    }
  ];
  if (page.faq.length) {
    jsonLd.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: page.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) });
  }

  return (
    <>
      <JsonLd data={jsonLd} />
      <section className={`${s.dark} ${s.hero} ${s.heroPlain} ${c.articleHero}`}>
        <Container>
          <div className={s.rise}>
            <nav aria-label={m("switchEyebrow")} className={c.crumbs}>
              <SiteLink href="/switch">{m("switchEyebrow")}</SiteLink>
              <span aria-hidden="true">/</span>
              <span>{name}</span>
            </nav>
            <h1 className={c.articleTitle}>{page.title}</h1>
            <p className={`${s.lede} ${c.articleLede}`}>{page.description}</p>
            <div className={c.byline}>
              <span className={c.bylineFacts}>{page.updated ? <time dateTime={page.updated}>{m("updatedOn", { date: contentDate(page.updated, locale) })}</time> : null}</span>
            </div>
          </div>
        </Container>
      </section>

      <section className={s.section}>
        <Container className="max-w-3xl">
          <article lang={page.locale}>
            {page.locale !== locale ? <p className="mb-6 text-sm">{m("switchEnglishOnly")}</p> : null}

            <h2 className={s.h3}>{m("switchGetOut", { name })}</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-6 text-[17px]">
              {page.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            {page.software.help ? (
              <p className="mt-4">
                <a className={s.link} href={page.software.help} rel="noopener noreferrer" target="_blank">
                  {m("switchHelpArticle", { name })} <Arrow />
                </a>
              </p>
            ) : null}

            {page.exports.length ? (
              <>
                <h2 className={`${s.h3} mt-12`}>{m("switchComesAcross")}</h2>
                <ul className="mt-4 list-disc space-y-1 pl-6 text-[17px]">
                  {page.exports.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className={`${c.prose} mt-12`} dangerouslySetInnerHTML={{ __html: page.html }} />

            <aside className={`${c.card} mt-12`}>
              <h2 className={c.cardTitle}>{m("switchFreeTitle")}</h2>
              <p className={c.cardBody}>{m("switchFreeBody", { name })}</p>
              <div className="mt-4 flex flex-wrap items-center gap-5">
                <SiteLink className={`${s.btn} ${s.btnInk}`} href={SITE_LINKS.signUp}>
                  {m("switchStart")}
                </SiteLink>
                <SiteLink className={s.link} href={SITE_LINKS.contact}>
                  {m("switchAskUs")} <Arrow />
                </SiteLink>
              </div>
            </aside>

            {page.faq.length ? (
              <section aria-labelledby="switch-faq" className="mt-12">
                <h2 className={s.h3} id="switch-faq">
                  {m("articleFaqTitle")}
                </h2>
                <div className={`${s.faq} mt-6`}>
                  {page.faq.map((item) => (
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

            <p className="mt-12 text-sm">{m("switchNames")}</p>
            <p className="mt-4">
              <SiteLink className={s.link} href="/switch">
                {m("switchAll")} <Arrow />
              </SiteLink>
            </p>
          </article>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
