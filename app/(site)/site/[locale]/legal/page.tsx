import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { listLegalDocs } from "@/lib/site/legal";
import { siteLocale, type SiteParams } from "@/lib/site/static-page";
import { siteMetadata } from "@/lib/site/seo";
import { contentDate } from "../_components/content-ui";
import { Container, Eyebrow, SiteLink } from "../_components/site-ui";
import s from "../site.module.css";
import l from "./legal.module.css";

export async function generateMetadata({ params }: SiteParams): Promise<Metadata> {
  await siteLocale(params);
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return siteMetadata({ path: "/legal", locale, title: m("legalIndexTitle"), description: m("legalIndexBody") });
}

/** The legal pages in one place: privacy policy, terms, DPA, sub-processors, cookies. */
export default async function LegalIndexPage({ params }: SiteParams) {
  await siteLocale(params);
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  const docs = listLegalDocs(locale);
  return (
    <>
      <section className={`${s.dark} ${s.hero} ${s.heroPlain}`}>
        <Container>
          <div className={s.rise}>
            <Eyebrow>{m("footerLegal")}</Eyebrow>
            <h1 className={`${s.h1} mt-6`}>{m("legalIndexTitle")}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{m("legalIndexBody")}</p>
          </div>
        </Container>
      </section>
      <section className={s.section}>
        <Container>
          <p className={l.notice}>{m("legalNotReviewed")}</p>
          <div className={l.list}>
            {docs.map((doc) => (
              <SiteLink className={l.item} href={`/legal/${doc.slug}`} key={doc.slug}>
                <span className={l.itemTitle}>{doc.title}</span>
                <span className={l.itemBody}>{doc.description}</span>
                {doc.updated ? <span className={l.itemDate}>{m("legalUpdated", { date: contentDate(doc.updated, locale) })}</span> : null}
              </SiteLink>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
