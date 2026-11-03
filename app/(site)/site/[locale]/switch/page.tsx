import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { siteLocale, type SiteParams } from "@/lib/site/static-page";
import { siteMetadata } from "@/lib/site/seo";
import { listSwitchPages } from "@/lib/site/switch";
import { JsonLd } from "../_components/content-ui";
import { FinalCta } from "../_components/final-cta";
import { Arrow, Container, Eyebrow, Plus, SITE_LINKS, SiteLink } from "../_components/site-ui";
import s from "../site.module.css";
import c from "../content.module.css";

const STEPS = [1, 2, 3];
const QUESTIONS = [1, 2, 3, 4];

export async function generateMetadata({ params }: SiteParams): Promise<Metadata> {
  await siteLocale(params);
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return siteMetadata({ path: "/switch", locale, title: m("metaSwitchTitle"), description: m("metaSwitchDescription") });
}

/**
 * "Switch to RoveHQ": how moving over works (export, upload, check and bring in, undo for 30 days), that we import it
 * for free, and a page per rental software with its own export steps. Plain names only, no logos.
 */
export default async function SwitchPage({ params }: SiteParams) {
  await siteLocale(params);
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  const pages = listSwitchPages(locale);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: QUESTIONS.map((n) => ({ "@type": "Question", name: m(`switchQ${n}`), acceptedAnswer: { "@type": "Answer", text: m(`switchA${n}`) } }))
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <section className={`${s.dark} ${s.hero} ${s.heroPlain}`}>
        <Container>
          <div className={s.rise}>
            <Eyebrow>{m("switchEyebrow")}</Eyebrow>
            <h1 className={`${s.h1} mt-6`}>{m("switchTitle")}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{m("switchBody")}</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <SiteLink className={`${s.btn} ${s.btnLight}`} href={SITE_LINKS.signUp}>
                {m("switchStart")}
              </SiteLink>
              <SiteLink className={s.link} href={SITE_LINKS.contact}>
                {m("switchAskUs")} <Arrow />
              </SiteLink>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="switch-how" className={s.section}>
        <Container>
          <h2 className={s.h3} id="switch-how">
            {m("switchHowTitle")}
          </h2>
          <ol className={`${c.grid} mt-6`}>
            {STEPS.map((n) => (
              <li className={c.card} key={n}>
                <span className={c.tag}>{m("switchStepLabel", { n })}</span>
                <h3 className={c.cardTitle}>{m(`switchStep${n}Title`)}</h3>
                <p className={c.cardBody}>{m(`switchStep${n}Body`)}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-3xl text-[17px] font-semibold">{m("switchFree")}</p>
        </Container>
      </section>

      <section aria-labelledby="switch-from" className={`${s.mist} ${s.section}`}>
        <Container>
          <h2 className={s.h3} id="switch-from">
            {m("switchFromTitle")}
          </h2>
          <p className="mt-2 max-w-3xl">{m("switchFromBody")}</p>
          <ul className={`${c.grid} mt-6`}>
            {pages.map((page) => (
              <li className={c.card} key={page.slug}>
                <h3 className={c.cardTitle}>
                  <SiteLink href={`/switch/${page.slug}`}>{page.software.name}</SiteLink>
                </h3>
                <p className={c.cardBody}>{page.description}</p>
              </li>
            ))}
            <li className={c.card}>
              <h3 className={c.cardTitle}>
                <SiteLink href="/docs/import-a-spreadsheet">{m("switchSpreadsheet")}</SiteLink>
              </h3>
              <p className={c.cardBody}>{m("switchSpreadsheetBody")}</p>
            </li>
          </ul>
          <p className="mt-6 max-w-3xl text-sm">{m("switchNames")}</p>
        </Container>
      </section>

      <section aria-labelledby="switch-faq" className={s.section}>
        <Container>
          <h2 className={s.h3} id="switch-faq">
            {m("articleFaqTitle")}
          </h2>
          <div className={`${s.faq} mt-6 max-w-3xl`}>
            {QUESTIONS.map((n) => (
              <details className={s.faqItem} key={n}>
                <summary>
                  {m(`switchQ${n}`)}
                  <Plus />
                </summary>
                <p>{m(`switchA${n}`)}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
