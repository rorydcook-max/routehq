import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { numberLocale } from "@/lib/i18n/dates";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { PLANS, TRIAL_DAYS, fleetText } from "@/lib/plans";
import { formatPlanPrice, planPrices } from "@/lib/plan-currency";
import { visitorCurrency } from "@/lib/site-currency";
import { BookingPhoneMock, DashboardWindowMock, HandoverPhoneMock, ImportMock, LedgerCard, PassportCard, PaymentPhoneMock, ReturnCard, ShopPageMock, TodayPhoneMock, sampleMoney } from "../_components/mockups";
import { Arrow, Check, Container, Eyebrow, Plus, RICH, RICH_SERIF, SITE_LINKS, SiteLink } from "../_components/site-ui";
import { FinalCta } from "../_components/final-cta";
import s from "../site.module.css";

type Say = (key: string, values?: Record<string, string | number>) => string;

export async function generateMetadata(): Promise<Metadata> {
  const m = await getTranslations("marketing");
  const title = m("metaTitle");
  const description = m("metaDescription");
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: { type: "website", url: "/", siteName: "RouteHQ", title, description },
    twitter: { card: "summary_large_image", title, description }
  };
}

export default async function SiteHomePage() {
  const [m, t, settings, locale, currency, money] = await Promise.all([getTranslations("marketing"), getTranslations("site"), getTranslations("settingsPage"), getLocale(), visitorCurrency(), sampleMoney()]);
  const say = settings as unknown as Say;
  const nl = numberLocale(locale);
  const price = (amount: number) => formatPlanPrice(amount, currency, nl);

  const steps: Array<{ n: string; key: string; phone: ReactNode; card: ReactNode; dark?: boolean }> = [
    { n: "01", key: "step1", phone: <BookingPhoneMock />, card: <PassportCard /> },
    { n: "02", key: "step2", phone: <HandoverPhoneMock />, card: <ReturnCard />, dark: true },
    { n: "03", key: "step3", phone: <PaymentPhoneMock />, card: <LedgerCard /> }
  ];
  const stats = [
    { label: t("mockOverdue", { count: 1 }), colour: "#d14343" },
    { label: t("mockForToday", { count: 3 }), colour: "#12bcb8" },
    { label: t("mockGoingOut", { count: 2 }), colour: "#4a9ad8" }
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RouteHQ",
    url: "https://routehq.app",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Vehicle rental management",
    operatingSystem: "Web, Android, iOS",
    description: m("metaDescription"),
    inLanguage: [...supportedLocaleCodes],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "THB",
      lowPrice: Math.min(...PLANS.map((plan) => plan.monthly)),
      highPrice: Math.max(...PLANS.map((plan) => plan.monthly)),
      offerCount: PLANS.length
    },
    publisher: { "@type": "Organization", name: "RouteHQ", url: "https://routehq.app", logo: "https://routehq.app/routehq-logo.svg" }
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />

      {/* 1. Hero: the promise, then the product, running onto the white below */}
      <section className={`${s.dark} ${s.hero}`}>
        <Container>
          <div className={s.rise}>
            <Eyebrow>{m("heroEyebrow")}</Eyebrow>
            <h1 className={`${s.h1} mt-6`}>{m.rich("heroTitle", RICH_SERIF)}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{m("heroBody")}</p>
            <div className={s.heroActions}>
              <SiteLink className={`${s.btn} ${s.btnLight}`} href={SITE_LINKS.signUp}>
                {m("heroCta")}
              </SiteLink>
              <SiteLink className={s.link} href="#how">
                {m("heroSecondary")} <Arrow />
              </SiteLink>
            </div>
            <p className={`${s.note} ${s.heroNote}`}>{m("heroNote")}</p>
          </div>
          <div className={`${s.stage} ${s.rise}`}>
            <div className={s.stageDesk}>
              <DashboardWindowMock />
              <div className={s.stagePhone}>
                <BookingPhoneMock />
              </div>
            </div>
            <div className={s.stageMobile}>
              <TodayPhoneMock />
            </div>
          </div>
        </Container>
      </section>

      {/* 2. On autopilot: what RouteHQ did this morning without anyone touching it, then the plain facts */}
      <section aria-label={t("proofLabel")} className={s.sectionBottom}>
        <Container>
          <div className={s.auto}>
            <p className={s.autoTitle}>{m("autoTitle")}</p>
            <ol className={s.autoFeed}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <li className={s.autoItem} key={n}>
                  <Check />
                  <span className={s.autoText}>{m(`auto${n}`)}</span>
                  <time className={s.autoTime}>{m(`auto${n}Time`)}</time>
                </li>
              ))}
            </ol>
          </div>
          <ul className={s.facts}>
            {[1, 2, 3, 4].map((n) => (
              <li className={s.fact} key={n}>
                <strong>{m(`fact${n}Title`)}</strong>
                <span>{m(`fact${n}Body`)}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 3. Things you'll never do again: the old jobs, struck through */}
      <section className={`${s.mist} ${s.section}`}>
        <Container>
          <div className={s.head}>
            <Eyebrow>{m("neverEyebrow")}</Eyebrow>
            <h2 className={s.h2}>{m("neverTitle")}</h2>
          </div>
          <ul className={s.never}>
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n}>
                <s>{m(`never${n}`)}</s>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 4. How it works */}
      <section className={s.section} id="how">
        <Container>
          <div className={s.head}>
            <Eyebrow>{m("howEyebrow")}</Eyebrow>
            <h2 className={s.h2}>{m.rich("howTitle", RICH)}</h2>
          </div>
          <div className={s.steps}>
            {steps.map((step, index) => (
              <article className={`${s.stepRow} ${index % 2 ? s.stepRowFlip : ""} ${step.dark ? `${s.dark} ${s.stepPanel}` : ""}`} key={step.key}>
                <div className={s.stepText}>
                  <p aria-hidden="true" className={s.stepNum}>
                    {step.n}
                  </p>
                  <h3 className={s.stepTitle}>{m(`${step.key}Title`)}</h3>
                  <p className={`${s.body} ${s.stepBody}`}>{m(`${step.key}Body`)}</p>
                  <ul className={s.checks}>
                    {[1, 2, 3].map((b) => (
                      <li key={b}>
                        <Check />
                        {m(`${step.key}b${b}`)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`${s.stepVisual} ${s.scene}`}>
                  <div className={s.scenePhone}>{step.phone}</div>
                  <div className={s.sceneCard}>{step.card}</div>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* 4b. Moving in: RouteHQ brings a business's records in for it, free. The picture follows the words on phones. */}
      <section aria-labelledby="moving-in" className={s.sectionBottom}>
        <Container className={s.importRow}>
          <div className={s.importText}>
            <div className={s.head}>
              <Eyebrow>{m("importEyebrow")}</Eyebrow>
              <h2 className={s.h2} id="moving-in">
                {m("importTitle")}
              </h2>
              <p className={s.body}>{m("importBody")}</p>
            </div>
            <ul className={s.checks}>
              {[1, 2, 3].map((n) => (
                <li key={n}>
                  <Check />
                  {m(`import${n}`)}
                </li>
              ))}
            </ul>
            <p className={s.importNote}>{m("importNote")}</p>
          </div>
          <div className={s.importVisual}>
            <ImportMock />
          </div>
        </Container>
      </section>

      {/* 5. Every morning */}
      <section className={`${s.mist} ${s.section}`}>
        <Container className={s.dayGrid}>
          <div className={s.dayPhone}>
            <TodayPhoneMock />
          </div>
          <div>
            <div className={s.head}>
              <Eyebrow>{m("dayEyebrow")}</Eyebrow>
              <h2 className={s.h2}>{m.rich("dayTitle", RICH)}</h2>
              <p className={s.lede}>{m("dayBody")}</p>
            </div>
            <div className={s.dayTools}>
              <ul className={s.list}>
                {stats.map((stat) => (
                  <li className={s.statRow} key={stat.label}>
                    <span aria-hidden="true" className={s.statDot} style={{ background: stat.colour }} />
                    {stat.label}
                  </li>
                ))}
              </ul>
              <div className={s.chat}>
                <p className={s.chatTitle}>{m("daySummaryTitle")}</p>
                <div>
                  <div className={s.chatRow}>
                    <span className={s.chatAvatar}>R</span>
                    <div className={s.chatBubble}>
                      <p>
                        {t("mockOverdue", { count: 1 })} · {t("mockForToday", { count: 3 })}
                      </p>
                      <p>{m("daySummaryTaken", { amount: money(9800) })}</p>
                      <p>{m("daySummaryTomorrow", { count: 2 })}</p>
                    </div>
                  </div>
                  <p className={s.chatTime}>07:00</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* 6. Grow */}
      <section className={`${s.dark} ${s.section}`}>
        <Container>
          <div className={`${s.head} ${s.headWide}`}>
            <Eyebrow>{m("growEyebrow")}</Eyebrow>
            <h2 className={s.h2}>{m.rich("growTitle", RICH)}</h2>
            <p className={s.lede}>{m("growBody")}</p>
          </div>
        </Container>
        <Container className={s.growGrid}>
          <div>
            <ul className={s.list}>
              {[1, 2, 3].map((n) => (
                <li className={s.listItem} key={n}>
                  <h3>{m(`grow${n}Title`)}</h3>
                  <p>{m(`grow${n}Body`)}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <ShopPageMock />
          </div>
        </Container>
      </section>

      {/* 7. The rest of the job */}
      <section className={s.section}>
        <Container>
          <div className={s.head}>
            <h2 className={s.h2}>{m("restTitle")}</h2>
            <p className={s.lede}>{m("restBody")}</p>
          </div>
          <ul className={s.row4}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <li className={s.rowItem} key={n}>
                <h3>{m(`rest${n}Title`)}</h3>
                <p>{m(`rest${n}Body`)}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 8. Plans in brief */}
      <section className={`${s.mist} ${s.section}`}>
        <Container>
          <div className={`${s.head} ${s.headWide}`}>
            <Eyebrow>{m("priceEyebrow")}</Eyebrow>
            <h2 className={s.h2}>{m.rich("priceTitle", RICH)}</h2>
            <p className={s.lede}>{m("priceBody")}</p>
          </div>
          <div className={s.planStrip}>
            {PLANS.map((plan) => {
              const hot = plan.id === "pro";
              const monthly = planPrices(plan, currency).monthly;
              return (
                <div className={`${s.planCell} ${hot ? s.planHot : ""}`} key={plan.id}>
                  <div className="min-w-0">
                    <p className={s.planName}>{say(`bl_${plan.id}`)}</p>
                    <p className={s.planMeta}>{plan.id === "business" ? say("pl_anySize") : say("pl_upTo", { fleet: fleetText({ cars: plan.cars!, motorbikes: plan.motorbikes! }, say) })}</p>
                  </div>
                  <div className="text-end min-[900px]:contents">
                    <p className={s.planPrice}>{plan.monthly === 0 ? say("pl_free") : price(monthly)}</p>
                    <p className={`${s.planMeta} ${s.planPer}`}>{plan.monthly === 0 ? say("pl_forever") : say("bl_perMonth")}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <SiteLink className={`${s.link} mt-6`} href={SITE_LINKS.pricing}>
            {m("priceLink")} <Arrow />
          </SiteLink>
        </Container>
      </section>

      {/* 9. Why, 10. Questions */}
      <section className={s.section}>
        <Container>
          <div className={`${s.twoCol} ${s.twoColWhy}`}>
            <div className={`${s.head} ${s.headWide}`}>
              <Eyebrow>{m("whyEyebrow")}</Eyebrow>
              <h2 className={`${s.h2} ${s.h2Why}`}>{m.rich("whyTitle", RICH)}</h2>
            </div>
            <p className={`${s.body} lg:pt-9`}>{m("whyBody")}</p>
          </div>
          <div className={`${s.twoCol} mt-[var(--section)]`}>
            <h2 className={s.h2}>{m("faqTitle")}</h2>
            <div className={s.faq}>
              {[1, 2, 3, 4, 5].map((n) => (
                <details className={s.faqItem} key={n}>
                  <summary>
                    {m(`faq${n}Q`)}
                    <Plus />
                  </summary>
                  <p>{m(`faq${n}A`)}</p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
