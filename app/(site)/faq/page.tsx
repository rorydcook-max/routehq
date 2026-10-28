import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { siteMetadata } from "@/lib/site/seo";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { TRIAL_DAYS } from "@/lib/plans";
import { FinalCta } from "../_components/final-cta";
import { Container, Eyebrow, Plus, SITE_LINKS, SiteLink } from "../_components/site-ui";
import s from "../site.module.css";

/** The questions, in their groups (keys faqG<n>, faqQ<n>, faqA<n>). */
const GROUPS = [
  { id: "getting-started", key: "faqG1", questions: [1, 2, 3, 4] },
  { id: "bookings", key: "faqG2", questions: [5, 6, 7, 8] },
  { id: "payments", key: "faqG3", questions: [9, 10, 11] },
  { id: "plans", key: "faqG4", questions: [12, 13, 14, 15] },
  { id: "data", key: "faqG5", questions: [16, 17] }
];

/** Numbers some answers carry. */
const VALUES: Record<number, Record<string, number>> = {
  4: { count: supportedLocaleCodes.length },
  12: { days: TRIAL_DAYS }
};

export async function generateMetadata(): Promise<Metadata> {
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return siteMetadata({ path: "/faq", locale, title: m("metaFaqTitle"), description: m("metaFaqDescription") });
}

export default async function FaqPage() {
  const m = await getTranslations("marketing");
  const q = (n: number) => m(`faqQ${n}`);
  const a = (n: number) => m(`faqA${n}`, VALUES[n] || {});

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GROUPS.flatMap((group) => group.questions).map((n) => ({
      "@type": "Question",
      name: q(n),
      acceptedAnswer: { "@type": "Answer", text: a(n) }
    }))
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />

      <section className={`${s.dark} ${s.hero} ${s.heroPlain}`}>
        <Container>
          <div className={s.rise}>
            <Eyebrow>{m("faqPageEyebrow")}</Eyebrow>
            <h1 className={`${s.h1} mt-6`}>{m("faqPageTitle")}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{m("faqPageBody")}</p>
          </div>
        </Container>
      </section>

      <section className={s.section}>
        <Container className={s.faqLayout}>
          <nav aria-label={m("faqPageGroups")} className={s.faqToc}>
            <ul>
              {GROUPS.map((group) => (
                <li key={group.id}>
                  <a className={s.faqTocLink} href={`#${group.id}`}>
                    {m(group.key)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className={s.faqGroups}>
            {GROUPS.map((group) => (
              <section aria-labelledby={`${group.id}-title`} className={s.faqGroup} id={group.id} key={group.id}>
                <h2 className={s.faqGroupTitle} id={`${group.id}-title`}>
                  {m(group.key)}
                </h2>
                <div className={s.faq}>
                  {group.questions.map((n) => (
                    <details className={s.faqItem} key={n}>
                      <summary>
                        {q(n)}
                        <Plus />
                      </summary>
                      <p>{a(n)}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
            <div className={s.faqMore}>
              <p className={s.h3}>{m("faqPageMore")}</p>
              <SiteLink className={`${s.btn} ${s.btnInk}`} href={SITE_LINKS.contact}>
                {m("faqPageContact")}
              </SiteLink>
            </div>
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
