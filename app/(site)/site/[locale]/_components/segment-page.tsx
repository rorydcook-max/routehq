import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { PLANS } from "@/lib/plans";
import { breadcrumbLd, faqLd, softwareApplicationLd } from "@/lib/site/schema";
import { SEGMENT_IDS, SEGMENTS, type SegmentId } from "@/lib/site/segments";
import { siteMetadata, siteUrl } from "@/lib/site/seo";
import { siteLocale } from "@/lib/site/static-page";
import { translatedLocales } from "@/lib/site/own-translation";
import { JsonLd } from "./content-ui";
import { FinalCta } from "./final-cta";
import { Arrow, Container, Eyebrow, Plus, SITE_LINKS, SiteLink } from "./site-ui";
import s from "../site.module.css";
import c from "../content.module.css";

type Say = (key: string, values?: Record<string, string | number>) => string;
type Params = Promise<{ locale: string }>;

/** Numbers a segment's words may carry: each plan's motorbike allowance, from lib/plans.ts. */
function planNumbers() {
  const motorbikes = (id: string) => PLANS.find((plan) => plan.id === id)?.motorbikes ?? 0;
  const cars = (id: string) => PLANS.find((plan) => plan.id === id)?.cars ?? 0;
  return { free: motorbikes("free"), starter: motorbikes("starter"), pro: motorbikes("pro"), freeCars: cars("free") };
}

/**
 * Written in English first: a language is listed (hreflang, sitemap) once its file has the page's words; until then
 * its address shows the English page and points search engines at the English one, as the help centre does.
 */
async function segmentLanguages(id: SegmentId) {
  return translatedLocales(`marketing.seg${SEGMENTS[id].key}Title`);
}

export async function segmentMetadata(id: SegmentId, params: Params): Promise<Metadata> {
  await siteLocale(params);
  const [m, locale, available] = await Promise.all([getTranslations("marketing"), getLocale(), segmentLanguages(id)]);
  const say = m as unknown as Say;
  const segment = SEGMENTS[id];
  const shownIn = available.includes(locale) ? locale : "en";
  const meta = siteMetadata({
    path: segment.path,
    locale,
    title: say(`seg${segment.key}MetaTitle`),
    description: say(`seg${segment.key}MetaDescription`, planNumbers()),
    available,
    absoluteTitle: true
  });
  return { ...meta, alternates: { ...meta.alternates, canonical: siteUrl(segment.path, shownIn) } };
}

/**
 * RoveHQ for one kind of rental business: what it is (H1), a short intro, the six features that matter most for it
 * (each with its help article), common questions, the other kinds, and the site's last word. SoftwareApplication,
 * FAQPage and BreadcrumbList structured data. Same parts and look as the rest of the site.
 */
export async function SegmentPage({ id, params }: { id: SegmentId; params: Params }) {
  await siteLocale(params);
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  const say = m as unknown as Say;
  const segment = SEGMENTS[id];
  const k = segment.key;
  const numbers = planNumbers();
  const features = segment.features.map((doc, index) => ({ n: index + 1, doc, title: say(`seg${k}F${index + 1}Title`), body: say(`seg${k}F${index + 1}Body`, numbers) }));
  const questions = Array.from({ length: segment.questions }, (_, index) => ({ q: say(`seg${k}Q${index + 1}`, numbers), a: say(`seg${k}A${index + 1}`, numbers) }));
  const others = SEGMENT_IDS.filter((other) => other !== id).map((other) => SEGMENTS[other]);

  const jsonLd = [
    softwareApplicationLd({ description: say(`seg${k}MetaDescription`, numbers), locale }),
    faqLd(questions),
    breadcrumbLd(
      [
        { name: m("breadcrumbHome"), path: "/" },
        { name: say(segment.navKey), path: segment.path }
      ],
      locale
    )
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      <section className={`${s.dark} ${s.hero} ${s.heroPlain}`}>
        <Container>
          <div className={s.rise}>
            <Eyebrow>{say(`seg${k}Eyebrow`)}</Eyebrow>
            <h1 className={`${s.h1} mt-6`}>{say(`seg${k}Title`)}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{say(`seg${k}Intro`)}</p>
            <div className={s.heroActions}>
              <SiteLink className={`${s.btn} ${s.btnLight}`} href={SITE_LINKS.signUp}>
                {m("heroCta")}
              </SiteLink>
              <SiteLink className={s.link} href={SITE_LINKS.pricing}>
                {m("priceLink")} <Arrow />
              </SiteLink>
            </div>
            <p className={`${s.note} ${s.heroNote}`}>{m("heroNote")}</p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="segment-features" className={s.section}>
        <Container>
          <div className={s.head}>
            <h2 className={s.h2} id="segment-features">
              {say(`seg${k}FeaturesTitle`)}
            </h2>
          </div>
          <ul className={s.row4}>
            {features.map((feature) => (
              <li className={s.rowItem} key={feature.n}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
                <SiteLink className={`${s.link} mt-3`} href={feature.doc === "plans-and-billing" ? SITE_LINKS.pricing : `/docs/${feature.doc}`}>
                  {feature.doc === "plans-and-billing" ? m("priceLink") : m("segHowLink")} <Arrow size={16} />
                </SiteLink>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="segment-import" className={`${s.mist} ${s.section}`}>
        <Container className={s.twoCol}>
          <div className={s.head}>
            <h2 className={s.h2} id="segment-import">
              {m("importTitle")}
            </h2>
          </div>
          <div>
            <p className={s.body}>{m("importBody")}</p>
            <SiteLink className={`${s.link} mt-4`} href={SITE_LINKS.switch}>
              {m("navSwitch")} <Arrow />
            </SiteLink>
          </div>
        </Container>
      </section>

      <section aria-labelledby="segment-faq" className={s.section}>
        <Container className={s.twoCol}>
          <h2 className={s.h2} id="segment-faq">
            {m("faqTitle")}
          </h2>
          <div>
            <div className={s.faq}>
              {questions.map((item) => (
                <details className={s.faqItem} key={item.q}>
                  <summary>
                    {item.q}
                    <Plus />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
            <SiteLink className={`${s.link} mt-4`} href={SITE_LINKS.faq}>
              {m("faqSeeAll")} <Arrow />
            </SiteLink>
          </div>
        </Container>
      </section>

      <section aria-labelledby="segment-others" className={`${s.mist} ${s.section}`}>
        <Container>
          <h2 className={s.h3} id="segment-others">
            {m("segOthersTitle")}
          </h2>
          <div className={`${c.grid} mt-6`}>
            {others.map((other) => (
              <article className={c.card} key={other.id}>
                <h3 className={c.cardTitle}>
                  <SiteLink href={other.path}>{say(other.navKey)}</SiteLink>
                </h3>
                <p className={c.cardBody}>{say(`seg${other.key}Intro`)}</p>
              </article>
            ))}
            <article className={c.card}>
              <h3 className={c.cardTitle}>
                <SiteLink href={SITE_LINKS.docs}>{m("docsEyebrow")}</SiteLink>
              </h3>
              <p className={c.cardBody}>{m("docsBody")}</p>
            </article>
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
